const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "assets/js/app.js"), "utf8");
const start = source.indexOf("function initializeHeroScroll()");
const end = source.indexOf("\ninitializeHeroScroll();", start);
assert(start >= 0 && end > start);
const script = source.slice(start, end) + "\ninitializeHeroScroll();";

function element() {
  const attributes = new Set();
  const properties = new Map();
  const listeners = new Map();
  let writes = 0;
  return {
    attributes,
    properties,
    get writes() { return writes; },
    style: {
      setProperty(name, value) { properties.set(name, value); writes += 1; },
      getPropertyValue(name) { return properties.get(name) || ""; },
      removeProperty(name) { properties.delete(name); }
    },
    setAttribute(name) { attributes.add(name); },
    removeAttribute(name) { attributes.delete(name); },
    toggleAttribute(name, active) {
      if (active) attributes.add(name);
      else attributes.delete(name);
    },
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    emit(name, event = {}) {
      (listeners.get(name) || []).forEach((callback) => callback(event));
    }
  };
}

function setup({ width = 1440, height = 900, naturalHeight = 580, reduced = false,
  scrollY = 0, supported = true, frameDuration = 1000 / 60, mobile = false } = {}) {
  const root = element();
  const track = element();
  const scene = element();
  const content = element();
  const heading = element();
  root.dataset = mobile ? {mobileHero: ""} : {};
  const about = element();
  const document = element();
  const motion = element();
  const window = element();
  const frames = new Map();
  const observers = [];
  const layouts = [];
  const scrollCalls = [];
  const documentTop = 240;
  let frameId = 0;
  let now = 0;
  let fontReady;
  content.offsetHeight = naturalHeight;
  motion.matches = reduced;
  document.hidden = false;
  document.querySelector = () => root;
  document.fonts = { ready: { then(callback) { fontReady = callback; } } };
  root.querySelector = (selector) => ({
    "[data-hero-story]": track,
    "[data-hero-scene]": scene,
    "[data-hero-scene-content]": content,
    ".hero-copy": heading
  })[selector];
  root.contains = (target) => [root, track, scene, content].includes(target);
  root.nextElementSibling = about;
  const enabled = () => root.attributes.has("data-hero-scroll");
  const inset = () => window.innerWidth < 768 ? 152 : 108;
  const sceneHeight = () => enabled() ? Number.parseFloat(root.properties.get("--hero-scene-height")) :
    Math.max(content.offsetHeight, Math.min(640, window.innerHeight - 176));
  const trackHeight = () => enabled() ? Number.parseFloat(root.properties.get("--hero-track-height")) : sceneHeight();
  track.getBoundingClientRect = () => ({ top: documentTop - window.scrollY,
    bottom: documentTop + trackHeight() - window.scrollY });
  scene.getBoundingClientRect = () => {
    const top = documentTop - window.scrollY;
    return { top: enabled() ? Math.min(Math.max(top, inset()), top + trackHeight() - sceneHeight()) : top };
  };
  heading.getBoundingClientRect = () => ({
    top: scene.getBoundingClientRect().top + (sceneHeight() - content.offsetHeight) / 2 +
      (Number.parseFloat(root.properties.get("--hero-copy-y")) || 0),
    height: 120
  });
  about.getBoundingClientRect = () => ({ top: documentTop + trackHeight() + 144 - window.scrollY });
  Object.assign(window, {
    innerWidth: width,
    innerHeight: height,
    scrollY,
    CSS: { supports: () => supported },
    performance: { now: () => now },
    getComputedStyle: () => ({ getPropertyValue: () => `${inset()}px` }),
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    scrollBy(options) { window.scrollY += options.top; scrollCalls.push(options); }
  });
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
  }
  class ResizeObserver {
    constructor(callback) { this.callback = callback; layouts.push(this); }
    observe() {}
  }
  vm.runInNewContext(script, { window, document, motionPreference: motion,
    IntersectionObserver, ResizeObserver });

  function tick() {
    now += frameDuration;
    const batch = [...frames.values()];
    frames.clear();
    batch.forEach((callback) => callback(now));
  }
  function flush() {
    let batches = 0;
    while (frames.size) {
      assert(batches++ < 120, "animation frames must settle instead of looping");
      tick();
    }
  }
  function show(active = true) {
    observers[0]?.callback([{ isIntersecting: active }]);
    flush();
  }
  function progress(value, settle = true) {
    const distance = Math.min(900, Math.max(420, window.innerHeight * .85));
    window.scrollY = documentTop - inset() + distance * value;
    window.emit("scroll");
    if (settle) flush();
  }
  const value = (name) => Number.parseFloat(root.properties.get(name));
  flush();
  return { root, document, window, motion, content, heading, about, observers, layouts,
    frames, scrollCalls, enabled, flush, tick, show, progress, value,
    time: () => now, fonts: () => fontReady?.() };
}

