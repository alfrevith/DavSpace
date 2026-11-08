// Physical attack geometry uses the same atlas anchors and elastic reach as
// the renderer. Targets can query these capsules without depending on Canvas.
import { SPRITES, SPRITE_REFERENCE } from './character-sprites.js';
import { punchExtension } from './character-punch.js';
import { kickExtension, KICK_DIRECTION } from './character-combat-motion.js';

const EMPTY = Object.freeze([]);
const HEIGHT = 142;

export function getAttackHitboxes(state, pose) {
  if (!pose.attackActive || pose.attackDamage <= 0 || pose.gear.locked) return EMPTY;
  const facing = pose.facing;
  const isPunch = state.mode === 'baseAttack';
  const frame = SPRITES[isPunch ? 'baseAttack' : 'jumpAttack'].frames[3];
  const scale = HEIGHT / SPRITE_REFERENCE.height * frame.scale;
  const at = (x, y) => {
    if (isPunch) {
      const reach = punchExtension(pose, x, facing, state.width, frame, scale);
      const fist = (frame.rect[2] - 30 - frame.pivot[0]) * scale;
      return [{x: x + facing * 12, y: y - 64}, {x: x + facing * (fist + reach), y: y - 64}];
    }
    const extra = kickExtension(pose, x, y, facing, state.width, state.floor, frame, scale);
    const pelvisY = y - SPRITE_REFERENCE.pelvisToFloor * HEIGHT / SPRITE_REFERENCE.height;
    return [{x, y: pelvisY}, {
      x: x + facing * ((270 - frame.pivot[0]) * scale + extra * KICK_DIRECTION.x),
      y: pelvisY + (520 - frame.pivot[1]) * scale + extra * KICK_DIRECTION.y
    }];
  };
  const [start, end] = at(state.x, state.y);
  const [previousStart, previousEnd] = at(state.previousX, state.previousY);
  return [{kind: isPunch ? 'punch' : 'kick', shape: 'capsule', attackSerial: state.attackSerial,
    damage: pose.attackDamage, radius: isPunch ? 7 : 8, start, end, previousStart, previousEnd}];
}

function pointDistance(point, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy || 1)));
  return (point.x - start.x - dx * t) ** 2 + (point.y - start.y - dy * t) ** 2;
}

function segmentHitsRect(start, end, radius, rect) {
  let low = 0, high = 1;
  for (const [axis, min, max] of [['x', rect.x, rect.x + rect.width], ['y', rect.y, rect.y + rect.height]]) {
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < 1e-8) {
      if (start[axis] < min || start[axis] > max) { low = 2; break; }
    } else {
      const first = (min - start[axis]) / delta, last = (max - start[axis]) / delta;
      low = Math.max(low, Math.min(first, last));
      high = Math.min(high, Math.max(first, last));
    }
  }
  if (low <= high) return true;
  const pointRect = point => (point.x - Math.max(rect.x, Math.min(rect.x + rect.width, point.x))) ** 2 +
    (point.y - Math.max(rect.y, Math.min(rect.y + rect.height, point.y))) ** 2;
  let distance = Math.min(pointRect(start), pointRect(end));
  for (const x of [rect.x, rect.x + rect.width]) for (const y of [rect.y, rect.y + rect.height]) distance = Math.min(distance, pointDistance({x, y}, start, end));
  return distance <= radius * radius;
}

export function attackIntersectsRect(hitbox, rect) {
  if (!hitbox || rect.width < 0 || rect.height < 0) return false;
  const {start, end, previousStart, previousEnd, radius} = hitbox;
  if (segmentHitsRect(start, end, radius, rect) || segmentHitsRect(previousStart, previousEnd, radius, rect) ||
    segmentHitsRect(previousStart, start, radius, rect) || segmentHitsRect(previousEnd, end, radius, rect)) return true;
  // Include the swept interior so a fast Gear 2 limb cannot skip a thin target.
  const point = {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
  const vertices = [previousStart, previousEnd, end, start];
  let sign = 0;
  for (let index = 0; index < vertices.length; index++) {
    const a = vertices[index], b = vertices[(index + 1) % vertices.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) < 1e-8) continue;
    if (sign && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return sign !== 0;
}

// Invoke inside a fixed physics step when targets are present. A charged or
// accelerated attack still damages each target only once per attack serial.
export function resolveAttackHits(state, targets, hitboxes = state.hitboxes) {
  if (state.hitAttackSerial !== state.attackSerial) {
    state.hitAttackSerial = state.attackSerial;
    state.hitTargets.clear();
  }
  const hits = [];
  for (const box of hitboxes || []) for (const target of targets) {
    const identity = target.id ?? target;
    if (!Number.isFinite(target.health) || target.health <= 0 || state.hitTargets.has(identity)) continue;
    if (!attackIntersectsRect(box, target)) continue;
    target.health = Math.max(0, target.health - box.damage);
    state.hitTargets.add(identity);
    hits.push({target, damage: box.damage, kind: box.kind, attackSerial: box.attackSerial});
  }
  return hits;
}
