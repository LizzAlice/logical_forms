'use strict';
/* Section graph, saving, settings, new file. */

// -------------------------------------------------------------------- graph
const GR = { mode: 'auto', expand: [], hide: true, sel: null, lim: null, section: null };

app.graph = async function (main, r) {
  const seq = renderSeq;
  let sid = r.parts[1];
  if (!sid || !section(sid)) sid = currentSection();
  if (GR.section !== sid) { GR.section = sid; GR.mode = 'auto'; GR.expand = []; GR.sel = null; GR.lim = null; }
  if (r.q.lim) { GR.lim = r.q.lim; GR.sel = null; }
  UI.lastSection = sid;
  main.innerHTML = '<div class="page"><p class="muted">Laying out the graph…</p></div>';
  const G = await api(`graph?section=${encodeURIComponent(sid)}&mode=${GR.mode}&expand=${encodeURIComponent(GR.expand.join(','))}&hide=${GR.hide ? 1 : 0}`);
  if (seq !== renderSeq) return;
    if (G.ok === false) { main.innerHTML = `<div class="page"><p class="err">${esc(G.error)}</p></div>`; return; }
  drawGraph(main, G, sid);
};

function drawGraph(main, G, sid) {
  const byId = {}; G.nodes.forEach(n => { byId[n.id] = n; });
  if (GR.sel && !byId[GR.sel]) GR.sel = null;
  const ups = {}, downs = {};
  G.edges.forEach(([a, b]) => { (ups[b] = ups[b] || []).push(a); (downs[a] = downs[a] || []).push(b); });
  const walk = (s, adj) => { const seen = new Set(), todo = [s]; while (todo.length) { const x = todo.pop(); (adj[x] || []).forEach(y => { if (!seen.has(y)) { seen.add(y); todo.push(y); } }); } return seen; };
  const members = n => n.type === 'group' ? G.groups[n.id].results.map(x => x.id) : [n.id];
  const lim = GR.lim ? G.lims.find(l => l.id === GR.lim) : null;
  const aff = new Set(lim ? lim.affects : []), cov = new Set(lim ? lim.covered : []);
  const up = GR.sel && !lim ? walk(GR.sel, ups) : new Set(), down = GR.sel && !lim ? walk(GR.sel, downs) : new Set();
  const cls = n => {
    if (lim) { const m = members(n); return m.some(x => aff.has(x)) ? 'g-aff' : (m.some(x => cov.has(x)) ? 'g-cov' : 'g-dim'); }
    if (GR.sel) return n.id === GR.sel ? 'g-sel' : (up.has(n.id) || down.has(n.id) ? '' : 'g-dim');
    return '';
  };
  const ncls = {}; G.nodes.forEach(n => { ncls[n.id] = cls(n); });
  const edges = G.edges.map(([a, b]) => {
    const s = byId[a], t = byId[b];
    const x1 = s.x + G.NW, y1 = s.y + G.NH / 2, x2 = t.x, y2 = t.y + G.NH / 2, mx = (x1 + x2) / 2;
    let c = 'e';
    if (lim) c += ncls[a] !== 'g-dim' && ncls[b] !== 'g-dim' ? ' e-lim' : ' e-dim';
    else if (GR.sel) {
      const s2 = GR.sel;
      const onUp = (up.has(a) || a === s2) && (up.has(b) || b === s2), onDown = (down.has(a) || a === s2) && (down.has(b) || b === s2);
      c += onUp || onDown ? ' e-hl' : ' e-dim';
    }
    return `<path class="${c}" d="M${x1} ${y1} C${mx} ${y1},${mx} ${y2},${x2} ${y2}"/>`;
  }).join('');
  const short = s => ({ established: 'est', current: 'cur', preliminary: 'pre', unsourced: 'uns', superseded: 'sup', assumed: 'asm' })[s] || s;
  const nodes = G.nodes.map(n => {
    const isG = n.type === 'group';
    const strip = x => x.replace(/^(P|SET|ART|DEF)-/, '');
    const label = isG ? (n.cites.length === 1 ? strip(n.cites[0]) : n.cites.length + ' setups') : strip(n.id);
    return `<button type="button" class="gnode gn-${n.type} ${n.external ? 'gn-ext' : ''} ${ncls[n.id]}" style="left:${n.x}px;top:${n.y}px;width:${G.NW}px" data-n="${esc(n.id)}" aria-pressed="${n.id === GR.sel}"
      title="${esc(isG ? n.count + ' results citing ' + n.cites.join(', ') : n.id + (n.external ? ' (in ' + n.section + ')' : '') + ' — ' + ((G.texts[n.id] || {}).text || ''))}">
      <span class="chip t-${isG ? 'result' : n.type}" style="padding:0 6px;flex:none">${isG ? 'R×' + n.count : (n.type || '?')[0].toUpperCase()}</span>
      <span class="mono ellip" style="flex:1;min-width:0;font-size:11px;font-weight:600">${esc(label)}</span>
      ${isG ? '' : `<span class="chip ${sc(n.status)}" style="padding:0 6px;font-size:10.5px;flex:none">${esc(short(n.status))}</span>`}</button>`;
  }).join('');
  const sn = GR.sel ? byId[GR.sel] : null;
  let panel = '<p class="muted" style="margin:0">Click a box to follow what it rests on and what rests on it.</p>';
  if (lim) panel = `<div class="row">${typeChip('limitation')}<span class="mono" style="font-weight:700">${esc(lim.id)}</span>${statusChip(lim.status)}</div><p style="margin:8px 0 0">${esc(lim.statement)}</p>
      <p class="muted small" style="margin:8px 0 0">Dark red: named in affects. Light red: rests on one of those, so it is covered too. A group is marked when any result in it is. ${lim.n} results and claims in this section are covered.</p>
      <div class="acts"><a class="btn sm" href="#/form/${encodeURIComponent(lim.id)}/edit">Edit the limitation</a><button type="button" class="btn sm" data-clear>Show everything</button></div>`;
  else if (sn && sn.type === 'group') {
    const g = G.groups[sn.id];
    panel = `<div class="row"><span class="chip t-result">${g.results.length} results</span><span class="muted small">all cite</span>${g.cites.map(idChip).join(' ')}</div>
      <p class="muted small" style="margin:8px 0 0">A group holds every result that cites the same pipeline setup. Arrows into it come from what they cite; arrows out go to the claims resting on any result in it.</p>
      <div style="margin-top:8px">${g.results.map(b => `<div class="row small" style="padding:6px 0;border-top:1px solid #F0EEE9;flex-wrap:nowrap;align-items:baseline"><a class="mono" style="flex:0 0 320px;word-break:break-all" href="${formHref(b.id)}">${esc(b.id)}</a><span class="grow">${esc(b.text)}</span></div>`).join('')}</div>
      <div class="acts"><button type="button" class="btn sm primary" data-expand="${esc(sn.id)}">Show these ${g.results.length} as separate boxes</button><button type="button" class="btn sm" data-clear>Show everything</button></div>`;
  } else if (sn) {
    const b = G.texts[sn.id] || {};
    panel = `<div class="row">${typeChip(sn.type)}${statusChip(sn.status)}<span class="mono" style="font-weight:700">${esc(sn.id)}</span>${sn.external ? `<span class="muted small">in ${esc(sn.section)}</span>` : ''}</div>
      <p style="margin:8px 0 0">${esc(b.text || '')}</p>
      <p class="muted small" style="margin:8px 0 0">Rests on ${up.size} here · ${down.size} rest on it here</p>
      <div class="acts"><a class="btn sm" href="#/form/${encodeURIComponent(sn.id)}/edit">Edit</a><a class="btn sm" href="#/form/${encodeURIComponent(sn.id)}/deps">What rests on what</a>
        ${['result', 'claim'].includes(sn.type) ? `<a class="btn sm" href="#/add?section=${encodeURIComponent(sid)}&type=claim&rests_on=${encodeURIComponent(sn.id)}">+ Claim resting on this</a>` : ''}
        ${GR.expand.length && GR.mode !== 'flat' ? '<button type="button" class="btn sm" data-collapse>Group the results again</button>' : ''}<button type="button" class="btn sm" data-clear>Show everything</button></div>`;
  }
  const grouped = G.grouped;
  main.innerHTML = `<div class="page" style="display:flex;flex-direction:column;gap:14px">
    <div class="row" style="justify-content:space-between;align-items:flex-end">
      <div class="grow"><a class="small" href="#/section/${encodeURIComponent(sid)}">← Section view</a><h1>Section graph</h1>
        <p class="muted" style="margin:0">Every form of the section as a box, with an arrow from what a form rests on to the form. ${G.hidden ? G.hidden + ' superseded, resolved or retired forms are hidden. ' : ''}${G.unlinked.length ? G.unlinked.length + ' that nothing links to are listed below.' : ''}
        ${Object.keys(G.groups).length || G.mode === 'grouped' ? `Results start grouped when every result as its own box would need more than ${G.threshold} boxes; this section needs ${G.flat_count}.` : ''}</p></div>
      <div class="row">
        <label class="row small" style="gap:6px">Section <select class="inp" id="gsec" style="width:auto;padding:6px 8px">${S.model.sections.map(s => `<option value="${esc(s.id)}" ${s.id === sid ? 'selected' : ''}>${esc(s.id)} · ${s.forms.length}</option>`).join('')}</select></label>
        <span class="small" style="font-weight:600">Results</span>
        <div class="seg"><button type="button" data-mode="grouped" class="${grouped ? 'on' : ''}">Grouped by pipeline setup</button><button type="button" data-mode="flat" class="${grouped ? '' : 'on'}">Every result its own box</button></div>
        <label class="row small" style="gap:6px"><input type="checkbox" id="ghide" ${GR.hide ? 'checked' : ''}> Hide superseded and resolved</label>
      </div></div>
    ${G.nodes.length ? `<div class="gbox" role="region" aria-label="Graph of ${esc(sid)}"><div style="position:relative;width:${G.W}px;height:${G.H}px">
      ${G.heads.map(h => `<span class="gh" style="left:${h.x}px">${esc(h.label)}</span>`).join('')}
      <svg aria-hidden="true" width="${G.W}" height="${G.H}" style="position:absolute;left:0;top:0">${edges}</svg>${nodes}</div></div>`
      : '<div class="panel"><p class="muted" style="margin:0">No form in this section rests on another, so there is nothing to draw.</p></div>'}
    ${G.unlinked.length ? `<div class="row small muted" style="gap:6px">Not linked to anything here: ${G.unlinked.map(b => idChip(b.id)).join(' ')}</div>` : ''}
    ${G.external.length ? `<p class="small muted" style="margin:0">Dashed boxes are in other sections: ${G.external.map(idChip).join(' ')}</p>` : ''}
    <div class="cols"><section class="panel" style="flex:3 1 520px;min-width:0">${panel}</section>
      <section class="panel" style="flex:2 1 340px;min-width:0"><h2 style="margin-bottom:10px">Limitations reaching this section</h2>
        ${G.lims.length ? G.lims.map(l => `<button type="button" class="limbtn ${GR.lim === l.id ? 'on' : ''}" data-glim="${esc(l.id)}" style="width:100%;max-width:none;margin-bottom:6px"><span class="mono" style="font-weight:600;font-size:12px;color:#8C2617">${esc(l.id)}</span><span class="muted small">covers ${l.n} results and claims here</span></button>`).join('') : '<p class="muted small">None.</p>'}</section></div>
  </div>`;
  $$('[data-n]').forEach(b => b.onclick = () => { GR.sel = b.dataset.n; GR.lim = null; drawGraph(main, G, sid); });
  $$('[data-glim]').forEach(b => b.onclick = () => { GR.lim = GR.lim === b.dataset.glim ? null : b.dataset.glim; GR.sel = null; drawGraph(main, G, sid); });
  $$('[data-clear]').forEach(b => b.onclick = () => { GR.sel = null; GR.lim = null; drawGraph(main, G, sid); });
  $$('[data-mode]').forEach(b => b.onclick = () => { GR.mode = b.dataset.mode; GR.expand = []; GR.sel = null; render(); });
  $$('[data-expand]').forEach(b => b.onclick = () => { GR.expand.push(b.dataset.expand); GR.mode = 'grouped'; GR.sel = null; render(); });
  $$('[data-collapse]').forEach(b => b.onclick = () => { GR.expand = []; GR.sel = null; render(); });
  $('#gsec').onchange = e => go('#/graph/' + encodeURIComponent(e.target.value));
  $('#ghide').onchange = e => { GR.hide = e.target.checked; render(); };
}

