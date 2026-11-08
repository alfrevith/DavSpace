// Pure, deterministic character simulation. Coordinates describe the center of
// the feet; +Y points down. The renderer owns sprites, input and the clock.
import { createGearState, advanceGear, requestGearToggle, gearLocked, gearMultipliers, gearVisual } from './character-gear.js';
export const CHARACTER_TUNING = Object.freeze({
  speed: 260,
  acceleration: 1900,
  airAcceleration: 1100,
  braking: 2300,
  jumpSpeed: 650,
  heldJumpGravity: .74,
  jumpRelease: .48,
  gravity: 1680,
  fallGravity: 1920,
  terminalSpeed: 1100,
  jumpBuffer: .13,
  coyoteTime: .10,
  idleDelay: 8,
  groundCharge: .075,
  groundMaxCharge: 1.3,
  groundStrike: .10,
  groundRecovery: .13,
  attackBuffer: .12,
  airCharge: .18,
  airLanding: .22,
  diveSpeed: 850
});

const T = CHARACTER_TUNING;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

function dimensions(options = {}) {
  const width = Math.max(160, finite(options.width, 960));
  const height = Math.max(180, finite(options.height, 440));
  return {
    width,
    height,
    floor: clamp(finite(options.floor, height - 66), 120, height - 8),
    margin: clamp(finite(options.margin, 80), 20, width / 3)
  };
}

export function createCharacter(options = {}) {
  const bounds = dimensions(options);
  return {
    ...bounds,
    ...createGearState(),
    x: clamp(finite(options.x, bounds.width * .5), bounds.margin, bounds.width - bounds.margin),
    y: bounds.floor,
    previousX: clamp(finite(options.x, bounds.width * .5), bounds.margin, bounds.width - bounds.margin),
    previousY: bounds.floor,
    vx: 0,
    vy: 0,
    facing: options.facing === -1 ? -1 : 1,
    grounded: true,
    mode: "waiting",
    modeTime: 0,
    runTime: 0,
    idleTime: 0,
    jumpTime: 0,
    jumpPeak: 1,
    jumpBuffer: 0,
    coyoteTime: T.coyoteTime,
    jumpCut: false,
    airAttackUsed: false,
    actionTime: 0,
    actionDuration: 0,
    actionPhase: "none",
    phaseTime: 0,
    actionFacing: 1,
    attackCooldown: 0,
    attackBuffer: 0,
    chargeTime: 0,
    chargeReleased: false,
    punchPower: 0,
    strikeDuration: T.groundStrike,
    recoveryDuration: T.groundRecovery,
    attackSerial: 0,
    landingSerial: 0,
    jumpSerial: 0,
    landImpact: 0,
    lastJumpPressed: false,
    lastAttackPressed: false,
    hitboxes: [],
    hitTargets: new Set(),
    hitAttackSerial: -1
  };
}

export function getCharacterStats(state) {
  const boost = gearMultipliers(state);
  return {
    speed: T.speed * boost.speed,
    acceleration: T.acceleration * boost.acceleration,
    airAcceleration: T.airAcceleration * boost.acceleration,
    braking: T.braking * boost.acceleration,
    jumpSpeed: T.jumpSpeed * boost.jumpSpeed,
    attackSpeed: boost.attackSpeed,
    damage: boost.damage,
    recovery: boost.recovery,
    diveSpeed: T.diveSpeed * boost.attackSpeed
  };
}

export function resetCharacter(state, options = {}) {
  const next = createCharacter({width: state.width, height: state.height, floor: state.floor, margin: state.margin, ...options});
  Object.assign(state, next);
  return state;
}

export function resizeCharacter(state, options = {}) {
  const oldWidth = state.width;
  const altitude = state.floor - state.y;
  const bounds = dimensions({width: state.width, height: state.height, floor: state.floor, margin: state.margin, ...options});
  Object.assign(state, bounds);
  state.x = clamp(state.x / oldWidth * bounds.width, bounds.margin, bounds.width - bounds.margin);
  state.y = state.grounded ? bounds.floor : clamp(bounds.floor - altitude, Math.min(122, bounds.floor), bounds.floor);
  state.previousX = state.x;
  state.previousY = state.y;
  return state;
}

function mode(state, next) {
  if (state.mode !== next) {
    state.mode = next;
    state.modeTime = 0;
  }
}

