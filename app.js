const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

function initializeHeroIntro() {
  const root = document.documentElement;
  if (!root.classList.contains("intro-pending")) return;

  const hero = document.querySelector(".hero-stage");
  const introTargets = hero ? [...hero.querySelectorAll(".hero-copy, .hero-profile-shell")] : [];
  let finished = false;
  let started = false;
  let startQueued = false;
  let introObserver;
  let frame;
  let finishTimer;

  function finishIntro() {
    if (finished) return;
    finished = true;
    window.cancelAnimationFrame(frame);
    window.clearTimeout(finishTimer);
    window.clearTimeout(window.heroIntroFallback);
    introObserver?.disconnect();
    root.classList.remove("intro-pending", "intro-running");
    window.removeEventListener("pagehide", finishIntro);
    window.removeEventListener("pointerdown", handleIntroPointer);
    window.removeEventListener("keydown", handleIntroKey);
    document.removeEventListener("visibilitychange", handleIntroVisibility);
    motionPreference.removeEventListener("change", handleMotionChange);
    hero?.removeEventListener("focusin", finishIntro);
  }

  function isIntroVisible() {
    return introTargets.some((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight &&
        rect.right > 0 && rect.left < window.innerWidth;
    });
  }

  function handleIntroPointer() {
    if (started) finishIntro();
  }

  function handleIntroKey(event) {
    if (started && ["Tab", "Escape", "PageDown", "End", "ArrowDown", " "].includes(event.key)) finishIntro();
  }

  function handleIntroVisibility() {
    if (document.hidden && started) finishIntro();
    else if (!document.hidden) queueIntroStart();
  }

  function handleMotionChange() {
    if (motionPreference.matches) finishIntro();
  }

  if (!hero || !introTargets.length || motionPreference.matches) {
    finishIntro();
    return;
  }

  let characterOrder = 0;
  let wordOrder = 0;

  hero.querySelectorAll("[data-intro-text]").forEach((element) => {
    const text = element.textContent.trim();
    const accessibleText = document.createElement("span");
    accessibleText.className = "sr-only";
    accessibleText.textContent = text;

    const visualText = document.createElement("span");
    visualText.setAttribute("aria-hidden", "true");
    element.dataset.introLabel = text;

    text.split(/\s+/).forEach((word, index) => {
      if (index) visualText.append(" ");
      const wordElement = document.createElement("span");
      wordElement.className = "intro-word";

      if (element.dataset.introText === "letters") {
        Array.from(word).forEach((character) => {
          const letter = document.createElement("span");
          letter.className = "intro-char";
          letter.textContent = character;
          letter.style.setProperty("--intro-order", characterOrder++);
          wordElement.append(letter);
        });
      } else {
        wordElement.textContent = word;
        wordElement.style.setProperty("--intro-order", wordOrder++);
      }

      visualText.append(wordElement);
    });

    element.replaceChildren(accessibleText, visualText);
  });

  function queueIntroStart() {
    if (finished || started || startQueued || document.hidden || !isIntroVisible()) return;
    startQueued = true;

    // Recheck after layout and scroll restoration before consuming the one-shot opening.
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        startQueued = false;
        if (finished || document.hidden || !isIntroVisible()) return;
        started = true;
        introObserver.disconnect();
        root.classList.remove("intro-pending");
        root.classList.add("intro-running");
        finishTimer = window.setTimeout(finishIntro, 2100);
      });
    });
  }

  window.addEventListener("pagehide", finishIntro);
  window.addEventListener("pointerdown", handleIntroPointer, { passive: true });
  window.addEventListener("keydown", handleIntroKey);
  document.addEventListener("visibilitychange", handleIntroVisibility);
  motionPreference.addEventListener("change", handleMotionChange);
  hero.addEventListener("focusin", finishIntro);
  introObserver = new IntersectionObserver(queueIntroStart, { threshold: 0 });
  introTargets.forEach((element) => introObserver.observe(element));
  window.clearTimeout(window.heroIntroFallback);
  queueIntroStart();
}

initializeHeroIntro();

