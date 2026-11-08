// All effects are small, snapped rectangles. Emitted steam lives in world space;
// it does not stay attached to the actor after emission. No blur or filters.
const snap = value => Math.round(value / 2) * 2;
// Stepped, rounded wisps, with an open curl rather than a solid cross.
const WISPS = [
  [[1, 0, 2], [0, 1, 4], [0, 2, 2], [1, 3, 4], [3, 4, 2]],
  [[2, 0, 2], [1, 1, 4], [0, 2, 3], [1, 3, 2], [2, 4, 2]],
  [[1, 0, 3], [0, 1, 5], [1, 2, 3], [2, 3, 3], [3, 4, 1]]
];

export function createGearEffects({compact = () => false, reduced = () => false} = {}) {
  const steam = [], ghosts = [], waves = [];
  let serial = -1, activated = false, hitSerial = -1;
  let emission = 0, ghostClock = 0, sequence = 0, shakeAge = 1;
  const noise = () => { sequence += 1; return ((sequence * 16807) % 997) / 997; };

  function puff(x, y, burst = false, front = false, moving = false) {
    const limit = reduced() ? 10 : compact() ? 24 : 36;
    if (steam.length >= limit) steam.shift();
    steam.push({x, y, vx: (noise() - .5) * (burst ? 24 : 10), vy: -24 - noise() * 20,
      age: 0, life: moving ? .16 + noise() * .06 : burst ? .24 + noise() * .12 : .34 + noise() * .18,
      shape: Math.floor(noise() * WISPS.length), front, body: !burst, opacity: 1});
  }

  function wave(x, y, impact = false) {
    waves.push({x, y, age: 0, life: impact ? .2 : .34, impact});
    if (waves.length > 5) waves.shift();
  }

  function update(actor, pose, dt) {
    if (actor.gearSerial !== serial) { serial = actor.gearSerial; activated = false; }
    const visual = pose.gear;
    if (visual.state === 'transforming' && visual.progress >= .72 && !activated) {
      activated = true;
      shakeAge = 0;
      wave(actor.x, actor.floor);
      for (let index = 0; index < (reduced() ? 3 : 16); index++) puff(actor.x + (noise() - .5) * 64, actor.y - noise() * 60, true, index % 3 === 0);
    }
    const active = visual.state === 'gear2';
    const moving = Math.abs(actor.vx) > 100;
    const rate = visual.steam * (visual.locked ? 30 : pose.attackActive ? 34 : moving ? 32 : 22) * (reduced() ? .28 : 1);
    emission += dt * rate;
    while (emission >= 1) {
      emission -= 1;
      const legs = visual.state === 'transforming' && visual.progress < .3;
      const side = noise() < .5 ? -1 : 1;
      const front = !legs && noise() < (visual.locked ? .18 : .32);
      const x = actor.x + (front ? side * (4 + noise() * 8) : legs ? side * 19 : moving ? -actor.facing * (8 + noise() * 12) : side * (14 + noise() * 12));
      const y = actor.y - (legs ? 4 : front ? 48 + noise() * 26 : 48 + noise() * 40);
      puff(x, y, false, front, moving);
    }
    if (active && pose.attackActive && hitSerial !== actor.attackSerial) {
      hitSerial = actor.attackSerial;
      const end = actor.hitboxes?.[0]?.end || {x: actor.x + pose.facing * 50, y: actor.y - 60};
      wave(end.x, end.y, true);
      for (let index = 0; index < (reduced() ? 2 : 7); index++) puff(end.x + (noise() - .5) * 16, end.y, true, true);
    }
    ghostClock += dt;
    if (active && actor.mode === 'running' && moving && !reduced() && ghostClock >= .06) {
      ghostClock = 0;
      ghosts.push({x: snap(actor.x), y: snap(actor.y), facing: actor.facing,
        index: [0, 1, 2, 1][Math.floor(actor.runTime * 11) % 4], age: 0, life: .1});
      if (ghosts.length > 2) ghosts.shift();
    }
    for (let index = steam.length - 1; index >= 0; index--) {
      const p = steam[index];
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      // World-space puffs fade close to the body, even when suddenly sprinting
      // away from an idle cloud. Impact puffs belong to the distant fist/foot.
      if (p.body) p.opacity = Math.max(0, Math.min(1, (64 - Math.abs(p.x - actor.x)) / 24, (112 - Math.abs(p.y - actor.y)) / 24));
      if (p.age >= p.life || p.opacity <= 0) steam.splice(index, 1);
    }
    for (const list of [ghosts, waves]) for (let index = list.length - 1; index >= 0; index--) {
      list[index].age += dt;
      if (list[index].age >= list[index].life) list.splice(index, 1);
    }
    shakeAge += dt;
  }

  function drawSteam(context, front) {
    context.save();
    for (const p of steam) {
      if (p.front !== front) continue;
      const q = p.age / p.life;
      const cell = q > .55 ? 3 : 2;
      const x = snap(p.x) - cell * 2, y = snap(p.y) - cell * 2;
      context.globalAlpha = Math.sin(Math.PI * q) * (p.front && p.body ? .46 : .62) * p.opacity;
      context.fillStyle = '#d0dae4';
      for (const [column, row, width] of WISPS[p.shape]) context.fillRect(x + column * cell, y + row * cell + 2, width * cell, cell);
      context.fillStyle = '#f4f7fb';
      for (const [column, row, width] of WISPS[p.shape]) context.fillRect(x + column * cell, y + row * cell, width * cell, cell);
      context.fillStyle = '#ffffff';
      const [column, row] = WISPS[p.shape][0];
      context.fillRect(x + column * cell, y + row * cell, cell * 2, cell);
    }
    context.restore();
  }

  function drawBack(context, drawGhost) {
    context.save();
    for (const ghost of ghosts) {
      context.globalAlpha = (1 - ghost.age / ghost.life) * .09;
      drawGhost(ghost);
    }
    context.restore();
    drawSteam(context, false);
    context.save();
    context.fillStyle = '#f3f6ff';
    for (const ring of waves) {
      const q = ring.age / ring.life;
      const radius = (ring.impact ? 8 : 24) + q * (ring.impact ? 24 : 83);
      context.globalAlpha = (1 - q) * (ring.impact ? .4 : .5);
      for (let point = 0; point < 40; point++) {
        const angle = point / 40 * Math.PI * 2;
        context.fillRect(snap(ring.x + Math.cos(angle) * radius), snap(ring.y + Math.sin(angle) * radius * (ring.impact ? .6 : .18)), 3, 2);
      }
    }
    context.restore();
  }

  function camera() {
    if (reduced() || shakeAge >= .175) return {x: 0, y: 0};
    const [x, y] = [[2, 0], [-2, 1], [1, -1], [-1, 0], [0, 0]][Math.min(4, Math.floor(shakeAge / .035))];
    return {x, y};
  }

  function reset() {
    steam.length = ghosts.length = waves.length = 0;
    emission = ghostClock = sequence = 0;
    serial = hitSerial = -1;
    activated = false;
    shakeAge = 1;
  }
  return {update, camera, drawBack, drawFront: context => drawSteam(context, true), reset,
    counts: () => ({steam: steam.length, ghosts: ghosts.length, waves: waves.length})};
}
