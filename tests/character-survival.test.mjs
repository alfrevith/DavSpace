import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter, getPose, getCharacterStats} from '../assets/js/character-physics.js';
import {getRifleMuzzle} from '../assets/js/character-world-sprites.js';
import {createSurvival, stepSurvival, resizeSurvival, getPlayerHurtbox, getEnemyHurtbox, survivalPressure} from '../assets/js/character-survival.js';

const DT = 1 / 120;

test('bullets and shoot events originate at the rendered rifle opening in either direction', () => {
  for (const facing of [-1,1]) {
    const {game,actor}=fixture();
    const enemy=marine(game,'rifle',{x:actor.x-facing*210,facing,mode:'aim',modeTime:1,aimDuration:1,aimX:actor.x,aimY:actor.y-65});
    const muzzle=getRifleMuzzle(enemy);
    stepSurvival(game,actor,{},DT);
    const shot=game.events.find(e=>e.type==='shoot'),bullet=game.projectiles[0];
    assert(shot&&bullet);
    assert.equal(shot.x,muzzle.x); assert.equal(shot.y,muzzle.y);
    assert(Math.abs(bullet.x-bullet.vx*DT-muzzle.x)<1e-8);
    assert(Math.abs(bullet.y-bullet.vy*DT-muzzle.y)<1e-8);
    assert.equal(Math.sign(bullet.vx),facing);
  }
});
function fixture(options = {}) {
  const game = createSurvival({width: 960, height: 440, floor: 368, random: () => .4, ...options});
  const actor = createCharacter({width: game.width, height: 440, floor: 368, margin: 52});
  game.phase = 'playing';
  game.nextEnemy = game.nextPickup = game.nextCannon = Infinity;
  return {game, actor};
}
function run(game, actor, seconds, input = {}) {
  const events = [];
  for (let index = 0; index < Math.round(seconds * 120); index += 1) {
    stepSurvival(game, actor, typeof input === 'function' ? input(index) : input, DT);
    events.push(...game.events);
  }
  return events;
}
function marine(game, type = 'rifle', extra = {}) {
  const enemy = {id: game.nextId++, type, x: 560, y: game.floor, previousX: 560, previousY: game.floor,
    health: type === 'sword' ? 42 : 24, maxHealth: type === 'sword' ? 42 : 24,
    width: 46, height: 128, facing: -1, entered: true,
    mode: 'recover', modeTime: -100, modeDuration: .8, aimDuration: 1,
    aimX: 300, aimY: 300, speed: 60, vx: 0, attackKind: 'slash', attackCount: 0,
    swingHit: false, deadTime: .5, ...extra};
  enemy.hurtbox = getEnemyHurtbox(enemy);
  game.enemies.push(enemy);
  return enemy;
}
function projectile(game, actor, extra = {}) {
  const p = {id: game.nextId++, kind: 'bullet', x: actor.x - 100, y: actor.y - 65,
    previousX: actor.x - 100, previousY: actor.y - 65, vx: 30000, vy: 0,
    radius: 5, damage: 10, age: 0, life: 7, alive: true, ...extra};
  game.projectiles.push(p);
  return p;
}

