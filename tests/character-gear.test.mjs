import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter, stepCharacter, getPose, getCharacterStats, resetCharacter} from '../assets/js/character-physics.js';
import {GEAR2_TUNING, gearVisual} from '../assets/js/character-gear.js';
import {getAttackHitboxes, attackIntersectsRect, resolveAttackHits} from '../assets/js/character-combat.js';
import {createGearEffects} from '../assets/js/character-gear-effects.js';

const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const advance = (state, seconds, input = {}, rate = 120) => {
  for (let tick = 0; tick < Math.round(seconds * rate); tick++) stepCharacter(state, input, 1 / rate);
};
const pressG = state => { stepCharacter(state, {}); stepCharacter(state, {gearPressed: true}); };
const transformed = () => {
  const state = createCharacter({width: 1400, x: 450, floor: 368});
  pressG(state); advance(state, GEAR2_TUNING.transformDuration + .02); return state;
};

test('Gear Second uses a bounded cinematic, locks actions and activates once per press', () => {
  const state = createCharacter();
  const x = state.x;
  stepCharacter(state, {gearPressed: true});
  assert.equal(state.gearState, 'transforming');
  advance(state, 1.5, {gearPressed: true, axis: 1, jumpPressed: true, attackPressed: true, attackHeld: true});
  assert.equal(state.gearState, 'transforming');
  assert.equal(state.x, x); assert.equal(state.y, state.floor);
  assert.equal(state.attackSerial, 0); assert.equal(state.jumpSerial, 0);
  assert.equal(getAttackHitboxes(state, getPose(state)).length, 0);
  advance(state, .6, {gearPressed: true});
  assert.equal(state.gearState, 'gear2');
  advance(state, 2, {gearPressed: true});
  assert.equal(state.gearSerial, 1, 'holding G cannot toggle or stack transformations');
});

test('real movement/attack bonuses are exact and repeated toggles restore the base stats', () => {
  const state = transformed();
  const baseline = getCharacterStats(createCharacter());
  const expected = {speed: 1.6, acceleration: 1.4, airAcceleration: 1.4, braking: 1.4, jumpSpeed: 1.12, attackSpeed: 1.5, damage: 1.35, recovery: .75, diveSpeed: 1.5};
  for (let round = 0; round < 5; round++) {
    for (const [key, ratio] of Object.entries(expected)) near(getCharacterStats(state)[key], baseline[key] * ratio);
    advance(state, .4, {axis: 1}); near(state.vx, baseline.speed * 1.6);
    pressG(state); assert.equal(state.gearState, 'reverting');
    advance(state, .6); assert.equal(state.gearState, 'normal');
    assert.deepEqual(getCharacterStats(state), baseline);
    pressG(state); advance(state, 2.1); assert.equal(state.gearState, 'gear2');
  }
  resetCharacter(state);
  assert.equal(state.gearState, 'normal'); assert.equal(state.gearQueued, false);
  assert.deepEqual(getCharacterStats(state), baseline);
});

test('toggle requested in midair waits for a safe landing and can be canceled', () => {
  const state = createCharacter();
  stepCharacter(state, {jumpPressed: true, jumpHeld: true});
  advance(state, .1, {jumpHeld: true});
  const y = state.y;
  pressG(state);
  assert.equal(state.gearState, 'normal'); assert(state.gearQueued); assert(state.y <= y + 3);
  pressG(state); assert.equal(state.gearQueued, false);
  pressG(state); assert(state.gearQueued);
  advance(state, .9);
  assert.equal(state.gearState, 'transforming'); assert.equal(state.y, state.floor);
});

test('active attacks finish with their original stats before a queued form change', () => {
  const state = transformed();
  stepCharacter(state, {attackPressed: true});
  advance(state, .06);
  assert.equal(getPose(state).phase, 'strike');
  const damage = getPose(state).attackDamage;
  pressG(state);
  assert.equal(state.gearState, 'gear2'); assert(state.gearQueued);
  assert.equal(getPose(state).attackDamage, damage);
  advance(state, .5); assert.equal(state.gearState, 'reverting');
});

test('attack windows speed up 50%, recovery drops 25% and damage rises 35%', () => {
  function attack(state) {
    stepCharacter(state, {attackPressed: true, attackHeld: true}, 1 / 120);
    advance(state, 1.4, {attackHeld: true});
    stepCharacter(state, {attackHeld: false}, 1 / 120);
    assert.equal(getPose(state).phase, 'strike');
    return {strike: state.strikeDuration, recovery: state.recoveryDuration, damage: getPose(state).attackDamage};
  }
  const normal = attack(createCharacter()), gear = attack(transformed());
  near(gear.strike, normal.strike / 1.5);
  near(gear.recovery, normal.recovery * .75);
  near(gear.damage, normal.damage * 1.35);
});

test('faster air attacks still hit the floor safely with boosted damage and hitboxes', () => {
  for (const rate of [30, 60, 120]) {
    const state = transformed();
    stepCharacter(state, {jumpPressed: true, jumpHeld: true}, 1 / rate);
    advance(state, .16, {jumpHeld: true}, rate);
    stepCharacter(state, {attackPressed: true}, 1 / rate);
    let hit = false;
    for (let tick = 0; tick < rate; tick++) {
      stepCharacter(state, {}, 1 / rate);
      const pose = getPose(state), boxes = getAttackHitboxes(state, pose);
      assert(state.y <= state.floor);
      if (pose.phase === 'dive') {
        hit = true; assert(state.vy >= 1275); near(pose.attackDamage, 40.5);
        assert.equal(boxes.length, 1);
        const end = boxes[0].end;
        assert(attackIntersectsRect(boxes[0], {x: end.x - 1, y: end.y - 1, width: 2, height: 2}));
      } else assert.equal(boxes.length, 0);
    }
    assert(hit); assert.equal(state.mode, 'waiting'); assert.equal(state.y, state.floor);
  }
});

