'use strict';
/* Shared helpers: state, API, routing, top bar, modals, toasts, info buttons. */

let S = null;            // state from the server
let FM = {};             // id -> {f, sec}
let DOWN = {};           // id -> ids resting on it directly
const UI = { sel: null, typeFilter: 'all', hideDone: true, order: 'type', collapsed: {}, sectionFilter: '', depth: 99,
             limHL: null, gsel: null, glim: null, lastSection: null };
const app = {};          // view functions register here

const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const asList = v => (v == null || v === '') ? [] : (Array.isArray(v) ? v : [v]);
const isId = v => typeof v === 'string' && /^(P|DEF|ART|SET|SEC)-/.test(v);
const DONE = ['refuted', 'outdated', 'resolved', 'closed', 'superseded'];
const HIDE_STATES = ['superseded', 'resolved', 'retired'];
const TYPE_ORDER = ['claim', 'result', 'assumption', 'limitation', 'open', 'setup', 'artifact', 'def'];
const TYPE_LABEL = { claim: 'Claims', result: 'Results', assumption: 'Assumptions', limitation: 'Limitations', open: 'Open questions',
                     setup: 'Setups', artifact: 'Artifacts', def: 'Terms (def)' };

function sc(s) {
  if (['established', 'current', 'drafted'].includes(s)) return 's-ok';
  if (['preliminary', 'assumed', 'open', 'planned', 'drafting'].includes(s)) return 's-warn';
  if (['unsourced', 'refuted', 'outdated'].includes(s)) return 's-bad';
  return 's-off';
}
const typeChip = (t, short) => `<span class="chip t-${esc(t)}">${esc(short ? (t || '?')[0].toUpperCase() : t)}</span>`;
const statusChip = s => s ? `<span class="chip ${sc(s)}">${esc(s)}</span>` : '';
function changeTag(id) {
  if (!S || !S.open) return '';
  if (S.new_ids.includes(id)) return '<span class="chip tag-new">new</span>';
  if (S.changed_ids.includes(id)) return '<span class="chip tag-ed">changed</span>';
  return '';
}
const secOf = id => FM[id] ? FM[id].sec : null;
const formHref = id => FM[id] ? `#/section/${encodeURIComponent(FM[id].sec)}?sel=${encodeURIComponent(id)}` : '#';
function textOf(id) { const t = S.texts && S.texts[id]; return t ? t.x : ''; }
function idLink(id, opts) {
  opts = opts || {};
  const f = FM[id];
  if (!f) return `<span class="idlink"><span class="chip t-missing">?</span><span>${esc(id)}</span>${opts.label ? '' : ' <span class="muted small">(not a form)</span>'}</span>`;
  return `<a class="idlink" href="${opts.href || formHref(id)}" title="${esc(textOf(id))}">${typeChip(f.f.type, true)}<span class="ellip">${esc(id)}</span>${opts.status === false ? '' : statusChip(f.f.status)}${changeTag(id)}</a>`;
}
const idChip = id => `<a class="idchip" href="${formHref(id)}" title="${esc(textOf(id))}">${esc(id)}</a>`;

function restsOn(f) {
  let v = [];
  if (f.type === 'claim') v = asList(f.derived_from);
  else if (f.type === 'result') v = asList(f.evidence);
  else if (f.type === 'setup') {
    v = asList(f.includes);
    Object.values(f.components || {}).forEach(x => asList(x).forEach(y => { if (isId(y)) v.push(y); }));
  }
  return v.filter(x => isId(x) && FM[x]);
}

function rebuild() {
  FM = {}; DOWN = {};
  if (!S || !S.open) return;
  S.model.sections.forEach(s => s.forms.forEach(f => { if (!FM[f.id]) FM[f.id] = { f, sec: s.id }; }));
  Object.values(FM).forEach(({ f }) => restsOn(f).forEach(u => { (DOWN[u] = DOWN[u] || []).push(f.id); }));
}
function section(sid) { return S.model.sections.find(s => s.id === sid); }

// -------------------------------------------------------------------- API
async function api(path, body) {
  const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  let res;
  try { res = await fetch('/api/' + path, opt); }
  catch (e) { return { ok: false, error: 'The editor is not reachable. Is forms_editor.py still running?' }; }
  try { return await res.json(); } catch (e) { return { ok: false, error: 'Unexpected answer from the editor.' }; }
}
async function refresh() { S = await api('state'); rebuild(); }

/* Run a change. On success the new state comes back with it. */
async function act(path, body, okMsg) {
  const r = await api(path, body);
  if (r.ok === false) { toast(r.error || 'That did not work.', true); return r; }
  if (r.state) { S = r.state; rebuild(); }
  render();
  if (okMsg) toast(okMsg, false, S.can_undo ? { label: 'Undo', run: undo } : null);
  return r;
}
async function undo() {
  const r = await api('undo', {});
  if (r.ok === false) return toast(r.error, true);
  S = r.state; rebuild(); render(); toast('Undone: ' + r.undone);
}

