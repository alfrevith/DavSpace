// Public portfolio details only. Each fact carries evidence checked by the tests.
const fact = (id, title, text, file, href, label, evidence) => Object.freeze({
  id, title, text,
  source: Object.freeze({file, href, label, evidence: Object.freeze(evidence)})
});
const about = (id, title, text, evidence) => fact(id, title, text, 'index.html', '#about-me', 'About David', evidence);
const project = (id, title, text, evidence) => fact(id, title, text, 'data/projects.js', '#projects', 'Selected projects', evidence);
const credential = (id, title, text, evidence) => fact(id, title, text, 'data/credentials.json', '#certificates', 'Certificates + wins', evidence);

export const ACHIEVEMENT_FACTS = Object.freeze([
  about('salvadoran-roots', 'Salvadoran roots', 'David is a Salvadoran student with analytical and creative interests.', ['a Salvadoran student with an analytical mind and a strong creative side']),
  about('software-direction', 'A clear direction', 'David is working toward software engineering.', ['High school student, working toward software engineering.']),
  about('more-than-code', 'More than code', 'Photography, drawing, stories and poems are also part of David’s world.', ['Photography', 'Drawing', 'Stories', 'Poems']),
  about('words-and-ideas', 'Words and ideas', 'Writing and expressing ideas clearly are personal strengths of David.', ['Writing and expressing ideas clearly are strengths of mine.']),
  about('curious-mind', 'A curious mind', 'David enjoys self-directed learning and exploring unfamiliar ideas.', ['I learn on my own', 'try unfamiliar things']),
  about('physical-and-digital', 'Across two worlds', 'David’s interests include electronics, hardware, software and robotics.', ['Electronics', 'Hardware', 'Software', 'Robotics']),
  project('beyond-avanzo', 'Beyond the exam', 'Beyond helps students prepare for El Salvador’s AVANZO 2026 exam.', ['prepare for the AVANZO 2026 exam in El Salvador']),
  project('beyond-timed', 'Against the clock', 'Beyond includes 20-question practice exams with a 60-minute limit.', ['20-question timed exams with a 60-minute limit']),
  project('beyond-diagnostic', 'Go a little deeper', 'Beyond also offers 100-question diagnostic assessments.', ['100-question diagnostic assessments']),
  project('plant-bud-team', 'A greener idea', 'Plant Bud was developed with a ¡Supérate! Fundación Poma team in 2026.', ['Plant Bud is a web application I helped develop in 2026 alongside a team from ¡Supérate! Fundación Poma']),
  project('plant-bud-health', 'A little care', 'Plant Bud uses plant photos to help analyze plant health with AI.', ["analyze their plants' health through photos"]),
  project('plant-bud-garden', 'Room to grow', 'Plant Bud includes an AI-powered garden design tool.', ['AI-powered garden design tool']),
  project('klani-compost', 'A second life', 'Klani, the POT-C prototype, turns organic household waste into compost.', ['Klani, a smart compost bin designed to transform everyday organic waste', 'into natural compost']),
  project('pot-c-hardware', 'Beyond the screen', 'David helped 3D-print and assemble the POT-C prototype’s electronics.', ['3D printing of its components and the assembly of its internal electronic circuit']),
  project('cecam-first-steps', 'First steps matter', 'The CECAM school website was one of David’s early projects in 2025.', ['one of my earliest web development projects, started in 2025']),
  project('pets-health-tools', 'Care by design', 'Pet’s Health explored Figma and Microsoft Power Apps for pet care.', ['Pet\'s Health', 'Figma', 'Microsoft Power Apps']),
  credential('excel-expert-score', 'Expert precision', 'David scored 972/1000 on the Microsoft Excel Expert exam in 2026.', ['Microsoft Excel Expert', '972/1000', '2026-03-25']),
  credential('excel-score', 'A strong foundation', 'David scored 960/1000 on the Microsoft Excel exam in 2025.', ['Microsoft Excel (Microsoft 365 Apps)', '960/1000', '2025-10-31']),
  credential('toeic-progress', 'Another milestone', 'The portfolio records a TOEIC Listening and Reading score of 595 in 2025.', ['TOEIC Listening and Reading record: 595 points.', '2025-12-10']),
  credential('illustrated-memoir', 'A story of his own', 'David earned recognition for writing and publishing an illustrated memoir.', ['Recognition for writing and publishing a first illustrated memoir']),
  credential('academic-recognition', 'Keep showing up', 'David received ¡Supérate! recognition for academic performance in 2025.', ['Recognition for outstanding academic performance at Centro ¡Supérate! Fundación Poma', 'during 2025']),
  fact('photography-room', 'Light and memory', 'David’s Photography Room collects some of the moments he captures.', 'data/journey.json', 'photography.html', 'The Photography Room', ['A small selection of the moments I capture']),
  fact('drawings-room', 'Lines of imagination', 'The Sketchbook is home to David’s drawings and visual ideas.', 'data/journey.json', 'drawings.html', 'The Sketchbook', ['"title": "Drawings"', '"room": "The Sketchbook"']),
  fact('poem-miedos', 'A few words', 'David’s writing library includes the poem Miedos.', 'data/writing.json', 'writing.html', 'The Writer’s Room', ['"type": "poetry"', '"title": "Miedos"', '"author": "David Menjivar"']),
  fact('pupusas-story', 'An entire world', 'La Leyenda de las Pupusas is an 11-page story in David’s library.', 'data/writing.json', 'writing.html', 'The Writer’s Room', ['"title": "La Leyenda de las Pupusas"', '"pages": 11'])
]);

