'use strict';
/* Checks: rule problems with fixes, claims to revisit, open questions, citation gaps, limitation coverage. */

const CK = { openLim: null, oq: null, oqClosed: {}, oqAns: {} };

app.checks = async function (main, r) {
  const seq = renderSeq;
  if (r.q.oq && CK.oq !== r.q.oq) { CK.oq = r.q.oq; CK.oqClosed[r.q.oq] = true; }
  main.innerHTML = '<div class="page"><p class="muted">Running the checks…</p></div>';
  const C = await api('checks');
  if (seq !== renderSeq) return;
    if (C.ok === false) { main.innerHTML = `<div class="page"><p class="err">${esc(C.error)}</p></div>`; return; }
  const failing = new Set(C.problems.map(p => p.rule));
  const cinf = info('claimStatus'), oinf = info('openStatus');
  const where = p => [p.section, p.id !== p.section ? p.id : null, p.field].filter(Boolean).join(' › ');
  const probs = C.problems.map((p, i) => {
    const ri = infoText('Rule ' + p.rule + ' (§8)', p.ruleText);
    return `<div class="prob"><div class="row" style="gap:8px"><span class="rule">Rule ${p.rule}</span><strong>${esc(p.title)}</strong>${ri.btn}</div>${ri.pop}
      <p style="margin:8px 0 0">${esc(p.what)}</p>
      <div class="row" style="margin-top:8px;gap:8px"><span class="muted small">Where</span><span class="where">${esc(where(p))}</span></div>
      <div class="acts">${p.fixes.map((x, j) => x.nav ? `<a class="btn sm ${x.primary ? 'primary' : ''}" href="${esc(x.nav)}">${esc(x.label)}</a>`
        : `<button type="button" class="btn sm ${x.primary ? 'primary' : ''}" data-fix="${i}:${j}">${esc(x.label)}</button>`).join('')}</div></div>`;
  }).join('');
  const revs = C.revisit.map((rv, i) => `<div style="border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-top:10px">
      <div class="row" style="gap:8px">${idLink(rv.form.id)}<span class="muted small">updated ${esc(rv.form.updated)}</span></div>
      <p style="margin:6px 0 0;font-size:13.5px">${esc(rv.form.text)}</p>
      <p class="muted small" style="margin:6px 0 0">Changed underneath after it: ${rv.newer.map(n => `<a class="mono" href="${formHref(n.id)}">${esc(n.id)}</a> (${esc(n.status)}, ${esc(n.updated)})`).join(', ')}${rv.n_newer > rv.newer.length ? ` and ${rv.n_newer - rv.newer.length} more` : ''}</p>
      <div class="acts"><a class="btn sm" href="#/form/${encodeURIComponent(rv.form.id)}/edit">Open</a><a class="btn sm" href="#/form/${encodeURIComponent(rv.form.id)}/deps">Show what changed underneath</a>
        <button type="button" class="btn sm primary" data-touch="${esc(rv.form.id)}">Still holds: confirm</button>
        <button type="button" class="btn sm" data-setst="${esc(rv.form.id)}" data-st="outdated">Mark outdated…</button>
        <button type="button" class="btn sm" data-setst="${esc(rv.form.id)}" data-st="refuted">Mark refuted…</button></div></div>`).join('');
  const opens = C.opens.map(o => {
    const f = o.form, id = f.id, isOpen = CK.oq === id;
    const closedSel = CK.oqClosed[id] != null ? CK.oqClosed[id] : f.status === 'closed';
    const ans = CK.oqAns[id] || asList(f.answered_by).slice();
    CK.oqAns[id] = ans;
    return `<div style="border-top:1px solid #F0EEE9;padding:12px 0">
      <div class="row" style="gap:8px"><a class="mono" style="font-weight:600" href="${formHref(id)}">${esc(id)}</a>${statusChip(f.status)}${changeTag(id)}<span class="muted small">${esc(o.section)}</span><span class="grow"></span>
        ${isOpen ? '' : `<button type="button" class="btn sm" data-oq="${esc(id)}">Change status</button>`}</div>
      <p style="margin:4px 0 0;font-size:13.5px">${esc(f.statement)}</p>
      ${f.status === 'closed' && !isOpen ? `<p class="muted small" style="margin:4px 0 0">${o.answered_by.length ? 'Answered by ' + o.answered_by.map(b => idChip(b.id)).join(' ') : 'Dropped; the note says why.'}</p>` : ''}
      ${isOpen ? `<div style="margin-top:10px;padding:14px 16px;background:#FBFAF8;border:1px solid var(--line);border-radius:10px">
        <div class="row"><strong class="small">Status</strong><div class="seg"><button type="button" data-oqs="open" class="${closedSel ? '' : 'on'}">open</button><button type="button" data-oqs="closed" class="${closedSel ? 'on' : ''}">closed</button></div>${oinf.btn}</div>${oinf.pop}
        ${closedSel ? `<div style="margin-top:12px"><div class="small" style="font-weight:700">Answered by <span class="key">answered_by</span></div>
          <div class="row" style="gap:6px;margin-top:6px">${ans.map((x, k) => `<span class="refchip">${FM[x] ? typeChip(FM[x].f.type, true) : ''}${esc(x)}<button type="button" data-ansrm="${k}" aria-label="Remove ${esc(x)}">×</button></span>`).join('') || '<span class="muted small">Nothing yet.</span>'}</div>
          <div class="row" style="margin-top:8px;flex-wrap:wrap"><div class="picker" style="flex:1 1 260px"><input class="inp" id="ansPick" placeholder="Add an existing form that answers it…" autocomplete="off"><div class="dd hidden"></div></div>
            <button type="button" class="btn sm" data-newans="result">+ New result</button><button type="button" class="btn sm" data-newans="claim">+ New claim</button></div>
          <label class="small" for="dropWhy" style="display:block;margin-top:12px;font-weight:700">Or, if you dropped the question, why <span class="key">note</span></label>
          <textarea id="dropWhy" class="inp" style="margin-top:6px;min-height:46px" placeholder="Leave empty when forms above answer it"></textarea>
          <p class="small" style="margin:10px 0 0">Is one result you measured the whole answer? <button type="button" class="linkbtn" id="toResult">Turn this question into that result instead</button> <span class="muted">(it keeps its id, §4.10)</span></p></div>` : ''}
        <div id="oqErr"></div>
        <div class="acts" style="justify-content:flex-end"><button type="button" class="btn sm" id="oqCancel">Cancel</button><button type="button" class="btn sm primary" id="oqApply">Apply</button></div></div>` : ''}
    </div>`;
  }).join('');
  const gaps = C.gaps.map(g => `<div style="margin-top:10px;padding:12px 14px;background:var(--red-bg);border-radius:8px">
      <div class="row">${idLink(g.form.id)}<span class="muted small">${esc(g.form.section)}</span></div>
      <p style="margin:6px 0 0">${esc(g.form.text)}</p>
      ${g.at_risk.length ? `<p class="small" style="margin:8px 0 4px"><strong>At risk</strong>, resting on it directly or through other claims:</p><div class="row" style="gap:6px">${g.at_risk.map(b => idChip(b.id)).join('')}</div>` : ''}
      <div class="acts"><button type="button" class="btn sm primary" data-gapsrc="${esc(g.form.id)}">Source found: + artifact for it</button>
        ${g.form.type === 'claim' ? `<button type="button" class="btn sm" data-gaprt="${esc(g.form.id)}" data-to="assumption">Searched, nothing usable: turn into an assumption…</button>
        <button type="button" class="btn sm" data-gaprt="${esc(g.form.id)}" data-to="open">Measure it yourself: turn into an open question…</button>` : ''}</div></div>`).join('');
  const lims = C.coverage.map(l => {
    const n = l.claims.length + l.results.length, open = CK.openLim === l.id;
    return `<div><button type="button" class="lrow ${open ? 'on' : ''}" data-lim="${esc(l.id)}" aria-expanded="${open}">
        <span class="mono" style="flex:1 1 220px;min-width:0;font-weight:600;font-size:12px">${esc(l.id)}</span>${statusChip(l.status)}${l.severity === 'major' ? '<span class="chip s-bad">major</span>' : ''}
        <span style="flex:0 0 96px;display:flex;align-items:center;gap:8px"><span class="bar" style="width:${Math.max(2, Math.min(60, n * 1.2))}px"></span><span>${n}</span></span></button>
      ${open ? `<div style="padding:10px 8px 14px;background:#F5F8FF;border-radius:0 0 8px 8px">
        <p style="margin:0;font-size:13px">${esc(l.statement)}</p>
        <p class="flabel" style="margin:10px 0 4px">NAMED IN AFFECTS</p><div class="row" style="gap:6px">${l.affects.map(idChip).join('') || '<span class="muted small">nothing</span>'}</div>
        ${l.claims.length ? `<p class="flabel" style="margin:10px 0 4px">CLAIMS · ${l.claims.length}</p><div class="row" style="gap:6px">${l.claims.map(idChip).join('')}</div>` : ''}
        ${l.results.length ? `<p class="flabel" style="margin:10px 0 4px">RESULTS · ${l.results.length}</p><div class="row" style="gap:6px">${l.results.map(idChip).join('')}</div>` : ''}
        ${!n ? `<p class="muted small" style="margin:10px 0 0">${l.status === 'resolved' ? 'Covers nothing now and stays in the file as a record of what was wrong.' : 'Weakens only setups or artifacts that no result or claim rests on, so no text ever has to state it.'}</p>` : ''}
        <div class="acts"><a class="btn sm" href="#/form/${encodeURIComponent(l.id)}/edit">Open the limitation</a><a class="btn sm" href="#/graph/${encodeURIComponent(l.section)}?lim=${encodeURIComponent(l.id)}">Show on the graph</a></div></div>` : ''}</div>`;
  }).join('');
  const passing = Object.entries(C.rules).filter(([n]) => !failing.has(+n)).map(([n]) => `<div class="inv"><span class="n">${n}</span><span class="ok">✓</span><span>${esc(C.pass[n] || '')}</span></div>`).join('');
  main.innerHTML = `<div class="page">
    <h1>Checks</h1><p class="muted" style="margin:0">The file rules of §8 and the standing queries of §8.1, on the file as it is open now, unsaved changes included. They rerun after every change.</p>
    <div class="cols" style="margin-top:16px">
      <div style="flex:3 1 600px;min-width:0;display:flex;flex-direction:column;gap:16px">
        <section class="panel"><h2>Rule problems <span class="muted" style="font-weight:500">${C.problems.length}</span></h2>${probs || '<p class="muted" style="margin:8px 0 0">None. Every rule that can be checked on the file passes.</p>'}</section>
        <section class="panel"><div class="row" style="gap:4px"><h2>Claims to revisit (M3) <span class="muted" style="font-weight:500">${C.revisit.length}</span></h2>${cinf.btn}</div>${cinf.pop}
          <p class="muted small" style="margin:4px 0 0">A claim is listed when something it rests on, directly or further down, changed after the claim's own date (§8.1). Confirm it if it still holds, or mark it outdated or refuted.</p>
          ${revs || '<p class="muted" style="margin:8px 0 0">None. No claim is older than something it rests on.</p>'}</section>
        <section class="panel"><div class="row" style="gap:4px"><h2>Open questions <span class="muted" style="font-weight:500">${C.opens.length}</span></h2>${oinf.btn}<span class="grow"></span><button type="button" class="btn sm" id="ckQa">+ Open question</button></div>${oinf.pop}
          ${opens || '<p class="muted" style="margin:8px 0 0">None.</p>'}</section>
        <section class="panel"><h2>Citation gaps <span class="muted" style="font-weight:500">${C.gaps.length}</span></h2>${gaps || '<p class="muted" style="margin:8px 0 0">None. Nothing is unsourced.</p>'}</section>
      </div>
      <div style="flex:2 1 380px;min-width:0;display:flex;flex-direction:column;gap:16px">
        <section class="panel"><h2>What each limitation covers</h2><p class="muted small" style="margin:4px 0 8px">Results and claims a text has to hedge when it reports them (§4.4). Click one to see them.</p>${lims || '<p class="muted">No limitations.</p>'}</section>
        <section class="panel"><h2>Rules that pass <span class="muted" style="font-weight:500">${Object.keys(C.rules).length - failing.size}</span></h2><p class="muted small" style="margin:4px 0 6px">Rule 7 is checked when the file is read; rule 10 is about generated text.</p>${passing}</section>
      </div></div></div>`;
  // bindings
  $$('[data-fix]').forEach(b => b.onclick = async () => {
    const [i, j] = b.dataset.fix.split(':').map(Number);
    const x = C.problems[i].fixes[j];
    await act('fix', { action: x.action, args: x.args }, 'Done: ' + x.label + '.');
  });
  $$('[data-touch]').forEach(b => b.onclick = () => act('fix', { action: 'touch', args: { id: b.dataset.touch } }, `${b.dataset.touch} confirmed; updated set to today.`));
  $$('[data-setst]').forEach(b => b.onclick = async () => {
    const id = b.dataset.setst, st = b.dataset.st;
    const res = await act('status', { id, status: st }, `${id} is ${st}.`);
    if (res.ok) go(`#/form/${encodeURIComponent(id)}/edit`);
  });
  $('#ckQa').onclick = () => app.quickOpen();
  $$('[data-oq]').forEach(b => b.onclick = () => { CK.oq = b.dataset.oq; CK.oqClosed[b.dataset.oq] = true; render(); });
  if (CK.oq) bindOpenEditor(CK.oq);
  $$('[data-gapsrc]').forEach(b => b.onclick = () => {
    const gid = b.dataset.gapsrc;
    createModal({ type: 'artifact', section: FM[gid].sec, title: 'Artifact for the source of ' + gid,
      intro: 'A cited paper, dataset or page: its URL or path, and a version such as the access date (M5). When you add it, it goes into Rests on of ' + esc(gid) + ', and the claim opens so you can set its status (§4.10).',
      only: ['path', 'version', 'note'],
      onDone: async aid => {
        const f = FM[gid].f;
        if (f.type === 'claim') await api('fix', { action: 'add_ref', args: { id: gid, field: 'derived_from', value: aid } });
        await refresh(); location.hash = `#/form/${encodeURIComponent(gid)}/edit`;
      } });
  });
  $$('[data-gaprt]').forEach(b => b.onclick = async () => {
    const res = await act('retype', { id: b.dataset.gaprt, to: b.dataset.to }, `${b.dataset.gaprt} is now a ${b.dataset.to}.`);
    if (res.ok) go(`#/form/${encodeURIComponent(b.dataset.gaprt)}/edit`);
  });
  $$('[data-lim]').forEach(b => b.onclick = () => { CK.openLim = CK.openLim === b.dataset.lim ? null : b.dataset.lim; render(); });
};