function initializeProfileHover() {
  const shell = document.querySelector(".hero-profile-shell");
  if (!shell) return;

  const pointerPreference = window.matchMedia("(hover: hover) and (pointer: fine)");
  const properties = ["--profile-lift", "--profile-rotation", "--profile-photo-x", "--profile-photo-y", "--profile-photo-scale"];
  const current = { x: 0, y: 0, amount: 0 };
  const target = { x: 0, y: 0, amount: 0 };
  let bounds;
  let frame = 0;
  let lastTime = 0;

  function reset() {
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    bounds = null;
    for (const key of Object.keys(current)) current[key] = target[key] = 0;
    properties.forEach((property) => shell.style.removeProperty(property));
  }

  function draw(now) {
    // Time-based damping feels the same on 60 Hz and high-refresh screens.
    const elapsed = lastTime ? Math.min(now - lastTime, 64) : 16;
    const blend = 1 - Math.exp(-elapsed / (target.amount ? 95 : 140));
    lastTime = now;
    let settled = true;

    for (const key of Object.keys(current)) {
      current[key] += (target[key] - current[key]) * blend;
      if (Math.abs(target[key] - current[key]) < .001) current[key] = target[key];
      else settled = false;
    }

    const angle = Math.hypot(current.x, current.y) * 1.8;
    const axis = angle ? `${-current.y} ${current.x} 0` : "1 0 0";
    shell.style.setProperty("--profile-rotation", `${axis} ${angle.toFixed(3)}deg`);
    shell.style.setProperty("--profile-lift", `${(-current.amount * 2.5).toFixed(3)}px`);
    shell.style.setProperty("--profile-photo-x", `${(-current.x * 1.5).toFixed(3)}px`);
    shell.style.setProperty("--profile-photo-y", `${(-current.y * 1.5).toFixed(3)}px`);
    shell.style.setProperty("--profile-photo-scale", (1 + current.amount * .018).toFixed(4));

    if (!settled) frame = window.requestAnimationFrame(draw);
    else if (!target.amount) reset();
    else {
      frame = 0;
      lastTime = 0;
    }
  }

  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(draw);
  }

  function follow(event) {
    if (event.pointerType !== "mouse" || !pointerPreference.matches || motionPreference.matches ||
      document.hidden || document.documentElement.matches(".intro-pending, .intro-running")) return;

    bounds ||= shell.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    target.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    target.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    target.amount = 1;
    schedule();
  }

  function release() {
    bounds = null;
    if (!frame && !current.amount) return;
    target.x = target.y = target.amount = 0;
    schedule();
  }

  shell.addEventListener("pointerenter", follow, { passive: true });
  shell.addEventListener("pointermove", follow, { passive: true });
  shell.addEventListener("pointerleave", release, { passive: true });
  shell.addEventListener("pointercancel", release, { passive: true });
  window.addEventListener("scroll", release, { passive: true });
  window.addEventListener("resize", release, { passive: true });
  window.addEventListener("blur", reset);
  window.addEventListener("pagehide", reset);
  document.addEventListener("visibilitychange", () => { if (document.hidden) reset(); });
  motionPreference.addEventListener("change", reset);
  pointerPreference.addEventListener("change", reset);
}

initializeProfileHover();

const sections = [...document.querySelectorAll(".section")];
const reveals = [...document.querySelectorAll(".reveal")];
const links = [...document.querySelectorAll(".nav a")];
const navigation = document.querySelector(".nav");
const navigationTrack = document.querySelector(".nav-track");
const heroBackdrop = document.querySelector(".hero-backdrop");
const filters = [...document.querySelectorAll("[data-filter]")];
const projectCards = [...document.querySelectorAll(".project-card")];
const certificateCards = [...document.querySelectorAll(".certificate-card")];
const certificateDots = [...document.querySelectorAll("[data-certificate-dot]")];
const certificatePrev = document.querySelector("[data-certificate-prev]");
const certificateNext = document.querySelector("[data-certificate-next]");
const magneticItems = [...document.querySelectorAll(".magnetic")];
const siteHeader = document.querySelector(".site-header");
const cursorLight = document.querySelector(".cursor-light");
const railProgress = document.querySelector(".rail-progress");
const glitchTarget = document.querySelector("[data-glitch]");
const modal = document.querySelector(".project-modal");
const modalClose = document.querySelector(".modal-close");
const certificateModal = document.querySelector(".certificate-modal");
const certificateModalClose = document.querySelector(".certificate-modal-close");

const projectData = {
  taskflow: {
    type: "web app / responsive",
    title: "Plant Bud",
    description: "",
    role: "Frontend / Backend",
    stack: "HTML / CSS / JS / NODEJS / ADONISJS / PY",
    status: "",
    next: ""
  },
  nova: {
    type: "electronics / web",
    title: "POT-C",
    description: "",
    role: "",
    stack: "",
    status: "",
    next: ""
  },
  resume: {
    type: "mobile / prototype",
    title: "Pet's Health",
    description: "",
    role: "",
    stack: "",
    status: "",
    next: ""
  },
  archive: {
    type: "web / prototype",
    title: "CECAM",
    description: "",
    role: "",
    stack: "",
    status: "",
    next: ""
  }
};

