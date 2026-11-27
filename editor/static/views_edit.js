'use strict';
/* Editing a form, adding one, new versions of setups and artifacts, sections, component keys. */

function diffList(orig, d) {
  const keys = Array.from(new Set(Object.keys(orig).concat(Object.keys(d)))).filter(k => k !== 'updated');
  const norm = v => JSON.stringify(v == null ? '' : (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : v));
  const out = [];
  keys.forEach(k => {
    const a = orig[k], b = d[k];
    if (norm(a) === norm(b) || (asList(a).length === 0 && asList(b).length === 0 && typeof a !== 'object' && !a && !b)) return;
    if (Array.isArray(a) || Array.isArray(b)) {
      const A = asList(a), B = asList(b);
      B.filter(x => !A.includes(x)).forEach(x => out.push(`<div><span class="key">${esc(k)}</span><div class="diffadd mono">+ ${esc(typeof x === 'object' ? JSON.stringify(x) : x)}</div></div>`));
      A.filter(x => !B.includes(x)).forEach(x => out.push(`<div><span class="key">${esc(k)}</span><div class="diffdel mono">− ${esc(typeof x === 'object' ? JSON.stringify(x) : x)}</div></div>`));
      if (!out.length) out.push(`<div><span class="key">${esc(k)}</span> order changed</div>`);
    } else {
      out.push(`<div><span class="key">${esc(k)}</span>${a ? `<div class="diffdel">${esc(typeof a === 'object' ? JSON.stringify(a) : a)}</div>` : ''}${b ? `<div class="diffadd">${esc(typeof b === 'object' ? JSON.stringify(b) : b)}</div>` : '<div class="muted small">(emptied)</div>'}</div>`);
    }
  });
  return out;
}

