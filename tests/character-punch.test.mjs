import test from 'node:test';
import assert from 'node:assert/strict';
import {punchExtension, PUNCH_EXTRA_REACH} from '../assets/js/character-punch.js';
import {SPRITES, SPRITE_REFERENCE} from '../assets/js/character-sprites.js';
import {createCharacter,stepCharacter,getPose} from '../assets/js/character-physics.js';

const frame = SPRITES.baseAttack.frames[3];
const scale = 142 / SPRITE_REFERENCE.height * frame.scale;
const pose = (chargeStrength, phase = 'strike', phaseProgress = 1) => ({chargeStrength, phase, phaseProgress});

test('punch reach scales with the held charge and stops at its maximum', () => {
  const reach = strength => punchExtension(pose(strength), 600, 1, 1800, frame, scale);
  assert.equal(reach(0), 0);
  assert.equal(reach(.5), PUNCH_EXTRA_REACH / 2);
  assert.equal(reach(1), PUNCH_EXTRA_REACH);
  assert.equal(reach(10), PUNCH_EXTRA_REACH);
  assert(reach(.9) > reach(.1) * 8);
});

test('the extra charge preserves one-second attacks and extends reach further up to the new cap',()=>{
  const charged=seconds=>{
    const actor=createCharacter({width:1800,x:600});
    for(let i=0;i<Math.round(seconds*120);i++)stepCharacter(actor,{attackPressed:i===0,attackHeld:true},1/120);
    stepCharacter(actor,{attackHeld:false},1/120);
    const pose=getPose(actor);
    return {reach:punchExtension({...pose,phaseProgress:1},actor.x,1,1800,frame,scale),damage:pose.attackDamage,charge:actor.chargeTime};
  };
  const previous=charged(1),full=charged(1.3),held=charged(3);
  assert(previous.reach>=230&&previous.reach<232);assert.equal(previous.damage,48);
  assert.equal(full.reach,300);assert.equal(full.damage,59);
  assert.deepEqual(held,full,'holding past the cap cannot accumulate extra reach or damage');
});

test('the elastic punch extends and retracts continuously in the attack phases', () => {
  const reach = (phase, progress) => punchExtension(pose(1, phase, progress), 600, 1, 1800, frame, scale);
  assert.equal(reach('strike', 0), 0);
  assert.equal(reach('strike', 1), reach('recovery', 0));
  assert.equal(reach('recovery', 1), 0);
  assert(reach('strike', .1) < reach('strike', .3));
  assert(reach('recovery', .1) > reach('recovery', .4));
});

test('both facing directions keep the original fist inside narrow play areas', () => {
  const nativeReach = (frame.rect[2] - frame.pivot[0]) * scale;
  for (const width of [360, 440, 960]) for (const x of [96, width / 2, width - 96]) for (const facing of [-1, 1]) {
    const extra = punchExtension(pose(1), x, facing, width, frame, scale);
    const edge = x + facing * (nativeReach + extra);
    assert(extra >= 0 && extra <= PUNCH_EXTRA_REACH);
    assert(edge >= 12 - .001 && edge <= width - 12 + .001);
  }
});
