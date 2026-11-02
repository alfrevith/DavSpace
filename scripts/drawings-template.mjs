import fs from 'node:fs';

// Inline our own vector paths so individual strokes can be drawn without filters.
const sprite = fs.readFileSync(new URL('../assets/illustrations/sketchbook-ink.svg', import.meta.url), 'utf8');
const leaf = fs.readFileSync(new URL('../assets/illustrations/sketchbook-leaf.svg', import.meta.url), 'utf8');
function symbol(name) {
  const match = sprite.match(new RegExp(`<symbol id="${name}"[^>]*>([\\s\\S]*?)</symbol>`));
  if (!match) throw new Error(`Unknown sketchbook illustration: ${name}`);
  return match[1].replace(/<use href="#([\w-]+)"([^>]*)\/>/g, (_, ref, attrs) => `<g${attrs}>${symbol(ref)}</g>`);
}
const strokes = markup => markup.replace(/<path\b/g, '<path pathLength="1" data-ink-stroke');
const icon = (name, className = '') => `<svg class="ink-icon ${className}" aria-hidden="true" viewBox="0 0 48 48">${strokes(symbol(name))}</svg>`;
const studio = strokes(symbol('studio')).replaceAll('url(#hatch)', 'url(#studio-hatch)');
const hatch = sprite.match(/<pattern[\s\S]*?<\/pattern>/)[0].replace('id="hatch"', 'id="studio-hatch"');
const folio = strokes(leaf.replace(/<svg[^>]*>|<\/svg>/g, ''));