test("the mobile greeting starts at the viewport center and still completes and reverses its scroll story", () => {
  for (const [width, height, naturalHeight] of [[320,640,380], [390,844,430], [430,932,440]]) {
    const app = setup({width, height, naturalHeight, mobile: true});
    const center = () => { const rect = app.heading.getBoundingClientRect(); return rect.top + rect.height / 2; };
    assert(app.enabled());
    assert(Math.abs(center() - height / 2) < .001);
    app.show();app.progress(1);
    assert.equal(app.value("--hero-copy-y"), 0);
    assert.equal(app.value("--hero-identity-opacity"), 1);
    app.window.scrollY = 0;app.window.emit("scroll");app.flush();
    assert(Math.abs(center() - height / 2) < .001);
  }
});

test("scroll builds the portrait and actions in order, then reverses naturally", () => {
  const app = setup();
  assert(app.enabled());
  assert.equal(app.value("--hero-identity-opacity"), 0);
  assert.equal(app.value("--hero-footer-opacity"), 0);
  assert.equal(app.value("--hero-aperture"), 1);
  const initialCopy = app.value("--hero-copy-y");
  app.show();
  app.progress(.35);
  assert(app.value("--hero-identity-opacity") > 0);
  assert(app.value("--hero-copy-y") < initialCopy);
  assert(app.value("--hero-aperture") < 1);
  assert(app.value("--hero-aperture") > 0);
  assert.equal(app.value("--hero-footer-opacity"), 0);
  app.progress(1);
  assert.equal(app.value("--hero-identity-opacity"), 1);
  assert.equal(app.value("--hero-footer-opacity"), 1);
  assert.equal(app.value("--hero-aperture"), 0);
  assert(app.root.attributes.has("data-hero-actions-ready"));
  app.progress(0);
  assert.equal(app.value("--hero-identity-opacity"), 0);
  assert(!app.root.attributes.has("data-hero-identity-ready"));
  assert.equal(app.scrollCalls.length, 0, "scroll input must never be intercepted");
});

test("scroll events coalesce; unchanged progress and offscreen content do no work", () => {
  const app = setup();
  app.show();
  app.window.scrollY = 500;
  for (let index = 0; index < 30; index += 1) app.window.emit("scroll");
  assert.equal(app.frames.size, 1);
  app.flush();
  const writes = app.root.writes;
  app.window.emit("scroll");
  app.flush();
  assert.equal(app.root.writes, writes);
  assert.equal(app.frames.size, 0);
  app.show(false);
  app.window.emit("scroll");
  assert.equal(app.frames.size, 0);
});

test("wheel steps settle briefly without jumping or keeping a permanent frame loop", () => {
  const app = setup();
  const reference = setup();
  app.show();
  reference.show();
  const initial = app.value("--hero-copy-y");
  reference.progress(.3);
  const final = reference.value("--hero-copy-y");
  const started = app.time();
  app.progress(.3, false);
  app.tick();
  assert(app.value("--hero-copy-y") < initial);
  assert(app.value("--hero-copy-y") > final);
  assert.equal(app.frames.size, 1);
  app.flush();
  assert.equal(app.value("--hero-copy-y"), final);
  assert(app.time() - started <= 320, "the settle must end quickly, without a long trailing animation");
  assert.equal(app.frames.size, 0);
  assert.equal(app.scrollCalls.length, 0);
});

test("motion follows elapsed time equally at 60, 120 and 240 Hz", () => {
  const poses = [60, 120, 240].map((rate) => {
    const app = setup({ frameDuration: 1000 / rate });
    app.show();
    app.progress(.3, false);
    for (let frame = 0; frame < rate / 10; frame += 1) app.tick();
    return [app.value("--hero-copy-y"), app.value("--hero-identity-opacity")];
  });
  for (const pose of poses.slice(1)) {
    assert(Math.abs(pose[0] - poses[0][0]) < .001);
    assert(Math.abs(pose[1] - poses[0][1]) < .001);
  }
});

test("large anchor jumps snap to their actual phase instead of chasing it", () => {
  const app = setup();
  app.show();
  app.progress(1, false);
  app.tick();
  assert.equal(app.value("--hero-footer-opacity"), 1);
  assert.equal(app.frames.size, 0);
  app.progress(0, false);
  app.tick();
  assert.equal(app.value("--hero-identity-opacity"), 0);
  assert.equal(app.frames.size, 0);
});

test("the final hold does not rewrite settled styles or keep settling invisible phases", () => {
  const app = setup();
  app.show();
  app.progress(.86);
  const writes = app.root.writes;
  app.progress(.94, false);
  app.tick();
  assert.equal(app.root.writes, writes);
  assert.equal(app.frames.size, 0);
});

