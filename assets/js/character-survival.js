// Survival owns opponents and rewards; character physics still owns every move.
// All positions use world units, +Y down, with actor/enemy origins at the feet.
import { stepCharacter, getPose, cancelCharacterCharge } from './character-physics.js';
import { getAttackHitboxes, resolveAttackHits, attackIntersectsRect } from './character-combat.js';
import { gearLocked, requestGearToggle } from './character-gear.js';
import { getRifleMuzzle } from './character-world-sprites.js';
import { WORLD_EFFECTS, explosionRadius, tornadoGeometry } from './character-world-effects.js';
import { HAKI_TUNING, hakiSuppresses } from './character-haki.js';

export const SURVIVAL_TUNING = Object.freeze({maxHealth: 100, killCharge: 15, gearDuration: 12, gearKillHealRatio: .1, invulnerability: .65, pickupHeal: 28,
  firstEnemy: 3, escalationAt: 60, swordAt: 75, upperAt: 115, cannonAt: 95, projectileCap: 160});
const T = SURVIVAL_TUNING;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const approach = (n, target, delta) => n < target ? Math.min(target, n + delta) : Math.max(target, n - delta);
const live = enemy => enemy.health > 0 && enemy.mode !== 'dead';
const enemyTypes = {rifle: {health: 24, height: 124}, sword: {health: 42, height: 128}, antiAir: {health: 32, height: 124}};
const random = game => clamp(Number(game.random()) || 0, 0, .999999);

export function survivalPressure(time, width = 960) {
  const t = Math.max(0, time), compact = width < 600;
  // A full calm minute, then a smooth, accelerating ramp. Entity counts are
  // bounded for performance; projectile speed and pressure keep growing.
  const escalation = Math.max(0, t - T.escalationAt) / 55;
  const intensity = escalation ** 1.18;
  return {escalation, intensity,
    enemyCap: Math.min(compact ? 16 : 26, 2 + Math.floor(escalation * 4)),
    enemyInterval: .1 + 7.4 / (1 + intensity * 3.2), enemyBatch: Math.min(4, 1 + Math.floor(escalation / 2.4)),
    bulletSpeed: 140 + 145 * escalation ** 1.1, aimDuration: .12 + 1.28 / (1 + intensity),
    recovery: .1 + 1.7 / (1 + intensity * 2), enemySpeed: 58 + 38 * Math.log1p(escalation),
    swordWindup: .16 + .5 / (1 + intensity), upperWindup: .23 + .62 / (1 + intensity * .75),
    bulletDamage: Math.round(6 + 4 * (1 - Math.exp(-escalation)) + 2 * Math.log1p(escalation)),
    cannonInterval: .14 + 6 / (1 + intensity * 1.6),
    cannonBatch: Math.min(5, 1 + Math.floor(Math.max(0, t - T.cannonAt) / 85)), cannonCap: compact ? 12 : 20,
    cannonSpeed: 170 + 155 * escalation ** 1.06, cannonWarning: .16 + .58 / (1 + escalation * .7),
    projectileCap: compact ? 96 : T.projectileCap};
}

export function createSurvival({width = 960, height = 440, floor = 368, random: randomSource = Math.random} = {}) {
  return {
    width: Math.max(160, Number(width) || 960), height, floor,
    random: typeof randomSource === 'function' ? randomSource : Math.random,
    health: T.maxHealth, maxHealth: T.maxHealth, time: 0, kills: 0, charge: 0,
    gearRemaining: 0, gearPending: false, gearExpiryPending: false,
    haki: null, hakiDuration: HAKI_TUNING.duration, nextHakiAt: HAKI_TUNING.unlockAt, hakiSerial: 0, lastHakiPressed: false,
    phase: 'ready', enemies: [], projectiles: [], pickups: [], explosions: [], events: [],
    invulnerable: 0, jumpHeat: 0, difficulty: 1, cinematic: false,
    nextEnemy: T.firstEnemy, nextPickup: 10, nextCannon: T.cannonAt, nextId: 1,
    lastGearPressed: false, lastGearState: 'normal', spawnSide: 1,
    metrics: {spawned: 0, fired: 0, blocked: 0, hitsTaken: 0}
  };
}