// -------------------------------------------------------------------- save
app.saveDialog = async function () {
  const P = await api('save/preview');
    if (P.ok === false) return toast(P.error, true);
  const fd = f => f.added !== undefined ? (f.added.map(x => `<span class="diffadd mono">+ ${esc(typeof x === 'object' ? JSON.stringify(x) : x)}</span>`).join(' ') + ' ' + f.removed.map(x => `<span class="diffdel mono">− ${esc(typeof x === 'object' ? JSON.stringify(x) : x)}</span>`).join(' '))
    : f.sub ? f.sub.map(s => `<span class="key">${esc(s.field)}</span>`).join(', ') + ' changed'
    : `${esc(String(f.old || '∅')).slice(0, 80)} → ${esc(String(f.new || '∅')).slice(0, 80)}`;
  const kinds = { added: 's-ok', edited: 's-warn', moved: 's-warn', removed: 's-bad', 'section added': 's-ok', 'section edited': 's-warn', 'registry edited': 's-warn' };
  const changes = P.changes.map(c => `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-top:1px solid #F0EEE9">
      <span class="chip ${kinds[c.kind] || 's-off'}" style="flex:none">${esc(c.kind)}</span>
      <div class="small grow"><span class="mono" style="font-weight:600">${esc(c.id)}</span> ${c.type && !['section', 'registry'].includes(c.type) ? `<span class="muted">${esc(c.type)} in ${esc(c.section)}${c.from ? ' (from ' + esc(c.from) + ')' : ''}</span>` : ''}
        ${c.fields.length ? `<div style="margin-top:4px;display:flex;flex-direction:column;gap:3px">${c.fields.map(f => `<div><span class="key">${esc(f.field)}</span> ${fd(f)}</div>`).join('')}</div>` : ''}</div></div>`).join('');
  const diff = esc(P.diff).split('\n').map(l => l.startsWith('+') ? `<span class="a">${l}</span>` : l.startsWith('-') ? `<span class="d">${l}</span>` : l.startsWith('@@') ? `<span class="h">${l}</span>` : l).join('\n');
  const m = modal(`<div class="row" style="justify-content:space-between"><h2 style="font-size:20px">Save as a new file</h2><button class="xbtn" data-close aria-label="Close">×</button></div>
    <p class="muted" style="margin:4px 0 0"><span class="mono" style="color:var(--ink)">${esc(P.opened)}</span> is not written to. The changes go into a new file in the same folder.</p>
    <label class="flabel" for="sname" style="display:block;margin-top:16px">NEW FILE</label>
    <input id="sname" class="inp mono" value="${esc(P.default_name)}" style="margin-top:6px">
    <p class="muted small" style="margin:6px 0 0;word-break:break-all">${esc(P.folder)}. If a file of that name exists, you are asked for another name; nothing is replaced.</p>
    <h3>Changes <span class="muted" style="font-weight:500">${P.changes.length}</span></h3>
    <div style="border:1px solid var(--line);border-radius:10px;max-height:34vh;overflow:auto">${changes || '<p class="muted" style="padding:10px">No changes.</p>'}</div>
    <button class="btn sm" type="button" id="dtoggle" style="margin-top:10px">Show as YAML diff</button>
    <pre class="diff hidden" id="dpre">${diff}</pre>
    <h3>Checks on the new file</h3>
    <ul class="small" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px">
      <li>${P.read_back.length ? `<span class="req">!</span> It does not read back the same: ${esc(P.read_back.join('; '))}. Saving is blocked.` : '<span class="ok">✓</span> It reads back the same as what is open in the editor.'}</li>
      <li>${P.n_problems ? `<span class="req">!</span> ${P.n_problems} rule problem${P.n_problems > 1 ? 's' : ''}. You can still save; see Checks.` : '<span class="ok">✓</span> All file rules pass.'}</li></ul>
    <p class="fbox small" style="background:var(--accent-bg)">After writing, the editor reads the new file back and compares it with what is open. Only when both match does it switch to the new file. Forms you did not touch stay line for line as they were, comments and blank lines included.</p>
    <div id="serr"></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="sgo" ${P.read_back.length ? 'disabled' : ''}>Save new file</button></div>`, { wide: true });
  $('#dtoggle', m).onclick = () => { const p = $('#dpre', m); p.classList.toggle('hidden'); $('#dtoggle', m).textContent = p.classList.contains('hidden') ? 'Show as YAML diff' : 'Hide YAML diff'; };
  $('#sgo', m).onclick = async () => {
    const res = await api('save', { name: $('#sname', m).value });
        if (res.ok === false) { $('#serr', m).innerHTML = `<p class="err">${esc(res.error)}</p>`; return; }
    S = res.state; rebuild(); closeModal(); render();
    toast(`Saved as ${S.name}. You are now working on it; the next save writes another new file.`);
  };
};

