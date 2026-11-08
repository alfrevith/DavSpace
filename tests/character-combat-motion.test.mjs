import test from 'node:test';
import assert from 'node:assert/strict';
import {chargeMotion, kickExtension, drawExtendedKick, KICK_EXTRA_REACH, KICK_DIRECTION} from '../assets/js/character-combat-motion.js';
import {SPRITES, SPRITE_REFERENCE} from '../assets/js/character-sprites.js';

const frame = SPRITES.jumpAttack.frames[3];
const scale = 142 / SPRITE_REFERENCE.height * frame.scale;
const pose = (phaseProgress = 1, phase = 'dive', grounded = false) => ({phase, phaseProgress, grounded});

test('a fully held punch stays animated with a bounded, continuous braced stance', () => {
  const angles = [];
  let previous = chargeMotion(0, 0).angle;
  for (let tick = 1; tick <= 240; tick++) {
    const time = tick / 60;
    const motion = chargeMotion(Math.min(1, time), time);
    assert(Number.isFinite(motion.angle));
    assert(Math.abs(motion.angle) < .12);
    assert(Math.abs(motion.angle - previous) < .008, 'preparation must not snap between frames');
    if (time > 1) angles.push(motion.angle);
    previous = motion.angle;
  }
  assert(Math.max(...angles) - Math.min(...angles) > .015, 'holding max charge cannot freeze the character');
  assert(Math.abs(chargeMotion(1, 2).angle) > Math.abs(chargeMotion(.1, 2).angle));
});

test('reduced motion keeps the charged stance while suppressing its cosmetic rocking', () => {
  assert(Math.abs(chargeMotion(1, 2, true).angle - chargeMotion(1, 4, true).angle) < 1e-10);
  assert(chargeMotion(1, 2, true).angle < 0);
});

test('the air kick extends quickly along the shin and only while diving', () => {
  const extend = p => kickExtension(p, 450, 180, 1, 1000, 368, frame, scale);
  assert.equal(extend(pose(0)), 0);
  assert(extend(pose(.07)) > 0 && extend(pose(.07)) < KICK_EXTRA_REACH);
  assert.equal(extend(pose(.14)), KICK_EXTRA_REACH);
  assert.equal(extend(pose(1, 'charge')), 0);
  assert.equal(extend(pose(1, 'landing', true)), 0);
  assert.equal(extend(pose(1, 'dive', true)), 0);
});

test('an extended kick never crosses the floor or either screen edge', () => {
  const tip = (frame.legStretch.tip[0] - frame.pivot[0]) * scale;
  for (const width of [360, 440, 960]) for (const x of [96, width / 2, width - 96]) for (const facing of [-1, 1]) {
    let previous = KICK_EXTRA_REACH;
    for (let altitude = 180; altitude >= 0; altitude -= 1) {
      const y = 368 - altitude;
      const extra = kickExtension(pose(), x, y, facing, width, 368, frame, scale);
      const footX = x + facing * (tip + extra * KICK_DIRECTION.x);
      assert(extra >= 0 && extra <= previous + .00001);
      assert(y + extra * KICK_DIRECTION.y <= 368 + .00001);
      assert(footX >= 12 - .00001 && footX <= width - 12 + .00001);
      previous = extra;
    }
    assert.equal(previous, 0, 'the limb retracts into its normal landing pose');
  }
});

test('a stretched shin refreshes its sampled color when a transition canvas changes tint', () => {
  const noop = () => {}, colors = [];
  const context = {save: noop, restore: noop, translate: noop, scale: noop,
    transform: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop,
    clip: noop, drawImage: image => colors.push(image.color)};
  const document = {createElement() {
    const canvas = {};
    canvas.getContext = () => ({...context, setTransform: noop, drawImage(image) { canvas.color = image.color; }});
    return canvas;
  }};
  const image = {color: 'original skin', spriteRevision: 0};
  drawExtendedKick(context, image, frame, scale, 80, document);
  assert.deepEqual(colors, ['original skin', 'original skin', 'original skin']);
  image.color = 'Gear 2 pink'; image.spriteRevision++;
  colors.length = 0;
  drawExtendedKick(context, image, frame, scale, 80, document);
  assert.deepEqual(colors, ['Gear 2 pink', 'Gear 2 pink', 'Gear 2 pink'], 'the stretched band must match both halves of the leg');
});
