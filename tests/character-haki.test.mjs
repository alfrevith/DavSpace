import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeGif,gifFrameAt} from '../assets/js/character-gif.js';
import {HAKI_TUNING,hakiSuppresses,hakiEnvelope,drawHakiBack,drawHakiFront} from '../assets/js/character-haki.js';
import {createCharacter} from '../assets/js/character-physics.js';
import {createSurvival,stepSurvival} from '../assets/js/character-survival.js';

const DT=1/120;
function setup(){const game=createSurvival({random:()=>.4});game.phase='playing';game.time=60;game.nextEnemy=game.nextCannon=game.nextPickup=Infinity;return{game,actor:createCharacter({width:960,floor:368})};}
function enemy(game,type,x=300,health=24){const e={id:game.nextId++,type,x,y:368,previousX:x,previousY:368,health,maxHealth:24,height:124,mode:'recover',modeTime:-100,deadTime:.5,vx:0,facing:1,entered:x>0&&x<960,attackCount:0};game.enemies.push(e);return e;}
function run(game,actor,seconds,input={}){const events=[];for(let i=0;i<Math.round(seconds*120);i++){stepSurvival(game,actor,input,DT);events.push(...game.events);}return events;}

test('haki requires a fresh press after the first minute and uses a sixty-second cooldown',()=>{
  const{game,actor}=setup();game.time=59.8;
  run(game,actor,.3,{hakiPressed:true});assert.equal(game.hakiSerial,0,'holding before unlock cannot auto-cast');
  stepSurvival(game,actor,{},DT);stepSurvival(game,actor,{hakiPressed:true},DT);
  assert.equal(game.hakiSerial,1);assert(Math.abs(game.nextHakiAt-game.time-60)<1e-8);
  run(game,actor,30.5);stepSurvival(game,actor,{hakiPressed:true},DT);assert.equal(game.hakiSerial,1,'thirty seconds are no longer sufficient');
  run(game,actor,30,{hakiPressed:true});assert.equal(game.hakiSerial,1,'holding K cannot repeat at cooldown end');
  stepSurvival(game,actor,{},DT);stepSurvival(game,actor,{hakiPressed:true},DT);assert.equal(game.hakiSerial,2);
});

test('haki defeats only living visible marines, preserving projectiles and allowing arrivals after suppression',()=>{
  const{game,actor}=setup();
  const marines=[enemy(game,'rifle',10,999),enemy(game,'sword',950,999),enemy(game,'antiAir',300,999)];
  const outside=enemy(game,'rifle',-100),other=enemy(game,'beast',800),dead=enemy(game,'sword',700,0);dead.mode='dead';
  const shot={id:999,kind:'cannonball',x:30,y:30,vx:0,vy:0,radius:14,damage:22,age:0,life:8,alive:true};game.projectiles.push(shot);
  stepSurvival(game,actor,{hakiPressed:true},DT);
  assert(marines.every(e=>e.health===0&&e.mode==='dead'));assert.equal(outside.health,24);assert.equal(other.health,24);assert(shot.alive);
  assert.equal(game.kills,3);assert.equal(game.charge,45);
  assert.equal(game.events.filter(e=>e.type==='kill'&&e.source==='haki').length,3);
  assert(!game.events.some(e=>e.type==='enemy-hit'),'haki must not trigger punch/kick impact audio');
  const next=enemy(game,'rifle',700);run(game,actor,1);assert.equal(next.health,0);assert.equal(game.kills,4);
  run(game,actor,5.1);const returning=enemy(game,'rifle',700);run(game,actor,1);assert.equal(returning.health,24);assert.equal(game.kills,4);
});

test('haki kills share Gear rewards, healing and the normal capped charge accounting',()=>{
  for(const gear of [false,true]){
    const{game,actor}=setup();game.health=45;if(gear){actor.gearState='gear2';game.gearRemaining=12;}
    for(let i=0;i<8;i++)enemy(game,i%2?'sword':'rifle',60+i*105,999);
    stepSurvival(game,actor,{hakiPressed:true},DT);
    assert.equal(game.kills,8);assert.equal(game.health,gear?100:45);assert.equal(game.charge,gear?0:100);
    assert.equal(game.events.filter(e=>e.type==='gear-ready').length,gear?0:1);
    run(game,actor,.6);assert.equal(game.kills,8);
  }
});

