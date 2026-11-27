'use strict';
/* Field editors used by the edit screen, the add screen and the small windows. */

function tmpl(type) { return S.schema.templates[type] || []; }

/* Required fields that are still empty. Mirrors required_missing() in logic.py. */
function missingFor(d) {
  const t = d.type, miss = [];
  const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
  tmpl(t).forEach(fd => { if (fd.required && empty(typeof d[fd.key] === 'string' ? d[fd.key].trim() : d[fd.key])) miss.push(fd.label.toLowerCase()); });
  const st = d.status;
  if (t === 'claim' && !['unsourced', 'refuted'].includes(st) && !asList(d.derived_from).length) miss.push('what it rests on');
  if (t === 'limitation') {
    if (['established', 'preliminary'].includes(st) && !asList(d.affects).length) miss.push('what it weakens');
    if (['established', 'resolved'].includes(st) && !asList(d.evidence).length) miss.push('what establishes it (or “stated”)');
    if (st === 'resolved' && !asList(d.resolved_by).length) miss.push('what removed it');
  }
  if (t === 'def' && asList(d.avoid).length && !(d.why_avoid || '').trim()) miss.push('why to avoid those words');
  if (t === 'setup' && st !== 'planned' && empty(d.components) && !asList(d.includes).length) miss.push('components or includes');
  if (t === 'open' && st === 'closed' && !asList(d.answered_by).length && !(d.note || '').trim()) miss.push('what answers it, or why it was dropped (note)');
  return miss;
}

function newDraft(type, extra) {
  const d = { id: S.schema.prefix[type], type };
  tmpl(type).forEach(fd => {
    if (fd.default != null) d[fd.key] = fd.default;
    else if (fd.kind === 'refs' || fd.kind === 'list' || fd.kind === 'links') d[fd.key] = [];
    else if (fd.kind === 'kv') d[fd.key] = {};
  });
  if (type === 'setup') { delete d.includes; }
  return Object.assign(d, extra || {});
}

/* Frozen fields of a form as the spec has them (M4), for marking in the editor. */
function frozenFields(f) {
  if (!f || !S.settings.frozen) return [];
  if (f.type === 'result') return ['statement', 'scope', 'evidence'];
  if (f.type === 'setup' && f.status !== 'planned') return ['components', 'includes'];
  if (f.type === 'artifact' && f.status !== 'planned') {
    const rested = (DOWN[f.id] || []).length > 0;
    return rested ? ['path', 'version', 'entrypoint', 'produces'] : [];
  }
  return [];
}

