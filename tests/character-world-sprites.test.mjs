import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WORLD_SPRITES, WORLD_REFERENCE, ACHIEVEMENT_LAYOUT } from '../assets/js/character-world-sprites.js';
import { createWorldRenderer } from '../assets/js/character-world-renderer.js';

function context() {
  const calls = [];
  const ctx = { calls, globalAlpha: 1,
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    translate(...args) { calls.push(['translate', ...args]); },
    moveTo(...args) { calls.push(['moveTo', ...args]); },
    lineTo(...args) { calls.push(['lineTo', ...args]); },
    fillRect(...args) { calls.push(['fillRect', ...args, this.fillStyle]); },
    createLinearGradient() { return {addColorStop() {}}; }
  };
  for (const name of ['save', 'restore', 'rotate', 'scale', 'beginPath', 'closePath', 'ellipse', 'arc', 'fill', 'stroke', 'setLineDash']) ctx[name] = () => {};
  return ctx;
}

const images = new Map(Object.keys(WORLD_SPRITES).map(key => [key, {key}]));

test('the enlarged food includes both bones and uses the source aspect ratio', () => {
  const ctx=context();createWorldRenderer(images).drawActors(ctx,{floor:368,time:0,pickups:[{kind:'health',x:200,y:333,id:1}]},{reduced:true});
  const draw=ctx.calls.find(c=>c[0]==='drawImage');
  assert.equal(draw[1].key,'health');
  assert(draw[2]<=96&&draw[3]<=197&&draw[2]+draw[4]>1149&&draw[3]+draw[5]>1122,'no meat or bone can be cut off');
  assert.equal(draw[8],72);
  assert(Math.abs(draw[8]/draw[4]-draw[9]/draw[5])<1e-10);
});

test('the enlarged tornado and cannon explosion retain original proportions', () => {
  const renderer=createWorldRenderer(images),ctx=context();
  renderer.drawActors(ctx,{time:30,enemies:[{type:'sword',height:128,x:250,y:368,facing:1,health:42,maxHealth:42,mode:'attack',modeTime:.3,modeDuration:.6,attackKind:'upper'}]});
  const draw=ctx.calls.find(c=>c[0]==='drawImage');
  assert(Math.abs(draw[9]-300)<1e-8);
  assert(Math.abs(draw[8]/draw[4]-draw[9]/draw[5])<1e-10);
  const blast=context();renderer.drawForeground(blast,{explosions:[{x:250,y:350,radius:152,age:.4,life:.72}]});
  const explosion=blast.calls.find(c=>c[0]==='drawImage');
  assert(explosion[8]>300);
  assert(Math.abs(explosion[8]/explosion[4]-explosion[9]/explosion[5])<1e-10);
});

test('world atlas samples every supplied new asset within its real PNG bounds', () => {
  const expected = ['scenery', 'marine1Base', 'marine1Walk', 'marine1Aim', 'marine2Base', 'marine2Walk', 'marine2Attack', 'marine2Upper', 'marine2Swirl', 'bullet', 'bulletAnimation', 'cannonball', 'explosion', 'health', 'achievement'];
  assert.deepEqual(Object.keys(WORLD_SPRITES), expected);
  for (const sprite of Object.values(WORLD_SPRITES)) {
    const bytes = fs.readFileSync(new URL(`../${sprite.src}`, import.meta.url));
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    for (const {rect: [x, y, w, h], pivot, scale} of sprite.frames) {
      assert([x, y, w, h].every(Number.isInteger));
      assert(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height, sprite.src);
      assert.equal(pivot.length, 2);
      assert(pivot.every(Number.isFinite));
      assert(scale > 0 && Number.isFinite(scale));
    }
  }
  assert.deepEqual(ACHIEVEMENT_LAYOUT.imageSize, [2172, 724]);
});

test('bullets cycle through the three supplied flames without changing body scale or trajectory', () => {
  const renderer = createWorldRenderer(images), seen = new Set();
  for (const age of [0,.08,.16,.23]) {
    const ctx = context(); renderer.drawActors(ctx,{projectiles:[{kind:'bullet',x:180,y:290,vx:200,vy:-50,age}]});
    const draw = ctx.calls.find(call=>call[0]==='drawImage');
    assert.equal(draw[1].key,'bulletAnimation'); seen.add(draw[2]);
    assert(Math.abs(draw[8]/draw[4]-draw[9]/draw[5])<1e-10);
    assert(ctx.calls.some(call=>call[0]==='translate'&&call[1]===180&&call[2]===290));
  }
  assert.equal(seen.size,3);
});

test('scenery covers phone and desktop viewports with one uniform scale and the same stone floor anchor', () => {
  const renderer = createWorldRenderer(images);
  for (const [width, height, floor] of [[320, 440, 368], [390, 440, 368], [960, 440, 368], [1366, 440, 368], [600, 600, 500]]) {
    const ctx = context();
    renderer.drawBackground(ctx, width, height, floor);
    const [, image, sx, sy, sw, sh, dx, dy, dw, dh] = ctx.calls.find(call => call[0] === 'drawImage');
    assert.equal(image.key, 'scenery');
    assert.equal(sx, 0); assert.equal(sy, 0);
    assert(Math.abs(dw / sw - dh / sh) < 1e-10, 'scenery must never stretch');
    assert(dx <= 1e-8 && dy <= 1e-8 && dx + dw >= width - 1e-8 && dy + dh >= height - 1e-8, 'cover leaves no unpainted strips');
    assert(Math.abs(dy + WORLD_REFERENCE.scenery.floorY * dh / sh - floor) < 1e-8, 'feet stay on the same stone plane');
  }
});