test('effect duration advances through cinematics, freezes on pause, and clears on death/reset',()=>{
  const{game,actor}=setup();game.hakiDuration=.2;stepSurvival(game,actor,{hakiPressed:true},DT);const time=game.time;
  run(game,actor,.1,{cinematic:true});assert(game.haki.age>.09);assert.equal(game.time,time);
  const age=game.haki.age;game.phase='paused';run(game,actor,.5);assert.equal(game.haki.age,age);
  game.phase='playing';run(game,actor,.1,{cinematic:true});assert.equal(game.haki,null);
  game.haki={age:0,duration:1};game.health=0;stepSurvival(game,actor,{},DT);assert.equal(game.haki,null);assert.equal(game.phase,'over');
  const reset=createSurvival();assert.equal(reset.haki,null);assert.equal(reset.nextHakiAt,60);
});

test('the supplied GIF decodes distinct transparent frames and replays according to its own delays',()=>{
  const bytes=fs.readFileSync(new URL('../assets/sprites/haki.gif',import.meta.url));const gif=decodeGif(bytes);
  assert.equal(gif.width,512);assert.equal(gif.height,512);assert(gif.frames.length>1);
  assert(gif.frames.every(f=>f.delay>0&&f.pixels.length===gif.width*gif.height*4));
  const colors=new Set(gif.frames.map(f=>Buffer.from(f.pixels).toString('base64')));assert.equal(colors.size,gif.frames.length);
  assert(gif.frames[0].pixels.some((v,i)=>i%4===3&&v===0));assert(gif.frames[0].pixels.some((v,i)=>i%4===3&&v===255));
  assert.equal(gifFrameAt(gif,0),gif.frames[0]);assert.equal(gifFrameAt(gif,gif.frames[0].delay+.001),gif.frames[1]);
  assert.equal(gifFrameAt(gif,gif.duration+.001),gif.frames[0]);
  assert.throws(()=>decodeGif(bytes.subarray(0,1000)));
});

test('pixel waves have a bounded workload and the aura respects original proportions and reduced motion',()=>{
  const calls=[],ctx={globalAlpha:1,save(){},restore(){},fillRect(...a){calls.push(a);},drawImage(...a){calls.push(a);}};
  for(const [x,y]of[[0,0],[480,296],[960,440]])for(const age of [0,.1,.6,1.2,5,14.6]){
    calls.length=0;drawHakiBack(ctx,{x,y,age,duration:HAKI_TUNING.duration},960,440);
    assert(calls.length<=221);assert(calls.every(a=>a.every(Number.isFinite)));
  }
  assert.equal(hakiEnvelope({age:HAKI_TUNING.duration,duration:HAKI_TUNING.duration}),0);
  calls.length=0;drawHakiBack(ctx,{x:480,y:200,age:1,duration:15},960,440,true);assert.equal(calls.length,0);
  const gif={duration:1,frames:[{image:{name:'first'},start:0},{image:{name:'next'},start:.5}]};
  calls.length=0;drawHakiFront(ctx,{age:.7,duration:15},gif,{x:480,y:368});
  assert.deepEqual(calls[0],[0,0,960,440],'the red filter is drawn in the foreground over the whole arena');
  const aura=calls.find(c=>typeof c[0]==='object');assert.equal(aura[0].name,'next');assert.equal(aura[3],aura[4]);
});

test('marines stop spawning during suppression and return individually while visuals fade before audio ends',()=>{
  const{game,actor}=setup();game.time=300;game.nextEnemy=0;game.invulnerable=1000;
  stepSurvival(game,actor,{hakiPressed:true},DT);run(game,actor,5.9);assert.equal(game.metrics.spawned,0);
  run(game,actor,.2);assert.equal(game.metrics.spawned,1);assert(game.haki);
  assert(!hakiSuppresses(game.haki));assert(hakiEnvelope(game.haki)>0&&hakiEnvelope(game.haki)<1);
  run(game,actor,2);assert.equal(hakiEnvelope(game.haki),0);assert(game.haki.age<game.haki.duration);
  assert(game.enemies.some(e=>e.health>0),'new marines survive while the audio continues');
});

test('the wave follows the current player position rather than its activation point',()=>{
  const calls=[],ctx={save(){},restore(){},fillRect(...a){calls.push(a);}};
  const effect={x:10,y:10,age:.6,duration:15};
  drawHakiBack(ctx,effect,960,440,false,{x:200,y:300});const first=JSON.stringify(calls);
  calls.length=0;drawHakiBack(ctx,effect,960,440,false,{x:700,y:180});assert.notEqual(JSON.stringify(calls),first);
  assert(hakiEnvelope({...effect,age:4})>hakiEnvelope({...effect,age:6}));
  assert(hakiEnvelope({...effect,age:6})>hakiEnvelope({...effect,age:7}));
  assert.equal(hakiEnvelope({...effect,age:8}),0);
  const{game,actor}=setup();stepSurvival(game,actor,{hakiPressed:true},DT);run(game,actor,.2,{axis:1,jumpPressed:true,jumpHeld:true});
  assert.equal(game.haki.x,actor.x);assert.equal(game.haki.y,actor.y-72);
});