test('pressure stays calm for a full minute, then grows steadily without a sudden second-minute barrage', () => {
  const calm=survivalPressure(0,450);
  for(const time of [10,30,59.99,60]) assert.deepEqual(survivalPressure(time,450),calm);
  assert.equal(calm.enemyCap,2);assert.equal(calm.bulletSpeed,140);
  const mid=survivalPressure(90,450),late=survivalPressure(120,450);
  assert(mid.enemyCap>calm.enemyCap&&mid.enemyCap<=4);
  assert(late.enemyCap>mid.enemyCap&&late.enemyCap<=7);
  assert(late.enemyInterval>1&&late.enemyInterval<mid.enemyInterval);
  assert(late.aimDuration+late.recovery>1.1);
  assert(late.bulletSpeed>mid.bulletSpeed&&late.bulletSpeed<360);
  assert(late.cannonSpeed>mid.cannonSpeed&&late.cannonBatch===1&&late.cannonInterval<mid.cannonInterval);
  assert.equal(survivalPressure(120,960).enemyCap,6);
  assert.equal(survivalPressure(180,960).enemyCap,10);
  assert.equal(survivalPressure(240,960).enemyCap,15);
  for(let time=61;time<=180;time++) {
    const before=survivalPressure(time-1),after=survivalPressure(time);
    assert(after.bulletSpeed>before.bulletSpeed&&after.bulletSpeed-before.bulletSpeed<5);
    assert(after.enemyCap-before.enemyCap<=1);
    assert(before.aimDuration-after.aimDuration<.05);
    assert(before.cannonInterval-after.cannonInterval<.2);
  }
  for(const time of [240,600,1200,3600]) {
    const before=survivalPressure(time,450),after=survivalPressure(time*2,450);
    assert(after.bulletSpeed>before.bulletSpeed&&after.cannonSpeed>before.cannonSpeed);
    assert(after.enemyInterval<before.enemyInterval&&after.aimDuration<before.aimDuration&&after.recovery<before.recovery);
    assert(after.cannonInterval<before.cannonInterval&&after.cannonWarning<before.cannonWarning);
    assert(after.enemyCap<=16&&after.projectileCap<=96);
  }
});

test('the first minute contains only two slow rifles and no cannon or sword escalation', () => {
  const {game,actor}=fixture();game.nextEnemy=3;game.nextCannon=95;
  game.invulnerable=1000;
  run(game,actor,60);
  assert.equal(game.enemies.length,2);
  assert(game.enemies.every(e=>e.type==='rifle'&&e.maxHealth===24&&e.speed===58));
  assert(game.projectiles.every(p=>p.kind==='bullet'));
  assert(game.metrics.fired>0&&game.metrics.fired<40,'rifles fire slowly in the calm phase');
  assert.equal(game.difficulty,1);
});

test('the expanding cannon blast damages its fringe and each explosion hits only once', () => {
  const {game,actor}=fixture();
  projectile(game,actor,{kind:'cannonball',x:actor.x+100,y:game.floor-14,vx:0,vy:0,radius:14,damage:22});
  stepSurvival(game,actor,{},DT);
  assert.equal(game.health,100,'outside the initial small frame');
  assert.equal(game.explosions[0].radius,152);
  run(game,actor,.23);
  assert.equal(game.health,78,'the large expanding fireball reaches a nearby player');
  game.invulnerable=0;
  run(game,actor,.3);
  assert.equal(game.health,78,'one explosion cannot damage twice even after invulnerability is cleared');
});

test('entering an existing blast causes damage, while a punched cannon explosion is harmless', () => {
  for(const harmless of [false,true]){
    const {game,actor}=fixture();
    game.explosions.push({id:1,x:actor.x+220,y:actor.y-60,radius:152,age:.25,life:.72,damage:22,harmless,hitPlayer:false});
    stepSurvival(game,actor,{},DT);assert.equal(game.health,100);
    actor.x+=140;actor.previousX=actor.x;
    stepSurvival(game,actor,{},DT);
    assert.equal(game.health,harmless?100:78);
  }
});

test('the full tornado reaches high airborne players but leaves a lateral escape', () => {
  for(const offset of [0,110]){
    const {game,actor}=fixture();const enemyX=actor.x;
    Object.assign(actor,{x:enemyX+offset,y:130,previousY:130,grounded:false,vy:0});
    marine(game,'sword',{x:enemyX,mode:'attack',modeTime:.2,attackKind:'upper',facing:1});
    stepSurvival(game,actor,{},DT);
    assert.equal(game.health,offset===0?84:100);
  }
});

