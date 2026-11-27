'use strict';
window.addEventListener('hashchange', () => { closeModal(); render(); });
window.addEventListener('beforeunload', e => { if (S && S.open && S.dirty) { e.preventDefault(); e.returnValue = ''; } });
(async function () {
  await refresh();
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    location.hash = S.open ? '#/section/' + encodeURIComponent(S.model.sections[0] ? S.model.sections[0].id : '') : '#/start';
  } else render();
})();
