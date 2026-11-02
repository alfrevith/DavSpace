import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DOMParser} from 'linkedom';
import core from '../assets/js/creative-core.js';
import gallery from '../assets/js/creative-gallery.js';
import writing from '../assets/js/creative-writing.js';
import passage from '../assets/js/creative-passage.js';
import transitions from '../assets/js/creative-transitions.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const base=new URL('https://example.test/DavSpace/');
const images=[{id:'one',title:'First frame',image:'assets/photography/one.jpg',thumbnail:'assets/photography/thumb.webp',order:0},{id:'two',title:'Second frame',image:'assets/photography/two.png',order:1}];
const works=[{id:'verse',title:'Test poem',type:'poetry',pdf:'pdfs/Beyond.pdf'},{id:'narrative',title:'Test story',type:'story',pdf:'pdfs/POT-C.pdf'}];
function setup(kind,data,{failed=false,blockedStorage=false}={}) {
 const doc=new DOMParser().parseFromString(read(kind+'.html'),'text/html');
 doc.querySelectorAll('script[src]').forEach(script=>{script.src=new URL(script.getAttribute('src'),base).href;});
 const dialog=doc.querySelector('dialog');let active=doc.body;
 Object.defineProperty(doc,'activeElement',{get:()=>active});doc.defaultView.HTMLElement.prototype.focus=function(){active=this;};
 Object.defineProperty(dialog,'open',{get:()=>dialog.hasAttribute('open')});
 dialog.showModal=()=>dialog.setAttribute('open','');
 dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new doc.defaultView.Event('close'));};
 const storage=new Map(),calls=[],requests=[],events={};let destroyed=0;
 const win={document:doc,scrollY:0,scrollTo(){},addEventListener(type,fn){events[type]=fn;},matchMedia:()=>({matches:false}),
  fetch:async url=>{requests.push(url.href);return {ok:!failed,json:async()=>data};},
  ProjectPDFViewer:{create(options){calls.push(options);return {page:1,goTo(value){this.page=value;},destroy(){destroyed++;}};}}
 };
 Object.defineProperty(win,'localStorage',{get(){if(blockedStorage)throw Error('Unavailable');return {getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};}});
 const event=(target,type,props)=>{const e=new doc.defaultView.Event(type,{bubbles:true,cancelable:true});Object.assign(e,props);target.dispatchEvent(e);return e;};
 return {doc,win,dialog,storage,calls,requests,event,events,get destroyed(){return destroyed;}};
}
test('creative manifests reference real assets; all room pages are direct, responsive and distinct',()=>{
 for(const kind of ['photography','drawings','writing']){
  const data=JSON.parse(read('data/'+kind+'.json')),entries=data.images||data.works;
  assert.equal(core.records(data,kind,base).length,entries.length);
  for(const entry of entries){
   for(const file of [entry.image||entry.pdf,entry.thumbnail||entry.cover].filter(Boolean))assert(fs.existsSync(new URL('../'+file,import.meta.url)));
   if(entry.image){assert(entry.width>0&&entry.height>0);assert(Math.max(entry.previewWidth,entry.previewHeight)<=1100);assert(Math.abs(entry.previewWidth-entry.width*entry.previewHeight/entry.height)<2);}
  }
  if(kind!=='writing')assert.equal(entries.length,fs.readdirSync(new URL('../images/'+(kind==='photography'?'photos':'draws')+'/',import.meta.url)).filter(name=>/\.(jpe?g|png)$/i.test(name)).length);
  const html=read(kind+'.html'),doc=new DOMParser().parseFromString(html,'text/html');
  assert(doc.querySelector('meta[name="viewport"]'));assert.equal(doc.querySelectorAll('h1').length,1);
  assert.equal(doc.querySelector('.portfolio-return').getAttribute('href'),'index.html#beyond-the-code');
  assert(!doc.querySelector('script[src*="device-router"]'));assert(!doc.querySelector('iframe,canvas,object'));
  assert(doc.body.classList.contains('world-'+kind));
 }
 const config=JSON.parse(read('data/journey.json'));
 for(const kind of ['photography','drawings'])for(const key of kind==='photography'?['instagram','vsco']:['instagram'])assert(read(kind+'.html').includes(config.socials[key]));
 assert(read('assets/css/creative-worlds.css').includes('prefers-reduced-motion:reduce'));
});
test('paths stay inside a project deployment; invalid content and duplicates are excluded, order is stable',()=>{
 assert.equal(core.asset('assets/test.avif',base,core.imagePath).href,base+'assets/test.avif');
 for(const path of ['../escape.jpg','/test.jpg','https://remote.test/a.jpg','javascript:alert(1)','file.pdf'])assert.equal(core.asset(path,base,core.imagePath),null);
 const records=core.records({images:[...images,{...images[0]}, {id:'invalid',title:'Bad',image:'../bad.png'}]},'photography',base);
 assert.equal(records.length,2);assert.equal(records[0].preview,base+'assets/photography/thumb.webp');assert.equal(records[1].preview,null);
 assert.equal(core.records({works:[...works,{id:'bad',title:'HTML is not a work',type:'story',pdf:'work.html'}]},'writing',base).length,2);
});
test('film modes preserve the selection; thumbnails never preload originals; lightbox handles errors, zoom, cleanup and focus',async()=>{
 const s=setup('photography',{images});const state=await gallery.init(s.win,s.doc,core),$=sel=>s.doc.querySelector(sel);
 $('[data-mode="strip"]').click();
 assert.equal(s.requests.length,1);assert.equal($('[data-strip]').hidden,false);assert.equal($('[data-empty]').hidden,true);
 assert.equal($('[data-selected-image] img').src,base+'assets/photography/thumb.webp');
 assert.equal($('[data-art-paper]').children.length,0);
 $('[data-next]').click();assert.equal(state.selected,1);assert(!$('[data-selected-image] img'));
 $('[data-mode="sheet"]').click();assert.equal(state.mode,'sheet');assert.equal(state.selected,1);assert.equal($('[data-sheet]').hidden,false);
 const opener=$('[data-sheet-index="1"]');opener.click();assert(s.dialog.open);assert.equal($('[data-art-original]').href,base+'assets/photography/two.png');
 $('[data-art-zoom]').click();assert($('.art-stage').classList.contains('is-zoomed'));
 // Intercept image construction on the next navigation to drive native events.
 const create=s.doc.createElement.bind(s.doc);let image;
 s.doc.createElement=tag=>{const element=create(tag);if(tag==='img')image=element;return element;};
 $('[data-art-prev]').click();image.dispatchEvent(new s.doc.defaultView.Event('error'));assert.match($('[data-art-status]').textContent,/could not load/);
 $('[data-art-next]').click();const late=image;image.dispatchEvent(new s.doc.defaultView.Event('load'));assert.equal($('[data-art-paper] img'),image);
 $('[data-close]').click();assert(!s.dialog.open);assert.equal(s.doc.activeElement,opener);assert(!late.hasAttribute('src'));assert.equal($('[data-art-paper]').children.length,0);
 late.dispatchEvent(new s.doc.defaultView.Event('load'));assert.equal($('[data-art-paper]').children.length,0);
 $('[data-mode="strip"]').click();assert.equal(state.selected,1);
});

