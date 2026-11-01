(() => {
  const core = window.PortfolioKnowledge;
  if (!core || document.querySelector("[data-assistant-root]")) return;
  const siteRoot = new URL("../../", document.currentScript.src);
  let lang = navigator.language.startsWith("es") ? "es" : "en";
  let context = {};
  let busy = false;
  let request;
  let version = 0;
  const copy = {
    es:{open:"Abrir chat",name:"Guía de David",heading:"¿Qué te gustaría saber?",welcome:"Proyectos, certificados o un poco más sobre David.",suggestions:["Muéstrame los proyectos","¿Quién es David?"],placeholder:"Escribe tu pregunta…",send:"Enviar",close:"Cerrar chat",reset:"Nueva conversación",you:"Tú",guide:"Guía",loading:"Consultando el portafolio…",failed:"No pude consultar los archivos del portafolio. Inténtalo otra vez.",source:"Ver sección",project:"Ver proyecto"},
    en:{open:"Open chat",name:"David's guide",heading:"What would you like to know?",welcome:"Projects, certificates, or a little more about David.",suggestions:["Show me the projects","Who is David?"],placeholder:"Ask a question…",send:"Send",close:"Close chat",reset:"New conversation",you:"You",guide:"Guide",loading:"Checking the portfolio…",failed:"I couldn't read the portfolio files. Please try again.",source:"View section",project:"View project"}
  };
  const root = document.createElement("div");
  root.className = "portfolio-assistant";
  root.dataset.assistantRoot = "";
  root.innerHTML = `
    <button class="assistant-launcher" type="button" aria-controls="assistant-panel" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M6 5.5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-5 3v-3a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/><path d="M8 10h8m-8 3h5"/></svg></button>
    <section class="assistant-panel" id="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-name" hidden>
      <span class="assistant-transmission" aria-hidden="true"></span>
      <header class="assistant-header"><span class="assistant-light" aria-hidden="true"></span><h2 id="assistant-name"></h2><button class="assistant-icon-button assistant-reset" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/></svg></button><button class="assistant-icon-button assistant-close" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
      <div class="assistant-scroll"><div class="assistant-welcome">
        <h3></h3><p></p><div class="assistant-suggestions"></div></div><div class="assistant-log" role="log" aria-live="polite" aria-relevant="additions"></div></div>
      <form class="assistant-form"><label class="assistant-sr-only" for="assistant-question"></label><textarea id="assistant-question" maxlength="1000" rows="1" required></textarea><button class="assistant-send" type="submit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></form>
    </section>`;
  document.body.append(root);
  const $ = selector => root.querySelector(selector);
  const panel = $(".assistant-panel");
  const launcher = $(".assistant-launcher");
  const input = $("textarea");
  const log = $(".assistant-log");
  const scroll = $(".assistant-scroll");
  const welcome = $(".assistant-welcome");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let panelAnimation=null, closing=false;
  function settlePanel() {
    panelAnimation?.cancel();panelAnimation=null;
    delete panel.dataset.motion;
    if(closing){panel.hidden=true;closing=false;}
  }
  function animatePanel(opening) {
    panelAnimation?.cancel();panelAnimation=null;
    if(motion.matches||!panel.animate){settlePanel();return;}
    panel.dataset.motion=opening?"opening":"closing";
    const frames=opening?[
      {offset:0,opacity:0,clipPath:"inset(94% 0 0 0)",transform:"translateY(10px) scaleX(.7)"},
      {offset:.2,opacity:1,clipPath:"inset(94% 0 0 0)",transform:"none"},
      {offset:.3,opacity:1,clipPath:"inset(35% 0 3% 0)",transform:"translateX(-3px)",easing:"steps(1,end)"},
      {offset:.36,opacity:1,clipPath:"inset(35% 0 3% 0)",transform:"translateX(2px)"},
      {offset:.57,opacity:1,clipPath:"inset(0)",transform:"translateX(-1px)"},
      {offset:1,opacity:1,clipPath:"inset(0)",transform:"none"}
    ]:[
      {offset:0,opacity:1,clipPath:"inset(0)",transform:"none"},
      {offset:.2,opacity:1,clipPath:"inset(0)",transform:"translateX(-3px)",easing:"steps(1,end)"},
      {offset:.3,opacity:1,clipPath:"inset(12% 0 8% 0)",transform:"translateX(2px)"},
      {offset:.7,opacity:1,clipPath:"inset(49% 0 49% 0)",transform:"none"},
      {offset:1,opacity:0,clipPath:"inset(49.8% 0 49.8% 0)",transform:"scaleX(.65)"}
    ];
    const animation=panel.animate(frames,{duration:opening?580:300,easing:"linear",fill:"both"});
    panelAnimation=animation;
    animation.finished.then(()=>{if(panelAnimation===animation)settlePanel();},()=>{});
  }
  motion.addEventListener("change",()=>{if(motion.matches)settlePanel();});
  const t = () => copy[lang];
  function translate() {
    panel.lang = lang;
    launcher.title = t().open;
    launcher.setAttribute("aria-label",t().open);
    $("#assistant-name").textContent = t().name;
    for (const [selector,key] of [[".assistant-close","close"],[".assistant-reset","reset"],[".assistant-send","send"]]) {
      $(selector).setAttribute("aria-label",t()[key]); $(selector).title=t()[key];
    }
    $(".assistant-sr-only").textContent=t().placeholder;
    input.placeholder=t().placeholder;
    log.setAttribute("aria-label",lang==="es" ? "Conversación" : "Conversation");
    $(".assistant-welcome h3").textContent=t().heading;
    $(".assistant-welcome p").textContent=t().welcome;
    $(".assistant-suggestions").replaceChildren(...t().suggestions.map(question => {
      const button=document.createElement("button");button.type="button";button.textContent=question;
      button.addEventListener("click",()=>{input.value=question;send();});return button;
    }));
  }
  translate();
  function stop() {
    version++;request?.abort();request=null;busy=false;
    $(".assistant-send").disabled=false;
    log.querySelector(".assistant-thinking")?.remove();log.removeAttribute("aria-busy");
  }
  function close({focus=true}={}) {
    stop();launcher.setAttribute("aria-expanded","false");
    if(focus) launcher.focus({preventScroll:true});
    if(panel.hidden||closing)return;
    closing=true;panel.inert=true;animatePanel(false);
  }
  launcher.addEventListener("click",()=>{
    if(!panel.hidden&&!closing) return close();
    closing=false;panel.hidden=false;panel.inert=false;launcher.setAttribute("aria-expanded","true");animatePanel(true);
    if(!matchMedia("(pointer: coarse)").matches) input.focus({preventScroll:true});
  });
  $(".assistant-close").addEventListener("click",()=>close());
  $(".assistant-reset").addEventListener("click",()=>{
    stop();context={};log.replaceChildren();welcome.hidden=false;input.value="";input.style.height="";input.focus({preventScroll:true});
  });
  panel.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();close();}});
  input.addEventListener("input",()=>{input.style.height="auto";input.style.height=`${Math.min(96,input.scrollHeight)}px`;});
  input.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.isComposing){event.preventDefault();send();}});

  function addMessage(role,content,sources=[],messageLang=lang,suggestions=[]) {
    const article=document.createElement("article");article.className=`assistant-message assistant-message--${role}`;article.lang=messageLang;
    const label=document.createElement("p");label.className="assistant-message-label";label.textContent=role==="user" ? copy[messageLang].you : copy[messageLang].guide;
    const body=document.createElement("p");body.className="assistant-message-text";body.textContent=content;article.append(label,body);
    const links=document.createElement("div");links.className="assistant-source-links";
    for(const source of sources.slice(0,6)) {
      if(!source || core.safeHref(source.href)!==source.href) continue;
      const link=document.createElement("a");link.href=new URL(source.href,siteRoot).href;
      const sectionLabels={"index.html#about-me":{es:"Sobre David",en:"About David"},"index.html#projects":{es:"Proyectos",en:"Projects"},"index.html#contact":{es:"Contacto",en:"Contact"}};
      link.textContent=(source.project ? source.title : sectionLabels[source.href]?.[messageLang] || copy[messageLang].source)+" ↗";
      link.title=String(source.title || "").slice(0,120);
      link.addEventListener("click",event=>{
        const card=source.project && [...document.querySelectorAll("#project-list [data-project]")].find(card=>card.dataset.project===source.project);
        close({focus:false});
        if(card){event.preventDefault();card.click();}
      });
      links.append(link);
    }
    if(links.children.length) {
      const label=document.createElement("span");label.className="assistant-action-label";label.textContent=messageLang==="es"?"Abrir contenido":"Explore the portfolio";
      links.prepend(label);article.append(links);
    }
    if(role==="assistant"&&suggestions.length){
      log.querySelectorAll(".assistant-followups").forEach(node=>node.remove());
      const next=document.createElement("div");next.className="assistant-suggestions assistant-followups";
      const label=document.createElement("span");label.className="assistant-action-label";label.textContent=messageLang==="es"?"Sigue conversando":"Keep the conversation going";next.append(label);
      for(const question of suggestions.slice(0,2)){
        if(typeof question!=="string")continue;
        const button=document.createElement("button");button.type="button";button.textContent=question;
        button.addEventListener("click",()=>{input.value=question;send();});next.append(button);
      }
      article.append(next);
    }
    log.append(article);
    // Keep only the recent visual conversation; no transcript is stored or sent.
    while(log.querySelectorAll("article").length>60) log.querySelector("article").remove();
  }

  async function loadKnowledge(signal) {
    const read=async name=>{
      if(!/^(?:data\/)?[\w-]+\.(html|js|json)$/.test(name)) throw new Error("Invalid source path");
      const response=await fetch(new URL(name,siteRoot),{cache:"no-store",credentials:"omit",signal});
      if(!response.ok) throw new Error("Source unavailable");
      const text=await response.text();if(text.length>1000000) throw new Error("Source too large");return text;
    };
    let main;
    try { main=new DOMParser().parseFromString(await read("index.html"),"text/html"); }
    catch(error) { if(signal.aborted) throw error;main=document; }
    let projects=window.PORTFOLIO_PROJECTS || {};
    let manual={},credentials={};
    const extra=await Promise.allSettled([read("data/projects.js"),read("data/assistant-knowledge.json"),read("data/credentials.json")]);
    if(extra[0].status==="fulfilled") {try{projects=core.parseProjects(extra[0].value);}catch{/* Existing on-page data remains usable. */}}
    if(extra[1].status==="fulfilled") {try{manual=JSON.parse(extra[1].value);}catch{/* A malformed training file cannot break the chat. */}}
    if(extra[2].status==="fulfilled") {try{credentials=JSON.parse(extra[2].value);}catch{/* Other portfolio sources remain available. */}}
    const profile=core.profileSource(main);
    const sources=[...core.extractDocument(main),...core.projectSources(projects,main),...core.credentialSources(credentials),...(profile ? [profile] : []),...core.manualSources(manual)];
    const names=[...new Set([...main.querySelectorAll("main a[href]")].map(a=>a.getAttribute("href").split("#")[0]).filter(name=>/^[\w-]+\.html$/.test(name)&&name!=="index.html"))].slice(0,12);
    const pages=await Promise.allSettled(names.map(async name=>core.extractDocument(new DOMParser().parseFromString(await read(name),"text/html"),name)));
    pages.forEach(result=>{if(result.status==="fulfilled")sources.push(...result.value);});
    return sources;
  }

  async function send() {
    const question=input.value.trim();if(!question || question.length>1000 || busy) return;
    lang=core.detectLanguage(question,lang);translate();const messageLang=lang;
    welcome.hidden=true;addMessage("user",question,[],messageLang);input.value="";input.style.height="";
    busy=true;$(".assistant-send").disabled=true;
    const pending=document.createElement("p");pending.className="assistant-thinking";pending.textContent=t().loading;log.append(pending);log.setAttribute("aria-busy","true");scroll.scrollTop=scroll.scrollHeight;
    const id=++version;const controller=new AbortController();request=controller;
    const timeout=setTimeout(()=>controller.abort(),10000);
    try {
      const sources=await loadKnowledge(controller.signal);
      if(id!==version) return;
      if(controller.signal.aborted) throw new Error("Source request timed out");
      const result=core.answer(sources,question,{lang:messageLang,context});context=result.context;
      const follow=scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<100;
      pending.remove();addMessage("assistant",result.answer,result.sources,messageLang,result.suggestions);
      if(follow) scroll.scrollTop=scroll.scrollHeight;
    } catch {
      if(id===version){pending.remove();addMessage("assistant",copy[messageLang].failed,[],messageLang);scroll.scrollTop=scroll.scrollHeight;}
    } finally {
      clearTimeout(timeout);
      if(id===version){pending.remove();busy=false;request=null;$(".assistant-send").disabled=false;log.removeAttribute("aria-busy");}
    }
  }
  $("form").addEventListener("submit",event=>{event.preventDefault();send();});
})();