test('ready, paused callers, invalid time and game over do not advance a run', () => {
  const {game, actor} = fixture();
  game.phase = 'ready';
  const x = actor.x;
  stepSurvival(game, actor, {axis: 1}, .1);
  assert.equal(actor.x, x);
  assert.equal(game.time, 0);
  game.phase = 'playing';
  for (const dt of [0, -1, NaN, Infinity]) stepSurvival(game, actor, {}, dt);
  assert.equal(game.time, 0);
  game.health = 0;
  stepSurvival(game, actor, {}, DT);
  assert.equal(game.phase, 'over');
  assert.equal(game.events[0].type, 'game-over');
  run(game, actor, 1, {axis: 1});
  assert.equal(game.time, 0);
  assert.equal(actor.x, x);
  assert.equal(game.events.length, 0);
});

test('the opening gives time to move, spawns offscreen, and unlocks opponents gradually', () => {
  const {game, actor} = fixture();
  game.nextEnemy = 3;
  run(game, actor, 2.9);
  assert.equal(game.enemies.length, 0);
  run(game, actor, .2);
  assert.equal(game.enemies[0].type, 'rifle');
  assert.equal(game.metrics.fired, 0);
  assert(game.enemies[0].x < 0 || game.enemies[0].x > game.width);
  game.enemies.length = 0;
  game.time = 76; game.nextEnemy = 0;
  stepSurvival(game, actor, {}, DT);
  assert.equal(game.enemies[0].type, 'sword');
  game.enemies.length = 0;
  game.time = 116; game.nextEnemy = 0; game.random = () => .05;
  stepSurvival(game, actor, {}, DT);
  assert.equal(game.enemies[0].type, 'antiAir');
});

test('rifles aim at the player snapshot, lock their telegraph and never shoot from offscreen', () => {
  const {game, actor} = fixture();
  Object.assign(actor, {y: 285, grounded: false, vy: 0});
  const enemy = marine(game, 'rifle', {x: actor.x + 200, mode: 'approach', modeTime: 1});
  stepSurvival(game, actor, {}, DT);
  assert.equal(enemy.mode, 'aim');
  assert.equal(enemy.aimY, actor.y - 65);
  assert.equal(enemy.modeDuration, enemy.aimDuration);
  enemy.modeTime = enemy.aimDuration - .15;
  const locked = {x: enemy.aimX, y: enemy.aimY};
  actor.x = enemy.x + 100;
  run(game, actor, .2);
  assert.equal(enemy.aimX, locked.x);
  assert.equal(enemy.aimY, locked.y);
  assert.equal(game.metrics.fired, 1);
  const bullet = game.projectiles[0];
  assert(bullet.vx < 0, 'the visible locked aim remains left even after the player crosses behind');
  assert(Math.abs(bullet.previousX - enemy.x) >= 60, 'the projectile leaves the actual muzzle');
  const other = fixture();
  marine(other.game, 'rifle', {x: -30, entered: false, mode: 'aim', modeTime: 3});
  stepSurvival(other.game, other.actor, {}, DT);
  assert.equal(other.game.projectiles.length, 0);
});

test('swords arrive after the calm minute and then adapt to jumping', () => {
  const {game, actor} = fixture();
  const enemy = marine(game, 'sword', {x: actor.x + 70, mode: 'approach', modeTime: 1});
  game.time = 76;
  stepSurvival(game, actor, {}, DT);
  assert.equal(enemy.attackKind, 'slash');
  assert.equal(enemy.mode, 'aim');
  game.time = 116; game.jumpHeat = .8;
  enemy.mode = 'approach'; enemy.modeTime = 1;
  stepSurvival(game, actor, {}, DT);
  assert.equal(enemy.attackKind, 'upper');
  assert(enemy.aimDuration >= .3);
  game.time = 141; enemy.attackCount = 2; enemy.mode = 'approach'; enemy.modeTime = 1;
  game.jumpHeat = 0;
  stepSurvival(game, actor, {}, DT);
  assert.equal(enemy.attackKind, 'upper', 'later third attacks use the same rising slash even against a grounded player');
});