export function getPlayerHurtbox(actor) {
  // Excludes the broad hat, elastic limbs and a little sandal clearance.
  return {x: actor.x - 19, y: actor.y - 120, width: 38, height: 112};
}

export function getEnemyHurtbox(enemy) {
  return {x: enemy.x - 23, y: enemy.y - 118, width: 46, height: 118};
}

function emit(game, type, details = {}) {
  game.events.push({type, ...details});
}

function changeMode(enemy, mode) {
  enemy.mode = mode;
  enemy.modeTime = 0;
  enemy.modeDuration = mode === 'attack' ? enemy.type === 'sword' ? enemy.attackKind === 'upper' ? WORLD_EFFECTS.tornadoDuration : .18 : .1 :
    mode === 'recover' ? enemy.type === 'sword' ? .65 : .8 : mode === 'hurt' ? .24 : mode === 'dead' ? enemy.deadTime : 0;
}

function bodySweep(start, end, radius, rect) {
  return attackIntersectsRect({start, end, previousStart: start, previousEnd: end, radius}, rect);
}

function circleHitsRect(x, y, radius, rect) {
  const dx = x - clamp(x, rect.x, rect.x + rect.width);
  const dy = y - clamp(y, rect.y, rect.y + rect.height);
  return dx * dx + dy * dy <= radius * radius;
}

function hurtPlayer(game, actor, damage, source, x) {
  if (game.phase !== 'playing' || game.invulnerable > 0 || gearLocked(actor)) return false;
  game.health = Math.max(0, game.health - damage);
  game.invulnerable = T.invulnerability;
  game.metrics.hitsTaken += 1;
  actor.vx += (actor.x >= x ? 1 : -1) * 95;
  emit(game, 'player-hit', {x: actor.x, y: actor.y - 65, damage, source});
  if (!game.health) {
    game.haki = null;
    game.phase = 'over';
    cancelCharacterCharge(actor);
    actor.vx = 0;
    emit(game, 'game-over', {kills: game.kills, time: game.time});
  }
  return true;
}

function spawnEnemy(game, actor) {
  const cap = survivalPressure(game.time, game.width).enemyCap;
  if (game.enemies.filter(live).length >= cap || game.enemies.length >= cap + 4) return;
  let side = random(game) < .5 ? -1 : 1;
  // Never materialize the next attacker beside a player standing at that edge.
  if (actor.x < Math.min(180, game.width * .3)) side = 1;
  else if (actor.x > game.width - Math.min(180, game.width * .3)) side = -1;
  const roll = random(game);
  const type = game.time >= T.upperAt && roll < .12 + game.jumpHeat * .23 ? 'antiAir' : game.time >= T.swordAt && roll < .5 ? 'sword' : 'rifle';
  const spec = enemyTypes[type];
  const pressure = survivalPressure(game.time, game.width);
  const health = Math.round(spec.health * (1 + .16 * Math.log1p(pressure.escalation)));
  const enemy = {
    id: game.nextId++, type, x: side < 0 ? -64 : game.width + 64, y: game.floor,
    previousX: side < 0 ? -64 : game.width + 64, previousY: game.floor,
    vx: 0, facing: -side, width: 46, height: spec.height,
    health, maxHealth: health, mode: 'enter', modeTime: 0, modeDuration: 0,
    attackKind: 'slash', attackCount: 0, swingHit: false,
    aimX: actor.x, aimY: game.floor - 76, aimDuration: 1,
    speed: pressure.enemySpeed,
    deadTime: .5, entered: false
  };
  enemy.hurtbox = getEnemyHurtbox(enemy);
  game.enemies.push(enemy);
  game.metrics.spawned += 1;
  emit(game, 'spawn', {enemyId: enemy.id, enemyType: type, x: enemy.x, y: enemy.y});
}

