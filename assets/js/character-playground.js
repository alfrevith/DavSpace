import { createCharacter, resetCharacter, getPose, cancelCharacterCharge } from './character-physics.js';
import { SPRITES, SPRITE_REFERENCE } from './character-sprites.js';
import { punchExtension, drawPunch } from './character-punch.js';
import { chargeMotion, kickExtension, drawExtendedKick, KICK_DIRECTION } from './character-combat-motion.js';
import { gearLocked } from './character-gear.js';
import { createGearArt } from './character-gear-art.js';
import { createGearEffects } from './character-gear-effects.js';
import { createSurvival, stepSurvival, SURVIVAL_TUNING } from './character-survival.js';
import { ARENA, createGameDisplay } from './character-display.js';
import { movementDirection } from './character-touch.js';
import { loadGif } from './character-gif.js';
import { HAKI_TUNING, drawHakiBack, drawHakiFront } from './character-haki.js';
import { WORLD_SPRITES } from './character-world-sprites.js';
import { createWorldRenderer } from './character-world-renderer.js';
import { createAchievementLog } from './character-achievements.js';
import { createGameAudio } from './character-audio.js';

const root = document.querySelector('[data-character-playground]');
if (root) initializePlayground(root);

function initializePlayground(root) {
  const $ = selector => root.querySelector(selector);
  const stage = $('[data-game-stage]');
  const canvas = $('[data-game-canvas]');
  const overlay = $('[data-game-overlay]');
  const start = $('[data-game-start]');
  const pause = $('[data-game-pause]');
  const restart = $('[data-game-reset]');
  const help = $('[data-game-help]');
  const gearButton = $('[data-game-gear]');
  const hakiButton = $('[data-game-haki]');
  const soundButton = $('[data-game-sound]');
  const audio = createGameAudio();
  // Begin on this visit, even if the arena is never scrolled into view. Wait
  // until the page's initial resources finish, then download without playback.
  const preloadAudio = () => { audio.preload(); };
  if (document.readyState === 'complete') preloadAudio();
  else window.addEventListener('load', preloadAudio, {once: true});
  const announcement = $('[data-game-announcement]');
  const title = $('[data-game-title]');
  const summary = $('[data-game-summary]');
  const records = $('[data-game-records]');
  const healthMeter = $('[data-game-health]');
  const healthBar = $('[data-game-health-bar]');
  const chargeMeter = $('[data-game-charge]');
  const chargeBar = $('[data-game-charge-bar]');
  const timeLabel = $('[data-game-time]');
  const killLabel = $('[data-game-kills]');
  const gearTimeLabel = $('[data-game-gear-time]');
  const touchButtons = [...root.querySelectorAll('[data-game-control]')];
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    help.textContent = 'This browser cannot display the playground. The portfolio is still yours to explore.';
    start.querySelector('span').textContent = 'Canvas unavailable';
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const images = new Map();
  let hakiGif = null;
  const assets = {...SPRITES, ...WORLD_SPRITES};
  const worldRenderer = createWorldRenderer(images);
  const achievements = createAchievementLog({root});
  const keys = new Set();
  const pointers = new Map();
  const movementPointers = new Set();
  const leftButton = touchButtons.find(button => button.dataset.gameControl === 'left');
  const rightButton = touchButtons.find(button => button.dataset.gameControl === 'right');
  const particles = [];
  const worldHeight = ARENA.height;
  const floor = ARENA.floor;
  const step = 1 / 120;
  const characterHeight = 142;
  const gearArt = createGearArt(document);
  const gearEffects = createGearEffects({compact: () => worldWidth < 600, reduced: () => reduced.matches});
  const worldWidth = ARENA.width;
  let actor = createCharacter({ width: worldWidth, height: worldHeight, floor, margin: 52, x: worldWidth * .5 });
  let game = createSurvival({width: worldWidth, height: worldHeight, floor});
  let previous = { x: actor.x, y: actor.y };
  let active = false;
  let visible = false;
  let ready = false;
  let started = false;
  let loading = null;
  let frame = 0;
  let lastTime = null;
  let accumulator = 0;
  let clock = 0;
  let modeSince = 0;
  let lastMode = '';
  let lastPunchBurst = 0;
  let lastKickImpact = 0;
  let lastLanding = actor.landingSerial;
  let landedAt = -1;
  let dustTime = 0;
  let jumpPressed = false;
  let attackPressed = false;
  let gearPressed = false;
  let hakiPressed = false;
  let lastHakiUi = '';
  let lastGearUi = '';
  let lastHudUi = '';
  let damageFlash = 0;
  let audioJump = actor.jumpSerial, audioKick = -1, audioKickImpact = -1;
  let audioPunchSerial = -1;
  let audioPunchConnected = false;
  let accessibleJump = 0;
  let nudge = { axis: 0, time: 0 };
  let starting = false;
  let runRequest = 0;
  let pendingReset = false;
  const display = createGameDisplay(root, {
    onBlock() { if (active) setActive(false, 'Turn your phone to continue.'); },
    onExit() { runRequest++; starting = false; pendingReset = false; if (active || started) setActive(false); else clearInput(); },
    onResize: resize,
    onContinue: () => requestRun(false, true)
  });

  function labelStart(text) { start.querySelector('span').textContent = text; }

  function clearInput() {
    audio.cancelCharge();
    cancelCharacterCharge(actor);
    keys.clear();
    pointers.clear();
    movementPointers.clear();
    jumpPressed = attackPressed = gearPressed = hakiPressed = false;
    accessibleJump = 0;
    nudge = { axis: 0, time: 0 };
    touchButtons.forEach(button => button.removeAttribute('data-active'));
  }

  function setActive(next, reason = 'Resume or start a new run.') {
    if (next && !display.canPlay()) { display.block(); return; }
    active = next;
    clearInput();
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = null;
    accumulator = 0;
    previous = { x: actor.x, y: actor.y };
    root.dataset.gameState = next ? 'playing' : game.phase === 'over' ? 'over' : started ? 'paused' : ready ? 'ready' : 'loading';
    overlay.hidden = next;
    pause.hidden = !next;
    pause.disabled = !next;
    restart.disabled = !ready;
    touchButtons.forEach(button => { button.disabled = !next; });
    achievements.setActive(next);
    audio.setActive(next, {finishEffects: game.phase === 'over'});
    syncGearControls();
    syncHakiControls();
    if (next) {
      if (game.phase === 'ready') game.phase = 'playing';
      started = true;
      canvas.focus({ preventScroll: true });
      if (!display.immersive) $('.game-shell').scrollIntoView({ block: 'center', behavior: reduced.matches ? 'instant' : 'smooth' });
      frame = window.requestAnimationFrame(tick);
    } else {
      if (title) title.textContent = game.phase === 'over' ? 'Run ended' : started ? 'Paused' : 'Marine siege';
      $('[data-game-menu-label]').textContent = game.phase === 'over' ? 'FINAL SCORE' : started ? 'GAME PAUSED' : 'ENDLESS SURVIVAL';
      $('[data-game-menu-reset]').hidden = !started || game.phase === 'over';
      if (summary) {
        summary.hidden = !started;
        summary.textContent = `${formatTime(game.time)} survived · ${game.kills} kills`;
      }
      labelStart(game.phase === 'over' ? 'Play again' : started ? 'Resume' : 'Start run');
      help.textContent = reason;
      render(1);
    }
  }

  async function loadAssets() {
    if (ready) return true;
    if (loading) return loading;
    root.dataset.gameState = 'loading';
    root.setAttribute('aria-busy', 'true');
    start.disabled = true;
    let loaded = images.size + Number(!!hakiGif);
    const totalAssets = Object.keys(assets).length + 1;
    labelStart(`Loading game · ${loaded}/${totalAssets}`);
    loading = Promise.allSettled([...Object.entries(assets).map(async ([name, sprite]) => {
      if (images.has(name)) return;
      const image = new Image();
      image.decoding = 'async';
      image.src = new URL(sprite.src, document.baseURI).href;
      await image.decode();
      images.set(name, image);
      // Prepare reversible skin-only variants while the loading screen is up,
      // rather than interrupting the first transformation with pixel reads.
      await new Promise(resolve => window.setTimeout(resolve, 0));
      if (SPRITES[name]) gearArt.source(image, 1, null, SPRITES[name]);
      loaded += 1;
      labelStart(`Loading game · ${loaded}/${totalAssets}`);
      if (name === 'base' || name === 'waiting') render(1);
    }), (async () => {
      if (hakiGif) return;
      hakiGif = await loadGif(new URL('assets/sprites/haki.gif', document.baseURI));
      loaded++; labelStart(`Loading game · ${loaded}/${totalAssets}`);
    })()]).then(results => {
      if (results.some(result => result.status === 'rejected')) throw new Error('A sprite could not be decoded');
      ready = true;
      root.dataset.gameState = 'ready';
      labelStart('Start run');
      help.textContent = 'Defeat marines. Dodge cannon fire. Stay alive.';
      $('[data-game-menu-hero]').style.backgroundImage = `url("${images.get('base').src}")`;
      restart.disabled = false;
      if (soundButton) soundButton.disabled = false;
      syncGearControls();
      render(1);
      return true;
    }).catch(() => {
      root.dataset.gameState = 'error';
      labelStart('Try loading again');
      help.textContent = 'A game asset could not load. Try again when your connection is ready.';
      return false;
    }).finally(() => {
      root.removeAttribute('aria-busy');
      start.disabled = false;
      loading = null;
    });
    return loading;
  }

  async function requestRun(reset = false, continuing = false) {
    if (continuing && (!display.immersive || !display.canPlay())) return;
    if (starting && !continuing) return;
    starting = true;
    const request = ++runRequest;
    pendingReset ||= reset;
    try {
      audio.unlock();
      // Fullscreen must be requested during the click, before asset awaits.
      const presentation = display.mobile() && !display.immersive ? display.enter() : Promise.resolve(true);
      const loaded = await loadAssets();
      await presentation;
      if (request !== runRequest) return;
      if (!loaded || display.mobile() && !display.immersive) return;
      if (!display.canPlay()) { display.block(); return; }
      display.dismiss();
      if (pendingReset || game.phase === 'over') resetRun();
      pendingReset = false;
      if (records) records.open = false;
      visible = true;
      setActive(true);
    } finally { if (request === runRequest) starting = false; }
  }
  start.addEventListener('click', () => requestRun());
  $('[data-game-fullscreen]').addEventListener('click', async () => {
    if (display.immersive) { display.exit(); return; }
    const wasPlaying = active;
    if (active) setActive(false);
    const allowed = await display.enter();
    if (wasPlaying && allowed && !document.hidden) { visible = true; setActive(true); }
  });
  pause.addEventListener('click', () => setActive(false));
  $('[data-game-menu-reset]').addEventListener('click', () => restart.click());
  function resetRun() {
    audio.reset();
    resetCharacter(actor, { width: worldWidth, height: worldHeight, floor, margin: 52, x: worldWidth * .5 });
    game = createSurvival({width: worldWidth, height: worldHeight, floor});
    previous = { x: actor.x, y: actor.y };
    particles.length = 0;
    gearEffects.reset();
    clock = modeSince = dustTime = 0;
    lastMode = '';
    lastPunchBurst = 0;
    lastKickImpact = 0;
    lastLanding = actor.landingSerial;
    landedAt = -1;
    accumulator = 0;
    damageFlash = 0;
    audioJump = actor.jumpSerial; audioKick = audioKickImpact = -1;
    audioPunchSerial = -1;
    audioPunchConnected = false;
    lastHudUi = lastGearUi = lastHakiUi = '';
    achievements.resetRun();
    clearInput();
    syncGearControls();
  }
  restart.addEventListener('click', () => {
    if (!ready) return;
    requestRun(true);
  });
  soundButton?.addEventListener('click', () => {
    if (active) audio.unlock();
    audio.setMuted(!audio.muted);
    soundButton.setAttribute('aria-pressed', String(audio.muted));
    soundButton.setAttribute('aria-label', audio.muted ? 'Unmute game audio' : 'Mute game audio');
    root.dataset.soundMuted = String(audio.muted);
    if (active) canvas.focus({preventScroll: true});
  });
  records?.addEventListener('toggle', () => {
    if (records.open && active) setActive(false, 'Discoveries are open below.');
  });

  const moveLeft = ['KeyA', 'ArrowLeft'];
  const moveRight = ['KeyD', 'ArrowRight'];
  const jumpKeys = ['Space', 'KeyW', 'ArrowUp'];
  const attackKeys = ['KeyJ', 'KeyX'];
  const controls = [...moveLeft, ...moveRight, ...jumpKeys, ...attackKeys, 'KeyG', 'KeyK'];
  root.addEventListener('keydown', event => {
    if (!active || event.target !== canvas || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      setActive(false);
      start.focus({ preventScroll: true });
      return;
    }
    if (!controls.includes(event.code)) return;
    event.preventDefault();
    if (gearLocked(actor)) return;
    if (!event.repeat && !keys.has(event.code)) {
      if (jumpKeys.includes(event.code)) jumpPressed = true;
      if (attackKeys.includes(event.code)) attackPressed = true;
      if (event.code === 'KeyG') gearPressed = true;
      if (event.code === 'KeyK') hakiPressed = true;
    }
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => { keys.delete(event.code); });
  canvas.addEventListener('pointerdown', event => {
    if (!active || gearLocked(actor) || event.button !== 0 || event.pointerType === 'touch') return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    pointers.set(event.pointerId, 'attack');
    canvas.setPointerCapture(event.pointerId);
    attackPressed = true;
  });
  gearButton?.addEventListener('click', () => {
    if (!active || gearLocked(actor)) return;
    gearPressed = true;
    canvas.focus({preventScroll: true});
  });
  function requestHaki() {
    if (!active || hakiButton.disabled) return;
    hakiPressed = true;
    canvas.focus({preventScroll: true});
  }
  hakiButton.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); requestHaki();
  });
  hakiButton.addEventListener('click', event => {
    if (event.detail === 0) requestHaki();
  });

  function releasePointer(event) {
    movementPointers.delete(event.pointerId);
    const control = pointers.get(event.pointerId);
    if (!control) return;
    pointers.delete(event.pointerId);
    if (control === 'attack' && event.type !== 'pointerup' && ![...pointers.values()].includes('attack') && !attackKeys.some(key => keys.has(key))) cancelCharacterCharge(actor);
    syncTouchButtons();
  }
  function syncTouchButtons() {
    const held = new Set(pointers.values());
    touchButtons.forEach(button => button.toggleAttribute('data-active', held.has(button.dataset.gameControl)));
  }
  window.addEventListener('pointermove', event => {
    if (!movementPointers.has(event.pointerId)) return;
    if (!active || gearLocked(actor)) { releasePointer(event); return; }
    event.preventDefault();
    const control = movementDirection(event.clientX, event.clientY, leftButton.getBoundingClientRect(), rightButton.getBoundingClientRect());
    pointers.set(event.pointerId, control || 'movement');
    syncTouchButtons();
  }, {passive: false});
  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', releasePointer);
  touchButtons.forEach(button => {
    const control = button.dataset.gameControl;
    button.addEventListener('pointerdown', event => {
      if (!active || gearLocked(actor) || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      pointers.set(event.pointerId, control);
      if (control === 'left' || control === 'right') movementPointers.add(event.pointerId);
      button.setAttribute('data-active', '');
      button.setPointerCapture(event.pointerId);
      if (control === 'jump') jumpPressed = true;
      if (control === 'attack') attackPressed = true;
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, releasePointer));
    // Assistive technology can activate a button without generating pointer events.
    button.addEventListener('click', event => {
      if (!active || gearLocked(actor) || event.detail !== 0) return;
      if (control === 'jump') { jumpPressed = true; accessibleJump = .12; }
      if (control === 'attack') attackPressed = true;
      if (control === 'left' || control === 'right') nudge = { axis: control === 'left' ? -1 : 1, time: .16 };
    });
  });
  root.addEventListener('focusout', event => {
    if (active && !root.contains(event.relatedTarget)) setActive(false);
  });
  document.addEventListener('pointerdown', event => {
    if (active && !root.contains(event.target)) setActive(false);
  }, { passive: true });
  window.addEventListener('blur', () => { if (active) setActive(false); });
  window.addEventListener('pagehide', () => { if (active) setActive(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && active) setActive(false); });

  if (typeof IntersectionObserver === 'function') {
    const preload = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { loadAssets(); preload.disconnect(); }
    }, { rootMargin: '250px 0px' });
    preload.observe(root);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible && active) setActive(false);
    }, { threshold: 0 });
    visibility.observe(stage);
  } else {
    visible = true;
    loadAssets();
  }

  function resize() {
    display.fit();
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    previous = { x: actor.x, y: actor.y };
    render(1);
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize, { passive: true });
  reduced.addEventListener('change', () => { particles.length = 0; if (!active) render(1); });

  function tick(now) {
    frame = 0;
    if (!active || !visible || document.hidden) return;
    const elapsed = lastTime === null ? 0 : Math.min(.064, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    clock += elapsed;
    accumulator += elapsed;
    const touches = new Set(pointers.values());
    const left = moveLeft.some(key => keys.has(key)) || touches.has('left');
    const right = moveRight.some(key => keys.has(key)) || touches.has('right');
    const axis = Number(right) - Number(left) || (nudge.time > 0 ? nudge.axis : 0);
    const jumpHeld = jumpKeys.some(key => keys.has(key)) || touches.has('jump') || accessibleJump > 0;
    const attackHeld = attackKeys.some(key => keys.has(key)) || touches.has('attack');
    while (accumulator >= step) {
      previous = { x: actor.x, y: actor.y };
      const beforeGear = actor.gearState;
      if (hakiPressed) game.hakiDuration = audio.duration('haki');
      stepSurvival(game, actor, { axis, jumpPressed, jumpHeld, attackPressed, attackHeld, gearPressed, hakiPressed }, step);
      updateAudio(beforeGear);
      consumeEvents();
      jumpPressed = attackPressed = gearPressed = hakiPressed = false;
      accumulator -= step;
      if (game.phase === 'over') {
        game.haki = null; audio.cancelHaki();
        awardDiscoveries();
        achievements.hideToast();
        setActive(false, 'Play again or read your discoveries below.');
        start.focus({preventScroll: true});
        return;
      }
      if (actor.gearState !== beforeGear) {
        clearInput();
        accumulator = 0;
        previous = {x: actor.x, y: actor.y};
        syncGearControls();
        break;
      }
    }
    accessibleJump = Math.max(0, accessibleJump - elapsed);
    nudge.time = Math.max(0, nudge.time - elapsed);
    updateEffects(elapsed);
    awardDiscoveries();
    render(accumulator / step);
    frame = window.requestAnimationFrame(tick);
  }

  function consumeEvents() {
    for (const event of game.events) {
      if (event.type === 'haki' && game.phase === 'playing' && game.haki) {
        game.haki.externalClock = audio.beginHaki();
        if (announcement) announcement.textContent = 'Conqueror Haki unleashed.';
      }
      if (event.type === 'explosion') audio.play('cannon');
      if (event.type === 'shoot') audio.play('gunshot');
      if (event.type === 'spinning-sword') audio.play('spinning');
      if (event.type === 'heal' && event.source === 'pickup') audio.play('health');
      if (event.type === 'enemy-hit' && event.kind === 'punch' && !audio.impactPunch(actor.attackSerial)) audio.play('punch');
      if (event.type === 'sword-attack') audio.play('sword');
      if (event.type === 'player-hit') {
        damageFlash = .18;
        if (announcement) announcement.textContent = `Hit. ${Math.ceil(game.health)} health remaining.`;
      }
      if (event.type === 'enemy-hit' || event.type === 'kill') burst(event.x, event.y, 'strike');
      if (event.type === 'heal' && announcement) announcement.textContent = `Health restored. ${Math.ceil(game.health)} of ${game.maxHealth}.`;
      if (event.type === 'gear-ready' && announcement) announcement.textContent = 'Gear 2 charged. Press G or the G2 button to heal fully and transform.';
    }
  }

  function awardDiscoveries() {
    if (achievements.advance(game.kills, game.time).length) audio.achievement();
  }

  function updateAudio(beforeGear) {
    if (actor.jumpSerial !== audioJump) { audioJump = actor.jumpSerial; audio.play('jump'); }
    if (beforeGear !== 'transforming' && actor.gearState === 'transforming') audio.play('gear');
    const pose = getPose(actor);
    if (actor.mode === 'baseAttack') {
      if (audioPunchSerial !== actor.attackSerial) {
        audio.cancelPunch(); audioPunchSerial = actor.attackSerial;
        audioPunchConnected = false;
      }
      if (game.events.some(event => event.type === 'enemy-hit' && event.kind === 'punch' || event.type === 'projectile-block')) audioPunchConnected = true;
      if (pose.phase === 'charge' && !pose.chargeReleased && actor.chargeTime >= .16) audio.beginPunch(actor.attackSerial);
      if (pose.phase === 'strike') audio.releasePunch(actor.attackSerial);
      if (pose.phase === 'recovery') {
        audio.returnArm(actor.attackSerial, actor.recoveryDuration * .6);
        if (!audioPunchConnected) audio.shortPunchMiss(actor.attackSerial);
      }
    } else audio.cancelCharge();
    if (actor.mode !== 'jumpAttack') { audio.cancelKick(); return; }
    if (pose.phase === 'dive' && audioKick !== actor.attackSerial) {
      audioKick = actor.attackSerial; audio.beginKick();
    }
    if (audioKickImpact === actor.attackSerial) return;
    const frame = SPRITES.jumpAttack.frames[3];
    const scale = characterHeight / SPRITE_REFERENCE.height * frame.scale;
    const extra = kickExtension(pose, actor.x, actor.y, pose.facing, worldWidth, floor, frame, scale);
    const hit = game.events.some(event => event.type === 'enemy-hit' && event.kind === 'kick');
    if (hit || pose.phase === 'landing' || extra > 0 && actor.y + extra * KICK_DIRECTION.y >= floor - 1) {
      audioKickImpact = actor.attackSerial; audio.impactKick();
    }
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function syncHud() {
    const health = Math.ceil(game.health), charge = Math.floor(game.charge);
    const remaining = Math.ceil(game.gearRemaining);
    const key = `${health}:${charge}:${Math.floor(game.time)}:${game.kills}:${Math.ceil(game.gearRemaining * 10)}:${game.phase}:${actor.gearState}`;
    if (lastHudUi === key) return;
    lastHudUi = key;
    root.dataset.survivalPhase = game.phase;
    if (timeLabel) timeLabel.textContent = formatTime(game.time);
    if (killLabel) killLabel.textContent = String(game.kills);
    $('[data-game-discovery-remaining]').textContent = String(15 - game.kills % 15);
    if (healthMeter) {
      healthMeter.setAttribute('aria-valuenow', health);
      healthMeter.setAttribute('aria-valuemax', game.maxHealth);
      healthMeter.setAttribute('aria-valuetext', `${health} / ${game.maxHealth} health`);
    }
    if (healthBar) healthBar.style.transform = `scaleX(${game.health / game.maxHealth})`;
    const healthValue = $('[data-game-health-value]');
    if (healthValue) healthValue.textContent = String(health);
    $('[data-game-health-trail]').style.transform = `scaleX(${game.health / game.maxHealth})`;
    if (chargeMeter) {
      chargeMeter.setAttribute('aria-valuenow', actor.gearState === 'gear2' ? Math.ceil(game.gearRemaining / SURVIVAL_TUNING.gearDuration * 100) : charge);
      chargeMeter.setAttribute('aria-label', actor.gearState === 'gear2' ? 'Gear Second remaining' : 'Gear Second charge');
      chargeMeter.setAttribute('aria-valuetext', actor.gearState === 'gear2' ? `${remaining} seconds of Gear Second remaining` : `${charge}% charged${charge >= 100 ? '. Gear 2 ready.' : ''}`);
    }
    if (chargeBar) chargeBar.style.transform = `scaleX(${actor.gearState === 'gear2' ? game.gearRemaining / SURVIVAL_TUNING.gearDuration : game.charge / 100})`;
    root.style.setProperty('--gear-fill', `${actor.gearState === 'gear2' ? game.gearRemaining / SURVIVAL_TUNING.gearDuration * 100 : game.charge}%`);
    $('[data-game-gear-note]').textContent = actor.gearState === 'gear2' ? 'ACTIVE' : actor.gearState === 'transforming' ? 'TRANSFORMING' : actor.gearState === 'reverting' ? 'COOLING DOWN' : charge >= 100 ? 'READY' : 'Charge with kills';
    const gearReady = charge >= 100 && actor.gearState === 'normal' && !game.gearPending && game.phase === 'playing';
    root.dataset.gearPrompt = String(gearReady);
    $('[data-game-gear-note]').hidden = gearReady;
    $('[data-game-gear-prompt]').hidden = !gearReady;
    if (gearTimeLabel) gearTimeLabel.textContent = actor.gearState === 'gear2' ? `${remaining}s` : actor.gearState === 'transforming' || actor.gearState === 'reverting' ? '…' : charge >= 100 ? 'READY' : `${charge}%`;
    root.classList.toggle('game-health-low', game.health <= game.maxHealth * .3);
  }

  function burst(x, y, kind = 'land') {
    if (reduced.matches) return;
    const count = kind === 'strike' ? 6 : 10;
    for (let index = 0; index < count; index += 1) {
      const angle = kind === 'strike' ? (-.8 + index * .28) : Math.PI + index * Math.PI / (count - 1);
      const speed = kind === 'strike' ? 45 + index * 7 : 28 + index % 4 * 17;
      particles.push({ x, y, vx: Math.cos(angle) * speed * (kind === 'strike' ? actor.facing : 1), vy: Math.sin(angle) * speed, age: 0, life: .28 + index % 3 * .08, kind });
    }
    if (particles.length > 42) particles.splice(0, particles.length - 42);
  }

  function updateEffects(elapsed) {
    damageFlash = Math.max(0, damageFlash - elapsed);
    const pose = getPose(actor);
    gearEffects.update(actor, pose, elapsed);
    if (actor.mode === 'baseAttack' && pose.phase === 'strike' && pose.phaseProgress >= .45 && lastPunchBurst !== actor.attackSerial) {
      lastPunchBurst = actor.attackSerial;
      const frame = SPRITES.baseAttack.frames[3];
      const scale = characterHeight / SPRITE_REFERENCE.height * frame.scale;
      const reach = (frame.rect[2] - frame.pivot[0]) * scale + punchExtension(pose, actor.x, pose.facing, worldWidth, frame, scale);
      burst(actor.x + pose.facing * (reach - 4), actor.y - 62, 'strike');
    }
    if (actor.landingSerial !== lastLanding) {
      lastLanding = actor.landingSerial;
      landedAt = clock;
      if (actor.mode !== 'jumpAttack' || lastKickImpact !== actor.attackSerial) burst(actor.x, floor - 2);
    }
    if (actor.mode === 'jumpAttack' && pose.phase === 'dive' && lastKickImpact !== actor.attackSerial) {
      const frame = SPRITES.jumpAttack.frames[3];
      const scale = characterHeight / SPRITE_REFERENCE.height * frame.scale;
      const extra = kickExtension(pose, actor.x, actor.y, pose.facing, worldWidth, floor, frame, scale);
      if (extra > 0 && actor.y + extra * KICK_DIRECTION.y >= floor - 1) {
        lastKickImpact = actor.attackSerial;
        const footX = (frame.legStretch.tip[0] - frame.pivot[0]) * scale;
        burst(actor.x + pose.facing * (footX + extra * KICK_DIRECTION.x), floor - 2);
      }
    }
    dustTime += elapsed;
    if (actor.mode === 'running' && dustTime > .12) {
      dustTime = 0;
      if (!reduced.matches) burst(actor.x - actor.facing * 12, floor - 1, 'dust');
    }
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.age += elapsed;
      if (particle.age >= particle.life) { particles.splice(index, 1); continue; }
      particle.x += particle.vx * elapsed;
      particle.y += particle.vy * elapsed;
      particle.vy += 120 * elapsed;
    }
    if (root.dataset.characterState !== actor.mode) root.dataset.characterState = actor.mode;
    syncGearControls();
  }

  function syncGearControls() {
    const charged = game.charge >= 100;
    const key = `${actor.gearState}:${actor.gearQueued}:${active}:${ready}:${Math.floor(game.charge)}:${Math.ceil(game.gearRemaining)}`;
    if (key === lastGearUi) return;
    lastGearUi = key;
    const locked = gearLocked(actor);
    const previousGear = root.dataset.gearState;
    root.dataset.gearState = actor.gearState;
    root.dataset.gearReady = String(charged && actor.gearState === 'normal');
    touchButtons.forEach(button => { button.disabled = !active || locked; });
    if (gearButton) {
      const on = actor.gearState === 'gear2';
      gearButton.disabled = !active || !ready || locked || on || !charged;
      gearButton.setAttribute('aria-pressed', String(on));
      gearButton.classList.toggle('is-active', on);
      gearButton.setAttribute('aria-label', actor.gearQueued ? 'Gear Second queued for landing. G' : on ? `Gear Second active. ${Math.ceil(game.gearRemaining)} seconds remaining.` : charged ? 'Activate Gear Second and restore all health. G' : 'Defeat marines to charge Gear Second.');
      const text = gearButton.querySelector('[data-game-gear-label]');
      if (text) text.textContent = actor.gearQueued ? 'Queued' : locked ? '…' : on ? `${Math.ceil(game.gearRemaining)}s` : charged ? 'Ready' : `${Math.floor(game.charge)}%`;
    }
    if (announcement && previousGear && previousGear !== actor.gearState) announcement.textContent = {
      normal: 'Normal form restored.', transforming: 'Transforming into Gear Second. Controls temporarily locked.',
      gear2: `Gear Second active. Health fully restored. Increased speed and attack power for ${SURVIVAL_TUNING.gearDuration} seconds.`, reverting: 'Gear Second ended. Defeat marines to charge it again.'
    }[actor.gearState];
  }

  function syncHakiControls() {
    const remaining = Math.max(0, Math.ceil(game.nextHakiAt - game.time - 1e-8));
    const unlocked = game.time + 1e-8 >= HAKI_TUNING.unlockAt;
    const available = unlocked && !remaining && !game.haki;
    const key = `${remaining}:${active}:${ready}:${actor.gearState}:${!!game.haki}:${game.phase}`;
    if (lastHakiUi === key) return;
    lastHakiUi = key;
    root.dataset.hakiReady = String(available);
    hakiButton.disabled = !active || !ready || gearLocked(actor) || !available;
    hakiButton.querySelector('[data-game-haki-label]').textContent = available ? 'Ready' : unlocked ? `${remaining}s` : formatTime(remaining);
    hakiButton.setAttribute('aria-label', !unlocked ? `Conqueror Haki unlocks at 1:00. ${remaining} seconds remaining.` : available ? 'Unleash Conqueror Haki. K' : `Conqueror Haki recharges in ${remaining} seconds.`);
  }

  function syncHakiClock() {
    if (!game.haki) { audio.cancelHaki(); return; }
    const age = audio.hakiTime();
    if (age === null) { game.haki.externalClock = false; return; }
    game.haki.externalClock = true;
    game.haki.age = age;
    if (age >= game.haki.duration) { game.haki = null; audio.cancelHaki(); }
  }

  function selectFrame(pose) {
    if (actor.mode !== lastMode) { lastMode = actor.mode; modeSince = clock; }
    const age = clock - modeSince;
    if (actor.grounded && clock - landedAt < .09 && (actor.mode === 'waiting' || actor.mode === 'running')) return ['jumping', 4];
    switch (actor.mode) {
      case 'running': return ['running', [0, 1, 2, 1][Math.floor(actor.runTime * 11) % 4]];
      case 'jumping': return ['jumping', age < .055 ? 1 : actor.vy < 30 ? 2 : 3];
      case 'baseAttack': {
        if (pose.phase === 'charge') return ['baseAttack', pose.phaseProgress < .18 ? 0 : !pose.chargeReleased || pose.phaseProgress < .78 ? 1 : 2];
        if (pose.phase === 'strike') return ['baseAttack', 3];
        return ['baseAttack', pose.phaseProgress < .6 ? 3 : pose.phaseProgress < .82 ? 2 : 0];
      }
      case 'jumpAttack': return ['jumpAttack', pose.phase === 'charge' ? Math.min(2, Math.floor(pose.phaseProgress * 3)) : 3];
      case 'inactivity': return ['inactivity', Math.min(4, Math.floor(pose.progress * 5))];
      default: return ['waiting', [0, 1, 2, 1][Math.floor(age * 2.6) % 4]];
    }
  }

  function render(alpha = 1) {
    if (!canvas.width || !canvas.height) return;
    syncHakiClock();
    syncHakiControls();
    syncHud();
    syncGearControls();
    const unit = Math.min(canvas.width / worldWidth, canvas.height / worldHeight);
    const viewX = (canvas.width - worldWidth * unit) / 2;
    const viewY = (canvas.height - worldHeight * unit) / 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.fillStyle = '#0d1117';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const camera = gearEffects.camera();
    context.setTransform(unit, 0, 0, unit, viewX + camera.x * unit, viewY + camera.y * unit);
    const x = previous.x + (actor.x - previous.x) * alpha;
    const y = previous.y + (actor.y - previous.y) * alpha;
    drawStage();
    drawHakiBack(context, game.haki, worldWidth, worldHeight, reduced.matches, {x,y});
    worldRenderer.drawActors(context, game, {reduced: reduced.matches});
    const pose = getPose(actor);
    const altitude = Math.max(0, floor - y);
    context.fillStyle = `rgba(0,0,0,${.28 - Math.min(.16, altitude / 800)})`;
    context.beginPath();
    context.ellipse(x, floor + 3, Math.max(13, 34 - altitude * .09), 4, 0, 0, Math.PI * 2);
    context.fill();
    gearEffects.drawBack(context, ghost => {
      const frame = SPRITES.running.frames[ghost.index];
      const source = gearArt.source(images.get('running'), 1, frame.rect);
      const scale = characterHeight / SPRITE_REFERENCE.height * frame.scale;
      context.save();
      context.translate(ghost.x, ghost.y - SPRITE_REFERENCE.pelvisToFloor * characterHeight / SPRITE_REFERENCE.height);
      context.scale(ghost.facing, 1);
      context.imageSmoothingEnabled = false;
      context.drawImage(source, ...frame.rect, -frame.pivot[0] * scale, -frame.pivot[1] * scale, frame.rect[2] * scale, frame.rect[3] * scale);
      context.restore();
    });
    drawEffects(x, y, pose);
    if (pose.gear.locked && ready) {
      context.save();
      context.translate(Math.round(x), Math.round(y));
      context.scale(pose.facing, 1);
      gearArt.drawTransformation(context, images, pose.gear, reduced.matches);
      context.restore();
      gearEffects.drawFront(context);
      worldRenderer.drawForeground(context, game, {reduced: reduced.matches});
      drawHakiFront(context, game.haki, hakiGif, {x,y}, reduced.matches, worldWidth, worldHeight);
      return;
    }
    let [animation, index] = selectFrame(pose);
    if (!images.has(animation)) { animation = images.has('waiting') ? 'waiting' : 'base'; index = 0; }
    const sprite = SPRITES[animation];
    const original = images.get(animation);
    const frame = sprite?.frames[index] || sprite?.frames[0];
    if (!original || !frame) return;
    const source = gearArt.source(original, pose.gear.tint, frame.rect);
    const scale = characterHeight / SPRITE_REFERENCE.height * frame.scale;
    const [sx, sy, sw, sh] = frame.rect;
    const [px, py] = frame.pivot;
    const pelvisY = y - SPRITE_REFERENCE.pelvisToFloor * characterHeight / SPRITE_REFERENCE.height;
    context.save();
    if (game.invulnerable > 0 && game.phase === 'playing') context.globalAlpha = Math.floor(clock * 14) % 2 ? .58 : 1;
    context.translate(x, pelvisY);
    context.scale(pose.facing, 1);
    if (actor.mode === 'baseAttack' && pose.phase === 'charge') {
      const motion = chargeMotion(pose.chargeStrength, pose.frameTime, reduced.matches);
      const pivot = SPRITE_REFERENCE.pelvisToFloor * characterHeight / SPRITE_REFERENCE.height;
      context.translate(motion.pivotX, pivot);
      context.rotate(motion.angle);
      context.translate(-motion.pivotX, -pivot);
    }
    context.imageSmoothingEnabled = false;
    const legExtra = animation === 'jumpAttack' && index === 3 ? kickExtension(pose, x, y, pose.facing, worldWidth, floor, frame, scale) : 0;
    if (frame.airClip && actor.mode === 'jumpAttack' && !actor.grounded && legExtra <= .01) {
      context.beginPath();
      frame.airClip.forEach(([cx, cy], point) => {
        const dx = (cx - px) * scale, dy = (cy - py) * scale;
        if (!point) context.moveTo(dx, dy); else context.lineTo(dx, dy);
      });
      context.closePath();
      context.clip();
    }
    if (animation === 'baseAttack' && index === 3) {
      drawPunch(context, source, frame, scale, punchExtension(pose, x, pose.facing, worldWidth, frame, scale));
    } else if (animation === 'jumpAttack' && index === 3 && legExtra > .01) {
      drawExtendedKick(context, source, frame, scale, legExtra);
    } else {
      context.drawImage(source, sx, sy, sw, sh, -px * scale, -py * scale, sw * scale, sh * scale);
    }
    context.restore();
    gearEffects.drawFront(context);
    worldRenderer.drawForeground(context, game, {reduced: reduced.matches});
    drawHakiFront(context, game.haki, hakiGif, {x,y}, reduced.matches, worldWidth, worldHeight);
    if (damageFlash > 0) {
      context.save();
      context.globalAlpha = damageFlash * 1.3;
      context.strokeStyle = '#ff6575';
      context.lineWidth = 6;
      context.strokeRect(3, 3, worldWidth - 6, worldHeight - 6);
      context.restore();
    }
  }

  function drawStage() {
    if (images.has('scenery')) {
      worldRenderer.drawBackground(context, worldWidth, worldHeight, floor);
      return;
    }
    context.fillStyle = '#0d1117';
    context.fillRect(0, 0, worldWidth, worldHeight);
    const glow = context.createRadialGradient(worldWidth * .5, 220, 20, worldWidth * .5, 250, Math.max(300, worldWidth * .6));
    glow.addColorStop(0, '#1b2027');
    glow.addColorStop(1, '#0d1117');
    context.fillStyle = glow;
    context.fillRect(0, 0, worldWidth, floor);
    context.strokeStyle = '#ffffff09';
    context.lineWidth = .7;
    context.beginPath();
    context.arc(worldWidth * .76, floor + 16, 215, Math.PI, Math.PI * 1.96);
    context.arc(worldWidth * .76, floor + 16, 227, Math.PI * 1.05, Math.PI * 1.86);
    context.stroke();
    for (let index = 0; index < 22; index += 1) {
      const x = (index * 197.3 + 37) % worldWidth;
      const y = 83 + index * 63.7 % 225;
      context.fillStyle = index % 4 ? '#ffffff24' : '#e8c17e46';
      context.fillRect(x, y, index % 4 ? 1 : 1.5, 1);
    }
    const ground = context.createLinearGradient(0, floor, 0, worldHeight);
    ground.addColorStop(0, '#181a1d');
    ground.addColorStop(1, '#0c1016');
    context.fillStyle = ground;
    context.fillRect(0, floor, worldWidth, worldHeight - floor);
    const edge = context.createLinearGradient(0, 0, worldWidth, 0);
    edge.addColorStop(0, '#e8c17e10');
    edge.addColorStop(.5, '#e8c17e80');
    edge.addColorStop(1, '#e8c17e10');
    context.strokeStyle = edge;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, floor + .5);
    context.lineTo(worldWidth, floor + .5);
    context.stroke();
    context.strokeStyle = '#ffffff0b';
    for (let x = 28; x < worldWidth; x += 48) {
      context.beginPath();
      context.moveTo(x, floor + 13);
      context.lineTo(x, floor + 18);
      context.stroke();
    }
    context.fillStyle = '#ffffff38';
    context.font = '8px Consolas, monospace';
    context.fillText('FREE PLAY', 23, worldHeight - 22);
    context.textAlign = 'right';
    context.fillStyle = '#e8c17e65';
    context.fillText('MOVE / JUMP / ATTACK', worldWidth - 23, worldHeight - 22);
    context.textAlign = 'left';
  }

  function drawEffects(x, y, pose) {
    context.save();
    if (actor.mode === 'baseAttack' && pose.phase === 'charge') {
      const strength = pose.chargeStrength;
      context.fillStyle = '#ffffff25';
      context.fillRect(x - 27, y - 160, 54, 3);
      context.fillStyle = strength >= .99 ? '#fff0cc' : '#e8c17e';
      context.fillRect(x - 27, y - 160, 54 * strength, 3);
      context.font = '8px Consolas, monospace';
      context.textAlign = 'center';
      context.fillText(strength >= .99 ? 'MAX' : 'CHARGE', x, y - 168);
    }
    if (reduced.matches) { context.restore(); return; }
    if ((actor.mode === 'baseAttack' || actor.mode === 'jumpAttack') && pose.phase === 'charge') {
      const progress = actor.mode === 'baseAttack' ? pose.chargeStrength : pose.phaseProgress;
      let handX = x + actor.facing * 14, handY = y - 65;
      if (actor.mode === 'baseAttack') {
        const frame = SPRITES.baseAttack.frames[1];
        const scale = characterHeight / SPRITE_REFERENCE.height * frame.scale;
        const feet = SPRITE_REFERENCE.pelvisToFloor * characterHeight / SPRITE_REFERENCE.height;
        const motion = chargeMotion(progress, pose.frameTime, reduced.matches);
        const localX = (85 - frame.pivot[0]) * scale - motion.pivotX;
        const localY = (325 - frame.pivot[1]) * scale - feet;
        handX = x + pose.facing * (motion.pivotX + localX * Math.cos(motion.angle) - localY * Math.sin(motion.angle));
        handY = y + localX * Math.sin(motion.angle) + localY * Math.cos(motion.angle);
      }
      const spin = pose.frameTime * 3.2;
      context.strokeStyle = `rgba(239,220,177,${.1 + progress * .4})`;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(handX, handY, 15 - progress * 5, -.8 + spin, 3.5 + spin);
      context.stroke();
      if (actor.mode === 'baseAttack') {
        for (let index = 0; index < 6; index += 1) {
          const flow = (pose.frameTime * .85 + index / 6) % 1;
          const angle = index * Math.PI / 3 + spin * .3;
          const radius = 31 - flow * 22;
          context.globalAlpha = Math.sin(flow * Math.PI) * (.15 + progress * .55);
          context.strokeStyle = '#f3ddb5';
          context.beginPath();
          context.moveTo(handX + Math.cos(angle) * radius, handY + Math.sin(angle) * radius);
          context.lineTo(handX + Math.cos(angle) * (radius + 3 + progress * 3), handY + Math.sin(angle) * (radius + 3 + progress * 3));
          context.stroke();
        }
        context.globalAlpha = 1;
      }
    }
    for (const particle of particles) {
      context.globalAlpha = (1 - particle.age / particle.life) * (particle.kind === 'dust' ? .2 : .65);
      context.fillStyle = particle.kind === 'strike' ? '#f5e1b8' : '#c9c3b8';
      const size = particle.kind === 'dust' ? 2 : 1.5;
      context.fillRect(Math.round(particle.x), Math.round(particle.y), Math.round(size), Math.round(size));
    }
    context.restore();
  }

  resize();
}