// -------------------------------------------------------------------- edit
app.edit = async function (main, id) {
  const seq = renderSeq;
  if (!FM[id]) { main.innerHTML = `<div class="page"><p class="err">There is no form ${esc(id)}.</p></div>`; return; }
  const orig = clone(FM[id].f);
  const d = clone(orig);
  let sec = FM[id].sec;
  const rel = await api('relations?id=' + encodeURIComponent(id));
  if (seq !== renderSeq) return;
    const frozen = frozenFields(orig);
  const isNew = S.new_ids.includes(id);
  main.innerHTML = `<div class="page cols">
    <form class="panel" style="flex:3 1 560px;min-width:0;padding:22px 26px" onsubmit="return false">
      <a class="small" href="${formHref(id)}">← ${esc(sec)}</a>
      <div class="row" style="justify-content:space-between;margin-top:6px"><h1 style="margin:0">Edit ${esc(orig.type)}</h1>
        <div class="row">${S.schema.retype.some(x => x.from === orig.type && (!x.from_status || x.from_status === orig.status)) ? '<button class="btn" type="button" id="retype">Change type…</button>' : ''}
        ${['setup', 'artifact'].includes(orig.type) && orig.status === 'current' ? `<a class="btn" href="#/newversion/${encodeURIComponent(id)}">New version…</a>` : ''}</div></div>
      <div class="field" style="border-top:0">
        <label class="lab" for="eid">Id <span class="key">id</span></label>
        <input id="eid" class="inp mono" value="${esc(id)}" readonly><p class="help">Ids are permanent (M1), so there is no rename.</p></div>
      <div class="field"><label class="lab" for="esec">Filed in section</label>
        <select id="esec" class="inp">${S.model.sections.map(s => `<option value="${esc(s.id)}" ${s.id === sec ? 'selected' : ''}>${esc(s.id)} · ${esc(s.title || '')}</option>`).join('')}</select>
        <p class="help">Moving a form only changes where it is filed; nothing that points at it changes.</p></div>
      ${frozen.length ? `<p class="need">This ${esc(orig.type)} has frozen fields (M4): ${frozen.join(', ')}. ${orig.type === 'result' ? 'A new run gets a new result.' : 'A changed configuration gets a new version.'} If the form never matched what ran, you can still correct it; you will be asked what you corrected.</p>` : ''}
      <div id="efields"></div>
      <div id="eneed"></div>
      <div class="row" style="justify-content:flex-end;padding-top:14px;border-top:1px solid #EDEBE6">
        ${isNew ? '<button class="btn danger" type="button" id="discard">Discard this new form</button>' : ''}
        <a class="btn" href="${formHref(id)}">Cancel</a><button class="btn primary" type="button" id="apply">Apply changes</button></div>
    </form>
    <aside style="flex:2 1 340px;min-width:0;display:flex;flex-direction:column;gap:14px">
      <section class="panel"><h2 style="margin-bottom:8px">Checks on this form</h2><div id="echecks"></div></section>
      <section class="panel"><h2 style="margin-bottom:8px">Changes in this form</h2><div id="ediff"></div><p class="muted small" style="margin:10px 0 0">Applied changes stay in the editor until you save them to a new file.</p></section>
      <section class="panel"><h2 style="margin-bottom:8px">What else this touches</h2><ul style="margin:0;padding-left:18px" class="small">
        <li>${(rel.rested_on_by || []).length ? `${rel.rested_on_by.length} form${rel.rested_on_by.length > 1 ? 's rest' : ' rests'} on it directly. Claims resting on it go on the revisit list once you change it (M3).` : 'Nothing rests on it.'}</li>
        <li>Its section will hold a form newer than its own date and shows as stale until you confirm it (invariant 9).</li>
        ${orig.type === 'claim' || orig.type === 'result' ? '<li>A text written before today that cites it counts as stale when checked (§7).</li>' : ''}</ul></section>
    </aside></div>`;
  const update = () => {
    const miss = missingFor(d);
    $('#eneed').innerHTML = miss.length ? `<p class="need">Still needed: ${esc(miss.join(', '))}.</p>` : '';
    $('#apply').disabled = miss.length > 0;
    const checks = [];
    if (d.type === 'claim' && rel.ceiling) {
      const sup = asList(d.derived_from).filter(x => FM[x]);
      const done = sup.filter(x => DONE.includes(FM[x].f.status));
      const weak = sup.filter(x => ['preliminary', 'assumed', 'unsourced', 'open', 'planned'].includes(FM[x].f.status));
      const ceil = done.length ? 'revisit' : (weak.length ? 'preliminary' : 'established');
      const ok = ceil === 'established' || (ceil === 'preliminary' && d.status !== 'established') || ['refuted', 'outdated'].includes(d.status);
      checks.push(`<li><span class="${ok ? 'ok' : 'req'}">${ok ? '✓' : '!'}</span> Status no stronger than its weakest support (12). Ceiling: <strong>${ceil}</strong>${weak.length ? ' because of ' + weak.map(esc).join(', ') : ''}${done.length ? ' because ' + done.map(esc).join(', ') + ' is no longer in force' : ''}.</li>`);
      if (/\b(and|because|than)\b/i.test(d.statement || '')) checks.push('<li><span class="req">?</span> The statement has “and”, “because” or a comparison: is it two forms (§1)?</li>');
    }
    const refs = [].concat(...['derived_from', 'evidence', 'affects', 'resolved_by', 'replaced_by', 'answered_by', 'includes', 'part_of', 'follows', 'uses'].map(k => asList(d[k])));
    const bad = refs.filter(x => isId(x) && !FM[x]);
    checks.push(`<li><span class="${bad.length ? 'req' : 'ok'}">${bad.length ? '!' : '✓'}</span> Every id it names exists (2)${bad.length ? ': not found ' + bad.map(esc).join(', ') : ''}.</li>`);
    checks.push(miss.length ? `<li><span class="req">!</span> Required fields still empty: ${esc(miss.join(', '))}.</li>` : '<li><span class="ok">✓</span> Required fields filled.</li>');
    if (d.replaced_by && asList(d.replaced_by).length && !['refuted', 'outdated'].includes(d.status)) checks.push('<li><span class="req">!</span> replaced_by only on a refuted or outdated form (22).</li>');
    $('#echecks').innerHTML = `<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px" class="small">${checks.join('')}</ul>`;
    const dl = diffList(orig, d);
    if (sec !== FM[id].sec) dl.unshift(`<div><span class="key">section</span> ${esc(FM[id].sec)} → ${esc(sec)}</div>`);
    $('#ediff').innerHTML = dl.length ? `<div style="display:flex;flex-direction:column;gap:8px;font-size:13px">${dl.join('')}</div>` : '<p class="muted small" style="margin:0">No changes yet.</p>';
  };
  renderFields($('#efields'), d, { frozen, orig, onChange: update });
  $('#esec').onchange = e => { sec = e.target.value; update(); };
  update();
  if ($('#retype')) $('#retype').onclick = () => retypeDialog(id);
  if ($('#discard')) $('#discard').onclick = async () => { const r = await act('form/discard', { id }, `Discarded ${id}.`); if (r.ok) go('#/section/' + encodeURIComponent(sec)); };
  $('#apply').onclick = async () => {
    const r = await api('form/update', { id, form: d, section: sec });
        if (r.ok === false && r.frozen && r.frozen.length) return frozenDialog(id, d, sec, r.frozen);
    if (r.ok === false) { $('#eneed').innerHTML = `<p class="err">${esc(r.error)}</p>`; return; }
    S = r.state; rebuild();
    go(`#/section/${encodeURIComponent(sec)}?sel=${encodeURIComponent(id)}`);
    toast(`Changed ${id}.`, false, { label: 'Undo', run: undo });
  };
};