test('photography opens as an exhibition and featured prints use the existing viewer',async()=>{
 const s=setup('photography',{images});const state=await gallery.init(s.win,s.doc,core);
 assert.equal(state.mode,'sheet');assert.equal(s.doc.querySelector('[data-sheet]').hidden,false);
 const opener=s.doc.querySelector('[data-feature-index]');opener.dataset.featureIndex='1';opener.click();
 assert.equal(state.selected,1);assert(s.dialog.open);
 s.doc.querySelector('[data-close]').click();assert.equal(s.doc.activeElement,opener);
 s.doc.querySelector('[data-mode="strip"]').click();assert.equal(state.selected,1);
});
test('sketchbook navigation wraps, keyboard and swipes work without hijacking vertical scroll',async()=>{
 const s=setup('drawings',{images});const state=await gallery.init(s.win,s.doc,core),strip=s.doc.querySelector('[data-strip]'),button=s.doc.querySelector('[data-open]');
 s.doc.querySelector('[data-prev]').click();assert.equal(state.selected,1);
 s.event(button,'keydown',{key:'ArrowRight'});assert.equal(state.selected,0);
 s.event(strip,'touchstart',{touches:[{clientX:200,clientY:100}]});s.event(strip,'touchend',{changedTouches:[{clientX:100,clientY:110}]});assert.equal(state.selected,1);
 s.event(strip,'touchstart',{touches:[{clientX:200,clientY:100}]});s.event(strip,'touchend',{changedTouches:[{clientX:190,clientY:250}]});assert.equal(state.selected,1);
});
test('empty image collections and failed manifest requests remain understandable without broken artwork',async()=>{
 const s=setup('photography',{images:[]});await gallery.init(s.win,s.doc,core);assert.equal(s.doc.querySelector('[data-empty]').hidden,false);assert.equal(s.doc.querySelector('[data-strip]').hidden,true);assert.equal(s.doc.querySelector('[data-sheet]').children.length,0);
 const f=setup('drawings',{}, {failed:true});await gallery.init(f.win,f.doc,core);assert.match(f.doc.querySelector('[data-status]').textContent,/could not load/);assert.equal(f.doc.querySelectorAll('img').length,0);
});
test('writing tabs support keyboards, load only selected PDFs, restore progress, release readers and link originals',async()=>{
 const s=setup('writing',{works});s.storage.set('davspace:reading:narrative','3');const state=await writing.init(s.win,s.doc,core),$=sel=>s.doc.querySelector(sel);
 assert.equal(s.calls.length,0);assert.equal($('[data-library]').children.length,1);
 s.event($('#tab-poetry'),'keydown',{key:'ArrowRight'});assert.equal(state.category,'story');assert.equal(s.doc.activeElement,$('#tab-story'));assert.equal($('#tab-poetry').tabIndex,-1);
 const opener=$('.literary-book');opener.click();assert(s.dialog.open);assert.equal(s.calls.length,1);assert.equal(s.calls[0].initialPage,3);assert.match($('[data-resume-note]').textContent,/page 3/);
 assert.equal($('[data-original]').href,base+'pdfs/POT-C.pdf');assert.equal($('[data-download]').getAttribute('download'),'POT-C.pdf');
 s.calls[0].onPageChange(4);assert.equal(s.storage.get('davspace:reading:narrative'),'4');
 $('[data-close]').click();assert.equal(s.destroyed,1);assert.equal(s.doc.activeElement,opener);assert(!s.dialog.open);
 opener.click();assert.equal(s.calls[1].initialPage,4);s.events.pagehide();assert.equal(s.destroyed,2);
});
test('writing empty categories, storage denial and unavailable manifests degrade gracefully',async()=>{
 const s=setup('writing',{works:[]},{blockedStorage:true});await writing.init(s.win,s.doc,core);
 s.doc.querySelector('#tab-story').click();assert.equal(s.doc.querySelector('[data-empty]').hidden,false);assert.match(s.doc.querySelector('[data-empty-title]').textContent,/story/);
 const f=setup('writing',{}, {failed:true});await writing.init(f.win,f.doc,core);assert.match(f.doc.querySelector('[data-status]').textContent,/could not load/);
 assert.equal(core.storedPage({getItem(){throw Error('denied');}},'one'),1);
});
test('entrance transitions preserve modified clicks, reduced motion and browser-back cleanup',()=>{
 const document=new DOMParser().parseFromString(read('index.html'),'text/html');
 const events={},timers=new Map(),destinations=[];let reduced=false;
 const Observer=class{observe(){}unobserve(){}};
 const memory=new Map();document.documentElement.animate=()=>{};
 document.querySelector('script[src$="creative-transitions.js"]').src=new URL('assets/js/creative-transitions.js',base).href;
 const window={CreativePassage:passage,IntersectionObserver:Observer,addEventListener:(type,fn)=>{events[type]=fn;},
  matchMedia:()=>({get matches(){return reduced;}}),location:{href:base+'index.html',pathname:'/DavSpace/index.html',assign:url=>destinations.push(url)},
  sessionStorage:{getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)},
  setTimeout:fn=>{timers.set(1,fn);return 1;},clearTimeout:id=>timers.delete(id)};
 transitions.init(window,document);
 const link=document.querySelector('.entrance-photography');
 function click(props={}){const event=new document.defaultView.Event('click',{bubbles:true,cancelable:true});Object.assign(event,{button:0},props);link.dispatchEvent(event);return event;}
 assert.equal(click({ctrlKey:true}).defaultPrevented,false);reduced=true;assert.equal(click().defaultPrevented,false);reduced=false;
 for(const modifier of ['metaKey','shiftKey','altKey'])assert.equal(click({[modifier]:true}).defaultPrevented,false);
 assert.equal(click().defaultPrevented,true);assert(document.querySelector('.world-passage[inert]'));
 assert.equal(document.querySelector('.world-passage').children.length,0);
 timers.get(1)();assert.equal(destinations[0],base+'photography.html');
 assert.equal(JSON.parse(memory.get(passage.key)).to,'photography');
 events.pageshow({persisted:true});assert(!document.querySelector('.world-passage'));assert.equal(timers.size,0);
});
