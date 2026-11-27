"""Relations between forms, the file rules of §8, the standing queries of §8.1, and the changes the editor makes."""

import copy
import datetime
import difflib
import re

from .schema import (PREFIX, ASSERTABLE, TEMPLATES, REF_FIELDS, STANDARD_KEYS, RETYPE, order_keys)
from .doc import canonical

ID_PREFIXES = ("P-", "DEF-", "ART-", "SET-", "SEC-")
DONE_STATES = ("refuted", "outdated", "resolved", "closed", "superseded")
WEAK_STATES = ("preliminary", "assumed", "unsourced", "open", "planned")


def today():
    return datetime.date.today().isoformat()


def is_id(v):
    return isinstance(v, str) and v.startswith(ID_PREFIXES)


def as_list(v):
    if v is None or v == "":
        return []
    return v if isinstance(v, list) else [v]


class EditError(Exception):
    def __init__(self, message, missing=None, frozen=None):
        Exception.__init__(self, message)
        self.missing = missing or []
        self.frozen = frozen or []


class Index:
    """Lookups over a model. Rebuilt after every change; cheap at a few hundred forms."""

    def __init__(self, model):
        self.model = model
        self.forms = {}
        self.section_of = {}
        self.sections = {}
        self.order = []
        for s in model["sections"]:
            self.sections[s["id"]] = s
            for f in s["forms"]:
                if f.get("id") not in self.forms:
                    self.forms[f["id"]] = f
                    self.section_of[f["id"]] = s["id"]
                self.order.append(f.get("id"))
        self._up = {}
        self._down = None

    # -- rests-on links (§4.4) ---------------------------------------
    def component_ids(self, f):
        out = []
        for v in (f.get("components") or {}).values():
            for x in as_list(v):
                if is_id(x):
                    out.append(x)
        return out

    def rests_on(self, fid):
        f = self.forms.get(fid)
        if not f:
            return []
        t = f.get("type")
        if t == "claim":
            v = as_list(f.get("derived_from"))
        elif t == "result":
            v = as_list(f.get("evidence"))
        elif t == "setup":
            v = as_list(f.get("includes")) + self.component_ids(f)
        else:
            v = []
        seen, out = set(), []
        for x in v:
            if is_id(x) and x in self.forms and x not in seen:
                seen.add(x)
                out.append(x)
        return out

    def down_map(self):
        if self._down is None:
            d = {}
            for fid in self.forms:
                for u in self.rests_on(fid):
                    d.setdefault(u, []).append(fid)
            self._down = d
        return self._down

    def upstream(self, fid):
        if fid in self._up:
            return self._up[fid]
        seen, todo = set(), [fid]
        while todo:
            for u in self.rests_on(todo.pop()):
                if u not in seen and u != fid:
                    seen.add(u)
                    todo.append(u)
        self._up[fid] = seen
        return seen

    def downstream(self, fid):
        dm = self.down_map()
        seen, todo = set(), [fid]
        while todo:
            for d in dm.get(todo.pop(), []):
                if d not in seen and d != fid:
                    seen.add(d)
                    todo.append(d)
        return seen

    def levels_up(self, fid):
        """Upstream forms by step: {id: (step, child)} where child is the form it was reached from."""
        lvl = {fid: (0, None)}
        q = [fid]
        while q:
            n = q.pop(0)
            for u in self.rests_on(n):
                if u not in lvl:
                    lvl[u] = (lvl[n][0] + 1, n)
                    q.append(u)
        lvl.pop(fid)
        return lvl

    def covered(self, lim):
        """What a limitation covers: what affects names and everything resting on it."""
        if lim.get("status") == "refuted":
            return set()
        start = [x for x in as_list(lim.get("affects")) if x in self.forms]
        out = set(start)
        for a in start:
            out |= self.downstream(a)
        return out

    def limitations(self):
        return [f for f in self.forms.values() if f.get("type") == "limitation"]

    def lims_reaching(self, fid):
        """Limitations covering fid, each with the chain from what it names to fid."""
        lv = self.levels_up(fid)
        out = []
        for lim in self.limitations():
            if lim.get("status") == "refuted":
                continue
            aff = [a for a in as_list(lim.get("affects")) if a in self.forms]
            hit = None
            if fid in aff:
                hit = [fid]
            else:
                for a in sorted(aff, key=lambda a: lv.get(a, (999,))[0]):
                    if a in lv:
                        path, x = [a], a
                        while x != fid:
                            x = lv[x][1]
                            path.append(x)
                        hit = path
                        break
            if hit:
                out.append({"id": lim["id"], "status": lim.get("status"), "severity": lim.get("severity", "minor"),
                            "statement": lim.get("statement", ""), "via": hit[0], "path": hit})
        return out

    def ceiling(self, fid):
        """Invariant 12 for a claim: 'established', 'preliminary' or 'revisit', and why."""
        f = self.forms.get(fid)
        sup = [x for x in as_list(f.get("derived_from")) if x in self.forms]
        done = [x for x in sup if self.forms[x].get("status") in DONE_STATES]
        if done:
            return "revisit", done
        weak = [x for x in sup if self.forms[x].get("status") in WEAK_STATES]
        if weak:
            return "preliminary", weak
        return "established", sup

    def relations(self, fid):
        f = self.forms[fid]
        lv = self.levels_up(fid)
        steps = {}
        for u, (n, child) in lv.items():
            steps.setdefault(n, []).append(u)
        up_list = []
        for n in sorted(steps):
            up_list.append({"step": n, "forms": [self.brief(x) for x in sorted(steps[n], key=self._sort_key)]})
        down = self.downstream(fid)
        direct_down = self.down_map().get(fid, [])
        steps_down = {}
        if down:
            q = [(fid, 0)]
            seen = {fid}
            while q:
                n, k = q.pop(0)
                for d in self.down_map().get(n, []):
                    if d not in seen:
                        seen.add(d)
                        steps_down.setdefault(k + 1, []).append(d)
                        q.append((d, k + 1))
        under = [self.forms[x] for x in lv]
        newer = sorted([x for x in lv if str(self.forms[x].get("updated", "")) > str(f.get("updated", ""))])
        rel = {
            "form": f, "section": self.section_of.get(fid),
            "rests_on": [self.brief(x) for x in self.rests_on(fid)],
            "up": up_list,
            "up_counts": _count_types(under),
            "down": [{"step": k, "forms": [self.brief(x) for x in sorted(v, key=self._sort_key)]}
                     for k, v in sorted(steps_down.items())],
            "rested_on_by": [self.brief(x) for x in direct_down],
            "limitations": self.lims_reaching(fid),
            "assumptions": [self.brief(x["id"]) for x in under if x.get("type") == "assumption"],
            "unsourced": [self.brief(x["id"]) for x in under if x.get("status") == "unsourced"],
            "superseded": [self.brief(x["id"]) for x in under if x.get("status") == "superseded"],
            "newer_underneath": [self.brief(x) for x in newer],
            "map": {k: as_list(f.get(k)) for k in ("part_of", "follows", "uses") if f.get(k)},
            "map_in": [self.brief(x["id"]) for x in self.forms.values()
                       if any(fid in as_list(x.get(k)) for k in ("part_of", "follows", "uses"))],
        }
        if f.get("type") == "claim":
            c, why = self.ceiling(fid)
            rel["ceiling"] = {"value": c, "because": why}
        if f.get("type") == "limitation":
            cov = self.covered(f)
            rel["covers"] = [self.brief(x) for x in sorted(cov, key=self._sort_key)
                             if self.forms[x].get("type") in ("result", "claim")]
        if f.get("type") == "open":
            rel["answered_by"] = [self.brief(x) for x in as_list(f.get("answered_by")) if x in self.forms]
        return rel

    def _sort_key(self, x):
        try:
            return self.order.index(x)
        except ValueError:
            return 10 ** 6

    def brief(self, fid):
        f = self.forms.get(fid)
        if not f:
            return {"id": fid, "type": "missing", "status": "", "text": ""}
        return {"id": fid, "type": f.get("type"), "status": f.get("status", ""), "text": form_text(f),
                "section": self.section_of.get(fid), "updated": f.get("updated", "")}

    # -- standing queries (§8.1) -------------------------------------
    def citation_gaps(self):
        out = []
        for g in self.forms.values():
            if g.get("status") == "unsourced":
                risk = [x for x in self.downstream(g["id"]) if self.forms[x].get("type") == "claim"]
                out.append({"form": self.brief(g["id"]), "at_risk": [self.brief(x) for x in sorted(risk, key=self._sort_key)]})
        return out

    def revisit(self):
        out = []
        for f in self.forms.values():
            if f.get("type") != "claim" or f.get("status") in ("refuted", "outdated"):
                continue
            mine = str(f.get("updated", ""))
            newer = [u for u in self.upstream(f["id"]) if str(self.forms[u].get("updated", "")) > mine]
            if newer:
                newer.sort(key=lambda u: str(self.forms[u].get("updated", "")), reverse=True)
                out.append({"form": self.brief(f["id"]),
                            "newer": [self.brief(u) for u in newer[:8]], "n_newer": len(newer)})
        return out

    def coverage(self):
        out = []
        for lim in self.limitations():
            if lim.get("status") == "refuted":
                continue
            cov = self.covered(lim)
            out.append({"id": lim["id"], "status": lim.get("status"), "severity": lim.get("severity", "minor"),
                        "statement": lim.get("statement", ""), "section": self.section_of.get(lim["id"]),
                        "affects": as_list(lim.get("affects")),
                        "claims": sorted([x for x in cov if self.forms[x].get("type") == "claim"], key=self._sort_key),
                        "results": sorted([x for x in cov if self.forms[x].get("type") == "result"], key=self._sort_key)})
        out.sort(key=lambda r: -(len(r["claims"]) + len(r["results"])))
        return out

    def opens(self):
        return [{"form": f, "section": self.section_of[f["id"]],
                 "answered_by": [self.brief(x) for x in as_list(f.get("answered_by"))]}
                for f in self.forms.values() if f.get("type") == "open"]