function frozenDialog(id, d, sec, fields) {
  const f = FM[id].f;
  const isRes = f.type === 'result';
  const m = modal(`<div class="row" style="justify-content:space-between"><h2 style="font-size:19px">Frozen fields (M4)</h2><button class="xbtn" data-close aria-label="Close">×</button></div>
    <p style="margin:8px 0 0">${esc(id)} is ${esc(f.status)} and these fields say what results were produced with: <strong>${fields.map(esc).join(', ')}</strong>. Editing them in place would make older results quietly report something else.</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
      ${isRes ? `<a class="tcard" href="#/add?type=result&section=${encodeURIComponent(sec)}&copy=${encodeURIComponent(id)}" data-close><strong>A new run or a changed configuration</strong><span class="small muted">Write a new result. This one stays as it is.</span></a>`
        : `<a class="tcard" href="#/newversion/${encodeURIComponent(id)}" data-close><strong>The ${f.type === 'setup' ? 'configuration' : 'file'} changed</strong><span class="small muted">Write a new version with the helper. Old results keep pointing at this one.</span></a>`}
      <div class="tcard" style="cursor:default"><strong>It was recorded wrongly</strong><span class="small muted">The form never matched what ran or what the file is. Correct it in place; the note records what you corrected and when.</span>
        <label class="flabel" for="corr" style="margin-top:8px">What you corrected (required)</label><textarea id="corr" class="inp" style="min-height:56px"></textarea>
        <div class="row" style="justify-content:flex-end;margin-top:8px;width:100%"><button class="btn primary" type="button" id="corrBtn" disabled>Correct in place</button></div><div id="corrErr" style="width:100%"></div></div>
    </div>
    <p class="muted small" style="margin:12px 0 0">While you bring the file up to date after a change to the spec, you can switch the protection off in Settings.</p>`);
  const ta = $('#corr', m), b = $('#corrBtn', m);
  ta.oninput = () => { b.disabled = !ta.value.trim(); };
  b.onclick = async () => {
    const r = await api('form/update', { id, form: d, section: sec, mode: 'recording_error', note: ta.value });
        if (r.ok === false) { $('#corrErr', m).innerHTML = `<p class="err">${esc(r.error)}</p>`; return; }
    S = r.state; rebuild(); closeModal();
    go(`#/section/${encodeURIComponent(sec)}?sel=${encodeURIComponent(id)}`);
    toast(`Corrected ${id}; the note says what and when.`, false, { label: 'Undo', run: undo });
  };
}

