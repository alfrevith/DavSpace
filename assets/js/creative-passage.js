/* Shared route vocabulary plus a tiny, bounded first-paint handoff. */
((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.CreativePassage = api;
  try {
    const pending = api.pending(root.sessionStorage, root.location.pathname, Date.now());
    if (!pending || root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.document.documentElement.dataset.worldArriving = pending.to;
    root.creativeWorldEntry = api.worlds.includes(pending.from);
    root.__creativePassageFallback = root.setTimeout(() => {
      root.document.documentElement.removeAttribute('data-world-arriving');
      root.document.documentElement.removeAttribute('data-passage-ready');
      root.dispatchEvent(new root.Event('creative:arrived'));
    }, 800);
  } catch { /* A normal page entry works without session storage. */ }
})(globalThis, () => {
  const key = 'davspace:creative:passage:v1';
  const worlds = ['photography', 'drawings', 'writing'];
  function route(from, to) {
    if (!worlds.includes(to) || (from !== "portfolio" && !worlds.includes(from)) || from === to) return null;
    return { from, to, id: `${from}-${to}`, duration: 100, arrivalDuration: 140 };
  }
  function pending(storage, pathname, now) {
    try {
      const item = JSON.parse(storage.getItem(key) || 'null');
      if (!item || !route(item.from, item.to) || item.path !== pathname || !pathname.endsWith('/' + item.to + '.html')) return null;
      const age = now - item.at;
      return Number.isFinite(age) && age >= 0 && age < 8000 ? item : null;
    } catch { return null; }
  }
  return { key, worlds, route, pending };
});
