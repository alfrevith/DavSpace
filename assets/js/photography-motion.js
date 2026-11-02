/* Gentle print arrivals and a quiet light-table viewer. Photographs remain
   intact; no pixel masks, exposure flashes or travelling image copies. */
(() => {
  if (document.body.dataset.world !== 'photography') return;
  const $ = selector => document.querySelector(selector);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const dialog = $('#art-viewer'), paper = $('[data-art-paper]');
  const active = new Set(), developments = new Map();
  const ease = 'cubic-bezier(.18,.72,.2,1)';
  let introLayer = null, transit = null;
  let closeCallback = null, closing = false, generation = 0;
  let lastOrbit = '', lastScroll = -1, paletteImage = null;
  const enabled = () => !reduce.matches && !document.hidden && !!Element.prototype.animate;
  const visible = element => { const r = element?.getBoundingClientRect(); return r && r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };

  function play(element, frames, options = {}) {
    if (!element || !enabled()) return null;
    const animation = element.animate(frames, { duration: 700, easing: ease, fill: 'backwards', ...options });
    active.add(animation);
    animation.finished.then(() => active.delete(animation), () => active.delete(animation));
    return animation;
  }
  function cancelWithin(element) {
    if (!element) return;
    for (const animation of active) {
      const target = animation.effect?.target;
      if (target && (target === element || element.contains(target))) { animation.cancel(); active.delete(animation); }
    }
  }
  function cancelDevelopments(root = document.body) {
    for (const [image, task] of developments) if (root === document.body || image === root || root.contains(image)) {
      developments.delete(image); task.animation?.cancel();
    }
  }
  function inkLight(image) {
    if (!enabled() || !image?.complete || !image.naturalWidth || image === paletteImage) return;
    try {
      const data = window.PhotographyEmulsion?.sample(image, document);
      if (!data) return;
      paletteImage = image;
      const light = $('.context-light');
      const previous = getComputedStyle(light).backgroundColor;
      const color = `rgba(${data.color.join(',')},.11)`;
      // Ambient color belongs behind the prints, never over their pixels.
      light.style.backgroundColor = color;
      $('.exposure-scale').style.setProperty('--meter-shift', `${((data.color.reduce((sum, c) => sum + c, 0) / 765 - .5) * 20).toFixed(1)}px`);
      cancelWithin(light);
      play(light, [{ backgroundColor: previous }, { backgroundColor: color }], { duration: 1100 });
    } catch { /* The warm static lighting remains when pixels cannot be read. */ }
  }
  async function revealPrint(image, delay = 0, duration = 600) {
    if (!image || !enabled()) return;
    cancelDevelopments(image);
    const task = { animation: null };
    developments.set(image, task);
    try {
      await image.decode();
      if (developments.get(image) !== task) return;
      if (!image.isConnected || !enabled()) { developments.delete(image); return; }
      if (!paletteImage && image.closest('.print-primary')) inkLight(image);
      if (image.closest('[data-selected-image]')) inkLight(image);
      task.animation = play(image, [
        { opacity: .65, transform: 'scale(1.012)' },
        { opacity: 1, transform: 'scale(1)' }
      ], { delay: Math.min(110, delay), duration: Math.min(640, duration) });
      const done = () => { if (developments.get(image) === task) developments.delete(image); };
      if (task.animation) task.animation.finished.then(done, done); else done();
    } catch {
      if (developments.get(image) === task) { developments.delete(image); task.animation?.cancel(); }
    }
  }
  function trace(root, delay = 0, duration = 600) {
    cancelWithin(root);
    root?.querySelectorAll('path,circle,line').forEach((path, index) => {
      if (path.closest('defs') || getComputedStyle(path).stroke === 'none') return;
      path.setAttribute('pathLength', '1');
      play(path, [{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], { delay: delay + index * 35, duration });
    });
  }
  function textReveal(element, delay = 0, duration = 850) {
    cancelWithin(element);
    play(element, [
      { clipPath: 'inset(100% -4% -12% -4%)', transform: 'translateY(9px)', opacity: .2 },
      { clipPath: 'inset(-12% -4% -12% -4%)', transform: 'none', opacity: 1 }
    ], { delay, duration });
  }
  function reveal(root, delay = 0) {
    if (!root || !enabled()) return;
    const image = root.querySelector('img');
    if (image) {
      revealPrint(image, delay);
      textReveal(root.querySelector('.contact-caption,figcaption'), Math.min(110, delay), 500);
      trace(root.querySelector('.focus-corners'), delay, 600);
    } else {
      const title = root.querySelector('h2');
      if (title) textReveal(title, delay, 1000);
      else textReveal(root, delay, 850);
      root.querySelectorAll('.room-kicker,.exhibition-aside,.photo-socials a').forEach((item, i) => textReveal(item, delay + i * 95, 850));
      trace(root.querySelector('.photo-icon'), delay + 200, 800);
    }
  }

  function dismissIntro() { cancelWithin(introLayer); introLayer?.remove(); introLayer = null; }
  function intro(force = false) {
    if (!force && document.documentElement.hasAttribute('data-world-arriving')) {
      window.addEventListener('creative:arrived', () => intro(), { once: true }); return;
    }
    let first = false;
    try { first = !sessionStorage.getItem('davspace:photography:exposure:v2'); sessionStorage.setItem('davspace:photography:exposure:v2', '1'); } catch { /* No artificial loader when storage is denied. */ }
    if (!enabled()) return;
    dismissIntro(); cancelWithin($('.opening-copy')); cancelDevelopments($('.opening-prints'));
    const cinematic = force || first || !!window.creativeWorldEntry;
    if (cinematic) {
      const w = innerWidth, h = innerHeight, cx = w * (mobile.matches ? .58 : .63), cy = h * .4;
      const radius = Math.hypot(w, h), points = Array.from({ length: 6 }, (_, i) => `${cx + Math.cos(i * Math.PI / 3) * 100},${cy + Math.sin(i * Math.PI / 3) * 100}`).join(' ');
      const blades = Array.from({ length: 6 }, (_, i) => `<g transform="rotate(${i * 60} ${cx} ${cy})"><path class="iris-blade" d="M${cx - radius},${cy - radius}H${cx + radius}V${cy - 30}Q${cx + 50},${cy - 100} ${cx - 90},${cy + 45}Z" fill="#11120f" stroke="#c0a779" stroke-opacity=".16" stroke-width="1"/></g>`).join('');
      introLayer = document.createElement('div'); introLayer.className = 'photo-intro'; introLayer.setAttribute('aria-hidden', 'true'); introLayer.setAttribute('inert', '');
      introLayer.innerHTML = `<svg viewBox="0 0 ${w} ${h}"><defs><mask id="optical-opening" maskUnits="userSpaceOnUse"><rect width="${w}" height="${h}" fill="white"/><polygon data-iris points="${points}" fill="black"/></mask></defs><g mask="url(#optical-opening)"><rect width="${w}" height="${h}" fill="#070808"/><g class="iris-engraving">${blades}</g></g></svg><span class="intro-halation" style="left:${cx}px;top:${cy}px"></span><span class="intro-focus" style="left:${cx}px;top:${cy}px"></span>`;
      document.body.append(introLayer);
      const aperture = introLayer.querySelector('[data-iris]'); aperture.style.transformOrigin = `${cx}px ${cy}px`;
      aperture.style.transform = `scale(${radius / 62}) rotate(18deg)`;
      play(aperture, [{ transform: 'scale(.004) rotate(-18deg)' }, { transform: 'scale(.05) rotate(-13deg)', offset: .18 }, { transform: `scale(${radius / 62}) rotate(18deg)` }], { duration: 1450, easing: 'cubic-bezier(.62,.02,.19,1)' });
      introLayer.querySelectorAll('.iris-blade').forEach((blade, i) => {
        blade.style.transformOrigin = `${cx}px ${cy}px`;
        play(blade, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-24deg) translateY(-25px)' }], { duration: 1250, delay: i * 12 });
      });
      play(introLayer.querySelector('.intro-halation'), [{ opacity: 0 }, { opacity: .85, offset: .17 }, { opacity: 0, offset: .65 }, { opacity: 0 }], { duration: 1450 });
      play(introLayer.querySelector('.intro-focus'), [{ opacity: 0, transform: 'scale(.4)' }, { opacity: .7, transform: 'scale(1)', offset: .25 }, { opacity: 0, transform: 'scale(1.4)' }], { duration: 900 });
      const end = play(introLayer, [{ opacity: 1 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: 1470 });
      end?.finished.then(dismissIntro, () => {});
    }
    const offset = cinematic ? 420 : 0;
    $('.room-heading h1').querySelectorAll('.photo-title-line > *').forEach((line, i) => textReveal(line, offset + i * 125, 1000));
    textReveal($('.photo-room-name'), offset + 40, 850);
    textReveal($('.opening-copy .room-kicker'), offset, 650);
    textReveal($('.opening-description'), offset + 380, 950);
    textReveal($('.exhibition-link'), offset + 530, 850);
    textReveal($('.opening-colophon'), offset + 650, 850);
    trace($('.optical-signature'), offset, 1600);
    $('.opening-prints').querySelectorAll('.hero-print').forEach((print, i) => { if (visible(print)) revealPrint(print.querySelector('img'), i * 70); });
    inkLight($('.print-primary img'));
  }

  function clearTransit() {
    generation++;
    if (transit) { cancelWithin(transit.layer); transit.layer.remove(); transit = null; }
  }
  function beforeOpen() {
    cancelDevelopments(); dismissIntro(); clearTransit();
  }
  function opened() {
    cancelWithin(dialog);
    play(dialog, [
      { opacity: 0, transform: 'translateY(10px) scale(.985)' },
      { opacity: 1, transform: 'none' }
    ], { duration: 380 });
  }
  function imageChanging(entry) {
    if (closing) { closeCallback = null; closing = false; cancelWithin(dialog); }
    clearTransit();
    const previous = paper.querySelector('img');
    if (!previous && !entry?.preview) return;
    const layer = document.createElement('div'); layer.className = 'photo-ghost'; layer.setAttribute('aria-hidden', 'true');
    const copy = previous ? previous.cloneNode() : document.createElement('img');
    if (!previous) copy.src = entry.preview;
    copy.alt = ''; copy.removeAttribute('id'); layer.append(copy);
    $('.art-stage').append(layer); transit = { layer };
  }
  async function imageReady(image) {
    const revision = generation;
    try { await image.decode(); } catch { if (revision === generation) clearTransit(); return; }
    if (!dialog.open || !image.isConnected || revision !== generation) return;
    if (!enabled()) { clearTransit(); return; }
    play(image, [{ opacity: .45 }, { opacity: 1 }], { duration: 320 });
    const own = transit;
    if (own) play(own.layer, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 })?.finished.then(() => {
      if (transit === own) clearTransit();
    }, () => {});
  }
  function completeClose() {
    const callback = closeCallback; closeCallback = null; closing = false;
    cancelWithin(dialog); clearTransit(); callback?.();
  }
  function requestClose(callback) {
    if (closing) { completeClose(); return; }
    if (!enabled() || !dialog.open) { callback(); return; }
    cancelWithin(dialog); clearTransit();
    closing = true; closeCallback = callback;
    play(dialog, [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(5px) scale(.99)' }
    ], { duration: 200 })?.finished.then(completeClose, () => {});
  }
  function advance() {
    cancelDevelopments();
    revealPrint($('[data-selected-image] img'), 0, 420);
    cancelWithin($('.art-notes')); textReveal($('[data-item-title]'), 0, 420);
    textReveal($('[data-item-number]'), 0, 350);
    textReveal($('[data-frame-number]'), 0, 350); textReveal($('[data-position]'), 0, 350);
  }
  function enhanceCard(card) {
    if (!card.querySelector('.focus-lock')) { const ring = document.createElement('span'); ring.className = 'focus-lock'; ring.setAttribute('aria-hidden', 'true'); card.querySelector('.contact-image').append(ring); }
  }
  function tick(pointer, elapsed, heroVisible, scroll) {
    if (!enabled()) return;
    if (fine.matches && heroVisible) {
      const orbit = `${pointer.x.toFixed(2)},${pointer.y.toFixed(2)}`;
      if (orbit !== lastOrbit) {
        $('.print-primary')?.style.setProperty('transform', `perspective(1400px) rotateY(${pointer.x * 2.2}deg) rotateX(${-pointer.y * 1.8}deg)`);
        $('.print-companion')?.style.setProperty('transform', `perspective(1400px) translate(${pointer.x * -4}px,${pointer.y * -3}px) rotateY(${pointer.x * -1.5}deg)`);
        lastOrbit = orbit;
      }
      if (lastScroll !== scroll) { $('.opening-prints').style.transform = `translateY(${-Math.min(700, scroll) * .035}px)`; lastScroll = scroll; }
    }
    // A slow, low-amplitude drift reads as air moving through a beam.
    $('.shaft-two').style.transform = `rotate(${29 + Math.sin(elapsed * .13) * .32}deg)`;
  }
  function settle() {
    if (closing) completeClose();
    dismissIntro(); cancelDevelopments(); clearTransit();
    for (const animation of active) animation.cancel(); active.clear();
    document.querySelectorAll('.hero-print,.opening-prints').forEach(node => node.style.removeProperty('transform'));
    for (const animation of document.getAnimations()) if (animation.effect?.target?.closest?.('.world-photography') && animation.effect.getTiming().iterations !== Infinity) animation.cancel();
    lastOrbit = ''; lastScroll = -1;
  }
  dialog.addEventListener('cancel', event => { if (enabled()) { event.preventDefault(); requestClose(() => dialog.close()); } });
  dialog.addEventListener('close', () => { closeCallback = null; closing = false; cancelWithin(dialog); clearTransit(); });
  document.addEventListener('pointerdown', dismissIntro, { passive: true, capture: true });
  document.addEventListener('keydown', dismissIntro);
  function focusControl(event) {
    const control = event.target.closest('a,button');
    if (!control || control.contains(event.relatedTarget) || !enabled()) return;
    const image = control.querySelector('img'); if (image) inkLight(image);
    control.querySelectorAll('.photo-icon').forEach(svg => { cancelWithin(svg); trace(svg, 0, 460); });
  }
  document.addEventListener('pointerover', event => { if (event.pointerType === 'mouse') focusControl(event); });
  document.addEventListener('focusin', focusControl);
  $('[data-replay-opening]')?.addEventListener('click', () => intro(true));
  window.PhotographyMotion = { intro, dismissIntro, reveal, enhanceCard, beforeOpen, opened, imageChanging, imageReady, imageFailed: clearTransit, requestClose, advance, tick, settle,
    get state() { return { developments: developments.size, transit: !!transit, closing, animations: active.size }; }
  };
})();