export const ACHIEVEMENT_INTERVAL = 15;
export const ACHIEVEMENT_STORAGE_KEY = 'davspace-survival-discoveries-v1';
const byId = new Map(ACHIEVEMENT_FACTS.map(entry => [entry.id, entry]));
const timeLabel = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function accessibleStorage(supplied) {
  if (supplied !== undefined) return supplied;
  try { return globalThis.localStorage; } catch { return null; }
}

function readSaved(storage) {
  try {
    const value = JSON.parse(storage?.getItem(ACHIEVEMENT_STORAGE_KEY) || 'null');
    if (!value || value.version !== 1 || !Array.isArray(value.records)) return [];
    const seen = new Set();
    return value.records.slice(0, ACHIEVEMENT_FACTS.length * 2).flatMap(record => {
      if (!record || !byId.has(record.id) || seen.has(record.id) ||
        typeof record.seconds !== 'number' || !Number.isFinite(record.seconds) || record.seconds < 0) return [];
      seen.add(record.id);
      return [{id: record.id, seconds: Math.min(1e9, Math.floor(record.seconds)),
        ...(Number.isFinite(record.kills) && record.kills >= 15 ? {kills: Math.floor(record.kills)} : {})}];
    });
  } catch { return []; }
}

/** Kills unlock milestones; simulation time only expires the notification. */
export function createAchievementLog({root, random = Math.random, storage} = {}) {
  const store = accessibleStorage(storage);
  const saved = readSaved(store);
  const list = root?.querySelector('[data-game-record-list]');
  const count = root?.querySelector('[data-game-record-count]');
  const empty = root?.querySelector('[data-game-record-empty]');
  const toast = root?.querySelector('[data-game-achievement]');
  const toastText = root?.querySelector('[data-game-achievement-text]');
  let nextAt = ACHIEVEMENT_INTERVAL;
  let toastUntil = -1;
  let active = true;
  let disposed = false;
  let lastId = '';

  function persist() {
    try { store?.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify({version: 1, records: saved})); } catch { /* Memory-only play is fully usable. */ }
  }

  function refresh() {
    if (count) count.textContent = String(saved.length);
    if (empty) empty.hidden = saved.length > 0;
    if (!list) return;
    const document = list.ownerDocument;
    const fragment = document.createDocumentFragment();
    for (const record of saved) {
      const entry = byId.get(record.id);
      const item = document.createElement('li');
      item.className = 'game-record-item';
      const time = document.createElement('span');
      time.className = 'game-record-time';
      time.textContent = record.kills ? `${record.kills} KILLS · ${timeLabel(record.seconds)}` : `${timeLabel(record.seconds)} SURVIVED`;
      const title = document.createElement('strong');
      title.className = 'game-record-title';
      title.textContent = entry.title;
      const copy = document.createElement('p');
      copy.className = 'game-record-copy';
      copy.textContent = entry.text;
      const source = document.createElement('a');
      source.className = 'game-record-source';
      source.href = entry.source.href;
      source.textContent = `${entry.source.label} ↗`;
      source.setAttribute('aria-label', `Read the source: ${entry.source.label}`);
      item.append(time, title, copy, source);
      fragment.append(item);
    }
    list.replaceChildren(fragment);
  }

  function hideToast() {
    toastUntil = -1;
    if (toast) toast.hidden = true;
    root?.removeAttribute('data-achievement-visible');
  }

  function showToast(entry, seconds) {
    toastUntil = seconds + 6;
    if (toastText) toastText.textContent = entry.text;
    if (toast) toast.hidden = false;
    root?.setAttribute('data-achievement-visible', '');
  }

  function advance(kills, seconds = 0) {
    if (disposed || !active || typeof kills !== 'number' || !Number.isFinite(kills) || kills < 0 || !Number.isFinite(seconds) || seconds < 0) return [];
    if (toastUntil >= 0 && seconds >= toastUntil) hideToast();
    const awards = [];
    const missed = Math.floor(kills / ACHIEVEMENT_INTERVAL) - nextAt / ACHIEVEMENT_INTERVAL + 1;
    // Bound unexpected clock jumps while still unlocking every available unique fact.
    const batch = Math.min(Math.max(0, missed), ACHIEVEMENT_FACTS.length);
    for (let index = 0; index < batch; index += 1) {
      const unseen = ACHIEVEMENT_FACTS.filter(entry => !saved.some(record => record.id === entry.id));
      const pool = unseen.length ? unseen : ACHIEVEMENT_FACTS.filter(entry => entry.id !== lastId);
      let roll;
      try { roll = Number(random()); } catch { roll = 0; }
      if (!Number.isFinite(roll)) roll = 0;
      const entry = pool[Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))];
      const at = nextAt + index * ACHIEVEMENT_INTERVAL;
      const repeat = saved.some(record => record.id === entry.id);
      if (!repeat) saved.push({id: entry.id, seconds: Math.floor(seconds), kills: at});
      lastId = entry.id;
      awards.push({...entry, seconds, kills: at, repeat});
      showToast(entry, seconds);
    }
    if (batch) {
      nextAt = (Math.floor(kills / ACHIEVEMENT_INTERVAL) + 1) * ACHIEVEMENT_INTERVAL;
      persist();
      refresh();
    }
    return awards;
  }

  function resetRun() {
    nextAt = ACHIEVEMENT_INTERVAL;
    hideToast();
  }

  refresh();
  return {
    advance, resetRun, refresh, hideToast,
    setActive(value) { active = Boolean(value); },
    get records() { return saved.map(record => ({...byId.get(record.id), seconds: record.seconds, kills: record.kills})); },
    dispose() { disposed = true; active = false; hideToast(); }
  };
}