// -------------------------------------------------------------------- add
app.add = function (main, r) {
  const q = r.q;
  let sec = q.section && section(q.section) ? q.section : currentSection();
  let type = q.type || (q.rests_on ? 'claim' : 'claim');
  const drafts = {};
  const draftFor = t => {
    if (!drafts[t]) {
      const extra = {};
      if (t === 'claim' && q.rests_on) extra.derived_from = [q.rests_on];
      if (q.copy && FM[q.copy] && FM[q.copy].f.type === t) { const c = clone(FM[q.copy].f); delete c.id; delete c.updated; delete c.replaced_by; Object.assign(extra, c); }
      drafts[t] = newDraft(t, extra);
    }
    return drafts[t];
  };
  const draw = () => {
    const d = draftFor(type);
    main.innerHTML = `<div class="page">
      <a class="small" href="#/section/${encodeURIComponent(sec)}">← ${esc(sec)}</a><h1>Add a form</h1>
      <div class="cols" style="margin-top:12px">
        <section style="flex:2 1 360px;min-width:0" aria-label="Choose a type"><h2 style="margin-bottom:10px">What are you writing down?</h2>
          ${S.schema.types.map(t => `<button type="button" class="tcard ${t === type ? 'on' : ''}" data-type="${t}"><span class="row" style="gap:8px">${typeChip(t)}<span class="mono muted small">${esc(S.schema.prefix[t])}</span></span><span class="small">${esc(S.schema.when[t])}</span></button>`).join('')}
          <div class="panel" style="margin-top:6px"><h3 style="margin-top:0">Not sure which?</h3>${S.schema.pairs.map(([a, b]) => `<p class="small" style="margin:8px 0 0"><strong>${esc(a)}</strong> ${esc(b)}</p>`).join('')}</div>
        </section>
        <form class="panel" style="flex:3 1 520px;min-width:0" onsubmit="return false" aria-label="New form">
          <div class="row"><h2 style="font-size:18px">New ${esc(type)}</h2>${typeChip(type)}</div>
          ${q.rests_on && type === 'claim' ? `<p class="fbox small">Started from <span class="mono">${esc(q.rests_on)}</span>, so it is already filled in under Rests on.</p>` : ''}
          ${q.copy && FM[q.copy] && FM[q.copy].f.type === type ? `<p class="fbox small">Filled in from <span class="mono">${esc(q.copy)}</span>. Change what differs for the new run; the old form stays as it is.</p>` : ''}
          <div class="row" style="margin-top:12px;align-items:flex-start">
            <div style="flex:1 1 220px"><label class="flabel" for="asec">Section</label><select class="inp" id="asec">${S.model.sections.map(s => `<option value="${esc(s.id)}" ${s.id === sec ? 'selected' : ''}>${esc(s.id)}</option>`).join('')}</select></div>
            <div style="flex:1 1 240px"><label class="flabel" for="aid">Id <span class="req">*</span></label>
              <div class="row" style="gap:0;border:1px solid var(--line2);border-radius:8px;overflow:hidden;flex-wrap:nowrap"><span class="mono" style="padding:9px 4px 9px 11px;background:var(--bg);font-weight:600">${esc(S.schema.prefix[type])}</span>
              <input id="aid" class="mono" style="border:0;outline:0;flex:1;min-width:0;padding:9px 8px" placeholder="short-mnemonic-name" value="${esc((d.id || '').slice(S.schema.prefix[type].length))}" autocomplete="off"></div></div>
          </div>
          <p class="help" style="margin-top:6px">The prefix comes from the type. Once added, the id never changes (M1). It goes after the last ${esc(type)} in the section.</p>
          <div id="afields"></div><div id="aneed"></div>
          <div class="row" style="justify-content:flex-end;margin-top:14px"><a class="btn" href="#/section/${encodeURIComponent(sec)}">Cancel</a>
            <button class="btn" type="button" id="addMore">Add and start another</button><button class="btn primary" type="button" id="addBtn">Add ${esc(type)}</button></div>
        </form></div></div>`;
    const update = () => {
      const idv = $('#aid').value.trim();
      d.id = S.schema.prefix[type] + idv;
      const miss = (idv ? [] : ['an id']).concat(missingFor(d));
      const taken = idv && (FM[d.id] || S.model.sections.some(s => s.id === d.id));
      $('#aneed').innerHTML = taken ? `<p class="err">The id ${esc(d.id)} is taken. Ids are never reused (M1).</p>` : (miss.length ? `<p class="need">Still needed before it can be added: ${esc(miss.join(', '))}.</p>` : '');
      $('#addBtn').disabled = $('#addMore').disabled = !!(miss.length || taken);
    };
    renderFields($('#afields'), d, { onChange: update, orig: {} });
    $('#aid').addEventListener('input', update);
    $('#asec').onchange = e => { sec = e.target.value; };
    $$('[data-type]').forEach(b => b.onclick = () => { type = b.dataset.type; draw(); });
    const submit = async more => {
      update();
      if ($('#addBtn').disabled) return;
      const res = await api('form/create', { form: d, section: sec });
            if (res.ok === false) { $('#aneed').innerHTML = `<p class="err">${esc(res.error)}</p>`; return; }
      S = res.state; rebuild();
      toast(`Added ${res.id} to ${sec}.`, false, { label: 'Undo', run: undo });
      if (more) { delete drafts[type]; draw(); }
      else go(`#/section/${encodeURIComponent(sec)}?sel=${encodeURIComponent(res.id)}`);
    };
    $('#addBtn').onclick = () => submit(false);
    $('#addMore').onclick = () => submit(true);
    update();
  };
  draw();
};