function aim(enemy, game, actor) {
  enemy.aimX = clamp(actor.x + actor.vx * (enemy.type === 'antiAir' ? .18 : .06), 15, game.width - 15);
  enemy.aimY = clamp(actor.y - 65 + (enemy.type === 'antiAir' ? actor.vy * .09 : 0), 100, game.floor - 45);
  enemy.facing = enemy.aimX >= enemy.x ? 1 : -1;
}

function beginAim(enemy, game, actor) {
  changeMode(enemy, 'aim');
  aim(enemy, game, actor);
  enemy.vx = 0;
  enemy.swingHit = false;
  if (enemy.type === 'sword') {
    enemy.attackKind = game.time >= T.upperAt && (game.jumpHeat > .25 || !actor.grounded || game.time >= T.upperAt + 25 && enemy.attackCount % 3 === 2) ? 'upper' : 'slash';
    const pressure = survivalPressure(game.time);
    enemy.aimDuration = enemy.attackKind === 'upper' ? pressure.upperWindup : pressure.swordWindup;
  } else {
    enemy.aimDuration = survivalPressure(game.time).aimDuration;
  }
  enemy.modeDuration = enemy.aimDuration;
}

function shoot(enemy, game) {
  if (game.projectiles.length >= survivalPressure(game.time, game.width).projectileCap || enemy.x < 40 || enemy.x > game.width - 40) return;
  const {x, y} = getRifleMuzzle(enemy);
  const dx = enemy.aimX - x, dy = enemy.aimY - y;
  // A locked aim may miss a player who crossed behind. It must never fire back
  // through its own marine or silently reverse the visible telegraph.
  if (Math.sign(dx) !== enemy.facing || Math.abs(dx) < 3) return;
  // Marines do not damage teammates: back ranks can sustain the barrage.
  const length = Math.hypot(dx, dy) || 1;
  const speed = survivalPressure(game.time).bulletSpeed + (enemy.type === 'antiAir' ? 35 : 0);
  game.projectiles.push({
    id: game.nextId++, kind: 'bullet', x, y, previousX: x, previousY: y,
    vx: dx / length * speed, vy: dy / length * speed, radius: 5,
    damage: survivalPressure(game.time).bulletDamage, age: 0, life: 7,
    enemyId: enemy.id, alive: true
  });
  game.metrics.fired += 1;
  emit(game, 'shoot', {enemyId: enemy.id, x, y});
}

function meleeHitsPlayer(enemy, actor) {
  const rect = getPlayerHurtbox(actor);
  const facing = enemy.facing;
  const upper = enemy.attackKind === 'upper';
  // The rising slash and its tornado frames are one vertical attack. Its
  // capsule follows that centered column, rather than an invisible diagonal.
  const tornado = tornadoGeometry(enemy);
  const start = {x: enemy.x + facing * (upper ? 5 : 6), y: enemy.y - (upper ? tornado.radius : 67)};
  const end = {x: enemy.x + facing * (upper ? 5 : 76), y: enemy.y - (upper ? tornado.height - tornado.radius : 67)};
  const oldStart = {x: start.x + enemy.previousX - enemy.x + actor.x - actor.previousX, y: start.y + actor.y - actor.previousY};
  const oldEnd = {x: end.x + enemy.previousX - enemy.x + actor.x - actor.previousX, y: end.y + actor.y - actor.previousY};
  return attackIntersectsRect({start, end, previousStart: oldStart, previousEnd: oldEnd, radius: upper ? tornado.radius : 10}, rect);
}

