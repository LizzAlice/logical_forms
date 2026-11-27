"""Reading and writing a logical-forms YAML file.

The file is read with PyYAML. Saving never rewrites the whole file: every line
that belongs to a form, section or block you did not change is copied as it was,
comments and blank lines included. Only changed or new parts are written out
again, with lists as brackets spread over several lines.
"""

import copy
import datetime
import difflib
import json
import os
import re

import yaml

ASSERTABLE = ("result", "claim", "assumption", "limitation", "open")


# ---------------------------------------------------------------- loading

def _norm(value, key=None):
    """Plain JSON-friendly values: dates become YYYY-MM-DD, strings are stripped."""
    if isinstance(value, bool):
        if key == "surface":
            return "yes" if value else "no"
        return value
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()[:10]
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return [_norm(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _norm(v, str(k)) for k, v in value.items()}
    return value


def normalize(data):
    """Turn what yaml.safe_load returned into the editor's model."""
    if not isinstance(data, dict):
        raise ValueError("The file does not hold a YAML mapping at its top level.")
    model = {"spec": _norm(data.get("spec", "")),
             "component_keys": _norm(data.get("component_keys") or {}),
             "sections": [], "other_top": [k for k in data if k not in ("spec", "component_keys", "sections")]}
    for sec in data.get("sections") or []:
        if not isinstance(sec, dict):
            raise ValueError("An entry under sections: is not a mapping.")
        s = {}
        for k, v in sec.items():
            if k == "forms":
                continue
            s[str(k)] = _norm(v, str(k))
        forms = []
        for f in sec.get("forms") or []:
            if not isinstance(f, dict):
                raise ValueError("A form under %s is not a mapping." % s.get("id"))
            forms.append({str(k): _norm(v, str(k)) for k, v in f.items()})
        s["forms"] = forms
        model["sections"].append(s)
    return model


def canonical(obj):
    """A comparable form of a model part: empty strings and missing keys are the same."""
    def clean(v):
        if isinstance(v, dict):
            return {k: clean(x) for k, x in v.items() if x != "" and x is not None}
        if isinstance(v, list):
            return [clean(x) for x in v]
        if isinstance(v, (datetime.date, datetime.datetime)):
            return v.isoformat()[:10]
        if isinstance(v, str):
            return re.sub(r"\s+", " ", v).strip()
        return v
    return json.dumps(clean(obj), sort_keys=True, ensure_ascii=False)


def _indent(line):
    return len(line) - len(line.lstrip(" "))


def _trim_end(lines, start, end, own_indent):
    """Last line of a block: drop trailing blank lines and comments at the block's own indentation or less."""
    e = end
    while e > start + 1:
        ln = lines[e - 1]
        st = ln.strip()
        if st == "" or (st.startswith("#") and _indent(ln) <= own_indent):
            e -= 1
            continue
        break
    return e


def _map_get(node, key):
    for k, v in node.value:
        if isinstance(k, yaml.ScalarNode) and k.value == key:
            return k, v
    return None, None


def _styles(node, prefix=""):
    """How each scalar value of a mapping was written: '>' '|' '"' "'" or '' for plain."""
    out = {}
    if not isinstance(node, yaml.MappingNode):
        return out
    for k, v in node.value:
        if not isinstance(k, yaml.ScalarNode):
            continue
        key = prefix + k.value
        if isinstance(v, yaml.ScalarNode):
            st = v.style or ""
            if st in ('"', "'") and v.end_mark.line > v.start_mark.line:
                st = '"m'
            out[key] = st
        elif isinstance(v, yaml.MappingNode):
            out.update(_styles(v, key + "."))
    return out


def locate(text):
    """Line positions of the top block, the sections and every form."""
    lines = text.split("\n")
    root = yaml.compose(text, Loader=yaml.SafeLoader)
    pos = {"component_keys": None, "sections": {}, "forms": {}, "sections_key_line": None,
           "sections_indent": 2, "form_indent": 6, "n_lines": len(lines)}
    if root is None or not isinstance(root, yaml.MappingNode):
        return lines, pos
    top_keys = [(k.start_mark.line, k.value) for k, _ in root.value if isinstance(k, yaml.ScalarNode)]
    ck_key, ck_val = _map_get(root, "component_keys")
    if ck_key is not None:
        later = [ln for ln, _ in top_keys if ln > ck_key.start_mark.line]
        end = min(later) if later else len(lines)
        pos["component_keys"] = (ck_key.start_mark.line, _trim_end(lines, ck_key.start_mark.line, end, 0))
        if isinstance(ck_val, yaml.MappingNode):
            pos["ck_styles"] = {("component_keys." + k): v for k, v in _styles(ck_val).items()}
    sk, sv = _map_get(root, "sections")
    if sk is None or not isinstance(sv, yaml.SequenceNode):
        return lines, pos
    pos["sections_key_line"] = sk.start_mark.line
    secs = sv.value
    sec_end_all = sv.end_mark.line if sv.end_mark.line > sk.start_mark.line else len(lines)
    later_top = [ln for ln, _ in top_keys if ln > sk.start_mark.line]
    if later_top:
        sec_end_all = min(sec_end_all, min(later_top))
    else:
        sec_end_all = len(lines)
    for i, snode in enumerate(secs):
        if not isinstance(snode, yaml.MappingNode):
            continue
        idk, idv = _map_get(snode, "id")
        sid = idv.value if idv is not None else "?%d" % i
        start = snode.start_mark.line
        end = secs[i + 1].start_mark.line if i + 1 < len(secs) else sec_end_all
        sec_indent = _indent(lines[start])
        pos["sections_indent"] = sec_indent
        fk, fv = _map_get(snode, "forms")
        info = {"styles": _styles(snode), "start": start, "end": _trim_end(lines, start, end, sec_indent), "raw_end": end,
                "indent": sec_indent, "forms_line": fk.start_mark.line if fk is not None else None,
                "forms_style": "none", "forms_after": False, "blank_between": False}
        if fk is not None:
            keys_after = [k for k, _ in snode.value if isinstance(k, yaml.ScalarNode)
                          and k.start_mark.line > fk.start_mark.line]
            info["forms_after"] = bool(keys_after)
            if isinstance(fv, yaml.SequenceNode):
                info["forms_style"] = "flow" if fv.flow_style else "block"
                items = fv.value
                for j, fnode in enumerate(items):
                    if not isinstance(fnode, yaml.MappingNode):
                        continue
                    _, fid = _map_get(fnode, "id")
                    fid = fid.value if fid is not None else "?%d.%d" % (i, j)
                    fstart = fnode.start_mark.line
                    fend = items[j + 1].start_mark.line if j + 1 < len(items) else end
                    dash = _indent(lines[fstart])
                    pos["form_indent"] = dash
                    trimmed = _trim_end(lines, fstart, fend, dash)
                    if j + 1 < len(items) and any(lines[x].strip() == "" for x in range(trimmed, fend)):
                        info["blank_between"] = True
                    if fid not in pos["forms"]:
                        pos["forms"][fid] = {"start": fstart, "end": trimmed, "section": sid, "indent": dash,
                                             "flow": bool(fv.flow_style), "styles": _styles(fnode)}
            else:
                info["forms_style"] = "null"
        pos["sections"][sid] = info
    return lines, pos


def load_file(path):
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    data = yaml.safe_load(text)
    model = normalize(data)
    lines, pos = locate(text)
    return text, model, pos


# ---------------------------------------------------------------- writing

WIDTH = 88
MAX_LINE = 100
_PLAIN = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_./+-]*")
_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