/* Render the fields of draft d into box. opts: only (keys), frozen (keys), orig (form), onChange(). */
function renderFields(box, d, opts) {
  opts = opts || {};
  const t = d.type;
  const fields = tmpl(t).filter(fd => !opts.only || opts.only.includes(fd.key));
  const frozen = opts.frozen || [];
  const html = fields.map(fd => {
    const v = d[fd.key];
    if (fd.kind === 'date') {
      if (opts.only) return '';
      return `<div class="field"><span class="lab">${esc(fd.label)} <span class="key">${fd.key}</span></span>
        <p style="margin:0"><span class="mono">${esc(v || '—')}</span> <span class="muted">→ set to</span> <span class="mono">${esc(S.today)}</span> <span class="muted">when you apply</span></p></div>`;
    }
    if (fd.show_if) {
      const [k, vals] = Object.entries(fd.show_if)[0];
      if (!vals.includes(d[k]) && !asList(v).length) return '';
    }
    if (t === 'setup' && fd.key === 'includes' && !asList(v).length && d.components && Object.keys(d.components).length) return '';
    if (t === 'setup' && fd.key === 'components' && asList(d.includes).length && !(v && Object.keys(v).length)) return '';
    const inf = fd.info ? info(fd.info, v) : { btn: '', pop: '' };
    const req = fd.required ? ' <span class="req" title="required">*</span>' : '';
    const fz = frozen.includes(fd.key) ? ' <span class="chip s-off" title="Frozen once results rest on it (M4)">frozen</span>' : '';
    const lab = `<span class="lab">${esc(fd.label)}${req} <span class="key">${fd.key}</span>${inf.btn}${fz}</span>${inf.pop}`;
    const help = fd.help ? `<p class="help">${esc(fd.help)}</p>` : '';
    const fid = 'f_' + fd.key;
    let ctl = '';
    if (fd.kind === 'text') ctl = `<input class="inp ${['path', 'script', 'entrypoint', 'version'].includes(fd.key) ? 'mono' : ''}" id="${fid}" data-k="${fd.key}" value="${esc(v || '')}" placeholder="${esc(fd.ph || '')}">`;
    else if (fd.kind === 'ta') ctl = `<textarea class="inp" id="${fid}" data-k="${fd.key}" placeholder="${esc(fd.ph || '')}" ${fd.key === 'note' ? 'style="background:#FBFAF8;border-style:dashed"' : ''}>${esc(v || '')}</textarea>`;
    else if (fd.kind === 'select') ctl = `<div class="seg" role="group" aria-label="${esc(fd.label)}">${fd.options.map(o => `<button type="button" data-seg="${fd.key}" data-v="${esc(o)}" class="${(v || fd.default) === o ? 'on' : ''}" aria-pressed="${(v || fd.default) === o}">${esc(o)}</button>`).join('')}</div>`;
    else if (fd.kind === 'check') ctl = `<label class="row" style="min-height:30px"><input type="checkbox" data-check="${fd.key}" ${v === 'fixed' ? 'checked' : ''}> <span>fixed: copy the statement word for word</span></label>`;
    else if (fd.kind === 'refs') ctl = refsHtml(fd, asList(v), opts.orig);
    else if (fd.kind === 'list') ctl = listHtml(fd, asList(v));
    else if (fd.kind === 'kv') ctl = kvHtml(fd, v || {}, opts.orig);
    else if (fd.kind === 'links') ctl = linksHtml(fd, asList(v));
    return `<div class="field" data-field="${fd.key}">${lab}${ctl}${help}</div>`;
  }).join('');
  const extra = opts.only ? '' : Object.keys(d).filter(k => !['id', 'type'].includes(k) && !tmpl(t).some(fd => fd.key === k)).map(k =>
    `<div class="field"><span class="lab">${esc(k)} <span class="key">not in the template; kept as it is</span></span><pre class="mono" style="margin:0;white-space:pre-wrap">${esc(typeof d[k] === 'string' ? d[k] : JSON.stringify(d[k]))}</pre></div>`).join('');
  box.innerHTML = html + extra;
  bindFields(box, d, opts);
}

