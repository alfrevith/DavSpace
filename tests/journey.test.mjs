import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DOMParser} from 'linkedom';
import journey from '../assets/js/journey.js';
import core from '../assets/js/assistant-core.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const data=JSON.parse(read('data/journey.json'));
const parse=html=>new DOMParser().parseFromString(html,'text/html');
function setup({reduced=false,mobile=false}={}){
  const doc=parse(read(mobile?'index-mobile.html':'index.html'));
  let focused=doc.body,hidden=false,selected='html';
  Object.defineProperty(doc,'activeElement',{get:()=>focused});
  Object.defineProperty(doc,'hidden',{get:()=>hidden});
  doc.defaultView.HTMLElement.prototype.focus=function(){focused=this;};
  doc.defaultView.HTMLElement.prototype.scrollIntoView=function(options){this.scrolled=options;};
  const root=doc.querySelector('#beyond-the-code'),chapters=[...root.querySelectorAll('[data-journey-chapter]')];
  let tops=chapters.map((_,i)=>800+i*900),reads=0;
  chapters.forEach((chapter,i)=>{chapter.getBoundingClientRect=()=>{reads++;return{top:tops[i],bottom:tops[i]+800};};});
  const frames=new Map(),events=new Map(),observers=[];let frameID=0;
  const motion={matches:reduced,addEventListener(type,callback){this.changed=callback;}};
  class Observer{constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}observe(target){this.targets.push(target);}unobserve(target){this.targets=this.targets.filter(item=>item!==target);}}
  const win={innerWidth:mobile?390:1280,innerHeight:800,matchMedia:()=>motion,
    IntersectionObserver:Observer,ResizeObserver:class{observe(){}},
    requestAnimationFrame(callback){frames.set(++frameID,callback);return frameID;},cancelAnimationFrame(id){frames.delete(id);},
    addEventListener(type,callback){if(!events.has(type))events.set(type,[]);events.get(type).push(callback);}
  };
  journey.init(win,doc);
  const dispatch=type=>(events.get(type)||[]).forEach(callback=>callback());
  const flush=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback());};
  const visible=value=>{observers[0].callback([{target:root,isIntersecting:value}]);flush();};
  return {doc,win,root,chapters,frames,motion,observers,dispatch,flush,visible,get reads(){return reads;},setHidden(value){hidden=value;doc.dispatchEvent(new doc.defaultView.Event('visibilitychange'));},scrollTo(index){tops=chapters.map((_,i)=>200+(i-index)*900);dispatch('scroll');flush();}};
}

test('both layouts preserve the timeline with exactly three creative worlds and working static entrances',()=>{
 for(const file of ['index.html','index-mobile.html']){
  const doc=parse(read(file)),root=doc.querySelector('#beyond-the-code');
  assert.equal(root.previousElementSibling.id,'certificates');
  assert.equal(root.nextElementSibling.id,'playground');
  assert.equal(root.nextElementSibling.nextElementSibling.id,'contact');
  assert.equal(root.querySelectorAll('[data-journey-chapter]').length,3);
  assert.equal(root.querySelectorAll('[data-journey-step]').length,3);
  assert(root.textContent.includes(data.subtitle));assert(root.textContent.includes(data.intro));
  data.stations.forEach((station,i)=>{
   const chapter=root.querySelectorAll('[data-journey-chapter]')[i];
   assert(chapter.textContent.includes(station.description));
   assert.equal(chapter.querySelector('.creative-entrance').getAttribute('href'),station.id+'.html');
   assert(fs.existsSync(new URL('../'+station.id+'.html',import.meta.url)));
  });
  assert.equal(root.querySelectorAll('.journey-skills,.journey-notes,[data-journey-project],iframe,canvas,object').length,0);
  assert.equal(doc.querySelectorAll('#project-list [data-project]').length,5);
  assert.equal(new Set([...doc.querySelectorAll('[id]')].map(node=>node.id)).size,doc.querySelectorAll('[id]').length);
  assert(root.querySelector('a[href="'+data.socials.instagram+'"]'));
  assert(root.querySelector('a[href="'+data.socials.vsco+'"]'));
 }
});
test('scroll progress stays finite, bounded and reversible',()=>{
 const rects=[0,100,200].map(top=>({top}));
 assert.deepEqual(journey.positionAt(rects,-1),{active:-1,progress:0});
 assert.equal(journey.positionAt(rects,150).progress,.75);
 assert.equal(journey.positionAt(rects,900).progress,1);
 assert.equal(journey.positionAt([],0).progress,0);
});
test('visible scroll batches a frame, remembers visited worlds and stops offscreen or hidden',()=>{
 const s=setup();assert.equal(s.frames.size,0);assert.equal(s.reads,0);
 s.dispatch('scroll');assert.equal(s.frames.size,0);s.visible(true);s.scrollTo(2);
 assert.equal(s.root.querySelector('[data-journey-current]').textContent,'Exploring Writing');
 assert.equal(s.root.querySelector('[data-journey-position]').textContent,'03 / 03');
 s.scrollTo(0);assert.equal(s.root.querySelector('[data-journey-position]').textContent,'03 / 03');
 assert.equal(s.root.querySelector('[data-journey-current]').textContent,'Exploring Photography');
 for(let i=0;i<100;i++)s.dispatch('scroll');assert.equal(s.frames.size,1);s.flush();
 s.visible(false);const reads=s.reads;s.dispatch('scroll');s.flush();assert.equal(s.reads,reads);
 s.visible(true);s.dispatch('scroll');s.setHidden(true);assert.equal(s.frames.size,0);
 s.setHidden(false);assert.equal(s.frames.size,1);s.flush();
});
test('bridges illuminate only on entering view; mobile and reduced motion do not use parallax',()=>{
 const s=setup(),bridge=s.root.querySelector('.journey-bridge');
 assert(!bridge.classList.contains('is-connected'));
 s.observers[1].callback([{target:bridge,isIntersecting:true}]);assert(bridge.classList.contains('is-connected'));
 for(const options of [{reduced:true},{mobile:true}]){const m=setup(options);m.visible(true);m.scrollTo(1);assert.equal(m.chapters[1].style.getPropertyValue('--journey-parallax'),'0px');}
 s.visible(true);s.scrollTo(1);s.motion.matches=true;s.motion.changed();assert(s.chapters.every(c=>c.style.getPropertyValue('--journey-parallax')==='0px'));
 assert(!read('assets/js/journey.js').includes('setInterval'));
});
test('the creative section stays searchable without repeating software projects',()=>{
 const doc=parse(read('index.html')),source=core.extractDocument(doc).find(source=>source.section==='beyond-the-code');
 assert(source.text.includes('Worlds Made of Words'));assert(!source.text.includes('Microsoft Power Apps'));
});
