import test from 'node:test';
import assert from 'node:assert/strict';
import {movementDirection} from '../assets/js/character-touch.js';

const left={left:8,right:62,top:320,bottom:380,width:54,height:60};
const right={left:68,right:122,top:320,bottom:380,width:54,height:60};

test('the movement pad switches sides continuously through the gap between buttons',()=>{
  for(const x of [8,35,62,64])assert.equal(movementDirection(x,350,left,right),'left');
  for(const x of [65,67,68,95,122])assert.equal(movementDirection(x,350,left,right),'right');
});
test('the movement pad tolerates finger drift but releases outside its bounds',()=>{
  assert.equal(movementDirection(4,310,left,right),'left');
  assert.equal(movementDirection(128,390,left,right),'right');
  for(const [x,y]of[[35,300],[35,400],[-20,350],[150,350]])assert.equal(movementDirection(x,y,left,right),null);
  assert.equal(movementDirection(95,350,left,right),'right','the same finger can return to the pad');
});
test('hidden or unmeasurable controls cannot create movement',()=>{
  assert.equal(movementDirection(35,350,{...left,width:0},right),null);
  assert.equal(movementDirection(95,350,left,{...right,height:0}),null);
});
