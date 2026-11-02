import fs from 'node:fs';

const photos = JSON.parse(fs.readFileSync('data/photography.json', 'utf8')).images;
const drawings = JSON.parse(fs.readFileSync('data/drawings.json', 'utf8')).images;
const arrow = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 16q11-1 22 0m-8-8 8 8-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const doorArrow = arrow;
const image = (entry, esc) => entry ? `<img src="${esc(entry.thumbnail)}" width="${entry.previewWidth}" height="${entry.previewHeight}" alt="${esc(entry.title)}" loading="lazy" decoding="async" data-door-image>` : '';

export function doorArt(kind, esc) {
  if (kind === 'photography') {
    const main = photos.find(p => p.order === 17 && p.thumbnail) || photos.find(p => p.width > p.height && p.thumbnail);
    const companion = photos.find(p => p.height > p.width && p.thumbnail);
    return `<span class="door-world-number" aria-hidden="true">01</span>
      <svg class="door-optics" viewBox="0 0 600 500" fill="none" aria-hidden="true"><circle cx="330" cy="240" r="205" stroke="currentColor" stroke-width=".6"/><circle cx="330" cy="240" r="185" stroke="currentColor" stroke-width=".6" stroke-dasharray="1 12"/><path data-door-stroke pathLength="1" d="M330 19v25m0 391v25M110 240h25m391 0h25M185 95l17 17m256 256 17 17M185 385l17-17m256-256 17-17" stroke="currentColor"/></svg>
      <span class="door-photo-main" data-door-part="print"><span class="door-photo-rail">A MOMENT, HELD IN LIGHT <i>01</i></span><span class="door-photo-window">${image(main, esc)}<span class="door-focus" aria-hidden="true"></span></span><span class="door-photo-credit">DAVID MENJIVAR <i>SELECTED PHOTOGRAPHS</i></span></span>
      <span class="door-photo-companion" data-door-part="companion">${image(companion, esc)}<span>A LITTLE LONGER TO LOOK.</span></span>
      <span class="door-light-beam" aria-hidden="true"></span><span class="door-inscription">LIGHT. TIME. MEMORY. <span>${arrow}</span></span>`;
  }
  if (kind === 'drawings') return `<span class="door-paper-back" aria-hidden="true"></span>
    <span class="door-ink-paper" data-door-part="paper"><span class="door-ink-edition">THE SKETCHBOOK <i>VOL. 02</i></span>
      <svg class="door-ink-frame" viewBox="0 0 600 460" preserveAspectRatio="none" fill="none" aria-hidden="true"><path data-door-stroke pathLength="1" d="M17 32Q185 15 577 25l7 130-4 128 3 146-171 7-213-3-179 3-2-156 2-129Z" stroke="currentColor" stroke-width="2"/><path data-door-stroke pathLength="1" d="m25 43 4 130m-2 191 2 60 123 3m297-397 122 5-1 86m-1 244-2 55-102 4M40 72l20-15m-19 30 31-27m-31 41 45-40M528 393l27-25m-17 36 25-23m-12 34 15-14" stroke="currentColor" stroke-width=".8"/></svg>
      <span class="door-drawing-print" data-door-part="drawing">${image(drawings.find(d => d.thumbnail), esc)}</span>
      <span class="door-ink-words">Loose thoughts.<br><strong>Living<br>lines.</strong><svg viewBox="0 0 180 36" fill="none" aria-hidden="true"><path data-door-stroke pathLength="1" d="M4 21q56-15 167-3M10 30q61-11 135-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
      <svg class="door-ink-doodles" viewBox="0 0 600 460" fill="none" aria-hidden="true"><path data-door-stroke pathLength="1" d="m454 69 6-13 7 14 15 3-12 10 1 15-12-8-13 6 4-14-10-10Zm54 54 3-9 5 8 10 2-8 6v9l-7-5-8 4 2-9-7-6ZM83 373q-9-18 1-27 13-14 29 1 5 9-1 24m-27-23 26 22m-32 12 43-2m-38 11 33-2m-15-28 11-14 6-21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m262 374 8-16 5 16-5 8Z" fill="currentColor"/></svg>
      <span class="door-ink-caption">PAPER. INK. POSSIBILITY. <span>${arrow}</span></span></span>`;
  return `<span class="door-desk-glow" aria-hidden="true"></span><span class="door-manuscript-back" aria-hidden="true"></span>
    <span class="door-burning-page" data-door-part="manuscript"><span class="door-manuscript-edition">THE BURNING MANUSCRIPT <i>III</i></span><span class="door-writing-words">Words<br>that <em>burn.</em></span><svg class="door-writing-line" viewBox="0 0 400 55" fill="none" aria-hidden="true"><path data-door-stroke pathLength="1" d="M8 33c43-13 77 6 118-5 30-8 11-26-3-13-15 15 56 24 80 11 24-13 3-24-5-12-14 21 67 18 96 10l94-4M23 45q178-5 319-8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><span class="door-writing-author">DAVID MENJIVAR <i>PAPER · INK · FIRE</i></span></span>
    <img class="door-quill" src="assets/illustrations/writing-quill.svg" width="180" height="420" alt="" data-door-part="quill">
    <svg class="door-fire" viewBox="0 0 220 210" fill="none" aria-hidden="true"><defs><linearGradient id="door-fire-light" x2="0" y2="1"><stop stop-color="#db6421" stop-opacity="0"/><stop offset=".4" stop-color="#f29439" stop-opacity=".4"/><stop offset=".8" stop-color="#ffe1a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffbf5b" stop-opacity="0"/></linearGradient></defs><path class="door-flame" d="M90 199c-26-25 5-48-7-69-7-25 24-48 16-90 42 39 10 58 24 80 12-17 13-41 25-58-7 41 30 70 9 91-8 17 7 31-5 46Z" fill="url(#door-fire-light)"/><path class="door-flame door-flame-second" d="M137 199c-5-25 24-42 11-68 28 11 12 40 29 45 3-23 15-31 16-49 22 39 10 50 1 72Z" fill="url(#door-fire-light)"/><g class="door-embers" fill="#efba70"><circle cx="111" cy="63" r="1.1"/><circle cx="163" cy="91" r="1.3"/><circle cx="85" cy="118" r=".8"/><circle cx="178" cy="31" r=".8"/></g></svg>
    <span class="door-inscription">THE INK IS STILL WARM. <span>${arrow}</span></span>`;
}