ID_RE = re.compile(r"(P|DEF|ART|SET|SEC)-[A-Za-z0-9_.-]+")
ENUM_KEYS = {"type", "status", "severity", "surface", "wording", "rel", "spec", "to", "id"}


def scalar(v, plain_ok=False):
    """One scalar as YAML. Ids, dates, enum values and labels in id lists stay plain; other text is double-quoted."""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    s = str(v)
    if _DATE.fullmatch(s):
        return s
    if (plain_ok or ID_RE.fullmatch(s)) and _PLAIN.fullmatch(s):
        try:
            back = yaml.safe_load(s)
        except yaml.YAMLError:
            back = None
        if back == s:
            return s
    return json.dumps(s, ensure_ascii=False)


def _block(value, indent):
    """A folded block (>) for prose, a literal block (|) when the text has single line breaks."""
    pad = " " * indent
    paras = value.split("\n\n")
    if any("\n" in p for p in paras):
        return ["|"] + [(pad + ln) if ln.strip() else "" for ln in value.split("\n")]
    out = [">"]
    for k, p in enumerate(paras):
        if k:
            out.append("")
        words = p.split()
        line = ""
        for w in words:
            if line and len(pad) + len(line) + 1 + len(w) > WIDTH:
                out.append(pad + line)
                line = w
            else:
                line = (line + " " + w) if line else w
        if line:
            out.append(pad + line)
    return out