test('a quick punch hurts once per serial, two defeat a rifle and a full punch defeats a sword', () => {
  const {game, actor} = fixture();
  const enemy = marine(game, 'rifle', {x: actor.x + 80});
  stepSurvival(game, actor, {attackPressed: true, attackHeld: false}, DT);
  run(game, actor, .11);
  assert.equal(enemy.health, 12);
  run(game, actor, .05);
  assert.equal(enemy.health, 12, 'the same extended fist cannot deal damage each tick');
  run(game, actor, .3);
  enemy.x = actor.x + 75;
  stepSurvival(game, actor, {attackPressed: true}, DT);
  const events = run(game, actor, .2);
  assert.equal(enemy.health, 0);
  assert.equal(game.kills, 1);
  assert.equal(game.charge, 15);
  assert(events.some(event => event.type === 'kill'));

  const full = fixture();
  const sword = marine(full.game, 'sword', {x: full.actor.x + 160});
  stepSurvival(full.game, full.actor, {attackPressed: true, attackHeld: true}, DT);
  run(full.game, full.actor, 1, {attackHeld: true});
  run(full.game, full.actor, .25, {attackHeld: false});
  assert.equal(sword.health, 0);
  assert.equal(full.game.kills, 1);
});

test('kill charge reaches full after seven normal kills and announces readiness once', () => {
  const {game, actor} = fixture();
  const events = [];
  for (let kill = 0; kill < 7; kill += 1) {
    marine(game, 'rifle', {x: actor.x + 70, health: 1});
    stepSurvival(game, actor, {attackPressed: true}, DT);
    events.push(...game.events, ...run(game, actor, .4));
    assert.equal(game.charge, Math.min(100, (kill + 1) * 15));
  }
  assert.equal(game.charge, 100);
  assert.equal(events.filter(event => event.type === 'gear-ready').length, 1);
  run(game, actor, .5);
  assert.equal(game.charge, 100);
});

test('active Gear 2 heals ten percent of maximum health once per defeated enemy',()=>{
  const {game,actor}=fixture();actor.gearState='gear2';game.gearRemaining=12;game.health=35;game.invulnerable=1000;
  for(const [index,type]of['rifle','sword','antiAir'].entries()){
    marine(game,type,{x:actor.x+70,health:1});
    stepSurvival(game,actor,{attackPressed:true},DT);
    const events=[...game.events,...run(game,actor,.4)];
    assert.equal(game.health,45+index*10);assert.equal(game.kills,index+1);
    const heal=events.filter(e=>e.type==='heal');
    assert.equal(heal.length,1);assert.equal(heal[0].amount,10);assert.equal(heal[0].source,'gear-kill');
    assert.equal(game.charge,0,'life recovery does not refill the Gear meter');
  }
  // The amount uses maximum health, rather than the missing health or a fixed 10.
  game.maxHealth=200;game.health=50;
  marine(game,'rifle',{x:actor.x+70,health:1});stepSurvival(game,actor,{attackPressed:true},DT);run(game,actor,.4);
  assert.equal(game.health,70);
});

test('multi-target Gear kills each heal once and never exceed full health',()=>{
  const {game,actor}=fixture();actor.gearState='gear2';game.gearRemaining=12;game.health=85;game.invulnerable=1000;
  marine(game,'rifle',{x:actor.x+60,health:1});marine(game,'sword',{x:actor.x+80,health:1});
  stepSurvival(game,actor,{attackPressed:true},DT);
  const events=[...game.events,...run(game,actor,.4)];
  assert.equal(game.kills,2);assert.equal(game.health,100);
  assert.deepEqual(events.filter(e=>e.type==='heal').map(e=>e.amount),[10,5]);
  marine(game,'rifle',{x:actor.x+70,health:1});stepSurvival(game,actor,{attackPressed:true},DT);
  const fullEvents=[...game.events,...run(game,actor,.4)];
  assert.equal(game.kills,3);assert.equal(game.health,100);
  assert(!fullEvents.some(e=>e.type==='heal'));
});

