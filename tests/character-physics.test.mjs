import test from "node:test";
import assert from "node:assert/strict";
import {createCharacter, stepCharacter, resetCharacter, resizeCharacter, getPose, cancelCharacterCharge} from "../assets/js/character-physics.js";

function advance(state, seconds, input = {}, rate = 120) {
  for (let index = 0; index < Math.round(seconds * rate); index += 1) stepCharacter(state, input, 1 / rate);
  return state;
}

test("movement accelerates, brakes and keeps both directions inside the stage", () => {
  const state = createCharacter({width: 960, floor: 368, margin: 96});
  advance(state, .5, {axis: 1});
  assert.equal(state.vx, 260);
  assert.equal(state.facing, 1);
  assert.equal(state.mode, "running");
  const before = state.x;
  advance(state, .3);
  assert.equal(state.vx, 0);
  assert(state.x > before && state.x - before < 20);
  assert.equal(state.mode, "waiting");
  advance(state, 5, {axis: -1});
  assert.equal(state.x, state.margin);
  assert.equal(state.facing, -1);
  advance(state, 10, {axis: 1});
  assert.equal(state.x, state.width - state.margin);
  assert.equal(state.y, state.floor);
});

test("short taps produce a lower jump, held jump cannot turn into a double jump", () => {
  function flight(release) {
    const state = createCharacter();
    stepCharacter(state, {jumpPressed: true, jumpHeld: true});
    let highest = state.y;
    for (let frame = 0; frame < 140; frame += 1) {
      stepCharacter(state, {jumpPressed: true, jumpHeld: frame / 120 < release}, 1 / 120);
      highest = Math.min(highest, state.y);
      assert(state.y <= state.floor);
    }
    return {state, height: state.floor - highest};
  }
  const tap = flight(.06), held = flight(1);
  assert(held.height > tap.height * 1.6);
  assert.equal(held.state.jumpSerial, 1);
  assert.equal(held.state.landingSerial, 1);
  assert(held.state.grounded);
  assert.equal(held.state.y, held.state.floor);
});

test("jump buffering and coyote allowance preserve responsive jump input", () => {
  const state = createCharacter();
  Object.assign(state, {grounded: false, mode: "jumping", y: state.floor - 3, vy: 200, coyoteTime: 0});
  stepCharacter(state, {jumpPressed: true, jumpHeld: true}, 1 / 60);
  assert.equal(state.jumpSerial, 1, "the buffered press triggers when the feet reach the floor");
  assert(!state.grounded);
  assert(state.vy < 0);
  const coyote = createCharacter();
  Object.assign(coyote, {grounded: false, y: coyote.floor - 1, coyoteTime: .08});
  stepCharacter(coyote, {jumpPressed: true, jumpHeld: true});
  assert.equal(coyote.jumpSerial, 1);
  assert(coyote.vy < -500);
});

test('holding jump progressively raises the arc, with extra Gear 2 height and safe visible peaks at all frame rates', () => {
  for (const rate of [30,60,120]) {
    const flights = gearState => [.025,.1,.25,.7].map(hold => {
      const state=createCharacter({floor:368});state.gearState=gearState;
      for(let tick=0;tick<rate*2;tick++) {
        stepCharacter(state,{jumpPressed:true,jumpHeld:tick/rate<hold},1/rate);
        assert(state.y>=142,'the hat and body stay inside the arena');
        assert(Number.isFinite(getPose(state).progress));
      }
      assert(state.grounded);assert.equal(state.jumpSerial,1);assert.equal(state.landingSerial,1);
      return state.jumpPeak;
    });
    const base=flights('normal'),gear=flights('gear2');
    for(let i=1;i<base.length;i++){assert(base[i]>base[i-1]);assert(gear[i]>gear[i-1]);}
    assert(base[3]>160&&base[3]<180,'the full base jump is taller than the previous ~108-unit jump');
    assert(gear[3]>base[3]*1.2&&gear[3]<225);
    assert(base[0]<base[3]*.4,'a tap retains a controllable low hop');
  }
});

test('pressing jump again after release cannot restore ascent or double jump', () => {
  const released=createCharacter({floor:368}),reheld=createCharacter({floor:368});
  for(const state of [released,reheld]){
    stepCharacter(state,{jumpPressed:true,jumpHeld:true},1/120);
    advance(state,.1,{jumpHeld:true});
    stepCharacter(state,{jumpHeld:false},1/120);
    assert(state.jumpCut);
  }
  advance(released,.2,{jumpHeld:false});
  advance(reheld,.2,{jumpPressed:true,jumpHeld:true});
  assert.equal(reheld.y,released.y);assert.equal(reheld.vy,released.vy);
  assert.equal(reheld.jumpSerial,1);
});