test('the upward attack reaches every original vortex frame and recovers through its own windup', () => {
  const renderer = createWorldRenderer(images);
  const seen = new Set();
  for (const modeTime of [.16, .28, .39]) {
    const ctx = context();
    renderer.drawActors(ctx, {time: 70, enemies: [{type: 'sword', x: 300, y: 368, facing: 1, height: 128, mode: 'attack', attackKind: 'upper', modeTime, modeDuration: .42}]});
    const draw = ctx.calls.find(call => call[0] === 'drawImage');
    assert.equal(draw[1].key, 'marine2Swirl');
    seen.add(draw[2]);
    assert(Math.abs(draw[8] / draw[4] - draw[9] / draw[5]) < 1e-10, 'enemy rendering preserves source proportions');
  }
  assert.equal(seen.size, 3);
  const ctx = context();
  renderer.drawActors(ctx, {time: 70, enemies: [{type: 'sword', x: 300, y: 368, height: 128, mode: 'recover', modeTime: .05, attackKind: 'upper'}]});
  assert.equal(ctx.calls.find(call => call[0] === 'drawImage')[1].key, 'marine2Upper');
});

test('the upward warning follows the same vertical column as the enemy attack', () => {
  const ctx = context();
  createWorldRenderer(images).drawActors(ctx, {time: 70, enemies: [{type: 'sword', x: 300, y: 368, facing: 1, height: 128, mode: 'aim', modeTime: .5, modeDuration: .78, attackKind: 'upper'}]});
  assert(ctx.calls.some(call => call[0] === 'moveTo' && call[1] === 305 && call[2] === 304));
  assert(ctx.calls.some(call => call[0] === 'lineTo' && call[1] === 305 && call[2] === 132));
});

test('a cannon warning paints its fixed target without displaying or advancing the live projectile', () => {
  const projectile = {kind: 'cannonball', x: 16, y: 25, targetX: 320, targetY: 303, vx: 180, vy: 90, radius: 14, mode: 'warning', warningDuration: .65, warningRemaining: .3};
  const before = {...projectile};
  const ctx = context();
  createWorldRenderer(images).drawActors(ctx, {width: 960, height: 440, floor: 368, projectiles: [projectile]});
  assert(ctx.calls.some(call => call[0] === 'lineTo' && call[1] === 320 && call[2] === 303));
  assert(!ctx.calls.some(call => call[0] === 'drawImage'));
  assert.deepEqual(projectile, before);
});

test('cannon target brackets remain on the snapshot and contract with a contrasting pixel outline', () => {
  const projectile = {kind: 'cannonball', x: 16, y: 25, targetX: 320, targetY: 303, vx: 180, vy: 90, radius: 14, mode: 'warning', warningDuration: .65, warningRemaining: .6};
  const renderer = createWorldRenderer(images);
  const draw = (shot, player) => {
    const ctx = context();
    renderer.drawActors(ctx, {width: 960, height: 440, floor: 368, player, projectiles: [shot]});
    return ctx.calls.filter(call => call[0] === 'fillRect');
  };
  const original = {...projectile};
  const first = draw(projectile, {x: 320, y: 368});
  const brackets = first.filter(call => call[5] === '#ffe4ab');
  const outline = first.filter(call => call[5] === 'rgba(16, 24, 36, .86)');
  assert.equal(brackets.length, 8);
  assert.equal(outline.length, 8);
  assert(brackets.every(call => call[3] === 2 || call[4] === 2));
  for (let index = 0; index < brackets.length; index += 1) {
    const [, x, y, width, height] = brackets[index];
    assert.deepEqual(outline[index].slice(1, 5), [x - 1, y - 1, width + 2, height + 2]);
  }
  const movedPlayer = draw({...projectile, x: 140, y: 40}, {x: 720, y: 200});
  assert.deepEqual(movedPlayer.filter(call => call[5] === '#ffe4ab'), brackets, 'neither player nor source movement retargets the brackets');
  const bounds = calls => ({
    left: Math.min(...calls.map(call => call[1])), right: Math.max(...calls.map(call => call[1] + call[3])),
    top: Math.min(...calls.map(call => call[2])), bottom: Math.max(...calls.map(call => call[2] + call[4]))
  });
  const initial = bounds(brackets);
  const final = bounds(draw({...projectile, warningRemaining: .05}, {x: 720, y: 200}).filter(call => call[5] === '#ffe4ab'));
  assert(final.right - final.left < initial.right - initial.left);
  assert.equal((final.right + final.left) / 2, projectile.targetX);
  assert.equal((final.bottom + final.top) / 2, projectile.targetY);
  assert.deepEqual(projectile, original);
});