test('normal kills, expired Gear and nonlethal hits cannot grant kill healing',()=>{
  for(const [gearState,remaining,enemyHealth]of[['normal',0,1],['gear2',0,1],['gear2',12,999]]){
    const {game,actor}=fixture();actor.gearState=gearState;game.gearRemaining=remaining;game.health=50;game.invulnerable=1000;
    marine(game,'rifle',{x:actor.x+70,health:enemyHealth});stepSurvival(game,actor,{attackPressed:true},DT);
    const events=[...game.events,...run(game,actor,.4)];
    assert.equal(game.health,50);assert(!events.some(e=>e.type==='heal'));
    assert.equal(game.kills,enemyHealth===1?1:0);
  }
});

test('back ranks sustain the barrage without damaging teammates', () => {
  const {game, actor} = fixture();
  const shooter = marine(game, 'rifle', {x: 200, facing: 1, mode: 'aim', modeTime: 2, aimX: actor.x, aimY: actor.y - 65});
  const friend = marine(game, 'rifle', {x: 330});
  stepSurvival(game, actor, {}, DT);
  assert.equal(game.metrics.fired, 1);
  assert.equal(friend.health,24);
  friend.x = 700;
  shooter.mode = 'aim'; shooter.modeTime = 2;
  stepSurvival(game, actor, {}, DT);
  assert.equal(game.metrics.fired, 2);
  assert(game.projectiles[0].vx > 0);
});

test('nearby marines separate, while compact stage capacity grows with pressure', () => {
  const {game, actor} = fixture();
  const first = marine(game, 'rifle', {x: 620}), second = marine(game, 'rifle', {x: 625});
  stepSurvival(game, actor, {}, DT);
  assert(second.x - first.x >= 67.99);
  const mobile = fixture({width: 450});
  mobile.game.invulnerable = 1000;
  mobile.game.time = 40;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    mobile.game.nextEnemy = 0;
    stepSurvival(mobile.game, mobile.actor, {}, DT);
  }
  assert.equal(mobile.game.enemies.filter(enemy => enemy.health > 0).length, survivalPressure(40,450).enemyCap);
});

test('fast bullets and cannonballs use swept player collision and damage only once', () => {
  for (const kind of ['bullet', 'cannonball']) {
    const {game, actor} = fixture();
    projectile(game, actor, {kind, radius: kind === 'cannonball' ? 14 : 5, damage: kind === 'cannonball' ? 22 : 10});
    stepSurvival(game, actor, {}, DT);
    assert.equal(game.health, kind === 'cannonball' ? 78 : 90);
    assert.equal(game.metrics.hitsTaken, 1);
    assert.equal(game.projectiles.length, 0);
    assert(game.invulnerable > 0);
  }
});

test('overlapping shots respect iframes and cannot stack a lethal same-frame hit', () => {
  const {game, actor} = fixture();
  for (let index = 0; index < 4; index += 1) projectile(game, actor);
  stepSurvival(game, actor, {}, DT);
  assert.equal(game.health, 90);
  assert.equal(game.metrics.hitsTaken, 1);
  run(game, actor, .5);
  projectile(game, actor);
  stepSurvival(game, actor, {}, DT);
  assert.equal(game.health, 90);
  run(game, actor, .5);
  projectile(game, actor);
  stepSurvival(game, actor, {}, DT);
  assert.equal(game.health, 80);
});

test('active elastic attacks can break shots and cannonballs without farming charge', () => {
  for (const kind of ['bullet', 'cannonball']) {
    const {game, actor} = fixture();
    stepSurvival(game, actor, {attackPressed: true}, DT);
    run(game, actor, .08);
    assert(getPose(actor).attackActive);
    projectile(game, actor, {kind, x: actor.x + 54, y: actor.y - 64, vx: -150, radius: kind === 'cannonball' ? 14 : 5});
    stepSurvival(game, actor, {}, DT);
    assert.equal(game.metrics.blocked, 1);
    assert.equal(game.health, 100);
    assert.equal(game.projectiles.length, 0);
    assert.equal(game.charge, 0);
    assert(game.events.some(event => event.type === 'projectile-block'));
    if (kind === 'cannonball') assert(game.explosions[0].harmless);
  }
});