def form_text(f):
    t = f.get("type")
    if t == "def":
        return "%s: %s" % (f.get("term", ""), f.get("definition", ""))
    if t == "artifact":
        return f.get("path", "")
    if t == "setup":
        if f.get("includes"):
            return "pipeline setup · %d included" % len(as_list(f.get("includes")))
        if f.get("components"):
            keys = list((f.get("components") or {}).keys())
            return "stage setup · " + ", ".join(keys)
        return f.get("script", "") or "setup"
    if t == "section":
        return f.get("title", "")
    return f.get("statement", "")


def _count_types(forms):
    c = {}
    for f in forms:
        c[f.get("type")] = c.get(f.get("type"), 0) + 1
    return c


# =================================================================== checks (§8)

RULES = {
    1: "Ids unique. Prefix is P- for the five assertable types, and DEF-, ART-, SET- or SEC- matching type for the rest.",
    2: "Every referenced id exists: the ids in evidence, derived_from, affects, resolved_by, replaced_by, answered_by, includes, part_of, follows, uses and links.to, and every component value that is an id.",
    3: "Every claim has a non-empty derived_from, unless its status is unsourced or refuted.",
    4: "Every result has a non-empty scope and evidence; every limitation with status established or resolved has a non-empty evidence.",
    5: "Every artifact that is not in a repository has a version. A planned artifact has version: planned until it exists, and no other artifact has that value. No version contains an unfilled placeholder.",
    6: "Every def with a non-empty avoid has a why_avoid.",
    8: "links with rel: builds_on form no cycle.",
    9: "If a form's updated is newer than its section's, the section is stale.",
    11: "No assumption has a non-empty derived_from.",
    12: "No claim exceeds the ceiling set by its weakest support. A refuted, outdated, resolved, closed or superseded form in derived_from means there is no ceiling: the claim must be revisited.",
    13: "Every key in a setup's components appears in the file's component_keys, and every registry entry has a non-empty description. A registry entry whose key is in the standard list carries the standard description.",
    14: "follows is acyclic.",
    15: "severity, where present, is major or minor, and appears only on a limitation.",
    16: "Every limitation with status resolved has a non-empty resolved_by, and resolved_by is non-empty on no other form.",
    17: "Every assumption has a non-empty basis and breaks_if.",
    18: "Every limitation with status established or preliminary has a non-empty affects.",
    19: "No setup with status current names a superseded form. In includes or a component value the remedy is a new setup (M4). In part_of, follows or uses it is editing the field in place.",
    20: "Everything upstream is on record: pipeline setups include what is upstream of what they include, and results cite a pipeline setup for what has something upstream (see §8).",
    21: "A setup fills exactly one of components and includes. Only a planned setup may have neither.",
    22: "replaced_by is non-empty only on a form with status refuted or outdated, and answered_by only on an open with status closed.",
    23: "wording, where present, is fixed, and appears only on a result, claim, assumption, limitation or open.",
}

