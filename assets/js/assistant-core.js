// Local, deterministic answers. No model, key, telemetry, or external service.
((root, factory) => {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PortfolioKnowledge = factory();
})(globalThis, () => {
  const compact = value => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  const normalize = value => compact(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
  const safeHref = value => /^[a-z0-9_-]+\.html(?:#[\w-]+)?$/i.test(value || "") ? value : "index.html#about-me";
  const words = value => normalize(value).split(" ").filter(Boolean);
  const has = (query, terms) => terms.some(term => ` ${query} `.includes(` ${term} `));
  const strings = value => Array.isArray(value) ? value.map(compact).filter(Boolean) : [];

  function detectLanguage(question, fallback = "en") {
    const tokens = words(question);
    const es = new Set("hola gracias adios que cual cuales como donde quien cuando cuanto cuantos cuantas anos edad puedes dime cuentame muestrame proyectos tecnologias rol habilidades idiomas estudia interesa sus desarrollaste utiliza usa tiene descripcion desarrollo seccion gustaria conocer trabajo equipo por favor su el la los las de chiste poema aburrido sorprende sorpréndeme adivinanza mas respuesta motivo hecho hecho listo recomiendas comparalos otro otra eso ese".split(" "));
    const en = new Set("hello hi thanks goodbye what which how where who when age can tell show projects technologies role skills languages education interests his her development description section would know work team please the does with joke poem bored surprise riddle more answer inspired built ready recommend compare other that those".split(" "));
    const a = tokens.filter(token => es.has(token)).length + (/[¿¡ñáéíóú]/i.test(question) ? 2 : 0);
    const b = tokens.filter(token => en.has(token)).length;
    return a === b ? fallback : a > b ? "es" : "en";
  }

  // Restricted data parser for projects.js. Expressions/functions are rejected,
  // rather than evaluating JavaScript or loading another runtime dependency.
  function parseProjects(script) {
    const match = /^\s*window\.PORTFOLIO_PROJECTS\s*=\s*/m.exec(script);
    if (!match || script.length > 200000) throw new Error("Invalid project data");
    const input = script.slice(match.index + match[0].length);
    let position = 0;
    const skip = () => {
      const m = /^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/.exec(input.slice(position));
      if (m) position += m[0].length;
    };
    const consume = char => { skip(); if (input[position] !== char) throw new Error("Invalid project syntax"); position++; };
    const token = () => {
      skip();
      const m = /^(?:"(?:\\.|[^"\\])*"|[a-zA-Z_$][\w$]*|-?\d+(?:\.\d+)?)/.exec(input.slice(position));
      if (!m) throw new Error("Invalid project token");
      position += m[0].length;
      return m[0];
    };
    function value(depth = 0) {
      if (depth > 16) throw new Error("Project data is too deep");
      skip();
      const char = input[position];
      if (char === "{" || char === "[") {
        const object = char === "{";
        const result = object ? Object.create(null) : [];
        const end = object ? "}" : "]";
        position++; skip();
        while (input[position] !== end) {
          if (object) {
            const raw = token();
            const key = raw.startsWith('"') ? JSON.parse(raw) : raw;
            consume(":"); result[key] = value(depth + 1);
          } else result.push(value(depth + 1));
          skip();
          if (input[position] !== ",") break;
          position++; skip();
        }
        consume(end); return result;
      }
      const raw = token();
      if (raw.startsWith('"') || /^(?:true|false|null|-?\d)/.test(raw)) return JSON.parse(raw);
      throw new Error("Only literal project data is allowed");
    }
    const result = value(); skip();
    if (input[position] === ";") { position++; skip(); }
    if (position !== input.length || !result || Array.isArray(result) || typeof result !== "object") throw new Error("Invalid project assignment");
    return result;
  }

  function readable(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, dialog, [aria-hidden="true"]:not(.mind-panel), [hidden]:not(.mind-panel), [data-assistant-root], .filter, .project-card, [data-project-empty], .credential-lane, .credential-explore-hint').forEach(element => element.remove());
    clone.querySelectorAll("p, div, li, dt, dd, h1, h2, h3, h4, br, span").forEach(element => element.append(" "));
    return compact(clone.textContent);
  }
  function extractDocument(document, pathname = "index.html") {
    const sections = [...document.querySelectorAll("main .section[id]")];
    return (sections.length ? sections : [...document.querySelectorAll("main")]).flatMap((node, index) => {
      const clone = node.cloneNode(true);
      if (/Not active yet/i.test(clone.querySelector(".contact-details")?.textContent || "")) clone.querySelector(".contact-details").remove();
      if (/Profiles coming soon/i.test(clone.querySelector(".contact-networks")?.textContent || "")) clone.querySelector(".contact-networks").remove();
      const text = readable(clone);
      return text ? [{ id:`page:${pathname}:${node.id || index}`, kind:"section", section:node.id || "", title:compact(node.querySelector("h1,h2,h3")?.textContent) || compact(document.title), text:text.slice(0, 14000), href:safeHref(pathname + (node.id ? "#" + node.id : "")) }] : [];
    });
  }
  function projectSources(projects, document) {
    return [...document.querySelectorAll("#project-list [data-project]")].map(card => {
      const key = card.dataset.project;
      const data = Object.hasOwn(projects || {}, key) ? projects[key] || {} : {};
      const fields = { title:compact(data.title || card.querySelector(".project-title")?.textContent), status:compact(data.status), role:compact(data.role),
        type:strings(data.type).length ? strings(data.type) : [compact(card.querySelector(".project-footer > span")?.textContent)].filter(Boolean),
        date:compact(data.date || card.querySelector("time")?.textContent), mode:compact(data.mode), technologies:strings(data.technologies), description:compact(data.description) };
      return {id:`project:${key}`, kind:"project", project:key, title:fields.title, fields, text:Object.values(fields).flat().filter(Boolean).join(". "), href:"index.html#projects"};
    });
  }
  function credentialSources(data) {
    return ["certificates", "achievements"].flatMap(key => (Array.isArray(data?.[key]) ? data[key] : []).flatMap(entry => {
      if (!entry || entry.pending === true || !/^[\w-]{1,80}$/.test(entry.id || "") || !compact(entry.title)) return [];
      const title = compact(entry.title);
      return [{id:`credential:${entry.id}`, kind:"section", section:"certificates", title,
        text:[title, compact(entry.subtitle), compact(entry.year), compact(entry.description)].filter(Boolean).join(" · "), href:"index.html#certificates"}];
    }));
  }
  function profileSource(document) {
    if (!document.querySelector(".name, .profile-facts")) return null;
    const fields = { name:compact(document.querySelector(".name")?.textContent) || compact(document.title), about:strings([...document.querySelectorAll(".about-introduction p")].map(node => node.textContent)) };
    for (const row of document.querySelectorAll(".profile-facts > div")) {
      const label = normalize(row.querySelector("dt")?.textContent);
      if (label === "based in") fields.location = compact(row.querySelector("dd")?.textContent);
      if (label === "education") fields.education = compact(row.querySelector("dd")?.textContent);
    }
    fields.languages = compact(document.querySelector(".profile-languages dd")?.textContent);
    fields.strengths = strings([...document.querySelectorAll("#about-me .mind-strengths li")].map(node => node.textContent));
    fields.creative = strings([...document.querySelectorAll("#about-me .mind-interest > span:first-child")].map(node => readable(node)));
    fields.details = [...document.querySelectorAll("#about-me .mind-note dl > div")].map(row => ({label:compact(row.querySelector("dt")?.textContent),value:compact(row.querySelector("dd")?.textContent)})).filter(row=>row.value);
    return {id:"profile", kind:"profile", title:fields.name, fields, text:Object.values(fields).flat().filter(Boolean).map(value=>typeof value==="object" ? `${value.label}: ${value.value}` : value).join(". "), href:"index.html#about-me"};
  }
  function manualSources(data) {
    return (Array.isArray(data?.entries) ? data.entries : []).flatMap(entry => {
      if (entry?.published !== true || !/^[\w-]{1,80}$/.test(entry.id || "")) return [];
      const questions = Array.isArray(entry.questions) ? strings(entry.questions) : [...strings(entry.questions?.es), ...strings(entry.questions?.en)];
      const variants = Object.fromEntries(["es","en"].map(lang=>[lang, Array.isArray(entry.answers?.[lang]) ? strings(entry.answers[lang]) : [compact(entry.answers?.[lang])].filter(Boolean)]));
      const answers = {es:variants.es[0] || "", en:variants.en[0] || ""};
      const text = compact(entry.text) || answers.en || answers.es;
      return text ? [{id:`personal:${entry.id}`, kind:"manual", title:compact(entry.title) || "David", text:text.slice(0, 8000), answers, variants, questions,
        keywords:strings(entry.keywords), href:safeHref(entry.href), ...(entry.project && /^[\w-]+$/.test(entry.project) ? {project:entry.project} : {})}] : [];
    });
  }

  const stop = new Set("a an the of for is are does do did and or to me you he she it about tell what which who how his her can could please david menjivar que cual cuales como donde de del la las el los un una y o es son sobre me te su sus tiene puede puedes por para favor dime saber cuentame tell would like want know quiero conocer saber this that en in on with con han ha have has fue was".split(" "));
  const tokens = value => [...new Set(words(value).filter(token => token.length > 1 && !stop.has(token)))];
  function near(a, b) {
    if (a === b) return true;
    if (Math.min(a.length,b.length) < 5 || Math.abs(a.length-b.length) > 1) return false;
    let i=0, j=0, edits=0;
    while (i<a.length && j<b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length>b.length) i++;
      else if (b.length>a.length) j++;
      else if (a[i] === b[j+1] && a[i+1] === b[j]) { i+=2; j+=2; }
      else { i++; j++; }
    }
    return edits + (i<a.length || j<b.length ? 1 : 0) <= 1;
  }
  const fieldTerms = {
    technologies:["technology","technologies","tech","stack","tecnologia","tecnologias","herramientas","programming languages","lenguajes","con que esta hecho","con que lo hizo","con que hizo","con que esta construido","built with","made with","what does it use"],
    role:["role","rol","funcion","desempeno","responsabilidad","responsibilities","que hizo david","que hiciste","what did david do","his part","su parte"],
    status:["status","estado","completed","finished","finalizado","terminado","prototype","prototipo","in development","en desarrollo","esta listo","ya esta listo","is it ready"],
    mode:["team","individual","solo","equipo","grupal","grupales","modalidad","collaboration","colaboracion"],
    date:["year","date","when","fecha","ano","cuando"],
    description:["description","descripcion","purpose","purpose of","objetivo","proposito","why","por que","para que sirve","de que trata","what is it for"],
    type:["type","tipo","que tipo","project type","tipo de proyecto","kind of project"]
  };
  function intent(query, terms) { return has(query,terms) || tokens(query).some(word => terms.some(term => !term.includes(" ") && near(word,term))); }
  function referencedProjects(projects, query) {
    const qwords = words(query);
    return projects.filter(project => [normalize(project.title), normalize(project.project)].some(name => has(query,[name]) || qwords.includes(name.replace(/ /g,"")) || (!name.includes(" ") && qwords.some(word => near(word,name)))));
  }
  const links = items => [...new Map(items.map(({id,title,href,project}) => [id,{id,title,href,...(project ? {project} : {})}])).values()];
  const translated = (value, lang) => {
    if (lang !== "es") return value;
    const dictionary = {"Frontend / Backend":"Frontend / Backend", "High School":"Educación secundaria", English:"Inglés", Spanish:"Español", French:"Francés", "Web App":"Aplicación web", "Mobile App":"Aplicación móvil", Prototype:"Prototipo", "Informative Web":"Web informativa", "Smart Bin":"Basurero inteligente"};
    return value.split(/(\s*\/\s*)/).map(part => dictionary[part] || part).join("");
  };
  function fieldValue(project, field, lang) {
    const raw = project.fields[field];
    if (field === "status") return ({completed:{es:"Finalizado",en:"Completed"},prototype:{es:"Prototipo",en:"Prototype"},"in-development":{es:"En desarrollo",en:"In development"}})[raw]?.[lang] || "";
    if (field === "mode") return ({individual:{es:"Trabajo individual",en:"Individual project"},team:{es:"Trabajo grupal",en:"Team project"}})[raw]?.[lang] || "";
    return Array.isArray(raw) ? raw.map(value => translated(value,lang)).join(" / ") : translated(raw || "",lang);
  }
  const labels = {es:{technologies:"Tecnologías",role:"Rol",status:"Estado",mode:"Modalidad",date:"Fecha de desarrollo",description:"Descripción",type:"Tipo"}, en:{technologies:"Technologies",role:"Role",status:"Status",mode:"Collaboration",date:"Development date",description:"Description",type:"Type"}};
  const semanticGroups = [
    ["motivation","why","inspired","inspiration","motivo","motivo","motivacion","inspiro","porque"],
    ["create","created","build","built","develop","developed","crear","creo","creado","desarrollo","desarrollar","hizo","hacer"],
    ["technology","technologies","stack","herramientas","tecnologias","tecnologia"],
    ["role","rol","funcion","responsabilidad","desempeno"],
    ["study","school","education","estudia","estudios","educacion","formacion"],
    ["interests","hobbies","intereses","pasatiempos","gustos"],
    ["cost","price","money","coste","costo","dinero","precio"],
    ["year","date","when","fecha","ano","cuando"],
    ["compare","comparison","diferencia","diferencias","comparar","compara","comparalos"],
    ["want","wants","looking","busca","buscando","quiere"]
  ];
  function semanticTokens(text) {
    const clean=normalize(text).replace(/\bpor que\b/g,"motivation").replace(/\bnode js\b/g,"nodejs").replace(/\badonis js\b/g,"adonisjs").replace(/\bjs\b/g,"javascript");
    return [...new Set(tokens(clean).filter(word=>!['please','podrias','quisiera','gustaria','sabes','saber','podrias','puede','podrias','acerca','behind','reason','razon','le','te','lo','ahora','bien','bro'].includes(word)).map(word=>semanticGroups.find(group=>group.includes(word))?.[0] || word))];
  }
  function questionFocus(q) {
    if(has(q,["why","por que","motivacion","motivo","inspired","inspiration","inspiro"]))return "motivation";
    if(has(q,["how much","money","cost","coste","costo","precio","dinero","salary","salario"]))return "money";
    if(has(q,["who","quien"]))return "person";
    if(has(q,["where","donde"]))return "location";
    if(has(q,["when","cuando","year","fecha"]))return "date";
    return "general";
  }
  function matchAuthored(sources,q) {
    const qt=semanticTokens(q), focus=questionFocus(q);
    const projects=sources.filter(s=>s.kind==="project");
    const queryProjects=referencedProjects(projects,q).map(p=>p.project);
    const candidates=sources.filter(s=>s.kind==="manual").map(source=>{
      const scores=source.questions.map(pattern=>{
        const p=normalize(pattern);if(p===q)return 2;
        const patternProjects=referencedProjects(projects,p).map(p=>p.project);
        if(queryProjects.length&&(source.project&&!queryProjects.includes(source.project)||patternProjects.some(id=>!queryProjects.includes(id))))return 0;
        const pf=questionFocus(p);
        if(focus!=="general"&&pf!=="general"&&focus!==pf)return 0;
        const pt=semanticTokens(p);
        const count=pt.filter(word=>qt.some(token=>near(word,token))).length;
        if(count<2)return 0;
        // Balance precision and recall; merely sharing a project name is insufficient.
        const precision=count/Math.max(qt.length,1), recall=count/Math.max(pt.length,1);
        return precision>=.6&&recall>=.6 ? (2*precision*recall/(precision+recall))+(focus===pf&&focus!=="general"?.08:0) : 0;
      });
      return {source,score:Math.max(0,...scores)};
    }).filter(item=>item.score>=.72).sort((a,b)=>b.score-a.score);
    return candidates[0]&&(!candidates[1]||candidates[0].score-candidates[1].score>.04) ? candidates[0].source : null;
  }

  // Curated, stable explanations. These describe concepts, never David's biography.
  const glossary = [
    {terms:["html"],es:"HTML organiza el contenido de una página: títulos, párrafos, enlaces y formularios. Es su estructura.",en:"HTML organizes a page's content: headings, paragraphs, links, and forms. It's the structure."},
    {terms:["css"],es:"CSS define cómo se ve una página: colores, distribución, tipografía y animaciones. HTML pone la estructura; CSS le da estilo.",en:"CSS controls how a page looks: colors, layout, typography, and animation. HTML supplies structure; CSS adds the style."},
    {terms:["javascript","js"],es:"JavaScript añade comportamiento: un botón que abre una ficha, un filtro de proyectos o este chat que responde a lo que escribes.",en:"JavaScript adds behavior: a button opening a project, a filter, or this chat responding to what you type."},
    {terms:["python"],es:"Python es un lenguaje de programación de propósito general. Se usa, por ejemplo, para automatizar tareas y trabajar con datos; eso no significa que todos esos usos aparezcan en los proyectos de David.",en:"Python is a general-purpose programming language, used for things like automation and data processing. That doesn't mean all those uses appear in David's projects."},
    {terms:["pwa"],es:"Una PWA es una aplicación web que puede ofrecer funciones como instalación y uso sin conexión, según cómo esté construida. Que un proyecto tenga esa etiqueta no confirma cuáles implementa.",en:"A PWA is a web application that can offer features such as installation and offline use, depending on its implementation. A project's label doesn't confirm which features it includes."},
    {terms:["frontend","front end"],es:"El frontend es la parte con la que interactúas: pantallas, botones y navegación. Es lo que ves y utilizas en el navegador.",en:"The frontend is the part you interact with: screens, buttons, and navigation. It's what you see and use in the browser."},
    {terms:["backend","back end"],es:"El backend trabaja del lado del servidor: procesa peticiones, aplica la lógica y puede gestionar datos. Es lo que ocurre detrás de la interfaz.",en:"The backend runs on the server: it handles requests, applies logic, and can manage data. It's what happens behind the interface."},
    {terms:["nodejs","node js"],es:"Node.js permite ejecutar JavaScript fuera del navegador, por ejemplo para crear un servidor o automatizar tareas.",en:"Node.js runs JavaScript outside the browser, for example to build a server or automate tasks."},
    {terms:["prototype","prototipo"],es:"Un prototipo sirve para explorar y probar una idea antes de terminar el producto. Puede mostrar el diseño o parte del funcionamiento sin ser una versión final.",en:"A prototype explores and tests an idea before the product is finished. It may demonstrate the design or some behavior without being a final release."}
  ];
  const joinList=(items,es)=>items.length<2 ? items.join("") : items.slice(0,-1).join(", ")+(es?" y ":" and ")+items.at(-1);
  function calculate(question) {
    const percent=/(\d+(?:[.,]\d+)?)\s*(?:%|por ciento|percent)\s*(?:de|of)\s*(\d+(?:[.,]\d+)?)/i.exec(question);
    if(percent)return {expression:`${percent[1]}% × ${percent[2]}`,value:Number(percent[1].replace(',','.'))*Number(percent[2].replace(',','.'))/100};
    const expression=question.match(/(?:\d|\()[\d\s.,()+*/^−×÷-]*[+*/^−×÷-][\d\s.,()+*/^−×÷-]*/)?.[0]?.trim();
    if(!expression||expression.length>100)return null;
    const raw=expression.replace(/,/g,'.').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');
    const parts=raw.match(/\d+(?:\.\d+)?|[()+*/^-]/g)||[];
    if(parts.join('')!==raw.replace(/\s/g,'')||parts.length>50)return null;
    let i=0;
    function atom(){const token=parts[i++];if(token==='-')return -atom();if(token==='+')return atom();if(token==='('){const n=sum();if(parts[i++]!==')')throw Error();return n;}if(!/^\d/.test(token||''))throw Error();return Number(token);}
    function power(){let n=atom();if(parts[i]==='^'){i++;n=n**power();}return n;}
    function product(){let n=power();while(parts[i]==='*'||parts[i]==='/'){const op=parts[i++],r=power();if(op==='/'&&r===0)throw Error();n=op==='*'?n*r:n/r;}return n;}
    function sum(){let n=product();while(parts[i]==='+'||parts[i]==='-'){const op=parts[i++],r=product();n=op==='+'?n+r:n-r;}return n;}
    try{const n=sum();if(i!==parts.length||!Number.isFinite(n)||Math.abs(n)>1e15)return {error:true};return {expression,value:Number(n.toPrecision(12))};}catch{return {error:true};}
  }

  function answer(sources, question, {lang="en",context={}}={}) {
    const es=lang==="es",q=normalize(question),turn=Number.isSafeInteger(context.turn)?context.turn:0;
    const projects=sources.filter(s=>s.kind==="project"),profile=sources.find(s=>s.kind==="profile");
    const seed=words(q).join('').split('').reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)+turn;
    const choose=options=>{const pool=options.filter(text=>text!==context.lastAnswer);return (pool.length?pool:options)[seed%(pool.length||options.length)];};
    const projectQuestions=(p,used=[])=>[
      {field:"technologies",text:es?`¿Con qué está hecho ${p.title}?`:`What is ${p.title} built with?`},
      {field:"role",text:es?`¿Qué rol tuvo David en ${p.title}?`:`What was David's role in ${p.title}?`},
      {field:"date",text:es?`¿Cuándo desarrolló ${p.title}?`:`When was ${p.title} developed?`},
      {field:"status",text:es?`¿Está terminado ${p.title}?`:`Is ${p.title} finished?`}
    ].filter(item=>!used.includes(item.field)&&(!p.fields||fieldValue(p,item.field,lang))).map(item=>item.text).slice(0,2);
    const reply=(text,items=[],next=context,suggestions=[])=>({answer:text,sources:links(items),context:{...next,turn:turn+1,lastAnswer:text},suggestions:suggestions.slice(0,2)});
    const unknown=(items=[])=>reply(es ? "No tengo esa información registrada, pero puedo ayudarte con los proyectos o las habilidades de David." : "I don't have that information yet, but I can help with David's projects or skills.",items,context,items[0]?.kind==="project"?projectQuestions(items[0]):es?["¿Qué proyectos tiene David?","¿Cuáles son sus habilidades?"]:["What projects has David built?","What are his skills?"]);
    if(!q)return unknown();
    const authored=matchAuthored(sources,q);
    if(authored){const variants=authored.variants?.[lang]||[];return reply(variants.length?choose(variants):authored.answers[lang]||(es?"Lo tengo en su idioma original:\n":"I have this in its original language:\n")+authored.text,[authored],{topic:"manual",...(authored.project?{projectId:authored.project}:{})});}

    const mentioned=referencedProjects(projects,q);
    const plural=has(q,["projects","proyectos","trabajos","cuales","which projects"]);
    const comparison=intent(q,["compare","comparison","comparar","compara","comparalos","diferencia","diferencias","versus","vs"]);
    let fields=Object.keys(fieldTerms).filter(key=>intent(q,fieldTerms[key]));
    const explicitlyPersonal=has(q,["david","his","he","su","sus"]);
    const profileQuestion=has(q,["quien es david","who is david","sobre david","about david","idiomas","languages","habla","speak","estudia","school","education","educacion","formacion","intereses","interests","pasatiempos","hobbies","fortalezas","strengths"]);
    const definition=!mentioned.length&&!explicitlyPersonal&&(has(q,["que es","que significa","what is","what does","explain","explica","explicame","difference between","diferencia entre"])||(context.topic==="concept"&&words(q).length<7));
    if(definition){const entries=glossary.filter(item=>has(q,item.terms));if(entries.length)return reply(entries.map(item=>item[lang]).join("\n\n"),[],{topic:"concept",concepts:entries.map(item=>item.terms[0])});}
    if(explicitlyPersonal&&has(q,["favorite","favorito","favorita","birthday","nacimiento","edad","age","salary","salario","password","contrasena"]))return unknown(mentioned);

    // Casual replies are explicitly authored or playful; none assert personal facts.
    if(/^(hola|hello|hi|hey|buenas|buenos dias|buenas tardes|que onda|que tal)( bro| man| amigo| amiga| buenas| todo| david)*$/.test(q))return reply(choose(es?["¡Hey! ¿Qué te da curiosidad hoy? Podemos explorar un proyecto o conversar un rato.","¡Hola! Aquí estoy. ¿Vienes por los proyectos o por una charla rápida?","¡Buenas! Dime qué tienes en mente y lo vemos."]:["Hey! What's on your mind? We can explore a project or just chat for a bit.","Hi there! Here for the projects, or a quick conversation?","Hello! What are you curious about today?"]));
    if(/^(muchas |mil |muchisimas )?(gracias|thanks|thank you)( bro| man| amigo| a ti| por todo| mucho)*$/.test(q))return reply(choose(es?["¡Con gusto! ¿Seguimos explorando?","Para eso estoy. ¿Qué más te da curiosidad?","¡De nada! Cuando quieras, seguimos."]:["You're welcome! What else are you curious about?","Anytime. Want to keep exploring?","Glad that helped. I'm here if you need anything else."]));
    if(has(q,["como estas","como vas","how are you","how is it going","how are things"])&&!mentioned.length&&!fields.length)return reply(choose(es?["Listo para una buena charla. ¿Tú qué tal?","Por aquí, con los proyectos a mano y ganas de conversar. ¿Cómo va tu día?"]:["Ready for a good conversation. How's your day going?","Here with the portfolio at hand. What have you been up to?"]));
    if(has(q,["quien eres","eres una ia","eres humano","who are you","are you human","are you an ai"]))return reply(es?"Soy la guía de este portafolio. Respondo con sus datos y con lo que me enseñamos aquí; también puedo charlar, contar un chiste o inventar un pequeño poema. No soy David ni una persona.":"I'm this portfolio's guide. I use its information and the answers we're taught here; I can also chat, share a joke, or put together a short poem. I'm not David or a person.",[],context);
    if(has(q,["que puedes hacer","que sabes hacer","ayuda","help me","what can you do","help"])&&!mentioned.length)return reply(es?"Puedo comparar proyectos, contarte qué hizo David, buscar tecnologías y llevarte a una sección. También podemos salir del tema: un chiste, un acertijo o un mini poema. ¿Qué te apetece?":"I can compare projects, explain David's role, look up technologies, and take you to a section. We can also switch gears with a joke, a riddle, or a short poem. What sounds good?",[],context,es?["Compara Beyond y Plant Bud","Cuéntame un chiste"]:["Compare Beyond and Plant Bud","Tell me a joke"]);
    if(has(q,["no responde","no te pregunte eso","no entendiste","eres tonto","you misunderstood","that is not what i asked","wrong answer","you are stupid"]))return reply(es?"Va, probemos de otra forma. Dime qué parte quieres saber y voy directo a eso.":"Let's try that again. Tell me which part you meant, and I'll focus on that.",[],context,context.projectId?projectQuestions(projects.find(p=>p.project===context.projectId)||projects[0]||{title:"Beyond"}):[]);
    if(/^(adios|hasta luego|nos vemos|bye|goodbye|see you)( bro| man| amigo)?$/.test(q))return reply(choose(es?["¡Nos vemos! Aquí queda el portafolio para cuando quieras volver.","¡Hasta luego! Que tengas un buen día."]:["See you! The portfolio will be here whenever you want to come back.","Take care. Have a good day!"]));
    if(has(q,["estoy triste","me siento mal","estoy solo","estoy cansado","i am sad","i feel down","i feel lonely","i am tired"]))return reply(es?"Siento que estés pasando un rato así. Podemos hablar de lo que te apetezca o distraernos un poco con algo ligero. ¿Qué prefieres?":"I'm sorry it's a rough moment. We can talk about what's on your mind, or take a small break with something light. What would you prefer?",[],{topic:"chat"},es?["Cuéntame algo divertido","Dame una idea creativa"]:["Tell me something funny","Give me a creative idea"]);
    const again=/^(otro|otra|uno mas|una mas|mas|otra vez|another|one more|more|again|y otra|y otro)( por favor| please)?$/.test(q);
    const casualAgain=again&&["joke","poem","riddle","idea"].includes(context.topic);
    const joke=has(q,["chiste","chistes","joke","funny","algo divertido","hazme reir"])||(casualAgain&&context.topic==="joke");
    if(joke)return reply(choose(es?["Mi CSS pidió espacio personal. Le puse margin y por fin nos entendimos.","Mi botón quería ser misterioso: escondió su función detrás de tres menús. Lo despedimos por exceso de intriga.","Le puse modo oscuro a mis ideas. Ahora los errores se ven más elegantes, pero siguen ahí.","El píxel llegó tarde a la reunión. Dijo que se había quedado atascado en una cuadrícula."]:["My CSS asked for personal space. I gave it margin, and we finally got along.","My button wanted to be mysterious, so it hid behind three menus. We let it go for excessive intrigue.","I gave my ideas a dark mode. The mistakes look more elegant now, but they're still there.","A pixel arrived late to the meeting. Apparently it got stuck in a grid."]),[],{topic:"joke"});
    if(context.topic==="riddle"&&context.riddle&&has(q,["respuesta","solucion","answer","solution","me rindo","give up"]))return reply((es?"Era ":"It was ")+context.riddle[lang]+(es?". ¿Te propongo otro?":". Want another one?"),[],{topic:"riddle"});
    if(context.topic==="riddle"&&context.riddle&&has(q,context.riddle.accept))return reply(es?"¡Exacto! Lo resolviste. ¿Vamos con otro?":"Exactly! You got it. Up for another?",[],{topic:"riddle"});
    if(has(q,["acertijo","adivinanza","riddle","puzzle"])||(casualAgain&&context.topic==="riddle")){
      const riddles=[{es:"Tengo teclas pero no abro puertas. Puedo ayudarte a escribir un mundo entero. ¿Qué soy?",en:"I have keys but open no doors. I can help you write an entire world. What am I?",answer:{es:"un teclado",en:"a keyboard",accept:["teclado","keyboard"]}},{es:"Me haces más grande quitándome cosas. ¿Qué soy?",en:"You make me bigger by taking things away. What am I?",answer:{es:"un agujero",en:"a hole",accept:["agujero","hoyo","hole"]}}];
      const pool=riddles.filter(item=>item[lang]!==context.lastAnswer);const selected=pool[seed%pool.length];return reply(selected[lang],[],{topic:"riddle",riddle:selected.answer},[es?"Dame la respuesta":"Tell me the answer"]);
    }
    if(has(q,["poema","poem","poesia","poetry","verso"])||(casualAgain&&context.topic==="poem")){
      const starts=es?["Una idea en la pantalla,","La noche guarda un destello,","Entre líneas nace un mundo,"]:["An idea lights the screen,","The night keeps one small spark,","Between the lines, a world unfolds,"];
      const middles=es?["un pequeño intento de empezar.","una pregunta aprende a caminar.","la duda se transforma al intentar."]:["a little chance to start.","a question learns to find its way.","a doubt becomes a work of art."];
      const ends=es?["No hace falta verlo todo:\nbasta un paso para avanzar.","Lo que hoy parece un boceto\nmañana encuentra su lugar."]:["You needn't see the whole way through:\none step can make a start.","What looks like just a sketch today\nmay find its shape another day."];
      return reply((es?"Un mini poema:\n\n":"A little poem:\n\n")+starts[seed%starts.length]+"\n"+middles[(seed+turn)%middles.length]+"\n"+ends[seed%ends.length],[],{topic:"poem"});
    }
    if(has(q,["idea creativa","creative idea","sorprendeme","surprise me","algo random","something random","estoy aburrido","i am bored","inspirame","inspire me"])||(casualAgain&&context.topic==="idea"))return reply(choose(es?["Una idea rápida: inventa una web para un objeto cotidiano, como una taza que se toma demasiado en serio. Ponle nombre, una función absurda y un botón dramático. ¿Cómo la llamarías?","Pequeño reto creativo: describe tu día como si fuera un videojuego. ¿Cuál fue la misión principal y qué objeto raro encontraste?","Probemos algo: una ciudad donde los semáforos cambian según la música. ¿Sería un caos o el mejor concierto del mundo?"]:["A quick idea: invent a website for an everyday object, like a mug that takes itself far too seriously. Give it a name, an absurd feature, and a dramatic button. What would you call it?","A little creative challenge: describe your day as a video game. What was the main quest, and what unusual item did you find?","Imagine a city where traffic lights change with the music. Would it be chaos, or the world's greatest concert?"]),[],{topic:"idea"});
    if(has(q,["age","how old","edad","birth","birthday","nacio","nacimiento","address","direccion","salary","salario","sueldo","girlfriend","novia","boyfriend","novio","password","contrasena","religion","political","politica","favorite","favorito","favorita","users","usuarios","revenue","ingresos","secure","seguro","security","seguridad","cuanto gano","how much money"]))return unknown(mentioned);
    const calculation=!mentioned.length&&!profileQuestion?calculate(question):null;
    if(calculation)return reply(calculation.error?(es?"Esa operación no da un resultado válido. Revisa los paréntesis y que no haya una división entre cero.":"That calculation doesn't give a valid result. Check the parentheses and any division by zero."):`${calculation.expression} = ${calculation.value}`,[],{topic:"math"});

    const techQuery=q.replace(/\bnode js\b/g,"nodejs").replace(/\badonis js\b/g,"adonisjs").replace(/\bjs\b/g,"javascript");
    const allTech=[...new Set(projects.flatMap(p=>p.fields.technologies))];
    const catalog=[...new Set([...allTech,"React","Vue","Svelte","Angular","TypeScript","Rust","Go","Java","Kotlin","Swift","PHP","Ruby","Python","HTML","CSS","JavaScript","Node.js","AdonisJS"])];
    const requestedTech=catalog.filter(tech=>has(techQuery,[normalize(tech).replace(/ /g,"")]));
    const recommendation=has(q,["recommend","recomiendas","recomendarias","por donde empiezo","where should i start","cual es mejor","which is best"]);
    const overview=has(q,["cuentame","tell me about","overview","resumen","summary","de que trata","presentame"]);
    const short=has(q,["mas corto","mas breve","resumelo","shorter","briefly","in short"]);
    let selected=mentioned;
    const previous=(context.projectIds||[context.projectId]).filter(Boolean).map(id=>projects.find(p=>p.project===id)).filter(Boolean);
    if(!selected.length&&!profileQuestion&&!plural&&(fields.length||short||comparison||has(q,["mas detalles","cuentame mas","un poco mas","tell me more","y el otro","the other one","ese","that one"])||(context.topic==="comparison"&&requestedTech.length)))selected=previous;
    const ordinal=["primero","first","segundo","second","tercero","third"].find(word=>has(q,[word]));
    if(!selected.length&&ordinal&&context.candidateIds){const index={primero:0,first:0,segundo:1,second:1,tercero:2,third:2}[ordinal];selected=projects.filter(p=>p.project===context.candidateIds[index]);}
    if(!mentioned.length&&has(q,["el otro","the other one"])&&context.candidateIds?.length){
      const other=projects.filter(p=>context.candidateIds.includes(p.project)&&p.project!==context.projectId);
      if(other.length===1)selected=other;
      else if(other.length>1)return reply(es?"¿Cuál de estos quieres explorar?":"Which of these would you like to explore?",other,{...context},other.slice(0,2).map(p=>es?`Cuéntame sobre ${p.title}`:`Tell me about ${p.title}`));
    }
    if(mentioned.length&&context.projectId&&has(q,["otro","other"])&&mentioned[0].project===context.projectId)selected=previous.filter(p=>p.project!==context.projectId);
    if(selected.length&&!fields.length&&!overview&&words(q).length<7&&mentioned.length&&context.fields?.length)fields=context.fields;
    if(comparison&&!selected.length&&context.candidateIds?.length)selected=context.candidateIds.map(id=>projects.find(p=>p.project===id)).filter(Boolean).slice(0,2);
    if(comparison&&selected.length===1)return reply(es?`¿Con cuál otro proyecto quieres comparar ${selected[0].title}?`:`Which other project would you like to compare ${selected[0].title} with?`,selected,{topic:"comparison",projectId:selected[0].project});
    if(comparison&&selected.length>=2){
      const [a,b]=selected;const shared=a.fields.technologies.filter(tech=>b.fields.technologies.includes(tech));
      const lines=[es?`${a.title} y ${b.title}, lado a lado:`:`${a.title} and ${b.title}, side by side:`];
      if(shared.length)lines.push(es?`Comparten ${joinList(shared,true)}.`:`Both list ${joinList(shared,false)}.`);
      const compareFields=fields.length?fields:["type","date","technologies","role"];
      for(const p of [a,b])lines.push(`${p.title}: `+compareFields.flatMap(field=>{const value=fieldValue(p,field,lang);return value?[`${labels[lang][field]}: ${value}`]:[];}).join(" · ")+(compareFields.some(field=>!fieldValue(p,field,lang))?(es?". Algunos detalles aún no están registrados.":". Some details aren't recorded yet."):""));
      return reply(lines.join("\n\n"),[a,b],{topic:"comparison",projectIds:[a.project,b.project],fields:compareFields});
    }
    if(recommendation&&projects.length){
      const candidates=selected.length?selected:projects;
      const p=[...candidates].sort((a,b)=>b.fields.technologies.length-a.fields.technologies.length)[0];
      return reply(es?`Yo empezaría por ${p.title}: su ficha tiene ${p.fields.technologies.length?"tecnologías registradas que puedes explorar":"información para una primera mirada"}. Es una sugerencia para recorrer el portafolio, no una clasificación de cuál proyecto es mejor.`:`I'd start with ${p.title}: its file has ${p.fields.technologies.length?"listed technologies you can explore":"information for a first look"}. That's a starting point for browsing, not a ranking of project quality.`,[p],{topic:"project",projectId:p.project},projectQuestions(p));
    }
    if(selected.length){
      if(requestedTech.length&&!fields.length&&!overview){
        const text=selected.map(p=>requestedTech.map(tech=>p.fields.technologies.includes(tech)?(es?`${tech} sí aparece entre las tecnologías de ${p.title}.`:`${tech} is listed among ${p.title}'s technologies.`):(es?`No tengo ${tech} registrado para ${p.title}.`:`I don't have ${tech} recorded for ${p.title}.`)).join("\n")).join("\n\n");
        return reply(text,selected,{topic:"project",projectId:selected.length===1?selected[0].project:undefined,projectIds:selected.map(p=>p.project),candidateIds:context.candidateIds},projectQuestions(selected[0]));
      }
      const describeField=(p,field)=>{
        const value=fieldValue(p,field,lang);if(!value)return es?`De ${p.title} todavía no tengo ${labels.es[field].toLowerCase()} registrado.`:`I don't have ${p.title}'s ${labels.en[field].toLowerCase()} recorded yet.`;
        if(field==="technologies")return choose(es?[`${p.title} usa ${joinList(p.fields.technologies,true)}.`,`Para ${p.title}, las tecnologías registradas son ${joinList(p.fields.technologies,true)}.`]:[`${p.title} uses ${joinList(p.fields.technologies,false)}.`,`The stack listed for ${p.title} is ${joinList(p.fields.technologies,false)}.`]);
        if(field==="role")return choose(es?[`En ${p.title}, el rol de David fue ${value}.`,`David participó en ${p.title} con el rol de ${value}.`]:[`David's role in ${p.title} was ${value}.`,`For ${p.title}, David's listed role was ${value}.`]);
        if(field==="date")return es?`${p.title} figura con fecha de desarrollo ${value}.`:`${p.title}'s development date is listed as ${value}.`;
        if(field==="mode")return es?`${p.title} figura como ${value.toLowerCase()}.`:`${p.title} is listed as ${p.fields.mode==="team"?"a":"an"} ${value.toLowerCase()}.`;
        if(field==="status")return es?`El estado registrado de ${p.title} es «${value.toLowerCase()}».`:`${p.title}'s recorded status is “${value.toLowerCase()}”.`;
        return `${p.title} · ${labels[lang][field]}: ${value}`;
      };
      const text=selected.map(p=>{
        if(fields.length)return fields.map(field=>describeField(p,field)).join("\n");
        const intro=es?`${p.title} es un proyecto de ${fieldValue(p,"type",lang)||"este portafolio"}${p.fields.date?`, con fecha de desarrollo ${p.fields.date}`:""}.`:`${p.title} is a ${fieldValue(p,"type",lang)||"portfolio"} project${p.fields.date?`, with a development date of ${p.fields.date}`:""}.`;
        if(short)return intro;
        return [intro,p.fields.role&&describeField(p,"role"),p.fields.technologies.length&&describeField(p,"technologies"),p.fields.description].filter(Boolean).join("\n");
      }).join("\n\n");
      return reply(text,selected,{topic:"project",projectId:selected.length===1?selected[0].project:undefined,projectIds:selected.map(p=>p.project),candidateIds:context.candidateIds,fields},selected.length===1?projectQuestions(selected[0],fields):[]);
    }

    const namedTech=requestedTech;
    const listRequest=plural||has(q,["project","proyecto","portfolio","portafolio","que ha hecho","what has david built","en que ha trabajado","what has he built","what is david working on"])||((context.topic==="list")&&(fields.length||/\b(?:19|20)\d{2}\b/.test(q)));
    if(listRequest||namedTech.length){
      let list=[...projects];const year=/\b(?:19|20)\d{2}\b/.exec(q)?.[0];if(year)list=list.filter(p=>p.fields.date.includes(year));
      const negated=has(q,["sin","without","not using","no usan","no utiliza"]);
      if(namedTech.length)list=list.filter(p=>p.fields.technologies.length&&namedTech.every(tech=>negated?!p.fields.technologies.includes(tech):p.fields.technologies.includes(tech)));
      const state=has(q,["completed","finished","finalizado","finalizados","terminado","terminados"]) ? "completed" : has(q,["prototype","prototipo","prototipos"]) ? "prototype" : has(q,["in development","en desarrollo"]) ? "in-development" : "";
      if(state)list=list.filter(p=>p.fields.status===state);
      const mode=has(q,["team","equipo","grupal","grupales"]) ? "team" : has(q,["individual","individuales","solo"]) ? "individual" : "";
      if(mode)list=list.filter(p=>p.fields.mode===mode);
      const mobile=has(q,["mobile","movil","moviles"]);if(mobile)list=list.filter(p=>p.fields.type.some(type=>/mobile|movil/i.test(type)));
      if(has(q,["latest","newest","recent","reciente","recientes","nuevo","nuevos"])){
        list.sort((a,b)=>(parseInt(b.fields.date)||0)-(parseInt(a.fields.date)||0));
        if(list[0]?.fields.date)list=list.filter(p=>p.fields.date===list[0].fields.date);
      }
      if(!list.length)return reply(es?"No encontré proyectos con esos datos registrados. ¿Probamos con otra tecnología o año?":"I couldn't find projects with those recorded details. Shall we try another technology or year?",[],{topic:"list"});
      const prefix=namedTech.length?(es?`En las tecnologías registradas, ${negated?"no aparece":"aparece"} ${joinList(namedTech,true)} en:`:`In the recorded stacks, ${joinList(namedTech,false)} ${negated?"isn't listed":"is listed"} in:`):choose(es?[`Encontré ${list.length} proyecto${list.length===1?"":"s"}:`,`Estos son los proyectos que encajan (${list.length}):`]:[`I found ${list.length} project${list.length===1?"":"s"}:`,`Here are the matching projects (${list.length}):`]);
      return reply(prefix+"\n"+list.map(p=>`• ${p.title}${p.fields.date?" · "+p.fields.date:""}`).join("\n"),list,{topic:"list",candidateIds:list.map(p=>p.project)},list[0]?projectQuestions(list[0]):[]);
    }
    if(profile){
      const f=profile.fields,parts=[];
      if(intent(q,["languages","idiomas","idioma","speak","habla"])&&f.languages)parts.push(es?`David habla ${translated(f.languages,lang).replace(/\s*\/\s*/g," y ")}.`:`David speaks ${f.languages.replace(/\s*\/\s*/g," and ")}.`);
      if(intent(q,["education","school","estudios","educacion","estudia","estudiante","formacion"])&&f.education)parts.push(es?`Su formación publicada es ${translated(f.education,lang).toLowerCase()}.`:`His listed education is ${f.education.toLowerCase()}.`);
      if((intent(q,["based","location","country","from","live","lives","vive","pais","ubicacion","donde es","de donde"])||(context.topic==="profile"&&has(q,["where","donde"])))&&f.location)parts.push(es?`David está ubicado en ${f.location}.`:`David is based in ${f.location}.`);
      if(intent(q,["interests","hobbies","intereses","interesa","gusta","pasatiempos"])){const text=normalize(f.about.join(" "));const interests=[{term:"mathematics",es:"matemáticas",en:"mathematics"},{term:"technology",es:"tecnología",en:"technology"},{term:"writing",es:"escritura",en:"writing"}].filter(item=>has(text,[item.term])).map(item=>item[lang]);if(interests.length)parts.push(es?`Le interesan ${joinList(interests,true)}.`:`He's interested in ${joinList(interests,false)}.`);}
      if(intent(q,["strengths","fortalezas","personalidad","personality"])&&f.strengths?.length)parts.push((es?"En su perfil menciona estas fortalezas (texto original): ":"His profile lists these strengths: ")+f.strengths.slice(0,5).join(", ")+".");
      if(intent(q,["internship","pasantia","practicas","opportunity","oportunidad","academic path","carrera","career","ingenieria"])){
        const detail=f.details?.filter(d=>has(normalize(d.label),["academic path","my academic path","what im looking for","what i m looking for","what i am looking for"]));
        if(detail?.length)parts.push((es?"Esto cuenta en su perfil (texto original):\n":"Here's what his profile says:\n")+detail.map(d=>d.value).join("\n"));
      }
      if(parts.length)return reply(parts.join("\n"),[profile],{topic:"profile"});
      if(has(q,["who is david","quien es david","about david","sobre david","conocer a david"]))return reply((es?`${f.name}${f.location?", de "+f.location:""}. `:`${f.name}${f.location?", based in "+f.location:""}. `)+(f.education?(es?`Su formación publicada es ${translated(f.education,lang).toLowerCase()}. `:`His listed education is ${f.education.toLowerCase()}. `):"")+(es?"Aquí puedes conocer sus proyectos y su lado creativo.":"You can explore his projects and creative side here."),[profile],{topic:"profile"},es?["¿Qué le interesa?","Muéstrame sus proyectos"]:["What are his interests?","Show me his projects"]);
    }
    if(fields.includes("technologies")||intent(q,["skills","habilidades","programar","coding","programacion"]))return allTech.length?reply((es?"En sus proyectos aparecen ":"His projects list ")+joinList(allTech,es)+".",projects,{topic:"skills"}):unknown();
    const navigation=[{terms:["contact","contacto","contactar","email","correo","phone","telefono"],section:"contact"},{terms:["certificates","certificaciones","certificados","achievements","logros"],section:"certificates"}];
    const target=navigation.find(item=>intent(q,item.terms));
    if(target){const source=sources.find(s=>target.path?s.href===target.path:s.section===target.section);if(source)return reply(target.section==="contact"?(es?"Te dejo la sección de contacto. Los datos de ejemplo todavía no cuentan como canales confirmados.":"Here's the contact section. Placeholder details aren't confirmed contact channels yet."):(es?"Te llevo a esa parte del portafolio. Puedes abrirla aquí:":"Here's that part of the portfolio. You can open it below:"),[source],{topic:"navigation"});}
    const qt=semanticTokens(q);
    const retrieved=sources.filter(s=>s.kind==="section"||s.kind==="manual").flatMap(source=>{
      const sentences=source.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[source.text];
      return sentences.map(text=>{const st=semanticTokens(text);const count=qt.filter(word=>st.some(term=>near(word,term))).length;return {source,text:compact(text),count,coverage:count/Math.max(qt.length,1)};});
    }).filter(item=>item.count>=2&&item.coverage>=.7).sort((a,b)=>b.count-a.count||a.text.length-b.text.length);
    if(retrieved[0])return reply((es?"Encontré esto en el sitio (texto original):\n":"I found this on the site (in its original language):\n")+retrieved[0].text.slice(0,600),[retrieved[0].source],{topic:"quote"});
    return unknown();
  }
  return {compact, normalize, safeHref, detectLanguage, parseProjects, extractDocument, projectSources, credentialSources, profileSource, manualSources, answer};
});
