(() => {
  const dialog = document.querySelector("#project-dialog");
  if (!dialog) return;

  const windowPanel = dialog.querySelector(".project-window");
  const details = dialog.querySelector(".project-details");
  const closeButton = dialog.querySelector(".project-close");
  const pdfMount = dialog.querySelector("[data-project-pdf-mount]");
  const pdfEmpty = dialog.querySelector("[data-project-pdf-empty]");
  const pdfLink = dialog.querySelector("[data-project-pdf-link]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const statusLabels = {
    "in-development": "In development",
    prototype: "Prototype",
    completed: "Completed"
  };
  const modeLabels = { individual: "Individual project", team: "Team project" };
  let opener = null;
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

  function openProject(card) {
    if (dialog.open) return;
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

    // One color controls the entire project theme. Reset it on every open.
    const accent = /^#[\da-f]{6}$/i.test(text(project.accent)) ? text(project.accent) : "#93e7ff";
    const rgb = [1, 3, 5].map((offset) => parseInt(accent.slice(offset, offset + 2), 16)).join(" ");
    dialog.style.setProperty("--file-accent", accent);
    dialog.style.setProperty("--file-accent-rgb", rgb);
    setText("#project-dialog-title", title);
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
    dialog.showModal();
    details.scrollTop = 0;
    dialog.querySelector(".project-workspace").scrollTop = 0;
    if (!reducedMotion.matches && typeof windowPanel.animate === "function") {
      const target = dialog.getBoundingClientRect();
      const dx = Math.max(-70, Math.min(70, (source.left + source.width / 2 - target.left - target.width / 2) * .14));
      const dy = Math.max(-45, Math.min(45, (source.top + source.height / 2 - target.top - target.height / 2) * .12));
      transition = windowPanel.animate([
        { opacity: 0, transform: `translate3d(${dx}px, ${dy}px, 0) scale(.92)` },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }
      ], { duration: 680, easing: "cubic-bezier(.16, 1, .3, 1)" });
    }
    // Create the native PDF viewer after the entrance, never on the initial page load.
    if (pdf) pdfTimer = window.setTimeout(() => mountDocument(pdf, title), reducedMotion.matches ? 0 : 560);
  }

  function finishClose() {
    transition?.cancel();
    transition = null;
    dialog.close();
  }

  function closeProject() {
    if (!dialog.open || closing) return;
    closing = true;
    window.clearTimeout(pdfTimer);
    transition?.cancel();
    dialog.classList.add("is-closing");
    if (reducedMotion.matches || typeof windowPanel.animate !== "function") {
      finishClose();
      return;
    }
    transition = windowPanel.animate([
      { opacity: 1, transform: "translateY(0) scale(1)" },
      { opacity: 0, transform: "translateY(12px) scale(.975)" }
    ], { duration: 190, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" });
    transition.finished.then(finishClose, () => {});
  }

  dialog.querySelectorAll("[data-project-reveal]").forEach((item, index) => {
    item.style.setProperty("--reveal-index", index);
  });
  document.querySelectorAll("#project-list [data-project]").forEach((card) => {
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-controls", dialog.id);
    card.addEventListener("click", () => openProject(card));
  });
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
    clearDocument();
    transition?.cancel();
    transition = null;
    document.documentElement.classList.remove("project-dialog-open");
    dialog.classList.remove("is-closing");
    closing = false;
    opener?.focus({ preventScroll: true });
    opener = null;
  });
  reducedMotion.addEventListener("change", () => {
    if (!reducedMotion.matches) return;
    if (closing) finishClose();
    else transition?.cancel();
  });
})();