function bindOpenEditor(id) {
  const f = FM[id] && FM[id].f;
  if (!f) return;
  const ans = CK.oqAns[id];
  $$('[data-oqs]').forEach(b => b.onclick = () => { CK.oqClosed[id] = b.dataset.oqs === 'closed'; render(); });
  $$('[data-ansrm]').forEach(b => b.onclick = () => { ans.splice(+b.dataset.ansrm, 1); render(); });
  const inp = $('#ansPick');
  if (inp) {
    const dd = inp.nextElementSibling;
    inp.oninput = () => {
      const ids = searchForms(inp.value, 10).filter(x => x !== id);
      dd.innerHTML = ids.map(x => `<div class="opt ${ans.includes(x) ? 'off' : ''}" data-x="${esc(x)}">${typeChip(FM[x].f.type, true)}<span class="mono ellip" style="flex:0 1 auto">${esc(x)}</span><span class="muted ellip grow">${esc(textOf(x))}</span></div>`).join('') || '<div class="opt off">Nothing matches.</div>';
      dd.classList.toggle('hidden', !inp.value.trim());
      $$('.opt[data-x]', dd).forEach(o => o.onmousedown = e => { e.preventDefault(); if (!ans.includes(o.dataset.x)) ans.push(o.dataset.x); render(); });
    };
    inp.onblur = () => setTimeout(() => dd.classList.add('hidden'), 150);
  }
  $$('[data-newans]').forEach(b => b.onclick = () => {
    const t = b.dataset.newans;
    createModal({ type: t, section: FM[id].sec, title: `New ${t} answering ${id}`, addLabel: 'Add and use as answer',
      intro: 'Filed in the same section. When you add it, it goes into Answered by.',
      onDone: nid => { ans.push(nid); } });
  });
  if ($('#toResult')) $('#toResult').onclick = async () => {
    const res = await act('retype', { id, to: 'result' }, `${id} is now a result.`);
    if (res.ok) { CK.oq = null; go(`#/form/${encodeURIComponent(id)}/edit`); }
  };
  $('#oqCancel').onclick = () => { CK.oq = null; delete CK.oqClosed[id]; delete CK.oqAns[id]; render(); };
  $('#oqApply').onclick = async () => {
    let res;
    if (CK.oqClosed[id]) {
      const why = ($('#dropWhy') || {}).value || '';
      if (!ans.length && !why.trim()) { $('#oqErr').innerHTML = '<p class="need">Name what answers it, or say why it was dropped.</p>'; return; }
      res = await act('open/close', { id, answered_by: ans, reason: why }, `${id} closed.`);
    } else if (f.status === 'closed') {
      res = await act('open/reopen', { id }, `${id} is open again.`);
    } else { CK.oq = null; render(); return; }
    if (res.ok) { CK.oq = null; delete CK.oqAns[id]; delete CK.oqClosed[id]; render(); }
  };
}
