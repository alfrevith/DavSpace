/* The manuscript owns the atmosphere, not the reading surface. Every flourish
   is finite; the two small canvases share one throttled animation scheduler. */
(() => {
  if (document.body.dataset.world !== 'writing') return;
  const $ = selector => document.querySelector(selector);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)'), mobile = matchMedia('(max-width:760px)');
  const dialog = $('#literary-reader'), scene = $('.manuscript-scene'), fireSurface = $('[data-fire-surface]');
  const active = new Set(), seen = new WeakSet();
  const ease = 'cubic-bezier(.2,.7,.2,1)';
  let frame = 0, last = 0, elapsed = 0, width = 0, height = 0, dpr = 1;
  let ambient = null, context = null, flame = null, flameContext = null;
  let particles = [], sparks = [], heroVisible = true, suspended = false, reading = false;
  let egg = null, eggTimer = 0, introLayer = null, introFrame = 0, resizeFrame = 0;
  const pointer = { x: 0, target: 0 };
  const canAnimate = () => !reduce.matches && !document.hidden && !suspended;
  const canRender = () => canAnimate() && !reading && !dialog.open;
  function play(element, frames, options = {}) {
    if (!element?.animate || !canAnimate()) return null;
    const animation = element.animate(frames, { duration: 700, easing: ease, fill: 'backwards', ...options });
    active.add(animation); animation.finished.then(() => active.delete(animation), () => active.delete(animation));
    return animation;
  }
  function cancelWithin(root) {
    for (const animation of active) { const target = animation.effect?.target; if (target && (target === root || root?.contains(target))) { animation.cancel(); active.delete(animation); } }
  }
  function trace(root, delay = 0, duration = 1000, hot = false) {
    cancelWithin(root);
    root?.querySelectorAll('[data-ink-path]').forEach((path, i) => {
      play(path, [
        { strokeDasharray: '1 1', strokeDashoffset: 1, ...(hot ? { stroke: '#ce7b36' } : {}) },
        { strokeDasharray: '1 1', strokeDashoffset: 0, ...(hot ? { stroke: '#54311f' } : {}) }
      ], { delay: delay + i * 130, duration });
    });
  }
  function revealText(element, delay = 0) {
    play(element, [{ clipPath: 'inset(0 100% 0 0)', opacity: .2 }, { clipPath: 'inset(0 -4% 0 0)', opacity: 1 }], { delay, duration: 800 });
  }
  // The nib follows the actual SVG ink path, including the paper's rotation.
  function quillTip() {
    const quill = $('[data-quill]'), style = getComputedStyle(quill), box = scene.getBoundingClientRect();
    const scale = Math.min(quill.clientWidth / 180, quill.clientHeight / 420);
    const x = (quill.clientWidth - 180 * scale) / 2 + 27 * scale;
    const y = (quill.clientHeight - 420 * scale) / 2 + 405 * scale;
    const [ox, oy] = style.transformOrigin.split(' ').map(parseFloat);
    const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
    return { x: box.left + quill.offsetLeft + ox + matrix.a * (x - ox) + matrix.c * (y - oy) + matrix.e,
      y: box.top + quill.offsetTop + oy + matrix.b * (x - ox) + matrix.d * (y - oy) + matrix.f };
  }
  function writeWithQuill(duration = 2200, delay = 0) {
    if (!canAnimate() || !window.DOMMatrixReadOnly) return;
    const quill = $('[data-quill]'), path = $('.literary-flourish [data-ink-path]');
    cancelWithin(quill);
    const tip = quillTip(), bounds = quill.getBoundingClientRect(), matrix = path.getScreenCTM(), length = path.getTotalLength();
    if (!matrix) return;
    const frames = [{ transform: 'rotate(14deg)', offset: 0 }];
    for (let i = 0; i <= 18; i++) {
      const point = path.getPointAtLength(length * i / 18);
      const dx = matrix.a * point.x + matrix.c * point.y + matrix.e - tip.x;
      const dy = matrix.b * point.x + matrix.d * point.y + matrix.f - tip.y;
      // Keep the feather inside a narrow viewport at the far end of the stroke.
      const fitX = Math.max(8 - bounds.left, Math.min(document.documentElement.clientWidth - 8 - bounds.right, dx));
      frames.push({ transform: `translate(${fitX.toFixed(2)}px,${dy.toFixed(2)}px) rotate(14deg)`, offset: .1 + i / 18 * .72 });
    }
    frames.push({ transform: 'rotate(14deg)', offset: 1 });
    play(quill, frames, { duration, delay, easing: 'linear' });
  }
  function dismissIntro() { cancelWithin(introLayer); introLayer?.remove(); introLayer = null; }
  function introduction() {
    if (document.documentElement.hasAttribute('data-world-arriving')) {
      window.addEventListener('creative:arrived', introduction, { once: true }); return;
    }
    let first = false;
    try { first = !sessionStorage.getItem('davspace:writing:first-word:v1'); sessionStorage.setItem('davspace:writing:first-word:v1', '1'); } catch { /* The page stays immediate without private storage. */ }
    first = first || !!window.creativeWorldEntry;
    if (!canAnimate() || !Element.prototype.animate) return;
    if (first) {
      const box = scene.getBoundingClientRect(), x = Math.min(innerWidth - 30, box.left + box.width * .62), y = Math.min(innerHeight * .77, box.top + box.height * .7);
      introLayer = document.createElement('div'); introLayer.className = 'writing-first-word'; introLayer.setAttribute('aria-hidden', 'true'); introLayer.setAttribute('inert', '');
      const ember = document.createElement('span'); ember.className = 'first-ember'; introLayer.append(ember); document.body.append(introLayer);
      play(ember, [{ opacity: 0, transform: `translate(${x + 35}px,30px) scale(.4)` }, { opacity: 1, offset: .3, transform: `translate(${x - 12}px,${y * .5}px) scale(1)` }, { opacity: 0, transform: `translate(${x}px,${y}px) scale(.5)` }], { duration: 1250 });
      play(introLayer, [{ opacity: 1 }, { opacity: .75, offset: .35 }, { opacity: 0 }], { duration: 1350 })?.finished.then(dismissIntro, () => {});
    }
    play($('.hero-manuscript'), [{ opacity: .15, clipPath: 'polygon(0 0, 15% 0, 9% 100%, 0 100%)', transform: 'rotate(-5deg) scale(.98)' }, { opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', transform: 'rotate(-3deg) scale(1)' }], { duration: 1050, delay: first ? 200 : 0 });
    document.querySelectorAll('.writing-letter').forEach((letter, i) => revealText(letter, (first ? 550 : 100) + i * 60));
    trace($('.hero-manuscript .literary-flourish'), first ? 1000 : 470, 1580, true);
    writeWithQuill(2200, first ? 780 : 250);
    revealText($('.writing-introduction h2'), 300); revealText($('.writing-description'), 600);
  }
  function setup() {
    if (!ambient) {
      ambient = document.createElement('canvas'); ambient.setAttribute('aria-hidden', 'true'); context = ambient.getContext('2d');
      flame = document.createElement('canvas'); flame.setAttribute('aria-hidden', 'true'); flameContext = flame.getContext('2d');
      if (!context || !flameContext || !window.ManuscriptFire) {
        ambient = context = flame = flameContext = null;
        return false;
      }
      $('.writing-atmosphere').append(ambient); fireSurface.append(flame);
    }
    width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, mobile.matches ? 1 : 1.5);
    ambient.width = Math.round(width * dpr); ambient.height = Math.round(height * dpr); context.setTransform(dpr,0,0,dpr,0,0);
    flame.width = Math.max(1, Math.round(fireSurface.clientWidth * dpr)); flame.height = Math.max(1, Math.round(fireSurface.clientHeight * dpr));
    flameContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = navigator.connection?.saveData ? 6 : mobile.matches ? 10 : (navigator.hardwareConcurrency || 4) <= 4 ? 12 : 18;
    particles = Array.from({ length: count }, (_, i) => ({ x: Math.random(), y: Math.random(), depth: i % 3, phase: Math.random()*6.28, speed: .004 + Math.random()*.008, size: .4 + Math.random()*1.3 }));
    return true;
  }
  function stop(clear = false) {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    if (clear && context) { context.clearRect(0,0,width,height); flameContext.clearRect(0,0,flame.width,flame.height); document.body.classList.remove('has-living-fire'); }
  }
  function tick(time) {
    if (!canRender()) { stop(); return; }
    frame = requestAnimationFrame(tick);
    const interval = mobile.matches ? 1000/24 : 1000/30;
    if (last && time-last < interval) return;
    const dt = last ? Math.min(.08,(time-last)/1000) : interval/1000; last = time; elapsed += dt;
    pointer.x += (pointer.target-pointer.x)*Math.min(1,dt*2);
    context.clearRect(0,0,width,height);
    const heat = egg ? Math.sin(Math.min(1,(performance.now()-egg)/2800)*Math.PI) : 0;
    for (const particle of particles) {
      particle.y -= particle.speed*dt; if(particle.y<-.03)particle.y=1.03;
      const x=particle.x*width+Math.sin(elapsed*.4+particle.phase)*10+pointer.x*(particle.depth+1)*6, y=particle.y*height;
      context.globalAlpha=(.18+Math.sin(elapsed*.7+particle.phase)*.13)*Math.min(1,Math.max(0,particle.y*10));
      context.fillStyle=particle.depth===2?'#b3a08a':'#f0aa58';
      if(particle.depth===0){context.fillRect(x,y,particle.size,particle.size*1.8);}else{context.beginPath();context.arc(x,y,particle.size,0,Math.PI*2);context.fill();}
    }
    for (const spark of sparks) {
      spark.life-=dt;spark.x+=spark.vx*dt;spark.y+=spark.vy*dt;spark.vy-=10*dt;
      context.globalAlpha=Math.max(0,Math.min(1,spark.life));context.fillStyle='#ffd38b';context.fillRect(spark.x,spark.y,1.3,2.2);
    }
    sparks=sparks.filter(spark=>spark.life>0);context.globalAlpha=1;
    if(heroVisible){
      window.ManuscriptFire.paint(flameContext, flame.width / dpr, flame.height / dpr, elapsed, heat);
      document.body.style.setProperty('--firelight',(.78+Math.sin(elapsed*1.7)*.035+Math.sin(elapsed*3.4)*.018+heat*.25).toFixed(3));
      if (egg && Math.random() < .35 && sparks.length < (mobile.matches ? 14 : 24)) {
        const early = performance.now() - egg < 1800, box = fireSurface.getBoundingClientRect();
        const source = early && window.DOMMatrixReadOnly ? quillTip() : { x: box.left + box.width * (.3 + Math.random() * .4), y: box.bottom - 10 };
        sparks.push({ x: source.x, y: source.y,
          vx: (Math.random() - .5) * 30, vy: -25 - Math.random() * 45, life: .6 + Math.random() * .7 });
      }
    }
  }
  function synchronize() {
    if (!canRender()) { stop(reduce.matches); return; }
    if (!ambient && !setup()) return;
    if (!frame) { document.body.classList.add('has-living-fire'); frame=requestAnimationFrame(tick); }
  }
  function endEgg() {
    clearTimeout(eggTimer); eggTimer=0; egg=null; sparks=[];
    document.body.classList.remove('is-cooking'); $('[data-quill]').setAttribute('aria-pressed','false'); $('[data-cook-status]').hidden=true;
    cancelWithin($('.quill-trigger'));cancelWithin($('.hero-manuscript .literary-flourish'));cancelWithin($('[data-cook-status]'));
  }
  function revealCookCaption() {
    const status = $('[data-cook-status]'), run = egg;
    const caption = play(status, [
      { opacity: 0, transform: 'translateY(4px) rotate(-1deg)', easing: ease },
      { opacity: 1, transform: 'translateY(0) rotate(-1deg)', offset: .08 },
      { opacity: 1, transform: 'none', offset: .75, easing: 'cubic-bezier(.4,0,.6,1)' },
      { opacity: 0, transform: 'translateY(-3px)' }
    ], { delay: 420, duration: 2600, easing: 'linear' });
    status.querySelectorAll('[data-cook-word]').forEach((word, index) => {
      play(word, [
        { opacity: 0, clipPath: 'inset(-8% 100% -10% -6%)', transform: 'translateY(3px) rotate(-3deg) scale(1.04)', color: '#b5662b' },
        { opacity: 1, clipPath: 'inset(-8% -6% -10% -6%)', transform: 'translateY(0) rotate(.4deg) scale(1.012)', color: '#6b3420', offset: .76 },
        { opacity: 1, clipPath: 'inset(-8% -6% -10% -6%)', transform: 'none', color: '#642d1d' }
      ], { delay: 540 + index * 180, duration: 650 + index * 25 });
    });
    trace(status.querySelector('.cook-underline'), 1100, 750, true);
    // Resting opacity is zero too: finishing or cancelling cannot flash the caption.
    caption?.finished.then(() => { if (egg === run) status.hidden = true; }, () => {});
  }
  function cook() {
    if (reading || dialog.open || suspended) return;
    dismissIntro(); endEgg(); document.body.classList.add('is-cooking'); $('[data-quill]').setAttribute('aria-pressed','true'); $('[data-cook-status]').hidden=false;
    egg=performance.now();
    if(canAnimate()){
      trace($('.hero-manuscript .literary-flourish'),220,1580,true);
      writeWithQuill(2200);
      revealCookCaption();
    }
    eggTimer=setTimeout(endEgg,3400); synchronize();
  }
  const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{
    for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);if(seen.has(entry.target))continue;seen.add(entry.target);if(!canAnimate())continue;
      if(entry.target.matches('.literary-book')){
        const cover=entry.target.querySelector('.book-cover'),story=entry.target.dataset.workKind==='story',even=Number(entry.target.dataset.manuscriptIndex)%2;
        play(cover,[{opacity:.25,transform:story?'rotateY(-12deg) rotate(-2deg)':`rotate(${even?5:-5}deg) scaleY(.94)`,clipPath:'polygon(0 0, 25% 0, 20% 100%, 0 100%)'},{opacity:1,transform:`rotate(${even?2:-2}deg)`,clipPath:'polygon(0 0, 100% 0, 100% 100%, 0 100%)'}],{duration:1100,delay:even?130:0});
        trace(cover,350,900,true);
      }else{revealText(entry.target.querySelector('h2'),0);}
    }
  },{threshold:.15}):null;
  function collection(library,category) {
    library.dataset.kind=category;document.body.dataset.writingCategory=category;
    library.querySelectorAll('.literary-book').forEach((card,i)=>{
      card.dataset.manuscriptIndex=i;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 400 40');svg.setAttribute('class','book-decoration');svg.setAttribute('aria-hidden','true');
      svg.innerHTML='<path data-ink-path pathLength="1" d="M8 21q61-12 119 0c22 6 27-12 10-11-22 1 10 17 50 8 21-5 21 14 3 11-14-2 19-12 52-9l148-3"/>';
      card.querySelector('.book-cover').append(svg);observer?.observe(card);
    });
  }
  function beforeOpen() { reading=true;dismissIntro();endEgg();stop(); }
  function opened() {
    play(dialog,[{opacity:.2,transform:'perspective(1400px) rotateY(-6deg) translateX(-12px)'},{opacity:1,transform:'none'}],{duration:560});
    revealText(dialog.querySelector('header>div'),100);
  }
  function closed() { cancelWithin(dialog);reading=false;synchronize(); }
  function settle() {
    cancelAnimationFrame(introFrame);dismissIntro();endEgg();
    for(const animation of active)animation.cancel();active.clear();
    document.body.style.removeProperty('--firelight');
  }
  window.BurningManuscript={collection,beforeOpen,opened,closed,get state(){return{running:!!frame,particles:particles.length,sparks:sparks.length,dpr,cooking:!!egg,animations:active.size};}};
  $('[data-quill]').addEventListener('click',cook);
  document.addEventListener('pointerdown',dismissIntro,{passive:true,capture:true});document.addEventListener('keydown',dismissIntro);
  document.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'&&canRender())pointer.target=event.clientX/innerWidth-.5;},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)settle();synchronize();});
  reduce.addEventListener('change',()=>{if(reduce.matches)settle();synchronize();});
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{settle();if(ambient)setup();synchronize();});},{passive:true});
  window.addEventListener('pagehide',()=>{suspended=true;settle();stop();cancelAnimationFrame(resizeFrame);});
  window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;settle();synchronize();}});
  if(observer){observer.observe($('.manuscripts-heading'));observer.observe($('.writing-footer'));new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;}).observe(scene);}
  introFrame=requestAnimationFrame(introduction);synchronize();
})();