test("leaving the scene cancels an active settle and reentry uses current scroll", () => {
  const app = setup();
  app.show();
  app.progress(.25, false);
  app.tick();
  assert.equal(app.frames.size, 1);
  app.show(false);
  assert.equal(app.frames.size, 0);
  app.window.scrollY = 900;
  app.show();
  assert.equal(app.value("--hero-footer-opacity"), 1);
  assert.equal(app.frames.size, 0);
});

test("reduced motion cancels an in-flight settle and clears every animated property", () => {
  const app = setup();
  app.show();
  app.progress(.25, false);
  app.tick();
  app.motion.matches = true;
  app.motion.emit("change");
  app.flush();
  assert(!app.enabled());
  assert.equal(app.root.properties.size, 0);
  assert.equal(app.frames.size, 0);
});

test("portrait, facts and actions settle in order without a redundant text phase", () => {
  const app = setup();
  app.show();
  app.progress(.28);
  assert(app.value("--hero-identity-opacity") > 0);
  assert.equal(app.value("--hero-facts-opacity"), 0);
  assert.equal(app.value("--hero-footer-opacity"), 0);
  assert(app.value("--hero-image-scale") > 1);
  app.progress(.6);
  assert.equal(app.value("--hero-identity-opacity"), 1);
  assert(app.value("--hero-facts-opacity") > .9);
  assert(app.value("--hero-footer-opacity") > 0);
  assert.equal(app.value("--hero-status-opacity"), 0);
  assert(app.value("--hero-portrait-glint") > 0);
  app.progress(.94);
  for (const property of ["--hero-facts-opacity", "--hero-footer-opacity", "--hero-status-opacity", "--hero-image-scale"]) {
    assert.equal(app.value(property), 1);
  }
  for (const property of ["--hero-aperture", "--hero-facts-x", "--hero-footer-y", "--hero-portrait-glint"]) {
    assert.equal(app.value(property), 0);
  }
});

test("the portrait frame draws before the diagonal aperture completes, then disappears", () => {
  const app = setup();
  app.show();
  app.progress(.12);
  assert(app.value("--hero-frame-x") > 0);
  assert.equal(app.value("--hero-frame-y"), 0);
  assert.equal(app.value("--hero-aperture"), 1);
  app.progress(.38);
  assert.equal(app.value("--hero-frame-x"), 1);
  assert.equal(app.value("--hero-frame-y"), 1);
  assert(app.value("--hero-frame-opacity") > 0);
  assert(app.value("--hero-aperture") > 0);
  assert(app.value("--hero-aperture") < 1);
  app.progress(.74);
  assert.equal(app.value("--hero-frame-opacity"), 0);
  assert.equal(app.value("--hero-aperture"), 0);
  assert.equal(app.value("--hero-portrait-glint"), 0);
  app.progress(.38);
  assert(app.value("--hero-frame-opacity") > 0);
});

test("all animation values stay finite and replay the same pose in either direction", () => {
  const app = setup();
  app.show();
  const poses = [];
  for (let step = 0; step <= 100; step += 1) {
    app.progress(step / 100);
    const values = [...app.root.properties.values()];
    assert(values.every((value) => Number.isFinite(Number.parseFloat(value))));
    poses.push(values);
  }
  for (let step = 100; step >= 0; step -= 1) {
    app.progress(step / 100);
    assert.deepEqual([...app.root.properties.values()], poses[step]);
  }
  assert.equal(app.frames.size, 0);
});

test("restored scroll paints the correct phase without waiting for another scroll", () => {
  const app = setup({ scrollY: 900 });
  assert.equal(app.value("--hero-footer-opacity"), 1);
  app.window.scrollY = 400;
  app.window.emit("pageshow");
  app.flush();
  assert(app.value("--hero-identity-opacity") > 0);
  assert.equal(app.value("--hero-footer-opacity"), 0);
});

test("focus reveals every action only while navigation stays inside the hero", () => {
  const app = setup();
  app.show();
  app.root.emit("focusin", { target: app.content });
  assert.equal(app.value("--hero-footer-opacity"), 1);
  app.progress(0);
  assert.equal(app.value("--hero-footer-opacity"), 1);
  app.root.emit("focusout", { relatedTarget: app.content });
  app.flush();
  assert.equal(app.value("--hero-footer-opacity"), 1);
  app.root.emit("focusout", { relatedTarget: app.about });
  app.flush();
  assert.equal(app.value("--hero-identity-opacity"), 0);
  assert.equal(app.value("--hero-footer-opacity"), 0);
});