function jump(state) {
  state.grounded = false;
  state.vy = -getCharacterStats(state).jumpSpeed;
  state.jumpBuffer = 0;
  state.coyoteTime = 0;
  state.jumpTime = 0;
  state.jumpPeak = 1;
  state.jumpCut = false;
  state.idleTime = 0;
  state.airAttackUsed = false;
  state.jumpSerial += 1;
  mode(state, "jumping");
}

function startAttack(state) {
  state.idleTime = 0;
  state.actionTime = 0;
  state.phaseTime = 0;
  state.actionFacing = state.facing;
  state.attackSerial += 1;
  if (state.grounded) {
    state.chargeTime = state.punchPower = 0;
    state.chargeReleased = false;
    state.strikeDuration = T.groundStrike;
    state.recoveryDuration = T.groundRecovery;
    state.actionDuration = T.groundCharge + state.strikeDuration + state.recoveryDuration;
    state.actionPhase = "charge";
    mode(state, "baseAttack");
  } else {
    state.airAttackUsed = true;
    state.actionDuration = .8; // Nominal only; the dive ends on the actual floor.
    state.actionPhase = "charge";
    state.vy = clamp(state.vy, -90, 55);
    state.vx *= .7;
    mode(state, "jumpAttack");
  }
}

function finishAttack(state) {
  state.actionPhase = "none";
  state.phaseTime = 0;
  state.actionTime = 0;
  state.actionDuration = 0;
  state.attackCooldown = .05 * getCharacterStats(state).recovery;
  mode(state, state.grounded ? "waiting" : "jumping");
}

// A canceled pointer or a paused game must never release a stored punch later.
export function cancelCharacterCharge(state) {
  state.attackBuffer = 0;
  state.lastAttackPressed = false;
  if (state.mode !== 'baseAttack' || state.actionPhase !== 'charge') return;
  state.chargeTime = state.punchPower = 0;
  state.chargeReleased = false;
  finishAttack(state);
}

function activeAttack(state) {
  return state.mode === "baseAttack" || state.mode === "jumpAttack";
}

