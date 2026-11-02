const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const dataSource = fs.readFileSync(path.join(root, "data/projects.js"), "utf8");
const controller = fs.readFileSync(path.join(root, "assets/js/project-dialog.js"), "utf8");

function element() {
  const listeners = new Map();
  const classes = new Set();
  const properties = new Map();
  return {
    textContent: "", dataset: {}, children: [], hidden: false, focused: false,
    get firstElementChild() { return this.children[0] || null; },
    attributes: new Map(), scrollTop: 30, animations: [],
    properties,
    style: { setProperty(name, value) { properties.set(name, value); } },
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
    replaceChildren(...nodes) { this.children = nodes; },
    append(...nodes) { this.children.push(...nodes); },
    focus() { this.focused = true; },
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(listener);
    },
    emit(name, event = {}) { (listeners.get(name) || []).forEach(listener => listener(event)); },
    getBoundingClientRect: () => ({ left: 20, top: 20, right: 980, bottom: 780, width: 960, height: 760 }),
    animate(frames, options) {
      let resolve;
      const animation = { frames, options, cancelled: false, finished: new Promise(done => { resolve = done; }), cancel() { this.cancelled = true; }, finish() { resolve(); } };
      this.animations.push(animation);
      return animation;
    }
  };
}

function setup({ reduced = true, fine = true } = {}) {
  const nodes = new Map();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  const dialog = get("#project-dialog");
  dialog.id = "project-dialog";
  dialog.open = false;
  dialog.querySelector = get;
  dialog.querySelectorAll = () => Array.from({ length: 9 }, element);
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.emit("close"); };
  const documentElement = element();
  const timers = new Map();
  const frames = new Map();
  let frameId = 0;
  const motion = element();
  motion.matches = reduced;
  const pointer = element();
  pointer.matches = fine;
  const window = {
    matchMedia: query => query.includes("prefers-reduced-motion") ? motion : pointer,
    getComputedStyle: node => node.computedStyle || {opacity: "1", transform: "none", clipPath: "none"},
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  const context = vm.createContext({ window, URL, location: { protocol: "http:" } });
  vm.runInContext(dataSource, context);
  const cards = Object.entries(window.PORTFOLIO_PROJECTS).map(([key, project]) => {
    const card = element();
    card.dataset.project = key;
    card.querySelector = selector => ({ textContent: selector === ".project-title" ? project.title : selector === "time" ? project.date : project.type.join(" / ") });
    return card;
  });
  context.document = {
    baseURI: "http://localhost/portfolio/index.html",
    documentElement,
    querySelector: get,
    querySelectorAll: () => cards,
    createElement(tag) { const node = element(); node.tag = tag; return node; }
  };
  vm.runInContext(controller, context);
  return {
    get, dialog, cards, window, timers, frames, documentElement, motion,
    open(key) { cards.find(card => card.dataset.project === key).emit("click"); },
    escape() { const event = { prevented: false, preventDefault() { this.prevented = true; } }; dialog.emit("cancel", event); return event; },
    flushTimers() { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } },
    flushFrames() { for (const [id, fn] of [...frames]) { frames.delete(id); fn(); } }
  };
}