test("section links release the focus override even when the clicked link retains focus", () => {
  for (const href of ["#start", "#about-me", "#projects", "#journey", "#certificates", "#contact"]) {
    const app = setup();
    app.show();
    app.root.emit("focusin", { target: app.content });
    const link = { getAttribute: () => href };
    app.document.emit("click", { target: { closest: () => link }, button: 0 });
    app.flush();
    assert.equal(app.value("--hero-footer-opacity"), 0, `${href} must not consume the effect`);
    app.progress(1);
    app.progress(0);
    assert.equal(app.value("--hero-identity-opacity"), 0);
  }
});

test("returning after hash navigation or leaving the scene always restores scroll control", () => {
  for (const route of ["hash", "offscreen"]) {
    const app = setup();
    app.show();
    app.root.emit("focusin", { target: app.content });
    if (route === "hash") app.window.emit("hashchange");
    else app.show(false);
    app.show();
    app.progress(.35);
    assert(app.value("--hero-identity-opacity") < 1);
    app.progress(1);
    assert.equal(app.value("--hero-footer-opacity"), 1);
    app.progress(0);
    assert.equal(app.value("--hero-identity-opacity"), 0);
    assert.equal(app.scrollCalls.length, 0);
  }
});

test("ordinary and modified clicks do not hide a focused action", () => {
  const app = setup();
  app.show();
  app.root.emit("focusin", { target: app.content });
  app.document.emit("click", { target: { closest: () => null } });
  app.document.emit("click", { target: { closest: () => ({ getAttribute: () => "#projects" }) }, ctrlKey: true });
  app.flush();
  assert.equal(app.value("--hero-footer-opacity"), 1);
});

test("multiple complete anchor round trips never leave a completed focus state behind", () => {
  const app = setup();
  app.show();
  for (let round = 0; round < 4; round += 1) {
    app.progress(1);
    app.root.emit("focusin", { target: app.content });
    app.document.emit("click", { target: { closest: () => ({ getAttribute: () => "#projects" }) } });
    app.window.scrollY = 2500;
    app.window.emit("scroll");
    app.show(false);
    app.window.emit("hashchange");
    app.window.scrollY = 0;
    app.show();
    assert.equal(app.value("--hero-identity-opacity"), 0);
    assert.equal(app.value("--hero-footer-opacity"), 0);
    app.progress(.4);
    assert(app.value("--hero-identity-opacity") > 0);
    assert(app.value("--hero-identity-opacity") < 1);
  }
});

test("short viewports, reduced motion and unsupported sticky keep the plain layout", () => {
  for (const options of [{ height: 600 }, { reduced: true }, { supported: false }]) {
    const app = setup(options);
    assert(!app.enabled());
    assert.equal(app.root.properties.size, 0);
  }
  const app = setup({ height: 600 });
  app.window.innerHeight = 1000;
  app.window.emit("resize");
  app.flush();
  assert(app.enabled());
});

test("preference changes preserve the reading position below the story", () => {
  const app = setup();
  app.window.scrollY = 1750;
  const before = app.about.getBoundingClientRect().top;
  app.motion.matches = true;
  app.motion.emit("change");
  app.flush();
  assert(!app.enabled());
  assert.equal(app.root.properties.size, 0);
  assert.equal(app.about.getBoundingClientRect().top, before);
  assert.equal(app.scrollCalls.at(-1).behavior, "instant");
  app.motion.matches = false;
  app.motion.emit("change");
  app.flush();
  assert(app.enabled());
  assert.equal(app.about.getBoundingClientRect().top, before);
});

test("mobile browser chrome does not rebuild the scene during small height changes", () => {
  const app = setup({ width: 390, height: 844, naturalHeight: 480 });
  const height = app.value("--hero-scene-height");
  app.window.innerHeight = 880;
  app.window.emit("resize");
  assert.equal(app.frames.size, 0);
  assert.equal(app.value("--hero-scene-height"), height);
  app.content.offsetHeight = 510;
  app.layouts[0].callback();
  app.flush();
  assert.equal(app.value("--hero-scene-height"), 704);

  const tight = setup({ width: 390, height: 844, naturalHeight: 620 });
  assert(tight.enabled());
  tight.window.innerHeight = 810;
  tight.window.emit("resize");
  tight.flush();
  assert(!tight.enabled(), "normal layout takes over if browser chrome would cut off content");
});

test("hidden tabs and page lifecycle cancel frames and resume from current geometry", () => {
  const app = setup();
  app.show();
  app.window.emit("scroll");
  app.window.emit("pagehide");
  assert.equal(app.frames.size, 0);
  app.document.hidden = true;
  app.document.emit("visibilitychange");
  app.window.emit("scroll");
  assert.equal(app.frames.size, 0);
  app.window.scrollY = 900;
  app.document.hidden = false;
  app.document.emit("visibilitychange");
  app.flush();
  assert.equal(app.value("--hero-footer-opacity"), 1);
  assert.equal(app.frames.size, 0);
});
