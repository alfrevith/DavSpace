import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from 'linkedom';
import {ARENA, fitArena, createGameDisplay} from '../assets/js/character-display.js';
import {characterPlaygroundMarkup} from '../scripts/character-playground-template.mjs';

function setup({mobile=false,native=true,portrait=false,lock=false}={}) {
  const doc=new DOMParser().parseFromString(`<html><body><main>${characterPlaygroundMarkup()}</main><aside></aside></body></html>`,'text/html');
  const root=doc.querySelector('[data-character-playground]'),parent=root.parentElement;
  const win=new EventTarget(),orientation={unlocks:0,async lock(value){assert.equal(value,'landscape');if(!lock)throw Error('unsupported');win.innerWidth=844;win.innerHeight=390;},unlock(){this.unlocks++;}};
  const media=new EventTarget();media.matches=mobile;
  Object.assign(win,{innerWidth:portrait?390:844,innerHeight:portrait?844:390,screen:{width:390,height:844,orientation},scrollX:0,scrollY:200,
    matchMedia:()=>media,queueMicrotask,scrollTo({left,top}){this.scrollX=left;this.scrollY=top;}});
  Object.defineProperty(doc,'defaultView',{value:win});
  if(native)root.requestFullscreen=async()=>{doc.fullscreenElement=root;doc.dispatchEvent(new winEvent('fullscreenchange'));};
  doc.exitFullscreen=async()=>{doc.fullscreenElement=null;doc.dispatchEvent(new winEvent('fullscreenchange'));};
  const calls={blocked:0,exits:0,continues:0};
  const display=createGameDisplay(root,{onBlock(){calls.blocked++;},onExit(){calls.exits++;},onContinue(){calls.continues++;}});
  return{doc,root,parent,win,display,calls};
}
// linkedom events belong to its own DOM, rather than the Node Event class.
const winEvent = new DOMParser().parseFromString('<html/>','text/html').defaultView.Event;

test('one fixed world fits desktop and phone viewports without stretching or exposing extra space',()=>{
  for(const [w,h]of[[1366,600],[844,250],[568,160],[2000,800],[0,0]]){
    const fitted=fitArena(w,h);assert(fitted.width<=w+1e-8&&fitted.height<=h+1e-8);
    if(h&&w)assert(Math.abs(fitted.width/fitted.height-ARENA.width/ARENA.height)<1e-10);
  }
  assert.deepEqual(ARENA,{width:960,height:440,floor:368});
});

test('desktop fullscreen stays optional and exits restore placement, scrolling and background input',async()=>{
  const s=setup();assert(s.display.canPlay());assert(!s.display.immersive);
  await s.display.enter();assert(s.display.immersive);assert.equal(s.root.parentElement,s.doc.body);
  assert(s.parent.inert);assert.equal(s.doc.fullscreenElement,s.root);
  await s.display.exit();assert(!s.display.immersive);assert.equal(s.root.parentElement,s.parent);
  assert(!s.parent.inert);assert.equal(s.win.scrollY,200);assert.equal(s.calls.exits,1);
});

test('a phone that cannot lock orientation stays gated until landscape and an explicit continuation',async()=>{
  const s=setup({mobile:true,native:false,portrait:true});assert(!s.display.canPlay());
  assert.equal(await s.display.enter(),false);s.display.block();
  const gate=s.root.querySelector('[data-game-orientation]'),button=s.root.querySelector('[data-game-continue]');
  assert(!gate.hidden);assert(button.hidden);assert(s.root.querySelector('.game-shell').inert);
  s.win.innerWidth=844;s.win.innerHeight=390;s.win.dispatchEvent(new Event('resize'));
  assert(s.display.canPlay());assert(!button.hidden);assert(!gate.hidden,'rotation alone never resumes');
  button.click();assert.equal(s.calls.continues,1);s.display.dismiss();assert(gate.hidden);
  assert(!s.root.querySelector('.game-shell').inert);
  s.win.innerWidth=390;s.win.innerHeight=844;s.win.dispatchEvent(new Event('resize'));
  assert(!gate.hidden);assert(s.calls.blocked>0);await s.display.exit();assert(gate.hidden);
});

test('native fullscreen requests a landscape lock and a browser exit pauses through the callback',async()=>{
  const s=setup({mobile:true,portrait:true,lock:true});assert(await s.display.enter());
  assert.equal(s.win.innerWidth,844);assert(s.display.canPlay());
  await s.doc.exitFullscreen();assert(!s.display.immersive);assert.equal(s.calls.exits,1);
  assert.equal(s.root.parentElement,s.parent);
});

test('a denied fullscreen request still provides a reversible viewport-filling game',async()=>{
  const s=setup();s.root.requestFullscreen=async()=>{throw Error('denied');};
  assert(await s.display.enter());assert(s.display.immersive);
  await s.display.exit();assert.equal(s.calls.exits,1);assert(!s.doc.documentElement.classList.contains('game-view-open'));
});

test('leaving during an outstanding fullscreen request cannot reopen the game afterward',async()=>{
  const s=setup();let complete;
  s.root.requestFullscreen=()=>new Promise(resolve=>{complete=()=>{s.doc.fullscreenElement=s.root;resolve();};});
  const entering=s.display.enter();await s.display.exit();complete();
  assert.equal(await entering,false);assert(!s.display.immersive);
  assert.equal(s.doc.fullscreenElement,null);assert.equal(s.root.parentElement,s.parent);
  assert.equal(s.calls.exits,1);assert(!s.parent.inert);
});

test('a pending orientation lock never blocks Continue and is not requested again on resume',async()=>{
  const s=setup({mobile:true,portrait:true});let locks=0,requests=0;
  s.win.screen.orientation.lock=()=>{locks++;return new Promise(()=>{});};
  const nativeRequest=s.root.requestFullscreen;s.root.requestFullscreen=()=>{requests++;return nativeRequest();};
  // enter must settle while the platform lock is still pending.
  assert.equal(await s.display.enter(),false);s.display.block();
  s.win.innerWidth=844;s.win.innerHeight=390;s.win.dispatchEvent(new Event('resize'));
  s.root.querySelector('[data-game-continue]').click();assert.equal(s.calls.continues,1);
  assert(await s.display.enter());assert.equal(locks,1);assert.equal(requests,1);
  s.display.dismiss();assert(s.root.querySelector('[data-game-orientation]').hidden);
  await s.display.exit();
});