test('sword windup is harmless, a slash hits once, and jumping evades the ground blade', () => {
  const {game, actor} = fixture();
  const enemy = marine(game, 'sword', {x: actor.x + 65, mode: 'aim', modeTime: 0, aimDuration: .65, attackKind: 'slash'});
  run(game, actor, .6);
  assert.equal(game.health, 100);
  run(game, actor, .1);
  assert.equal(game.health, 86);
  game.invulnerable = 0;
  run(game, actor, .08);
  assert.equal(game.health, 86);
  const air = fixture();
  Object.assign(air.actor, {grounded: false, y: air.game.floor - 110, vy: 0});
  marine(air.game, 'sword', {x: air.actor.x + 35, mode: 'attack', modeTime: 0, attackKind: 'slash'});
  stepSurvival(air.game, air.actor, {}, DT);
  assert.equal(air.game.health, 100);
  air.game.enemies[0].attackKind = 'upper';
  stepSurvival(air.game, air.actor, {}, DT);
  assert.equal(air.game.health, 84);
  assert(enemy.swingHit);
});

test('the rising slash and tornado are one stationary vertical attack with a dodgeable side boundary', () => {
  for (const offset of [0, -65, 65]) {
    const {game, actor} = fixture();
    const enemyX = 480;
    Object.assign(actor, {x: enemyX + offset, y: game.floor - 110, grounded: false, vy: 0});
    marine(game, 'sword', {x: enemyX, facing: 1, mode: 'attack', modeTime: 0, attackKind: 'upper', vx: 0});
    stepSurvival(game, actor, {}, DT);
    assert.equal(game.health, offset === 0 ? 84 : 100,
      offset === 0 ? 'a player directly overhead is inside the visible tornado column' : 'moving outside the column evades it');
  }
  const {game, actor} = fixture();
  game.invulnerable = 1000;
  const enemy = marine(game, 'sword', {x: actor.x + 65, facing: -1, mode: 'aim', modeTime: .775, aimDuration: .78, attackKind: 'upper'});
  stepSurvival(game, actor, {}, DT);
  assert.equal(enemy.mode, 'attack');
  assert.equal(enemy.modeDuration, .6);
  assert.equal(enemy.vx, 0);
  const origin = enemy.x;
  run(game, actor, .3);
  assert.equal(enemy.mode, 'attack');
  assert.equal(enemy.x, origin);
  run(game, actor, .31);
  assert.equal(enemy.mode, 'recover');
});

test('cannonballs begin after the calm minute, warn, then fly at a fixed snapshot', () => {
  const {game, actor} = fixture();
  game.nextCannon = 95;
  game.time = 94.9;
  run(game, actor, .05);
  assert.equal(game.projectiles.length, 0);
  const events = run(game, actor, .1);
  const p = game.projectiles[0];
  assert.equal(p.kind, 'cannonball');
  assert.equal(p.mode, 'warning');
  assert(Math.hypot(p.x - actor.x, p.y - (actor.y - 65)) >= 180);
  assert(events.some(event => event.type === 'cannon-warning'));
  const origin = {x: p.x, y: p.y}, target = {x: p.targetX, y: p.targetY}, velocity = {x: p.vx, y: p.vy};
  assert(Math.abs((target.x - origin.x) * p.vy - (target.y - origin.y) * p.vx) < .001);
  run(game, actor, .3);
  assert.equal(p.x, origin.x);
  assert.equal(p.y, origin.y);
  actor.x += 80;
  run(game, actor, .5);
  assert.equal(p.mode, 'flying');
  assert.equal(p.targetX, target.x);
  assert.equal(p.targetY, target.y);
  assert.equal(p.vx, velocity.x);
  assert.equal(p.vy, velocity.y, 'the ball neither arcs nor homes after locking its target');
  assert.notEqual(p.x, origin.x);
});

