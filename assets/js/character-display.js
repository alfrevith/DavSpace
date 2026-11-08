// Rendering size never changes physics, enemy capacity, reach or field of view.
export const ARENA = Object.freeze({width: 960, height: 440, floor: 368});
export function fitArena(width, height) {
  const scale = Math.max(0, Math.min(width / ARENA.width, height / ARENA.height));
  return {width: ARENA.width * scale, height: ARENA.height * scale};
}

export function createGameDisplay(root, {onBlock, onExit, onResize, onContinue} = {}) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const shell = root.querySelector('.game-shell');
  const button = root.querySelector('[data-game-fullscreen]');
  const gate = root.querySelector('[data-game-orientation]');
  const proceed = root.querySelector('[data-game-continue]');
  const coarse = win.matchMedia('(hover: none) and (pointer: coarse)');
  let immersive = false, transitioning = false, marker, scroll, nativeSeen = false;
  const inert = new Map();
  const mobile = () => coarse.matches;
  const native = () => (doc.fullscreenElement || doc.webkitFullscreenElement) === root;
  const canPlay = () => !mobile() || immersive && win.innerWidth > win.innerHeight;

  function refresh() {
    if (immersive) root.style.setProperty('--game-view-width', `${win.innerWidth}px`);
    root.dataset.touchGame = String(mobile());
    button.setAttribute('aria-pressed', String(immersive));
    button.setAttribute('aria-label', immersive ? 'Exit fullscreen game' : 'Play in fullscreen');
    button.querySelector('span').textContent = immersive ? 'Exit' : 'Fullscreen';
    if (immersive && mobile() && !canPlay()) {
      onBlock?.();
      gate.hidden = false;
    }
    if (!gate.hidden) {
      const landscape = canPlay();
      gate.querySelector('[data-game-rotate-title]').textContent = landscape ? 'Ready to play' : 'Turn your phone';
      gate.querySelector('[data-game-rotate-copy]').textContent = landscape ? 'The arena is ready. Continue when you are.' : 'Play in landscape for the full arena and both sets of controls.';
      proceed.hidden = !landscape;
    }
    shell.inert = !gate.hidden;
    onResize?.();
  }
  function restore() {
    if (!immersive) return;
    immersive = false; nativeSeen = false;
    transitioning = false; button.disabled = false;
    root.removeAttribute('data-game-view');
    root.style.removeProperty('--game-view-width');
    gate.hidden = true;
    doc.documentElement.classList.remove('game-view-open');
    for (const [element, previous] of inert) element.inert = previous;
    inert.clear();
    if (marker?.parentNode) { marker.replaceWith(root); marker = null; }
    try { win.screen.orientation?.unlock?.(); } catch { /* Optional platform API. */ }
    onExit?.(); refresh();
    win.scrollTo({left: scroll.x, top: scroll.y, behavior: 'instant'});
  }
  async function enter() {
    if (immersive && !transitioning) { refresh(); return canPlay(); }
    if (transitioning) return false;
    transitioning = true; button.disabled = true;
    if (!immersive) {
      scroll = {x: win.scrollX, y: win.scrollY};
      marker = doc.createComment('game position');
      root.before(marker); doc.body.append(root);
      for (const child of doc.body.children) if (child !== root) { inert.set(child, child.inert); child.inert = true; }
      immersive = true;
      root.dataset.gameView = 'immersive';
      doc.documentElement.classList.add('game-view-open');
    }
    try {
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!native() && request) await request.call(root, {navigationUI: 'hide'});
      if (!immersive && native()) {
        const leave = doc.exitFullscreen || doc.webkitExitFullscreen;
        if (leave) await leave.call(doc);
        return false;
      }
      nativeSeen = native();
      if (mobile() && native() && win.screen.orientation?.lock) {
        // Some phones leave this promise pending even after manual rotation.
        // The gate observes the actual viewport; Continue must never await it.
        try {
          Promise.resolve(win.screen.orientation.lock('landscape')).then(() => {
            if (immersive && native()) refresh();
            else { try { win.screen.orientation.unlock?.(); } catch { /* Already unlocked. */ } }
          }).catch(() => {});
        } catch { /* Rotation gate handles unsupported locks. */ }
      }
    } catch { /* Viewport-filling mode also works without native fullscreen. */ }
    finally {
      transitioning = false; button.disabled = false;
      if (immersive && nativeSeen && !native()) restore();
      refresh();
    }
    return immersive && canPlay();
  }
  async function exit() {
    // Restore immediately; pending fullscreen events cannot restart the game.
    restore();
    try {
      const leave = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (native() && leave) await leave.call(doc);
    } catch { /* The browser may already have exited on Escape. */ }
  }
  function fullscreenChanged() {
    if (native()) nativeSeen = true;
    else if (immersive && nativeSeen && !transitioning) restore();
    refresh();
  }
  doc.addEventListener('fullscreenchange', fullscreenChanged);
  doc.addEventListener('webkitfullscreenchange', fullscreenChanged);
  doc.addEventListener('keydown', event => {
    if (event.code === 'Escape' && immersive && !native()) { event.preventDefault(); event.stopPropagation(); exit(); }
  }, true);
  win.addEventListener('resize', refresh);
  win.visualViewport?.addEventListener('resize', refresh);
  coarse.addEventListener('change', refresh);
  proceed.addEventListener('click', () => onContinue?.());
  root.querySelector('[data-game-leave]').addEventListener('click', exit);
  // initialize after the controller has assigned the returned display object.
  win.queueMicrotask(refresh);
  return {enter, exit, canPlay, mobile, get immersive() { return immersive; },
    dismiss() { if (canPlay()) { gate.hidden = true; shell.inert = false; } },
    block() { gate.hidden = false; refresh(); proceed.hidden ? root.querySelector('[data-game-leave]').focus() : proceed.focus(); },
    fit() {
      if (!immersive) { shell.querySelector('[data-game-stage]').style.removeProperty('width'); shell.querySelector('[data-game-stage]').style.removeProperty('height'); return; }
      const slot = shell.querySelector('.game-arena-slot'), stage = shell.querySelector('[data-game-stage]');
      const style = win.getComputedStyle(stage);
      const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
      const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      const size = fitArena(slot.clientWidth - borderX - (mobile() ? 144 : 0), slot.clientHeight - borderY);
      stage.style.width = `${size.width + borderX}px`; stage.style.height = `${size.height + borderY}px`;
    }};
}
