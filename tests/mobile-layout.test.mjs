import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {DOMParser} from "linkedom";

const root = new URL("../", import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), "utf8");
const desktop = read("index.html"), mobile = read("index-mobile.html");
const router = read("assets/js/device-router.js");
const parse = html => new DOMParser().parseFromString(html, "text/html");

function route({width, coarse = false, page = "index.html", query = "", hash = ""}) {
  let destination = null;
  const location = {href: `https://example.test/Portafolio/${page}${query}${hash}`, replace: url => { destination = url; }};
  vm.runInNewContext(router, {
    URL,
    document: {currentScript: {src: "https://example.test/Portafolio/assets/js/device-router.js", dataset: {layout: page === "index-mobile.html" ? "mobile" : "desktop"}}},
    window: {location, matchMedia: query => ({matches: query === "(pointer: coarse)" ? coarse : width <= Number(query.match(/\d+/)[0])})}
  });
  return destination;
}

test("entry routing selects a phone layout and preserves subdirectory, query and deep link", () => {
  for (const width of [320, 360, 390, 430, 768, 900]) {
    assert.equal(route({width, query: "?ref=portfolio", hash: "#certificates"}), "https://example.test/Portafolio/index-mobile.html?ref=portfolio#certificates");
  }
  assert.equal(route({width: 915, coarse: true}), "https://example.test/Portafolio/index-mobile.html");
  assert.equal(route({width: 1024, coarse: true}), "https://example.test/Portafolio/index-mobile.html");
  assert.equal(route({width: 1280}), null);
  assert.equal(route({width: 1440, coarse: true}), null);
});

test("correct layouts never loop and explicit preview choices work on either screen", () => {
  assert.equal(route({width: 390, page: "index-mobile.html"}), null);
  assert.equal(route({width: 1440, page: "index-mobile.html"}), "https://example.test/Portafolio/index.html");
  assert.equal(route({width: 390, query: "?view=desktop"}), null);
  assert.equal(route({width: 1440, query: "?view=mobile", hash: "#projects"}), "https://example.test/Portafolio/index-mobile.html?view=mobile#projects");
  assert.equal(route({width: 1440, page: "index-mobile.html", query: "?view=mobile"}), null);
});

test("mobile preserves all portfolio sections, records, project identities and shared data controllers", () => {
  const pc = parse(desktop), phone = parse(mobile);
  for (const selector of ["main .section[id]", "#project-list [data-project]", "[data-mind-panel]", "[data-credential-lane]"]) {
    const identity = node => node.id || node.dataset.project || node.dataset.mindPanel || node.dataset.credentialLane;
    assert.deepEqual([...phone.querySelectorAll(selector)].map(identity), [...pc.querySelectorAll(selector)].map(identity));
  }
  const content = node => node.textContent.replace(/\s+/g, " ").trim();
  for (const selector of [".about-introduction", ".mind-copy", ".mind-note", ".about-personal", ".contact-intro", ".contact-networks", ".contact-details"]) {
    assert.deepEqual([...phone.querySelectorAll(selector)].map(content), [...pc.querySelectorAll(selector)].map(content), selector);
  }
  for (const src of ["data/projects.js", "assets/js/project-dialog.js", "assets/js/project-pdf-viewer.js", "assets/js/credentials.js", "assets/js/assistant.js", "assets/js/app.js"]) {
    assert(phone.querySelector(`script[src="${src}"]`));
  }
  assert.equal(pc.querySelector('link[href="assets/css/mobile.css"]'), null);
  assert(phone.querySelector('link[href="assets/css/mobile.css"]'));
  assert(phone.querySelector("#start [data-hero-story] [data-hero-scene] [data-hero-scene-content]"), "phones share the desktop scroll timeline");
  assert.equal(phone.querySelectorAll(".hero-identity > .profile-facts").length, 2);
});

test("both pages use closing-tag glitch brackets and section labels without an opening bracket", () => {
  for (const source of [desktop, mobile]) {
    const doc = parse(source);
    assert.equal(doc.querySelector('.hero-code-open').textContent, '</');
    assert.equal(doc.querySelector('.hero-code-close').textContent, '>');
    for (const section of doc.querySelectorAll('main .section[id]')) {
      const label = [...section.children].find(node => node.tagName === 'SPAN');
      assert(label.textContent.trim().endsWith('/>'));
      assert(!label.textContent.includes('<'));
      if (source === mobile) assert(label.classList.contains('mobile-eyebrow'));
    }
  }
});

