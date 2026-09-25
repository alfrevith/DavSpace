const sections = [...document.querySelectorAll(".section")];
const reveals = [...document.querySelectorAll(".reveal")];
const links = [...document.querySelectorAll(".nav a")];
const filters = [...document.querySelectorAll("[data-filter]")];
const projectCards = [...document.querySelectorAll(".project-card")];
const magneticItems = [...document.querySelectorAll(".magnetic")];
const cursorLight = document.querySelector(".cursor-light");
const railProgress = document.querySelector(".rail-progress");
const glitchTarget = document.querySelector("[data-glitch]");
const modal = document.querySelector(".project-modal");
const modalClose = document.querySelector(".modal-close");

const projectData = {
  taskflow: {
    type: "web app / responsive",
    title: "Plant Bud",
    description: "A focused dashboard concept for organizing tasks, measuring progress, and visualizing priority. This detail view is ready for the real problem, process, screenshots, links, and outcomes.",
    role: "Frontend / Backend",
    stack: "HTML / CSS / JS / NODEJS / ADONISJS / PY",
    status: "Case slot",
    next: "Add the user problem, the main screens, the decisions you made, and what you learned from the build."
  },
  nova: {
    type: "landing / brand",
    title: "Nova Product Page",
    description: "A sharp landing page direction for a product story with compact content, clean visual hierarchy, and a stronger conversion path.",
    role: "UI direction",
    stack: "HTML / Tailwind / CSS",
    status: "Draft",
    next: "Add the brand goal, target audience, sections, visual references, and final live page."
  },
  resume: {
    type: "portfolio / identity",
    title: "Creative Resume",
    description: "A personal resume system that blends identity, skill proof, selected work, and contact details into one focused experience.",
    role: "Design and code",
    stack: "HTML / CSS / JS",
    status: "In progress",
    next: "Add real project images, your downloadable CV, GitHub links, and a short story for each section."
  }
};

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;

    const activeTarget = `#${entry.target.id}`;

    links.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === activeTarget);
    });
  });
}, { rootMargin: "-38% 0px -55% 0px", threshold: 0 });

sections.forEach((section) => sectionObserver.observe(section));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("is-visible");
  });
}, { threshold: .16 });

reveals.forEach((item) => revealObserver.observe(item));

function updateScrollProgress() {
  if (!railProgress) return;

  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable <= 0 ? 0 : (window.scrollY / scrollable) * 100;
  railProgress.style.setProperty("--progress", `${Math.min(100, Math.max(0, progress))}%`);
}

window.addEventListener("scroll", updateScrollProgress, { passive: true });
updateScrollProgress();

window.addEventListener("pointermove", (event) => {
  if (!cursorLight) return;
  cursorLight.style.setProperty("--x", `${event.clientX}px`);
  cursorLight.style.setProperty("--y", `${event.clientY}px`);
});

const words = ["websites", "apps", "photographies", "draws", "histories", "poems"];
const chars = "!<>-_\\/[]{}=+*^?#0123456789";
let wordIndex = 0;
let scrambleTimer;

function updateGlitchUnderline(text) {
  if (!glitchTarget) return;

  const width = Math.max(1, text.length);
  const line = glitchTarget.parentElement;
  if (!line) return;

  line.classList.remove("is-resizing");
  line.style.setProperty("--glitch-underline-width", `${width}ch`);
  void line.offsetWidth;
  line.classList.add("is-resizing");
  window.setTimeout(() => line.classList.remove("is-resizing"), 760);
}

function scrambleTo(nextWord) {
  if (!glitchTarget) return;

  window.clearInterval(scrambleTimer);

  const previousWord = glitchTarget.textContent || "";
  const maxLength = Math.max(previousWord.length, nextWord.length);
  let frame = 0;
  const totalFrames = 28;

  glitchTarget.classList.add("is-glitching");
  updateGlitchUnderline(nextWord);

  scrambleTimer = window.setInterval(() => {
    const progress = frame / totalFrames;
    const output = Array.from({ length: maxLength }, (_, index) => {
      if (index < nextWord.length && progress > index / maxLength) return nextWord[index];
      if (index >= nextWord.length) return "";
      return chars[Math.floor(Math.random() * chars.length)];
    }).join("");

    glitchTarget.textContent = output;
    glitchTarget.dataset.text = output;
    glitchTarget.style.setProperty("--shift", `${Math.sin(frame * 1.7) * 3}px`);

    frame += 1;
    if (frame > totalFrames) {
      window.clearInterval(scrambleTimer);
      glitchTarget.textContent = nextWord;
      glitchTarget.dataset.text = nextWord;
      glitchTarget.style.setProperty("--shift", "0px");
      window.setTimeout(() => glitchTarget.classList.remove("is-glitching"), 180);
    }
  }, 32);
}

updateGlitchUnderline(glitchTarget?.textContent || "");

window.setInterval(() => {
  wordIndex = (wordIndex + 1) % words.length;
  scrambleTo(words[wordIndex]);
}, 3600);

filters.forEach((filter) => {
  filter.addEventListener("click", () => {
    const value = filter.dataset.filter;

    filters.forEach((item) => item.classList.toggle("is-active", item === filter));
    projectCards.forEach((card) => {
      const visible = value === "all" || card.dataset.category === value;
      card.classList.toggle("is-hidden", !visible);
    });
  });
});

projectCards.forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rx = ((y / rect.height) - .5) * -8;
    const ry = ((x / rect.width) - .5) * 10;

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
  document.querySelector("#modal-media-label").textContent = `${project.title} preview slot`;

  if (typeof modal.showModal === "function") modal.showModal();
}

modalClose?.addEventListener("click", () => modal.close());

modal?.addEventListener("click", (event) => {
  if (event.target === modal) modal.close();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal?.open) modal.close();
});