def _wrap_quoted(q, indent):
    """A double-quoted string spread over several lines, broken at spaces (YAML folds them back)."""
    pad = " " * indent
    out, line = [], ""
    for w in q.split(" "):
        if line and len(pad) + len(line) + 1 + len(w) > WIDTH:
            out.append(pad + line)
            line = w
        else:
            line = (line + " " + w) if line else w
    out.append(pad + line)
    return out


def _flow_map(d):
    return "{" + ", ".join("%s: %s" % (k, scalar(x, k in ENUM_KEYS)) for k, x in d.items()) + "}"


REF_LIST_KEYS = {"evidence", "derived_from", "affects", "resolved_by", "replaced_by", "answered_by",
                 "includes", "part_of", "follows", "uses"}


def emit_value(key, value, indent, prefix=None, styles=None, path=""):
    """Lines for `key: value` at the given indentation. prefix replaces the indentation on the first line.
    styles maps dotted keys to how the value was written in the original file."""
    styles = styles or {}
    full = path + key
    head = prefix if prefix is not None else " " * indent
    if isinstance(value, dict):
        if not value:
            return [head + key + ": {}"]
        out = [head + key + ":"]
        for k, x in value.items():
            if x == "" or x is None:
                continue
            out += emit_value(str(k), x, indent + 2, styles=styles, path=full + ".")
        return out
    if isinstance(value, list):
        if not value:
            return [head + key + ": []"]
        if key == "links" and all(isinstance(x, dict) for x in value):
            out = [head + key + ":"]
            for d in value:
                out.append(" " * (indent + 2) + "- {")
                for k, x in d.items():
                    out.append(" " * (indent + 6) + "%s: %s," % (k, scalar(x, k in ENUM_KEYS)))
                out.append(" " * (indent + 4) + "}")
            return out
        out = [head + key + ":", " " * (indent + 2) + "["]
        for x in value:
            item = _flow_map(x) if isinstance(x, dict) else scalar(x, key in REF_LIST_KEYS)
            out.append(" " * (indent + 4) + item + ",")
        out.append(" " * (indent + 2) + "]")
        return out
    if isinstance(value, str) and value != "":
        one = head + key + ": " + scalar(value, key in ENUM_KEYS)
        style = styles.get(full)
        if style in (">", "|"):
            want_block = True
        elif style is not None:
            want_block = "\n" in value
        elif full.startswith("component_keys."):
            want_block = "\n" in value
        else:
            want_block = "\n" in value or len(one) > MAX_LINE
        if style == '"m' and "\n" not in value:
            return [head + key + ":"] + _wrap_quoted(scalar(value), indent + 2)
        if want_block:
            b = _block(value, indent + 2)
            if style == "|" and b[0] == ">":
                b = ["|"] + b[1:]
            return [head + key + ": " + b[0]] + b[1:]
        return [one]
    if value == "" or value is None:
        return [head + key + ":"]
    return [head + key + ": " + scalar(value)]


