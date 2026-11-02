// Scroll work is event-driven, restricted to the visible section and one frame.
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else {const story=factory();root.JourneyStory=story;story.init(root,root.document);}
})(globalThis,()=>{
  const clamp=n=>Math.max(0,Math.min(1,n));
  function skillConnections(chapters,id) {
    return chapters.flatMap((chapter,index)=>chapter.skills.includes(id)?[{index,title:chapter.title,year:chapter.year}]:[]);
  }
  function positionAt(rects,marker) {
    let active=-1;
    rects.forEach((rect,index)=>{if(rect.top<=marker)active=index;});
    if(active<0)return {active,progress:0};
    const start=rects[active].top,next=rects[active+1]?.top;
    const between=next===undefined?0:clamp((marker-start)/Math.max(1,next-start));
    return {active,progress:clamp((active+between)/Math.max(1,rects.length-1))};
  }
  function init(win,doc) {
    const section=doc.querySelector('#journey');
    if(!section||section.dataset.journeyReady)return;
    section.dataset.journeyReady='true';
    const $=s=>section.querySelector(s);
    const chapters=[...section.querySelectorAll('[data-journey-chapter]')];
    const steps=[...section.querySelectorAll('[data-journey-step]')];
    const records=chapters.slice(0,6).map(chapter=>({
      title:chapter.querySelector('h3').textContent,year:chapter.querySelector('.journey-chapter-label span').textContent,
      skills:[...new Set([...[...chapter.querySelectorAll('[data-journey-skill]')].map(button=>button.dataset.journeySkill),...(chapter.dataset.journeyApplied||'').split(' ').filter(Boolean)])]
    }));
    const motion=win.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile=doc.body.classList.contains('mobile-site');
    const header=doc.querySelector('.site-header');
    let headerSpace=0;
    function measureHeader(){
      const space=(header?.offsetHeight||0)+24;
      if(!mobile&&space>24&&space!==headerSpace){headerSpace=space;section.style.setProperty('--journey-header-space',`${space}px`);}
    }
    measureHeader();
    const map=$('#journey-map-dialog'),select=$('#journey-skill-select');
    let visible=false,frame=0,maxReached=-1,active=-1,progress=-1,mapOpener=null,returnFocus=true,backdropDown=false;
    const parallax=new Map();
    function markReached(index) {
      if(index<=maxReached)return;
      maxReached=index;
      const knowledge=new Set();
      chapters.forEach((chapter,i)=>{if(i<=index){chapter.classList.add('is-seen');records[i]?.skills.forEach(skill=>knowledge.add(skill));}});
      steps.forEach((step,i)=>step.classList.toggle('is-past',i<=index));
      $('[data-journey-position]').textContent=`${String(Math.min(6,index+1)).padStart(2,'0')} / 06`;
      $('[data-journey-count]').textContent=knowledge.size;
    }
    function paint() {
      frame=0;
      if(!visible||doc.hidden)return;
      // All geometry reads precede writes. Details and images can change height.
      const rects=chapters.map(chapter=>chapter.getBoundingClientRect());
      const marker=Math.min(win.innerHeight*.43,420);
      const next=positionAt(rects,marker);
      if(next.active!==active){
        active=next.active;
        steps.forEach((step,i)=>{if(i===active)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');});
        chapters.forEach((chapter,i)=>chapter.classList.toggle('is-current',i===active));
      }
      if(active>=0)markReached(active);
      const rounded=Math.round(next.progress*1000)/1000;
      if(rounded!==progress){progress=rounded;section.style.setProperty('--journey-progress',rounded);}
      rects.forEach((rect,i)=>{
        const value=motion.matches||mobile||win.innerWidth<=760?0:Math.round(Math.max(-14,Math.min(14,(rect.top-marker)*-.025)));
        if(rect.bottom>0&&rect.top<win.innerHeight&&parallax.get(i)!==value){chapters[i].style.setProperty('--journey-parallax',`${value}px`);parallax.set(i,value);}
      });
    }
    function schedule(){if(visible&&!doc.hidden&&!frame)frame=win.requestAnimationFrame(paint);}
    function suspend(){if(frame)win.cancelAnimationFrame(frame);frame=0;chapters.forEach(chapter=>chapter.classList.remove('is-current'));active=-1;}
    if(typeof win.IntersectionObserver==='function'){
      section.classList.add('is-enhanced');
      const observer=new win.IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();else suspend();},{rootMargin:'80px 0px'});
      observer.observe(section);
      const reveals=new win.IntersectionObserver(entries=>{
        entries.forEach(entry=>{if(entry.isIntersecting){
          if(entry.target.hasAttribute('data-journey-chapter'))markReached(chapters.indexOf(entry.target));
          else entry.target.classList.add(entry.target.classList.contains('journey-skills')?'is-unlocked':'is-connected');
          reveals.unobserve(entry.target);schedule();
        }});
      },{threshold:.08});
      chapters.forEach(chapter=>reveals.observe(chapter));
      section.querySelectorAll('.journey-skills, .journey-bridge').forEach(part=>reveals.observe(part));
    }else{visible=true;chapters.forEach(chapter=>chapter.classList.add('is-seen'));schedule();}
    win.addEventListener('scroll',schedule,{passive:true});
    win.addEventListener('resize',schedule,{passive:true});
    win.addEventListener('pagehide',suspend);
    win.addEventListener('pageshow',schedule);
    doc.addEventListener('visibilitychange',()=>{if(doc.hidden)suspend();else schedule();});
    section.addEventListener('toggle',schedule,true);
    const resize=typeof win.ResizeObserver==='function'?new win.ResizeObserver(()=>{measureHeader();schedule();}):null;
    resize?.observe(section);
    if(header)resize?.observe(header);
    motion.addEventListener('change',()=>{
      if(motion.matches){chapters.forEach(chapter=>chapter.style.setProperty('--journey-parallax','0px'));parallax.clear();}
      schedule();
    });
    function showConnections(id) {
      select.value=id;
      const connections=skillConnections(records,id),first=connections[0];
      const name=select.options[select.selectedIndex]?.textContent||'This skill';
      const later=connections.slice(1).map(item=>item.title);
      const joined=later.length>1?later.slice(0,-1).join(', ')+' and '+later.at(-1):later[0];
      $('[data-journey-map-summary]').textContent=first?`${name} first appears in this journey with ${first.title} (${first.year}). ${later.length?`It connects to ${joined} in later chapters.`:'This chapter introduces a distinct part of the story.'}`:'This connection has not been introduced yet.';
      section.querySelectorAll('[data-journey-node]').forEach((node,i)=>{
        const connected=connections.some(item=>item.index===i);
        node.classList.toggle('is-connected',connected);node.classList.toggle('is-first',i===first?.index);
        node.querySelector('[data-journey-node-state]').textContent=i===first?.index?'First introduced':connected?'Applied again':'Other parts of the journey';
      });
    }
    function openMap(button,id='html') {
      mapOpener=button;returnFocus=true;showConnections(id);
      if(!map.open){map.showModal();doc.documentElement.classList.add('journey-map-open');map.scrollTop=0;}
      select.focus({preventScroll:true});
    }
    $('[data-journey-map-open]').hidden=false;
    $('[data-journey-map-open]').addEventListener('click',event=>openMap(event.currentTarget));
    section.querySelectorAll('[data-journey-skill]').forEach(button=>{
      button.disabled=false;
      button.addEventListener('click',()=>openMap(button,button.dataset.journeySkill));
    });
    select.addEventListener('change',()=>showConnections(select.value));
    $('[data-journey-map-close]').addEventListener('click',()=>map.close());
    map.addEventListener('close',()=>{doc.documentElement.classList.remove('journey-map-open');if(returnFocus&&mapOpener?.isConnected)mapOpener.focus({preventScroll:true});});
    const outside=event=>{const rect=map.getBoundingClientRect();return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;};
    map.addEventListener('pointerdown',event=>{backdropDown=event.target===map&&outside(event);});
    map.addEventListener('click',event=>{if(backdropDown&&event.target===map&&outside(event))map.close();backdropDown=false;});
    map.querySelectorAll('[data-journey-map-chapter]').forEach(link=>link.addEventListener('click',event=>{
      event.preventDefault();returnFocus=false;map.close();
      const chapter=chapters[Number(link.dataset.journeyMapChapter)];
      chapter.scrollIntoView({behavior:motion.matches?'auto':'smooth',block:'start'});
      const title=chapter.querySelector('h3');title.tabIndex=-1;title.focus({preventScroll:true});
    }));
    section.querySelectorAll('[data-journey-project]').forEach(link=>link.addEventListener('click',event=>{
      if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      if(win.PortfolioProjects?.open(link.dataset.journeyProject,{returnFocus:link}))event.preventDefault();
    }));
  }
  return {skillConnections,positionAt,init};
});