// -------------------------------------------------------------------- new version
app.newVersion = async function (main, id, r) {
  const seq = renderSeq;
  if (!FM[id]) { main.innerHTML = `<div class="page"><p class="err">There is no form ${esc(id)}.</p></div>`; return; }
  const plan = await api('newversion?id=' + encodeURIComponent(id));
  if (seq !== renderSeq) return;
    if (plan.ok === false) { main.innerHTML = `<div class="page"><p class="err">${esc(plan.error)}</p></div>`; return; }
  const f = FM[id].f;
  main.innerHTML = `<div class="page" style="max-width:1180px">
    <a class="small" href="${formHref(id)}">← ${esc(FM[id].sec)}</a>
    <h1>New version of <span class="mono" style="font-size:20px">${esc(id)}</span></h1>
    <p class="muted" style="margin:0">${r.q.from ? `<span class="mono">${esc(r.q.from)}</span> was superseded, and ${esc(id)} still names it. ` : ''}${plan.n_results} result${plan.n_results === 1 ? '' : 's'} rest on what changes here. They keep pointing at the old forms, which is what they were produced with (M4).</p>
    <div style="display:flex;flex-direction:column;gap:14px;margin-top:18px">
      <section class="panel"><h2>1 · The new ${esc(f.type)}</h2>
        <div class="row" style="margin-top:10px;flex-wrap:nowrap"><span class="mono muted">${esc(id)} →</span><input class="inp mono" id="nv_new" value="${esc(plan.new_id)}" style="max-width:420px"><span class="muted small">a copy; you edit what changed next</span></div></section>
      <section class="panel"><h2>2 · Pipeline setups copied with the id swapped <span class="muted" style="font-weight:500">${plan.copies.length}</span></h2>
        <p class="muted small" style="margin:6px 0 4px">Every current setup that names a replaced one in includes or components gets a copy, until none is left (§4.8).</p>
        ${plan.copies.length ? plan.copies.map((c, i) => `<div class="row" style="padding:8px 0;border-top:1px solid #F0EEE9"><span class="mono" style="flex:1 1 300px">${esc(c.old)} →</span><input class="inp mono" data-copy="${esc(c.old)}" value="${esc(c.new)}" style="flex:1 1 260px;padding:6px 8px"><span class="muted small" style="flex:1 1 200px">names <span class="mono">${esc(c.because)}</span></span></div>`).join('') : '<p class="muted small">None.</p>'}</section>
      <div class="cols">
        <section class="panel" style="flex:1 1 340px"><h2>3 · Set to superseded <span class="muted" style="font-weight:500">${plan.superseded.length}</span></h2><p class="mono small" style="line-height:1.8">${plan.superseded.map(esc).join('<br>')}</p></section>
        <section class="panel" style="flex:1 1 340px"><h2>4 · Re-pointed in place <span class="muted" style="font-weight:500">${plan.repoint.length}</span></h2><p class="muted small" style="margin:6px 0">Pipeline-order fields describe the pipeline as it is now (§4.8).</p>
          ${plan.repoint.map(p => `<div class="row small" style="padding:4px 0"><span class="mono">${esc(p.id)}</span><span class="muted">${esc(p.field)}</span></div>`).join('') || '<p class="muted small">None.</p>'}</section>
      </div>
      <section class="panel" style="background:var(--warn-bg);border-color:var(--warn-line)"><h2>Left as they are</h2>
        <ul class="small" style="margin:8px 0 0;padding-left:18px"><li>The ${plan.n_results} results keep citing the old forms.</li>
        <li>${plan.claims.length} claim${plan.claims.length === 1 ? '' : 's'} rest on them and go on the revisit list (M3)${plan.claims.length ? ': ' + plan.claims.slice(0, 6).map(esc).join(', ') + (plan.claims.length > 6 ? ' and ' + (plan.claims.length - 6) + ' more' : '') : ''}.</li></ul></section>
    </div>
    <div id="nv_err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:18px"><a class="btn" href="${formHref(id)}">Cancel</a><button class="btn primary" type="button" id="nv_go">Write ${1 + plan.copies.length} new forms and update ${plan.superseded.length + plan.repoint.length}, then edit the new ${esc(f.type)}</button></div>
  </div>`;
  $('#nv_go').onclick = async () => {
    const copies = {};
    $$('[data-copy]').forEach(i => { copies[i.dataset.copy] = i.value.trim(); });
    const newId = $('#nv_new').value.trim();
    const res = await api('newversion', { id, new_id: newId, copies });
        if (res.ok === false) { $('#nv_err').innerHTML = `<p class="err">${esc(res.error)}</p>`; return; }
    S = res.state; rebuild();
    toast(`Wrote ${Object.keys(res.rename).length} new forms.`, false, { label: 'Undo', run: undo });
    go(`#/form/${encodeURIComponent(newId)}/edit`);
  };
};

