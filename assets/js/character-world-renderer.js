import { WORLD_SPRITES, WORLD_REFERENCE, getRifleMuzzle } from './character-world-sprites.js';
import { WORLD_EFFECTS, tornadoGeometry } from './character-world-effects.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const walkFrames = [0, 1, 0, 2];

// All artwork is drawn at one uniform scale. No source recoloring, body warping,
// image filters, offscreen copies or generated replacements are involved.
export function createWorldRenderer(images) {
  const imageFor = key => images instanceof Map ? images.get(key) : images?.[key];

  function sprite(ctx, key, index, x, y, units, facing = 1, angle = 0) {
    const source = WORLD_SPRITES[key];
    const image = imageFor(key);
    if (!source || !image) return false;
    const frame = source.frames[clamp(Math.floor(index), 0, source.frames.length - 1)];
    const scale = units * frame.scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    if (facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(image, ...frame.rect, -frame.pivot[0] * scale, -frame.pivot[1] * scale,
      frame.rect[2] * scale, frame.rect[3] * scale);
    ctx.restore();
    return true;
  }

  function drawBackground(ctx, width, height, floor) {
    ctx.save();
    const image = imageFor('scenery');
    if (image) {
      const source = WORLD_REFERENCE.scenery;
      // Cover above and below the same tile-plane anchor, even on tall phones.
      // This preserves the scenery's ratio and keeps feet on the stone pier.
      const scale = Math.max(width / source.width, floor / source.floorY,
        (height - floor) / (source.height - source.floorY));
      const x = (width - source.width * scale) / 2;
      const y = floor - source.floorY * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0, source.width, source.height, x, y,
        source.width * scale, source.height * scale);
    } else {
      ctx.fillStyle = '#17324e';
      ctx.fillRect(0, 0, width, height);
    }
    // A very small edge shade gives HUD and telegraphs room over the artwork.
    const shade = ctx.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, 'rgba(8, 19, 35, .24)');
    shade.addColorStop(.24, 'rgba(8, 19, 35, 0)');
    shade.addColorStop(.85, 'rgba(8, 19, 35, 0)');
    shade.addColorStop(1, 'rgba(8, 19, 35, .12)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function poseFor(enemy, time, reduced) {
    const sword = enemy.type === 'sword';
    const base = sword ? 'marine2Base' : 'marine1Base';
    const t = number(enemy.modeTime);
    const mode = enemy.mode;
    if (mode === 'enter' || mode === 'approach') {
      const gait = number(enemy.walkTime, number(enemy.runTime, time));
      return { key: sword ? 'marine2Walk' : 'marine1Walk', index: reduced ? 0 : walkFrames[Math.floor(gait * 8) % walkFrames.length] };
    }
    if (mode === 'aim') {
      const phase = clamp(t / number(enemy.modeDuration, number(enemy.aimDuration, .85)), 0, 1);
      if (!sword) return { key: 'marine1Aim', index: phase < .2 ? 0 : phase < .62 ? 1 : 2 };
      return { key: enemy.attackKind === 'upper' ? 'marine2Upper' : 'marine2Attack', index: phase < .24 ? 0 : 1 };
    }
    if (mode === 'attack') {
      if (!sword) return { key: 'marine1Aim', index: 2 };
      if (enemy.attackKind === 'upper') {
        // The three vortex frames continue the upward attack; they are not a
        // third move. Every pose shares the same feet anchor throughout.
        const phase = clamp(t / Math.max(.1, number(enemy.modeDuration, WORLD_EFFECTS.tornadoDuration)), 0, 1);
        if (phase < .16) return { key: 'marine2Upper', index: 2 };
        if (phase < .32) return { key: 'marine2Upper', index: 3 };
        return { key: 'marine2Swirl', index: reduced ? 0 : Math.min(2, Math.floor((phase - .32) / .68 * 3)) };
      }
      return { key: 'marine2Attack', index: t < .11 ? 2 : 3 };
    }
    if (mode === 'recover') {
      if (!sword && t < .16) return { key: 'marine1Aim', index: 1 };
      if (sword && enemy.attackKind === 'upper' && t < .14) {
        return { key: 'marine2Upper', index: 1 };
      }
      if (sword && t < .14) return { key: 'marine2Attack', index: 3 };
    }
    return { key: base, index: 0 };
  }

  function shadow(ctx, x, y, width, alpha = .22) {
    ctx.fillStyle = `rgba(7, 16, 32, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 1, width, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function telegraph(ctx, enemy, game, reduced) {
    if (enemy.mode !== 'aim') return;
    const duration = number(enemy.modeDuration, number(enemy.aimDuration, .85));
    const phase = clamp(number(enemy.modeTime) / Math.max(.1, duration), 0, 1);
    const facing = enemy.facing === -1 ? -1 : 1;
    ctx.save();
    if (enemy.type === 'sword') {
      const rising = enemy.attackKind === 'upper';
      ctx.strokeStyle = rising ? 'rgba(75, 194, 255, .65)' : 'rgba(255, 190, 97, .72)';
      ctx.fillStyle = rising ? 'rgba(75, 194, 255, .08)' : 'rgba(255, 190, 97, .08)';
      ctx.lineWidth = 1.5;
      const tornado = tornadoGeometry(enemy);
      const radius = rising ? tornado.radius : 43;
      const x = enemy.x + facing * (rising ? 5 : 43);
      ctx.beginPath();
      ctx.ellipse(x, enemy.y + 1, radius, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // The filling arc communicates remaining windup without relying on color.
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(x, enemy.y + 1, radius, 7, 0, -Math.PI / 2, -Math.PI / 2 + phase * Math.PI * 2);
      ctx.stroke();
      if (rising) {
        ctx.strokeStyle = 'rgba(112, 209, 255, .5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(enemy.x + facing * 5, enemy.y - tornado.radius);
        ctx.lineTo(enemy.x + facing * 5, enemy.y - tornado.height + tornado.radius);
        ctx.stroke();
      }
    } else {
      const {x, y} = getRifleMuzzle(enemy);
      const aimX = number(enemy.aimX, x + facing * 220);
      const aimY = number(enemy.aimY, y);
      ctx.strokeStyle = enemy.type === 'antiAir' ? 'rgba(255, 155, 100, .55)' : 'rgba(255, 239, 175, .55)';
      ctx.lineWidth = phase > .75 ? 1.7 : 1;
      ctx.setLineDash([4, 7]);
      ctx.lineDashOffset = reduced ? 0 : -number(game.time) * 15;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(aimX, aimY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff0bd';
      ctx.beginPath();
      ctx.arc(x, y, 2 + phase, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 239, 175, .8)';
      ctx.beginPath();
      ctx.arc(aimX, aimY, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawActors(ctx, game, { reduced = false } = {}) {
    if (!game) return;
    ctx.save();
    const time = number(game.time);
    for (const enemy of game.enemies || []) {
      if (enemy.mode === 'dead' && enemy.modeTime >= .5) continue;
      const pose = poseFor(enemy, time, reduced);
      const base = enemy.type === 'sword' ? 'marine2Base' : 'marine1Base';
      let units = number(enemy.height, enemy.type === 'sword' ? 128 : 124) / WORLD_REFERENCE.marineHeight;
      if (enemy.attackKind === 'upper' && enemy.mode === 'attack') {
        const art = WORLD_SPRITES[pose.key].frames[pose.index];
        units = tornadoGeometry(enemy).height / (art.rect[3] * art.scale);
      }
      ctx.save();
      if (enemy.mode === 'dead') ctx.globalAlpha *= clamp(1 - number(enemy.modeTime) / .5, 0, 1);
      else if (enemy.mode === 'hurt') ctx.globalAlpha *= .72;
      shadow(ctx, enemy.x, enemy.y, enemy.type === 'sword' ? 22 : 20);
      telegraph(ctx, enemy, game, reduced);
      if (!sprite(ctx, pose.key, pose.index, enemy.x, enemy.y, units, enemy.facing)) {
        sprite(ctx, base, 0, enemy.x, enemy.y, units, enemy.facing);
      }
      if (enemy.mode !== 'dead' && enemy.health < enemy.maxHealth) {
        const x = enemy.x - 17;
        const y = enemy.y - number(enemy.height, 128) - 9;
        ctx.fillStyle = 'rgba(10, 21, 38, .8)';
        ctx.fillRect(x - 1, y - 1, 36, 5);
        ctx.fillStyle = '#f3d8ad';
        ctx.fillRect(x, y, 34 * clamp(enemy.health / enemy.maxHealth, 0, 1), 3);
      }
      ctx.restore();
    }

    for (const pickup of game.pickups || []) {
      if (pickup.kind && pickup.kind !== 'health') continue;
      const bob = reduced ? 0 : Math.sin(time * 3 + number(pickup.id)) * 2;
      const y = number(pickup.y, number(game.floor, 368) - 35);
      shadow(ctx, pickup.x, number(game.floor, 368), 16, .15);
      ctx.fillStyle = 'rgba(255, 221, 232, .15)';
      ctx.beginPath();
      ctx.ellipse(pickup.x, y + bob, 39, 33, 0, 0, Math.PI * 2);
      ctx.fill();
      sprite(ctx, 'health', 0, pickup.x, y + 31 + bob, WORLD_EFFECTS.healthWidth / WORLD_SPRITES.health.frames[0].rect[2]);
    }

    for (const projectile of game.projectiles || []) {
      const kind = projectile.kind === 'cannonball' ? 'cannonball' : 'bullet';
      const angle = Math.atan2(number(projectile.vy), number(projectile.vx, 1));
      const x = number(projectile.x), y = number(projectile.y);
      ctx.save();
      if (kind === 'cannonball' && projectile.mode === 'warning') {
        const duration = Math.max(.1, number(projectile.warningDuration, .65));
        const phase = clamp(1 - number(projectile.warningRemaining, duration) / duration, 0, 1);
        // Keep the source tell visible when a cannonball starts just outside an
        // edge. Its shot still follows the engine's immutable target snapshot.
        const markerX = clamp(x, 13, Math.max(13, number(game.width, 960) - 13));
        const markerY = clamp(y, 13, Math.max(13, number(game.height, 440) - 13));
        const targetX = number(projectile.targetX, x + Math.cos(angle) * 160);
        const targetY = number(projectile.targetY, y + Math.sin(angle) * 160);
        ctx.strokeStyle = `rgba(255, 208, 125, ${.2 + phase * .22})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 8]);
        ctx.beginPath();
        ctx.moveTo(markerX, markerY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(32, 24, 26, .38)';
        ctx.strokeStyle = 'rgba(255, 214, 143, .85)';
        ctx.beginPath();
        ctx.arc(markerX, markerY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(markerX, markerY, 10, -Math.PI / 2, -Math.PI / 2 + phase * Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffdfa2';
        ctx.beginPath();
        ctx.moveTo(markerX + Math.cos(angle) * 5, markerY + Math.sin(angle) * 5);
        ctx.lineTo(markerX + Math.cos(angle + 2.4) * 4, markerY + Math.sin(angle + 2.4) * 4);
        ctx.lineTo(markerX + Math.cos(angle - 2.4) * 4, markerY + Math.sin(angle - 2.4) * 4);
        ctx.closePath();
        ctx.fill();
        // Pixel brackets live at the locked target, where the player can see
        // them even when the shot's source is behind the HUD at a screen edge.
        // Keep the middle open and contract toward that same immutable point.
        const extent = Math.round(22 - phase * 4);
        const centerX = Math.round(targetX), centerY = Math.round(targetY);
        const left = centerX - extent, top = centerY - extent;
        const right = centerX + extent, bottom = centerY + extent;
        const corners = [
          [left, top, 6, 2], [left, top, 2, 6],
          [right - 6, top, 6, 2], [right - 2, top, 2, 6],
          [left, bottom - 2, 6, 2], [left, bottom - 6, 2, 6],
          [right - 6, bottom - 2, 6, 2], [right - 2, bottom - 6, 2, 6]
        ];
        ctx.fillStyle = 'rgba(16, 24, 36, .86)';
        for (const [cx, cy, cw, ch] of corners) ctx.fillRect(cx - 1, cy - 1, cw + 2, ch + 2);
        ctx.fillStyle = '#ffe4ab';
        for (const [cx, cy, cw, ch] of corners) ctx.fillRect(cx, cy, cw, ch);
        ctx.restore();
        continue;
      }
      if (kind === 'bullet') {
        // A restrained tracer makes the original small projectile legible over
        // pale stone, without expanding its hitbox or changing its artwork.
        ctx.strokeStyle = 'rgba(255, 237, 177, .55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(angle) * 15, y - Math.sin(angle) * 15);
        ctx.lineTo(x - Math.cos(angle) * 4, y - Math.sin(angle) * 4);
        ctx.stroke();
        const animated = imageFor('bulletAnimation');
        const key = animated ? 'bulletAnimation' : 'bullet';
        const index = animated ? Math.floor(number(projectile.age) * 14) % WORLD_SPRITES.bulletAnimation.frames.length : 0;
        sprite(ctx, key, index, x, y, 28 / WORLD_SPRITES[key].frames[0].rect[2], 1, angle);
      } else {
        const diameter = Math.max(22, number(projectile.radius, 13) * 2);
        sprite(ctx, 'cannonball', 0, x, y, diameter / 715);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawForeground(ctx, game) {
    if (!game) return;
    ctx.save();
    for (const explosion of game.explosions || []) {
      const progress = clamp(number(explosion.age) / Math.max(.1, number(explosion.life, .46)), 0, 1);
      if (progress >= 1) continue;
      const index = Math.min(3, Math.floor(progress * 4));
      ctx.save();
      ctx.globalAlpha *= progress > .78 ? (1 - progress) / .22 : 1;
      const radius = Math.max(24, number(explosion.radius, 46));
      sprite(ctx, 'explosion', index, explosion.x, explosion.y, radius * 2 / WORLD_REFERENCE.explosionDiameter);
      ctx.restore();
    }
    ctx.restore();
  }

  return { drawBackground, drawActors, drawForeground };
}