PASS = {1: "Ids unique, prefixes match the type", 2: "Every referenced id exists", 3: "Claims rest on something",
        4: "Results have scope and evidence; limitations have evidence", 5: "Versions where required",
        6: "Words to avoid come with a reason", 8: "builds_on links have no cycle", 9: "No section is older than its forms",
        11: "Assumptions rest on nothing", 12: "Claims are within their ceiling", 13: "Component keys are in the registry",
        14: "follows has no cycle", 15: "severity only on limitations", 16: "resolved_by only on resolved limitations",
        17: "Assumptions have basis and breaks_if", 18: "Limitations in force name what they weaken",
        19: "No current setup names a superseded one", 20: "Everything upstream is on record",
        21: "Setups fill components or includes", 22: "replaced_by and answered_by only where allowed",
        23: "wording only “fixed”, only on assertable forms"}

TITLES = {1: "Id problem", 2: "An id that does not exist", 3: "A claim resting on nothing",
          4: "Missing scope or evidence", 5: "Missing or wrong version", 6: "Words to avoid without a reason",
          8: "Sections that build on each other in a circle", 9: "A section older than its forms",
          11: "An assumption that rests on something", 12: "A claim above its ceiling", 13: "Component key problem",
          14: "Setups that run after each other in a circle", 15: "Wrong severity", 16: "resolved_by problem",
          17: "An assumption without basis or breaks_if", 18: "A limitation that names nothing",
          19: "A current setup naming a superseded one", 20: "Something upstream is not on record",
          21: "A setup with both or neither of components and includes", 22: "replaced_by or answered_by out of place",
          23: "Wrong wording value"}


def _fix(label, action=None, primary=False, nav=None, **args):
    d = {"label": label, "primary": primary}
    if nav:
        d["nav"] = nav
    else:
        d["action"] = action
        d["args"] = args
    return d


def _edit(fid):
    return _fix("Open the form", nav="#/form/%s/edit" % fid)


