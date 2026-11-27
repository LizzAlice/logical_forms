"""Layout of the section graph: one column per kind of form, arrows from what a form rests on to the form."""

from .logic import as_list

NW, NH, CX, RS, TOP, LEFT = 188, 44, 208, 56, 48, 16


def _is_pipeline(f):
    return f.get("type") == "setup" and bool(as_list(f.get("includes")))


def section_graph(idx, sid, mode="auto", expand=(), hide_done=True, threshold=50):
    sec = idx.sections[sid]
    own = [f["id"] for f in sec["forms"]]
    forms = idx.forms

    done = ("superseded", "resolved", "retired")
    keep = {x for x in own if x in forms and forms[x].get("status") not in done}
    if hide_done:
        # a superseded form something shown still rests on stays, so results keep their links
        todo = list(keep)
        while todo:
            for u in idx.rests_on(todo.pop()):
                if u not in keep and forms[u].get("status") in done:
                    keep.add(u)
                    todo.append(u)

    def shown(x):
        return not hide_done or forms[x].get("status") not in done or x in keep
    own = [x for x in own if x in forms and shown(x)]
    own_set = set(own)
    edges = []
    for x in own:
        for u in idx.rests_on(x):
            if u in own_set or shown(u):
                edges.append((u, x))
    external = sorted({u for u, _ in edges if u not in own_set})
    linked = {a for e in edges for a in e}
    nodes_all = [x for x in own if x in linked] + external
    unlinked = [x for x in own if x not in linked and forms[x].get("type") != "limitation"]

    # columns
    pipe_depth = {}

    def pdepth(x, seen=()):
        if x in pipe_depth:
            return pipe_depth[x]
        inner = [y for y in as_list(forms[x].get("includes")) if y in forms and _is_pipeline(forms[y]) and y not in seen]
        pipe_depth[x] = 1 + max([pdepth(y, seen + (x,)) for y in inner]) if inner else 0
        return pipe_depth[x]
    claim_depth = {}

    def cdepth(x, seen=()):
        if x in claim_depth:
            return claim_depth[x]
        ups = [y for y in idx.rests_on(x) if forms[y].get("type") == "claim" and y in linked and y not in seen]
        claim_depth[x] = 1 + max([cdepth(y, seen + (x,)) for y in ups]) if ups else 0
        return claim_depth[x]
    max_p = max([pdepth(x) for x in nodes_all if _is_pipeline(forms[x])] or [0])

    def col(x):
        f = forms[x]
        t = f.get("type")
        if t == "artifact":
            return 0
        if t == "setup":
            return 2 + pdepth(x) if _is_pipeline(f) else 1
        if t in ("result", "assumption", "open", "limitation"):
            return 3 + max_p
        if t == "claim":
            return 4 + max_p + cdepth(x)
        return 0

    # grouping of results by the pipeline setups they cite
    results = [x for x in nodes_all if forms[x].get("type") == "result" and x in own_set]
    flat_count = len(nodes_all)
    grouped = mode == "grouped" or (mode == "auto" and flat_count > threshold)
    member = {}
    groups = {}
    if grouped:
        for r in results:
            ev = [y for y in as_list(forms[r].get("evidence")) if y in forms]
            pipes = sorted(y for y in ev if _is_pipeline(forms[y]))
            key = tuple(pipes) if pipes else tuple(sorted(ev))
            if not key:
                continue
            gid = "G:" + "+".join(key)
            groups.setdefault(gid, {"id": gid, "cites": list(key), "results": []})["results"].append(r)
        for gid, g in list(groups.items()):
            if len(g["results"]) < 2 or gid in expand:
                continue
            for r in g["results"]:
                member[r] = gid
    nodes = {}
    for x in nodes_all:
        n = member.get(x, x)
        if n in nodes:
            continue
        if n.startswith("G:"):
            g = groups[n]
            nodes[n] = {"id": n, "type": "group", "status": "", "col": 3 + max_p, "count": len(g["results"]),
                        "cites": g["cites"], "external": False}
        else:
            f = forms[x]
            nodes[n] = {"id": n, "type": f.get("type"), "status": f.get("status", ""), "col": col(x),
                        "external": x not in own_set, "section": idx.section_of.get(x)}
    E = set()
    for a, b in edges:
        a2, b2 = member.get(a, a), member.get(b, b)
        if a2 != b2:
            E.add((a2, b2))
    def head(c):
        if c == 0:
            return "ARTIFACTS"
        if c == 1:
            return "STAGE SETUPS"
        if c < 3 + max_p:
            return "PIPELINE SETUPS" if c == 2 else "PIPELINES OF PIPELINES"
        if c == 3 + max_p:
            return "RESULTS AND PREMISES"
        return "CLAIMS" if c == 4 + max_p else "CLAIMS ON CLAIMS"
    used = sorted({n["col"] for n in nodes.values()})
    remap = {c: i for i, c in enumerate(used)}
    heads = [head(c) for c in used]
    for n in nodes.values():
        n["col"] = remap[n["col"]]
    # layered ordering (barycentre sweeps)
    cols = {}
    for n in nodes.values():
        cols.setdefault(n["col"], []).append(n["id"])
    for c in cols:
        cols[c].sort(key=lambda x: (nodes[x]["external"], idx._sort_key(x) if not x.startswith("G:") else 0, x))
    y = {}
    for c in cols:
        for k, n in enumerate(cols[c]):
            y[n] = k * RS
    nb = {}
    for a, b in E:
        nb.setdefault(a, []).append(b)
        nb.setdefault(b, []).append(a)
    for it in range(12):
        order = sorted(cols) if it % 2 == 0 else sorted(cols, reverse=True)
        for c in order:
            want = {n: (sum(y[m] for m in nb[n]) / len(nb[n]) if nb.get(n) else y[n]) for n in cols[c]}
            seq = sorted(cols[c], key=lambda n: want[n])
            pos = [want[n] for n in seq]
            for k in range(1, len(pos)):
                pos[k] = max(pos[k], pos[k - 1] + RS)
            if pos:
                shift = (sum(want[n] for n in seq) - sum(pos)) / len(pos)
                pos = [p + shift for p in pos]
                for k in range(1, len(pos)):
                    pos[k] = max(pos[k], pos[k - 1] + RS)
            for n, p in zip(seq, pos):
                y[n] = p
            cols[c] = seq
    mn = min(y.values()) if y else 0
    out = []
    for n in nodes.values():
        n = dict(n)
        n["x"] = LEFT + n.pop("col") * CX
        n["y"] = int(round(y[n["id"]] - mn + TOP))
        out.append(n)
    lims = []
    for lim in idx.limitations():
        if lim.get("status") == "refuted" or (hide_done and lim.get("status") == "resolved"):
            continue
        cov = idx.covered(lim)
        if not (cov & set(nodes_all)) and lim["id"] not in own_set:
            continue
        lims.append({"id": lim["id"], "statement": lim.get("statement", ""), "status": lim.get("status"),
                     "affects": [a for a in as_list(lim.get("affects"))],
                     "covered": sorted(cov),
                     "n": len([x for x in cov if forms[x].get("type") in ("result", "claim") and x in own_set])})
    return {
        "section": sid, "nodes": out, "edges": sorted(E),
        "W": (max([n["x"] for n in out]) + NW + 16) if out else 400,
        "H": (max([n["y"] for n in out]) + NH + 24) if out else 120,
        "NW": NW, "NH": NH, "CX": CX, "heads": [{"label": h, "x": LEFT + i * CX} for i, h in enumerate(heads)],
        "groups": {g: {"cites": v["cites"], "results": [idx.brief(r) for r in v["results"]]}
                   for g, v in groups.items() if len(v["results"]) >= 2},
        "grouped": grouped, "flat_count": flat_count, "threshold": threshold,
        "unlinked": [idx.brief(x) for x in unlinked], "hidden": len([f for f in sec["forms"] if not shown(f["id"])]),
        "external": external, "lims": lims,
        "texts": {n["id"]: idx.brief(n["id"]) for n in out if not n["id"].startswith("G:")},
    }