function updateEnemy(enemy, game, actor, dt) {
  enemy.previousX = enemy.x;
  enemy.previousY = enemy.y;
  enemy.modeTime += dt;
  if (!live(enemy)) {
    enemy.vx = approach(enemy.vx, 0, 210 * dt);
    enemy.x += enemy.vx * dt;
    return;
  }
  enemy.speed = survivalPressure(game.time, game.width).enemySpeed;
  const dx = actor.x - enemy.x, distance = Math.abs(dx);
  if (enemy.mode === 'enter') {
    enemy.vx = enemy.facing * (enemy.speed + 13);
    if (enemy.x >= 60 && enemy.x <= game.width - 60) {
      enemy.entered = true;
      changeMode(enemy, 'approach');
    }
  } else if (enemy.mode === 'hurt') {
    enemy.vx = approach(enemy.vx, 0, 380 * dt);
    if (enemy.modeTime >= .24) changeMode(enemy, 'approach');
  } else if (enemy.mode === 'approach') {
    enemy.facing = dx < 0 ? -1 : 1;
    if (enemy.type === 'sword') {
      enemy.vx = enemy.facing * (enemy.speed + 26);
      if (distance < 84 && enemy.modeTime > .12) beginAim(enemy, game, actor);
    } else {
      const ideal = clamp(game.width * .25, 140, 245);
      enemy.vx = distance > ideal + 40 ? enemy.facing * enemy.speed : distance < ideal - 35 ? -enemy.facing * enemy.speed * .85 : 0;
      if (distance < ideal + 55 && distance > 75 && enemy.modeTime > .18) beginAim(enemy, game, actor);
    }
  } else if (enemy.mode === 'aim') {
    enemy.vx = 0;
    if (enemy.modeTime < enemy.aimDuration - Math.min(.18, enemy.aimDuration * .4)) aim(enemy, game, actor);
    if (enemy.modeTime >= enemy.aimDuration) {
      changeMode(enemy, 'attack');
      enemy.attackCount += 1;
      if (enemy.type !== 'sword') shoot(enemy, game);
      else {
        enemy.vx = enemy.attackKind === 'slash' ? enemy.facing * 155 : 0;
        emit(game, enemy.attackKind === 'slash' ? 'sword-attack' : 'spinning-sword', {enemyId: enemy.id, x: enemy.x, y: enemy.y});
      }
    }
  } else if (enemy.mode === 'attack') {
    if (enemy.type === 'sword') {
      const duration = enemy.attackKind === 'upper' ? WORLD_EFFECTS.tornadoDuration : .18;
      if (!enemy.swingHit && meleeHitsPlayer(enemy, actor)) {
        enemy.swingHit = true;
        hurtPlayer(game, actor, (enemy.attackKind === 'upper' ? 16 : 14) + Math.floor(Math.log1p(game.time / 100)), enemy.attackKind, enemy.x);
      }
      if (enemy.modeTime >= duration) changeMode(enemy, 'recover');
    } else if (enemy.modeTime >= .1) changeMode(enemy, 'recover');
  } else if (enemy.mode === 'recover') {
    enemy.vx = approach(enemy.vx, 0, 650 * dt);
    if (enemy.modeTime >= survivalPressure(game.time).recovery * (enemy.type === 'sword' ? 1.1 : 1)) changeMode(enemy, 'approach');
  }
  enemy.x += enemy.vx * dt;
  if (enemy.entered) enemy.x = clamp(enemy.x, 45, game.width - 45);
  enemy.hurtbox = getEnemyHurtbox(enemy);
}

function separateEnemies(game) {
  const enemies = game.enemies.filter(enemy => live(enemy) && enemy.entered).sort((a, b) => a.x - b.x);
  const spacing = Math.min(68, (game.width - 90) / Math.max(1, enemies.length - 1));
  for (let pass = 0; pass < 2; pass += 1) for (let index = 1; index < enemies.length; index += 1) {
    const left = enemies[index - 1], right = enemies[index];
    const overlap = spacing - (right.x - left.x);
    if (overlap <= 0) continue;
    // Two short passes separate hats and rifles without increasing entity count.
    left.x = clamp(left.x - overlap * .5, 45, game.width - 45);
    right.x = clamp(right.x + overlap * .5, 45, game.width - 45);
    left.hurtbox = getEnemyHurtbox(left);
    right.hurtbox = getEnemyHurtbox(right);
  }
}

