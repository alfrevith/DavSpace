/* The Sketchbook's motion direction. All effects are finite, interruptible,
   and decorative: the gallery remains responsible for content and navigation. */
(() => {
  if (document.body.dataset.world !== 'drawings' || !Element.prototype.animate) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = selector => document.querySelector(selector);
  const active = new Set();
  const observed = new WeakSet();
  const seen = new WeakSet();
  const ease = 'cubic-bezier(.22,.68,.22,1)';
  const brushStart = 'polygon(0 0, 0 0, 0 23%, 0 49%, 0 76%, 0 100%, 0 100%)';
  const brushEnd = 'polygon(0 0, 110% 0, 106% 23%, 112% 49%, 105% 76%, 110% 100%, 0 100%)';
  let introFrame = 0;
  let imageDrawing = null, imageRevision = 0;

  const enabled = () => !motion.matches && document.visibilityState !== 'hidden';
  function play(element, frames, options = {}) {
    if (!element || !enabled()) return;
    const animation = element.animate(frames, {
      duration: 650, easing: ease, fill: 'backwards', ...options
    });
    active.add(animation);
    animation.finished.then(() => active.delete(animation), () => active.delete(animation));
    return animation;
  }
  function cancelWithin(element) {
    if (!element) return;
    for (const animation of active) {
      const target = animation.effect?.target;
      if (target && (target === element || element.contains(target))) {
        animation.cancel();
        active.delete(animation);
      }
    }
  }
  function settle() {
    cancelAnimationFrame(introFrame);
    clearImageDrawing();
    for (const animation of active) animation.cancel();
    active.clear();
    document.body.classList.remove('ink-intro');
    // Include CSS hover gestures as well as the vector choreography.
    for (const animation of document.getAnimations()) {
      if (document.body.contains(animation.effect?.target)) animation.cancel();
    }
  }
  function reveal(element, { delay = 0, duration = 520 } = {}) {
    return play(element, [
      { clipPath: brushStart, opacity: 0 },
      { clipPath: brushEnd, opacity: 1 }
    ], { delay, duration });
  }

  // pathLength=1 gives every hand-drawn path its own consistent pen speed.
  // Fills soak in after the outline. Paper-colored fills stay opaque throughout.
  function trace(root, { delay = 0, duration = 850, stagger = 50, fillInk = true } = {}) {
    if (!root || !enabled()) return;
    const paths = [...root.querySelectorAll('[data-ink-stroke]')].map(path => {
      const style = getComputedStyle(path);
      return { path, stroke: style.stroke, width: style.strokeWidth, fill: style.fill, fillOpacity: style.fillOpacity };
    });
    paths.forEach(({ path, stroke, width, fill, fillOpacity }, index) => {
      const outlined = stroke !== 'none' && parseFloat(width) > 0;
      const filled = fillInk && (fill === 'rgb(33, 29, 24)' || fill.startsWith('url('));
      if (!outlined && !filled) return;
      const from = {}, wet = {}, dry = {};
      if (outlined) {
        from.strokeDasharray = wet.strokeDasharray = dry.strokeDasharray = '1 1';
        from.strokeDashoffset = '1'; wet.strokeDashoffset = '.24'; dry.strokeDashoffset = '0';
      }
      if (filled) {
        from.fillOpacity = 0; wet.fillOpacity = 0; dry.fillOpacity = fillOpacity;
      }
      play(path, [{ ...from, offset: 0 }, { ...wet, offset: .65 }, { ...dry, offset: 1 }], {
        delay: delay + index * stagger, duration, easing: 'cubic-bezier(.38,.12,.3,1)'
      });
    });
  }

  function drawStudio() {
    const studio = $('.studio-illustration');
    cancelWithin(studio);
    trace(studio, { duration: 950, stagger: 65 });
    play(studio?.querySelector('.studio-pen'), [
      { transform: 'rotate(-4deg) translateY(-3px)' },
      { transform: 'rotate(1deg)', offset: .65 },
      { transform: 'none' }
    ], { duration: 1150, delay: 140 });
    play(studio?.querySelector('.studio-drop'), [
      { transform: 'translateY(-13px) scale(.35)' },
      { transform: 'translateY(2px) scale(1.08)', offset: .8 },
      { transform: 'none' }
    ], { duration: 620, delay: 620 });
  }

  function introduction() {
    if (document.documentElement.hasAttribute('data-world-arriving')) {
      window.addEventListener('creative:arrived', introduction, { once: true }); return;
    }
    if (!enabled()) return;
    document.body.classList.add('ink-intro');
    reveal($('.heading-copy > .room-kicker'), { duration: 480 });
    reveal($('.room-heading h1 > span'), { delay: 80, duration: 480 });
    document.querySelectorAll('.ink-letter').forEach((letter, index) => {
      reveal(letter, { delay: 160 + index * 55, duration: 570 });
    });
    play($('[data-title-line]'), [
      { strokeDasharray: '1 1', strokeDashoffset: 1 },
      { strokeDasharray: '1 1', strokeDashoffset: 0 }
    ], { delay: 620, duration: 1150, easing: 'cubic-bezier(.4,.05,.35,1)' });
    play($('[data-title-echo]'), [
      { strokeDasharray: '1 1', strokeDashoffset: 1 },
      { strokeDasharray: '1 1', strokeDashoffset: 0 }
    ], { delay: 1570, duration: 480 });
    if (CSS.supports('offset-path', 'path("M0 0L1 1")')) {
      play($('.flourish-writer'), [
        { offsetDistance: '0%', opacity: 0 },
        { offsetDistance: '3%', opacity: 1, offset: .08 },
        { offsetDistance: '96%', opacity: 1, offset: .92 },
        { offsetDistance: '100%', opacity: 0 }
      ], { delay: 620, duration: 1150, easing: 'cubic-bezier(.4,.05,.35,1)' });
    }
    reveal($('.room-heading-bottom'), { delay: 600, duration: 700 });
    reveal($('.room-edition'), { delay: 850, duration: 550 });
    reveal($('.sketch-margin-note'), { delay: 1200, duration: 650 });
    drawStudio();
  }

  function drawBook() {
    const book = $('[data-strip]');
    trace(book?.querySelector('.spread-paper'), { duration: 1100, stagger: 85, fillInk: false });
    trace(book?.querySelector('.mount-outline'), { delay: 120, duration: 1100, stagger: 150 });
    trace(book?.querySelector('.art-notes'), { delay: 450, duration: 750, stagger: 70 });
    reveal($('[data-item-title]'), { delay: 350, duration: 550 });
    reveal($('.frame-label'), { delay: 450, duration: 600 });
  }

  function clearImageDrawing() {
    imageRevision++;
    if (!imageDrawing) return;
    cancelWithin(imageDrawing.image);
    cancelWithin(imageDrawing.svg);
    imageDrawing.svg?.remove();
    imageDrawing = null;
  }
  async function drawSelectedImage() {
    clearImageDrawing();
    const image = $('[data-selected-image] img');
    if (!image || !enabled()) return;
    const revision = imageRevision;
    const inkPass = CSS.supports('mask-image', 'linear-gradient(black, transparent)')
      ? { maskImage: 'linear-gradient(100deg, #000 0%, #000 65%, transparent 100%)', maskRepeat: 'no-repeat', maskPosition: 'left center' }
      : {};
    // Hold only until this preview decodes; a rapid turn or preference change
    // cancels the hold and restores the unmodified image immediately.
    const paint = play(image, [
      { ...inkPass, opacity: 0, maskSize: '0% 100%' },
      { ...inkPass, opacity: 0, maskSize: '0% 100%', offset: .25 },
      { ...inkPass, opacity: .2, maskSize: '85% 100%', offset: .5 },
      { ...inkPass, opacity: 1, maskSize: '180% 100%', offset: .92 },
      { ...inkPass, opacity: 1, maskSize: '200% 100%' }
    ], { duration: 1400, easing: 'linear' });
    if (!paint) return;
    paint.pause(); paint.currentTime = 0;
    imageDrawing = { image, svg: null };
    try {
      await image.decode();
      if (revision !== imageRevision || !enabled() || !image.isConnected || paint.playState === 'idle') return;
      let svg = null;
      try { svg = window.SketchbookInk?.createTracing(image, document); }
      catch { /* Unreadable pixels still receive the brush reveal. */ }
      if (svg) {
        image.parentElement.append(svg);
        imageDrawing.svg = svg;
        trace(svg, { duration: 620, stagger: 6, fillInk: false });
        play(svg, [
          { opacity: 0 }, { opacity: .88, offset: .1 },
          { opacity: .8, offset: .5 }, { opacity: 0, offset: .95 }, { opacity: 0 }
        ], { duration: 1400, easing: 'linear' });
      }
      paint.play();
      paint.finished.then(() => {
        if (revision === imageRevision) clearImageDrawing();
      }, () => {});
    } catch {
      if (revision === imageRevision) clearImageDrawing();
    }
  }

  // The gallery invokes this only for this room. Rapid turns cancel the previous
  // gesture immediately, so controls never queue or wait for an animation.
  function turnPage(direction) {
    const frame = $('.art-frame'), notes = $('.art-notes');
    cancelWithin(frame); cancelWithin(notes);
    if (!enabled()) return;
    const sign = direction > 0 ? 1 : -1;
    drawSelectedImage();
    trace($('.mount-outline'), { duration: 680, stagger: 75 });
    trace($('.notes-rule'), { delay: 110, duration: 500 });
    reveal($('[data-item-title]'), { delay: 80, duration: 400 });
    reveal($('[data-item-number]'), { duration: 350 });
    reveal($('[data-frame-number]'), { delay: 120, duration: 350 });
    play($('.notes-star'), [
      { transform: 'rotate(7deg)' },
      { transform: `rotate(${7 + sign * 17}deg)`, offset: .4 },
      { transform: 'rotate(7deg)' }
    ], { duration: 680 });
  }
  window.SketchbookMotion = { turnPage };

  function drawCard(card) {
    trace(card.querySelector('.folio-trace'), { duration: 760, stagger: 120 });
    reveal(card.querySelector('.contact-caption'), { delay: 180, duration: 480 });
  }
  function drawFooter() {
    trace($('.world-footer'), { duration: 650, stagger: 55 });
    reveal($('.footer-thought span'), { delay: 150, duration: 750 });
  }
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (seen.has(entry.target)) continue;
      seen.add(entry.target);
      if (!enabled()) continue;
      if (entry.target.matches('[data-strip]')) drawBook();
      else if (entry.target.matches('.contact-frame')) drawCard(entry.target);
      else drawFooter();
    }
  }, { threshold: .12 }) : null;
  function observe(element) {
    if (element && observer && !observed.has(element)) {
      observed.add(element); observer.observe(element);
    }
  }
  observe($('[data-strip]')); observe($('.world-footer'));

  // The collection arrives asynchronously. Decorate each folio once, retaining
  // its static CSS outline as the fallback if motion/JS is unavailable.
  const sheet = $('[data-sheet]');
  function decorateFolios() {
    const template = $('#ink-folio-template');
    if (!template) return;
    sheet.querySelectorAll('.contact-frame:not(.has-ink-outline)').forEach(card => {
      card.append(template.content.cloneNode(true));
      card.classList.add('has-ink-outline');
      observe(card);
    });
  }
  const folios = new MutationObserver(decorateFolios);
  folios.observe(sheet, { childList: true });
  decorateFolios();

  const dialog = $('#art-viewer');
  const dialogObserver = new MutationObserver(() => {
    cancelWithin(dialog);
    if (!dialog.open || !enabled()) return;
    clearImageDrawing();
    play(dialog, [
      { opacity: 0, transform: 'translateY(6px) rotate(-.25deg)' },
      { opacity: 1, transform: 'none' }
    ], { duration: 290 });
    reveal(dialog.querySelector('header > div'), { duration: 420, delay: 90 });
    trace(dialog.querySelector('footer'), { delay: 120, duration: 430, stagger: 30 });
  });
  dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });

  // A fresh pen stroke on hover and keyboard focus, with no ambient loops.
  function inkControl(event) {
    const control = event.target.closest('a, button');
    if (!control || control.contains(event.relatedTarget) || !enabled()) return;
    control.querySelectorAll('.ink-icon').forEach(svg => {
      cancelWithin(svg); trace(svg, { duration: 380, stagger: 45, fillInk: false });
    });
  }
  document.addEventListener('pointerover', event => { if (event.pointerType === 'mouse') inkControl(event); });
  document.addEventListener('focusin', inkControl);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-mode]')) {
      clearImageDrawing();
      cancelWithin($('[data-strip]').hidden ? $('[data-strip]') : sheet);
    }
  });
  $('[data-ink-replay]')?.addEventListener('click', drawStudio);
  motion.addEventListener('change', () => { if (motion.matches) settle(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
  window.addEventListener('pagehide', settle);
  window.addEventListener('pageshow', event => { if (event.persisted) settle(); });
  introFrame = requestAnimationFrame(introduction);
})();
