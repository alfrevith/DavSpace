/* Photography Room: finite exposure gestures and a deliberately small dust field.
   The gallery owns selection, originals, focus, zoom and navigation. */
(() => {
  if (document.body.dataset.world !== 'photography') return;
  const $ = selector => document.querySelector(selector);
  const director = window.PhotographyMotion;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const small = matchMedia('(max-width: 760px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const contextLight = document.createElement('div'); contextLight.className = 'context-light';
  document.querySelector('.photo-atmosphere').prepend(contextLight);
  const atmosphere = $('.photo-atmosphere'), dialog = $('#art-viewer');
  const active = new Set(), seen = new WeakSet(), exposed = new WeakSet();
  const ease = 'cubic-bezier(.2,.7,.2,1)';
  let introFrame = 0, resizeFrame = 0;
  let canvas = null, ctx = null, particles = [], sprite = null;
  let dustFrame = 0, lastTime = 0, elapsed = 0, width = 0, height = 0, dpr = 1;
  let inView = true, heroVisible = true, lastScroll = -1, lastLight = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const enabled = () => !motion.matches && !document.hidden;

  function play(element, frames, options = {}) {
    if (!element?.animate || !enabled()) return null;
    const animation = element.animate(frames, { duration: 650, easing: ease, fill: 'backwards', ...options });
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
  function expose(element, delay = 0, duration = 800) {
    if (director) return director.reveal(element, delay);
    return play(element, [{ opacity: .05 }, { opacity: 1 }], { delay, duration });
  }
  function dismissIntro() { director?.dismissIntro(); }
  function settle() {
    director?.settle();
    cancelAnimationFrame(introFrame);
    dismissIntro();
    for (const animation of active) animation.cancel();
    active.clear();
    $('.opening-prints').style.removeProperty('transform');
    lastScroll = -1;
  }

  // One transparent sprite supplies soft depth without per-particle blur filters.
  function prepareCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
      ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) { canvas = null; return false; }
      atmosphere.append(canvas);
      sprite = document.createElement('canvas'); sprite.width = sprite.height = 24;
      const brush = sprite.getContext('2d'), glow = brush.createRadialGradient(12, 12, 0, 12, 12, 12);
      glow.addColorStop(0, 'rgba(255,235,194,.9)'); glow.addColorStop(.2, 'rgba(235,208,162,.3)'); glow.addColorStop(1, 'rgba(215,191,148,0)');
      brush.fillStyle = glow; brush.fillRect(0, 0, 24, 24);
    }
    width = innerWidth; height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, small.matches ? 1.25 : 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = navigator.connection?.saveData ? 10 : (navigator.hardwareConcurrency || 4) <= 4 ? 16 : small.matches ? 18 : 34;
    particles = Array.from({ length: count }, (_, i) => ({
      x: Math.random(), y: Math.random(), phase: Math.random() * Math.PI * 2,
      depth: i % 3, speed: .002 + Math.random() * .004, alpha: .12 + Math.random() * .3
    }));
    return true;
  }
  function stopDust(clear = false) {
    cancelAnimationFrame(dustFrame); dustFrame = 0; lastTime = 0;
    document.body.setAttribute('data-ambient-paused', '');
    if (clear && ctx) ctx.clearRect(0, 0, width, height);
  }
  function tick(time) {
    if (!enabled() || !inView || dialog.open) { stopDust(); return; }
    dustFrame = requestAnimationFrame(tick);
    const interval = small.matches ? 1000 / 24 : 1000 / 30;
    if (lastTime && time - lastTime < interval) return;
    const dt = lastTime ? Math.min(.08, (time - lastTime) / 1000) : interval / 1000;
    lastTime = time; elapsed += dt;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.5);
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      p.y -= p.speed * dt; p.x += Math.sin(elapsed * .16 + p.phase) * dt * .0015;
      if (p.y < -.03) p.y = 1.03;
      if (p.x < -.03) p.x = 1.03; else if (p.x > 1.03) p.x = -.03;
      const depth = p.depth + 1, radius = [2.4, 5, 10][p.depth];
      const x = p.x * width + pointer.x * depth * 7 + Math.sin(elapsed * .3 + p.phase) * 4;
      const y = p.y * height + pointer.y * depth * 5;
      const beam = .3 + .7 * Math.max(0, 1 - Math.abs(p.x - .72) * 1.8);
      ctx.globalAlpha = p.alpha * beam * (.55 + Math.sin(elapsed * .25 + p.phase) * .4);
      ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.globalAlpha = 1;
    if (fine.matches && Math.abs(pointer.x - lastLight) > .004) {
      $('.shaft-one').style.transform = `rotate(28deg) translateX(${pointer.x * 12}px)`; lastLight = pointer.x;
    }
    director?.tick(pointer, elapsed, heroVisible, scrollY);
  }
  function startDust() {
    if (!enabled() || !inView || dialog.open || dustFrame) return;
    if (!canvas && !prepareCanvas()) return;
    document.body.removeAttribute('data-ambient-paused');
    dustFrame = requestAnimationFrame(tick);
  }
  function synchronize() {
    if (enabled() && inView && !dialog.open) startDust();
    else stopDust(motion.matches);
  }
  document.body.setAttribute('data-ambient-paused', '');

  const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      revealObserver.unobserve(entry.target); seen.add(entry.target);
      if (!enabled()) continue;
      const image = entry.target.querySelector('img');
      const draw = () => { if (entry.target.isConnected && enabled()) expose(entry.target, Number(entry.target.dataset.exposureDelay) || 0, 900); };
      if (image && !image.complete) image.decode().then(draw, () => {}); else draw();
    }
  }, { threshold: .1 }) : null;
  function observe(element, delay = 0) {
    if (!element || seen.has(element)) return;
    element.dataset.exposureDelay = delay;
    revealObserver?.observe(element);
  }
  function ready(items) {
    document.querySelectorAll('[data-sheet-index]').forEach((card, index) => {
      const item = items[index], w = item.previewWidth || item.width || 4, h = item.previewHeight || item.height || 3;
      card.style.setProperty('--photo-ratio', `${w} / ${h}`);
      card.classList.toggle('is-landscape', w > h);
      if (!card.querySelector('.focus-corners')) card.querySelector('.contact-image').insertAdjacentHTML('beforeend', '<span class="focus-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>');
      director?.enhanceCard(card); observe(card, index % 3 * 65);
    });
    document.querySelectorAll('[data-feature-index]').forEach(button => {
      const index = items.findIndex(item => item.id === button.dataset.featureId), item = items[index];
      button.dataset.featureIndex = index; button.disabled = !item?.preview;
      button.closest('figure').hidden = button.disabled;
      if (!item?.preview) return;
      const image = button.querySelector('img');
      if (image.src !== item.preview) image.src = item.preview;
      image.alt = item.title;
      button.setAttribute('aria-label', 'Open ' + item.title);
      const captions = button.closest('figure').querySelectorAll('figcaption span');
      captions[0].textContent = 'FRAME ' + String(index + 1).padStart(2, '0');
      captions[1].textContent = item.title;
    });
    observe($('.exhibition-heading')); observe($('.photo-closing'));
  }
  function advance(direction) {
    if (director) return director.advance(direction);
    const frame = $('.art-frame'); cancelWithin(frame);
    play(frame, [
      { opacity: .25, transform: `translateX(${direction > 0 ? 7 : -7}px)` },
      { opacity: 1, transform: 'none' }
    ], { duration: 560 });
    cancelWithin($('.art-notes')); expose($('.art-notes'), 70, 520);
  }
  window.PhotographyRoom = { ready, advance,
    beforeOpen: (opener, entry) => director?.beforeOpen(opener, entry),
    opened: () => { stopDust(); director?.opened(); },
    imageChanging: (entry, delta) => director?.imageChanging(entry, delta),
    requestClose: callback => director ? director.requestClose(callback) : callback(),
    get atmosphere() { return { running: !!dustFrame, count: particles.length, dpr }; } };

  const dialogObserver = new MutationObserver(synchronize);
  dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  const paperObserver = new MutationObserver(() => {
    const image = $('[data-art-paper] img');
    if (image && dialog.open && !exposed.has(image)) { exposed.add(image); if (director) director.imageReady(image); else expose(image, 0, 380); }
  });
  paperObserver.observe($('[data-art-paper]'), { childList: true });
  new MutationObserver(() => {
    if (dialog.open && !$('.art-stage').hasAttribute('aria-busy') && !$('[data-art-paper] img')) director?.imageFailed();
  }).observe($('.art-stage'), { attributes: true, attributeFilter: ['aria-busy'] });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-mode]')) {
      director?.settle();
      cancelWithin($('[data-strip]').hidden ? $('[data-strip]') : $('[data-sheet]'));
      if (!$('[data-strip]').hidden) expose($('[data-strip]'), 0, 600);
    }
  });
  document.addEventListener('pointermove', event => {
    if (!fine.matches || !enabled()) return;
    pointer.tx = event.clientX / innerWidth - .5; pointer.ty = event.clientY / innerHeight - .5;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.tx = pointer.ty = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); synchronize(); });
  motion.addEventListener('change', () => { if (motion.matches) settle(); synchronize(); });
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { settle(); if (canvas) prepareCanvas(); synchronize(); });
  }, { passive: true });
  window.addEventListener('pagehide', () => { settle(); stopDust(); cancelAnimationFrame(resizeFrame); });
  window.addEventListener('pageshow', event => { if (event.persisted) { settle(); synchronize(); } });
  if ('IntersectionObserver' in window) {
    const ambientObserver = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; synchronize(); });
    ambientObserver.observe(atmosphere);
    const heroObserver = new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; });
    heroObserver.observe($('.photo-opening'));
  }
  introFrame = requestAnimationFrame(() => director?.intro());
  synchronize();
})();