def emit_mapping(d, dash_indent, skip=(), styles=None):
    """A form or section header as a block sequence item starting with '- '."""
    lines = []
    first = True
    for k, v in d.items():
        if k in skip:
            continue
        if (v == "" or v is None) and k != "id":
            continue
        if first:
            lines += emit_value(k, v, dash_indent + 2, prefix=" " * dash_indent + "- ", styles=styles)
            first = False
        else:
            lines += emit_value(k, v, dash_indent + 2, styles=styles)
    return lines


def emit_component_keys(ck, styles=None):
    return emit_value("component_keys", ck, 0, styles=styles)


class Doc:
    """An opened forms file: its original text, the model as loaded, and the current model."""

    def __init__(self, path, text, model, pos):
        self.path = path
        self.text = text
        self.lines = text.split("\n")
        self.orig = model
        self.model = copy.deepcopy(model)
        self.pos = pos

    @classmethod
    def open(cls, path):
        text, model, pos = load_file(path)
        return cls(os.path.abspath(path), text, model, pos)

    # -- what changed ------------------------------------------------
    def _orig_index(self):
        out = {}
        for s in self.orig["sections"]:
            for f in s["forms"]:
                out.setdefault(f["id"], (s["id"], f))
        return out

    def changes(self):
        """What differs from the file as opened: added, edited and moved forms, sections, registry."""
        orig = self._orig_index()
        seen = set()
        out = []
        for s in self.model["sections"]:
            for f in s["forms"]:
                fid = f["id"]
                seen.add(fid)
                if fid not in orig:
                    out.append({"kind": "added", "id": fid, "type": f.get("type"), "section": s["id"], "fields": []})
                    continue
                osec, of = orig[fid]
                fields = field_diff(of, f)
                if osec != s["id"]:
                    out.append({"kind": "moved", "id": fid, "type": f.get("type"), "section": s["id"],
                                "from": osec, "fields": fields})
                elif fields:
                    out.append({"kind": "edited", "id": fid, "type": f.get("type"), "section": s["id"],
                                "fields": fields})
        for fid in orig:
            if fid not in seen:
                out.append({"kind": "removed", "id": fid, "type": orig[fid][1].get("type"),
                            "section": orig[fid][0], "fields": []})
        osecs = {s["id"]: s for s in self.orig["sections"]}
        for s in self.model["sections"]:
            meta = {k: v for k, v in s.items() if k != "forms"}
            if s["id"] not in osecs:
                out.append({"kind": "section added", "id": s["id"], "type": "section", "section": s["id"], "fields": []})
            else:
                ometa = {k: v for k, v in osecs[s["id"]].items() if k != "forms"}
                fields = field_diff(ometa, meta)
                if fields:
                    out.append({"kind": "section edited", "id": s["id"], "type": "section", "section": s["id"],
                                "fields": fields})
        if canonical(self.orig["component_keys"]) != canonical(self.model["component_keys"]):
            out.append({"kind": "registry edited", "id": "component_keys", "type": "registry", "section": "",
                        "fields": field_diff(self.orig["component_keys"], self.model["component_keys"])})
        return out

    def is_dirty(self):
        return canonical(_strip_other(self.orig)) != canonical(_strip_other(self.model))

    # -- writing -----------------------------------------------------
    def render(self):
        """The text of the file as it would be saved."""
        lines = self.lines
        pos = self.pos
        ops = []  # (start, end, new_lines, seq)
        seq = [0]

        def op(start, end, new):
            ops.append((start, end, new, seq[0]))
            seq[0] += 1

        orig = self._orig_index()
        orig_secs = {s["id"]: s for s in self.orig["sections"]}
        cur_where = {}
        for s in self.model["sections"]:
            for f in s["forms"]:
                cur_where[f["id"]] = s["id"]

        # registry
        if canonical(self.orig["component_keys"]) != canonical(self.model["component_keys"]):
            new = emit_component_keys(self.model["component_keys"], pos.get("ck_styles"))
            if pos["component_keys"]:
                a, b = pos["component_keys"]
                op(a, b, new)
            else:
                at = pos["sections_key_line"] if pos["sections_key_line"] is not None else len(lines)
                op(at, at, new + [""])

        # forms that left their place (moved away or removed)
        for fid, (osec, of) in orig.items():
            p = pos["forms"].get(fid)
            if p is None:
                continue
            if cur_where.get(fid) != osec:
                op(p["start"], p["end"], [])

        last_line = len(lines)
        while last_line > 0 and lines[last_line - 1].strip() == "":
            last_line -= 1
        appended = []
        for s in self.model["sections"]:
            sid = s["id"]
            meta = {k: v for k, v in s.items() if k != "forms"}
            sp = pos["sections"].get(sid)
            sec_indent = pos["sections_indent"]
            form_indent = pos["form_indent"]
            if sp is not None:
                for of in orig_secs.get(sid, {}).get("forms", []):
                    if of.get("id") in pos["forms"]:
                        form_indent = pos["forms"][of["id"]]["indent"]
                        break
            if sid not in orig_secs or sp is None:
                block = emit_mapping(meta, sec_indent)
                block.append(" " * (sec_indent + 2) + "forms:" + ("" if s["forms"] else " []"))
                for f in s["forms"]:
                    block += emit_mapping(f, sec_indent + 4)
                appended.append(block)
                continue
            ometa = {k: v for k, v in orig_secs[sid].items() if k != "forms"}
            if canonical(ometa) != canonical(meta) and sp["forms_line"] is not None and not sp["forms_after"]:
                op(sp["start"], sp["forms_line"], emit_mapping(meta, sp["indent"], styles=sp["styles"]))
            # forms: rewrite changed, insert new or moved-in
            prev_anchor = None  # end line of the previous form kept in place
            pending = []
            groups = []  # (anchor_line, [lines...])

            def flush():
                if pending:
                    groups.append((prev_anchor, list(pending)))
                    del pending[:]
            for f in s["forms"]:
                fid = f["id"]
                p = pos["forms"].get(fid)
                stays = fid in orig and orig[fid][0] == sid and p is not None and p["section"] == sid
                if stays:
                    flush()
                    if canonical(orig[fid][1]) != canonical(f):
                        op(p["start"], p["end"], emit_mapping(f, p["indent"], styles=p["styles"]))
                    prev_anchor = p["end"]
                else:
                    pending.append(f)
            flush()
            for anchor, forms in groups:
                new = []
                for f in forms:
                    if sp["blank_between"] and (new or anchor is not None):
                        new.append("")
                    op_styles = pos["forms"][f["id"]]["styles"] if f["id"] in pos["forms"] else None
                    new += emit_mapping(f, form_indent, styles=op_styles)
                if anchor is None:
                    fl = sp["forms_line"]
                    if fl is None:
                        at = sp["end"]
                        new = [" " * (sp["indent"] + 2) + "forms:"] + new
                        op(at, at, new)
                    elif sp["forms_style"] in ("flow", "null"):
                        op(fl, fl + 1, [" " * (sp["indent"] + 2) + "forms:"] + new)
                    else:
                        op(fl + 1, fl + 1, new + ([""] if sp["blank_between"] else []))
                else:
                    op(anchor, anchor, new)
        if appended:
            new = []
            for block in appended:
                new += [""] + block
            op(last_line, last_line, new)

        out = list(lines)
        for start, end, new, _ in sorted(ops, key=lambda o: (o[0], o[3]), reverse=True):
            out[start:end] = new
        return "\n".join(out)

    def verify_text(self, text):
        """Read text back and compare it with the current model. Returns a list of differences."""
        try:
            back = normalize(yaml.safe_load(text))
        except Exception as exc:  # noqa: BLE001
            return ["The written file cannot be read back: %s" % exc]
        problems = []
        a, b = _strip_other(back), _strip_other(self.model)
        if canonical(a["component_keys"]) != canonical(b["component_keys"]):
            problems.append("component_keys differ")
        if [s["id"] for s in a["sections"]] != [s["id"] for s in b["sections"]]:
            problems.append("the list of sections differs")
        for sa, sb in zip(a["sections"], b["sections"]):
            ma = {k: v for k, v in sa.items() if k != "forms"}
            mb = {k: v for k, v in sb.items() if k != "forms"}
            if canonical(ma) != canonical(mb):
                problems.append("section %s differs" % sb["id"])
            ida = [f.get("id") for f in sa["forms"]]
            idb = [f.get("id") for f in sb["forms"]]
            if ida != idb:
                problems.append("the forms of %s differ in order or number" % sb["id"])
                continue
            for fa, fb in zip(sa["forms"], sb["forms"]):
                if canonical(fa) != canonical(fb):
                    problems.append("form %s differs" % fb.get("id"))
        return problems

    def diff_text(self, new_text, name):
        return "".join(difflib.unified_diff(
            self.text.splitlines(True), new_text.splitlines(True),
            fromfile=os.path.basename(self.path), tofile=name, n=2))


