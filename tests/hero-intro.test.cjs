const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const start = source.indexOf("function initializeHeroIntro()");
const end = source.indexOf("\ninitializeHeroIntro();", start);
assert(start >= 0 && end > start);
const script = source.slice(start, end) + "\ninitializeHeroIntro();";

function node(initialText = "") {
  const listeners = new Map();
  const classes = new Set();
  const properties = new Map();
  let text = initialText;
  return {
    children: [],
    dataset: {},
    attributes: new Map(),
    properties,
    classList: {
      contains: (name) => classes.has(name),
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name))
    },
    style: { setProperty(name, value) { properties.set(name, value); } },
    get textContent() {
      return this.children.length ? this.children.map((child) => typeof child === "string" ? child : child.textContent).join("") : text;
    },
    set textContent(value) { text = value; this.children = []; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    emit(name, event = {}) { [...(listeners.get(name) || [])].forEach((callback) => callback(event)); }
  };
}

function setup({ visible = true, reduced = false, supported = true } = {}) {
  const root = node();
  const hero = node();
  const name = node("David Menjivar");
  const statement = node("I'm a student and I turn ideas into");
  const window = node();
  const document = node();
  const motion = node();
  const frames = new Map();
  const timers = new Map();
  const observers = [];
  let nextId = 0;
  let inView = visible;
  root.classList.add("intro-pending");
  name.dataset.introText = statement.dataset.introText = "words";
  document.documentElement = root;
  document.querySelector = () => hero;
  document.createElement = () => node();
  hero.querySelectorAll = (selector) => selector === "[data-intro-text]" ? [name, statement] : [hero];
  hero.getBoundingClientRect = () => ({ width: 800, height: 500, left: 0, right: 800,
    top: inView ? 100 : 1000, bottom: inView ? 600 : 1500 });
  motion.matches = reduced;
  Object.assign(window, {
    innerHeight: 900,
    innerWidth: 1440,
    requestAnimationFrame(callback) { frames.set(++nextId, callback); return nextId; },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout(callback, delay) { timers.set(++nextId, { callback, delay }); return nextId; },
    clearTimeout: (id) => timers.delete(id)
  });
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  vm.runInNewContext(script, { window, document, motionPreference: motion,
    IntersectionObserver: supported ? IntersectionObserver : undefined });
  function flush() {
    for (let count = 0; frames.size; count += 1) {
      assert(count < 4, "opening should not create a permanent frame loop");
      const batch = [...frames.values()];
      frames.clear();
      batch.forEach((callback) => callback());
    }
  }
  flush();
  return { root, hero, name, statement, window, document, motion, timers, frames, flush,
    show() { inView = true; observers[0].callback(); flush(); } };
}

test("opening uses two masked name words and keeps a single accessible text label", () => {
  const app = setup();
  assert(app.root.classList.contains("intro-running"));
  assert.equal(app.name.children[0].className, "sr-only");
  assert.equal(app.name.children[0].textContent, "David Menjivar");
  const visual = app.name.children[1];
  assert.equal(visual.attributes.get("aria-hidden"), "true");
  const masks = visual.children.filter((child) => typeof child !== "string");
  assert.equal(masks.length, 2);
  assert(masks.every((mask) => mask.className === "intro-mask"));
  assert.deepEqual(masks.map((mask) => mask.children[0].textContent), ["David", "Menjivar"]);
  assert.deepEqual(masks.map((mask) => mask.children[0].properties.get("--intro-order")), [0, 1]);
  assert.equal(app.statement.children[1].children[0].children[0].properties.get("--intro-order"), 0);
});

test("opening finishes on its bounded timer and leaves no animation state behind", () => {
  const app = setup();
  const timer = [...app.timers.values()][0];
  assert.equal(timer.delay, 2100);
  timer.callback();
  assert(!app.root.classList.contains("intro-pending"));
  assert(!app.root.classList.contains("intro-running"));
  assert.equal(app.frames.size, 0);
  assert.equal(app.timers.size, 0);
});

test("pointer scrolling on empty space does not abruptly cancel the text reveal", () => {
  const app = setup();
  app.window.emit("pointerdown", { target: { closest: () => null } });
  assert(app.root.classList.contains("intro-running"));
  app.window.emit("pointerdown", { target: { closest: () => ({}) } });
  assert(!app.root.classList.contains("intro-running"));
});

test("an offscreen opening waits for visibility before using the one-shot animation", () => {
  const app = setup({ visible: false });
  assert(app.root.classList.contains("intro-pending"));
  assert.equal(app.timers.size, 0);
  app.show();
  assert(app.root.classList.contains("intro-running"));
});

test("reduced motion and missing observer support leave the original text visible", () => {
  for (const options of [{ reduced: true }, { supported: false }]) {
    const app = setup(options);
    assert(!app.root.classList.contains("intro-pending"));
    assert(!app.root.classList.contains("intro-running"));
    assert.equal(app.name.textContent, "David Menjivar");
    assert.equal(app.name.children.length, 0);
    assert.equal(app.frames.size, 0);
    assert.equal(app.timers.size, 0);
  }
});

test("focus, motion preference and page lifecycle remove all opening effects immediately", () => {
  for (const reason of ["focus", "motion", "pagehide", "hidden"]) {
    const app = setup();
    if (reason === "focus") app.hero.emit("focusin");
    if (reason === "motion") {
      app.motion.matches = true;
      app.motion.emit("change");
    }
    if (reason === "pagehide") app.window.emit("pagehide");
    if (reason === "hidden") {
      app.document.hidden = true;
      app.document.emit("visibilitychange");
    }
    assert(!app.root.classList.contains("intro-pending"));
    assert(!app.root.classList.contains("intro-running"));
    assert.equal(app.timers.size, 0);
    assert.equal(app.frames.size, 0);
  }
});