test("every project card has its own data entry and the requested field order", () => {
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(dataSource, ctx);
  const cards = [...html.matchAll(/data-project="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(cards, ["beyond", "plant-bud", "pot-c", "cecam", "pets-health"]);
  assert.deepEqual(Object.keys(ctx.window.PORTFOLIO_PROJECTS), cards);
  const template = html.slice(html.indexOf('<dialog class="project-modal"'), html.indexOf("</dialog>", html.indexOf('<dialog class="project-modal"')));
  assert.deepEqual([...template.matchAll(/<dt>(.*?)<\/dt>/g)].map(match => match[1]),
    ["Status", "Role", "Project type", "Development date", "Collaboration", "Technologies", "Description"]);
  assert(template.indexOf('id="project-dialog-title"') < template.indexOf("<dt>Status"));
  assert(html.indexOf('src="data/projects.js"') < html.indexOf('src="assets/js/project-dialog.js"'));
});

test("only POT-C offers the 3D section and never loads a frame just by opening", () => {
  const s=setup();
  for(const key of ["beyond","plant-bud","pot-c","cecam","pets-health"]){
    s.open(key);
    assert.equal(s.get("[data-project-model]").hidden,key!=="pot-c");
    assert.equal(s.get("[data-project-model-mount]").children.length,0);
    assert.equal(s.get("[data-project-model-toggle]").attributes.get("aria-expanded"),"false");
    s.escape();
  }
});
test("show creates one local frame, hide destroys it, and closing always resets it", () => {
  const s=setup(),mount=s.get("[data-project-model-mount]"),toggle=s.get("[data-project-model-toggle]");
  s.open("pot-c");toggle.emit("click");
  assert.equal(mount.children.length,1);assert.equal(mount.hidden,false);
  assert.equal(mount.children[0].src,"http://localhost/portfolio/assets/3D/viewer.html");
  toggle.emit("click");assert.equal(mount.children.length,0);assert.equal(mount.hidden,true);
  toggle.emit("click");s.escape();assert.equal(mount.children.length,0);
  s.open("pot-c");assert.equal(mount.hidden,true);assert.equal(mount.children.length,0);
});
test("3D resources are local, self-contained and use the exact published GLB casing", () => {
  const viewer=fs.readFileSync(path.join(root,"assets/3D/viewer.html"),"utf8");
  assert(viewer.includes('src="Basurero.glb"'));assert(viewer.includes("camera-controls"));
  assert(fs.existsSync(path.join(root,"assets/3D/Basurero.glb")));
  assert(fs.existsSync(path.join(root,"assets/model-viewer/model-viewer.min.js")));
  for(const name of ["index.html","index-mobile.html"]){const page=fs.readFileSync(path.join(root,name),"utf8");assert(!page.includes('src="assets/model-viewer/'));assert(!page.includes('src="assets/3D/Basurero.glb"'));}
});

test("clicking different cards refreshes all content without carrying over technologies or status", () => {
  const s = setup();
  s.open("plant-bud");
  assert.equal(s.get("#project-dialog-title").textContent, "Plant Bud");
  assert.equal(s.get("[data-project-role]").textContent, "Frontend / Backend");
  assert.equal(s.get("[data-project-type]").textContent, "Web / PWA");
  assert.equal(s.get("[data-project-date]").textContent, "2026");
  assert.equal(s.get("[data-project-technologies]").children.length, 6);
  s.escape();
  s.window.PORTFOLIO_PROJECTS.cecam.technologies = [];
  s.open("cecam");
  assert.equal(s.get("#project-dialog-title").textContent, "CECAM");
  assert.equal(s.get("[data-project-status]").textContent, "Prototype");
  assert.equal(s.get("[data-project-date]").textContent, "2025");
  assert.equal(s.get("[data-project-technologies]").children.length, 0);
  assert.equal(s.get("[data-project-no-technologies]").hidden, false);
  s.escape();
  s.open("beyond");
  assert.equal(s.get("[data-project-status]").dataset.status, "completed");
});

test("project logos are configurable independently and never carry over between records", () => {
  const s = setup(), mount = s.get("[data-project-logo]");
  s.window.PORTFOLIO_PROJECTS.beyond.logo = "images/Projects/beyond-logo.svg";
  s.open("beyond");
  assert.equal(mount.hidden, false);
  assert.equal(mount.children.length, 1);
  assert.equal(mount.firstElementChild.src, "http://localhost/portfolio/images/Projects/beyond-logo.svg");
  assert.equal(mount.firstElementChild.alt, "");
  const previous = mount.firstElementChild;
  s.escape();
  s.window.PORTFOLIO_PROJECTS.cecam.logo = "images/Projects/cecam-logo.png";
  s.open("cecam");
  previous.emit("error");
  assert.equal(mount.hidden, false, "a stale image error cannot hide a different project's logo");
  assert.equal(mount.firstElementChild.src, "http://localhost/portfolio/images/Projects/cecam-logo.png");
  mount.firstElementChild.emit("error");
  assert.equal(mount.hidden, true);
  assert.equal(mount.children.length, 0);
  s.escape();
  s.window.PORTFOLIO_PROJECTS["plant-bud"].logo = "";
  s.open("plant-bud");
  assert.equal(mount.hidden, true);
  assert.equal(mount.children.length, 0);
});

test("empty, missing and invalid logo values leave the title usable without a broken image", () => {
  for (const logo of ["", undefined, {}, "javascript:alert(1)", "data:text/html,test", "http://["]) {
    const s = setup();
    s.window.PORTFOLIO_PROJECTS.beyond.logo = logo;
    s.open("beyond");
    assert.equal(s.get("[data-project-logo]").hidden, true);
    assert.equal(s.get("[data-project-logo]").children.length, 0);
    assert.equal(s.get("#project-dialog-title").textContent, "Beyond");
  }
});

test("missing entries and empty or malformed fields keep the project usable", () => {
  const s = setup();
  delete s.window.PORTFOLIO_PROJECTS.beyond;
  s.open("beyond");
  assert.equal(s.get("#project-dialog-title").textContent, "Beyond");
  assert.equal(s.get("[data-project-type]").textContent, "Web");
  assert.equal(s.get("[data-project-description]").textContent, "The story behind this project is coming soon.");
  s.escape();
  s.window.PORTFOLIO_PROJECTS.beyond = { technologies: "not a list", type: null, role: {}, status: "unknown", mode: "unknown" };
  s.open("beyond");
  assert.equal(s.get("[data-project-role]").textContent, "Not specified yet");
  assert.equal(s.get("[data-project-mode]").textContent, "Not specified yet");
  assert.equal(s.get("[data-project-technologies]").hidden, true);
});

test("editable text remains plain text, and status and collaboration have English labels", () => {
  const s = setup();
  Object.assign(s.window.PORTFOLIO_PROJECTS.beyond, {
    status: "in-development", mode: "team", description: "<img src=x onerror=alert(1)>\nSecond paragraph",
    technologies: ["JavaScript", "", null]
  });
  s.open("beyond");
  assert.equal(s.get("[data-project-status]").textContent, "In development");
  assert.equal(s.get("[data-project-mode]").textContent, "Team project");
  assert.equal(s.get("[data-project-description]").children.length, 0);
  assert.match(s.get("[data-project-description]").textContent, /^<img/);
  assert.equal(s.get("[data-project-technologies]").children.length, 1);
});

test("PDFs mount lazily, have an external-reader fallback, and are released on close", () => {
  const s = setup();
  s.window.PORTFOLIO_PROJECTS.beyond.pdf = "pdfs/beyond.pdf";
  s.open("beyond");
  const mount = s.get("[data-project-pdf-mount]");
  assert.equal(mount.children.length, 0);
  assert.equal(s.get("[data-project-pdf-link]").href, "http://localhost/portfolio/pdfs/beyond.pdf");
  s.flushTimers();
  assert.equal(mount.hidden, false);
  const pdf = mount.children[0];
  assert.equal(pdf.type, "application/pdf");
  assert.match(pdf.data, /beyond\.pdf#view=FitH&toolbar=1&navpanes=0$/);
  assert.equal(pdf.children[0].children[1].target, "_blank");
  s.escape();
  assert.equal(mount.children.length, 0);
  assert.equal(s.get("[data-project-pdf-link]").hidden, true);
  s.window.PORTFOLIO_PROJECTS["plant-bud"].pdf = "";
  s.open("plant-bud");
  s.flushTimers();
  assert.equal(mount.children.length, 0);
  assert.equal(s.get("[data-project-pdf-empty]").hidden, false);
});

test("unsafe or invalid PDF URLs never create a viewer or link", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "http://[", " "]) {
    const s = setup();
    s.window.PORTFOLIO_PROJECTS.beyond.pdf = url;
    s.open("beyond");
    s.flushTimers();
    assert.equal(s.get("[data-project-pdf-link]").hidden, true);
    assert.equal(s.get("[data-project-pdf-mount]").children.length, 0);
  }
});

