'use strict';
/* Start screen, section view with the detail panel, and "what rests on what". */

// -------------------------------------------------------------------- start
app.start = function (main) {
  const recent = (S.recent || []).map(p => `<button type="button" class="tcard" data-open="${esc(p)}" style="flex-direction:row;justify-content:space-between;align-items:center">
      <span class="mono" style="font-weight:600">${esc(p.split(/[\\/]/).pop())}</span><span class="muted small ellip" style="max-width:60%">${esc(p)}</span></button>`).join('');
  main.innerHTML = `<div class="page" style="max-width:1080px;margin:0 auto;padding-top:48px">
    <div class="row"><svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2450C8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h5"/></svg><h1 style="font-size:30px;margin:0">Forms editor</h1></div>
    <p class="muted" style="font-size:16px;margin:8px 0 0">Look through, change and extend a logical-forms file (spec v1).</p>
    ${S.open ? `<p style="margin:14px 0 0">Open now: <a href="#/section/${encodeURIComponent(UI.lastSection || S.model.sections[0].id)}" class="mono">${esc(S.name)}</a>${S.dirty ? ' <span class="dirty">with unsaved changes</span>' : ''}</p>` : ''}
    <div class="cols" style="margin-top:28px">
      <section class="panel" style="flex:1 1 420px">
        <h2 style="font-size:18px">Open a forms file</h2>
        <label class="flabel" for="openpath" style="display:block;margin-top:14px">Path to the file</label>
        <div class="row" style="margin-top:6px;flex-wrap:nowrap"><input id="openpath" class="inp mono" placeholder="/path/to/forms.yaml" value="${esc(S.file || '')}">
          <button class="btn" type="button" id="browseBtn">Browse…</button><button class="btn primary" type="button" id="openBtn">Open</button></div>
        ${recent ? `<h3 class="muted" style="letter-spacing:.04em;font-size:12px">RECENTLY OPENED</h3>${recent}` : ''}
      </section>
      <section class="panel" style="flex:1 1 420px;display:flex;flex-direction:column">
        <h2 style="font-size:18px">Start a new forms file</h2>
        <p class="muted" style="margin:12px 0 0">Writes <span class="mono">spec: v1</span>, the component keys you pick from the standard list and your first section. Everything else is added from the section view.</p>
        <div style="flex:1"></div><div style="margin-top:18px"><a class="btn primary" href="#/new">New forms file…</a></div>
      </section>
    </div>
    <section class="panel" style="margin-top:20px;background:var(--accent-bg);border-color:#C9D5F5">
      <h2>How saving works</h2>
      <ul style="margin:10px 0 0;padding-left:20px">
        <li>Each save writes a new file next to the one you opened, named with date and time, for example <span class="mono">forms_${esc(S.today)}_1146.yaml</span>. The file you opened is never written to.</li>
        <li>The new file is read back and checked before the editor switches to it. If it does not read back the same, it is removed and your changes stay open.</li>
        <li>Forms you did not touch stay line for line as they were, comments and blank lines included. A form you changed is written out again, with lists as brackets over several lines.</li>
      </ul>
    </section>
  </div>`;
  const doOpen = async p => { const r = await api('open', { path: p }); if (r.ok === false) return toast(r.error, true); S = r.state; rebuild(); go('#/section/' + encodeURIComponent(S.model.sections[0] ? S.model.sections[0].id : '')); };
  $('#openBtn').onclick = () => doOpen($('#openpath').value);
  $('#openpath').onkeydown = e => { if (e.key === 'Enter') doOpen($('#openpath').value); };
  $('#browseBtn').onclick = () => fileBrowser($('#openpath').value, false, p => { $('#openpath').value = p; doOpen(p); });
  $$('[data-open]').forEach(b => b.onclick = () => doOpen(b.dataset.open));
};