function integrate(state, input, dt, attackRequested) {
  const wasLocked = gearLocked(state);
  advanceGear(state, dt, state.grounded && (!activeAttack(state) || state.mode === 'baseAttack' && state.actionPhase === 'charge'));
  if (wasLocked || gearLocked(state)) {
    state.vx = state.vy = 0;
    state.y = state.floor;
    state.grounded = true;
    state.actionPhase = 'none';
    state.actionTime = state.phaseTime = state.actionDuration = state.jumpBuffer = state.attackBuffer = state.attackCooldown = state.idleTime = state.punchPower = 0;
    mode(state, gearLocked(state) ? 'transforming' : 'waiting');
    return;
  }
  const stats = getCharacterStats(state);
  const axis = clamp(finite(input.axis, (input.right ? 1 : 0) - (input.left ? 1 : 0)), -1, 1);
  state.modeTime += dt;
  state.attackCooldown = Math.max(0, state.attackCooldown - dt);
  state.attackBuffer = Math.max(0, state.attackBuffer - dt);
  state.jumpBuffer = Math.max(0, state.jumpBuffer - dt);
  state.coyoteTime = state.grounded ? T.coyoteTime : Math.max(0, state.coyoteTime - dt);
  state.landImpact = Math.max(0, state.landImpact - dt * 3.4);

  if (!activeAttack(state)) {
    if (axis) state.facing = axis < 0 ? -1 : 1;
    if (state.jumpBuffer > 0 && state.coyoteTime > 0) jump(state);
    if ((attackRequested || state.attackBuffer > 0) && state.attackCooldown === 0 && (state.grounded || !state.airAttackUsed)) {
      state.attackBuffer = 0;
      startAttack(state);
    }
  }

  let gravity = state.vy < 0 ? T.gravity : T.fallGravity;
  if (state.mode === "baseAttack") {
    state.actionTime += dt;
    state.phaseTime += dt;
    if (state.actionPhase === 'charge') {
      if (!input.attackHeld) state.chargeReleased = true;
      if (!state.chargeReleased) state.chargeTime = Math.min(T.groundMaxCharge, state.chargeTime + dt * stats.attackSpeed);
      if (T.groundMaxCharge - state.chargeTime < 1e-8) state.chargeTime = T.groundMaxCharge;
      state.punchPower = state.chargeTime / T.groundMaxCharge;
      state.vx = approach(state.vx, 0, stats.braking * dt);
      if (state.chargeReleased && state.phaseTime + 1e-8 >= T.groundCharge / stats.attackSpeed) {
        state.strikeDuration = (T.groundStrike + .06 * state.chargeTime) / stats.attackSpeed;
        state.recoveryDuration = (T.groundRecovery + .11 * state.chargeTime) * stats.recovery;
        state.actionDuration = state.actionTime + state.strikeDuration + state.recoveryDuration;
        state.actionPhase = 'strike';
        state.phaseTime = 0;
        state.vx = state.actionFacing * (140 + 140 * state.chargeTime) * stats.attackSpeed;
      }
    } else if (state.actionPhase === 'strike') {
      state.vx = approach(state.vx, 0, 620 * stats.attackSpeed * dt);
      if (state.phaseTime + 1e-8 >= state.strikeDuration) {
        state.actionPhase = 'recovery';
        state.phaseTime = 0;
      }
    } else {
      state.vx = approach(state.vx, 0, stats.braking * dt);
      if (state.phaseTime + 1e-8 >= state.recoveryDuration) finishAttack(state);
    }
  } else if (state.mode === "jumpAttack") {
    state.actionTime += dt;
    state.phaseTime += dt;
    if (state.actionPhase === "charge") {
      gravity = 140;
      state.vx = approach(state.vx, 0, 320 * dt);
      if (state.phaseTime >= T.airCharge / stats.attackSpeed) {
        state.actionPhase = "dive";
        state.phaseTime = 0;
        state.vy = stats.diveSpeed;
        state.vx = state.actionFacing * Math.min(80, Math.max(25, Math.abs(state.vx))) * stats.attackSpeed;
      }
    } else if (state.actionPhase === "dive") {
      state.vx = approach(state.vx, axis * 85 * stats.attackSpeed, 300 * stats.attackSpeed * dt);
      state.vy = Math.max(stats.diveSpeed, state.vy);
    } else if (state.actionPhase === "landing") {
      state.vx = approach(state.vx, 0, stats.braking * dt);
      if (state.phaseTime >= T.airLanding * stats.recovery) finishAttack(state);
    }
  } else {
    const acceleration = state.grounded ? stats.acceleration : stats.airAcceleration;
    const rate = axis ? acceleration : state.grounded ? stats.braking : 450 * gearMultipliers(state).acceleration;
    state.vx = approach(state.vx, axis * stats.speed, rate * dt);
    if (state.grounded) state.airAttackUsed = false;
  }

  if (!state.grounded) {
    state.jumpTime += dt;
    if (state.mode !== "jumpAttack" && state.vy < 0 && !input.jumpHeld && !state.jumpCut) {
      state.vy *= T.jumpRelease;
      state.jumpCut = true;
    }
    // Holding sustains the ascent; releasing commits to the shorter arc.
    // Pressing again in midair cannot restore lift or create another jump.
    if (state.mode !== 'jumpAttack' && state.vy < 0 && input.jumpHeld && !state.jumpCut) gravity *= T.heldJumpGravity;
    const terminal = state.mode === 'jumpAttack' && state.actionPhase === 'dive' ? T.terminalSpeed * stats.attackSpeed : T.terminalSpeed;
    state.vy = Math.min(terminal, state.vy + gravity * dt);
  } else {
    state.vy = 0;
  }

  state.x += state.vx * dt;
  state.y += state.vy * dt;
  if (state.x < state.margin || state.x > state.width - state.margin) {
    state.x = clamp(state.x, state.margin, state.width - state.margin);
    state.vx = 0;
  }
  const ceiling = Math.min(122, state.floor);
  if (state.y < ceiling) {
    state.y = ceiling;
    state.vy = Math.max(0, state.vy);
  }
  state.jumpPeak = Math.max(state.jumpPeak, state.floor - state.y);
  if (state.y >= state.floor) {
    const landed = !state.grounded;
    if (landed) {
      state.landingSerial += 1;
      state.landImpact = state.mode === "jumpAttack" ? 1 : clamp(state.vy / 1200, .15, .45);
    }
    state.y = state.floor;
    state.vy = 0;
    state.grounded = true;
    if (landed && state.mode === "jumpAttack") {
      // A kick pressed inches above the floor lands safely even during charge.
      state.actionPhase = "landing";
      state.phaseTime = 0;
    }
    if (!activeAttack(state) && state.jumpBuffer > 0) jump(state);
  }

  if (!activeAttack(state)) {
    const moving = Math.abs(state.vx) > 5 || !!axis;
    state.idleTime = state.grounded && !moving ? state.idleTime + dt : 0;
    if (!state.grounded) mode(state, "jumping");
    else if (moving) mode(state, "running");
    else mode(state, state.idleTime >= T.idleDelay ? "inactivity" : "waiting");
    state.runTime += Math.abs(state.vx) / T.speed * dt;
  }
}