// -------------------------------------------------------------------- routing
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const q = {};
  new URLSearchParams(qs || '').forEach((v, k) => { q[k] = v; });
  return { parts, q };
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

// -------------------------------------------------------------------- toasts, modals
function toast(msg, bad, action) {
  const box = $('#toast');
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="linkbtn" type="button">${esc(action.label)}</button>` : ''}<button class="xbtn" style="color:#fff;width:32px;height:32px" aria-label="Dismiss" type="button">×</button>`;
  box.appendChild(el);
  const kill = () => el.remove();
  el.querySelector('.xbtn').onclick = kill;
  if (action) el.querySelector('.linkbtn').onclick = () => { kill(); action.run(); };
  setTimeout(kill, bad ? 9000 : 5000);
}
function modal(html, opts) {
  opts = opts || {};
  const root = $('#modal');
  root.innerHTML = `<div class="ovl"><div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const ovl = root.firstChild;
  ovl.addEventListener('mousedown', e => { if (e.target === ovl && !opts.sticky) closeModal(); });
  $$('[data-close]', root).forEach(b => b.onclick = closeModal);
  const first = $('input,textarea,select', root);
  if (first) setTimeout(() => first.focus(), 30);
  return root.querySelector('.modal');
}
function closeModal() { $('#modal').innerHTML = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').innerHTML) closeModal(); });

// -------------------------------------------------------------------- info buttons
let infoSeq = 0;
/* An (i) button and its hidden panel. current marks the value in use. */
function info(key, current, label) {
  const d = S.schema.defs[key];
  if (!d) return { btn: '', pop: '' };
  const id = 'pop' + (++infoSeq);
  const rows = d.items.map(([t, x]) => `<div class="poprow"><span class="chip s-off ${t === current ? 'cur' : ''}">${esc(t)}</span><span>${esc(x)}</span></div>`).join('');
  return {
    btn: `<button type="button" class="ib" data-info="${id}" aria-expanded="false" aria-label="${esc(label || 'What these values mean')}"><span>i</span></button>`,
    pop: `<div class="pop hidden" id="${id}"><div class="row" style="justify-content:space-between"><strong>${esc(d.title)}</strong><button type="button" class="xbtn" data-info="${id}" aria-label="Close" style="width:30px;height:30px">×</button></div>${rows}${d.foot ? `<p class="muted" style="margin:10px 0 0">${esc(d.foot)}</p>` : ''}</div>`
  };
}
function infoText(title, text) {
  const id = 'pop' + (++infoSeq);
  return {
    btn: `<button type="button" class="ib" data-info="${id}" aria-expanded="false" aria-label="${esc(title)}"><span>i</span></button>`,
    pop: `<div class="pop hidden" id="${id}"><strong>${esc(title)}</strong><p style="margin:6px 0 0">${esc(text)}</p></div>`
  };
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-info]');
  if (!b) return;
  e.preventDefault();
  const pop = document.getElementById(b.dataset.info);
  if (!pop) return;
  const open = pop.classList.toggle('hidden') === false;
  $$(`.ib[data-info="${b.dataset.info}"]`).forEach(x => { x.classList.toggle('on', open); x.setAttribute('aria-expanded', open ? 'true' : 'false'); });
});

// -------------------------------------------------------------------- top bar
function currentSection() {
  const r = route();
  if (r.parts[0] === 'section' && r.parts[1] && r.parts[1] !== 'new') return r.parts[1];
  if (r.parts[0] === 'graph' && r.parts[1]) return r.parts[1];
  if (r.parts[0] === 'form' && FM[r.parts[1]]) return FM[r.parts[1]].sec;
  if (r.q.section) return r.q.section;
  return UI.lastSection || (S.model.sections[0] && S.model.sections[0].id);
}
function renderTop() {
  const top = $('#top');
  if (!S || !S.open) { top.innerHTML = ''; return; }
  const r = route();
  const nForms = Object.keys(FM).length;
  const cur = currentSection();
  const nChecks = S.n_problems + S.n_gaps + S.n_revisit;
  top.innerHTML = `<header>
    <a class="logo" href="#/start" title="Start screen"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2450C8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h5"/></svg>Forms editor</a>
    <span class="filepill mono ellip" title="${esc(S.file)} · ${S.model.sections.length} sections">${esc(S.name)} · ${nForms} forms</span>
    <div class="search"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E5C57" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input class="inp" id="gsearch" placeholder="Search ids, statements, paths…" aria-label="Search all forms" autocomplete="off"><div class="dd hidden" id="gsearchdd"></div></div>
    <nav class="nav row" aria-label="Main">
      <a href="#/section/${encodeURIComponent(cur || '')}" class="${['section', 'form', 'add'].includes(r.parts[0]) ? 'on' : ''}">Sections</a>
      <a href="#/graph/${encodeURIComponent(cur || '')}" class="${r.parts[0] === 'graph' ? 'on' : ''}">Graph</a>
      <a href="#/checks" class="${r.parts[0] === 'checks' ? 'on' : ''}">Checks ${nChecks ? `<span class="badge">${nChecks}</span>` : ''}</a>
    </nav>
    <button class="btn" type="button" id="qaBtn">+ Open question</button>
    <button class="btn" type="button" id="undoBtn" ${S.can_undo ? '' : 'disabled'} title="${esc(S.can_undo ? 'Undo: ' + S.undo_label : 'Nothing to undo')}">Undo</button>
    ${S.dirty ? `<span class="dirty">${S.n_changes} unsaved change${S.n_changes === 1 ? '' : 's'}</span>` : ''}
    <button class="btn primary" type="button" id="saveBtn" ${S.dirty ? '' : 'disabled'}>Save as new file…</button>
    <button class="xbtn" type="button" id="setBtn" aria-label="Settings" title="Settings"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>
  </header>`;
  $('#qaBtn').onclick = () => app.quickOpen();
  $('#undoBtn').onclick = undo;
  $('#saveBtn').onclick = () => app.saveDialog();
  $('#setBtn').onclick = () => app.settingsDialog();
  bindSearch();
}

function searchForms(q, max, allow) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  const out = [];
  for (const id of Object.keys(FM)) {
    const f = FM[id].f;
    if (allow && !allow.includes(f.type)) continue;
    const hay = (id + ' ' + (S.texts[id] ? S.texts[id].x : '') + ' ' + (f.note || '') + ' ' + (f.path || '') + ' ' + (f.script || '')).toLowerCase();
    if (words.every(w => hay.includes(w))) {
      const score = id.toLowerCase().includes(q) ? 0 : 1;
      out.push([score, id]);
    }
  }
  out.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  return out.slice(0, max || 12).map(x => x[1]);
}
function bindSearch() {
  const inp = $('#gsearch'), dd = $('#gsearchdd');
  let hl = 0;
  const show = () => {
    const ids = searchForms(inp.value, 14);
    if (!inp.value.trim()) { dd.classList.add('hidden'); return; }
    dd.innerHTML = ids.length ? ids.map((id, i) => `<div class="opt ${i === hl ? 'hl' : ''}" data-id="${esc(id)}">${typeChip(FM[id].f.type, true)}<span class="mono ellip" style="flex:0 1 auto">${esc(id)}</span><span class="muted ellip grow">${esc(textOf(id))}</span></div>`).join('')
      : '<div class="opt off">Nothing matches.</div>';
    dd.classList.remove('hidden');
    $$('.opt[data-id]', dd).forEach(o => o.onmousedown = e => { e.preventDefault(); dd.classList.add('hidden'); inp.value = ''; go(formHref(o.dataset.id)); });
  };
  inp.oninput = () => { hl = 0; show(); };
  inp.onkeydown = e => {
    const opts = $$('.opt[data-id]', dd);
    if (e.key === 'ArrowDown') { hl = Math.min(hl + 1, opts.length - 1); show(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { hl = Math.max(hl - 1, 0); show(); e.preventDefault(); }
    else if (e.key === 'Enter' && opts[hl]) { dd.classList.add('hidden'); const id = opts[hl].dataset.id; inp.value = ''; go(formHref(id)); }
    else if (e.key === 'Escape') { dd.classList.add('hidden'); }
  };
  inp.onblur = () => setTimeout(() => dd.classList.add('hidden'), 150);
}

// -------------------------------------------------------------------- render
let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  infoSeq = 0;
  const r = route();
  const main = $('#main');
  if (!S) await refresh();
  if (seq !== renderSeq) return;
  if (!S.open && !['new', 'start'].includes(r.parts[0])) { location.hash = '#/start'; return; }
  renderTop();
  const v = r.parts[0] || 'section';
  try {
    if (v === 'start') return app.start(main, r);
    if (v === 'new') return app.newFile(main, r);
    if (v === 'section' && r.parts[1] === 'new') return app.sectionEdit(main, null);
    if (v === 'section' && r.parts[2] === 'edit') return app.sectionEdit(main, r.parts[1]);
    if (v === 'section') return app.section(main, r);
    if (v === 'form' && r.parts[2] === 'edit') return app.edit(main, r.parts[1], r);
    if (v === 'form' && r.parts[2] === 'deps') return app.deps(main, r.parts[1]);
    if (v === 'form') return go(formHref(r.parts[1]));
    if (v === 'add') return app.add(main, r);
    if (v === 'newversion') return app.newVersion(main, r.parts[1], r);
    if (v === 'checks') return app.checks(main, r);
    if (v === 'graph') return app.graph(main, r);
    if (v === 'registry') return app.registry(main, r);
    main.innerHTML = '<div class="page">Unknown page.</div>';
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="page"><div class="err">Something went wrong while drawing this page: ${esc(e.message)}</div></div>`;
  }
}