test("mobile controls initialize after their markup and menus put identity before documents", () => {
  const doc = parse(mobile);
  assert(mobile.indexOf('class="nav mobile-nav"') < mobile.indexOf('src="assets/js/app.js"'));
  assert(mobile.indexOf('src="assets/js/device-router.js"') < mobile.indexOf('src="https://cdn.tailwindcss.com"'));
  assert.deepEqual([...doc.querySelectorAll(".mobile-nav a")].map(node => node.hash || node.getAttribute("href")), ["#start", "#about-me", "#projects", "#certificates", "#contact"]);
  assert.equal(doc.querySelector(".project-workspace").firstElementChild.className, "project-details");
  assert.equal(doc.querySelector(".credential-workspace").firstElementChild.className, "credential-metadata");
  assert(doc.querySelector(".mobile-filters > summary"));
  assert.equal(doc.querySelector('.contact-details').closest('details'), null, 'direct contact is always expanded');
  assert.equal(doc.querySelectorAll(".mobile-note > summary").length, 3);
  const ids = [...doc.querySelectorAll("[id]")].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length, "mobile markup has no duplicate IDs");
  const pc = parse(desktop);
  const labels = doc => [...doc.querySelectorAll('.nav a')].map(a => a.textContent.replace(/\//g, '').trim());
  assert.deepEqual(labels(doc), labels(pc), "both layouts use the same navigation labels");
  assert.equal(doc.querySelector('.mobile-header-contact').getAttribute('href'), pc.querySelector('.site-header > a:last-child').getAttribute('href'));
  for (const page of [doc, pc]) {
    assert(page.querySelector('.site-ambient'));
    assert.equal([...page.querySelectorAll('body > div')].some(node => node.className.includes('72px_72px')), false);
  }
});

function setupMobile() {
  const document = parse(mobile);
  const {HTMLElement, Event, MutationObserver} = document.defaultView;
  let focused = document.body;
  Object.defineProperty(document, "activeElement", {get: () => focused});
  HTMLElement.prototype.focus = function () { focused = this; };
  HTMLElement.prototype.getClientRects = function () { return this.hidden ? [] : [{}]; };
  HTMLElement.prototype.scrollIntoView = function (options) { this.scrolled = options; };
  const chat = document.createElement("div");
  chat.className = "portfolio-assistant";
  chat.innerHTML = '<button class="assistant-launcher" aria-expanded="false"></button><section class="assistant-panel"><button class="assistant-close"></button><a href="index.html#about-me">About</a><textarea></textarea><button class="assistant-send"></button></section>';
  document.body.append(chat);
  const listeners = new Map();
  const listen = (type, callback) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(callback); };
  const dispatch = (type, event = {}) => (listeners.get(type) || []).forEach(callback => callback(event));
  const visual = {height: 844, offsetTop: 0, addEventListener(type, callback) { listen(`visual-${type}`, callback); }};
  const paths = [];
  const frames = new Map();let nextFrame = 0;
  Object.defineProperty(document.documentElement, 'scrollHeight', {value: 4000});
  const window = {visualViewport: visual, scrollY: 0, innerHeight: 844,
    addEventListener: listen,
    requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id) { frames.delete(id); }
  };
  const context = vm.createContext({
    document, URL, MutationObserver, queueMicrotask, innerWidth: 390, innerHeight: 844,
    matchMedia: () => ({matches: false}),
    location: {href: "https://example.test/Portafolio/index-mobile.html?view=mobile"},
    history: {pushState(state, unused, url) { paths.push(String(url)); }},
    window
  });
  vm.runInContext(read("assets/js/mobile.js"), context);
  return {
    document, chat, visual, paths, dispatch,
    get: selector => document.querySelector(selector),
    event(target, type, values = {}) { const event = new Event(type, {bubbles: true, cancelable: true}); Object.assign(event, values); target.dispatchEvent(event); return event; },
    async settle() { for (let i = 0; i < 5; i++) await Promise.resolve(); },
    resize(height) { visual.height = height; dispatch("visual-resize"); },
    scroll(y) { window.scrollY = y; dispatch('scroll'); const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); }
  };
}

