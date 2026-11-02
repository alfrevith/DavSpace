(() => {
  const dialog = document.querySelector("#project-dialog");
  if (!dialog) return;

  const windowPanel = dialog.querySelector(".project-window");
  const details = dialog.querySelector(".project-details");
  const closeButton = dialog.querySelector(".project-close");
  const pdfMount = dialog.querySelector("[data-project-pdf-mount]");
  const pdfEmpty = dialog.querySelector("[data-project-pdf-empty]");
  const pdfLink = dialog.querySelector("[data-project-pdf-link]");
  const logoMount = dialog.querySelector("[data-project-logo]");
  const modelSection = dialog.querySelector("[data-project-model]");
  const modelToggle = dialog.querySelector("[data-project-model-toggle]");
  const modelMount = dialog.querySelector("[data-project-model-mount]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const entranceDuration = 1000;
  const statusLabels = {
    "in-development": "In development",
    prototype: "Prototype",
    completed: "Completed"
  };
  const modeLabels = { individual: "Individual project", team: "Team project" };
  let opener = null;
  let externalOpener = null;
  let transition = null;
  let pdfTimer = 0;
  let closing = false;
  let backdropPressed = false;
  let pdfReader = null;


  const text = (value) => typeof value === "string" ? value.trim() : "";
  const list = (value) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];
  const setText = (selector, value, fallback = "Not specified yet") => {
    dialog.querySelector(selector).textContent = text(value) || fallback;
  };

  function clearModel() {
    // Destroy the isolated document, including its WebGL context and textures.
    // Merely hiding a canvas would retain the model's GPU memory.
    modelMount.replaceChildren();
    modelMount.hidden = true;
    modelToggle.setAttribute("aria-expanded", "false");
    modelToggle.textContent = "Show 3D model ↗";
  }
  modelToggle.addEventListener("click", () => {
    if (!dialog.open || closing || modelSection.hidden) return;
    if (!modelMount.hidden) { clearModel(); return; }
    const frame = document.createElement("iframe");
    frame.src = new URL("assets/3D/viewer.html", document.baseURI).href;
    frame.title = "POT-C smart bin — interactive 3D model";
    frame.setAttribute("allow", "fullscreen");
    modelMount.replaceChildren(frame);
    modelMount.hidden = false;
    modelToggle.setAttribute("aria-expanded", "true");
    modelToggle.textContent = "Hide 3D model −";
  });
  window.addEventListener?.("message", event => {
    const frame = modelMount.firstElementChild;
    if (!frame || event.source !== frame.contentWindow || event.origin !== new URL(document.baseURI).origin) return;
    if (event.data?.type === "pot-c-model-close") closeProject();
    if (event.data?.type === "pot-c-model-focus-toggle") modelToggle.focus({preventScroll:true});
  });

  // Relative paths and HTTP(S) documents only; never inject HTML from project data.
  function documentURL(value) {
    if (!text(value)) return null;
    try {
      const url = new URL(value, document.baseURI);
      const localPreview = url.protocol === "file:" && location.protocol === "file:";
      return ["https:", "http:"].includes(url.protocol) || localPreview ? url : null;
    } catch {
      return null;
    }
  }

  function setLogo(value, whiteBackground, doubleSize) {
    logoMount.replaceChildren();
    logoMount.hidden = true;
    logoMount.dataset.whiteBackground = String(whiteBackground === true);
    logoMount.dataset.doubleSize = String(doubleSize === true);
    const url = documentURL(value);
    if (!url) return;
    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.addEventListener("error", () => {
      // A late error from a previous project must not hide the current logo.
      if (logoMount.firstElementChild !== image) return;
      logoMount.replaceChildren();
      logoMount.hidden = true;
    }, {once: true});
    image.src = url.href;
    logoMount.append(image);
    logoMount.hidden = false;
  }

  function clearDocument() {
    window.clearTimeout(pdfTimer);
    pdfReader?.destroy();
    pdfReader = null;
    pdfMount.replaceChildren();
    pdfMount.hidden = true;
    pdfEmpty.hidden = false;
    pdfLink.hidden = true;
    pdfLink.removeAttribute("href");
  }

  function mountDocument(url, title) {
    if (!dialog.open || closing) return;
    if (window.ProjectPDFViewer) {
      pdfMount.hidden = false;
      pdfEmpty.hidden = true;
      pdfReader = window.ProjectPDFViewer.create({mount: pdfMount, url, title, dialog});
      return;
    }
    const viewer = document.createElement("object");
    const embeddedURL = new URL(url.href);
    embeddedURL.hash = "view=FitH&toolbar=1&navpanes=0";
    viewer.type = "application/pdf";
    viewer.data = embeddedURL.href;
    viewer.setAttribute("aria-label", `${title} visual documentation PDF`);
    viewer.setAttribute("title", `${title} — interactive PDF`);
    viewer.tabIndex = 0;

    const fallback = document.createElement("div");
    fallback.className = "project-pdf-fallback";
    const message = document.createElement("p");
    message.textContent = "View the visual documentation in your browser's PDF reader.";
    const link = document.createElement("a");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open PDF ↗";
    fallback.append(message, link);
    viewer.append(fallback);
    pdfMount.replaceChildren(viewer);
    pdfMount.hidden = false;
    pdfEmpty.hidden = true;
  }

  function openProject(card, {direction = 0, returnFocus = null} = {}) {
    if (dialog.open && !direction) return;
    const switching = dialog.open;
    if (!switching) externalOpener = returnFocus;
    transition?.cancel();
    transition = null;
    const key = card.dataset.project;
    const entries = window.PORTFOLIO_PROJECTS || {};
    const project = Object.hasOwn(entries, key) ? entries[key] || {} : {};
    const title = text(project.title) || card.querySelector(".project-title")?.textContent.replace(/\s+/g, " ").trim() || "Project";
    const date = text(project.date) || card.querySelector("time")?.textContent || "";
    const type = list(project.type);
    const technologies = list(project.technologies);
    const cards = [...document.querySelectorAll("#project-list [data-project]")];
    opener = card;
    closing = false;
    dialog.classList.remove("is-closing");
    clearDocument();
    clearModel();
    modelSection.hidden = key !== "pot-c";

    // One color controls the entire project theme. Reset it on every open.
    const accent = /^#[\da-f]{6}$/i.test(text(project.accent)) ? text(project.accent) : "#93e7ff";
    const rgb = [1, 3, 5].map((offset) => parseInt(accent.slice(offset, offset + 2), 16)).join(" ");
    dialog.style.setProperty("--file-accent", accent);
    dialog.style.setProperty("--file-accent-rgb", rgb);
    setText("#project-dialog-title", title);
    setLogo(project.logo, project.logoWhiteBackground, project.logoDoubleSize);
    dialog.querySelectorAll("[data-project-title-echo]").forEach((echo) => { echo.textContent = title; });
    setText("[data-project-number]", `${String(cards.indexOf(card) + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`);
    const status = dialog.querySelector("[data-project-status]");
    status.dataset.status = Object.hasOwn(statusLabels, project.status) ? project.status : "pending";
    status.textContent = statusLabels[status.dataset.status] || "Not specified yet";
    setText("[data-project-role]", project.role);
    setText("[data-project-type]", type.join(" / ") || card.querySelector(".project-footer > span")?.textContent);
    setText("[data-project-date]", date);
    setText("[data-project-mode]", Object.hasOwn(modeLabels, project.mode) ? modeLabels[project.mode] : "");
    setText("[data-project-description]", project.description, "The story behind this project is coming soon.");

    const technologyList = dialog.querySelector("[data-project-technologies]");
    technologyList.replaceChildren(...technologies.map((technology) => {
      const item = document.createElement("li");
      item.textContent = technology;
      return item;
    }));
    technologyList.hidden = !technologies.length;
    dialog.querySelector("[data-project-no-technologies]").hidden = Boolean(technologies.length);

    const pdf = documentURL(project.pdf);
    setText("[data-project-document-label]", pdf ? "Interactive document" : "Visual documentation");
    setText("[data-project-document-state]", pdf ? "Ready" : "Pending");
    if (pdf) {
      pdfLink.href = pdf.href;
      pdfLink.hidden = false;
      pdfLink.setAttribute("aria-label", `Open ${title} PDF in a new tab`);
    }

    const source = card.getBoundingClientRect();
    document.documentElement.classList.add("project-dialog-open");
    if (!switching) dialog.showModal();
    details.scrollTop = 0;
    dialog.querySelector(".project-workspace").scrollTop = 0;
    if (switching && !reducedMotion.matches && typeof windowPanel.animate === "function") {
      // Replace content inside the same modal; a short directional transition
      // avoids replaying the full opening or unlocking the background scroll.
      windowPanel.style.setProperty("transform-origin", "50% 50%");
      transition = windowPanel.animate([
        {opacity: .15, transform: `translateX(${direction * 38}px) scale(.985)`, clipPath: "inset(0)"},
        {offset: .45, opacity: .85, transform: `translateX(${direction * 8}px) scale(.998)`, clipPath: "inset(0)"},
        {opacity: 1, transform: "none", clipPath: "inset(0)"}
      ], {duration: 360, easing: "cubic-bezier(.16, 1, .3, 1)"});
    } else if (!switching && !reducedMotion.matches && typeof windowPanel.animate === "function") {
      const target = dialog.getBoundingClientRect();
      const dx = Math.max(-70, Math.min(70, (source.left + source.width / 2 - target.left - target.width / 2) * .14));
      const dy = Math.max(-45, Math.min(45, (source.top + source.height / 2 - target.top - target.height / 2) * .12));
      const originX = Math.max(15, Math.min(85, (source.left + source.width / 2 - target.left) / target.width * 100));
      const originY = Math.max(15, Math.min(85, (source.top + source.height / 2 - target.top) / target.height * 100));
      windowPanel.style.setProperty("transform-origin", `${originX}% ${originY}%`);
      // A bright central seam expands into the full workspace. The title,
      // document and illuminated contour enter in coordinated CSS stages.
      transition = windowPanel.animate([
        { offset: 0, opacity: 0, transform: `perspective(1400px) translate3d(${dx}px, ${dy}px, 0) scale(.9) rotateX(6deg)`, clipPath: "inset(49.7% 42% 49.7% 42% round 12px)", easing: "ease-out" },
        { offset: .14, opacity: 1, transform: `perspective(1400px) translate3d(${dx * .4}px, ${dy * .4}px, 0) scale(.95) rotateX(3deg)`, clipPath: "inset(49.5% 8% 49.5% 8% round 12px)", easing: "cubic-bezier(.16, 1, .3, 1)" },
        { offset: .62, opacity: 1, transform: "perspective(1400px) translate3d(0, 3px, 0) scale(.995) rotateX(.5deg)", clipPath: "inset(0 0 0 0 round 16px)", easing: "ease-out" },
        { offset: .86, opacity: 1, transform: "none", clipPath: "inset(0 0 0 0 round 0px)" },
        { offset: 1, opacity: 1, transform: "none", clipPath: "inset(0 0 0 0 round 0px)" }
      ], { duration: entranceDuration, easing: "linear" });
    }
    // Create the native PDF viewer after the entrance, never on the initial page load.
    if (pdf) pdfTimer = window.setTimeout(() => mountDocument(pdf, title), reducedMotion.matches ? 0 : switching ? 360 : entranceDuration);
  }

  function navigateProject(direction) {
    if (!dialog.open || closing) return;
    const cards = [...document.querySelectorAll("#project-list [data-project]")];
    if (cards.length < 2) return;
    const index = cards.indexOf(opener);
    const next = cards[(index + direction + cards.length) % cards.length];
    // Focus remains on a stable control if a PDF or a 3D viewer is removed.
    const active = document.activeElement;
    const restoreFocus = active && active !== dialog && !active.closest?.(".project-window-actions");
    openProject(next, {direction});
    if (restoreFocus) closeButton.focus({preventScroll:true});
  }
  dialog.querySelector("[data-project-prev]").addEventListener("click", () => navigateProject(-1));
  dialog.querySelector("[data-project-next]").addEventListener("click", () => navigateProject(1));
  dialog.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    // Page navigation, numeric inputs and embedded model controls own their keys.
    if (event.target?.closest?.("input, textarea, select, [contenteditable], .project-reader-viewport, object, iframe")) return;
    event.preventDefault();
    navigateProject(event.key === "ArrowRight" ? 1 : -1);
  });

  function finishClose() {
    transition?.cancel();
    transition = null;
    dialog.close();
  }

  function closeProject() {
    if (!dialog.open || closing) return;
    closing = true;
    clearModel();
    window.clearTimeout(pdfTimer);
    // Preserve an interrupted entrance instead of flashing the full panel.
    const current = window.getComputedStyle(windowPanel);
    const from = {opacity: current.opacity, transform: current.transform, clipPath: current.clipPath};
    transition?.cancel();
    dialog.classList.add("is-closing");
    if (reducedMotion.matches || typeof windowPanel.animate !== "function") {
      finishClose();
      return;
    }
    transition = windowPanel.animate([
      from,
      { opacity: 0, transform: "translateY(12px) scale(.975)", clipPath: from.clipPath }
    ], { duration: 190, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" });
    const exit = transition;
    exit.finished.then(() => {
      if (closing && transition === exit) finishClose();
    }, () => {});
  }

  dialog.querySelectorAll("[data-project-reveal]").forEach((item, index) => {
    item.style.setProperty("--reveal-index", index);
  });
  document.querySelectorAll("#project-list [data-project]").forEach((card) => {
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-controls", dialog.id);
    card.addEventListener("click", () => openProject(card));
  });
  // Shared entry point for the Journey; there is still only one project reader.
  window.PortfolioProjects = {open(key, {returnFocus = null} = {}) {
    if (dialog.open || closing) return false;
    const card = [...document.querySelectorAll("#project-list [data-project]")].find(item => item.dataset.project === key);
    if (!card) return false;
    openProject(card, {returnFocus});
    return true;
  }};
  closeButton.addEventListener("click", closeProject);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeProject();
  });
  const outside = (event) => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  dialog.addEventListener("pointerdown", (event) => { backdropPressed = event.target === dialog && outside(event); });
  dialog.addEventListener("click", (event) => {
    if (backdropPressed && event.target === dialog && outside(event)) closeProject();
    backdropPressed = false;
  });
  dialog.addEventListener("close", () => {
    clearModel();
    clearDocument();
    transition?.cancel();
    transition = null;
    document.documentElement.classList.remove("project-dialog-open");
    dialog.classList.remove("is-closing");
    closing = false;
    (externalOpener || opener)?.focus({ preventScroll: true });
    externalOpener = null;
    opener = null;
  });
  reducedMotion.addEventListener("change", () => {
    if (!reducedMotion.matches) return;
    if (closing) finishClose();
    else transition?.cancel();
  });
})();