// The caller may use a fixed timestep; subdivision also keeps 30/60/120 Hz
// consumers equivalent. A stale wall-clock delta cannot teleport the actor.
export function stepCharacter(state, input = {}, dt = 1 / 60) {
  if (!Number.isFinite(dt) || dt <= 0) return state;
  input ||= {};
  state.previousX = state.x;
  state.previousY = state.y;
  const jumpPressed = !!input.jumpPressed && !state.lastJumpPressed;
  const attackPressed = !!input.attackPressed && !state.lastAttackPressed;
  const gearPressed = !!input.gearPressed && !state.lastGearPressed;
  state.lastGearPressed = !!input.gearPressed;
  if (gearPressed) requestGearToggle(state);
  state.lastJumpPressed = !!input.jumpPressed;
  state.lastAttackPressed = !!input.attackPressed;
  if (jumpPressed) state.jumpBuffer = T.jumpBuffer;
  if (attackPressed) state.attackBuffer = T.attackBuffer;
  if (jumpPressed || attackPressed) state.idleTime = 0;
  const elapsed = Math.min(dt, .1);
  const steps = Math.ceil(elapsed / (1 / 120) - 1e-8);
  const step = elapsed / steps;
  const heldInput = {...input, jumpHeld: input.jumpHeld ?? !!input.jumpPressed};
  for (let index = 0; index < steps; index += 1) integrate(state, heldInput, step, index === 0 && attackPressed);
  return state;
}

export function getPose(state) {
  const stats = getCharacterStats(state);
  const gear = gearVisual(state);
  let progress = 0;
  let phase = state.actionPhase;
  let phaseProgress = 0;
  let attackStrength = 0;
  if (state.mode === "baseAttack") {
    progress = clamp(state.actionTime / Math.max(state.actionDuration, state.actionTime), 0, 1);
    const duration = phase === "charge" ? T.groundCharge / stats.attackSpeed : phase === "strike" ? state.strikeDuration : state.recoveryDuration;
    phaseProgress = clamp(state.phaseTime / duration, 0, 1);
    attackStrength = phase === 'charge' ? state.punchPower : (.25 + .75 * state.punchPower) * (phase === 'strike' ? 1 : 1 - phaseProgress);
  } else if (state.mode === "jumpAttack") {
    const duration = phase === "charge" ? T.airCharge / stats.attackSpeed : phase === "landing" ? T.airLanding * stats.recovery : .22 / stats.attackSpeed;
    phaseProgress = clamp(state.phaseTime / duration, 0, 1);
    progress = phase === "charge" ? phaseProgress * .3 : phase === "dive" ? .3 + .46 * phaseProgress : .76 + .24 * phaseProgress;
    attackStrength = phase === "charge" ? phaseProgress : phase === "dive" ? 1 : 1 - phaseProgress;
  } else if (!state.grounded) {
    phase = state.vy < -70 ? "rise" : state.vy > 70 ? "fall" : "apex";
    progress = state.vy < 0 ? .5 * (1 + state.vy / stats.jumpSpeed) : .5 + .5 * (1 - (state.floor - state.y) / Math.max(1, state.jumpPeak));
    progress = clamp(progress, 0, 1);
    phaseProgress = progress < .5 ? progress * 2 : (progress - .5) * 2;
  } else {
    phase = "none";
    progress = (state.mode === "running" ? state.runTime / .64 : state.modeTime / (state.mode === "inactivity" ? 2.4 : 1.6)) % 1;
    phaseProgress = progress;
  }
  return {
    animation: state.mode,
    gear,
    gearState: state.gearState,
    progress,
    phase,
    phaseProgress,
    frameTime: state.modeTime,
    facing: activeAttack(state) ? state.actionFacing : state.facing,
    grounded: state.grounded,
    attackStrength,
    chargeStrength: state.mode === 'baseAttack' ? state.punchPower : 0,
    chargeReleased: state.chargeReleased,
    attackDamage: state.mode === 'baseAttack' && phase === 'strike' ? Math.round(12 + 36 * state.chargeTime) * stats.damage : state.mode === 'jumpAttack' && phase === 'dive' ? 30 * stats.damage : 0,
    attackActive: state.mode === "baseAttack" && phase === "strike" || state.mode === "jumpAttack" && phase === "dive",
    landImpact: state.landImpact
  };
}
