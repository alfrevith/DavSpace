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
  const root=doc.querySelector('#journey'),chapters=[...root.querySelectorAll('[data-journey-chapter]')];
  let tops=chapters.map((_,i)=>800+i*900),reads=0;
  chapters.forEach((chapter,i)=>{chapter.getBoundingClientRect=()=>{reads++;return{top:tops[i],bottom:tops[i]+800};};});
  const map=root.querySelector('dialog');
  Object.defineProperty(map,'open',{get:()=>map.hasAttribute('open')});
  map.showModal=()=>map.setAttribute('open','');
  map.close=()=>{map.removeAttribute('open');map.dispatchEvent(new doc.defaultView.Event('close'));};
  map.getBoundingClientRect=()=>({left:50,right:850,top:50,bottom:700});
  const select=root.querySelector('select');
  Object.defineProperty(select,'value',{get:()=>selected,set:value=>{selected=value;}});
  Object.defineProperty(select,'selectedIndex',{get:()=>[...select.options].findIndex(option=>option.value===selected)});
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
  return {doc,win,root,chapters,map,select,frames,motion,observers,dispatch,flush,visible,get reads(){return reads;},setHidden(value){hidden=value;doc.dispatchEvent(new doc.defaultView.Event('visibilitychange'));},scrollTo(index){tops=chapters.map((_,i)=>200+(i-index)*900);dispatch('scroll');flush();}};
}
test('both layouts contain the complete ordered story, original evidence, native notes and an open future',()=>{
  for(const file of ['index.html','index-mobile.html']){
    const doc=parse(read(file)),root=doc.querySelector('#journey');
    assert.equal(root.previousElementSibling.id,'certificates');assert.equal(root.nextElementSibling.id,'contact');
    assert.equal(root.querySelectorAll('[data-journey-chapter]').length,7);
    assert.equal(root.querySelectorAll('.journey-notes').length,6);
    assert(root.textContent.includes(data.intro));
    const chapters=[...root.querySelectorAll('[data-journey-key]')];
    assert.deepEqual(chapters.map(chapter=>chapter.dataset.journeyKey),data.chapters.map(chapter=>chapter.key));
    data.chapters.forEach((chapter,i)=>{
      for(const paragraph of chapter.story)assert(chapters[i].textContent.includes(paragraph));
      assert(chapters[i].textContent.includes(chapter.lesson));
      const image=chapters[i].querySelector('img');assert.equal(image.loading||image.getAttribute('loading'),'lazy');
      assert(fs.existsSync(new URL('../'+image.getAttribute('src'),import.meta.url)));
    });
    assert(root.querySelector('#journey-future').textContent.includes(data.future.closing));
    assert.equal(root.querySelectorAll('iframe,canvas,object').length,0);
    assert.equal(doc.querySelectorAll('#project-list [data-project]').length,5);
    assert.equal(new Set([...doc.querySelectorAll('[id]')].map(node=>node.id)).size,doc.querySelectorAll('[id]').length);
  }
});
test('the authored skill graph links actual chapters without skill percentages',()=>{
  const records=data.chapters.map(c=>({title:c.title,year:c.year,skills:[...c.skills.map(s=>s.id),...c.applied]}));
  assert.deepEqual(journey.skillConnections(records,'html').map(c=>c.title),['CECAM','POT-C','Plant Bud','Beyond','My Portfolio']);
  assert.deepEqual(journey.skillConnections(records,'figma-prototyping').map(c=>c.title),["Pet's Health"]);
  assert.deepEqual(journey.skillConnections(records,'unknown'),[]);
  assert(!read('assets/js/journey.js').includes('setInterval'));
});
test('scroll progress stays finite, bounded and reversible at all chapter boundaries',()=>{
  const rects=[0,100,200,300,400,500,600].map(top=>({top}));
  assert.deepEqual(journey.positionAt(rects,-1),{active:-1,progress:0});
  assert.equal(journey.positionAt(rects,150).active,1);
  assert.equal(journey.positionAt(rects,150).progress,.25);
  assert.equal(journey.positionAt(rects,900).progress,1);
  assert.equal(journey.positionAt([{top:0},{top:0}],0).progress,1);
  assert.equal(journey.positionAt([],0).progress,0);
});
test('visible scroll batches one frame, keeps encountered skills and stops work offscreen or hidden',()=>{
  const s=setup();assert.equal(s.frames.size,0);assert.equal(s.reads,0);
  s.dispatch('scroll');assert.equal(s.frames.size,0);
  s.visible(true);s.scrollTo(3);
  const count=Number(s.root.querySelector('[data-journey-count]').textContent);
  assert(count>10);assert.equal(s.root.querySelector('[data-journey-position]').textContent,'04 / 06');
  s.scrollTo(0);assert.equal(Number(s.root.querySelector('[data-journey-count]').textContent),count);
  for(let i=0;i<100;i++)s.dispatch('scroll');assert.equal(s.frames.size,1);s.flush();assert.equal(s.frames.size,0);
  s.visible(false);const reads=s.reads;s.dispatch('scroll');s.flush();assert.equal(s.reads,reads);
  s.visible(true);s.dispatch('scroll');s.setHidden(true);assert.equal(s.frames.size,0);
  s.setHidden(false);assert.equal(s.frames.size,1);s.flush();
});
test('skill selection explains first use, map jumps close cleanly and Escape-style closing restores focus',()=>{
  const s=setup(),button=s.root.querySelector('[data-journey-skill="application-logic"]');
  button.click();assert(s.map.open);assert.equal(s.doc.activeElement,s.select);
  assert.match(s.root.querySelector('[data-journey-map-summary]').textContent,/Pet's Health.*Plant Bud, Beyond and My Portfolio/);
  assert(s.doc.documentElement.classList.contains('journey-map-open'));
  s.map.close();assert.equal(s.doc.activeElement,button);assert(!s.doc.documentElement.classList.contains('journey-map-open'));
  s.root.querySelector('[data-journey-map-open]').click();
  s.root.querySelector('[data-journey-map-chapter="2"]').click();
  assert(!s.map.open);assert.equal(s.doc.activeElement,s.chapters[2].querySelector('h3'));
  assert.equal(s.chapters[2].scrolled.block,'start');
});
test('skill reveals and illuminated bridges start when those parts enter view, not at chapter entry',()=>{
  const s=setup(),skills=s.root.querySelector('.journey-skills'),bridge=s.root.querySelector('.journey-bridge');
  s.visible(true);s.scrollTo(0);assert(s.chapters[0].classList.contains('is-seen'));
  assert(!skills.classList.contains('is-unlocked'));assert(!bridge.classList.contains('is-connected'));
  s.observers[1].callback([{target:skills,isIntersecting:true},{target:bridge,isIntersecting:true}]);
  assert(skills.classList.contains('is-unlocked'));assert(bridge.classList.contains('is-connected'));
  assert(!s.observers[1].targets.includes(skills));assert(!s.observers[1].targets.includes(bridge));
});
test('mobile and reduced motion never apply parallax, including an in-session preference change',()=>{
  for(const options of [{reduced:true},{mobile:true}]){
    const s=setup(options);s.visible(true);s.scrollTo(1);
    assert.equal(s.chapters[1].style.getPropertyValue('--journey-parallax'),'0px');
  }
  const s=setup();s.visible(true);s.scrollTo(1);s.motion.matches=true;s.motion.changed();
  assert(s.chapters.every(c=>c.style.getPropertyValue('--journey-parallax')==='0px'));
});
test('chapter project links reuse the existing controller and the story is searchable by the chat',()=>{
  const s=setup();let opened;
  s.win.PortfolioProjects={open(key,options){opened={key,options};return true;}};
  const link=s.root.querySelector('[data-journey-project="pot-c"]');link.click();
  assert.equal(opened.key,'pot-c');assert.equal(opened.options.returnFocus,link);
  const source=core.extractDocument(s.doc).find(source=>source.section==='journey');
  assert(source.text.includes('Roots of Legacy'));assert(source.text.includes('Microsoft Power Apps'));
  assert(!source.text.includes('Other parts of the journey'));
});
