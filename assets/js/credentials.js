(() => {
  const section = document.querySelector("#certificates");
  const dialog = document.querySelector("#credential-dialog");
  if (!section || !dialog) return;
  const base = new URL("../../", document.currentScript.src);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const clean = value => typeof value === "string" ? value.trim() : "";
  const records = new Map();
  const lanes = [];
  let reader = null, readerTimer = 0, opener = null, transition = null, closing = false;

  function asset(value) {
    if (!clean(value)) return null;
    try {
      const url = new URL(value, base);
      return ["https:", "http:"].includes(url.protocol) || (base.protocol === "file:" && url.protocol === "file:") ? url : null;
    } catch { return null; }
  }
  function accent(element, value, fallback) {
    const color = /^#[\da-f]{6}$/i.test(clean(value)) ? clean(value) : fallback;
    const rgb = [1,3,5].map(index => parseInt(color.slice(index,index+2),16)).join(" ");
    element.style.setProperty("--file-accent",color);
    element.style.setProperty("--file-accent-rgb",rgb);
    return color;
  }
  function putLogo(mount, value, lazy = true) {
    mount.replaceChildren();
    const url = asset(value);
    if (!url) return false;
    const image = document.createElement("img");
    image.src = url.href;image.alt = "";image.decoding = "async";
    image.loading = lazy ? "lazy" : "eager";
    image.addEventListener("error",()=>{if(image.parentNode!==mount)return;image.remove();mount.hidden=true;const card=mount.closest(".credential-card");if(card)card.dataset.hasLogo="false";},{once:true});
    mount.hidden = false;mount.append(image);
    return true;
  }
  function card(record, index, clone) {
    const button = document.createElement("button");
    button.className = "credential-card";
    button.type = "button";
    button.dataset.credential = record.id;
    button.dataset.kind = record.kind;
    button.dataset.layout = record.layout;
    accent(button,record.accent,record.kind==="certificate"?"#93e7ff":"#c4b9ef");
    if (record.pending) button.dataset.pending = "";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", dialog.id);
    if (clone) {button.tabIndex = -1;button.setAttribute("aria-hidden", "true");}
    const top = document.createElement("span");top.className = "credential-card-top";
    const number = document.createElement("span");number.textContent = String(index + 1).padStart(2,"0");
    const label = document.createElement("span");label.textContent = record.pending ? "Pending entry" : record.kind === "certificate" ? "Certificate" : "Achievement";
    top.append(number,label);
    const logo = document.createElement("span");logo.className = "credential-logo";logo.setAttribute("aria-hidden","true");
    button.dataset.hasLogo = String(putLogo(logo,record.logo));
    const body = document.createElement("span");body.className = "credential-card-body";
    const subtitle = document.createElement("span");subtitle.className = "credential-subtitle";subtitle.textContent = record.subtitle || (record.kind === "certificate" ? "Certificate" : "Achievement");
    const title = document.createElement("strong");title.className = "credential-card-title";title.textContent = record.title;
    body.append(title,subtitle);
    const identity = document.createElement("span");identity.className="credential-identity";identity.append(logo,body);
    const footer = document.createElement("span");footer.className = "credential-card-footer";
    const date = document.createElement("span");date.textContent = record.year || "Year to come";
    const view = document.createElement("span");view.className="credential-card-action";view.textContent = record.pending ? "Preview space" : "Explore record";
    const arrow = document.createElement("span");arrow.className="credential-card-arrow";arrow.textContent="↗";arrow.setAttribute("aria-hidden","true");view.append(arrow);
    footer.append(date,view);button.append(top,identity,footer);
    return button;
  }

  // Native scrolling handles touch/trackpads; autoplay only writes scrollLeft
  // while a lane is visible and nobody is interacting with it.
  function createLane(root, items, direction) {
    const viewport=root.querySelector(".credential-viewport"), track=root.querySelector(".credential-track");
    const pause=root.querySelector("[data-lane-pause]"), status=root.querySelector("[data-lane-state]");
    let period=0, frame=0, lastTime=0, position=0, visible=false, paused=false, held=false, holdTimer=0, width=0, dragging=null, suppress=false;
    let hovered=false, pointerType="", keyboard=false, navigation=null, revealTimer=0;
    root.dataset.credentialMotion=motion.matches?"visible":"pending";
    const canMove=()=>visible&&!dragging&&!document.hidden&&!dialog.open&&period>0;
    const active=()=>canMove()&&!paused&&!held&&!motion.matches&&!hovered&&!(keyboard&&viewport.contains(document.activeElement));
    // Keep a full repeated set on either side, even when one set barely fills
    // the viewport. Normalize before writing so a long drag never hits an edge.
    const wrap=value=>period?period+((value-period)%period+period)%period:value;
    function move(value) {
      position=wrap(value);
      viewport.scrollLeft=position;
    }
    function finishReveal() {
      clearTimeout(revealTimer);
      root.dataset.credentialMotion="visible";
    }
    function reveal() {
      if(root.dataset.credentialMotion!=="pending")return;
      if(motion.matches){finishReveal();return;}
      const left=viewport.getBoundingClientRect().left;
      track.querySelectorAll(".credential-card").forEach(button=>{
        const rect=button.getBoundingClientRect(), stride=rect.width+18;
        // Matching copies must unfold together, including across a loop seam.
        const offset=((rect.left-left)%period+period)%period;
        const slot=Math.round(offset/stride);
        button.style.setProperty("--credential-delay",`${Math.min(slot,3)*70}ms`);
      });
      root.dataset.credentialMotion="revealing";
      revealTimer=setTimeout(finishReveal,1100);
    }
    function paint(time) {
      frame=0;
      if(navigation&&canMove()){
        navigation.start??=time;
        const progress=Math.min(1,(time-navigation.start)/360);
        const distance=navigation.distance*(1-Math.pow(1-progress,3));
        move(navigation.from+distance);
        navigation.travelled=distance;
        if(progress===1)navigation=null;
        lastTime=0;
      }else if(active()){
        if(lastTime)move(position+direction*Math.min(40,time-lastTime)*.024);
        lastTime=time;
      }else{lastTime=0;return;}
      if(navigation||active())frame=requestAnimationFrame(paint);
    }
    function update() {
      // Modal inertness and pointer capture can skip enter/leave events. Read
      // the current hover/focus state instead of retaining stale pause reasons.
      hovered=pointerType==="mouse"&&root.matches(":hover");
      if(!canMove())navigation=null;
      pause.setAttribute("aria-pressed",String(paused));
      pause.setAttribute("aria-label",paused?"Resume automatic movement":"Pause automatic movement");
      pause.title=motion.matches?"Automatic movement is off for reduced motion":paused?"Resume automatic movement":"Pause automatic movement";
      pause.dataset.paused=String(paused);
      status.textContent=motion.matches?"Manual navigation":paused?"Autoplay paused":active()?"Slowly in motion":"Paused while you explore";
      if(active()||navigation){if(!frame){position=viewport.scrollLeft;lastTime=0;frame=requestAnimationFrame(paint);}}
      else {cancelAnimationFrame(frame);frame=0;lastTime=0;}
    }
    function hold() {held=true;clearTimeout(holdTimer);update();holdTimer=setTimeout(()=>{held=false;update();},1500);}
    function rebuild() {
      const nextWidth=viewport.clientWidth;if(nextWidth===width&&period)return;width=nextWidth;
      const focused=viewport.contains(document.activeElement)?document.activeElement.closest("[data-credential]")?.dataset.credential:null;
      finishDrag();cancelAnimationFrame(frame);frame=0;navigation=null;
      if(root.dataset.credentialMotion==="revealing")finishReveal();
      track.replaceChildren();
      if(!items.length){const empty=document.createElement("p");empty.className="credential-lane-empty";empty.textContent="A new chapter will appear here.";track.append(empty);period=0;root.querySelectorAll("button").forEach(b=>b.disabled=true);return;}
      track.append(card(items[0],0,false));
      const stride=track.firstElementChild.getBoundingClientRect().width+18;
      const repeats=Math.max(1,Math.ceil((nextWidth+stride)/(items.length*stride)));
      track.replaceChildren();
      for(let group=0;group<3;group++){
        const set=document.createElement("div");set.className="credential-set";
        for(let r=0;r<repeats;r++)items.forEach((item,index)=>set.append(card(item,index,group!==1||r!==0)));
        track.append(set);
      }
      period=track.firstElementChild.getBoundingClientRect().width;
      move(period);
      if(focused)track.querySelector(`[data-credential="${focused}"]:not([aria-hidden])`)?.focus({preventScroll:true});
      update();
    }
    function step(sign) {
      const remaining=navigation?navigation.distance-navigation.travelled:0;
      hold();reveal();
      const distance=remaining+sign*((track.querySelector(".credential-card")?.getBoundingClientRect().width||300)+18);
      if(motion.matches){move(viewport.scrollLeft+distance);navigation=null;}
      else navigation={from:viewport.scrollLeft,distance,travelled:0,start:null};
      update();
    }
    root.querySelector("[data-lane-prev]").addEventListener("click",()=>step(-1));
    root.querySelector("[data-lane-next]").addEventListener("click",()=>step(1));
    pause.addEventListener("click",()=>{paused=!paused;update();});
    function syncPointer(event) {
      pointerType=event.pointerType;
      if(hovered!==(pointerType==="mouse"&&root.matches(":hover")))update();
    }
    root.addEventListener("pointerenter",syncPointer);
    root.addEventListener("pointerleave",syncPointer);
    window.addEventListener("pointermove",syncPointer,{passive:true});
    window.addEventListener("pointerdown",event=>{keyboard=false;pointerType=event.pointerType;update();},{passive:true});
    window.addEventListener("keydown",event=>{if(event.key!=="Escape"&&!dialog.open){keyboard=true;update();}});
    viewport.addEventListener("focusin",()=>{finishReveal();update();});
    viewport.addEventListener("focusout",()=>{queueMicrotask(update);});
    viewport.addEventListener("keydown",event=>{if(event.key==="ArrowLeft"||event.key==="ArrowRight"){event.preventDefault();step(event.key==="ArrowLeft"?-1:1);}});
    viewport.addEventListener("wheel",event=>{if(Math.abs(event.deltaX)>1){navigation=null;hold();}},{passive:true});
    viewport.addEventListener("pointerdown",event=>{
      navigation=null;keyboard=false;suppress=false;hold();if(event.button!==0)return;
      dragging={id:event.pointerId,type:event.pointerType,x:event.clientX,lastX:event.clientX,moved:false};
    });
    viewport.addEventListener("pointermove",event=>{
      if(!dragging||dragging.type!=="mouse"||event.pointerId!==dragging.id)return;
      const delta=event.clientX-dragging.x;
      if(Math.abs(delta)>6&&!dragging.moved){dragging.moved=true;viewport.setPointerCapture(event.pointerId);viewport.classList.add("is-dragging");}
      if(dragging.moved){event.preventDefault();move(viewport.scrollLeft-(event.clientX-dragging.lastX));dragging.lastX=event.clientX;}
    });
    function finishDrag(event){if(!dragging||(event?.pointerId!=null&&event.pointerId!==dragging.id))return;const id=dragging.id;suppress=dragging.moved;dragging=null;if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);viewport.classList.remove("is-dragging");hold();}
    window.addEventListener("pointerup",finishDrag);window.addEventListener("pointercancel",finishDrag);viewport.addEventListener("lostpointercapture",finishDrag);
    window.addEventListener("blur",()=>{finishDrag();navigation=null;update();});
    viewport.addEventListener("click",event=>{if(suppress){suppress=false;event.preventDefault();event.stopPropagation();}},{capture:true});
    viewport.addEventListener("scroll",()=>{
      const current=viewport.scrollLeft;
      // Ignore subpixel rounding near a seam; otherwise the normalization
      // itself would keep generating scroll events on fractional layouts.
      if(period&&(current<period-1||current>=period*2+1))viewport.scrollLeft=wrap(current);
      // Keep fractional autoplay positions: browsers may round scrollLeft to
      // whole pixels, which otherwise cancels motion on high-refresh displays.
      if(!active()&&!navigation)position=viewport.scrollLeft;
    },{passive:true});
    viewport.addEventListener("click",event=>{const button=event.target.closest("[data-credential]");if(button)openRecord(button.dataset.credential,button);});
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(entry.intersectionRatio>=.12)reveal();update();},{threshold:[0,.12]});observer.observe(viewport);
    const resize=new ResizeObserver(rebuild);resize.observe(viewport);
    motion.addEventListener("change",()=>{if(motion.matches){navigation=null;finishReveal();}update();});
    document.addEventListener("visibilitychange",()=>{if(document.hidden)finishDrag();update();});
    window.addEventListener("pagehide",()=>{visible=false;finishDrag();update();});
    window.addEventListener("pageshow",()=>{visible=viewport.getBoundingClientRect().bottom>0&&viewport.getBoundingClientRect().top<innerHeight;if(visible)reveal();update();});
    rebuild();return {update,resume(){held=false;clearTimeout(holdTimer);update();}};
  }

  function cleanReader() {clearTimeout(readerTimer);reader?.destroy();reader=null;dialog.querySelector("[data-credential-pdf]").replaceChildren();}
  function closeRecord() {
    if(!dialog.open||closing)return;closing=true;clearTimeout(readerTimer);
    const folio=dialog.querySelector(".credential-folio"),current=getComputedStyle(folio);
    const from={opacity:current.opacity,transform:current.transform,clipPath:current.clipPath};
    transition?.cancel();
    if(motion.matches||!folio.animate){dialog.close();return;}
    transition=folio.animate([from,{opacity:0,transform:"translateY(10px) scale(.98)",clipPath:from.clipPath}],{duration:180,fill:"forwards",easing:"ease-in"});
    transition.finished.then(()=>dialog.close(),()=>{});
  }
  function openRecord(id,button) {
    const record=records.get(id);if(!record||dialog.open)return;
    opener=button.hasAttribute("aria-hidden")?section.querySelector(`[data-credential="${id}"]:not([aria-hidden])`):button;
    opener?.focus({preventScroll:true});closing=false;cleanReader();
    dialog.dataset.kind=record.kind;
    const cardAccent=accent(dialog,record.accent,record.kind==="certificate"?"#93e7ff":"#c4b9ef");
    accent(dialog,record.dialogAccent,cardAccent);
    const logo=dialog.querySelector("[data-credential-logo]");
    logo.hidden=!putLogo(logo,record.logo,false);
    dialog.querySelector("[data-credential-kind]").textContent=record.kind==="certificate"?"Certificate":"Achievement";
    dialog.querySelector("[data-credential-status]").textContent=record.pending?"Pending · Awaiting details":"Personal archive";
    dialog.querySelector("#credential-title").textContent=record.title;
    dialog.querySelector("[data-credential-subtitle]").textContent=record.subtitle;
    dialog.querySelector("[data-credential-year]").textContent=record.year||"—";
    dialog.querySelector("[data-credential-description]").textContent=record.description||"The story behind this record is coming soon.";
    const pdf=asset(record.pdf),empty=dialog.querySelector(".credential-document-empty"),mount=dialog.querySelector("[data-credential-pdf]");
    empty.hidden=Boolean(pdf);mount.hidden=!pdf;
    const full=dialog.querySelector("[data-credential-full]");full.hidden=!pdf;full.removeAttribute("href");if(pdf)full.href=pdf.href;
    dialog.querySelector(".credential-metadata").hidden=false;
    document.documentElement.classList.add("credential-dialog-open");
    dialog.showModal();dialog.querySelector(".credential-metadata").scrollTop=0;
    lanes.forEach(lane=>lane.update());
    const folio=dialog.querySelector(".credential-folio");
    if(!motion.matches&&folio.animate){
      const rect=button.getBoundingClientRect();folio.style.transformOrigin=`${Math.max(10,Math.min(90,rect.left/innerWidth*100))}% 70%`;
      // A narrow spine traces across the screen, then unfolds into the folio.
      // This bounded entrance ends before the document finishes rendering.
      transition=folio.animate([
        {offset:0,opacity:0,transform:"translateY(24px) scale(.94) rotate(-.5deg)",clipPath:"inset(47% 15% 47% 15% round 4px)",easing:"ease-out"},
        {offset:.2,opacity:1,transform:"translateY(12px) scale(.98) rotate(-.2deg)",clipPath:"inset(46% 0 46% 0 round 4px)",easing:"cubic-bezier(.16,1,.3,1)"},
        {offset:.85,opacity:1,transform:"translateY(0) scale(1) rotate(0deg)",clipPath:"inset(0 0 0 0 round 4px)"},
        {offset:1,opacity:1,transform:"none",clipPath:"inset(0 0 0 0 round 4px)"}
      ],{duration:860});
    }
    if(pdf)readerTimer=setTimeout(()=>{if(dialog.open&&!closing)reader=window.ProjectPDFViewer.create({mount,url:pdf,title:record.title,dialog,detailsSelector:".credential-metadata"});},motion.matches?0:600);
  }
  dialog.querySelector(".credential-close").addEventListener("click",closeRecord);
  dialog.addEventListener("cancel",event=>{event.preventDefault();closeRecord();});
  let outsideDown=false;
  const outside=event=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
  dialog.addEventListener("pointerdown",event=>{outsideDown=event.target===dialog&&outside(event);});
  dialog.addEventListener("click",event=>{if(outsideDown&&outside(event))closeRecord();outsideDown=false;});
  dialog.addEventListener("close",()=>{cleanReader();transition?.cancel();transition=null;closing=false;document.documentElement.classList.remove("credential-dialog-open");const restore=opener?.isConnected?opener:section.querySelector(`[data-credential="${opener?.dataset.credential}"]:not([aria-hidden])`);restore?.focus({preventScroll:true});opener=null;lanes.forEach(lane=>lane.resume());});
  motion.addEventListener("change",()=>{if(motion.matches){transition?.cancel();if(closing)dialog.close();}});

  fetch(new URL("data/credentials.json",base),{cache:"no-store"}).then(response=>{if(!response.ok)throw Error();return response.json();}).then(data=>{
    for(const [key,kind,direction] of [["certificates","certificate",-1],["achievements","achievement",1]]){
      const items=[];
      for(const item of Array.isArray(data[key])?data[key]:[]){
        if(!item||!/^[\w-]{1,80}$/.test(item.id||"")||!clean(item.title)||records.has(item.id))continue;
        const layouts=["signal","orbit","frame"];
        const record={...item,title:clean(item.title),subtitle:clean(item.subtitle),year:clean(item.year),description:clean(item.description),pending:item.pending===true,kind,layout:layouts.includes(item.layout)?item.layout:layouts[items.length%layouts.length]};
        records.set(record.id,record);items.push(record);
      }
      items.sort((a,b)=>Number(a.pending)-Number(b.pending)||(clean(b.date)||b.year).localeCompare(clean(a.date)||a.year));
      const lane=section.querySelector(`[data-credential-lane="${key}"]`);
      lane.querySelector("[data-lane-count]").textContent=items.some(item=>item.pending)?"Spaces for future milestones":`${String(items.length).padStart(2,"0")} records`;
      lanes.push(createLane(lane,items,direction));
    }
    section.removeAttribute("aria-busy");
  }).catch(()=>{section.removeAttribute("aria-busy");section.querySelectorAll(".credential-track").forEach(track=>{track.textContent="Records couldn't load. Please refresh to try again.";});section.querySelectorAll(".credential-lane button").forEach(button=>button.disabled=true);});
})();
