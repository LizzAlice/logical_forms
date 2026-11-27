#!/usr/bin/env python3
"""Forms editor: look through, change and extend a logical-forms YAML file in your browser.

    python forms_editor.py forms.yaml      # open a file
    python forms_editor.py                 # start screen: open a file or make a new one

Runs only on your computer (http://127.0.0.1). Saving never writes to the file you
opened: every save writes a new dated file next to it, reads it back and checks it.
Needs Python 3.8+ and PyYAML (pip install pyyaml).
"""

import argparse
import json
import os
import sys
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

try:
    import yaml  # noqa: F401
except ImportError:
    sys.exit("The forms editor needs PyYAML. Install it with:  pip install pyyaml")

from formslib import schema                                   # noqa: E402
from formslib.doc import Doc, dated_name, write_new, new_file_text   # noqa: E402
from formslib.logic import Index, Editor, EditError, run_checks, today, RULES, TITLES, PASS, form_text   # noqa: E402
from formslib.graph import section_graph                      # noqa: E402

STATIC = os.path.join(HERE, "static")
RECENT_FILE = os.path.join(os.path.expanduser("~"), ".forms_editor_recent.json")
LOCK = threading.RLock()


class App:
    def __init__(self):
        self.doc = None
        self.editor = None
        self.settings = {"frozen": True, "threshold": 50}
        self.recent = self._load_recent()

    # -- recent files -----------------------------------------------
    def _load_recent(self):
        try:
            with open(RECENT_FILE, encoding="utf-8") as fh:
                return [p for p in json.load(fh) if isinstance(p, str)][:8]
        except Exception:  # noqa: BLE001
            return []

    def _remember(self, path):
        self.recent = [path] + [p for p in self.recent if p != path]
        self.recent = self.recent[:8]
        try:
            with open(RECENT_FILE, "w", encoding="utf-8") as fh:
                json.dump(self.recent, fh)
        except OSError:
            pass

    def open(self, path):
        path = os.path.abspath(os.path.expanduser(path))
        if not os.path.isfile(path):
            raise EditError("There is no file at %s." % path)
        try:
            doc = Doc.open(path)
        except Exception as exc:  # noqa: BLE001
            raise EditError("This file could not be read as a forms file: %s" % exc)
        self.doc = doc
        self.editor = Editor(doc, self.settings)
        self._remember(path)

    # -- state ------------------------------------------------------
    def state(self):
        out = {"open": self.doc is not None, "settings": self.settings, "recent": self.recent,
               "today": today(), "schema": {
                   "templates": schema.TEMPLATES, "types": schema.TYPES, "when": schema.WHEN,
                   "pairs": schema.PAIRS, "defs": schema.DEFS, "retype": schema.RETYPE,
                   "prefix": schema.PREFIX, "link_rels": schema.LINK_RELS,
                   "standard_keys": schema.STANDARD_KEYS}}
        if not self.doc:
            return out
        idx = Index(self.doc.model)
        problems = run_checks(self.doc.model, idx)
        changes = self.doc.changes()
        orig_ids = {f["id"] for s in self.doc.orig["sections"] for f in s["forms"]}
        out.update({
            "file": self.doc.path, "name": os.path.basename(self.doc.path),
            "folder": os.path.dirname(self.doc.path),
            "model": self.doc.model, "dirty": bool(changes), "n_changes": len(changes),
            "changed_ids": [c["id"] for c in changes],
            "new_ids": [fid for fid in idx.forms if fid not in orig_ids],
            "n_problems": len(problems), "n_gaps": len(idx.citation_gaps()), "n_revisit": len(idx.revisit()),
            "can_undo": bool(self.editor.history),
            "undo_label": self.editor.history[-1][0] if self.editor.history else "",
            "texts": {fid: {"t": f.get("type"), "s": f.get("status", ""), "x": _text(f), "sec": idx.section_of[fid],
                            "u": f.get("updated", "")}
                      for fid, f in idx.forms.items()},
        })
        return out

    def checks(self):
        idx = Index(self.doc.model)
        return {"problems": run_checks(self.doc.model, idx), "gaps": idx.citation_gaps(),
                "revisit": idx.revisit(), "coverage": idx.coverage(),
                "opens": idx.opens(), "rules": {str(k): v for k, v in sorted(RULES.items())},
                "titles": {str(k): v for k, v in TITLES.items()},
                "pass": {str(k): v for k, v in PASS.items()}}

    def save_preview(self):
        target = dated_name(self.doc.path)
        text = self.doc.render()
        problems = self.doc.verify_text(text)
        return {"changes": self.doc.changes(), "default_name": os.path.basename(target),
                "folder": os.path.dirname(self.doc.path), "opened": os.path.basename(self.doc.path),
                "diff": self.doc.diff_text(text, os.path.basename(target)), "read_back": problems,
                "n_problems": len(run_checks(self.doc.model)), "exists": os.path.exists(target)}

    def save(self, name):
        name = (name or "").strip()
        if not name or os.sep in name or (os.altsep and os.altsep in name) or name.startswith("."):
            raise EditError("Give a file name without folders.")
        if not name.endswith((".yaml", ".yml")):
            name += ".yaml"
        target = os.path.join(os.path.dirname(self.doc.path), name)
        if os.path.abspath(target) == os.path.abspath(self.doc.path):
            raise EditError("That is the file you opened. Saving always writes a new file.")
        if os.path.exists(target):
            raise EditError("%s exists already. Pick another name; nothing is replaced." % name)
        res = write_new(self.doc, target)
        if not res["ok"]:
            raise EditError("The new file did not read back the same, so it was not kept: " + "; ".join(res["problems"]))
        self.open(target)
        return target

    def new_file(self, folder, name, keys, section):
        folder = os.path.abspath(os.path.expanduser(folder or ""))
        if not os.path.isdir(folder):
            raise EditError("There is no folder %s." % folder)
        name = (name or "").strip()
        if not name or os.sep in name:
            raise EditError("Give a file name without folders.")
        if not name.endswith((".yaml", ".yml")):
            name += ".yaml"
        path = os.path.join(folder, name)
        if os.path.exists(path):
            raise EditError("%s exists already. Pick another name; nothing is replaced." % name)
        sid = (section.get("id") or "").strip()
        if not sid.startswith("SEC-") or sid == "SEC-":
            raise EditError("The first section needs an id starting with SEC-.", missing=["a section id"])
        miss = [lab for k, lab in (("title", "a section title"), ("about", "what belongs in the section")) if not (section.get(k) or "").strip()]
        if miss:
            raise EditError("Still needed: " + ", ".join(miss) + ".", missing=miss)
        sec = {"id": sid, "type": "section", "title": section["title"].strip(), "about": section["about"].strip(),
               "links": [], "status": "drafting", "updated": today()}
        text = new_file_text({k: v for k, v in keys}, sec)
        with open(path, "x", encoding="utf-8") as fh:
            fh.write(text)
        self.open(path)
        return path