function refsHtml(fd, vals, orig) {
  const old = orig ? asList(orig[fd.key]) : vals;
  const chips = vals.map((x, i) => {
    const f = FM[x];
    const cls = !old.includes(x) ? 'new' : (isId(x) && !f ? 'bad' : '');
    const lab = f ? typeChip(f.f.type, true) : (isId(x) ? '<span class="chip t-missing">?</span>' : '<span class="chip s-off">label</span>');
    return `<span class="refchip ${cls}" title="${esc(f ? textOf(x) : (isId(x) ? 'No form has this id' : 'A label, not a form'))}">${lab}${esc(x)}${f ? statusChip(f.f.status) : ''}<button type="button" data-rm="${fd.key}" data-i="${i}" aria-label="Remove ${esc(x)}">×</button></span>`;
  }).join('');
  return `<div class="row" style="gap:6px">${chips || '<span class="muted small">Nothing yet.</span>'}</div>
    <div class="picker"><input class="inp" data-pick="${fd.key}" placeholder="${esc(fd.ph || 'Add a form by id or by words in it…')}" autocomplete="off" aria-label="${esc(fd.label)}: add"><div class="dd hidden"></div></div>`;
}
function listHtml(fd, vals) {
  const chips = vals.map((x, i) => `<span class="refchip">${esc(x)}<button type="button" data-rm="${fd.key}" data-i="${i}" aria-label="Remove ${esc(x)}">×</button></span>`).join('');
  return `<div class="row" style="gap:6px">${chips || '<span class="muted small">Nothing yet.</span>'}</div>
    <input class="inp" data-listadd="${fd.key}" placeholder="Type and press Enter to add" aria-label="${esc(fd.label)}: add">`;
}
function kvHtml(fd, obj, orig) {
  const keys = Object.keys(S.model.component_keys);
  const rows = Object.entries(obj).map(([k, v], i) => {
    const isL = Array.isArray(v);
    const opts = Array.from(new Set(keys.concat([k]))).map(x => `<option ${x === k ? 'selected' : ''}>${esc(x)}</option>`).join('');
    const desc = S.model.component_keys[k] || S.schema.standard_keys[k] || '';
    return `<div class="kvrow"><select class="inp" data-kvk="${i}" aria-label="Component key" title="${esc(desc)}">${opts}</select>
      <textarea class="inp" data-kvv="${i}" data-list="${isL ? 1 : 0}" style="min-height:44px" aria-label="Value of ${esc(k)}">${esc(isL ? v.join('\n') : (v == null ? '' : String(v)))}</textarea>
      <button type="button" class="xbtn" data-kvrm="${i}" aria-label="Remove ${esc(k)}">×</button></div>
      ${isL ? '<p class="help" style="margin:-4px 0 8px">One item per line.</p>' : ''}`;
  }).join('');
  return `<div>${rows}</div><div class="row"><button type="button" class="btn sm" data-kvadd="1">+ Component</button><a class="small" href="#/registry">Edit the component keys</a></div>`;
}
function linksHtml(fd, links) {
  const secs = S.model.sections.map(s => s.id);
  const inf = info('linkRel');
  const rows = links.map((l, i) => `<div class="kvrow">
      <select class="inp" data-lnk="${i}" data-lk="to" aria-label="Linked section">${secs.map(x => `<option ${x === l.to ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      <select class="inp" data-lnk="${i}" data-lk="rel" aria-label="Kind of link">${S.schema.link_rels.map(x => `<option ${x === l.rel ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      <input class="inp" data-lnk="${i}" data-lk="why" value="${esc(l.why || '')}" placeholder="why" aria-label="Why">
      <button type="button" class="xbtn" data-lnkrm="${i}" aria-label="Remove link">×</button></div>`).join('');
  return `${rows}<div class="row"><button type="button" class="btn sm" data-lnkadd="1">+ Link</button>${inf.btn}</div>${inf.pop}`;
}

function bindFields(box, d, opts) {
  const changed = () => { if (opts.onChange) opts.onChange(); };
  const rerender = () => { renderFields(box, d, opts); changed(); };
  $$('[data-k]', box).forEach(el => el.addEventListener('input', () => { d[el.dataset.k] = el.value; changed(); }));
  $$('[data-seg]', box).forEach(b => b.onclick = () => { d[b.dataset.seg] = b.dataset.v; rerender(); });
  $$('[data-check]', box).forEach(c => c.onchange = () => { if (c.checked) d[c.dataset.check] = 'fixed'; else delete d[c.dataset.check]; changed(); });
  $$('[data-rm]', box).forEach(b => b.onclick = () => { const k = b.dataset.rm; d[k] = asList(d[k]).filter((_, i) => i !== +b.dataset.i); rerender(); });
  $$('[data-listadd]', box).forEach(inp => inp.onkeydown = e => {
    if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); const k = inp.dataset.listadd; d[k] = asList(d[k]).concat([inp.value.trim()]); rerender(); const n = $(`[data-listadd="${k}"]`, box); if (n) n.focus(); }
  });
  // components
  const entries = () => Object.entries(d.components || {});
  $$('[data-kvk]', box).forEach(sel => sel.onchange = () => {
    const e = entries(); e[+sel.dataset.kvk][0] = sel.value; d.components = Object.fromEntries(e); rerender();
  });
  $$('[data-kvv]', box).forEach(ta => ta.addEventListener('input', () => {
    const e = entries(); const i = +ta.dataset.kvv;
    e[i][1] = ta.dataset.list === '1' ? ta.value.split('\n').map(x => x.trim()).filter(Boolean) : ta.value;
    d.components = Object.fromEntries(e); changed();
  }));
  $$('[data-kvrm]', box).forEach(b => b.onclick = () => { const e = entries(); e.splice(+b.dataset.kvrm, 1); d.components = Object.fromEntries(e); rerender(); });
  $$('[data-kvadd]', box).forEach(b => b.onclick = () => {
    const used = Object.keys(d.components || {});
    const k = Object.keys(S.model.component_keys).find(x => !used.includes(x)) || 'key' + (used.length + 1);
    d.components = Object.assign({}, d.components || {}, { [k]: '' }); rerender();
  });
  // links
  $$('[data-lnk]', box).forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
    d.links = asList(d.links).map(x => Object.assign({}, x)); d.links[+el.dataset.lnk][el.dataset.lk] = el.value; changed();
  }));
  $$('[data-lnkrm]', box).forEach(b => b.onclick = () => { d.links = asList(d.links).filter((_, i) => i !== +b.dataset.lnkrm); rerender(); });
  $$('[data-lnkadd]', box).forEach(b => b.onclick = () => {
    const other = S.model.sections.find(s => s.id !== d.id);
    d.links = asList(d.links).concat([{ to: other ? other.id : '', rel: 'builds_on', why: '' }]); rerender();
  });
  // reference pickers
  $$('[data-pick]', box).forEach(inp => {
    const k = inp.dataset.pick;
    const fd = tmpl(d.type).find(x => x.key === k);
    const dd = inp.nextElementSibling;
    let hl = 0, opts_ = [];
    const show = () => {
      const q = inp.value.trim();
      if (!q) { dd.classList.add('hidden'); return; }
      const ids = searchForms(q, 12).filter(x => x !== d.id);
      opts_ = ids.map(id => {
        const f = FM[id].f;
        const ok = fd.refs.includes(f.type) && !asList(d[k]).includes(id);
        const why = asList(d[k]).includes(id) ? 'already added' : (fd.refs.includes(f.type) ? f.status : `a ${f.type} cannot go here`);
        return { id, ok, html: `${typeChip(f.type, true)}<span class="mono ellip" style="flex:0 1 auto">${esc(id)}</span><span class="muted ellip grow">${esc(textOf(id))}</span><span class="small muted">${esc(why)}</span>` };
      });
      if (fd.labels && /^\S+$/.test(q) && !FM[q] && !isId(q)) opts_.unshift({ id: q, ok: true, label: true, html: `<span class="chip s-off">label</span><span>Add “${esc(q)}” as a label (a run label, or stated)</span>` });
      if (!opts_.length) opts_.push({ ok: false, html: 'Nothing matches.' });
      hl = Math.max(0, opts_.findIndex(o => o.ok));
      dd.innerHTML = opts_.map((o, i) => `<div class="opt ${o.ok ? '' : 'off'} ${i === hl ? 'hl' : ''}" data-i="${i}">${o.html}</div>`).join('');
      dd.classList.remove('hidden');
      $$('.opt', dd).forEach(el => el.onmousedown = e => { e.preventDefault(); pick(+el.dataset.i); });
    };
    const pick = i => {
      const o = opts_[i];
      if (!o || !o.ok || !o.id) return;
      d[k] = asList(d[k]).concat([o.id]);
      rerender();
      const n = $(`[data-pick="${k}"]`, box); if (n) n.focus();
    };
    inp.oninput = show;
    inp.onkeydown = e => {
      if (e.key === 'ArrowDown') { hl = Math.min(hl + 1, opts_.length - 1); e.preventDefault(); $$('.opt', dd).forEach((x, i) => x.classList.toggle('hl', i === hl)); }
      else if (e.key === 'ArrowUp') { hl = Math.max(hl - 1, 0); e.preventDefault(); $$('.opt', dd).forEach((x, i) => x.classList.toggle('hl', i === hl)); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(hl); }
      else if (e.key === 'Escape') dd.classList.add('hidden');
    };
    inp.onblur = () => setTimeout(() => dd.classList.add('hidden'), 150);
  });
}