test('different random values produce top and side cannon origins without near-player spawns', () => {
  const origins = [];
  for (const value of [.05, .4, .85]) {
    const {game, actor} = fixture({random: () => value});
    game.time = 80; game.nextCannon = 0;
    stepSurvival(game, actor, {}, DT);
    const p = game.projectiles[0];
    origins.push([p.x, p.y]);
    assert(Math.hypot(p.x - actor.x, p.y - (actor.y - 65)) >= 180);
  }
  assert.equal(new Set(origins.map(pair => pair.join(','))).size, 3);
  assert.equal(origins[0][1], 25);
  assert.equal(origins[1][0], 16);
  assert.equal(origins[2][0], 944);
});

test('Gear 2 rejects an empty bar, freezes threats during the cinematic, heals and expires once', () => {
  const {game, actor} = fixture();
  game.health = 34;
  stepSurvival(game, actor, {gearPressed: true}, DT);
  assert.equal(actor.gearState, 'normal');
  assert.equal(game.health, 34);
  assert(game.events.some(event => event.type === 'gear-unavailable'));
  stepSurvival(game, actor, {}, DT);
  game.charge = 100;
  const enemy = marine(game);
  const p = projectile(game, actor, {vx: 100, x: 100, y: 180});
  const time = game.time, position = {enemy: enemy.x, bullet: p.x};
  stepSurvival(game, actor, {gearPressed: true}, DT);
  assert.equal(actor.gearState, 'transforming');
  assert.equal(game.charge, 0);
  run(game, actor, 2);
  assert.equal(game.time, time);
  assert.equal(enemy.x, position.enemy);
  assert.equal(p.x, position.bullet);
  const activation = run(game, actor, .1);
  assert.equal(actor.gearState, 'gear2');
  assert.equal(game.health, 100);
  assert(game.gearRemaining > 11.8 && game.gearRemaining <= 12);
  assert.equal(activation.filter(event => event.type === 'gear-activate').length, 1);
  assert.equal(activation.find(event => event.type === 'heal').source, 'gear');
  game.health = 60;
  run(game, actor, .1);
  assert.equal(game.health, 60, 'healing is tied to activation, not repeated each frame');
  game.invulnerable = 1000;
  const expiration = run(game, actor, 12.6);
  assert.equal(expiration.filter(event => event.type === 'gear-expire').length, 1);
  assert.equal(actor.gearState, 'normal');
  assert.equal(game.gearRemaining, 0);
  assert.equal(getCharacterStats(actor).speed, 260);
});

test('the last active Gear instant queues a safe grounded revert instead of teleporting from a jump', () => {
  const {game, actor} = fixture();
  Object.assign(actor, {gearState: 'gear2', grounded: false, y: 280, vy: -30});
  game.gearRemaining = .01;
  run(game, actor, .025, {jumpHeld: true});
  assert.equal(game.gearRemaining, 0);
  assert.equal(actor.gearState, 'gear2');
  assert(actor.y < game.floor);
  assert(actor.gearQueued);
  run(game, actor, 1.2);
  assert.equal(actor.gearState, 'normal');
  assert.equal(actor.y, game.floor);
});

