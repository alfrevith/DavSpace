import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {DOMParser} from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const controller = fs.readFileSync(new URL("../assets/js/credentials.js", import.meta.url), "utf8");

async function setup({width = 1000, cardWidth = 354, reduced = false, rounded = false, visible = true} = {}) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const {HTMLElement, Event} = document.defaultView;
  const frames = new Map(), timers = new Map(), scrolls = new Set(), observers = [];
  let focused = document.body, now = 0, nextId = 0;
  const hover = new Set(), captures = new Set();
  const motion = {matches: reduced};
  const motionListeners = [];
  motion.addEventListener = (type, fn) => motionListeners.push(fn);
  Object.defineProperty(document, "activeElement", {get: () => focused});
  Object.defineProperty(document, "hidden", {value: false, writable: true});
  Object.defineProperty(document, "currentScript", {value: {src: "http://localhost/assets/js/credentials.js"}});
  const originalMatches = HTMLElement.prototype.matches;
  HTMLElement.prototype.matches = function (selector) {
    return selector === ":hover" ? hover.has(this) : originalMatches.call(this, selector);
  };
  const emit = (target, type, values = {}) => {
    const event = new Event(type, {bubbles: true, cancelable: true});
    Object.assign(event, values);
    target.dispatchEvent(event);
    return event;
  };
  HTMLElement.prototype.focus = function () {
    if (focused === this) return;
    const previous = focused;
    focused = this;
    emit(previous, "focusout");
    emit(this, "focusin");
  };
  HTMLElement.prototype.getBoundingClientRect = function () {
    let measuredWidth = width;
    if (this.classList.contains("credential-card")) measuredWidth = cardWidth;
    if (this.classList.contains("credential-set")) measuredWidth = this.children.length * (cardWidth + 18);
    const viewport = this.closest(".credential-viewport");
    const group = this.closest(".credential-set");
    const groupIndex = group ? [...group.parentElement.children].indexOf(group) : 0;
    const cardIndex = group && this !== group ? [...group.children].indexOf(this) : 0;
    const left = group ? (groupIndex * group.children.length + Math.max(0, cardIndex)) * (cardWidth + 18) - viewport.scrollLeft : 0;
    return {left, right: left + measuredWidth, top: 100, bottom: 372, width: measuredWidth, height: 272};
  };
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {get: () => width, configurable: true});
  Object.defineProperty(HTMLElement.prototype, "scrollLeft", {
    configurable: true,
    get() { return this._scrollLeft || 0; },
    set(value) {
      const count = this.querySelectorAll(".credential-card").length;
      const max = Math.max(0, count * (cardWidth + 18) - width);
      const next = Math.max(0, Math.min(max, rounded ? Math.round(value) : value));
      if (next !== this._scrollLeft) { this._scrollLeft = next; scrolls.add(this); }
    }
  });
  HTMLElement.prototype.setPointerCapture = id => captures.add(id);
  HTMLElement.prototype.hasPointerCapture = id => captures.has(id);
  HTMLElement.prototype.releasePointerCapture = function (id) { captures.delete(id); emit(this, "lostpointercapture"); };
  const dialog = document.querySelector("#credential-dialog");
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; dialog.querySelector(".credential-close").focus(); };
  dialog.close = () => { dialog.open = false; emit(dialog, "close"); };
  const window = {addEventListener: document.addEventListener.bind(document)};
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
  }
  const resizes = [];
  class ResizeObserver {
    constructor(callback) { resizes.push(callback); }
    observe() {}
  }
  const items = [0, 1].map(index => ({id: `record-${index}`, title: `Record ${index}`, pending: true}));
  vm.runInNewContext(controller, {
    document, window, URL, matchMedia: () => motion, IntersectionObserver, ResizeObserver,
    innerWidth: width, innerHeight: 900, queueMicrotask,
    getComputedStyle: () => ({opacity: "1", transform: "none", clipPath: "none"}),
    requestAnimationFrame(fn) { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout(fn, delay) { const id = ++nextId; timers.set(id, {fn, due: now + delay}); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async () => ({ok: true, json: async () => ({certificates: items, achievements: items.map(item => ({...item, id: `win-${item.id}`}))})})
  });
  for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.equal(document.querySelector("#certificates").hasAttribute("aria-busy"), false);
  const lanes = [...document.querySelectorAll(".credential-lane")];
  assert.equal(lanes[0].querySelectorAll(".credential-set").length, 3, "controller initialized successfully");
  const flushScrolls = () => {
    let count = 0;
    while (scrolls.size) {
      assert(++count < 20, "scroll normalization must settle without an event loop");
      const pending = [...scrolls]; scrolls.clear();
      pending.forEach(target => emit(target, "scroll"));
    }
  };
  const advance = (duration, interval = 16) => {
    const end = now + duration;
    while (now < end) {
      now = Math.min(end, now + interval);
      for (const [id, timer] of [...timers]) {
        if (timer.due <= now) { timers.delete(id); timer.fn(); }
      }
      const pending = [...frames]; frames.clear();
      pending.forEach(([, fn]) => fn(now));
      flushScrolls();
    }
  };
  const intersect = (index, ratio) => observers[index].callback([{isIntersecting: ratio > 0, intersectionRatio: ratio}]);
  lanes.forEach((_, index) => intersect(index, visible ? 1 : 0));
  flushScrolls();
  const viewport = index => lanes[index].querySelector(".credential-viewport");
  const period = index => lanes[index].querySelector(".credential-set").getBoundingClientRect().width;
  const pointer = (target, type, values = {}) => emit(target, type, {pointerType: "mouse", pointerId: 1, button: 0, clientX: 0, ...values});
  return {
    document, dialog, lanes, frames, captures, emit, pointer, viewport, period, advance, intersect, flushScrolls,
    hover(index, value, notify = true) {
      value ? hover.add(lanes[index]) : hover.delete(lanes[index]);
      if (notify) pointer(lanes[index], value ? "pointerenter" : "pointerleave");
    },
    reduced(value) { motion.matches = value; motionListeners.forEach(fn => fn()); },
    resize(value) { width = value; resizes.forEach(fn => fn()); flushScrolls(); },
    click(index, selector) { const button = lanes[index].querySelector(selector); pointer(button, "pointerdown"); button.focus(); pointer(document, "pointerup"); emit(button, "click"); },
    close() { pointer(dialog.querySelector(".credential-close"), "pointerdown"); dialog.close(); },
    hide(value) { document.hidden = value; emit(document, "visibilitychange"); }
  };
}

const phase = (value, period) => ((value % period) + period) % period;
const near = (actual, expected, message) => assert(Math.abs(actual - expected) < .01, `${message}: ${actual} vs ${expected}`);
const nearPhase = (actual, expected, period, message) => {
  const difference = Math.abs(phase(actual, period) - phase(expected, period));
  near(Math.min(difference, period - difference), 0, message);
};

test("long mouse drags loop continuously in both directions, including sets barely wider than the viewport", async () => {
  for (const width of [1000, 350]) {
    const s = await setup({width});
    for (let lane = 0; lane < 2; lane++) {
      for (const direction of [-1, 1]) {
        const view = s.viewport(lane), period = s.period(lane), start = view.scrollLeft;
        s.pointer(view, "pointerdown");
        for (let i = 1; i <= 70; i++) {
          // A single captured pointer event can cover more than a full set.
          s.pointer(view, "pointermove", {clientX: direction * i * 1600});
          s.flushScrolls();
          near(phase(view.scrollLeft, period), phase(start - direction * i * 1600, period), "drag keeps every pixel across seams");
          assert(view.scrollLeft >= period && view.scrollLeft < period * 2);
        }
        s.pointer(s.document, "pointerup");
        assert.equal(s.captures.size, 0);
      }
    }
  }
});

test("native horizontal scrolling can cross either seam repeatedly", async () => {
  const s = await setup();
  for (let lane = 0; lane < 2; lane++) {
    const view = s.viewport(lane), period = s.period(lane);
    for (const direction of [-1, 1]) {
      const start = view.scrollLeft;
      for (let i = 1; i <= 70; i++) {
        s.emit(view, "wheel", {deltaX: direction * 180});
        view.scrollLeft += direction * 180;
        s.flushScrolls();
        near(phase(view.scrollLeft, period), phase(start + direction * i * 180, period), "wheel wraps without clamping");
      }
    }
  }
});

test("autoplay preserves fractional motion at high refresh rates and loops in both directions", async () => {
  const s = await setup({rounded: true});
  const starts = [s.viewport(0).scrollLeft, s.viewport(1).scrollLeft];
  s.advance(65000, 1000 / 240);
  for (let lane = 0; lane < 2; lane++) {
    const view = s.viewport(lane), period = s.period(lane);
    const expected = phase(starts[lane] + (lane ? 1 : -1) * (65000 - 1000 / 240) * .024, period);
    assert(Math.abs(phase(view.scrollLeft, period) - expected) < 2, `lane ${lane}: ${phase(view.scrollLeft, period)} vs ${expected}`);
  }
  const before = [s.viewport(0).scrollLeft, s.viewport(1).scrollLeft];
  s.advance(500, 1000 / 240);
  before.forEach((value, lane) => assert.notEqual(s.viewport(lane).scrollLeft, value));
});

test("closing records restores pointer focus and resumes both lanes without waiting for blur", async () => {
  const s = await setup();
  for (const lane of [0, 1, 0, 1]) {
    s.click(lane, '.credential-card:not([aria-hidden])');
    assert.equal(s.dialog.open, true);
    assert.equal(s.frames.size, 0);
    s.close();
    assert(s.viewport(lane).contains(s.document.activeElement));
    const before = s.viewport(lane).scrollLeft;
    s.advance(200);
    assert.notEqual(s.viewport(lane).scrollLeft, before);
    assert.equal(s.lanes[lane].querySelector("[data-lane-state]").textContent, "Slowly in motion");
  }
});

test("hover is reconciled after modal inertness and missing pointerleave events", async () => {
  const s = await setup();
  s.hover(0, true);
  s.click(0, '.credential-card:not([aria-hidden])');
  s.hover(0, false, false);
  s.close();
  let before = s.viewport(0).scrollLeft;
  s.advance(200);
  assert.notEqual(s.viewport(0).scrollLeft, before);
  s.hover(0, true);
  s.hover(0, false, false);
  s.pointer(s.document, "pointermove");
  before = s.viewport(0).scrollLeft;
  s.advance(200);
  assert.notEqual(s.viewport(0).scrollLeft, before);
});

test("keyboard exploration pauses autoplay until focus leaves the cards", async () => {
  const s = await setup();
  s.emit(s.document, "keydown", {key: "Tab"});
  s.viewport(0).focus();
  const before = s.viewport(0).scrollLeft;
  s.advance(2000);
  assert.equal(s.viewport(0).scrollLeft, before);
  s.document.body.focus();
  await Promise.resolve();
  s.advance(200);
  assert.notEqual(s.viewport(0).scrollLeft, before);
});

test("Escape after a pointer-opened record does not turn restored focus into a permanent keyboard pause", async () => {
  const s = await setup();
  s.click(0, '.credential-card:not([aria-hidden])');
  s.emit(s.dialog, "keydown", {key: "Escape"});
  s.emit(s.dialog, "cancel");
  assert.equal(s.dialog.open, false);
  const before = s.viewport(0).scrollLeft;
  s.advance(200);
  assert.notEqual(s.viewport(0).scrollLeft, before);
});

test("a held touch stays manual past the cooldown and resumes after release", async () => {
  const s = await setup(), view = s.viewport(0);
  s.pointer(view, "pointerdown", {pointerType: "touch"});
  const before = view.scrollLeft;
  s.advance(4000);
  assert.equal(view.scrollLeft, before);
  s.pointer(s.document, "pointerup", {pointerType: "touch"});
  s.advance(1700);
  assert.notEqual(view.scrollLeft, before);
});

test("rapid navigation accumulates steps smoothly and wraps without native smooth-scroll cancellation", async () => {
  const s = await setup();
  for (const lane of [0, 1]) {
    s.hover(lane, true);
    for (const sign of [-1, 1]) {
      const start = s.viewport(lane).scrollLeft, period = s.period(lane);
      for (let i = 0; i < 20; i++) {
        s.click(lane, sign < 0 ? "[data-lane-prev]" : "[data-lane-next]");
        s.advance(50);
      }
      s.advance(500);
      nearPhase(s.viewport(lane).scrollLeft, start + sign * 20 * 372, period, "every requested card is reached");
    }
    s.hover(lane, false);
    s.advance(1600);
    const before = s.viewport(lane).scrollLeft;
    s.advance(200);
    assert.notEqual(s.viewport(lane).scrollLeft, before);
  }
});

test("cancelled drags, capture loss, resize and tab restoration all recover autoplay", async () => {
  for (const end of ["pointercancel", "lostpointercapture", "resize", "hidden", "blur"]) {
    const s = await setup(), view = s.viewport(0);
    s.pointer(view, "pointerdown");
    s.pointer(view, "pointermove", {clientX: 140});
    if (end === "resize") s.resize(600);
    else if (end === "hidden") { s.hide(true); s.hide(false); }
    else s.pointer(end === "lostpointercapture" ? view : s.document, end);
    s.advance(1700);
    assert.equal(s.captures.size, 0, end);
    assert.equal(view.classList.contains("is-dragging"), false, end);
    const before = view.scrollLeft;
    s.advance(200);
    assert.notEqual(view.scrollLeft, before, end);
  }
});

test("explicit pause and reduced motion survive dialog close, while manual controls still loop", async () => {
  const s = await setup();
  s.click(0, "[data-lane-pause]");
  s.click(0, '.credential-card:not([aria-hidden])');
  s.close();
  const before = s.viewport(0).scrollLeft;
  s.advance(2000);
  assert.equal(s.viewport(0).scrollLeft, before);
  s.click(0, "[data-lane-pause]");
  s.advance(200);
  assert.notEqual(s.viewport(0).scrollLeft, before);
  s.reduced(true);
  const manualStart = s.viewport(0).scrollLeft;
  for (let i = 0; i < 20; i++) s.click(0, "[data-lane-next]");
  near(phase(s.viewport(0).scrollLeft, s.period(0)), phase(manualStart + 20 * 372, s.period(0)), "reduced-motion manual loop");
  s.advance(2000);
  assert.equal(s.frames.size, 0);
  s.reduced(false);
  assert.equal(s.frames.size, 2);
});

test("each row reveals once on entry, without leaving hidden cards after resize or reduced motion", async () => {
  const s = await setup({visible: false});
  assert(s.lanes.every(lane => lane.dataset.credentialMotion === "pending"));
  assert.equal(s.frames.size, 0);
  s.intersect(0, .05);
  assert.equal(s.lanes[0].dataset.credentialMotion, "pending");
  s.intersect(0, .12);
  assert.equal(s.lanes[0].dataset.credentialMotion, "revealing");
  const groups = [...s.lanes[0].querySelectorAll(".credential-set")];
  const delays = group => [...group.children].map(card => card.style.getPropertyValue("--credential-delay"));
  assert.deepEqual(delays(groups[0]), delays(groups[1]));
  assert.deepEqual(delays(groups[1]), delays(groups[2]));
  assert.equal(s.lanes[1].dataset.credentialMotion, "pending");
  s.intersect(1, .12);
  s.advance(1200);
  assert(s.lanes.every(lane => lane.dataset.credentialMotion === "visible"));
  s.intersect(0, 0);
  s.intersect(0, 1);
  s.resize(600);
  assert.equal(s.lanes[0].dataset.credentialMotion, "visible");
  const reduced = await setup({reduced: true});
  assert(reduced.lanes.every(lane => lane.dataset.credentialMotion === "visible"));
  assert.equal(reduced.frames.size, 0);
});

test("focus and a reduced-motion change reveal offscreen cards immediately", async () => {
  const s = await setup({visible: false});
  s.viewport(0).focus();
  assert.equal(s.lanes[0].dataset.credentialMotion, "visible");
  assert.equal(s.lanes[1].dataset.credentialMotion, "pending");
  s.reduced(true);
  assert.equal(s.lanes[1].dataset.credentialMotion, "visible");
});

test("fractional layout seams settle despite browsers rounding scrollLeft to whole pixels", async () => {
  const s = await setup({cardWidth: 354.125, rounded: true});
  for (let lane = 0; lane < 2; lane++) {
    s.viewport(lane).scrollLeft = s.period(lane);
    s.flushScrolls();
  }
  s.advance(5000, 1000 / 120);
  assert.equal(s.frames.size, 2);
});
