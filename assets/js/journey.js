// Scroll work is event-driven, restricted to the visible section and one frame.
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else {const story=factory();root.JourneyStory=story;story.init(root,root.document);}
})(globalThis,()=>{
  const clamp=n=>Math.max(0,Math.min(1,n));
  function positionAt(rects,marker) {
    let active=-1;
    rects.forEach((rect,index)=>{if(rect.top<=marker)active=index;});
    if(active<0)return {active,progress:0};
    const start=rects[active].top,next=rects[active+1]?.top;
    const between=next===undefined?0:clamp((marker-start)/Math.max(1,next-start));
    return {active,progress:clamp((active+between)/Math.max(1,rects.length-1))};
  }
  function init(win,doc) {
    const section=doc.querySelector('#beyond-the-code');
    if(!section||section.dataset.journeyReady)return;
    section.dataset.journeyReady='true';
    const $=s=>section.querySelector(s);
    const chapters=[...section.querySelectorAll('[data-journey-chapter]')];
    const steps=[...section.querySelectorAll('[data-journey-step]')];
    const motion=win.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile=doc.body.classList.contains('mobile-site');
    const header=doc.querySelector('.site-header');
    let headerSpace=0;
    function measureHeader(){
      const space=(header?.offsetHeight||0)+24;
      if(!mobile&&space>24&&space!==headerSpace){headerSpace=space;section.style.setProperty('--journey-header-space',`${space}px`);}
    }
    measureHeader();
    let visible=false,frame=0,maxReached=-1,active=-1,progress=-1;
    const parallax=new Map();
    function markReached(index) {
      if(index<=maxReached)return;
      maxReached=index;
      chapters.forEach((chapter,i)=>{if(i<=index)chapter.classList.add('is-seen');});
      steps.forEach((step,i)=>step.classList.toggle('is-past',i<=index));
      $('[data-journey-position]').textContent=`${String(Math.min(chapters.length,index+1)).padStart(2,'0')} / ${String(chapters.length).padStart(2,'0')}`;
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
        const console=section.querySelector('.journey-console');
        if(console)console.dataset.world=active>=0?steps[active].dataset.world:'';
        const current=$('[data-journey-current]');
        if(current)current.textContent=active>=0?`Exploring ${chapters[active].querySelector('h3').textContent}`:'Choose a world ↗';
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
          else entry.target.classList.add('is-connected');
          reveals.unobserve(entry.target);schedule();
        }});
      },{threshold:.08});
      chapters.forEach(chapter=>reveals.observe(chapter));
      section.querySelectorAll('.journey-bridge').forEach(part=>reveals.observe(part));
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
  }
  return {positionAt,init};
});