def run_checks(model, idx=None):
    idx = idx or Index(model)
    P = []

    def add(rule, fid, field, what, fixes, section=None):
        P.append({"rule": rule, "title": TITLES.get(rule, ""), "ruleText": RULES.get(rule, ""), "id": fid,
                  "field": field, "section": section or idx.section_of.get(fid, fid), "what": what,
                  "fixes": fixes + ([_edit(fid)] if fid in idx.forms else [])})
    forms = idx.forms
    all_ids = set(forms) | set(idx.sections)

    # 1
    seen = {}
    for s in model["sections"]:
        if not str(s.get("id", "")).startswith("SEC-"):
            add(1, s.get("id"), "id", "The section id %s does not start with SEC-." % s.get("id"), [], section=s.get("id"))
        for f in s["forms"]:
            fid, t = f.get("id", ""), f.get("type")
            seen[fid] = seen.get(fid, 0) + 1
            want = PREFIX.get(t)
            if want and not str(fid).startswith(want):
                add(1, fid, "id", "%s is a %s, so its id should start with %s. Ids are permanent (M1), so the fix is a new form." % (fid, t, want), [])
            if t not in PREFIX:
                add(1, fid, "type", "%s has the unknown type %r." % (fid, t), [])
    for fid, n in seen.items():
        if n > 1:
            add(1, fid, "id", "%d forms have the id %s." % (n, fid), [])
    # 2
    names = sorted(all_ids)
    for fid, f in forms.items():
        refs = []
        for k in REF_FIELDS:
            for v in as_list(f.get(k)):
                if is_id(v):
                    refs.append((k, v))
        for v in idx.component_ids(f):
            refs.append(("components", v))
        for k, v in refs:
            if v not in all_ids:
                close = difflib.get_close_matches(v, names, n=1, cutoff=0.6)
                fixes = []
                if close and k != "components":
                    fixes.append(_fix("Replace with %s" % close[0], "replace_ref", True, id=fid, field=k, old=v, new=close[0]))
                if k != "components":
                    fixes.append(_fix("Remove it", "remove_ref", id=fid, field=k, value=v))
                add(2, fid, k, "%s names %s in %s. No form has that id.%s" %
                    (fid, v, k, (" The closest id is %s." % close[0]) if close else ""), fixes)
    for s in model["sections"]:
        for ln in as_list(s.get("links")):
            if isinstance(ln, dict) and ln.get("to") and ln.get("to") not in idx.sections:
                add(2, s["id"], "links", "%s links to %s, which is not a section." % (s["id"], ln.get("to")),
                    [_fix("Open the section", nav="#/section/%s/edit" % s["id"])], section=s["id"])
    for fid, f in forms.items():
        t, st = f.get("type"), f.get("status")
        # 3
        if t == "claim" and st not in ("unsourced", "refuted") and not as_list(f.get("derived_from")):
            add(3, fid, "derived_from", "%s is %s but rests on nothing." % (fid, st),
                [_fix("Set it to unsourced", "set_field", id=fid, field="status", value="unsourced")])
        # 4
        if t == "result":
            for k in ("scope", "evidence"):
                if not f.get(k):
                    add(4, fid, k, "%s has no %s." % (fid, "scope (what was measured)" if k == "scope" else "evidence"), [])
        if t == "limitation" and st in ("established", "resolved") and not as_list(f.get("evidence")):
            fx = [_fix("Add “stated” as evidence", "add_ref", id=fid, field="evidence", value="stated")]
            if st == "established":
                fx.append(_fix("Set it to preliminary", "set_field", id=fid, field="status", value="preliminary"))
            add(4, fid, "evidence", "%s is %s but nothing is named as its evidence." % (fid, st), fx)
        # 5
        if t == "artifact":
            v = str(f.get("version", ""))
            path = str(f.get("path", ""))
            outside = path.startswith(("http://", "https://", "/", "~")) or "://" in path
            if st == "planned" and v != "planned":
                add(5, fid, "version", "%s is planned, so its version should be “planned”." % fid,
                    [_fix("Set version to planned", "set_field", True, id=fid, field="version", value="planned")])
            elif st != "planned" and v == "planned":
                add(5, fid, "version", "%s is %s but its version still says planned." % (fid, st), [])
            elif outside and not v:
                add(5, fid, "version", "%s is not in a repository (%s), so it needs a version: a snapshot, release or access date (M5)." % (fid, path), [])
            if re.search(r"<[^>]+>|\bTODO\b|\.\.\.|…", v):
                add(5, fid, "version", "The version of %s contains a placeholder: %s" % (fid, v), [])
        # 6
        if t == "def" and as_list(f.get("avoid")) and not f.get("why_avoid"):
            add(6, fid, "why_avoid", "%s lists words to avoid but not why." % fid, [])
        # 11
        if t == "assumption" and as_list(f.get("derived_from")):
            add(11, fid, "derived_from", "%s rests on something, so it is really a claim (§4.3)." % fid,
                [_fix("Turn it into a claim", "retype", True, id=fid, to="claim")])
        # 12
        if t == "claim" and st not in ("refuted", "outdated"):
            c, why = idx.ceiling(fid)
            if c == "revisit":
                add(12, fid, "status", "%s rests on %s, which %s %s. It has no ceiling until you revisit it." %
                    (fid, ", ".join(why), "is" if len(why) == 1 else "are",
                     ", ".join(sorted(set(forms[x].get("status") for x in why)))),
                    [_fix("Mark outdated", "set_field", True, id=fid, field="status", value="outdated"),
                     _fix("Mark refuted", "set_field", id=fid, field="status", value="refuted"),
                     _fix("Show what rests on what", nav="#/form/%s/deps" % fid)])
            elif c == "preliminary" and st == "established":
                add(12, fid, "status", "%s is established, but %s, which it rests on, %s %s." %
                    (fid, ", ".join(why), "is" if len(why) == 1 else "are",
                     " or ".join(sorted(set(forms[x].get("status") for x in why)))),
                    [_fix("Lower it to preliminary", "set_field", True, id=fid, field="status", value="preliminary")])
        # 13
        if t == "setup":
            for k in (f.get("components") or {}):
                if k not in model["component_keys"]:
                    fx = []
                    if k in STANDARD_KEYS:
                        fx.append(_fix("Add “%s” to the registry with the standard description" % k, "add_component_key", True,
                                       key=k, desc=STANDARD_KEYS[k]))
                    else:
                        fx.append(_fix("Add it to the registry…", nav="#/registry?add=%s" % k))
                    add(13, fid, "components", "%s uses the component key “%s”, which is not in component_keys." % (fid, k), fx)
        # 15
        if "severity" in f and f.get("severity") != "":
            if t != "limitation":
                add(15, fid, "severity", "%s is a %s and cannot have a severity." % (fid, t),
                    [_fix("Remove severity", "remove_field", True, id=fid, field="severity")])
            elif f.get("severity") not in ("major", "minor"):
                add(15, fid, "severity", "The severity of %s is “%s”." % (fid, f.get("severity")),
                    [_fix("Set it to minor", "remove_field", True, id=fid, field="severity"),
                     _fix("Set it to major", "set_field", id=fid, field="severity", value="major")])
        # 16
        if t == "limitation" and st == "resolved" and not as_list(f.get("resolved_by")):
            add(16, fid, "resolved_by", "%s is resolved but does not say what removed it." % fid, [])
        if as_list(f.get("resolved_by")) and not (t == "limitation" and st == "resolved"):
            add(16, fid, "resolved_by", "%s has resolved_by but is not a resolved limitation." % fid,
                [_fix("Remove resolved_by", "remove_field", True, id=fid, field="resolved_by")])
        # 17
        if t == "assumption":
            for k in ("basis", "breaks_if"):
                if not f.get(k):
                    add(17, fid, k, "%s has no %s." % (fid, "basis (why it is reasonable)" if k == "basis" else "breaks_if (what would make it false)"), [])
        # 18
        if t == "limitation" and st in ("established", "preliminary") and not as_list(f.get("affects")):
            add(18, fid, "affects", "%s applies but names nothing it weakens, so it would never be mentioned." % fid, [])
        # 19
        if t == "setup" and st == "current":
            for k in ("includes",):
                for v in as_list(f.get(k)):
                    if v in forms and forms[v].get("status") == "superseded":
                        add(19, fid, k, "%s is current and names %s in includes, which is superseded." % (fid, v),
                            [_fix("Write new versions with the helper…", nav="#/newversion/%s?from=%s" % (fid, v), primary=True),
                             _fix("Set %s back to current" % v, "set_field", id=v, field="status", value="current")])
            for v in idx.component_ids(f):
                if forms.get(v, {}).get("status") == "superseded":
                    add(19, fid, "components", "%s is current and names %s in its components, which is superseded." % (fid, v),
                        [_fix("Write new versions with the helper…", nav="#/newversion/%s?from=%s" % (fid, v), primary=True),
                         _fix("Set %s back to current" % v, "set_field", id=v, field="status", value="current")])
            for k in ("part_of", "follows", "uses"):
                for v in as_list(f.get(k)):
                    if v in forms and forms[v].get("status") == "superseded":
                        add(19, fid, k, "%s is current and names %s in %s, which is superseded. This field is edited in place." % (fid, v, k),
                            [_fix("Remove %s from %s" % (v, k), "remove_ref", id=fid, field=k, value=v)])
        # 21
        if t == "setup":
            c, i = bool(f.get("components")), bool(as_list(f.get("includes")))
            if c and i:
                add(21, fid, "components", "%s fills both components and includes." % fid, [])
            elif not c and not i and st != "planned":
                add(21, fid, "components", "%s fills neither components nor includes." % fid, [])
        # 22
        if as_list(f.get("replaced_by")) and st not in ("refuted", "outdated"):
            add(22, fid, "replaced_by", "%s has replaced_by but is %s." % (fid, st),
                [_fix("Remove replaced_by", "remove_field", True, id=fid, field="replaced_by")])
        if as_list(f.get("answered_by")) and not (t == "open" and st == "closed"):
            add(22, fid, "answered_by", "%s has answered_by but is not a closed open question." % fid,
                [_fix("Remove answered_by", "remove_field", True, id=fid, field="answered_by")])
        # 23
        if "wording" in f and f.get("wording") != "":
            if t not in ASSERTABLE:
                add(23, fid, "wording", "%s is a %s and cannot have wording." % (fid, t),
                    [_fix("Remove wording", "remove_field", True, id=fid, field="wording")])
            elif f.get("wording") != "fixed":
                add(23, fid, "wording", "The wording of %s is “%s”; the only value is fixed." % (fid, f.get("wording")),
                    [_fix("Set it to fixed", "set_field", True, id=fid, field="wording", value="fixed"),
                     _fix("Remove wording", "remove_field", id=fid, field="wording")])
    # 9
    for s in model["sections"]:
        newer = [f["id"] for f in s["forms"] if str(f.get("updated", "")) > str(s.get("updated", ""))]
        if newer:
            P.append({"rule": 9, "title": TITLES[9], "ruleText": RULES[9], "id": s["id"], "field": "updated",
                      "section": s["id"], "what": "%d form%s in %s changed after the section's date (%s): %s" %
                      (len(newer), "s" if len(newer) > 1 else "", s["id"], s.get("updated", "none"), ", ".join(newer[:6]) + ("…" if len(newer) > 6 else "")),
                      "fixes": [_fix("The section still fits its forms: set its date to today", "touch", True, id=s["id"]),
                                _fix("Open the section", nav="#/section/%s" % s["id"])]})
    # 8
    cyc = _cycle({s["id"]: [l.get("to") for l in as_list(s.get("links")) if isinstance(l, dict) and l.get("rel") == "builds_on"]
                  for s in model["sections"]})
    if cyc:
        P.append({"rule": 8, "title": TITLES[8], "ruleText": RULES[8], "id": cyc[0], "field": "links", "section": cyc[0],
                  "what": "builds_on goes round in a circle: " + " → ".join(cyc), "fixes": [_fix("Open the section", nav="#/section/%s/edit" % cyc[0])]})
    # 14
    cyc = _cycle({fid: as_list(f.get("follows")) for fid, f in forms.items() if f.get("type") == "setup"})
    if cyc:
        add(14, cyc[0], "follows", "follows goes round in a circle: " + " → ".join(cyc), [])
    # 13 registry
    for k, v in (model.get("component_keys") or {}).items():
        if not v:
            P.append({"rule": 13, "title": TITLES[13], "ruleText": RULES[13], "id": "component_keys", "field": k, "section": "",
                      "what": "The component key “%s” has no description." % k, "fixes": [_fix("Open the registry", nav="#/registry")]})
        elif k in STANDARD_KEYS and re.sub(r"\s+", " ", v).strip() != STANDARD_KEYS[k]:
            P.append({"rule": 13, "title": TITLES[13], "ruleText": RULES[13], "id": "component_keys", "field": k, "section": "",
                      "what": "The standard key “%s” has a description other than the standard one." % k,
                      "fixes": [_fix("Use the standard description", "set_component_desc", True, key=k, desc=STANDARD_KEYS[k]),
                                _fix("Open the registry", nav="#/registry")]})
    # 20
    P.extend(check_upstream(idx))
    P.sort(key=lambda p: (p["rule"], idx._sort_key(p["id"])))
    return P