const certificateData = {
  "logic-foundations": {
    type: "course / foundation",
    title: "Logic Foundations",
    description: "Recognition for work connected to reasoning, problem analysis, algorithms, and structured thinking.",
    issuer: "Learning archive",
    year: "2026",
    area: "Logic",
    seal: "DM"
  },
  "web-development": {
    type: "certificate / web",
    title: "Web Development",
    description: "A technical milestone focused on interface structure, web foundations, and practical software growth.",
    issuer: "Technical path",
    year: "2026",
    area: "Software",
    seal: "WEB"
  },
  "creative-process": {
    type: "workshop / creative",
    title: "Creative Process",
    description: "A creative milestone connected to visual thinking, artistic process, storytelling, and experimentation.",
    issuer: "Creative archive",
    year: "2026",
    area: "Creative",
    seal: "ART"
  },
  "academic-milestone": {
    type: "academic / milestone",
    title: "Academic Milestone",
    description: "A record for academic recognitions, school achievements, competitions, and meaningful learning events.",
    issuer: "Academic path",
    year: "2026",
    area: "Academic",
    seal: "EDU"
  }
};

let sectionPositions = [];
let activeSectionId = "";
let pageScrollEnd = 0;
let navigationMotionEnabled = false;

function updateNavIndicator({ keepActiveVisible = false, animate = false } = {}) {
  if (!navigation || !navigationTrack) return;

  const activeLink = navigation.querySelector("a.is-active");
  if (!activeLink || !activeLink.offsetWidth) return;

  const x = activeLink.offsetLeft;
  const width = activeLink.offsetWidth;
  navigation.dataset.indicatorMotion = animate && !motionPreference.matches ? "true" : "false";
  navigation.style.setProperty("--nav-active-x", `${x}px`);
  navigation.style.setProperty("--nav-active-width", `${width}px`);
  navigation.dataset.indicatorReady = "true";

  if (!keepActiveVisible) return;
  const left = x + navigationTrack.offsetLeft;
  const right = left + width;
  if (left >= navigation.scrollLeft && right <= navigation.scrollLeft + navigation.clientWidth) return;

  navigation.scrollTo({
    left: Math.max(0, left - (navigation.clientWidth - width) / 2),
    behavior: animate && !motionPreference.matches ? "smooth" : "instant"
  });
}

