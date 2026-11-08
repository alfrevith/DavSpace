// Gear is independent of the action/animation state. All bonuses are derived
// from base stats, never multiplied into a previously transformed value.
export const GEAR2_TUNING = Object.freeze({
  transformDuration: 2.05,
  revertDuration: .55,
  speed: 1.6,
  acceleration: 1.4,
  jumpSpeed: 1.12,
  attackSpeed: 1.5,
  damage: 1.35,
  recovery: .75
});

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const NORMAL_MULTIPLIERS = Object.freeze({speed: 1, acceleration: 1, jumpSpeed: 1, attackSpeed: 1, damage: 1, recovery: 1});

export function createGearState() {
  return { gearState: 'normal', gearTime: 0, gearQueued: false, gearSerial: 0, lastGearPressed: false };
}

export function gearLocked(state) {
  return state.gearState === 'transforming' || state.gearState === 'reverting';
}

export function requestGearToggle(state) {
  if (gearLocked(state)) return;
  state.gearQueued = !state.gearQueued;
}

export function advanceGear(state, dt, canBegin) {
  if (state.gearQueued && canBegin && !gearLocked(state)) {
    state.gearState = state.gearState === 'gear2' ? 'reverting' : 'transforming';
    state.gearTime = 0;
    state.gearQueued = false;
    state.gearSerial += 1;
  }
  if (!gearLocked(state)) return;
  state.gearTime += dt;
  const duration = state.gearState === 'transforming' ? GEAR2_TUNING.transformDuration : GEAR2_TUNING.revertDuration;
  if (state.gearTime + 1e-8 >= duration) {
    state.gearState = state.gearState === 'transforming' ? 'gear2' : 'normal';
    state.gearTime = 0;
  }
}

export function gearMultipliers(state) {
  return state.gearState === 'gear2' ? GEAR2_TUNING : NORMAL_MULTIPLIERS;
}

export function gearVisual(state) {
  const transforming = state.gearState === 'transforming';
  const progress = transforming ? clamp(state.gearTime / GEAR2_TUNING.transformDuration) : state.gearState === 'reverting' ? clamp(state.gearTime / GEAR2_TUNING.revertDuration) : 0;
  const tint = state.gearState === 'gear2' ? 1 : transforming ? smooth((progress - .2) / .5) : state.gearState === 'reverting' ? 1 - smooth(progress) : 0;
  return {
    state: state.gearState,
    progress,
    phase: transforming ? progress < .22 ? 'prepare' : progress < .76 ? 'pump' : 'release' : state.gearState,
    tint,
    steam: transforming ? .15 + .85 * smooth(progress / .75) : state.gearState === 'gear2' ? 1 : state.gearState === 'reverting' ? 1 - progress : 0,
    locked: gearLocked(state)
  };
}