def _cycle(graph):
    state = {}
    stack = []

    def dfs(n):
        state[n] = 1
        stack.append(n)
        for m in graph.get(n, []):
            if state.get(m) == 1:
                return stack[stack.index(m):] + [m]
            if state.get(m) is None and m in graph:
                r = dfs(m)
                if r:
                    return r
        state[n] = 2
        stack.pop()
        return None
    for n in graph:
        if state.get(n) is None:
            r = dfs(n)
            if r:
                return r
    return None


def check_upstream(idx):
    """Invariant 20."""
    forms = idx.forms
    P = []

    def live(x):
        return x in forms and forms[x].get("status") != "superseded"

    def upstream_of(x):
        f = forms[x]
        if f.get("status") == "superseded":
            return []
        if f.get("type") == "setup":
            return [y for y in as_list(f.get("follows")) + as_list(f.get("uses")) if live(y) and y != x]
        if f.get("type") == "artifact":
            path = str(f.get("path", ""))
            entry = str(f.get("entrypoint", ""))
            out = []
            for y, g in forms.items():
                if y == x or g.get("type") != "artifact" or not live(y):
                    continue
                prods = [str(p) for p in as_list(g.get("produces")) if p]
                if (path and path in prods) or any(p in entry for p in prods):
                    out.append(y)
            return out
        return []

    def closure(p):
        out, todo = set(), [p]
        while todo:
            q = todo.pop()
            for x in as_list(forms[q].get("includes")):
                if x in forms and x not in out:
                    out.add(x)
                    if forms[x].get("type") == "setup" and as_list(forms[x].get("includes")):
                        todo.append(x)
        return out

    def is_pipeline(x):
        return forms.get(x, {}).get("type") == "setup" and bool(as_list(forms[x].get("includes")))

    stage_of = {}
    for y, g in forms.items():
        if g.get("type") == "setup" and g.get("components"):
            for a in as_list(g.get("part_of")):
                stage_of.setdefault(a, []).append(y)

    def problem(fid, field, what, fixes):
        P.append({"rule": 20, "title": TITLES[20], "ruleText": RULES[20], "id": fid, "field": field,
                  "section": idx.section_of.get(fid), "what": what,
                  "fixes": fixes + [_fix("Open the form", nav="#/form/%s/edit" % fid)]})

    for p, f in forms.items():
        if not (is_pipeline(p) and f.get("status") == "current"):
            continue
        inc = closure(p)
        missing = []
        for x in inc:
            for u in upstream_of(x):
                if u not in inc and u not in missing:
                    missing.append(u)
        for u in missing:
            problem(p, "includes", "%s includes something that %s runs before or produces the input of, but does not include %s." % (p, u, u),
                    [_fix("Recorded wrongly: add %s to includes" % u, "add_ref", id=p, field="includes", value=u, frozen_ok=True),
                     _fix("Write a new version with the helper…", nav="#/newversion/%s" % p)])
        for a in [x for x in inc if forms[x].get("type") == "artifact"]:
            stages = [s for s in stage_of.get(a, []) if forms[s].get("status") == "current"]
            if stages and not any(s in inc for s in stages):
                problem(p, "includes", "%s includes %s but none of its current stage setups (%s)." % (p, a, ", ".join(stages)),
                        [_fix("Recorded wrongly: add %s to includes" % stages[0], "add_ref", id=p, field="includes", value=stages[0], frozen_ok=True)])
    for r, f in forms.items():
        if f.get("type") != "result":
            continue
        cited = [x for x in as_list(f.get("evidence")) if x in forms]
        pipes = [x for x in cited if is_pipeline(x)]
        covered = set()
        for q in pipes:
            covered |= closure(q)
        for x in cited:
            if forms[x].get("status") == "superseded" or is_pipeline(x):
                continue
            if forms[x].get("type") in ("setup", "artifact") and upstream_of(x) and x not in covered:
                cands = [q for q, g in forms.items() if is_pipeline(q) and x in closure(q)]
                fx = [_fix("Add %s to evidence (it records the same run in more detail)" % q, "add_ref", id=r, field="evidence", value=q, frozen_ok=True)
                      for q in cands[:3]]
                problem(r, "evidence", "%s cites %s, which has something upstream, but no pipeline setup that includes it." % (r, x), fx)
        rests = set(cited) | covered
        for a in [x for x in cited if forms[x].get("type") == "artifact"]:
            stages = stage_of.get(a, [])
            if stages and not any(s in rests for s in stages):
                fx = [_fix("Add %s to evidence" % s, "add_ref", id=r, field="evidence", value=s, frozen_ok=True) for s in stages[:3]]
                problem(r, "evidence", "%s cites %s, which has stage setups (%s), but rests on none of them." % (r, a, ", ".join(stages)), fx)
    return P