/* A small file browser. wantDir: pick a folder instead of a file. */
async function fileBrowser(start, wantDir, onPick) {
  const show = async path => {
    const r = await api('browse?path=' + encodeURIComponent(path || ''));
        if (r.ok === false) return toast(r.error, true);
    const m = modal(`<div class="row" style="justify-content:space-between"><h2 style="font-size:18px">${wantDir ? 'Pick a folder' : 'Pick a forms file'}</h2><button class="xbtn" data-close aria-label="Close">×</button></div>
      <p class="mono small" style="margin:8px 0 0;word-break:break-all">${esc(r.path)}</p>
      <div class="browser">
        <button type="button" data-dir="${esc(r.parent)}"><span>↑</span><span>Up one folder</span></button>
        ${r.entries.map(e => `<button type="button" ${e.dir ? `data-dir="${esc(e.path)}"` : `data-file="${esc(e.path)}"`}><span>${e.dir ? '📁' : '📄'}</span><span class="${e.dir ? '' : 'mono'}">${esc(e.name)}</span></button>`).join('') || '<p class="muted" style="padding:10px">No folders or YAML files here.</p>'}
      </div>
      ${wantDir ? `<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" type="button" id="pickHere">Use this folder</button></div>` : ''}`);
    $$('[data-dir]', m).forEach(b => b.onclick = () => show(b.dataset.dir));
    $$('[data-file]', m).forEach(b => b.onclick = () => { if (!wantDir) { closeModal(); onPick(b.dataset.file); } });
    if (wantDir) $('#pickHere', m).onclick = () => { closeModal(); onPick(r.path); };
  };
  show(start);
}

// -------------------------------------------------------------------- section view
function isHidden(f) { return UI.hideDone && HIDE_STATES.includes(f.status); }

app.section = function (main, r) {
  let sid = r.parts[1];
  if (!sid || !section(sid)) sid = S.model.sections[0] && S.model.sections[0].id;
  if (!sid) { main.innerHTML = `<div class="page"><p>This file has no sections yet.</p><a class="btn primary" href="#/section/new">+ New section</a></div>`; return; }
  UI.lastSection = sid;
  const s = section(sid);
  const sel = r.q.sel && FM[r.q.sel] ? r.q.sel : null;
  const counts = {};
  s.forms.forEach(f => { counts[f.type] = (counts[f.type] || 0) + 1; });
  const types = TYPE_ORDER.filter(t => counts[t]);
  if (UI.typeFilter !== 'all' && !counts[UI.typeFilter]) UI.typeFilter = 'all';
  const q = UI.sectionFilter.trim().toLowerCase();
  let forms = s.forms.filter(f => !isHidden(f) || f.id === sel)
    .filter(f => UI.typeFilter === 'all' || f.type === UI.typeFilter)
    .filter(f => !q || (f.id + ' ' + textOf(f.id) + ' ' + (f.note || '')).toLowerCase().includes(q));
  const nHidden = s.forms.filter(isHidden).length;
  const row = f => {
    const up = restsOn(f).length, dn = (DOWN[f.id] || []).length;
    return `<a class="frow ${f.id === sel ? 'on' : ''}" href="#/section/${encodeURIComponent(sid)}?sel=${encodeURIComponent(f.id)}">
      <div class="grow"><div class="row" style="gap:8px;flex-wrap:nowrap">${UI.order !== 'type' ? typeChip(f.type, true) : ''}<span class="mono ellip" style="font-weight:600">${esc(f.id)}</span>${statusChip(f.status)}${changeTag(f.id)}</div>
      <div class="ellip muted" style="font-size:13px;margin-top:2px">${esc(textOf(f.id))}</div></div>
      <span class="muted small" style="white-space:nowrap;padding-top:2px" title="rests on ${up} · ${dn} rest on it">${up} · ${dn}</span></a>`;
  };
  let listHtml = '';
  if (UI.order === 'type') {
    listHtml = TYPE_ORDER.filter(t => forms.some(f => f.type === t)).map(t => {
      const fs = forms.filter(f => f.type === t);
      const key = sid + ':' + t;
      const open = !UI.collapsed[key];
      return `<button type="button" class="ghead" data-g="${esc(key)}" aria-expanded="${open}"><span>${open ? '▾' : '▸'} ${esc(TYPE_LABEL[t])} <span class="muted" style="font-weight:500">${fs.length}</span></span>${t === TYPE_ORDER.find(x => forms.some(f => f.type === x)) ? '<span class="muted small" style="font-weight:500">rests on · rests on it</span>' : ''}</button>
        ${open ? `<div style="padding:4px 0">${fs.map(row).join('')}</div>` : ''}`;
    }).join('');
  } else {
    const fs = UI.order === 'updated' ? forms.slice().sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || ''))) : forms;
    listHtml = `<div style="padding:4px 0">${fs.map(row).join('')}</div>`;
  }
  const links = asList(s.links).map(l => `<span class="muted">${esc(l.rel)}</span> <a class="mono" href="#/section/${encodeURIComponent(l.to)}">${esc(l.to)}</a>${l.why ? ` <span class="muted">· ${esc(l.why)}</span>` : ''}`).join('<br>');
  const sinf = info('sectionStatus', s.status);
  main.innerHTML = `<div class="secwrap">
    <nav class="secnav" aria-label="Sections">
      <div class="row" style="justify-content:space-between;padding:0 6px 10px"><span class="muted" style="font-size:12px;font-weight:700;letter-spacing:.04em">SECTIONS</span><a class="btn sm" href="#/section/new">+ New section</a></div>
      ${S.model.sections.map(x => `<a class="item ${x.id === sid ? 'on' : ''}" href="#/section/${encodeURIComponent(x.id)}"><div style="font-weight:600;font-size:13.5px">${esc(x.title || x.id)}</div>
        <div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="mono muted ellip" style="font-size:11.5px">${esc(x.id)}</span><span class="muted small">${x.forms.length}</span></div></a>`).join('')}
      <div style="margin-top:16px;padding:10px 6px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:6px">
        <a href="#/checks">Checks and open questions</a><a href="#/registry">Component keys</a></div>
    </nav>
    <section class="seclist" aria-label="Forms in the section">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div class="grow">
          <div class="row" style="gap:8px"><span class="mono muted">${esc(s.id)}</span>${statusChip(s.status)}${sinf.btn}<span class="muted small">updated ${esc(s.updated || '—')}</span>${changeTag(s.id)}</div>${sinf.pop}
          <h1>${esc(s.title || s.id)}</h1>
          <p class="muted" style="margin:0;max-width:760px">${esc(s.about || '')}</p>
          ${links ? `<p style="margin:8px 0 0;font-size:13px">${links}</p>` : ''}
        </div>
        <div class="row"><a class="btn" href="#/graph/${encodeURIComponent(sid)}">Section graph</a><a class="btn" href="#/section/${encodeURIComponent(sid)}/edit">Edit section</a><a class="btn primary" href="#/add?section=${encodeURIComponent(sid)}">+ Add form</a></div>
      </div>
      <div class="row" role="group" aria-label="Filter by type" style="gap:6px;margin-top:18px">
        ${['all'].concat(types).map(t => `<button type="button" class="btn sm" data-tf="${t}" style="${UI.typeFilter === t ? 'background:var(--accent-bg);border-color:var(--accent-line)' : ''}">${t === 'all' ? 'All' : esc(t)} <span class="muted">${t === 'all' ? s.forms.length : counts[t]}</span></button>`).join('')}
      </div>
      <div class="row" style="margin-top:8px;font-size:13px;gap:16px">
        <label class="row" style="gap:6px"><input type="checkbox" id="hideDone" ${UI.hideDone ? 'checked' : ''}> Hide superseded, resolved and retired${nHidden ? ` (${nHidden})` : ''}</label>
        <label class="row" style="gap:6px">Order <select class="inp" id="order" style="width:auto;padding:5px 8px"><option value="type" ${UI.order === 'type' ? 'selected' : ''}>grouped by type</option><option value="file" ${UI.order === 'file' ? 'selected' : ''}>as in the file</option><option value="updated" ${UI.order === 'updated' ? 'selected' : ''}>last changed first</option></select></label>
        <input class="inp" id="secFilter" placeholder="Filter this section…" value="${esc(UI.sectionFilter)}" style="flex:1 1 200px;max-width:320px;padding:6px 10px" aria-label="Filter this section">
      </div>
      <div class="list">${listHtml || '<p class="muted" style="padding:14px">No forms match.</p>'}</div>
    </section>
    <aside class="detail" id="detail" aria-label="Selected form">${sel ? '<p class="muted">Loading…</p>' : '<p class="muted">Pick a form to see what it rests on and what rests on it.</p>'}</aside>
  </div>`;
  $$('[data-tf]').forEach(b => b.onclick = () => { UI.typeFilter = b.dataset.tf; render(); });
  $$('[data-g]').forEach(b => b.onclick = () => { UI.collapsed[b.dataset.g] = !UI.collapsed[b.dataset.g]; render(); });
  $('#hideDone').onchange = e => { UI.hideDone = e.target.checked; render(); };
  $('#order').onchange = e => { UI.order = e.target.value; render(); };
  const sf = $('#secFilter');
  sf.oninput = () => { UI.sectionFilter = sf.value; const pos = sf.selectionStart; render().then(() => { const n = $('#secFilter'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); };
  if (sel) detailPanel($('#detail'), sel);
};

async function detailPanel(box, id) {
  const rel = await api('relations?id=' + encodeURIComponent(id));
    if (rel.ok === false) { box.innerHTML = `<p class="err">${esc(rel.error)}</p>`; return; }
  const f = rel.form;
  const t = f.type;
  const sinf = info(({ claim: 'claimStatus', result: 'resultStatus', assumption: 'assumptionStatus', limitation: 'limitationStatus', open: 'openStatus', def: 'defStatus', artifact: 'artifactStatus', setup: 'artifactStatus' })[t], f.status);
  const fieldBox = (label, key, val, note) => val ? `<div class="fbox ${note ? 'note' : ''}"><div class="flabel">${esc(label)} <span class="key">${key}</span></div><div style="margin-top:2px;white-space:pre-wrap">${esc(val)}</div></div>` : '';
  let body = '';
  if (['result', 'claim', 'assumption', 'limitation', 'open'].includes(t)) body += `<p style="margin:10px 0 0;font-size:15px">${esc(f.statement || '')}</p>`;
  if (t === 'result') body += fieldBox('What was measured', 'scope', f.scope);
  if (t === 'assumption') body += fieldBox('Why it is reasonable', 'basis', f.basis) + fieldBox('What would make it false', 'breaks_if', f.breaks_if);
  if (t === 'def') body += `<p style="margin:10px 0 0;font-size:15px"><strong>${esc(f.term)}</strong>: ${esc(f.definition || '')}</p>` +
    (asList(f.use).length ? `<p class="small" style="margin:8px 0 0">Use: ${asList(f.use).map(x => `“${esc(x)}”`).join(', ')}</p>` : '') +
    (asList(f.avoid).length ? `<p class="small" style="margin:4px 0 0">Avoid: ${asList(f.avoid).map(x => `“${esc(x)}”`).join(', ')}</p>` : '') + fieldBox('Why avoid them', 'why_avoid', f.why_avoid);
  if (t === 'artifact') body += `<div class="fbox"><div class="mono" style="word-break:break-all">${esc(f.path || '')}</div>${f.version ? `<div class="small muted">version ${esc(f.version)}</div>` : ''}${f.entrypoint ? `<div class="mono small" style="margin-top:6px;word-break:break-all">$ ${esc(f.entrypoint)}</div>` : ''}${asList(f.produces).length ? `<div class="small" style="margin-top:6px">produces: ${asList(f.produces).map(x => `<span class="mono">${esc(x)}</span>`).join(', ')}</div>` : ''}</div>`;
  if (t === 'setup' && f.components) body += `<div class="fbox">${Object.entries(f.components).map(([k, v]) => `<div style="margin-top:4px"><span class="mono" style="font-weight:600">${esc(k)}</span> <span>${esc(asList(v).join(', '))}</span></div>`).join('')}</div>`;
  if (t === 'setup' && f.script) body += `<p class="mono small" style="margin:8px 0 0;word-break:break-all">${esc(f.script)}</p>`;
  body += fieldBox('Must not be turned into', 'not_supported', f.not_supported);
  body += fieldBox('Note, never written out', 'note', f.note, true);
  const retypes = S.schema.retype.filter(x => x.from === t && (!x.from_status || x.from_status === f.status));
  const isNew = S.new_ids.includes(id);
  const acts = [`<a class="btn" href="#/form/${encodeURIComponent(id)}/edit">Edit</a>`, `<a class="btn primary" href="#/form/${encodeURIComponent(id)}/deps">What rests on what</a>`];
  if (['result', 'claim', 'assumption', 'open'].includes(t) && !DONE.includes(f.status)) acts.push(`<a class="btn" href="#/add?section=${encodeURIComponent(rel.section)}&type=claim&rests_on=${encodeURIComponent(id)}">+ Claim resting on this</a>`);
  if (['setup', 'artifact'].includes(t) && f.status === 'current') acts.push(`<a class="btn" href="#/newversion/${encodeURIComponent(id)}">New version…</a>`);
  if (t === 'open' && f.status === 'open') acts.push(`<a class="btn" href="#/checks?oq=${encodeURIComponent(id)}">Close the question…</a>`);
  acts.push(`<button class="btn" type="button" id="touchBtn" title="Sets updated to today (M3)">Confirm still correct</button>`);
  if (retypes.length) acts.push(`<button class="btn" type="button" id="retypeBtn">Change type…</button>`);
  if (isNew) acts.push(`<button class="btn danger" type="button" id="discardBtn">Discard this new form</button>`);
  const list = (title, items, extra) => items.length ? `<h3>${title} <span class="muted" style="font-weight:500">${items.length}${extra || ''}</span></h3>${items.map(b => idLink(b.id)).join('')}` : '';
  const uc = rel.up_counts;
  const deeper = rel.up.length > 1 ? `<p class="muted small" style="margin:6px 0 0">In total ${Object.values(uc).reduce((a, b) => a + b, 0)} forms underneath, ${rel.up.length} steps deep: ${Object.entries(uc).map(([k, v]) => v + ' ' + k + (v > 1 ? 's' : '')).join(', ')}.</p>` : '';
  let ceiling = '';
  if (rel.ceiling) {
    const c = rel.ceiling;
    ceiling = c.value === 'revisit' ? `<p class="err">It rests on ${c.because.map(esc).join(', ')}, which ${c.because.length > 1 ? 'are' : 'is'} no longer in force. Revisit it (M3).</p>`
      : `<p class="small" style="margin:8px 0 0">Ceiling from what it rests on: <strong>${esc(c.value)}</strong>${c.value === 'established' && f.status === 'preliminary' ? '; preliminary records that the step is a judgement' : ''}.</p>`;
  }
  box.innerHTML = `<div class="row" style="gap:8px">${typeChip(t)}${statusChip(f.status)}${sinf.btn}<span class="muted small">updated ${esc(f.updated || '—')}</span>${changeTag(id)}${f.wording === 'fixed' ? '<span class="chip s-off">wording fixed</span>' : ''}</div>${sinf.pop}
    <h2 class="mono" style="margin:10px 0 0;font-size:15px;word-break:break-all">${esc(id)}</h2>
    ${body}
    <div class="row" style="margin-top:14px;gap:8px">${acts.join('')}</div>
    ${ceiling}
    ${list('Rests on directly', rel.rests_on)}${deeper}
    ${list('Rests on this', rel.rested_on_by)}
    ${rel.covers ? list('Covers', rel.covers, ' results and claims a text has to hedge') : ''}
    ${rel.answered_by && rel.answered_by.length ? list('Answered by', rel.answered_by) : ''}
    ${rel.limitations.length ? `<h3>Limitations that reach it <span class="muted" style="font-weight:500">${rel.limitations.length} · a text reporting it has to state them</span></h3>
      ${rel.limitations.map(l => `<div class="limbox"><a class="mono" style="font-weight:600;color:#8C2617" href="${formHref(l.id)}">${esc(l.id)}</a> ${l.severity === 'major' ? '<span class="chip s-bad">major</span>' : ''} ${l.status === 'resolved' ? '<span class="chip s-off">resolved</span>' : ''}<div class="muted small">${l.via === id ? 'names it directly' : `reaches it through <span class="mono">${esc(l.via)}</span>`}</div></div>`).join('')}` : ''}
    ${list('Assumptions underneath', rel.assumptions)}
    ${list('Unsourced underneath', rel.unsourced)}
    ${list('Superseded underneath', rel.superseded)}
    ${t === 'claim' && rel.newer_underneath.length ? `<h3>Changed after this claim <span class="muted" style="font-weight:500">${rel.newer_underneath.length}</span></h3><p class="small muted" style="margin:0">Something under it moved (M3). Confirm it if it still holds.</p>${rel.newer_underneath.map(b => idLink(b.id)).join('')}` : ''}
    ${Object.keys(rel.map).length || rel.map_in.length ? `<h3>Pipeline order <span class="muted" style="font-weight:500">not a rests-on link (§4.4)</span></h3>
      ${Object.entries(rel.map).map(([k, v]) => `<div class="small"><span class="key">${k}</span> ${v.map(idChip).join(' ')}</div>`).join('')}
      ${rel.map_in.length ? `<div class="small" style="margin-top:4px"><span class="muted">named by</span> ${rel.map_in.map(b => idChip(b.id)).join(' ')}</div>` : ''}` : ''}`;
  $('#touchBtn', box).onclick = () => act('fix', { action: 'touch', args: { id } }, `${id}: updated set to today.`);
  if ($('#retypeBtn', box)) $('#retypeBtn', box).onclick = () => retypeDialog(id);
  if ($('#discardBtn', box)) $('#discardBtn', box).onclick = async () => { const r = await act('form/discard', { id }, `Discarded ${id}.`); if (r.ok) go('#/section/' + encodeURIComponent(rel.section)); };
}

function retypeDialog(id) {
  const f = FM[id].f;
  const opts = S.schema.retype.filter(x => x.from === f.type && (!x.from_status || x.from_status === f.status));
  const m = modal(`<div class="row" style="justify-content:space-between"><h2 style="font-size:18px">Change the type of <span class="mono">${esc(id)}</span></h2><button class="xbtn" data-close aria-label="Close">×</button></div>
    <p class="muted small" style="margin:4px 0 12px">The id stays (M1), so nothing that points at it needs editing (§4.10). Fields the new type does not have are dropped; you fill in what it needs next.</p>
    ${opts.map((o, i) => `<button type="button" class="tcard" data-rt="${i}"><strong>${esc(o.label)}</strong><span class="small muted">becomes a ${esc(o.to)} with status ${esc(o.status)}${o.drop.length ? '; drops ' + o.drop.join(', ') : ''}</span></button>`).join('')}`);
  $$('[data-rt]', m).forEach(b => b.onclick = async () => {
    const o = opts[+b.dataset.rt];
    closeModal();
    const r = await act('retype', { id, to: o.to }, `${id} is now a ${o.to}.`);
    if (r.ok) go(`#/form/${encodeURIComponent(id)}/edit`);
  });
}

// -------------------------------------------------------------------- what rests on what
app.deps = async function (main, id) {
  const seq = renderSeq;
  if (!FM[id]) { main.innerHTML = `<div class="page"><p class="err">There is no form ${esc(id)}.</p></div>`; return; }
  main.innerHTML = '<div class="page"><p class="muted">Loading…</p></div>';
  const rel = await api('relations?id=' + encodeURIComponent(id));
  if (seq !== renderSeq) return;
    if (rel.ok === false) { main.innerHTML = `<div class="page"><p class="err">${esc(rel.error)}</p></div>`; return; }
  const f = rel.form;
  const maxStep = rel.up.length;
  const depth = Math.min(UI.depth, maxStep);
  const lim = rel.limitations.find(l => l.id === UI.limHL);
  const onPath = new Set(lim ? lim.path : []);
  const card = b => `<a class="dcard ${onPath.has(b.id) ? 'hl' : ''}" href="#/form/${encodeURIComponent(b.id)}/deps" title="${esc(b.text)}">
      <span class="row" style="gap:6px;flex-wrap:nowrap">${typeChip(b.type, true)}<span class="mono ellip" style="font-size:11.5px;font-weight:600">${esc(b.id)}</span></span>
      <span class="muted ellip" style="font-size:12px">${esc(b.text || b.status)}</span><span>${statusChip(b.status)}</span></a>`;
  const upCols = rel.up.filter(c => c.step <= depth).slice().reverse().map(c => `<div class="dcol"><div class="colhead">${c.step === 1 ? 'RESTS ON DIRECTLY' : 'STEP ' + c.step} →</div>${c.forms.map(card).join('')}</div>`).join('');
  const down = rel.down.length ? rel.down.map(c => `<div class="dcol"><div class="colhead">→ ${c.step === 1 ? 'RESTS ON THIS' : 'STEP ' + c.step + ' DOWN'}</div>${c.forms.map(card).join('')}</div>`).join('')
    : `<div class="dcol"><div class="colhead">→ RESTS ON THIS</div><p class="muted small">Nothing rests on it.</p></div>`;
  const uc = rel.up_counts;
  const total = Object.values(uc).reduce((a, b) => a + b, 0);
  main.innerHTML = `<div class="page">
    <a class="small" href="${formHref(id)}">← ${esc(rel.section)}</a>
    <div class="row" style="justify-content:space-between;align-items:flex-end">
      <div><h1>What rests on what</h1><p class="muted" style="margin:0">Follows derived_from for claims, evidence for results, includes and component ids for setups: the links that decide what a limitation reaches (§4.4).</p></div>
      ${maxStep > 1 ? `<div class="row"><span class="muted small">Steps down</span><div class="seg">${Array.from({ length: maxStep }, (_, i) => i + 1).map(n => `<button type="button" data-depth="${n}" class="${depth === n ? 'on' : ''}">${n === maxStep ? 'All' : n}</button>`).join('')}</div></div>` : ''}
    </div>
    <div class="panel row" style="margin-top:14px;padding:12px 16px">${typeChip(f.type)}<span class="mono" style="font-weight:600">${esc(id)}</span>${statusChip(f.status)}
      <span class="muted small">rests on ${total} form${total === 1 ? '' : 's'}${total ? ' in ' + maxStep + ' step' + (maxStep > 1 ? 's' : '') + ': ' + Object.entries(uc).map(([k, v]) => v + ' ' + k + (v > 1 ? 's' : '')).join(', ') : ''} · ${rel.down.reduce((a, c) => a + c.forms.length, 0)} rest on it${rel.newer_underneath.length ? ` · <strong>${rel.newer_underneath.length} underneath changed after it</strong>` : ''}</span></div>
    <div class="dcols" style="margin-top:16px">${upCols}
      <div class="dcol" style="flex:1.3 1 230px"><div class="colhead">THIS ${esc(f.type.toUpperCase())}</div><div class="thiscard"><div class="mono" style="font-weight:700;font-size:12px;word-break:break-all">${esc(id)}</div><p style="margin:8px 0 0;font-size:13px">${esc(textOf(id))}</p><div class="row" style="margin-top:10px"><a class="btn sm" href="#/form/${encodeURIComponent(id)}/edit">Edit</a></div></div></div>
      ${down}</div>
    <section class="panel" style="margin-top:18px">
      <h2>Limitations that reach it</h2>
      ${rel.limitations.length ? `<p class="muted small" style="margin:4px 0 10px">Pick one to mark the forms it passes through on the way here.</p><div class="row" style="align-items:stretch">${rel.limitations.map(l => `<button type="button" class="limbtn ${UI.limHL === l.id ? 'on' : ''}" data-lim="${esc(l.id)}"><span class="mono" style="font-weight:600;color:#8C2617">${esc(l.id)}${l.severity === 'major' ? ' · major' : ''}</span><span class="small">${esc(l.statement)}</span><span class="muted small">named in affects: <span class="mono">${esc(l.via)}</span></span></button>`).join('')}</div>` : '<p class="muted" style="margin:6px 0 0">None.</p>'}
      <div class="row" style="margin-top:14px;font-size:13px;gap:24px">
        <span><strong>Assumptions underneath:</strong> ${rel.assumptions.length ? rel.assumptions.map(b => idChip(b.id)).join(' ') : '<span class="muted">none</span>'}</span>
        <span><strong>Unsourced underneath:</strong> ${rel.unsourced.length ? rel.unsourced.map(b => idChip(b.id)).join(' ') : '<span class="muted">none</span>'}</span>
        <span><strong>Superseded underneath:</strong> ${rel.superseded.length ? rel.superseded.map(b => idChip(b.id)).join(' ') : '<span class="muted">none</span>'}</span>
      </div>
    </section></div>`;
  $$('[data-depth]').forEach(b => b.onclick = () => { UI.depth = +b.dataset.depth === maxStep ? 99 : +b.dataset.depth; render(); });
  $$('[data-lim]').forEach(b => b.onclick = () => { UI.limHL = UI.limHL === b.dataset.lim ? null : b.dataset.lim; render(); });
};