function defeatEnemy(game, actor, enemy, source) {
  enemy.health = 0;
  changeMode(enemy, 'dead');
  game.kills += 1;
  const before = game.charge;
  if (actor.gearState === 'normal' && !game.gearPending) game.charge = Math.min(100, game.charge + T.killCharge);
  emit(game, 'kill', {enemyId: enemy.id, enemyType: enemy.type, x: enemy.x, y: enemy.y - 60, charge: game.charge - before, source});
  if (actor.gearState === 'gear2' && game.gearRemaining > 0 && game.health < game.maxHealth) {
    const amount = Math.min(game.maxHealth * T.gearKillHealRatio, game.maxHealth - game.health);
    game.health += amount;
    emit(game, 'heal', {x: actor.x, y: actor.y - 60, amount, source: 'gear-kill', enemyId: enemy.id});
  }
  if (before < 100 && game.charge >= 100) emit(game, 'gear-ready');
}

function activateHaki(game, actor) {
  if (game.time + 1e-8 < game.nextHakiAt || game.haki || gearLocked(actor)) return;
  const duration = Number.isFinite(game.hakiDuration) && game.hakiDuration > 0 ? game.hakiDuration : HAKI_TUNING.duration;
  game.haki = {serial: ++game.hakiSerial, x: actor.x, y: actor.y - 72, age: 0, duration};
  game.nextHakiAt = game.time + HAKI_TUNING.cooldown;
  emit(game, 'haki', {x: actor.x, y: actor.y - 72, duration});
  clearHakiMarines(game, actor);
}

function clearHakiMarines(game, actor) {
  for (const enemy of game.enemies) {
    if (!live(enemy) || !['rifle', 'sword', 'antiAir'].includes(enemy.type)) continue;
    const body = getEnemyHurtbox(enemy);
    if (body.x + body.width <= 0 || body.x >= game.width || body.y + body.height <= 0 || body.y >= game.height) continue;
    defeatEnemy(game, actor, enemy, 'haki');
  }
}

function playerAttacks(game, actor) {
  actor.hitboxes = getAttackHitboxes(actor, getPose(actor));
  const targets = game.enemies.filter(live).map(enemy => ({...getEnemyHurtbox(enemy), id: enemy.id, health: enemy.health, enemy}));
  for (const hit of resolveAttackHits(actor, targets, actor.hitboxes)) {
    const enemy = hit.target.enemy;
    enemy.health = hit.target.health;
    enemy.vx = getPose(actor).facing * Math.min(220, 90 + hit.damage * 2);
    emit(game, 'enemy-hit', {enemyId: enemy.id, x: enemy.x, y: enemy.y - 65, damage: hit.damage, kind: hit.kind});
    if (!enemy.health) {
      defeatEnemy(game, actor, enemy, hit.kind);
    } else {
      changeMode(enemy, 'hurt');
    }
  }
}

function cannon(game, actor) {
  const pressure = survivalPressure(game.time, game.width);
  if (game.projectiles.filter(projectile => projectile.kind === 'cannonball').length >= pressure.cannonCap || game.projectiles.length >= pressure.projectileCap) return;
  const targetX = clamp(actor.x + clamp(actor.vx * .12, -35, 35), 25, game.width - 25);
  const targetY = clamp(actor.y - 65 + clamp(actor.vy * .04, -24, 24), 105, game.floor - 35);
  let x = 16, y = 25;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const edge = Math.floor(random(game) * 3);
    x = edge === 0 ? 20 + random(game) * (game.width - 40) : edge === 1 ? 16 : game.width - 16;
    y = edge === 0 ? 25 : 40 + random(game) * (game.floor - 125);
    if (Math.hypot(x - actor.x, y - (actor.y - 65)) >= 180) break;
    if (attempt === 7) { x = actor.x < game.width / 2 ? game.width - 20 : 20; y = 25; }
  }
  const dx = targetX - x, dy = targetY - y, distance = Math.hypot(dx, dy) || 1;
  const speed = pressure.cannonSpeed;
  game.projectiles.push({id: game.nextId++, kind: 'cannonball', x, y, previousX: x, previousY: y,
    vx: dx / distance * speed, vy: dy / distance * speed,
    radius: 14, damage: 22 + Math.floor(Math.log1p(game.time / 100) * 2), age: 0, life: 8,
    alive: true, targetX, targetY, mode: 'warning', warningRemaining: pressure.cannonWarning, warningDuration: pressure.cannonWarning});
  emit(game, 'cannon-warning', {x, y, targetX, targetY, radius: WORLD_EFFECTS.explosionRadius, life: pressure.cannonWarning});
}