# =================================================================== changes

def required_missing(f, model=None):
    """Labels of required fields that are still empty for this form."""
    t = f.get("type")
    miss = []
    for fd in TEMPLATES.get(t, []):
        v = f.get(fd["key"])
        if fd["required"] and (v is None or v == "" or v == [] or v == {}):
            miss.append(fd["label"].lower())
    st = f.get("status")
    if t == "claim" and st not in ("unsourced", "refuted") and not as_list(f.get("derived_from")):
        miss.append("what it rests on")
    if t == "limitation":
        if st in ("established", "preliminary") and not as_list(f.get("affects")):
            miss.append("what it weakens")
        if st in ("established", "resolved") and not as_list(f.get("evidence")):
            miss.append("what establishes it (or “stated”)")
        if st == "resolved" and not as_list(f.get("resolved_by")):
            miss.append("what removed it")
    if t == "def" and as_list(f.get("avoid")) and not f.get("why_avoid"):
        miss.append("why to avoid those words")
    if t == "setup" and f.get("status") != "planned" and not f.get("components") and not as_list(f.get("includes")):
        miss.append("components or includes")
    if t == "open" and st == "closed" and not as_list(f.get("answered_by")) and not f.get("note"):
        miss.append("what answers it, or why it was dropped (note)")
    return miss


def clean_form(f):
    """Strip text, drop empty optional values, keep the spec's field order."""
    out = {}
    for k, v in f.items():
        if isinstance(v, str):
            v = v.strip()
        elif isinstance(v, list):
            v = [x.strip() if isinstance(x, str) else x for x in v]
            v = [x for x in v if x != ""]
        elif isinstance(v, dict) and k == "components":
            v = {str(a).strip(): (b.strip() if isinstance(b, str) else b) for a, b in v.items() if str(a).strip()}
            v = {a: b for a, b in v.items() if b != "" and b != []}
        out[k] = v
    t = out.get("type")
    for k in list(out.keys()):
        if k in ("id", "type"):
            continue
        v = out[k]
        if v == "" or v is None:
            del out[k]
        elif v == [] and k not in ("derived_from", "evidence", "affects", "includes", "links", "use", "avoid", "produces"):
            del out[k]
    if t == "limitation" and out.get("severity") == "minor":
        del out["severity"]
    if t == "assumption" and out.get("surface") == "yes":
        del out["surface"]
    if out.get("wording") in (True, "yes", "true"):
        out["wording"] = "fixed"
    elif out.get("wording") in (False, "no", "false"):
        del out["wording"]
    return order_keys(t, out) if t != "section" else out


def frozen_changes(idx, old, new):
    """Fields of a frozen form (M4) that this edit would change. Allowed additions are not counted."""
    t = old.get("type")
    st = old.get("status")
    out = []
    if t == "result":
        for k in ("statement", "scope"):
            if canonical(old.get(k, "")) != canonical(new.get(k, "")):
                out.append(k)
        oe, ne = as_list(old.get("evidence")), as_list(new.get("evidence"))
        removed = [x for x in oe if x not in ne]
        added = [x for x in ne if x not in oe]
        if removed or any(not (x in idx.forms and idx.forms[x].get("type") == "setup") for x in added):
            out.append("evidence")
    elif t == "setup" and st != "planned":
        for k in ("components", "includes"):
            if canonical(old.get(k, "")) != canonical(new.get(k, "")):
                out.append(k)
    elif t == "artifact" and st != "planned":
        rested = any(idx.forms[d].get("type") in ("result", "claim") for d in idx.downstream(old["id"]))
        if rested:
            for k in set(old) | set(new):
                if k in ("status", "note", "updated", "id", "type"):
                    continue
                if k == "produces":
                    if any(x not in as_list(new.get(k)) for x in as_list(old.get(k))):
                        out.append(k)
                    continue
                if canonical(old.get(k, "")) != canonical(new.get(k, "")):
                    out.append(k)
    return sorted(out)