// -------------------------------------------------------------------- settings
app.settingsDialog = function () {
  const m = modal(`<div class="row" style="justify-content:space-between"><h2 style="font-size:19px">Settings</h2><button class="xbtn" data-close aria-label="Close">×</button></div>
    <label class="tcard" style="flex-direction:row;gap:12px;cursor:pointer;margin-top:12px"><input type="checkbox" id="stfrozen" ${S.settings.frozen ? 'checked' : ''} style="margin-top:3px">
      <span><strong>Protect frozen fields (M4)</strong><br><span class="small muted">On: editing a frozen field of a result, setup or artifact asks whether it is a new version or a recording error. Switch it off for the session while you bring the file up to date after a change to the spec. Ids stay permanent either way.</span></span></label>
    <label class="flabel" for="stth" style="display:block;margin-top:12px">Group results in the section graph when it would need more than this many boxes</label>
    <input id="stth" class="inp" type="number" min="5" value="${S.settings.threshold}" style="max-width:140px;margin-top:6px">
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="button" id="stsave">Apply</button></div>`);
  $('#stsave', m).onclick = async () => { closeModal(); await act('settings', { frozen: $('#stfrozen').checked, threshold: +$('#stth').value || 50 }, 'Settings applied.'); };
};

// -------------------------------------------------------------------- new file
app.newFile = function (main) {
  const keys = Object.keys(S.schema.standard_keys).map(k => [k, S.schema.standard_keys[k], false]);
  const own = [];
  const st = { folder: S.folder || '', name: 'forms.yaml', sid: '', title: '', about: '' };
  const draw = () => {
    const chosen = keys.filter(k => k[2]).map(k => [k[0], k[1]]).concat(own.filter(o => o[0].trim()));
    const yaml = ['spec: v1', chosen.length ? 'component_keys:' : 'component_keys: {}'].concat(chosen.map(([k, v]) => `  ${k}: "${v}"`))
      .concat(['', 'sections:', `  - id: SEC-${st.sid || '…'}`, '    type: section', `    title: "${st.title || '…'}"`, `    about: "${st.about || '…'}"`, '    links: []', '    status: drafting', `    updated: ${S.today}`, '    forms: []']).join('\n');
    const miss = [!st.folder.trim() && 'a folder', !st.name.trim() && 'a file name', !st.sid.trim() && 'a section id', !st.title.trim() && 'a section title', !st.about.trim() && 'what belongs in the section',
      own.some(o => o[0].trim() && !o[1].trim()) && 'a description for each key of your own'].filter(Boolean);
    main.innerHTML = `<div class="page"><a class="small" href="#/start">← Start</a><h1>New forms file</h1><p class="muted" style="margin:0">Three things to set up. Everything else is added from the section view afterwards.</p>
      <div class="cols" style="margin-top:16px">
        <div style="flex:3 1 560px;min-width:0;display:flex;flex-direction:column;gap:16px">
          <section class="panel"><h2>1 · Where the file goes</h2><div class="row" style="margin-top:10px;align-items:flex-end">
            <div style="flex:2 1 300px"><label class="flabel" for="nf_folder">Folder</label><div class="row" style="flex-wrap:nowrap;margin-top:6px"><input id="nf_folder" class="inp mono" value="${esc(st.folder)}"><button class="btn" type="button" id="nf_browse">Browse…</button></div></div>
            <div style="flex:1 1 200px"><label class="flabel" for="nf_name">File name</label><input id="nf_name" class="inp mono" value="${esc(st.name)}" style="margin-top:6px"></div></div>
            <p class="muted small" style="margin:8px 0 0">If the file exists already, you are asked for another name.</p></section>
          <section class="panel"><h2>2 · Component keys for your setups</h2><p class="muted small" style="margin:4px 0 8px">The standard list from §4.8. Tick the ones you expect to use; you can add more later under Component keys.</p>
            ${keys.map((k, i) => `<label class="row" style="padding:6px;border-top:1px solid #F0EEE9;align-items:flex-start;flex-wrap:nowrap;cursor:pointer"><input type="checkbox" data-key="${i}" ${k[2] ? 'checked' : ''} style="margin-top:3px"><span class="mono" style="font-weight:600;flex:0 0 100px">${esc(k[0])}</span><span class="muted small">${esc(k[1])}</span></label>`).join('')}
            <div class="fbox"><div class="flabel">Keys of your own</div><p class="muted small" style="margin:2px 0 8px">Only when no standard key fits. Say how it differs from the nearest standard key.</p>
              ${own.map((o, i) => `<div class="kvrow"><input class="inp mono" data-ok="${i}" value="${esc(o[0])}" placeholder="key" style="flex:0 0 140px"><input class="inp" data-od="${i}" value="${esc(o[1])}" placeholder="what belongs in this slot, and how it differs from …"><button class="xbtn" type="button" data-orm="${i}" aria-label="Remove">×</button></div>`).join('')}
              <button class="btn sm" type="button" id="nf_own">+ A key of your own</button></div></section>
          <section class="panel"><h2>3 · Your first section</h2>
            <label class="flabel" for="nf_sid" style="display:block;margin-top:10px">Id</label><div class="row" style="gap:0;border:1px solid var(--line2);border-radius:8px;overflow:hidden;flex-wrap:nowrap;margin-top:6px"><span class="mono" style="padding:9px 4px 9px 11px;background:var(--bg);font-weight:600">SEC-</span><input id="nf_sid" class="mono" style="border:0;outline:0;flex:1;padding:9px 8px" value="${esc(st.sid)}" placeholder="short-topic-name"></div>
            <label class="flabel" for="nf_title" style="display:block;margin-top:10px">Title</label><input id="nf_title" class="inp" value="${esc(st.title)}" placeholder="a working label, not a heading" style="margin-top:6px">
            <label class="flabel" for="nf_about" style="display:block;margin-top:10px">What belongs in here</label><input id="nf_about" class="inp" value="${esc(st.about)}" placeholder="one sentence" style="margin-top:6px"></section>
          ${miss.length ? `<p class="need">Still needed: ${esc(miss.join(', '))}.</p>` : ''}<div id="nf_err"></div>
          <div class="row" style="justify-content:flex-end"><a class="btn" href="#/start">Cancel</a><button class="btn primary" type="button" id="nf_go" ${miss.length ? 'disabled' : ''}>Create file and open it</button></div>
        </div>
        <aside style="flex:2 1 380px;min-width:0"><div class="panel" style="padding:0;overflow:hidden"><div class="row" style="justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line)"><strong class="small">The file it will write</strong><span class="mono muted">${esc(st.name)}</span></div>
          <pre class="diff" style="margin:0;border-radius:0;max-height:none;white-space:pre-wrap">${esc(yaml)}</pre></div></aside>
      </div></div>`;
    const keep = (sel, k) => { const el = $(sel); el.oninput = () => { st[k] = el.value; const p = el.selectionStart; draw(); const n = $(sel); n.focus(); n.setSelectionRange(p, p); }; };
    keep('#nf_folder', 'folder'); keep('#nf_name', 'name'); keep('#nf_sid', 'sid'); keep('#nf_title', 'title'); keep('#nf_about', 'about');
    $$('[data-key]').forEach(c => c.onchange = () => { keys[+c.dataset.key][2] = c.checked; draw(); });
    $$('[data-ok]').forEach(i => i.oninput = () => { own[+i.dataset.ok][0] = i.value; });
    $$('[data-od]').forEach(i => i.oninput = () => { own[+i.dataset.od][1] = i.value; });
    $$('[data-ok],[data-od]').forEach(i => i.onchange = draw);
    $$('[data-orm]').forEach(b => b.onclick = () => { own.splice(+b.dataset.orm, 1); draw(); });
    $('#nf_own').onclick = () => { own.push(['', '']); draw(); };
    $('#nf_browse').onclick = () => fileBrowser(st.folder, true, p => { st.folder = p; draw(); });
    $('#nf_go').onclick = async () => {
      const res = await api('newfile', { folder: st.folder, name: st.name, keys: chosen, section: { id: 'SEC-' + st.sid.trim(), title: st.title, about: st.about } });
            if (res.ok === false) { $('#nf_err').innerHTML = `<p class="err">${esc(res.error)}</p>`; return; }
      S = res.state; rebuild(); go('#/section/' + encodeURIComponent(S.model.sections[0].id)); toast('Created ' + S.name + '.');
    };
  };
  draw();
};