function explosion(game, actor, projectile, harmless = false, hitPlayer = false) {
  const radius = harmless ? 90 : WORLD_EFFECTS.explosionRadius;
  game.explosions.push({id: game.nextId++, x: projectile.x, y: Math.min(game.floor - 6, projectile.y), radius, age: 0,
    life: WORLD_EFFECTS.explosionLife, harmless, hitPlayer, damage: projectile.damage});
  emit(game, 'explosion', {x: projectile.x, y: projectile.y, radius, harmless});
}

function updateExplosions(game, actor, dt) {
  for (const effect of game.explosions) {
    effect.age += dt;
    const radius = explosionRadius(effect);
    if (!effect.hitPlayer && radius > 0 && circleHitsRect(effect.x, effect.y, radius, getPlayerHurtbox(actor))) {
      effect.hitPlayer = hurtPlayer(game, actor, effect.damage, 'explosion', effect.x);
    }
  }
  game.explosions = game.explosions.filter(effect => effect.age < effect.life).slice(-32);
}

function updateProjectiles(game, actor, dt) {
  for (const projectile of game.projectiles) {
    if (!projectile.alive) continue;
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;
    projectile.age += dt;
    if (projectile.warningRemaining > 0) {
      projectile.warningRemaining = Math.max(0, projectile.warningRemaining - dt);
      if (projectile.warningRemaining <= 1e-8) {
        projectile.warningRemaining = 0;
        projectile.mode = 'flying';
        emit(game, 'cannon-launch', {x: projectile.x, y: projectile.y});
      }
      continue;
    }
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    const rect = {x: projectile.x - projectile.radius, y: projectile.y - projectile.radius, width: projectile.radius * 2, height: projectile.radius * 2};
    const blocked = actor.hitboxes.some(box => attackIntersectsRect(box, rect));
    if (blocked) {
      projectile.alive = false;
      game.metrics.blocked += 1;
      emit(game, 'projectile-block', {x: projectile.x, y: projectile.y, kind: projectile.kind});
      if (projectile.kind === 'cannonball') explosion(game, actor, projectile, true);
      continue;
    }
    const hit = bodySweep({x: projectile.previousX - actor.previousX, y: projectile.previousY - actor.previousY},
      {x: projectile.x - actor.x, y: projectile.y - actor.y}, projectile.radius, {x: -19, y: -120, width: 38, height: 112});
    if (hit) {
      projectile.alive = false;
      if (projectile.kind === 'cannonball') {
        const damaged = hurtPlayer(game, actor, projectile.damage, 'cannonball', projectile.previousX);
        explosion(game, actor, projectile, false, damaged);
      }
      else hurtPlayer(game, actor, projectile.damage, 'bullet', projectile.x);
    } else if (projectile.kind === 'cannonball' && projectile.y + projectile.radius >= game.floor) {
      projectile.y = game.floor - projectile.radius;
      projectile.alive = false;
      explosion(game, actor, projectile);
    } else if (projectile.age > projectile.life || projectile.x < -120 || projectile.x > game.width + 120 || projectile.y < -120 || projectile.y > game.height + 50) {
      projectile.alive = false;
    }
    if (game.phase === 'over') break;
  }
  game.projectiles = game.projectiles.filter(projectile => projectile.alive);
}