class Editor:
    """All changes to the model go through here. Keeps an undo history of whole-model snapshots."""

    def __init__(self, doc, settings):
        self.doc = doc
        self.settings = settings
        self.history = []

    @property
    def model(self):
        return self.doc.model

    def index(self):
        return Index(self.model)

    def snapshot(self, label):
        self.history.append((label, copy.deepcopy(self.model)))
        del self.history[:-60]

    def undo(self):
        if not self.history:
            raise EditError("Nothing to undo.")
        label, m = self.history.pop()
        self.doc.model = m
        return label

    def _section(self, sid):
        for s in self.model["sections"]:
            if s["id"] == sid:
                return s
        raise EditError("There is no section %s." % sid)

    def _locate(self, fid):
        for s in self.model["sections"]:
            for i, f in enumerate(s["forms"]):
                if f.get("id") == fid:
                    return s, i
        raise EditError("There is no form %s." % fid)

    def _insert_pos(self, sec, t):
        last = None
        for i, f in enumerate(sec["forms"]):
            if f.get("type") == t:
                last = i
        return len(sec["forms"]) if last is None else last + 1

    def _check_id(self, fid, t):
        want = PREFIX.get(t)
        if not fid or fid == want:
            raise EditError("The form needs an id.", missing=["an id"])
        if want and not fid.startswith(want):
            raise EditError("A %s's id starts with %s." % (t, want))
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", fid):
            raise EditError("An id may hold only letters, digits, dots, dashes and underscores.")
        idx = self.index()
        if fid in idx.forms or fid in idx.sections:
            raise EditError("The id %s is taken. Ids are permanent and never reused (M1)." % fid)

    # -- forms ---------------------------------------------------------
    def create_form(self, form, section_id, after=None):
        form = clean_form(dict(form))
        t = form.get("type")
        if t not in TEMPLATES or t == "section":
            raise EditError("Unknown type %r." % t)
        self._check_id(form.get("id", ""), t)
        form["updated"] = today()
        form = order_keys(t, form)
        miss = required_missing(form)
        if miss:
            raise EditError("Still needed before it can be added: " + ", ".join(miss) + ".", missing=miss)
        sec = self._section(section_id)
        self.snapshot("add %s" % form["id"])
        pos = self._insert_pos(sec, t)
        if after:
            for i, f in enumerate(sec["forms"]):
                if f.get("id") == after:
                    pos = i + 1
        sec["forms"].insert(pos, form)
        return form["id"]

    def update_form(self, fid, new, section_id=None, mode=None, correction_note=None):
        sec, i = self._locate(fid)
        old = sec["forms"][i]
        new = clean_form(dict(new))
        new["id"] = fid
        if new.get("type") != old.get("type"):
            raise EditError("Use “Change type…” to change a form's type (§4.10).")
        if canonical(old) == canonical(new) and (section_id in (None, sec["id"])):
            return fid
        idx = self.index()
        frozen = frozen_changes(idx, old, new)
        if frozen and self.settings.get("frozen", True) and mode != "recording_error":
            raise EditError("Frozen fields (M4): " + ", ".join(frozen), frozen=frozen)
        if frozen and mode == "recording_error":
            if not (correction_note or "").strip():
                raise EditError("Say in the note what you corrected and when.", missing=["what you corrected"])
            line = "Corrected on %s: %s" % (today(), correction_note.strip())
            new["note"] = (new.get("note", "") + "\n\n" + line).strip() if new.get("note") else line
        miss = required_missing(new)
        if miss:
            raise EditError("Still needed: " + ", ".join(miss) + ".", missing=miss)
        new["updated"] = today()
        new = merge_order(old, new, new["type"])
        self.snapshot("edit %s" % fid)
        if section_id and section_id != sec["id"]:
            target = self._section(section_id)
            del sec["forms"][i]
            target["forms"].insert(self._insert_pos(target, new["type"]), new)
        else:
            sec["forms"][i] = new
        return fid

    def discard_new(self, fid):
        """Only a form that is not in the file yet can be removed (M1, M2)."""
        orig_ids = {f["id"] for s in self.doc.orig["sections"] for f in s["forms"]}
        if fid in orig_ids:
            raise EditError("%s is in the file. Forms are never deleted (M2); set its status instead." % fid)
        sec, i = self._locate(fid)
        self.snapshot("discard %s" % fid)
        del sec["forms"][i]

    def apply_fix(self, action, args):
        idx = self.index()
        if action == "touch":
            fid = args["id"]
            if fid in idx.sections:
                self.snapshot("confirm %s" % fid)
                idx.sections[fid]["updated"] = today()
                return
            self.snapshot("confirm %s" % fid)
            self._locate(fid)
            idx.forms[fid]["updated"] = today()
            return
        if action == "add_component_key":
            self.snapshot("add key %s" % args["key"])
            self.model["component_keys"][args["key"]] = args["desc"]
            return
        if action == "set_component_desc":
            self.snapshot("describe key %s" % args["key"])
            self.model["component_keys"][args["key"]] = args["desc"]
            return
        if action == "retype":
            return self.retype(args["id"], args["to"])
        fid = args["id"]
        sec, i = self._locate(fid)
        old = sec["forms"][i]
        f = copy.deepcopy(old)
        field = args.get("field")
        if action == "replace_ref":
            f[field] = [args["new"] if x == args["old"] else x for x in as_list(f.get(field))]
        elif action == "remove_ref":
            f[field] = [x for x in as_list(f.get(field)) if x != args["value"]]
        elif action == "add_ref":
            if args["value"] not in as_list(f.get(field)):
                f[field] = as_list(f.get(field)) + [args["value"]]
            if args.get("frozen_ok") and field == "includes":
                line = "Corrected on %s: added %s to includes; it ran but was not recorded (M4)." % (today(), args["value"])
                f["note"] = (f.get("note", "") + "\n\n" + line).strip() if f.get("note") else line
        elif action == "set_field":
            f[field] = args["value"]
        elif action == "remove_field":
            f.pop(field, None)
        else:
            raise EditError("Unknown fix %s." % action)
        self.snapshot("fix %s" % fid)
        f["updated"] = today()
        sec["forms"][i] = merge_order(old, f, f.get("type"))

    def set_status(self, fid, status, extra=None):
        sec, i = self._locate(fid)
        f = copy.deepcopy(sec["forms"][i])
        f["status"] = status
        for k, v in (extra or {}).items():
            f[k] = v
        f = clean_form(f)
        miss = required_missing(f)
        if miss:
            raise EditError("Still needed: " + ", ".join(miss) + ".", missing=miss)
        self.snapshot("%s → %s" % (fid, status))
        f["updated"] = today()
        sec["forms"][i] = merge_order(sec["forms"][i], f, f.get("type"))

    def retype(self, fid, to):
        sec, i = self._locate(fid)
        f = copy.deepcopy(sec["forms"][i])
        rule = None
        for r in RETYPE:
            if r["from"] == f.get("type") and r["to"] == to and r.get("from_status", f.get("status")) == f.get("status"):
                rule = r
        if not rule:
            raise EditError("§4.10 has no move from this %s to %s." % (f.get("type"), to))
        self.snapshot("retype %s" % fid)
        for k in rule["drop"]:
            f.pop(k, None)
        f["type"] = to
        f["status"] = rule["status"]
        f["updated"] = today()
        sec["forms"][i] = merge_order(sec["forms"][i], f, to)
        return {"need": rule["need"]}

    # -- sections and registry -------------------------------------------
    def save_section(self, sid, meta, new=False):
        meta = clean_form(dict(meta))
        meta.pop("forms", None)
        meta["type"] = "section"
        if new:
            sid = meta.get("id", "")
            if not sid.startswith("SEC-") or sid == "SEC-":
                raise EditError("A section id starts with SEC-.", missing=["an id"])
            if sid in self.index().sections:
                raise EditError("The id %s is taken." % sid)
        miss = [fd["label"].lower() for fd in TEMPLATES["section"] if fd["required"] and not meta.get(fd["key"])]
        if miss:
            raise EditError("Still needed: " + ", ".join(miss) + ".", missing=miss)
        meta["updated"] = today()
        ordered = {"id": sid, "type": "section"}
        for fd in TEMPLATES["section"]:
            if fd["key"] in meta:
                ordered[fd["key"]] = meta[fd["key"]]
        for k, v in meta.items():
            if k not in ordered:
                ordered[k] = v
        if "links" not in ordered:
            ordered["links"] = []
        self.snapshot("section %s" % sid)
        if new:
            ordered["forms"] = []
            self.model["sections"].append(ordered)
        else:
            s = self._section(sid)
            forms = s["forms"]
            s.clear()
            s.update(ordered)
            s["forms"] = forms
        return sid

    def save_registry(self, keys):
        clean = {}
        for k, v in keys:
            k = str(k).strip()
            if k:
                clean[k] = str(v).strip()
        self.snapshot("component keys")
        self.model["component_keys"] = clean

    # -- new versions (M4, §4.7, §4.8) -----------------------------------
    def new_version_plan(self, fid, new_id=None):
        idx = self.index()
        f = idx.forms.get(fid)
        if not f or f.get("type") not in ("setup", "artifact"):
            raise EditError("Only setups and artifacts get new versions this way.")
        taken = set(idx.forms)

        def bump(x):
            m = re.match(r"(.*)-v(\d+)$", x)
            cand = "%s-v%d" % (m.group(1), int(m.group(2)) + 1) if m else x + "-v2"
            while cand in taken:
                m = re.match(r"(.*)-v(\d+)$", cand)
                cand = "%s-v%d" % (m.group(1), int(m.group(2)) + 1)
            taken.add(cand)
            return cand
        new_id = new_id or bump(fid)
        taken.add(new_id)
        rename = {fid: new_id}
        copies = []
        grew = True
        while grew:
            grew = False
            for x, g in idx.forms.items():
                if x in rename or g.get("type") != "setup" or g.get("status") != "current":
                    continue
                names = as_list(g.get("includes")) + idx.component_ids(g)
                hit = [n for n in names if n in rename]
                if hit:
                    rename[x] = bump(x)
                    copies.append({"old": x, "new": rename[x], "because": hit[0]})
                    grew = True
        repoint = []
        for x, g in idx.forms.items():
            if x in rename or g.get("status") != "current":
                continue
            for k in ("part_of", "follows", "uses"):
                for v in as_list(g.get(k)):
                    if v in rename:
                        repoint.append({"id": x, "field": k, "old": v, "new": rename[v]})
        under = set()
        for x in rename:
            under |= idx.downstream(x)
        claims = sorted([c for c in under if idx.forms[c].get("type") == "claim"
                         and idx.forms[c].get("status") not in ("refuted", "outdated")], key=idx._sort_key)
        results = [c for c in under if idx.forms[c].get("type") == "result"]
        return {"id": fid, "new_id": new_id, "type": f.get("type"), "copies": copies,
                "superseded": list(rename.keys()), "repoint": repoint, "claims": claims, "n_results": len(results)}

    def new_version_apply(self, fid, new_id, copy_ids):
        plan = self.new_version_plan(fid, new_id)
        rename = {fid: new_id}
        for c in plan["copies"]:
            rename[c["old"]] = (copy_ids or {}).get(c["old"]) or c["new"]
        idx = self.index()
        for old, nid in rename.items():
            want = PREFIX[idx.forms[old]["type"]]
            if not nid.startswith(want) or nid in idx.forms or not re.fullmatch(r"[A-Za-z0-9_.-]+", nid):
                raise EditError("The new id %s is not usable: it must start with %s and not be taken." % (nid, want))
        if len(set(rename.values())) != len(rename):
            raise EditError("Two new forms would get the same id.")
        self.snapshot("new version of %s" % fid)

        def swap(v):
            if isinstance(v, list):
                return [rename.get(x, x) if isinstance(x, str) else x for x in v]
            if isinstance(v, str):
                return rename.get(v, v)
            return v
        for old, nid in rename.items():
            sec, i = self._locate(old)
            g = copy.deepcopy(sec["forms"][i])
            g["id"] = nid
            g["status"] = "current"
            g["updated"] = today()
            if "includes" in g:
                g["includes"] = swap(g["includes"])
            if g.get("components"):
                g["components"] = {k: swap(v) for k, v in g["components"].items()}
            for k in ("part_of", "follows", "uses"):
                if g.get(k):
                    g[k] = swap(g[k])
            old_note = g.pop("note", "")
            g["note"] = "New version of %s, written %s." % (old, today()) + ("\n\n" + old_note if old_note else "")
            sec["forms"].insert(i + 1, g)
            sec["forms"][i]["status"] = "superseded"
            sec["forms"][i]["updated"] = today()
        for r in plan["repoint"]:
            sec, i = self._locate(r["id"])
            g = sec["forms"][i]
            g[r["field"]] = [rename.get(x, x) for x in as_list(g.get(r["field"]))]
            g["updated"] = today()
        return rename

    # -- open questions -------------------------------------------------
    def close_open(self, fid, answered_by, note_reason):
        sec, i = self._locate(fid)
        f = copy.deepcopy(sec["forms"][i])
        if f.get("type") != "open":
            raise EditError("%s is not an open question." % fid)
        ans = [a for a in answered_by if a]
        if not ans and not (note_reason or "").strip():
            raise EditError("Name what answers it, or say why it was dropped.", missing=["what answers it, or why it was dropped"])
        f["status"] = "closed"
        if ans:
            f["answered_by"] = ans
        if (note_reason or "").strip():
            line = "Dropped on %s: %s" % (today(), note_reason.strip())
            f["note"] = (f.get("note", "") + "\n\n" + line).strip() if f.get("note") else line
        f["updated"] = today()
        self.snapshot("close %s" % fid)
        sec["forms"][i] = merge_order(sec["forms"][i], f, "open")

    def reopen(self, fid):
        sec, i = self._locate(fid)
        f = copy.deepcopy(sec["forms"][i])
        f["status"] = "open"
        f.pop("answered_by", None)
        f["updated"] = today()
        self.snapshot("reopen %s" % fid)
        sec["forms"][i] = merge_order(sec["forms"][i], f, "open")


def merge_order(old, new, t):
    """Keep the order the form had in the file; put new keys where the spec's template has them."""
    from .schema import template
    tmpl = ["id", "type"] + [fd["key"] for fd in template(t)]
    keys = [k for k in old if k in new]
    for k in new:
        if k in keys:
            continue
        if k in tmpl:
            ti = tmpl.index(k)
            pos = 0
            for j, kk in enumerate(keys):
                if kk in tmpl and tmpl.index(kk) < ti:
                    pos = j + 1
            keys.insert(pos, k)
        else:
            keys.append(k)
    return {k: new[k] for k in keys}