function measureSectionPositions() {
  sectionPositions = sections.map((section) => {
    let top = 0;
    let element = section;
    // Layout offsets ignore the transforms used by section reveal animations.
    while (element) {
      top += element.offsetTop;
      element = element.offsetParent;
    }
    return { id: section.id, top, height: section.offsetHeight };
  });
  pageScrollEnd = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function updateActiveSection(animate = navigationMotionEnabled) {
  if (!sectionPositions.length) return;
  const marker = window.scrollY + Math.min(240, window.innerHeight * .32);
  let activeSection = sectionPositions[0];

  for (const section of sectionPositions) {
    if (section.top > marker) break;
    activeSection = section;
  }

  if (pageScrollEnd > 0 && window.scrollY >= pageScrollEnd - 2) {
    activeSection = sectionPositions[sectionPositions.length - 1];
  }
  if (activeSectionId === activeSection.id) return;
  activeSectionId = activeSection.id;

  links.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${activeSectionId}`;
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
  updateNavIndicator({ keepActiveVisible: true, animate });
}

function syncHeroBackdrop() {
  if (!heroBackdrop) return;
  const heroIndex = sectionPositions.findIndex((section) => section.id === "start");
  if (heroIndex < 0) return;

  const hero = sectionPositions[heroIndex];
  const nextSection = sectionPositions[heroIndex + 1];
  const fadeEnd = nextSection ? nextSection.top - 24 : Infinity;
  const height = Math.min(hero.top + hero.height + 112, fadeEnd);
  heroBackdrop.style.setProperty("--hero-backdrop-height", `${Math.ceil(Math.max(0, height))}px`);
}

function syncNavigationLayout() {
  measureSectionPositions();
  syncHeroBackdrop();
  updateActiveSection(false);
  updateNavIndicator({ keepActiveVisible: true });
}

syncNavigationLayout();
const navigationLayoutObserver = new ResizeObserver(syncNavigationLayout);
[navigation, navigationTrack, document.querySelector(".site-content")].filter(Boolean).forEach((element) => {
  navigationLayoutObserver.observe(element);
});

// Restored scroll positions and late styles settle instantly; user navigation animates.
const enableNavigationMotion = () => { navigationMotionEnabled = true; };
["wheel", "touchstart", "pointerdown", "keydown"].forEach((eventName) => {
  window.addEventListener(eventName, enableNavigationMotion, { passive: true });
});
window.addEventListener("resize", syncNavigationLayout, { passive: true });
window.addEventListener("load", syncNavigationLayout, { once: true });
window.addEventListener("pageshow", () => {
  navigationMotionEnabled = false;
  syncNavigationLayout();
  window.requestAnimationFrame(syncNavigationLayout);
});
document.fonts?.ready.then(syncNavigationLayout);

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("is-visible");
  });
}, { threshold: .16 });

reveals.forEach((item) => revealObserver.observe(item));

let lastScrollY = window.scrollY;
let scrollTicking = false;
let headerSettlingFromNav = false;
let headerPinnedAfterNav = false;
let headerSettleTimer;

function updateScrollProgress(currentY = window.scrollY) {
  if (!railProgress) return;

  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable <= 0 ? 0 : (currentY / scrollable) * 100;
  railProgress.style.setProperty("--progress", `${Math.min(100, Math.max(0, progress))}%`);
}

function updateHeaderState(currentY = window.scrollY) {
  if (!siteHeader) return;

  const delta = currentY - lastScrollY;
  const isAtTop = currentY <= 12;

  siteHeader.classList.toggle("is-scrolled", !isAtTop);

  if (isAtTop) {
    siteHeader.classList.remove("is-hidden");
    headerSettlingFromNav = false;
    headerPinnedAfterNav = false;
  } else if (headerSettlingFromNav) {
    siteHeader.classList.remove("is-hidden");
  } else if (headerPinnedAfterNav) {
    siteHeader.classList.remove("is-hidden");

    if (delta > 6) {
      siteHeader.classList.add("is-hidden");
      headerPinnedAfterNav = false;
    }
  } else if (delta > 6) {
    siteHeader.classList.add("is-hidden");
  } else if (delta < -6) {
    siteHeader.classList.remove("is-hidden");
  }

  lastScrollY = currentY;
}

function updateScrollState() {
  const currentY = window.scrollY;

  updateScrollProgress(currentY);
  updateHeaderState(currentY);
  updateActiveSection();
  scrollTicking = false;
}

window.addEventListener("scroll", () => {
  if (scrollTicking) return;

  scrollTicking = true;
  window.requestAnimationFrame(updateScrollState);
}, { passive: true });

updateScrollState();

document.querySelectorAll('.site-header a[href^="#"]').forEach((link) => {
  link.addEventListener("click", () => {
    if (!siteHeader) return;

    window.clearTimeout(headerSettleTimer);
    headerSettlingFromNav = true;
    headerPinnedAfterNav = false;
    siteHeader.classList.remove("is-hidden");

    headerSettleTimer = window.setTimeout(() => {
      headerSettlingFromNav = false;
      headerPinnedAfterNav = true;
      lastScrollY = window.scrollY;
    }, 1100);
  });
});

window.addEventListener("pointermove", (event) => {
  if (!cursorLight) return;
  cursorLight.style.setProperty("--x", `${event.clientX}px`);
  cursorLight.style.setProperty("--y", `${event.clientY}px`);
});

const words = ["websites", "apps", "photographs", "drawings", "stories", "poems"];
const chars = "!<>-_\\/[]{}=+*^?#0123456789";
let wordIndex = 0;
let scrambleFrame;
let scrambleWord = null;
let underlineTimer;

function updateGlitchUnderline(text, animate = true) {
  if (!glitchTarget) return;

  const width = Math.max(1, text.length);
  const line = glitchTarget.parentElement;
  if (!line) return;

  line.classList.remove("is-resizing");
  line.style.setProperty("--glitch-underline-width", `${width}ch`);
  window.clearTimeout(underlineTimer);
  if (!animate) return;
  void line.offsetWidth;
  line.classList.add("is-resizing");
  underlineTimer = window.setTimeout(() => line.classList.remove("is-resizing"), 760);
}

function settleScramble() {
  window.cancelAnimationFrame(scrambleFrame);
  if (!glitchTarget || scrambleWord === null) return;
  glitchTarget.textContent = scrambleWord;
  glitchTarget.dataset.text = scrambleWord;
  glitchTarget.style.setProperty("--shift", "0px");
  glitchTarget.classList.remove("is-glitching");
  scrambleWord = null;
}

function scrambleTo(nextWord) {
  if (!glitchTarget) return;

  settleScramble();
  scrambleWord = nextWord;

  if (motionPreference.matches) {
    updateGlitchUnderline(nextWord, false);
    settleScramble();
    return;
  }

  const start = performance.now();
  let previousStep = -1;
  glitchTarget.classList.add("is-glitching");
  updateGlitchUnderline(nextWord);

  function drawScramble(now) {
    const progress = Math.min(1, (now - start) / 520);
    if (progress >= 1) {
      settleScramble();
      return;
    }

    const step = Math.floor(progress * 18);
    if (step !== previousStep) {
      const resolved = Math.floor(nextWord.length * progress);
      const output = Array.from(nextWord, (character, index) =>
        index < resolved ? character : chars[Math.floor(Math.random() * chars.length)]
      ).join("");
      glitchTarget.textContent = output;
      glitchTarget.dataset.text = output;
      glitchTarget.style.setProperty("--shift", `${Math.sin(step * 1.7) * 1.5}px`);
      previousStep = step;
    }

    scrambleFrame = window.requestAnimationFrame(drawScramble);
  }

  scrambleFrame = window.requestAnimationFrame(drawScramble);
}

updateGlitchUnderline(glitchTarget?.textContent || "", false);

window.setInterval(() => {
  if (!glitchTarget || document.hidden || document.documentElement.matches(".intro-pending, .intro-running")) return;
  const rect = glitchTarget.getBoundingClientRect();
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
  wordIndex = (wordIndex + 1) % words.length;
  scrambleTo(words[wordIndex]);
}, 4200);

function initializeHeroAmbience() {
  const hero = document.querySelector(".hero-stage");
  const particles = document.querySelector("[data-hero-particles]");
  if (!hero || !particles) return;

  for (let index = 0; index < 12; index += 1) {
    const particle = document.createElement("span");
    particle.className = "hero-particle";
    particle.style.setProperty("--particle-x", `${(11 + index * 29) % 94}%`);
    particle.style.setProperty("--particle-y", `${(17 + index * 37) % 86}%`);
    particle.style.setProperty("--particle-duration", `${12 + (index % 4) * 3}s`);
    particle.style.setProperty("--particle-delay", `${index * -1.7}s`);
    particle.style.setProperty("--particle-drift", `${index % 2 ? -16 : 20}px`);
    particles.append(particle);
  }

  let visible = false;
  function updateAmbience() {
    const active = visible && !document.hidden && !motionPreference.matches;
    particles.classList.toggle("is-ambient-visible", active);
    if (!active) settleScramble();
  }

  const ambienceObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateAmbience();
  });
  ambienceObserver.observe(hero);
  document.addEventListener("visibilitychange", updateAmbience);
  motionPreference.addEventListener("change", updateAmbience);
}

initializeHeroAmbience();

function initializeAboutMindset() {
  const root = document.querySelector(".about-mindset");
  const tabList = root?.querySelector("[data-mind-tabs]");
  if (!tabList) return;

  const tabs = [...tabList.querySelectorAll("[data-mind-tab]")];
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
  if (!tabs.length || panels.some((panel) => !panel || !root.contains(panel))) return;
  let activeIndex = -1;

  function activate(index, focus = false) {
    if (index === activeIndex) {
      if (focus) tabs[index].focus({ preventScroll: true });
      return;
    }

    root.style.setProperty("--mind-direction", index > activeIndex ? "1" : "-1");
    activeIndex = index;
    root.dataset.mindset = tabs[index].dataset.mindTab;
    root.style.setProperty("--mind-index", String(index));

    tabs.forEach((tab, tabIndex) => {
      const selected = tabIndex === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[tabIndex].setAttribute("aria-hidden", String(!selected));
      panels[tabIndex].inert = !selected;
    });

    if (focus) tabs[index].focus({ preventScroll: true });
  }

  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-labelledby", "mindset-label");
  tabs.forEach((tab, index) => {
    tab.setAttribute("role", "tab");
    panels[index].setAttribute("role", "tabpanel");
    panels[index].setAttribute("aria-labelledby", tab.id);
    panels[index].tabIndex = 0;
    tab.addEventListener("click", () => activate(index));
  });

  tabList.addEventListener("keydown", (event) => {
    const index = tabs.indexOf(event.target.closest("[data-mind-tab]"));
    if (index < 0) return;
    const destinations = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1
    };
    if (!Object.hasOwn(destinations, event.key)) return;
    event.preventDefault();
    activate(destinations[event.key], true);
  });

  // Until enhancement succeeds, all three notes remain ordinary readable content.
  activate(0);
  root.setAttribute("data-enhanced", "");
  tabList.classList.replace("hidden", "grid");
}

initializeAboutMindset();

function initializeAboutReveal() {
  const root = document.querySelector("#about-me");
  if (!root || motionPreference.matches || typeof IntersectionObserver !== "function") return;

  const targets = [...root.querySelectorAll("[data-about-reveal]")];
  if (!targets.length) return;
  const pending = new Set(targets);

  function cleanup() {
    observer.disconnect();
    root.removeEventListener("focusin", handleFocus);
    motionPreference.removeEventListener("change", handleMotion);
  }

  function reveal(target, instant = false) {
    if (!pending.delete(target)) return;
    if (instant) target.setAttribute("data-about-instant", "");
    target.setAttribute("data-about-shown", "");
    observer.unobserve(target);
    if (!pending.size) cleanup();
  }

  function handleFocus(event) {
    pending.forEach((target) => {
      if (target.contains(event.target)) reveal(target, true);
    });
  }

  function handleMotion() {
    if (!motionPreference.matches) return;
    [...pending].forEach((target) => reveal(target, true));
    root.removeAttribute("data-about-motion");
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) reveal(entry.target);
    });
  }, { threshold: .06, rootMargin: "0px 0px -24px 0px" });

  // Only opt into hidden entry states after the observer is ready.
  root.setAttribute("data-about-motion", "");
  root.addEventListener("focusin", handleFocus);
  motionPreference.addEventListener("change", handleMotion);
  targets.forEach((target) => observer.observe(target));
}

initializeAboutReveal();

function initializeMindsetLight() {
  const stage = document.querySelector(".mind-stage");
  if (!stage || typeof IntersectionObserver !== "function") return;

  const pointerPreference = window.matchMedia("(hover: hover) and (pointer: fine)");
  let visible = false;
  let bounds;
  let pointer;
  let frame = 0;
  let pointerLit = false;
  let painted = false;

  function releasePointer() {
    pointer = null;
    if (!pointerLit) return;
    pointerLit = false;
    stage.classList.remove("is-light-active");
    stage.style.removeProperty("--mind-light-x");
    stage.style.removeProperty("--mind-light-y");
  }

  function reset() {
    window.cancelAnimationFrame(frame);
    frame = 0;
    bounds = null;
    releasePointer();
    if (painted) stage.style.removeProperty("--mind-scroll-y");
    painted = false;
  }

  function draw() {
    frame = 0;
    if (!visible || document.hidden || motionPreference.matches) return;
    bounds ||= stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const center = bounds.top + bounds.height / 2;
    const offset = (window.innerHeight / 2 - center) / (window.innerHeight + bounds.height) * 16;
    stage.style.setProperty("--mind-scroll-y", `${Math.max(-6, Math.min(6, offset)).toFixed(2)}px`);
    painted = true;

    if (!pointer || !pointerPreference.matches || pointer.x < bounds.left || pointer.x > bounds.right ||
      pointer.y < bounds.top || pointer.y > bounds.bottom) {
      releasePointer();
      return;
    }

    const x = ((pointer.x - bounds.left) / bounds.width * 2 - 1) * 14;
    const y = ((pointer.y - bounds.top) / bounds.height * 2 - 1) * 5;
    if (!pointerLit) stage.classList.add("is-light-active");
    pointerLit = true;
    stage.style.setProperty("--mind-light-x", `${x.toFixed(2)}px`);
    stage.style.setProperty("--mind-light-y", `${y.toFixed(2)}px`);
  }

  function schedule() {
    if (!frame && visible && !document.hidden && !motionPreference.matches) {
      frame = window.requestAnimationFrame(draw);
    }
  }

  function invalidate() {
    bounds = null;
    schedule();
  }

  function follow(event) {
    if (event.pointerType !== "mouse" || !pointerPreference.matches || motionPreference.matches || document.hidden) return;
    pointer = { x: event.clientX, y: event.clientY };
    schedule();
  }

  function handleEnvironment() {
    if (document.hidden || motionPreference.matches) reset();
    else invalidate();
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) invalidate();
    else reset();
  });
  observer.observe(stage);

  stage.addEventListener("pointerenter", follow, { passive: true });
  stage.addEventListener("pointermove", follow, { passive: true });
  stage.addEventListener("pointerleave", releasePointer, { passive: true });
  stage.addEventListener("pointercancel", releasePointer, { passive: true });
  stage.addEventListener("transitionend", (event) => {
    if (event.target === stage && event.propertyName === "transform") invalidate();
  });
  window.addEventListener("scroll", invalidate, { passive: true });
  window.addEventListener("resize", invalidate, { passive: true });
  window.addEventListener("blur", releasePointer);
  window.addEventListener("pagehide", reset);
  window.addEventListener("pageshow", invalidate);
  document.addEventListener("visibilitychange", handleEnvironment);
  motionPreference.addEventListener("change", handleEnvironment);
  pointerPreference.addEventListener("change", releasePointer);
}

initializeMindsetLight();

function initializeProjectFilters(revealProjects = () => {}) {
  const root = document.querySelector("#projects");
  const board = root?.querySelector(".project-board");
  if (!board || !filters.length) return;

  const count = root.querySelector("[data-project-count]");
  const empty = root.querySelector("[data-project-empty]");
  const reset = root.querySelector("[data-project-reset]");
  const years = [...root.querySelectorAll("[data-project-year]")];
  const selection = { category: "all", year: "all" };

  function applyFilters(animate = true) {
    const visibleCards = [];

    filters.forEach((item) => {
      const active = item.dataset.filter === selection.category;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    years.forEach((item) => {
      const active = item.dataset.projectYear === selection.year;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    projectCards.forEach((card) => {
      const categories = (card.dataset.category || "").split(/\s+/);
      const year = card.querySelector(".project-footer time")?.dateTime.slice(0, 4);
      const categoryMatches = selection.category === "all" || categories.includes(selection.category);
      const yearMatches = selection.year === "all" || year === selection.year;
      const visible = categoryMatches && yearMatches;
      card.classList.toggle("is-hidden", !visible);
      if (visible) visibleCards.push(card);
    });

    const visibleCount = visibleCards.length;
    board.toggleAttribute("data-filtered", selection.category !== "all" || selection.year !== "all");
    board.classList.toggle("is-empty", visibleCount === 0);
    if (count) count.textContent = `${visibleCount} ${visibleCount === 1 ? "project" : "projects"}`;
    if (empty) empty.hidden = visibleCount !== 0;
    if (animate) revealProjects(visibleCards);
  }

  filters.forEach((filter) => filter.addEventListener("click", () => {
    if (selection.category === filter.dataset.filter) return;
    selection.category = filter.dataset.filter;
    applyFilters();
  }));
  years.forEach((year) => year.addEventListener("click", () => {
    if (selection.year === year.dataset.projectYear) return;
    selection.year = year.dataset.projectYear;
    applyFilters();
  }));
  const all = filters.find((filter) => filter.dataset.filter === "all");
  reset?.addEventListener("click", () => {
    selection.category = "all";
    selection.year = "all";
    applyFilters();
    all?.focus({ preventScroll: true });
  });
  applyFilters(false);
}

function initializeProjectReveal() {
  const root = document.querySelector("#projects");
  if (!root || typeof IntersectionObserver !== "function") return () => {};

  const cards = [...root.querySelectorAll(".project-card")];
  if (!cards.length) return () => {};
  const pending = new Set();
  let observer;
  let revision = 0;

  function disconnect() {
    revision += 1;
    observer?.disconnect();
  }

  function reveal(card, instant = false, delay = 0) {
    if (instant) card.setAttribute("data-project-instant", "");
    if (!pending.delete(card)) return;
    card.style.setProperty("--project-entry-delay", `${delay}ms`);
    card.setAttribute("data-project-entry", "shown");
    observer?.unobserve(card);
    if (!pending.size) disconnect();
  }

  function handleFocus(event) {
    const card = event.target.closest(".project-card");
    if (card && root.contains(card)) reveal(card, true);
  }

  function handleMotion() {
    if (!motionPreference.matches) return;
    cards.forEach((card) => reveal(card, true));
  }

  function handleVisibility() {
    disconnect();
    if (document.hidden || motionPreference.matches || !pending.size) return;
    const currentRevision = revision;
    observer = new IntersectionObserver((entries) => {
      if (document.hidden || currentRevision !== revision) return;
      // Ignore stale batches from earlier filters; stagger only cards now in view.
      entries.filter((entry) => entry.isIntersecting && pending.has(entry.target))
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
        .forEach((entry, index) => reveal(entry.target, false, Math.min(index * 70, 140)));
    }, { threshold: .08, rootMargin: "0px 0px -16px 0px" });
    pending.forEach((card) => observer.observe(card));
  }

  function prepare(visibleCards, replay = true) {
    disconnect();
    pending.clear();
    if (motionPreference.matches) {
      cards.forEach((card) => {
        card.removeAttribute("data-project-entry");
        card.removeAttribute("data-project-instant");
      });
      return;
    }
    visibleCards.forEach((card) => {
      card.setAttribute("data-project-instant", "");
      card.style.setProperty("--project-entry-delay", "0ms");
      card.setAttribute("data-project-entry", "pending");
      pending.add(card);
    });
    // Commit one nonanimated reset per filter change before observing the new layout.
    if (replay && visibleCards.length) void root.offsetWidth;
    visibleCards.forEach((card) => card.removeAttribute("data-project-instant"));
    handleVisibility();
  }

  root.addEventListener("focusin", handleFocus);
  document.addEventListener("visibilitychange", handleVisibility);
  motionPreference.addEventListener("change", handleMotion);
  prepare(cards, false);
  return prepare;
}

const revealProjects = initializeProjectReveal();
initializeProjectFilters(revealProjects);

function initializeProjectAmbience() {
  const root = document.querySelector("#projects");
  const ambience = root?.querySelector("[data-project-ambience]");
  const particles = root?.querySelector("[data-project-particles]");
  if (!ambience || !particles || !("IntersectionObserver" in window)) return;

  let visible = false;
  let initialized = false;

  function updateAmbience() {
    const active = visible && !document.hidden && !motionPreference.matches;
    if (active && !initialized) {
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < 24; index += 1) {
        const particle = document.createElement("span");
        particle.className = "project-particle";
        particle.style.setProperty("--particle-x", `${(7 + index * 31) % 96}%`);
        particle.style.setProperty("--particle-y", `${(13 + index * 23) % 94}%`);
        particle.style.setProperty("--particle-duration", `${18 + (index % 5) * 3}s`);
        particle.style.setProperty("--particle-delay", `${index * -2.3}s`);
        particle.style.setProperty("--particle-drift", `${index % 2 ? -26 : 32}px`);
        fragment.append(particle);
      }
      particles.append(fragment);
      initialized = true;
    }
    ambience.classList.toggle("is-ambient-visible", active);
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateAmbience();
  });
  observer.observe(root);
  document.addEventListener("visibilitychange", updateAmbience);
  motionPreference.addEventListener("change", updateAmbience);
  window.addEventListener("pagehide", () => ambience.classList.remove("is-ambient-visible"));
  window.addEventListener("pageshow", updateAmbience);
}

initializeProjectAmbience();

projectCards.forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rx = ((y / rect.height) - .5) * -15;
    const ry = ((x / rect.width) - .5) * 18;

    card.style.setProperty("--rx", `${rx}deg`);
    card.style.setProperty("--ry", `${ry}deg`);
    card.style.setProperty("--mx", `${x}px`);
    card.style.setProperty("--my", `${y}px`);
  });

  card.addEventListener("pointerleave", () => {
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
    card.style.setProperty("--mx", "50%");
    card.style.setProperty("--my", "50%");
  });

  card.addEventListener("click", () => openProject(card.dataset.project));
});

let activeCertificateIndex = 0;

function setActiveCertificate(index) {
  if (!certificateCards.length) return;

  activeCertificateIndex = (index + certificateCards.length) % certificateCards.length;

  certificateCards.forEach((card, cardIndex) => {
    const isActive = cardIndex === activeCertificateIndex;
    card.classList.toggle("is-active", isActive);
    card.setAttribute("aria-current", isActive ? "true" : "false");
  });

  certificateDots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === activeCertificateIndex);
  });

  certificateCards[activeCertificateIndex].scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "center"
  });
}

function openCertificate(certificateKey) {
  const certificate = certificateData[certificateKey];
  if (!certificate || !certificateModal) return;

  document.querySelector("#certificate-modal-seal").textContent = certificate.seal;
  document.querySelector("#certificate-modal-type").textContent = certificate.type;
  document.querySelector("#certificate-modal-title").textContent = certificate.title;
  document.querySelector("#certificate-modal-description").textContent = certificate.description;
  document.querySelector("#certificate-modal-issuer").textContent = certificate.issuer;
  document.querySelector("#certificate-modal-year").textContent = certificate.year;
  document.querySelector("#certificate-modal-area").textContent = certificate.area;

  if (typeof certificateModal.showModal === "function") certificateModal.showModal();
}

certificateCards.forEach((card, index) => {
  card.addEventListener("click", () => {
    setActiveCertificate(index);
    openCertificate(card.dataset.certificate);
  });
});

certificateDots.forEach((dot) => {
  dot.addEventListener("click", () => setActiveCertificate(Number(dot.dataset.certificateDot)));
});

certificatePrev?.addEventListener("click", () => setActiveCertificate(activeCertificateIndex - 1));
certificateNext?.addEventListener("click", () => setActiveCertificate(activeCertificateIndex + 1));

magneticItems.forEach((item) => {
  item.addEventListener("pointermove", (event) => {
    const rect = item.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * 10;
    const y = ((event.clientY - rect.top) / rect.height - .5) * 10;
    item.style.setProperty("--magnet-x", `${x}px`);
    item.style.setProperty("--magnet-y", `${y}px`);
  });

  item.addEventListener("pointerleave", () => {
    item.style.setProperty("--magnet-x", "0px");
    item.style.setProperty("--magnet-y", "0px");
  });
});

function openProject(projectKey) {
  const project = projectData[projectKey];
  if (!project || !modal) return;

  document.querySelector("#modal-type").textContent = project.type;
  document.querySelector("#modal-title").textContent = project.title;
  document.querySelector("#modal-description").textContent = project.description;
  document.querySelector("#modal-role").textContent = project.role;
  document.querySelector("#modal-stack").textContent = project.stack;
  document.querySelector("#modal-status").textContent = project.status;
  document.querySelector("#modal-next").textContent = project.next;
  document.querySelector("#modal-media-label").textContent = "";

  if (typeof modal.showModal === "function") modal.showModal();
}

modalClose?.addEventListener("click", () => modal.close());
certificateModalClose?.addEventListener("click", () => certificateModal.close());

modal?.addEventListener("click", (event) => {
  if (event.target === modal) modal.close();
});

certificateModal?.addEventListener("click", (event) => {
  if (event.target === certificateModal) certificateModal.close();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal?.open) modal.close();
  if (event.key === "Escape" && certificateModal?.open) certificateModal.close();
});
