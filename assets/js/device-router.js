// Select a layout on page entry. Never reload during rotation or keyboard use.
(() => {
  const script = document.currentScript;
  if (!script || typeof window.matchMedia !== "function") return;
  const current = new URL(window.location.href);
  const choice = current.searchParams.get("view");
  const compact = window.matchMedia("(max-width: 900px)").matches ||
    (window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 1100px)").matches);
  const mobile = choice === "mobile" || (choice !== "desktop" && compact);
  const layout = mobile ? "mobile" : "desktop";
  if (script.dataset.layout === layout) return;
  const target = new URL(mobile ? "index-mobile.html" : "index.html", new URL("../../", script.src));
  target.search = current.search;
  target.hash = current.hash;
  window.location.replace(target.href);
})();