/* ---------------------------------------------------------------- small windows
   A compact window for adding one form. The Add button stays disabled until the
   required fields are filled. onDone(id) runs after the form is in the model. */
function createModal(o) {
  const type = o.type;
  const d = newDraft(type, o.prefill);
  let sec = o.section || currentSection();
  const only = o.only || tmpl(type).filter(fd => fd.required || ['not_supported', 'note'].includes(fd.key) ||
    (type === 'claim' && fd.key === 'derived_from') || (type === 'limitation' && ['affects', 'evidence'].includes(fd.key))).map(fd => fd.key);
  const m = modal(`<div class="row" style="justify-content:space-between"><h2 style="font-size:19px">${esc(o.title || 'New ' + type)}</h2><button class="xbtn" data-close aria-label="Close">×</button></div>
    ${o.intro ? `<div class="muted small" style="margin:4px 0 0">${o.intro}</div>` : ''}
    <div class="row" style="margin-top:12px;align-items:flex-start">
      <div style="flex:1 1 220px"><label class="flabel" for="cm_sec">Section</label>
        <select class="inp" id="cm_sec">${S.model.sections.map(s => `<option value="${esc(s.id)}" ${s.id === sec ? 'selected' : ''}>${esc(s.id)}${s.id === currentSection() ? ' (this one)' : ''}</option>`).join('')}</select></div>
      <div style="flex:1 1 220px"><label class="flabel" for="cm_id">Id</label>
        <div class="row" style="gap:0;border:1px solid var(--line2);border-radius:8px;overflow:hidden;flex-wrap:nowrap"><span class="mono" style="padding:9px 4px 9px 11px;background:var(--bg);font-weight:600">${esc(S.schema.prefix[type])}</span>
        <input id="cm_id" class="mono" style="border:0;outline:0;flex:1;min-width:0;padding:9px 8px" placeholder="short-name" autocomplete="off"></div></div>
    </div>
    <div id="cm_fields"></div>
    <div id="cm_need"></div>
    <div class="row" style="justify-content:flex-end;margin-top:16px">
      <button class="btn" type="button" data-close>Cancel</button>
      ${o.another ? '<button class="btn" type="button" id="cm_more">Add and write another</button>' : ''}
      <button class="btn primary" type="button" id="cm_add">${esc(o.addLabel || 'Add')}</button>
    </div>`, { sticky: true });
  const box = $('#cm_fields', m);
  const update = () => {
    const idv = $('#cm_id', m).value.trim();
    d.id = S.schema.prefix[type] + idv;
    const miss = (idv ? [] : ['an id']).concat(missingFor(d));
    const taken = idv && (FM[d.id] || S.model.sections.some(s => s.id === d.id));
    $('#cm_need', m).innerHTML = taken ? `<p class="err">The id ${esc(d.id)} is taken. Ids are never reused (M1).</p>`
      : (miss.length ? `<p class="need" role="status">Still needed before it can be added: ${esc(miss.join(', '))}.</p>` : '');
    const blocked = !!(miss.length || taken);
    $('#cm_add', m).disabled = blocked;
    if ($('#cm_more', m)) $('#cm_more', m).disabled = blocked;
  };
  renderFields(box, d, { only, onChange: update });
  $('#cm_id', m).addEventListener('input', update);
  $('#cm_sec', m).onchange = e => { sec = e.target.value; };
  update();
  const submit = async more => {
    update();
    if ($('#cm_add', m).disabled) return;
    const r = await api('form/create', { form: d, section: sec });
    if (r.ok === false) { $('#cm_need', m).innerHTML = `<p class="err">${esc(r.error)}</p>`; return; }
    S = r.state; rebuild();
    const id = r.id;
    if (o.onDone) await o.onDone(id);
    render();
    toast(`Added ${id} to ${sec}.`, false, { label: 'Undo', run: undo });
    if (more) { createModal(o); } else closeModal();
  };
  $('#cm_add', m).onclick = () => submit(false);
  if ($('#cm_more', m)) $('#cm_more', m).onclick = () => submit(true);
}

app.quickOpen = function () {
  const sinf = info('openStatus', 'open');
  createModal({ type: 'open', title: 'New open question', another: true, addLabel: 'Add question', only: ['statement', 'note'],
    intro: `You stay on this page. It is filed with status <span class="mono">open</span>${sinf.btn} and today’s date.${sinf.pop}` });
};