test("the ground punch charges, extends in a locked direction and recovers exactly once", () => {
  const state = createCharacter();
  stepCharacter(state, {axis: -1, attackPressed: true, attackHeld: true}, 1 / 120);
  assert.equal(state.mode, "baseAttack");
  assert.equal(getPose(state).phase, "charge");
  advance(state, .25, {axis: 1, attackPressed: true, attackHeld: true});
  assert.equal(getPose(state).phase, "charge", "holding prepares the punch instead of firing automatically");
  stepCharacter(state, {axis: 1, attackPressed: true, attackHeld: false}, 1 / 120);
  assert.equal(getPose(state).phase, "strike");
  assert.equal(getPose(state).facing, -1);
  assert(state.vx < 0);
  advance(state, .14, {axis: 1, attackPressed: true});
  assert.equal(getPose(state).phase, "recovery");
  advance(state, 1, {attackPressed: true});
  assert.equal(state.mode, "waiting");
  assert.equal(state.attackSerial, 1, "holding an event flag cannot auto-repeat a punch");
  stepCharacter(state, {});
  stepCharacter(state, {attackPressed: true});
  assert.equal(state.attackSerial, 2);
});

test('short clicks recover faster while longer holds increase power and damage', () => {
  const results = [.025, .4, 1.3].map(hold => {
    const state = createCharacter({width: 1800, x: 600});
    stepCharacter(state, {attackPressed: true, attackHeld: true}, 1 / 120);
    advance(state, hold - 1 / 120, {attackHeld: true});
    stepCharacter(state, {attackHeld: false}, 1 / 120);
    for (let index = 0; getPose(state).phase === 'charge' && index < 12; index++) stepCharacter(state, {}, 1 / 120);
    const pose = getPose(state);
    assert.equal(pose.phase, 'strike');
    const recovery = state.strikeDuration + state.recoveryDuration;
    return {power: pose.chargeStrength, damage: pose.attackDamage, recovery};
  });
  assert(results[0].power < .04);
  assert(results[0].power < results[1].power && results[1].power < results[2].power);
  assert(results[0].damage < results[1].damage && results[1].damage < results[2].damage);
  assert(results[0].recovery < results[1].recovery && results[1].recovery < results[2].recovery);
  assert.equal(results[2].power, 1);
  assert.equal(results[2].damage, 59);
});

test('a capped charge waits for release, and canceling cannot unleash a stored punch', () => {
  const state = createCharacter();
  stepCharacter(state, {attackPressed: true, attackHeld: true});
  advance(state, 4, {attackHeld: true});
  assert.equal(getPose(state).phase, 'charge');
  assert.equal(getPose(state).chargeStrength, 1);
  assert.equal(state.attackSerial, 1);
  cancelCharacterCharge(state);
  advance(state, .5);
  assert.equal(state.mode, 'waiting');
  assert.equal(state.attackSerial, 1);
  assert.equal(state.punchPower, 0);
  stepCharacter(state, {attackPressed: true, attackHeld: true});
  stepCharacter(state, {attackHeld: false});
  advance(state, .1);
  assert.equal(getPose(state).phase, 'strike');
  assert.equal(state.attackSerial, 2);
});

test('a fresh click near the end of recovery buffers one fast follow-up', () => {
  const state = createCharacter();
  stepCharacter(state, {attackPressed: true}, 1 / 120);
  advance(state, .26);
  assert.equal(getPose(state).phase, 'recovery');
  stepCharacter(state, {attackPressed: true}, 1 / 120);
  advance(state, .12, {attackPressed: true});
  assert.equal(state.attackSerial, 2);
  advance(state, 1, {attackPressed: true});
  assert.equal(state.attackSerial, 2, 'one buffered click never becomes an automatic chain');
});