def _text(f):
    return form_text(f)[:300]


APP = App()


def browse(path):
    path = os.path.abspath(os.path.expanduser(path or "~"))
    if os.path.isfile(path):
        path = os.path.dirname(path)
    entries = []
    try:
        for n in sorted(os.listdir(path), key=str.lower):
            if n.startswith("."):
                continue
            full = os.path.join(path, n)
            if os.path.isdir(full):
                entries.append({"name": n, "dir": True, "path": full})
            elif n.endswith((".yaml", ".yml")):
                entries.append({"name": n, "dir": False, "path": full})
    except OSError as exc:
        raise EditError("Cannot list %s: %s" % (path, exc))
    return {"path": path, "parent": os.path.dirname(path), "entries": entries}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quiet
        pass

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith(("text", "application/json", "application/javascript")) else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _static(self, rel):
        if rel == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        rel = rel.lstrip("/") or "index.html"
        full = os.path.abspath(os.path.join(STATIC, rel))
        if not full.startswith(STATIC) or not os.path.isfile(full):
            return self._send(404, {"error": "not found"})
        ctype = {"html": "text/html", "js": "application/javascript", "css": "text/css",
                 "svg": "image/svg+xml"}.get(full.rsplit(".", 1)[-1], "application/octet-stream")
        with open(full, "rb") as fh:
            self._send(200, fh.read(), ctype)

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if not u.path.startswith("/api/"):
            return self._static(u.path)
        self._api("GET", u.path[5:], q, None)

    def do_POST(self):
        u = urlparse(self.path)
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self._send(400, {"ok": False, "error": "Bad request."})
        self._api("POST", u.path[5:], {}, body)

    def _api(self, method, route, q, body):
        # Only accept requests from this page, not from other sites open in the browser.
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", "")
        if method == "POST" and origin and urlparse(origin).netloc != host:
            return self._send(403, {"ok": False, "error": "Refused."})
        try:
            with LOCK:
                res = dispatch(method, route, q, body or {})
            self._send(200, res)
        except EditError as exc:
            self._send(200, {"ok": False, "error": str(exc), "missing": exc.missing, "frozen": exc.frozen})
        except Exception as exc:  # noqa: BLE001
            traceback.print_exc()
            self._send(500, {"ok": False, "error": "Something went wrong in the editor: %s" % exc})