// -------------------------------------------------------------------- section edit
app.sectionEdit = function (main, sid) {
  const isNew = !sid;
  const s = isNew ? { id: 'SEC-', type: 'section', title: '', about: '', links: [], status: 'drafting' } : clone(Object.fromEntries(Object.entries(section(sid)).filter(([k]) => k !== 'forms')));
  main.innerHTML = `<div class="page" style="max-width:900px">
    <a class="small" href="#/section/${encodeURIComponent(sid || currentSection() || '')}">← back</a>
    <h1>${isNew ? 'New section' : 'Edit section'}</h1>
    <form class="panel" onsubmit="return false">
      <div class="field" style="border-top:0"><label class="lab" for="sid">Id <span class="req">*</span></label>
        ${isNew ? `<div class="row" style="gap:0;border:1px solid var(--line2);border-radius:8px;overflow:hidden;flex-wrap:nowrap"><span class="mono" style="padding:9px 4px 9px 11px;background:var(--bg);font-weight:600">SEC-</span><input id="sid" class="mono" style="border:0;outline:0;flex:1;padding:9px 8px" placeholder="short-topic-name"></div>`
          : `<input id="sid" class="inp mono" value="${esc(sid)}" readonly>`}</div>
      <div id="sfields"></div><div id="sneed"></div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><a class="btn" href="#/section/${encodeURIComponent(sid || currentSection() || '')}">Cancel</a><button class="btn primary" type="button" id="ssave">${isNew ? 'Add section' : 'Apply changes'}</button></div>
    </form></div>`;
  const update = () => {
    const miss = (isNew && !$('#sid').value.trim() ? ['an id'] : []).concat(tmpl('section').filter(fd => fd.required && !(s[fd.key] || '').trim()).map(fd => fd.label.toLowerCase()));
    $('#sneed').innerHTML = miss.length ? `<p class="need">Still needed: ${esc(miss.join(', '))}.</p>` : '';
    $('#ssave').disabled = miss.length > 0;
  };
  renderFields($('#sfields'), s, { onChange: update });
  if (isNew) $('#sid').addEventListener('input', update);
  update();
  $('#ssave').onclick = async () => {
    const id = isNew ? 'SEC-' + $('#sid').value.trim() : sid;
    s.id = id;
    const res = await api('section', { id, meta: s, new: isNew });
        if (res.ok === false) { $('#sneed').innerHTML = `<p class="err">${esc(res.error)}</p>`; return; }
    S = res.state; rebuild();
    go('#/section/' + encodeURIComponent(id));
    toast(isNew ? `Added section ${id}.` : `Changed ${id}.`, false, { label: 'Undo', run: undo });
  };
};