test("mobile chat isolates the background, traps keyboard focus and fits a reduced visual viewport", async () => {
  const s = setupMobile();
  const launcher = s.get(".assistant-launcher"), panel = s.get(".assistant-panel");
  launcher.setAttribute("aria-expanded", "true");
  await s.settle();
  assert.equal(s.get("main").inert, true);
  assert.equal(panel.getAttribute("aria-modal"), "true");
  assert.equal(s.document.activeElement, s.get(".assistant-close"));
  s.get(".assistant-send").focus();
  assert(s.event(panel, "keydown", {key: "Tab", shiftKey: false}).defaultPrevented);
  assert.equal(s.document.activeElement, s.get(".assistant-close"));
  s.get("textarea").focus();
  s.resize(420);
  assert(s.document.body.hasAttribute("data-mobile-keyboard"));
  assert.equal(s.document.body.style.getPropertyValue("--mobile-visual-height"), "420px");
  launcher.setAttribute("aria-expanded", "false");
  await s.settle();
  assert.equal(s.get("main").inert, false);
  assert.equal(s.document.body.hasAttribute("data-mobile-keyboard"), false);
});

test("canonical section links stay mobile, but explicit desktop links retain their destination", () => {
  const s = setupMobile();
  const link = s.chat.querySelector('a');
  assert(s.event(link, "click", {button: 0}).defaultPrevented);
  assert.equal(s.paths[0], "https://example.test/Portafolio/index-mobile.html?view=mobile#about-me");
  assert.equal(s.get("#about-me").scrolled.block, "start");
  assert.equal(s.event(s.get(".mobile-version-link"), "click", {button: 0}).defaultPrevented, false);
});

test("reopening mobile record sheets resets the reading position to their identity", async () => {
  const s = setupMobile();
  for (const selector of ["#project-dialog", "#credential-dialog"]) {
    const dialog = s.get(selector), workspace = dialog.querySelector('.project-workspace, .credential-workspace');
    Object.defineProperty(dialog, "open", {get() { return this.hasAttribute("open"); }});
    workspace.scrollTop = 500;
    dialog.setAttribute("open", "");
    await s.settle();
    assert.equal(workspace.scrollTop, 0);
  }
});

test("both mobile bars hide downwards and return after accumulated upward touch movements", () => {
  const s = setupMobile(), body = s.document.body;
  s.scroll(100);
  assert(body.hasAttribute('data-mobile-bars-hidden'));
  for (const y of [98,96,94,92]) s.scroll(y);
  assert(body.hasAttribute('data-mobile-bars-hidden'), 'ignore tiny direction jitter');
  s.scroll(90);
  assert.equal(body.hasAttribute('data-mobile-bars-hidden'), false);
  s.scroll(200);
  assert(body.hasAttribute('data-mobile-bars-hidden'));
  s.scroll(0);
  assert.equal(body.hasAttribute('data-mobile-bars-hidden'), false);
});

test("mobile bar visibility survives rubber-band scrolling, keyboard navigation and page restoration", () => {
  const s = setupMobile(), body = s.document.body;
  s.scroll(4000);
  assert(body.hasAttribute('data-mobile-bars-hidden'));
  s.scroll(3900);
  assert(body.hasAttribute('data-mobile-bars-hidden'), 'bottom overscroll cannot falsely reveal the bars');
  s.scroll(3140);
  assert.equal(body.hasAttribute('data-mobile-bars-hidden'), false);
  s.dispatch('keydown', {key:'Tab'});
  s.get('.mobile-nav a').focus();
  s.scroll(3156);
  assert.equal(body.hasAttribute('data-mobile-bars-hidden'), false, 'focused keyboard controls stay visible');
  s.dispatch('pointerdown');
  s.scroll(3000);s.scroll(3040);
  assert(body.hasAttribute('data-mobile-bars-hidden'));
  s.dispatch('pageshow');
  assert.equal(body.hasAttribute('data-mobile-bars-hidden'), false);
});