function updatePickups(game, actor, dt) {
  if (game.time >= game.nextPickup) {
    game.nextPickup = game.time + 14 + random(game) * 8;
    if (game.pickups.length < 2) {
      const reach = Math.min(150, game.width * .3);
      const direction = actor.x < game.width / 2 ? 1 : -1;
      const x = clamp(actor.x + direction * (55 + random(game) * reach), 50, game.width - 50);
      game.pickups.push({id: game.nextId++, kind: 'health', x, y: game.floor - 35, radius: 32, age: 0, amount: T.pickupHeal});
      emit(game, 'pickup', {x, y: game.floor - 17});
    }
  }
  game.pickups = game.pickups.filter(pickup => {
    pickup.age += dt;
    if (game.health >= game.maxHealth || !circleHitsRect(pickup.x, pickup.y, pickup.radius, getPlayerHurtbox(actor))) return true;
    const amount = Math.min(pickup.amount, game.maxHealth - game.health);
    game.health += amount;
    emit(game, 'heal', {x: pickup.x, y: pickup.y, amount, source: 'pickup'});
    return false;
  });
}

function combatStep(game, actor, dt, hakiPressed = false) {
  game.time += dt;
  if (hakiPressed) activateHaki(game, actor);
  game.difficulty = 1 + survivalPressure(game.time).intensity;
  game.invulnerable = Math.max(0, game.invulnerable - dt);
  const targetHeat = actor.grounded ? 0 : 1;
  game.jumpHeat += (targetHeat - game.jumpHeat) * Math.min(1, dt * (targetHeat ? .45 : .18));
  if (game.time >= game.nextEnemy && !hakiSuppresses(game.haki)) {
    const pressure = survivalPressure(game.time, game.width);
    const returning = game.haki && game.haki.age < HAKI_TUNING.visualDuration;
    const ramp = returning ? clamp((game.haki.age - HAKI_TUNING.suppression) / (HAKI_TUNING.visualDuration - HAKI_TUNING.suppression),0,1) : 1;
    for (let i = 0; i < (returning ? 1 : pressure.enemyBatch); i++) spawnEnemy(game, actor);
    game.nextEnemy = game.time + Math.max(pressure.enemyInterval,returning ? 1.6*(1-ramp) : 0);
  }
  if (game.time >= game.nextCannon) {
    const pressure = survivalPressure(game.time, game.width);
    for (let i = 0; i < pressure.cannonBatch; i++) cannon(game, actor);
    game.nextCannon = game.time + pressure.cannonInterval;
  }
  if (hakiSuppresses(game.haki)) clearHakiMarines(game, actor);
  playerAttacks(game, actor);
  for (const enemy of game.enemies) {
    updateEnemy(enemy, game, actor, dt);
    if (game.phase === 'over') return;
  }
  if (hakiSuppresses(game.haki)) clearHakiMarines(game, actor);
  separateEnemies(game);
  updateProjectiles(game, actor, dt);
  updateExplosions(game, actor, dt);
  if (game.phase === 'over') return;
  updatePickups(game, actor, dt);
  game.enemies = game.enemies.filter(enemy => live(enemy) || enemy.modeTime < enemy.deadTime);
}