test("a charged air kick dives, lands, recovers and cannot retrigger in midair", () => {
  const state = createCharacter({floor: 368});
  stepCharacter(state, {axis: 1, jumpPressed: true, jumpHeld: true});
  advance(state, .19, {axis: 1, jumpHeld: true});
  stepCharacter(state, {attackPressed: true, jumpHeld: true}, 1 / 120);
  assert.equal(state.mode, "jumpAttack");
  assert.equal(getPose(state).phase, "charge");
  advance(state, .18, {axis: -1});
  assert.equal(getPose(state).phase, "dive");
  assert(state.vy >= 850);
  assert.equal(getPose(state).facing, 1);
  stepCharacter(state, {attackPressed: true});
  assert.equal(state.attackSerial, 1);
  let sawLanding = false;
  for (let frame = 0; frame < 100; frame += 1) {
    stepCharacter(state, {}, 1 / 120);
    assert(state.y <= state.floor);
    if (getPose(state).phase === "landing") {
      sawLanding = true;
      assert(state.grounded);
    }
  }
  assert(sawLanding);
  assert(state.grounded);
  assert.equal(state.y, state.floor);
  assert.equal(state.mode, "waiting");
  assert.equal(state.attackSerial, 1);
  assert.equal(state.landingSerial, 1);
});

test("a kick just above the floor cannot freeze or tunnel through it", () => {
  const state = createCharacter();
  Object.assign(state, {grounded: false, mode: "jumping", y: state.floor - .2, vy: 100});
  stepCharacter(state, {attackPressed: true});
  assert.equal(getPose(state).phase, "landing");
  advance(state, .5);
  assert.equal(state.mode, "waiting");
  assert.equal(state.y, state.floor);
  assert.equal(state.vy, 0);
});

test("waiting enters inactivity only after eight quiet seconds and input wakes it immediately", () => {
  const state = createCharacter();
  advance(state, 7.8);
  assert.equal(state.mode, "waiting");
  advance(state, .3);
  assert.equal(state.mode, "inactivity");
  stepCharacter(state, {axis: 1});
  assert.equal(state.mode, "running");
  assert.equal(state.idleTime, 0);
  advance(state, 8.5);
  assert.equal(state.mode, "inactivity");
  stepCharacter(state, {attackPressed: true});
  assert.equal(state.mode, "baseAttack");
});

test("30, 60 and 120 Hz inputs produce the same motion and action outcome", () => {
  const results = [30, 60, 120].map(rate => {
    const state = createCharacter({width: 1600, x: 400});
    advance(state, .4, {axis: 1}, rate);
    stepCharacter(state, {axis: 1, jumpPressed: true, jumpHeld: true}, 1 / rate);
    advance(state, .2 - 1 / rate, {axis: 1, jumpHeld: true}, rate);
    stepCharacter(state, {axis: 1, attackPressed: true}, 1 / rate);
    advance(state, .8 - 1 / rate, {}, rate);
    return state;
  });
  for (const state of results.slice(1)) {
    assert(Math.abs(state.x - results[0].x) < .01);
    assert(Math.abs(state.y - results[0].y) < .01);
    assert.equal(state.mode, results[0].mode);
    assert.equal(state.attackSerial, 1);
    assert.equal(state.landingSerial, 1);
  }
});

test("resizing preserves altitude and safe bounds; restart clears every pending action", () => {
  const state = createCharacter({width: 960, floor: 368});
  stepCharacter(state, {jumpPressed: true, jumpHeld: true});
  advance(state, .2, {jumpHeld: true});
  const altitude = state.floor - state.y;
  resizeCharacter(state, {width: 380, height: 440, floor: 368, margin: 70});
  assert(Math.abs(state.floor - state.y - altitude) < .001);
  assert(state.x >= state.margin && state.x <= state.width - state.margin);
  stepCharacter(state, {attackPressed: true});
  resetCharacter(state);
  assert.equal(state.width, 380);
  assert.equal(state.margin, 70);
  assert.equal(state.mode, "waiting");
  assert.equal(state.attackSerial, 0);
  assert.equal(state.jumpBuffer, 0);
  assert.equal(state.y, state.floor);
});

test("non-finite time and a stale resumed clock cannot teleport the character", () => {
  const state = createCharacter();
  const x = state.x;
  stepCharacter(state, {axis: 1}, NaN);
  stepCharacter(state, {axis: 1}, Infinity);
  stepCharacter(state, {axis: 1}, -1);
  assert.equal(state.x, x);
  stepCharacter(state, {axis: 1}, 30);
  assert(state.x - x < 20);
  for (const value of Object.values(getPose(state))) if (typeof value === "number") assert(Number.isFinite(value));
});