def _strip_other(model):
    return {"spec": model.get("spec"), "component_keys": model.get("component_keys"),
            "sections": model.get("sections")}


def field_diff(a, b):
    out = []
    keys = list(a.keys()) + [k for k in b.keys() if k not in a]
    for k in keys:
        va, vb = a.get(k, ""), b.get(k, "")
        if canonical(va) == canonical(vb):
            continue
        entry = {"field": k}
        if isinstance(va, list) or isinstance(vb, list):
            la = va if isinstance(va, list) else []
            lb = vb if isinstance(vb, list) else []
            ca = [canonical(x) for x in la]
            cb = [canonical(x) for x in lb]
            entry["added"] = [x for x, c in zip(lb, cb) if c not in ca]
            entry["removed"] = [x for x, c in zip(la, ca) if c not in cb]
            if not entry["added"] and not entry["removed"]:
                entry["old"], entry["new"] = "order changed", ""
        elif isinstance(va, dict) or isinstance(vb, dict):
            sub = field_diff(va if isinstance(va, dict) else {}, vb if isinstance(vb, dict) else {})
            entry["sub"] = sub
        else:
            entry["old"], entry["new"] = va, vb
        out.append(entry)
    return out


def dated_name(path, now=None):
    """forms.yaml -> forms_2026-11-13_1146.yaml, without stacking dates on a dated copy."""
    now = now or datetime.datetime.now()
    folder, base = os.path.split(path)
    stem, ext = os.path.splitext(base)
    stem = re.sub(r"_\d{4}-\d{2}-\d{2}_\d{4}(-\d+)?$", "", stem)
    return os.path.join(folder, "%s_%s%s" % (stem, now.strftime("%Y-%m-%d_%H%M"), ext or ".yaml"))


def write_new(doc, target):
    """Write doc to target, which must not exist yet. Reads the file back; removes it if it does not match."""
    if os.path.exists(target):
        raise FileExistsError(target)
    text = doc.render()
    problems = doc.verify_text(text)
    if problems:
        return {"ok": False, "problems": problems}
    with open(target, "x", encoding="utf-8") as fh:
        fh.write(text)
    with open(target, encoding="utf-8") as fh:
        back = fh.read()
    problems = doc.verify_text(back)
    if problems or back != text:
        os.remove(target)
        return {"ok": False, "problems": problems or ["The file on disk differs from what was written."]}
    return {"ok": True, "path": target}


def new_file_text(component_keys, section):
    lines = ["spec: v1"] + emit_component_keys(component_keys) + ["", "sections:"]
    meta = {k: v for k, v in section.items() if k != "forms"}
    lines += emit_mapping(meta, 2)
    lines.append("    forms: []")
    return "\n".join(lines) + "\n"