test('punch hitboxes follow elastic reach, exclude charge/recovery and sweep fast movement', () => {
  const state = transformed();
  stepCharacter(state, {attackPressed: true, attackHeld: true});
  assert.equal(getAttackHitboxes(state, getPose(state)).length, 0);
  advance(state, 1, {attackHeld: true}); stepCharacter(state, {});
  advance(state, .05);
  const boxes = getAttackHitboxes(state, getPose(state)); assert.equal(boxes.length, 1);
  assert(boxes[0].end.x - boxes[0].start.x > 250);
  assert(!attackIntersectsRect(boxes[0], {x: state.x - 200, y: state.y - 64, width: 5, height: 5}));
  const swept = {...boxes[0], start: {x: 0, y: 0}, end: {x: 50, y: 0}, previousStart: {x: 0, y: 50}, previousEnd: {x: 50, y: 50}};
  assert(attackIntersectsRect(swept, {x: 20, y: 24, width: 1, height: 1}));
  advance(state, .13); assert.equal(getAttackHitboxes(state, getPose(state)).length, 0);
});

test('skin and steam envelopes reverse smoothly and end exactly at normal', () => {
  const state = createCharacter(); pressG(state);
  let previous = 0;
  for (let tick = 0; tick < 250; tick++) {
    stepCharacter(state, {}); const visual = gearVisual(state);
    assert(visual.tint >= previous - 1e-8 && visual.tint >= 0 && visual.tint <= 1);
    previous = visual.tint;
    if (state.gearState === 'gear2') break;
  }
  assert.equal(previous, 1); pressG(state);
  for (let tick = 0; tick < 80; tick++) {
    stepCharacter(state, {}); const visual = gearVisual(state);
    assert(visual.tint <= previous + 1e-8); previous = visual.tint;
  }
  assert.equal(state.gearState, 'normal'); assert.equal(previous, 0);
});

test('real damage is boosted once, with no repeated hits from extra Gear 2 frames', () => {
  function hit(state) {
    stepCharacter(state, {attackPressed: true, attackHeld: true});
    advance(state, 1.4, {attackHeld: true}); stepCharacter(state, {}); advance(state, .04);
    const boxes = getAttackHitboxes(state, getPose(state));
    const end = boxes[0].end;
    const target = {id: 'test-target', x: end.x - 2, y: end.y - 2, width: 4, height: 4, health: 100};
    const first = resolveAttackHits(state, [target], boxes);
    assert.equal(first.length, 1);
    for (let tick = 0; tick < 20; tick++) assert.equal(resolveAttackHits(state, [target], boxes).length, 0);
    return 100 - target.health;
  }
  const normal = hit(createCharacter()), gear = hit(transformed());
  near(gear, normal * 1.35);
});

test('steam, pressure waves and residual sprites remain bounded during long play', () => {
  const state = transformed(); const effects = createGearEffects({compact: () => true});
  for (let tick = 0; tick < 3600; tick++) {
    stepCharacter(state, {axis: tick % 500 < 250 ? 1 : -1}, 1 / 60);
    effects.update(state, getPose(state), 1 / 60);
    const counts = effects.counts();
    assert(counts.steam <= 36 && counts.ghosts <= 3 && counts.waves <= 5);
  }
  pressG(state);
  for (let tick = 0; tick < 120; tick++) { stepCharacter(state, {}); effects.update(state, getPose(state), 1 / 60); }
  assert.deepEqual(effects.counts(), {steam: 0, ghosts: 0, waves: 0});
});

test('Gear 2 emits subtle foreground steam and keeps its running trail close to the body', () => {
  const state = transformed(), effects = createGearEffects();
  const rectangles = [], context = {save() {}, restore() {}, fillRect(x, y, w, h) {
    if (this.globalAlpha > .01) rectangles.push({x, y, w, h, alpha: this.globalAlpha});
  }};
  for (let tick = 0; tick < 120; tick++) effects.update(state, getPose(state), 1 / 120);
  effects.drawFront(context);
  assert(rectangles.length > 0, 'steam must render in front of the sprite too');
  assert(rectangles.some(p => Math.abs(p.x - state.x) < 18 && p.y < state.y - 50), 'foreground wisps must overlap the torso/shoulders');
  assert(rectangles.every(p => p.alpha <= .46), 'foreground steam must leave the character readable');
  for (let tick = 0; tick < 180; tick++) {
    state.vx = 416; state.x += state.vx / 120; state.mode = 'running';
    effects.update(state, getPose(state), 1 / 120);
    rectangles.length = 0;
    effects.drawBack(context, () => {}); effects.drawFront(context);
    assert(rectangles.every(p => Math.abs(p.x - state.x) <= 74), 'running cannot leave a long vapor trail');
    assert(effects.counts().ghosts <= 2, 'residual silhouettes stay short too');
  }
});