export function drawingsBody({ station, socials, escape: esc }) {
  return `<body class="creative-world world-drawings" data-world="drawings">
  <a class="skip-link" href="#collection">Skip to collection</a>
  <div class="ink-edge" aria-hidden="true"></div>
  <header class="world-header">
    <a class="portfolio-return" href="index.html#beyond-the-code">${icon('arrow-left')}<span>Back to Portfolio</span></a>
    <nav aria-label="Creative worlds">
      <a href="photography.html" data-world-link="photography"><small>01</small>Photography</a>
      <a href="drawings.html" aria-current="page" data-world-link="drawings"><small>02</small>Drawings</a>
      <a href="writing.html" data-world-link="writing"><small>03</small>Writing</a>
    </nav>
  </header>
  <main id="collection">
    <header class="room-heading">
      <div class="heading-copy">
        <p class="room-kicker">BEYOND THE CODE <span>/</span> WORLD 02</p>
        <h1 aria-label="The Sketchbook."><span>The</span> <em aria-hidden="true">${[...'Sketchbook.'].map(letter => `<span class="ink-letter">${letter}</span>`).join('')}</em></h1>
        <svg class="title-flourish" viewBox="0 0 720 32" fill="none" aria-hidden="true"><path data-title-line pathLength="1" d="M8 18C158 4 371 21 588 12c53-2 90-1 122 1" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path data-title-echo pathLength="1" d="M27 25c170-10 407 3 579-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><g class="flourish-writer"><path d="m0 0 13-23 10-2-3 10Z" fill="currentColor"/><path d="m0 0 15-19" stroke="var(--paper)" stroke-width="1"/></g></svg>
        <div class="room-heading-bottom"><p>${esc(station.subtitle)}<br><span>${esc(station.description)}</span></p></div>
      </div>
      <div class="heading-illustration">
        <button class="studio-replay" type="button" data-ink-replay aria-label="Draw the ink illustration again"><svg class="studio-illustration" viewBox="0 0 360 290" aria-hidden="true"><defs>${hatch}</defs>${studio}</svg></button>
        <p class="sketch-margin-note">Loose thoughts.<br>Deliberate lines.</p>
      </div>
      <span class="room-edition">DAVID MENJIVAR <span>✳</span> AN ONGOING COLLECTION</span>
    </header>

    <p class="collection-status" data-status role="status">Opening the collection…</p>
    <noscript><p>Enable JavaScript to browse the collection and open its viewer. You can still return to the portfolio or explore the profiles below.</p></noscript>
    <div class="collection-bar">
      <div class="room-tabs" role="group" aria-label="Gallery mode"><button type="button" data-mode="strip" aria-pressed="true">${icon('book')}Page by page</button><button type="button" data-mode="sheet" aria-pressed="false">${icon('grid')}All pages</button></div>
      <span class="archive-count" data-count></span>
    </div>
    <section class="art-collection" aria-label="Drawings collection">
      <div class="art-strip sketch-spread" data-strip hidden>
        <svg class="spread-paper" viewBox="0 0 1200 620" preserveAspectRatio="none" aria-hidden="true">${strokes(symbol('spread'))}</svg>
        <div class="art-frame">
          <div class="drawing-mount">
            <svg class="mount-outline" viewBox="0 0 700 500" preserveAspectRatio="none" aria-hidden="true"><path data-ink-stroke pathLength="1" d="M9 8Q189 14 352 7T690 10L694 246 689 491Q492 484 349 492T10 488L6 253Z"/><path data-ink-stroke pathLength="1" d="M16 18 221 15M681 23l3 160M679 482l-164 2M21 472l-4-87"/><path data-ink-stroke pathLength="1" class="mount-hatching" d="m6 424 27 26m-27-15 27 27m-27-13 26 25m-25-11 25 24M643 8l29 29m-17-29 32 32m-19-32 22 22"/></svg>
            <button class="art-open" data-open type="button" aria-label="Inspect selected image"><span class="art-preview" data-selected-image></span><span class="frame-inspect">A CLOSER LOOK ${icon('magnify')}</span></button>
          </div>
          <div class="frame-label"><span data-frame-number></span><span>A PAGE FROM MY SKETCHBOOK</span></div>
        </div>
        <div class="art-notes">
          <svg class="notes-star" aria-hidden="true" viewBox="0 0 48 48">${strokes(symbol('spark'))}</svg>
          <p class="room-kicker" data-item-number></p><h2 data-item-title></h2>
          <svg class="notes-rule" viewBox="0 0 230 16" aria-hidden="true"><path data-ink-stroke pathLength="1" d="M3 8Q67 3 135 7t90-2M5 13l143-2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"/></svg>
          <p data-item-description></p><p class="art-details" data-item-details></p>
          <button type="button" class="text-action" data-inspect>View original ${icon('arrow-right')}</button>
          <div class="page-annotation" aria-hidden="true">A little ink.<br>A little imagination.<svg viewBox="0 0 160 80" fill="none"><path data-ink-stroke pathLength="1" d="M7 10c40 1 112-7 122 24 5 15-20 26-33 22m0 0 8-11m-8 11 14 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>
          <svg class="notes-nib" viewBox="0 0 48 48" aria-hidden="true">${strokes(symbol('nib'))}</svg>
        </div>
      </div>
      <div class="art-pagination" data-pagination hidden><button type="button" data-prev aria-label="Previous page">${icon('arrow-left')}<span>Previous page</span></button><span class="page-position"><small>THE SKETCHBOOK</small><span data-position aria-live="polite"></span></span><button type="button" data-next aria-label="Next page"><span>Next page</span>${icon('arrow-right')}</button></div>
      <div class="contact-sheet" data-sheet hidden></div>
      <div class="creative-empty" data-empty hidden><div class="empty-sketch" aria-hidden="true"><span>NOTES / 01</span><svg viewBox="0 0 200 150" fill="none"><path d="m45 111 18-72 71 16-17 72zM65 50l57 12-13 53-52-11M83 104l18-37m-9 42 18-39M43 130l91 1"/></svg><small>A little room to imagine.</small></div><div><p class="room-kicker">AN OPEN SKETCHBOOK</p><h2>Every line begins somewhere.</h2><p>The first drawings will appear on these pages.<br>For now, the sketchbook is open to possibility.</p><span class="empty-footnote">Paper, patience, and a little imagination.</span></div></div>
    </section>
    <dialog class="art-dialog" aria-labelledby="art-title" id="art-viewer">
      <header><div><p class="room-kicker">A CLOSER LOOK</p><h2 id="art-title"></h2></div><button data-close type="button" aria-label="Close image viewer">${icon('close')}</button></header>
      <div class="art-stage" tabindex="0" aria-label="Artwork viewer"><p data-art-status role="status"></p><div data-art-paper></div></div>
      <footer><button data-art-prev type="button" aria-label="Previous image">${icon('arrow-left')}</button><p data-art-position aria-live="polite"></p><button data-art-next type="button" aria-label="Next image">${icon('arrow-right')}</button><button data-art-zoom type="button" aria-pressed="false">${icon('magnify')}<span>Zoom</span></button><a data-art-original target="_blank" rel="noopener noreferrer">Original ${icon('external')}</a></footer>
      <p class="art-caption" data-art-caption></p>
    </dialog>
  </main>
  <footer class="world-footer"><div class="footer-thought">${icon('nib')}<span>Not everything I create<br>is made of code.</span></div><div><a class="ink-social" href="${esc(socials.instagram)}" target="_blank" rel="noopener noreferrer" aria-label="More drawings on Instagram (opens in a new tab)">More drawings on Instagram ${icon('external')}</a></div><a class="footer-return" href="index.html#beyond-the-code">Back to Portfolio ${icon('arrow-left')}</a><span class="footer-colophon" aria-hidden="true">PAPER. INK. POSSIBILITY.</span></footer>
  <template id="ink-folio-template"><svg class="folio-trace" viewBox="0 0 400 330" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${folio}</svg></template>
  <script src="assets/js/creative-core.js" defer></script><script src="assets/js/drawings-ink-renderer.js" defer></script><script src="assets/js/drawings-motion.js" defer></script><script src="assets/js/creative-gallery.js" defer></script><script src="assets/js/creative-transitions.js" defer></script>
</body></html>`;
}
