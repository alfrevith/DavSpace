// Phone-only enhancements. Shared controllers retain the portfolio's animations.
(() => {
  const body = document.body;
  if (!body.classList.contains("mobile-site")) return;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");

  // Preserve each portrait's actual proportions while capping its visible height.
  document.querySelectorAll('.project-tall .project-image img').forEach(image => {
    const size = () => {
      if (image.naturalWidth && image.naturalHeight) image.closest('.project-card').style.setProperty('--portrait-aspect', image.naturalWidth / image.naturalHeight);
    };
    if (image.complete) size();
    else image.addEventListener('load', size, {once: true});
  });

  // Both navigation surfaces follow accumulated scroll direction, including
  // small touch deltas. Clamp rubber-band scrolling so it cannot reverse them.
  let lastScroll = window.scrollY || 0, travel = 0, scrollDirection = 0, barsFrame = 0;
  let keyboardNavigation = false;
  const bars = [...document.querySelectorAll(".mobile-header, .mobile-nav")];
  function showBars() {
    body.removeAttribute("data-mobile-bars-hidden");
    travel = 0;
    lastScroll = window.scrollY || 0;
  }
  function paintBars() {
    barsFrame = 0;
    const limit = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const y = Math.max(0, Math.min(window.scrollY || 0, Number.isFinite(limit) ? limit : Infinity));
    const delta = y - lastScroll;
    lastScroll = y;
    if (y <= 12 || document.documentElement.classList.contains("mobile-chat-open") ||
      (keyboardNavigation && bars.some(bar => bar.contains(document.activeElement)))) {
      showBars();return;
    }
    if (!delta) return;
    const direction = Math.sign(delta);
    if (direction !== scrollDirection) travel = 0;
    scrollDirection = direction;
    travel += Math.abs(delta);
    if (travel >= 10) {
      body.toggleAttribute("data-mobile-bars-hidden", direction > 0);
      travel = 0;
    }
  }
  window.addEventListener("scroll", () => {
    if (!barsFrame) barsFrame = window.requestAnimationFrame(paintBars);
  }, {passive: true});
  window.addEventListener("pointerdown", () => { keyboardNavigation = false; }, {passive: true});
  window.addEventListener("keydown", event => {
    if (event.key === "Tab") { keyboardNavigation = true; showBars(); }
  });
  bars.forEach(bar => bar.addEventListener("focusin", () => { if (keyboardNavigation) showBars(); }));
  window.addEventListener("pageshow", showBars);
  window.addEventListener("resize", showBars, {passive: true});

  const filterLabel = document.querySelector("[data-mobile-filter-label]");
  document.querySelector("#projects")?.addEventListener("click", () => {
    // Shared filtering runs on the buttons before the event reaches this drawer.
    const category = document.querySelector('[data-filter][aria-pressed="true"]');
    const year = document.querySelector('[data-project-year][aria-pressed="true"]');
    const labels = [];
    if (category?.dataset.filter !== "all") labels.push(category?.textContent.trim());
    if (year?.dataset.projectYear !== "all") labels.push(year?.textContent.trim());
    if (filterLabel) filterLabel.textContent = labels.filter(Boolean).join(" · ") || "All projects";
  });

  // Knowledge sources point to the canonical desktop URL. Keep section links
  // within this page so following a chat answer does not reload the mobile site.
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.target === "_blank") return;
    const target = new URL(link.href, location.href);
    const current = new URL(location.href);
    if (target.origin !== current.origin || target.searchParams.has("view") || !target.hash) return;
    if (target.pathname !== new URL("index.html", current).pathname) return;
    const section = document.getElementById(decodeURIComponent(target.hash.slice(1)));
    if (!section) return;
    event.preventDefault();
    current.hash = target.hash;
    history.pushState(null, "", current);
    section.scrollIntoView({behavior: motion.matches ? "instant" : "smooth", block: "start"});
  });

  // Native dialogs remain independently scrollable and start at the identity
  // on every open, including switching records after scrolling down to a PDF.
  document.querySelectorAll(".project-modal, .credential-modal").forEach(dialog => {
    const workspace = dialog.querySelector(".project-workspace, .credential-workspace");
    new MutationObserver(() => {
      if (dialog.open && workspace) workspace.scrollTop = 0;
    }).observe(dialog, {attributes: true, attributeFilter: ["open"]});
  });

  const chat = document.querySelector(".portfolio-assistant");
  const panel = chat?.querySelector(".assistant-panel");
  const launcher = chat?.querySelector(".assistant-launcher");
  if (!chat || !panel || !launcher) return;
  const background = [...document.querySelectorAll("main, .mobile-header, .mobile-nav")];
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  let chatOpen = false;
  function syncChat() {
    const open = launcher.getAttribute("aria-expanded") === "true";
    if (open === chatOpen) return;
    chatOpen = open;
    document.documentElement.classList.toggle("mobile-chat-open", open);
    background.forEach(element => { element.inert = open; });
    if (open) { showBars(); chat.querySelector(".assistant-close")?.focus({preventScroll: true}); }
    else body.removeAttribute("data-mobile-keyboard");
    updateViewport();
  }
  new MutationObserver(syncChat).observe(launcher, {attributes: true, attributeFilter: ["aria-expanded"]});
  panel.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const controls = [...panel.querySelectorAll('button:not(:disabled), a[href], textarea')]
      .filter(element => element.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  const visual = window.visualViewport;
  let restingHeight = visual?.height || innerHeight;
  let viewportWidth = innerWidth;
  function updateViewport() {
    const height = visual?.height || innerHeight;
    const editing = chat.contains(document.activeElement) && document.activeElement.matches("textarea, input");
    if (innerWidth !== viewportWidth || !editing) { restingHeight = height; viewportWidth = innerWidth; }
    body.style.setProperty("--mobile-visual-height", `${height}px`);
    body.style.setProperty("--mobile-visual-top", `${visual?.offsetTop || 0}px`);
    body.toggleAttribute("data-mobile-keyboard", chatOpen && editing && height < restingHeight - 100);
  }
  visual?.addEventListener("resize", updateViewport, {passive: true});
  visual?.addEventListener("scroll", updateViewport, {passive: true});
  window.addEventListener("resize", updateViewport, {passive: true});
  chat.addEventListener("focusin", updateViewport);
  chat.addEventListener("focusout", () => queueMicrotask(updateViewport));
  window.addEventListener("pageshow", () => { syncChat(); updateViewport(); });
  updateViewport();
})();