def need_doc():
    if not APP.doc:
        raise EditError("No file is open.")


def dispatch(method, route, q, b):
    ed = APP.editor
    if route == "state":
        return APP.state()
    if route == "browse":
        return browse(q.get("path"))
    if route == "open":
        APP.open(b["path"])
        return {"ok": True, "state": APP.state()}
    if route == "newfile":
        path = APP.new_file(b.get("folder"), b.get("name"), b.get("keys") or [], b.get("section") or {})
        return {"ok": True, "path": path, "state": APP.state()}
    if route == "settings":
        if "frozen" in b:
            APP.settings["frozen"] = bool(b["frozen"])
        if "threshold" in b:
            APP.settings["threshold"] = max(5, int(b["threshold"]))
        return {"ok": True, "state": APP.state()}
    need_doc()
    if route == "relations":
        idx = Index(APP.doc.model)
        if q.get("id") not in idx.forms:
            raise EditError("There is no form %s." % q.get("id"))
        return idx.relations(q["id"])
    if route == "checks":
        return APP.checks()
    if route == "graph":
        idx = Index(APP.doc.model)
        if q.get("section") not in idx.sections:
            raise EditError("There is no section %s." % q.get("section"))
        expand = [x for x in (q.get("expand") or "").split(",") if x]
        return section_graph(idx, q["section"], q.get("mode") or "auto", expand,
                             q.get("hide", "1") == "1", APP.settings["threshold"])
    if route == "newversion" and method == "GET":
        return ed.new_version_plan(q["id"], q.get("new_id") or None)
    if route == "save/preview":
        return APP.save_preview()
    # changes
    result = {}
    if route == "form/create":
        result["id"] = ed.create_form(b["form"], b["section"], b.get("after"))
    elif route == "form/update":
        result["id"] = ed.update_form(b["id"], b["form"], b.get("section"), b.get("mode"), b.get("note"))
    elif route == "form/discard":
        ed.discard_new(b["id"])
    elif route == "fix":
        r = ed.apply_fix(b["action"], b.get("args") or {})
        if isinstance(r, dict):
            result.update(r)
    elif route == "status":
        ed.set_status(b["id"], b["status"], b.get("extra"))
    elif route == "retype":
        result.update(ed.retype(b["id"], b["to"]))
    elif route == "open/close":
        ed.close_open(b["id"], b.get("answered_by") or [], b.get("reason"))
    elif route == "open/reopen":
        ed.reopen(b["id"])
    elif route == "newversion":
        result["rename"] = ed.new_version_apply(b["id"], b["new_id"], b.get("copies") or {})
    elif route == "section":
        result["id"] = ed.save_section(b.get("id"), b["meta"], bool(b.get("new")))
    elif route == "registry":
        ed.save_registry(b["keys"])
    elif route == "undo":
        result["undone"] = ed.undo()
    elif route == "save":
        result["path"] = APP.save(b.get("name"))
    else:
        raise EditError("Unknown request %s." % route)
    result["ok"] = True
    result["state"] = APP.state()
    return result


def main():
    ap = argparse.ArgumentParser(description="Forms editor for logical-forms YAML files.")
    ap.add_argument("file", nargs="?", help="the forms file to open")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-browser", action="store_true", help="do not open a browser window")
    ap.add_argument("--check-roundtrip", action="store_true",
                    help="only check that the file would be written back unchanged, then exit")
    args = ap.parse_args()
    if args.check_roundtrip:
        if not args.file:
            sys.exit("Give the file to check.")
        doc = Doc.open(args.file)
        same = doc.render() == doc.text
        print("Unchanged round trip: %s" % ("identical, byte for byte" if same else "DIFFERS"))
        sys.exit(0 if same else 1)
    if args.file:
        try:
            APP.open(args.file)
        except EditError as exc:
            sys.exit(str(exc))
    server = None
    for port in range(args.port, args.port + 20):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    if server is None:
        sys.exit("No free port found from %d on." % args.port)
    url = "http://127.0.0.1:%d/" % server.server_address[1]
    print("Forms editor running at %s  (Ctrl+C to stop)" % url)
    if APP.doc:
        print("Opened %s. Saves go next to it as new dated files." % APP.doc.path)
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        if APP.doc and APP.doc.is_dirty():
            print("\nStopped. There were unsaved changes; they are not written anywhere.")
        else:
            print("\nStopped.")


if __name__ == "__main__":
    main()