export function stepSurvival(game, actor, input = {}, dt = 1 / 120) {
  game.events.length = 0;
  if (game.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return game;
  if (game.health <= 0) {
    game.haki = null;
    game.health = 0;
    game.phase = 'over';
    cancelCharacterCharge(actor);
    actor.vx = 0;
    emit(game, 'game-over', {kills: game.kills, time: game.time});
    return game;
  }
  input ||= {};
  const gearPressed = !!input.gearPressed && !game.lastGearPressed;
  game.lastGearPressed = !!input.gearPressed;
  const hakiPressed = !!input.hakiPressed && !game.lastHakiPressed;
  game.lastHakiPressed = !!input.hakiPressed;
  const canGear = game.charge >= 100 && actor.gearState === 'normal' && !game.gearPending;
  let activate = gearPressed && canGear;
  if (gearPressed && !canGear) emit(game, 'gear-unavailable', {charge: game.charge});
  if (activate) {
    game.charge = 0;
    game.gearPending = true;
  }
  const total = Math.min(.1, dt), count = Math.ceil(total / (1 / 120) - 1e-8), elapsed = total / count;
  for (let index = 0; index < count; index += 1) {
    if (game.haki && !game.haki.externalClock) {
      game.haki.age += elapsed;
      if (game.haki.age + 1e-8 >= game.haki.duration) game.haki = null;
    }
    const wasLocked = gearLocked(actor);
    const beforeGear = actor.gearState;
    stepCharacter(actor, {...input, jumpPressed: index === 0 && input.jumpPressed,
      attackPressed: index === 0 && input.attackPressed, gearPressed: index === 0 && activate}, elapsed);
    if (game.haki) { game.haki.x = actor.x; game.haki.y = actor.y - 72; }
    actor.hitboxes = getAttackHitboxes(actor, getPose(actor));
    if (beforeGear !== 'gear2' && actor.gearState === 'gear2') {
      game.gearPending = false;
      game.gearRemaining = T.gearDuration;
      game.gearExpiryPending = false;
      const amount = game.maxHealth - game.health;
      game.health = game.maxHealth;
      game.invulnerable = Math.max(game.invulnerable, 1);
      emit(game, 'gear-activate', {x: actor.x, y: actor.y, amount});
      if (amount) emit(game, 'heal', {x: actor.x, y: actor.y - 60, amount, source: 'gear'});
    }
    if (actor.gearState === 'normal' && beforeGear === 'reverting') {
      game.gearExpiryPending = false;
      game.gearRemaining = 0;
    }
    game.lastGearState = actor.gearState;
    game.cinematic = wasLocked || gearLocked(actor) || !!input.cinematic;
    if (game.cinematic) continue;
    if (actor.gearState === 'gear2' && game.gearRemaining > 0) {
      game.gearRemaining = Math.max(0, game.gearRemaining - elapsed);
      if (game.gearRemaining <= 1e-8 && !game.gearExpiryPending) {
        game.gearRemaining = 0;
        game.gearExpiryPending = true;
        requestGearToggle(actor); // Revert on the next safe grounded physics step.
        emit(game, 'gear-expire', {x: actor.x, y: actor.y});
      }
    }
    combatStep(game, actor, elapsed, index === 0 && hakiPressed);
    if (game.phase === 'over') break;
  }
  return game;
}

export function resizeSurvival(game, width) {
  const next = Math.max(160, Number(typeof width === 'object' ? width.width : width) || game.width);
  const ratio = next / game.width, previousWidth = game.width;
  game.width = next;
  for (const enemy of game.enemies) {
    enemy.x = enemy.x < 0 ? enemy.x : enemy.x > previousWidth ? next + enemy.x - previousWidth : clamp(enemy.x * ratio, 45, next - 45);
    enemy.previousX = enemy.x;
    enemy.aimX *= ratio;
    enemy.hurtbox = getEnemyHurtbox(enemy);
  }
  for (const projectile of game.projectiles) {
    projectile.x *= ratio;
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;
    if (projectile.targetX !== undefined) {
      projectile.targetX *= ratio;
      if (projectile.warningRemaining > 0) {
        const speed = Math.hypot(projectile.vx, projectile.vy);
        const dx = projectile.targetX - projectile.x, dy = projectile.targetY - projectile.y;
        const length = Math.hypot(dx, dy) || 1;
        projectile.vx = dx / length * speed;
        projectile.vy = dy / length * speed;
      }
    }
  }
  for (const pickup of game.pickups) pickup.x = clamp(pickup.x * ratio, 35, next - 35);
  for (const effect of game.explosions) effect.x *= ratio;
  return game;
}