test("the custom reader is created only after the entrance and destroyed on close", () => {
  const s = setup();
  let options;
  let destroyed = false;
  s.window.ProjectPDFViewer = {create(input) {options = input;return {destroy() {destroyed = true;}};}};
  s.window.PORTFOLIO_PROJECTS.beyond.pdf = "pdfs/Beyond.pdf";
  s.open("beyond");
  assert.equal(options, undefined);
  s.flushTimers();
  assert.equal(options.title, "Beyond");
  assert.equal(options.url.href, "http://localhost/portfolio/pdfs/Beyond.pdf");
  assert.equal(options.dialog, s.dialog);
  assert.equal(destroyed, false);
  s.escape();
  assert.equal(destroyed, true);
});

test("local PDF paths match filename casing for GitHub Pages", () => {
  const context = {window:{}};
  vm.runInNewContext(dataSource, context);
  for (const project of Object.values(context.window.PORTFOLIO_PROJECTS)) {
    if (!project.pdf || /^https?:/.test(project.pdf)) continue;
    const folder = path.dirname(path.join(root, project.pdf));
    assert(fs.readdirSync(folder).includes(path.basename(project.pdf)), `PDF path casing must match: ${project.pdf}`);
  }
});

function arrow(s,key,extra={}) {
  const event={key,prevented:false,preventDefault(){this.prevented=true;},...extra};
  s.dialog.emit("keydown",event);return event;
}
test("Journey shares the project modal and closing returns focus to its chapter link",()=>{
  const s=setup(),chapterLink=element();
  assert.equal(s.window.PortfolioProjects.open('missing',{returnFocus:chapterLink}),false);
  assert.equal(s.window.PortfolioProjects.open('pot-c',{returnFocus:chapterLink}),true);
  assert.equal(s.get('#project-dialog-title').textContent,'POT-C');
  assert.equal(s.window.PortfolioProjects.open('beyond'),false);
  arrow(s,'ArrowRight');s.escape();assert(chapterLink.focused);
});
test("arrows switch inside the same modal, wrap in both directions and restore focus to the current project",()=>{
  const s=setup();s.open("beyond");
  let closes=0; s.dialog.addEventListener("close",()=>closes++);
  assert(arrow(s,"ArrowLeft").prevented);assert.equal(s.get("#project-dialog-title").textContent,"Pet's Health");
  arrow(s,"ArrowRight");assert.equal(s.get("#project-dialog-title").textContent,"Beyond");
  arrow(s,"ArrowRight");assert.equal(s.get("#project-dialog-title").textContent,"Plant Bud");
  assert(s.dialog.open);assert.equal(closes,0);assert(s.documentElement.classList.contains("project-dialog-open"));
  s.escape();assert(s.cards[1].focused);
});
test("PDF page keys, editable controls, handled events and modifier shortcuts never switch projects",()=>{
  const s=setup();s.open("beyond");
  for(const extra of [{defaultPrevented:true},{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{target:{closest:()=>({})}}]){
    const event=arrow(s,"ArrowRight",extra);assert(!event.prevented);assert.equal(s.get("#project-dialog-title").textContent,"Beyond");
  }
});
test("rapid switches release old readers and models and only mount the final document",()=>{
  const s=setup();let mounted=[],destroyed=0;
  s.window.ProjectPDFViewer={create:({title})=>{mounted.push(title);return{destroy(){destroyed++;}};}};
  s.open("beyond");s.flushTimers();arrow(s,"ArrowRight");arrow(s,"ArrowRight");
  s.get("[data-project-model-toggle]").emit("click");assert.equal(s.get("[data-project-model-mount]").children.length,1);
  arrow(s,"ArrowRight");assert.equal(s.get("[data-project-model-mount]").children.length,0);
  s.flushTimers();assert.deepEqual(mounted,["Beyond","CECAM"]);assert.equal(destroyed,1);
  assert.equal(s.get("[data-project-model]").hidden,true);
});
test("switches use directional transitions, cancel interrupted animation and honor reduced motion",()=>{
  const s=setup({reduced:false}),panel=s.get(".project-window");s.open("beyond");
  arrow(s,"ArrowRight");assert(panel.animations[0].cancelled);assert.equal(panel.animations[1].options.duration,360);
  assert.match(panel.animations[1].frames[0].transform,/translateX\(38px\)/);
  arrow(s,"ArrowLeft");assert(panel.animations[1].cancelled);assert.match(panel.animations[2].frames[0].transform,/translateX\(-38px\)/);
  const reduced=setup();reduced.open("beyond");reduced.get("[data-project-next]").emit("click");
  assert.equal(reduced.get("#project-dialog-title").textContent,"Plant Bud");assert.equal(reduced.get(".project-window").animations.length,0);
});

test("each project resets its neon theme, including missing or invalid colors", () => {
  const s = setup();
  s.window.PORTFOLIO_PROJECTS.beyond.accent = "#12ABef";
  s.open("beyond");
  assert.equal(s.dialog.properties.get("--file-accent"), "#12ABef");
  assert.equal(s.dialog.properties.get("--file-accent-rgb"), "18 171 239");
  s.escape();
  s.open("plant-bud");
  assert.equal(s.dialog.properties.get("--file-accent"), "#a7f3c5");
  s.escape();
  s.window.PORTFOLIO_PROJECTS.beyond.accent = "red; background: url(test)";
  s.open("beyond");
  assert.equal(s.dialog.properties.get("--file-accent"), "#93e7ff");
  assert.equal(s.dialog.properties.get("--file-accent-rgb"), "147 231 255");
  s.escape();
  delete s.window.PORTFOLIO_PROJECTS.beyond;
  s.open("beyond");
  assert.equal(s.dialog.properties.get("--file-accent"), "#93e7ff");
});

test("Escape, close button and backdrop release the scroll lock and return focus", () => {
  const s = setup();
  s.open("beyond");
  assert(s.documentElement.classList.contains("project-dialog-open"));
  assert.equal(s.get(".project-details").scrollTop, 0);
  assert(s.escape().prevented);
  assert(!s.dialog.open);
  assert(!s.documentElement.classList.contains("project-dialog-open"));
  assert(s.cards[0].focused);
  s.open("beyond");
  s.get(".project-close").emit("click");
  assert(!s.dialog.open);
  s.open("beyond");
  const event = { target: s.dialog, clientX: 1, clientY: 1 };
  s.dialog.emit("pointerdown", event);
  s.dialog.emit("click", event);
  assert(!s.dialog.open);
});

test("dragging from inside to the backdrop does not dismiss the file", () => {
  const s = setup();
  s.open("beyond");
  s.dialog.emit("pointerdown", { target: s.get(".project-details"), clientX: 100, clientY: 100 });
  s.dialog.emit("click", { target: s.dialog, clientX: 1, clientY: 1 });
  assert(s.dialog.open);
});

test("fast animated closing cancels a pending PDF and completes once; reduced motion has no JS animation", async () => {
  const s = setup({ reduced: false });
  s.window.PORTFOLIO_PROJECTS.beyond.pdf = "pdfs/beyond.pdf";
  s.open("beyond");
  const panel = s.get(".project-window");
  assert.equal(panel.animations.length, 1);
  s.escape();
  s.escape();
  assert.equal(panel.animations.length, 2);
  s.flushTimers();
  assert.equal(s.get("[data-project-pdf-mount]").children.length, 0);
  panel.animations[1].finish();
  await Promise.resolve();
  assert(!s.dialog.open);
  assert(!s.documentElement.classList.contains("project-dialog-open"));
  const reduced = setup();
  reduced.open("beyond");
  reduced.escape();
  assert.equal(reduced.get(".project-window").animations.length, 0);
});

test("the staged entrance unfolds fully before mounting a PDF, and replays cleanly on another project", async () => {
  const s = setup({reduced: false}), panel = s.get(".project-window");
  s.cards[0].getBoundingClientRect = () => ({left: -600, top: -400, width: 300, height: 200});
  s.open("beyond");
  const entrance = panel.animations[0];
  assert.equal(entrance.options.duration, 1000);
  assert.equal(entrance.frames.length, 5);
  assert.match(entrance.frames[0].clipPath, /49\.7%/);
  assert.equal(entrance.frames.at(-1).transform, "none");
  assert.equal(entrance.frames.at(-1).opacity, 1);
  assert.equal(entrance.frames.at(-1).clipPath, "inset(0 0 0 0 round 0px)");
  assert.equal(panel.properties.get("transform-origin"), "15% 15%");
  assert.equal(s.get("[data-project-pdf-mount]").children.length, 0);
  entrance.finish();
  s.flushTimers();
  assert.equal(s.get("[data-project-pdf-mount]").children.length, 1);
  s.escape();
  panel.animations.at(-1).finish();
  await Promise.resolve();
  s.open("plant-bud");
  assert.equal(panel.animations.length, 3);
  assert.equal(panel.animations.at(-1).frames[0].opacity, 0);
  assert.equal(s.get("[data-project-pdf-mount]").children.length, 0);
});

test("closing an interrupted entrance preserves its current aperture and preference changes finish safely", async () => {
  const s = setup({reduced: false}), panel = s.get(".project-window");
  s.open("beyond");
  panel.computedStyle = {opacity: ".62", transform: "matrix(0.95, 0, 0, 0.95, 0, 12)", clipPath: "inset(40% 8% 40% 8% round 12px)"};
  s.escape();
  const exit = panel.animations.at(-1);
  assert.equal(panel.animations[0].cancelled, true);
  assert.deepEqual({...exit.frames[0]}, panel.computedStyle);
  assert.equal(exit.frames[1].clipPath, panel.computedStyle.clipPath);
  s.motion.matches = true;
  s.motion.emit("change");
  assert.equal(s.dialog.open, false);
  assert.equal(s.timers.size, 0);
  // Completing a cancelled exit later cannot close a newly opened project.
  s.open("cecam");
  exit.finish();
  await Promise.resolve();
  assert.equal(s.dialog.open, true);
});