// -------------------------------------------------------------------- component keys
app.registry = function (main, r) {
  const rows = Object.entries(S.model.component_keys).map(([k, v]) => [k, v]);
  if (r.q.add && !rows.some(x => x[0] === r.q.add)) rows.push([r.q.add, S.schema.standard_keys[r.q.add] || '']);
  const used = {};
  Object.values(FM).forEach(({ f }) => Object.keys(f.components || {}).forEach(k => { used[k] = (used[k] || 0) + 1; }));
  const draw = () => {
    main.innerHTML = `<div class="page" style="max-width:1100px">
      <h1>Component keys</h1><p class="muted" style="margin:0">The slots a stage setup can fill (§4.8). A standard key carries the standard description. A key of your own says how it differs from the nearest standard key, so two setups never fill it with different things.</p>
      <div class="panel" style="margin-top:16px">
        ${rows.map(([k, v], i) => `<div class="kvrow"><input class="inp mono" data-rk="${i}" value="${esc(k)}" style="flex:0 0 160px" aria-label="Key">
          <textarea class="inp" data-rv="${i}" style="min-height:44px" aria-label="Description of ${esc(k)}">${esc(v)}</textarea>
          <span class="small muted" style="flex:0 0 120px;padding-top:10px">${S.schema.standard_keys[k] ? (S.schema.standard_keys[k] === v.trim() ? 'standard' : '<span class="req">differs from the standard</span>') : 'your own'} · used ${used[k] || 0}×</span>
          <button type="button" class="xbtn" data-rrm="${i}" aria-label="Remove ${esc(k)}" ${used[k] ? 'disabled title="Setups use this key"' : ''}>×</button></div>`).join('')}
        <div class="row" style="margin-top:8px"><select class="inp" id="stdAdd" style="width:auto"><option value="">+ Standard key…</option>${Object.keys(S.schema.standard_keys).filter(k => !rows.some(x => x[0] === k)).map(k => `<option>${esc(k)}</option>`).join('')}</select>
          <button class="btn sm" type="button" id="ownAdd">+ A key of your own</button></div>
      </div>
      <div id="rerr"></div>
      <div class="row" style="justify-content:flex-end;margin-top:14px"><a class="btn" href="#/section/${encodeURIComponent(currentSection() || '')}">Cancel</a><button class="btn primary" type="button" id="rsave">Apply changes</button></div></div>`;
    $$('[data-rk]').forEach(i => i.oninput = () => { rows[+i.dataset.rk][0] = i.value; });
    $$('[data-rv]').forEach(i => i.oninput = () => { rows[+i.dataset.rv][1] = i.value; });
    $$('[data-rrm]').forEach(b => b.onclick = () => { rows.splice(+b.dataset.rrm, 1); draw(); });
    $('#stdAdd').onchange = e => { if (e.target.value) { rows.push([e.target.value, S.schema.standard_keys[e.target.value]]); draw(); } };
    $('#ownAdd').onclick = () => { rows.push(['', '']); draw(); };
    $('#rsave').onclick = async () => {
      const bad = rows.filter(([k, v]) => k.trim() && !v.trim()).map(x => x[0]);
      if (bad.length) { $('#rerr').innerHTML = `<p class="need">Give a description for ${esc(bad.join(', '))}.</p>`; return; }
      const res = await api('registry', { keys: rows.filter(([k]) => k.trim()) });
            if (res.ok === false) { $('#rerr').innerHTML = `<p class="err">${esc(res.error)}</p>`; return; }
      S = res.state; rebuild(); toast('Component keys changed.', false, { label: 'Undo', run: undo }); render();
    };
  };
  draw();
};