test('health pickups persist until reachable, never over-heal and cannot accumulate without bound', () => {
  const {game, actor} = fixture();
  game.nextPickup = 22;
  game.time = 22;
  stepSurvival(game, actor, {}, DT);
  const pickup = game.pickups[0];
  assert(pickup);
  assert(Math.abs(pickup.x - actor.x) <= 205);
  game.nextPickup = Infinity;
  run(game, actor, 45);
  assert.equal(game.pickups[0].id, pickup.id, 'a full-health player can leave food for later');
  actor.x = pickup.x; game.health = 83;
  stepSurvival(game, actor, {}, DT);
  assert.equal(game.health, 100);
  assert.equal(game.pickups.length, 0);
  assert.equal(game.events.find(event => event.type === 'heal').amount, 17);
  assert.equal(game.events.find(event => event.type === 'heal').source, 'pickup');
  for (let index = 0; index < 5; index += 1) { game.nextPickup = 0; stepSurvival(game, actor, {}, DT); }
  assert.equal(game.pickups.length, 2);
});

test('a lethal legitimate hit ends the run once and freezes opponents, score and movement', () => {
  const {game, actor} = fixture();
  game.health = 4;
  projectile(game, actor);
  stepSurvival(game, actor, {}, DT);
  assert.equal(game.phase, 'over');
  assert.equal(game.health, 0);
  assert.equal(game.events.filter(event => event.type === 'game-over').length, 1);
  const time = game.time, x = actor.x;
  run(game, actor, 2, {axis: 1, attackPressed: true});
  assert.equal(game.time, time);
  assert.equal(actor.x, x);
});

test('resizing preserves offscreen entry and updates hitboxes and projectile telegraphs', () => {
  const {game, actor} = fixture();
  const inside = marine(game, 'rifle', {x: 800});
  const outside = marine(game, 'rifle', {x: 1000, entered: false});
  game.time = 80; game.nextCannon = 0;
  stepSurvival(game, actor, {}, DT);
  resizeSurvival(game, 390);
  assert.equal(game.width, 390);
  assert(inside.x >= 45 && inside.x <= 345);
  assert.equal(outside.x, 430);
  assert.deepEqual(inside.hurtbox, getEnemyHurtbox(inside));
  const p = game.projectiles[0];
  assert(p.targetX >= 0 && p.targetX <= 390);
  assert(Math.abs((p.targetX - p.x) * p.vy - (p.targetY - p.y) * p.vx) < .001);
  const hurtbox = getPlayerHurtbox(actor);
  assert.equal(hurtbox.width, 38);
  assert.equal(hurtbox.height, 112);
});

test('a long seeded survival remains bounded and finite while difficulty continues growing', () => {
  let seed = 2147;
  const seeded = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const {game, actor} = fixture({width: 960, random: seeded});
  game.nextEnemy = 3; game.nextPickup = 10; game.nextCannon = 95;
  game.invulnerable = 10000;
  let atHalf = 0, sawCannon = false, sawSword = false, sawAntiAir = false;
  for (let frame = 0; frame < 240 * 120; frame += 1) {
    const phase = frame % 240;
    stepSurvival(game, actor, {axis: Math.floor(frame / 360) % 2 ? -1 : 1,
      jumpPressed: phase === 0, jumpHeld: phase < 42, attackPressed: frame % 38 === 0, attackHeld: false}, DT);
    if (frame === 120 * 120) atHalf = game.difficulty;
    sawCannon ||= game.projectiles.some(p => p.kind === 'cannonball');
    sawSword ||= game.enemies.some(enemy => enemy.type === 'sword');
    sawAntiAir ||= game.enemies.some(enemy => enemy.type === 'antiAir');
    assert(game.enemies.length <= 30);
    assert(game.projectiles.length <= 160);
    assert(game.pickups.length <= 2);
    assert(game.explosions.length <= 32);
    assert(game.enemies.every(enemy => enemy.attackKind === 'slash' || enemy.attackKind === 'upper'));
    for (const entity of [actor, ...game.enemies, ...game.projectiles, ...game.pickups]) {
      assert(Number.isFinite(entity.x) && Number.isFinite(entity.y));
    }
  }
  assert.equal(game.phase, 'playing');
  assert.equal(game.health, 100);
  assert(game.difficulty > atHalf);
  assert(game.metrics.spawned > 20);
  assert(sawCannon && sawSword && sawAntiAir);
});
