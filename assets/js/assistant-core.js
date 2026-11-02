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
        fields:{collection:key,date:compact(entry.date),year:compact(entry.year),subtitle:compact(entry.subtitle),description:compact(entry.description)},
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
    fields.networks=[...document.querySelectorAll('#contact .contact-networks a[href^="https://"]')].map(a=>({label:compact(a.querySelector("strong")?.textContent||a.textContent),url:a.getAttribute("href")})).filter(item=>item.label&&/^https:\/\/[^\s<>]+$/.test(item.url));
    return {id:"profile", kind:"profile", title:fields.name, fields, text:Object.values(fields).flat().filter(Boolean).map(value=>typeof value==="object" ? `${value.label}: ${value.value||value.url||""}` : value).join(". "), href:"index.html#about-me"};
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
  function near(a, b, minLength=5) {
    if (a === b) return true;
    if (Math.min(a.length,b.length) < minLength || Math.abs(a.length-b.length) > 1) return false;
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
    technologies:["technology","technologies","tech","stack","tecnologia","tecnologias","herramientas","programming languages","lenguajes","con que esta hecho","con que lo hizo","con que hizo","con que hicieron","con que esta construido","built with","made with","what does it use","programado","programada","desarrollado con","desarrollada con","construido con","construida con","using which","coded in","written in"],
    role:["role","rol","funcion","desempeno","responsabilidad","responsibilities","que hizo david","que hiciste","what did david do","his part","su parte","aporto","aporte","contribucion","contribution","contributed","se encargo"],
    status:["status","estado","completed","finished","finalizado","terminado","prototype","prototipo","in development","en desarrollo","esta listo","ya esta listo","is it ready"],
    mode:["team","individual","solo","equipo","grupal","grupales","modalidad","collaboration","colaboracion","acompanado","por su cuenta","on his own","alone","con otras personas"],
    date:["year","date","when","fecha","ano","cuando"],
    description:["description","descripcion","purpose","purpose of","objetivo","proposito","why","por que","para que sirve","de que trata","what is it for"],
    type:["type","tipo","que tipo","project type","tipo de proyecto","kind of project"]
  };
  const interrogatives=new Set("cuanto cuantos cuantas cuando quien donde como what which where when who how".split(" "));
  function intent(query, terms) { return has(query,terms) || tokens(query).some(word => !interrogatives.has(word)&&terms.some(term => !term.includes(" ") && near(word,term))); }
  function referencedProjects(projects, query) {
    const qwords = words(query);
    return projects.filter(project => [normalize(project.title), normalize(project.project)].some(name => {
      if(has(query,[name]) || qwords.includes(name.replace(/ /g,"")))return true;
      const parts=words(name);
      return parts.length>1 ? qwords.some((_,i)=>parts.every((part,j)=>near(qwords[i+j]||"",part,3))) : qwords.some(word=>near(word,name));
    }));
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
    ["motivation","why","inspired","inspiration","motivo","motivacion","inspiro","porque","razon","reason","impulso","incentivo"],
    ["create","created","build","built","develop","developed","crear","creo","creado","desarrollo","desarrollar","construyo","construir","construido","hizo","hacer"],
    ["technology","technologies","stack","herramientas","tecnologias","tecnologia"],
    ["role","rol","funcion","responsabilidad","desempeno"],
    ["study","school","education","estudia","estudios","educacion","formacion"],
    ["interests","hobbies","intereses","pasatiempos","gustos"],
    ["cost","price","money","coste","costo","dinero","precio"],
    ["year","date","when","fecha","ano","cuando"],
    ["compare","comparison","diferencia","diferencias","comparar","compara","comparalos"],
    ["want","wants","looking","busca","buscando","quiere"],
    ["score","points","puntaje","puntuacion","nota","calificacion","puntos"],
    ["certificate","certificates","certification","certifications","credential","credentials","certificado","certificados","certificacion","certificaciones","credencial","credenciales"],
    ["language","languages","idioma","idiomas"],
    ["location","country","based","located","reside","residencia","ubicacion","pais","vive"],
    ["mathematics","maths","matematicas","matematica"],
    ["writing","write","escritura","escribir"],
    ["photography","photos","fotografia","fotografias","fotos"],
    ["creative","creativity","creativo","creativa","creatividad"],
    ["learn","learning","aprender","aprende","aprendiendo","aprendizaje"],
    ["formulas","formula"],["macros","macro"],
    ["workbook","workbooks","libro","libros"],
    ["chart","charts","grafico","graficos"],["table","tables","tabla","tablas"]
  ];
  const semanticMap=new Map(semanticGroups.flatMap(group=>group.map(term=>[term,group[0]])));
  const semanticStop=new Set("please podrias quisiera gustaria sabes saber puede acerca behind le te lo ahora bien bro hey hola digas decir diga could would tell really want need necesito quiero dime cuentame hablar more mas detalle detalles registrado registrada recorded listed informacion information some algo cosas mucho poco bastante nomas sobre tambien ademas todo todos every any seem seems verdad realmente basicamente it its an their they them each cuales cual quienes cuanta cuantos cuantas obtained get got obtener saco tuvo dame give".split(" "));
  function semanticTokens(text) {
    const clean=normalize(text).replace(/\bpor que\b/g,"motivation").replace(/\bnode js\b/g,"nodejs").replace(/\badonis js\b/g,"adonisjs").replace(/\bjs\b/g,"javascript");
    return [...new Set(tokens(clean).filter(word=>!semanticStop.has(word)).map(word=>semanticMap.get(word) || word))];
  }
  function questionFocus(q) {
    if(has(q,["why","por que","motivacion","motivo","inspired","inspiration","inspiro","razon","reason","impulso","incentivo"]))return "motivation";
    if(has(q,["how much","money","cost","coste","costo","precio","dinero","salary","salario"]))return "money";
    if(has(q,["who","quien"]))return "person";
    if(has(q,["where","donde"]))return "location";
    if(has(q,["when","cuando","year","fecha"]))return "date";
    if(has(q,["how","como"]))return "method";
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

  // Build the small text index once per knowledge snapshot, only when needed.
  // Bilingual canonical terms + document frequency improve recall without a model.
  const searchIndexes=new WeakMap();
  function retrieve(sources, question) {
    let index=searchIndexes.get(sources);
    if(!index){
      const rows=sources.filter(s=>["section","manual","profile"].includes(s.kind)).flatMap(source=>{
        const sentences=source.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[source.text];
        return sentences.map(text=>({source,text:compact(text),terms:semanticTokens(text)}));
      });
      const frequency=new Map();
      rows.forEach(row=>row.terms.forEach(term=>frequency.set(term,(frequency.get(term)||0)+1)));
      index={rows,frequency};searchIndexes.set(sources,index);
    }
    const qt=semanticTokens(question);
    if(qt.length<2)return [];
    return index.rows.map(row=>{
      const matched=qt.filter(word=>row.terms.some(term=>near(word,term)));
      const score=matched.reduce((sum,word)=>sum+Math.log(1+index.rows.length/(index.frequency.get(word)||1)),0);
      return {...row,count:matched.length,coverage:matched.length/qt.length,score};
    }).filter(item=>item.count>=2&&item.coverage>=.7).sort((a,b)=>b.coverage-a.coverage||b.score-a.score||a.text.length-b.text.length).slice(0,3);
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
    {terms:["prototype","prototipo"],es:"Un prototipo sirve para explorar y probar una idea antes de terminar el producto. Puede mostrar el diseño o parte del funcionamiento sin ser una versión final.",en:"A prototype explores and tests an idea before the product is finished. It may demonstrate the design or some behavior without being a final release."},
    {terms:["api"],es:"Una API es una forma acordada de comunicación entre programas. Define qué puedes pedir y cómo llega la respuesta; por ejemplo, una web puede pedir datos a un servicio meteorológico.",en:"An API is an agreed way for programs to communicate. It defines what you can request and how the reply is structured; for example, a website can request data from a weather service."},
    {terms:["json"],es:'JSON es un formato de texto para organizar datos en objetos y listas. Por ejemplo, {"nombre":"David"} contiene una propiedad llamada nombre. Es un formato de datos, no un lenguaje que ejecute instrucciones.',en:'JSON is a text format for organizing data in objects and lists. For example, {"name":"David"} has one property named name. It describes data rather than executing instructions.'},
    {terms:["git"],es:"Git registra los cambios de un proyecto. Te permite revisar versiones anteriores y trabajar en ramas para probar cambios antes de integrarlos.",en:"Git tracks changes to a project. You can inspect earlier versions and use branches to try changes before integrating them."},
    {terms:["github"],es:"GitHub aloja repositorios Git y añade herramientas para colaborar, revisar cambios y publicar proyectos. Git registra versiones; GitHub es una plataforma donde puedes compartir esos repositorios.",en:"GitHub hosts Git repositories and adds tools for collaboration, review, and publishing. Git tracks versions; GitHub is a platform for sharing those repositories."},
    {terms:["database","base de datos","bases de datos"],es:"Una base de datos organiza información para poder consultarla y actualizarla. Una tienda, por ejemplo, puede guardar productos y pedidos en tablas relacionadas.",en:"A database organizes information so you can query and update it. A shop, for example, can keep products and orders in related tables."},
    {terms:["sql"],es:"SQL es un lenguaje para consultar y modificar datos en bases relacionales. SELECT nombre FROM productos pide los valores de la columna nombre de una tabla llamada productos.",en:"SQL is a language for querying and changing data in relational databases. SELECT name FROM products retrieves the name column from a table called products."},
    {terms:["algorithm","algoritmo"],es:"Un algoritmo es una secuencia de pasos para resolver una tarea. Buscar el número más grande de una lista, comparando cada elemento con el mayor que llevas, es un ejemplo.",en:"An algorithm is a sequence of steps for solving a task. Finding the largest number in a list by comparing each item with the largest seen so far is one example."},
    {terms:["variable","variables"],es:"Una variable le da un nombre a un valor para usarlo después. En JavaScript, let puntos = 10 guarda ese número con el nombre puntos; luego puedes actualizarlo.",en:"A variable names a value so you can use it later. In JavaScript, let points = 10 stores that number under points; you can update it later."},
    {terms:["function","funcion","funciones"],es:"Una función agrupa instrucciones para reutilizarlas. Por ejemplo, function doble(n) { return n * 2; } calcula el doble: doble(4) devuelve 8.",en:"A function groups instructions for reuse. For example, function double(n) { return n * 2; } calculates twice a number: double(4) returns 8."},
    {terms:["array","arreglo","arreglos"],es:"Un array es una lista ordenada de valores. En JavaScript, const colores = [\"rojo\", \"azul\"] guarda dos elementos; colores[0] devuelve el primero, rojo.",en:"An array is an ordered list of values. In JavaScript, const colors = [\"red\", \"blue\"] holds two items; colors[0] returns the first one, red."},
    {terms:["loop","loops","bucle","bucles"],es:"Un bucle repite instrucciones. Por ejemplo, for (let i = 1; i <= 3; i++) { console.log(i); } muestra 1, 2 y 3. La condición indica cuándo parar.",en:"A loop repeats instructions. For example, for (let i = 1; i <= 3; i++) { console.log(i); } prints 1, 2, and 3. Its condition determines when to stop."},
    {terms:["responsive","responsivo","adaptable"],es:"Un diseño responsive adapta la distribución al espacio disponible: columnas que se apilan, texto legible y controles cómodos. No consiste únicamente en encoger la versión de escritorio.",en:"Responsive design adapts a layout to the available space: columns can stack, text stays readable, and controls remain comfortable to use. It involves more than shrinking a desktop page."},
    {terms:["inteligencia artificial","artificial intelligence"],es:"La inteligencia artificial reúne técnicas para realizar tareas como clasificar, reconocer patrones o generar texto. Hay sistemas de reglas y modelos aprendidos a partir de datos; sus capacidades y errores son distintos.",en:"Artificial intelligence includes techniques for tasks such as classification, pattern recognition, and text generation. Rule systems and models learned from data have different capabilities and failure modes."}
  ];
  const conceptExamples={
    html:{es:'<h1>Hola</h1> crea un encabezado. <button>Enviar</button> crea un botón; JavaScript puede añadirle una acción.',en:'<h1>Hello</h1> creates a heading. <button>Send</button> creates a button; JavaScript can give it an action.'},
    css:{es:'button { color: white; background: navy; } hace blanco el texto de los botones y azul oscuro su fondo.',en:'button { color: white; background: navy; } gives buttons white text and a navy background.'},
    javascript:{es:'document.querySelector("button").addEventListener("click", () => alert("Hola")); muestra un saludo al pulsar el primer botón.',en:'document.querySelector("button").addEventListener("click", () => alert("Hello")); shows a greeting when the first button is clicked.'},
    python:{es:'for nombre in ["Ana", "Luis"]:\n    print("Hola", nombre)\n\nEste bucle saluda a cada persona de la lista.',en:'for name in ["Ana", "Luis"]:\n    print("Hello", name)\n\nThis loop greets each person in the list.'},
    frontend:{es:"En una tienda, la ficha con la foto, el precio y el botón de comprar pertenece al frontend. Al confirmar una compra, el backend puede comprobar existencias y guardar el pedido.",en:"In a shop, the photo, price, and buy button belong to the frontend. When an order is confirmed, the backend can check stock and save the order."},
    backend:{es:"Al iniciar sesión, el frontend recoge tus datos y el backend comprueba las credenciales antes de permitir el acceso.",en:"At sign-in, the frontend collects your input and the backend checks the credentials before allowing access."}
  };
  const joinList=(items,es)=>items.length<2 ? items.join("") : items.slice(0,-1).join(", ")+(es?" y ":" and ")+items.at(-1);
  function ordinalIndex(q,length) {
    const names=[["primero","primera","first"],["segundo","segunda","second"],["tercero","tercera","third"],["cuarto","cuarta","fourth"],["quinto","quinta","fifth"]];
    const index=names.findIndex(group=>has(q,group));if(index>=0)return index;
    if(has(q,["ultimo","ultima","last"]))return length-1;
    const number=/^(?:el |la |the |numero |number |opcion |option )?#?([1-9])(?: por favor| please)?$/.exec(q)?.[1];
    return number?Number(number)-1:null;
  }
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

  function answerSingle(sources, question, {lang="en",context={}}={}) {
    const es=lang==="es",q=normalize(question).replace(/\bwhat s\b/g,"what is").replace(/\bi m\b/g,"i am"),turn=Number.isSafeInteger(context.turn)?context.turn:0;
    const projects=sources.filter(s=>s.kind==="project"),profile=sources.find(s=>s.kind==="profile");
    const seed=words(q).join('').split('').reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)+turn;
    const choose=options=>{const pool=options.filter(text=>text!==context.lastAnswer);return (pool.length?pool:options)[seed%(pool.length||options.length)];};
    const projectQuestions=(p,used=[])=>[
      {field:"technologies",text:es?`¿Con qué está hecho ${p.title}?`:`What is ${p.title} built with?`},
      {field:"role",text:es?`¿Qué rol tuvo David en ${p.title}?`:`What was David's role in ${p.title}?`},
      {field:"date",text:es?`¿Cuándo desarrolló ${p.title}?`:`When was ${p.title} developed?`},
      {field:"status",text:es?`¿Está terminado ${p.title}?`:`Is ${p.title} finished?`}
    ].filter(item=>!used.includes(item.field)&&(!p.fields||fieldValue(p,item.field,lang))).map(item=>item.text).slice(0,2);
    const reply=(text,items=[],next=context,suggestions=[])=>({answer:text,sources:links(items),context:{...(context.visitor?{visitor:context.visitor}:{}),...next,turn:turn+1,lastAnswer:text,offered:suggestions.slice(0,2)},suggestions:suggestions.slice(0,2)});
    const unknown=(items=[])=>reply(es ? "No tengo esa información registrada, pero puedo ayudarte con los proyectos o las habilidades de David." : "I don't have that information yet, but I can help with David's projects or skills.",items,context,items[0]?.kind==="project"?projectQuestions(items[0]):es?["¿Qué proyectos tiene David?","¿Cuáles son sus habilidades?"]:["What projects has David built?","What are his skills?"]);
    if(!q)return unknown();
    const visitorName=/(?:^|[.!?]\s*)(?:me llamo|mi nombre es|puedes llamarme|my name is|call me)\s+([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*)?)(?=\s*[,;.!?]|$)/iu.exec(question)?.[1];
    if(visitorName)return reply(es?`Mucho gusto, ${visitorName}. ¿Qué te gustaría conversar?`:`Nice to meet you, ${visitorName}. What's on your mind?`,[],{...context,visitor:{...context.visitor,name:visitorName.slice(0,50)}});
    if(has(q,["como me llamo","mi nombre","recuerdas mi nombre","what is my name","remember my name"]))return reply(context.visitor?.name?(es?`Me dijiste que te llamas ${context.visitor.name}.`:`You told me your name is ${context.visitor.name}.`):(es?"Aún no me has dicho tu nombre en esta conversación.":"You haven't told me your name in this conversation yet."));
    const priorProject=projects.find(p=>p.project===context.projectId);
    const authored=matchAuthored(sources,q)||(!referencedProjects(projects,q).length&&priorProject&&has(q,["por que","porque","inspiro","inspired","why","motivo","motivacion","purpose","para que"])?matchAuthored(sources,`${q} ${priorProject.title}`):null);
    if(authored){const variants=authored.variants?.[lang]||[];return reply(variants.length?choose(variants):authored.answers[lang]||(es?"Lo tengo en su idioma original:\n":"I have this in its original language:\n")+authored.text,[authored],{topic:"manual",...(authored.project?{projectId:authored.project}:{})});}

    const mentioned=referencedProjects(projects,q);
    const plural=has(q,["projects","proyectos","trabajos","cuales","which projects"]);
    const comparison=intent(q,["compare","comparison","comparar","compara","comparalos","diferencia","diferencias","versus","vs"]);
    let fields=Object.keys(fieldTerms).filter(key=>intent(q,fieldTerms[key]));
    if(mentioned.length&&has(q,["languages","language","lenguaje","idioma"])&&!fields.includes("technologies"))fields.push("technologies");
    const explicitlyPersonal=has(q,["david","his","he"])||has(q,["su","sus"])&&!has(q,["que es","que significa","explica","explicame","entender"]);
    const profileQuestion=has(q,["quien es david","who is david","sobre david","about david","idiomas","languages","habla","speak","estudia","school","education","educacion","formacion","intereses","interests","pasatiempos","hobbies","fortalezas","strengths","colegio","escolaridad","reside","ubicacion","pais","bilingue"]);
    const definition=!mentioned.length&&!explicitlyPersonal&&(has(q,["que es","que significa","que hace","en que consiste","entender","explicacion","what is","what does","explain","explica","explicame","teach me","walk me through","difference between","diferencia entre","ejemplo de","example of"])||(context.topic==="concept"&&words(q).length<=3&&!plural));
    if(definition){const entries=glossary.filter(item=>has(q,item.terms));if(entries.length){const example=has(q,["ejemplo","example"]);return reply(entries.map(item=>example?(conceptExamples[item.terms[0]]?.[lang]||item[lang]):item[lang]).join("\n\n"),[],{topic:"concept",concepts:entries.map(item=>item.terms[0])},es?["Explícalo más simple","Dame un ejemplo"]:["Explain it more simply","Give me an example"]);}}
    if(explicitlyPersonal&&has(q,["favorite","favorito","favorita","birthday","nacimiento","edad","age","salary","salario","password","contrasena"]))return unknown(mentioned);
    if((mentioned.length||priorProject||explicitlyPersonal)&&has(q,["dinero","money","gano","costo","precio","salary","salario","revenue","earnings"]))return unknown(mentioned);

    if(["concept","learning"].includes(context.topic)&&!mentioned.length){
      const previous=glossary.filter(item=>context.concepts?.includes(item.terms[0]));
      if(previous.length&&has(q,["ejemplo","example","practica","practice","mas simple","mas facil","mas sencillo","no entiendo","didn t understand","simpler","in simple terms","que significa eso"])){
        const example=has(q,["ejemplo","example","practica","practice"]);
        const text=previous.map(item=>example?(conceptExamples[item.terms[0]]?.[lang]||item[lang]):item[lang].split(/(?<=[.!?])\s/)[0]).join("\n\n");
        return reply(text,[],context,es?["¿En qué proyectos aparece?"]:["Which projects use it?"]);
      }
      if(previous.length&&has(q,["juntos","together","conectan","relacionan"]))return reply(es?"HTML organiza el contenido, CSS lo presenta y JavaScript responde a las acciones. Por ejemplo, HTML crea un botón, CSS lo diseña y JavaScript abre un menú al pulsarlo. Si hace falta guardar o consultar datos, el frontend puede comunicarse con un backend.":"HTML organizes content, CSS presents it, and JavaScript responds to actions. For example, HTML creates a button, CSS styles it, and JavaScript opens a menu when clicked. When data needs to be saved or retrieved, the frontend can communicate with a backend.",[],context);
    }

    const credentials=sources.filter(s=>s.id.startsWith("credential:"));
    const credentialQuery=intent(q,["certificates","certificate","certification","certifications","certificado","certificados","certificacion","certificaciones","certs","credentials","credenciales","logros","achievements"]);
    const scored=credentials.map(s=>({s,hits:tokens(s.title).filter(term=>words(q).some(word=>near(word,term))).length})).filter(item=>item.hits>0).sort((a,b)=>b.hits-a.hits);
    let credential=scored[0]&&(!scored[1]||scored[0].hits>scored[1].hits)?scored[0].s:null;
    if(scored.length>1&&has(q,["normal","basico","regular","basic","standard","estandar"]))credential=[...scored].sort((a,b)=>a.s.title.length-b.s.title.length)[0].s;
    let credentialField=has(q,["score","points","puntaje","puntuacion","calificacion","nota","puntos"])?"score":intent(q,["date","year","when","fecha","ano","cuando"])?"date":"";
    if(context.credentialCandidates?.length){const index=ordinalIndex(q,context.credentialCandidates.length);if(index!==null)credential=credentials.find(s=>s.id===context.credentialCandidates[index]);}
    if(!credentialField&&credential&&context.topic==="credentials"&&words(q).length<7)credentialField=context.credentialField||"";
    const credentialCompare=comparison||has(q,["mayor nota","mejor nota","mayor puntaje","mas puntos","highest score","best score","better score"]);
    if(credentialCompare&&(credentialQuery||scored.length||["credential","credentials"].includes(context.topic))){
      const candidates=scored.length>1?scored.map(item=>item.s):credentials;
      const results=candidates.map(s=>({s,score:/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/.exec(s.fields?.description||s.text)})).filter(item=>item.score&&Number(item.score[2])>0);
      if(results.length){
        const lines=results.map(({s,score})=>`${s.title}: ${score[0]}${s.fields?.year?" · "+s.fields.year:""}`);
        const sameScale=results.every(item=>item.score[2]===results[0].score[2]);
        if(sameScale&&results.length>1){const max=Math.max(...results.map(item=>Number(item.score[1]))),winners=results.filter(item=>Number(item.score[1])===max);lines.push(es?`El mayor puntaje publicado corresponde a ${joinList(winners.map(item=>item.s.title),true)}.`:`The highest published score belongs to ${joinList(winners.map(item=>item.s.title),false)}.`);}
        return reply(lines.join("\n"),results.map(item=>item.s),{topic:"credentials"});
      }
    }
    if(!scored.length&&credentialField&&context.credentialId)credential=credentials.find(s=>s.id===context.credentialId);
    if(credential){
      const f=credential.fields||{};
      if(credentialField==="score"){
        const score=/\b\d{1,4}\s*\/\s*\d{1,4}\b/.exec(f.description||credential.text)?.[0];
        const threshold=/\b(?:required|passing|minimum) score(?: of)?\s*[:=]?\s*(\d{1,4})/i.exec(f.description||credential.text)?.[1];
        if(has(q,["minimum","passing","required","minima","minimo","requerida","requerido","para aprobar"]))return threshold?reply(es?`La nota mínima publicada para ${credential.title} es ${threshold}.`:`The published passing score for ${credential.title} is ${threshold}.`,[credential],{topic:"credential",credentialId:credential.id}):unknown([credential]);
        const date=intent(q,["date","year","when","fecha","ano","cuando"])&&(f.date||f.year);
        return score?reply((es?`En ${credential.title}, el resultado publicado es ${score}.`:`The published result for ${credential.title} is ${score}.`)+(date?`\n${es?"Fecha":"Date"}: ${date}.`:""),[credential],{topic:"credential",credentialId:credential.id}):unknown([credential]);
      }
      if(credentialField==="date")return f.date||f.year?reply(es?`${credential.title} figura con fecha ${f.date||f.year}.`:`${credential.title} is dated ${f.date||f.year}.`,[credential],{topic:"credential",credentialId:credential.id}):unknown([credential]);
      return reply((es?"Esto dice el registro publicado (texto original):\n":"Here's the published record:\n")+credential.text,[credential],{topic:"credential",credentialId:credential.id});
    }
    if(scored.length>1&&credentialField)return reply((es?"¿A cuál te refieres: ":"Which one do you mean: ")+scored.map(item=>item.s.title).join(es?" o ":" or ")+"?",scored.map(item=>item.s),{topic:"credentials",credentialField,credentialCandidates:scored.map(item=>item.s.id)},scored.slice(0,2).map(item=>es?`¿Qué ${credentialField==="score"?"puntaje obtuvo":"fecha tiene"} ${item.s.title}?`:`What ${credentialField==="score"?"score is recorded for":"date is listed for"} ${item.s.title}?`));
    if((credentialQuery||context.topic==="credentials"&&/\b(?:19|20)\d{2}\b/.test(q))&&!mentioned.length){
      const year=/\b(?:19|20)\d{2}\b/.exec(q)?.[0],achievements=has(q,["logros","achievements","logro","achievement"])&&!has(q,["certificados","certificates","certificaciones"]);
      const rawSubject=/(?:certificados?|certificaciones|certificacion|certifications?|certificates?)\s+(?:de|en|in|for)\s+([a-z][a-z0-9+#]*)/.exec(q)?.[1];
      const subject=rawSubject&&!has(rawSubject,["david","menjivar","este","esta","el","la","los","las","portafolio","portfolio","his","him"])?rawSubject:null;
      let list=credentials.filter(s=>(!year||s.fields?.year===year)&&(!achievements||s.fields?.collection==="achievements")&&(!subject||words(s.title).some(word=>near(word,subject))));
      if(has(q,["reciente","recientes","ultima","ultimo","latest","newest"]))list=[...list].sort((a,b)=>(b.fields?.date||b.fields?.year||"").localeCompare(a.fields?.date||a.fields?.year||"")).slice(0,1);
      if(!list.length)return reply(es?"No hay registros publicados que coincidan con eso. Los espacios pendientes no cuentan como logros obtenidos.":"No published records match that request. Pending spaces don't count as earned achievements.",[],{topic:"credentials"});
      return reply((es?`Hay ${list.length} registro${list.length===1?"":"s"} publicado${list.length===1?"":"s"}:\n`:`There ${list.length===1?"is":"are"} ${list.length} published record${list.length===1?"":"s"}:\n`)+list.map(s=>`• ${s.title}${s.fields?.year?" · "+s.fields.year:""}`).join("\n"),list,{topic:"credentials",credentialCandidates:list.map(s=>s.id)},list.slice(0,2).map(s=>es?`Cuéntame sobre ${s.title}`:`Tell me about ${s.title}`));
    }

    // Casual replies are explicitly authored or playful; none assert personal facts.
    if(/^(hola|hello|hi|hey|buenas|buenos dias|buenas tardes|que onda|que tal)( bro| man| amigo| amiga| buenas| todo| david)*$/.test(q))return reply(choose(es?["¡Hola!","¡Buenas!","¡Hey!"]:["Hi!","Hello!","Hey!"]));
    if(/^(muchas |mil |muchisimas )?(gracias|thanks|thank you)( bro| man| amigo| a ti| por todo| mucho)*$/.test(q))return reply(choose(es?["¡Con gusto! ¿Seguimos explorando?","Para eso estoy. ¿Qué más te da curiosidad?","¡De nada! Cuando quieras, seguimos."]:["You're welcome! What else are you curious about?","Anytime. Want to keep exploring?","Glad that helped. I'm here if you need anything else."]));
    if(has(q,["como estas","como vas","how are you","how is it going","how are things"])&&!mentioned.length&&!fields.length)return reply(choose(es?["¡Todo bien! ¿Y tú?","¡Bien, gracias! ¿Cómo estás?"]:["Doing well, thanks! How are you?","All good here. How about you?"]),[],{...context,topic:"chat"});
    if(/^(?:estoy |todo |me fue |i am |i feel |doing )?(bien|muy bien|genial|excelente|good|great|fine)( gracias| thanks)?$/.test(q))return reply(choose(es?["Qué bueno. ¿Qué fue lo mejor de tu día?","Me alegra leer eso. ¿Traes alguna idea en mente?"]:["Good to hear. What was the best part of your day?","Glad to hear it. Anything on your mind?"]),[],{...context,topic:"chat"});
    if(/^(?:ja){2,}|^(?:ha){2,}|^(lol|lmao|xd)$/.test(q))return reply(es?"Ese funcionó 😄":"That one landed 😄",[],context);
    if(has(q,["quien eres","eres una ia","eres humano","who are you","are you human","are you an ai"]))return reply(es?"Soy la guía de este portafolio. Uso la información publicada para responder sobre David y sus proyectos. También puedo explicar conceptos y conversar sobre algunos temas. No soy David ni una persona.":"I'm this portfolio's guide. I use the published information to answer questions about David and his projects. I can also explain concepts and chat about some topics. I'm not David or a person.",[],context);
    const personalInterest=has(q,["me gusta","me gustan","me encanta","me encantan","hablemos de","hablemos sobre","conversemos sobre","quiero hablar de","i like","i love","let s talk about"]);
    const casualThemes=[
      {id:"music",terms:["musica","music","canciones","songs"],es:"La música da para mucha charla: a veces importa la letra y otras, cómo te hace sentir. ¿Qué sueles escuchar?",en:"Music gives us plenty to talk about: sometimes it's the lyrics, sometimes the feeling. What do you usually listen to?",next:{es:"¿Te enganchan más las letras, el ritmo o la atmósfera?",en:"Do you get drawn in by lyrics, rhythm, or atmosphere?"}},
      {id:"games",terms:["juegos","videojuegos","video games","gaming"],es:"Los videojuegos mezclan historias, diseño y desafíos. ¿Te atrae más explorar un mundo, competir o seguir una buena historia?",en:"Games combine stories, design, and challenges. Do you enjoy exploring, competing, or following a good story?",next:{es:"¿Cuál juego se te quedó en la cabeza y por qué?",en:"Which game stayed with you, and why?"}},
      {id:"movies",terms:["peliculas","cine","movies","films"],es:"Una buena película puede quedarse contigo por una escena o un personaje. ¿Qué tipo de historias te atrapan?",en:"A film can stay with you because of one scene or character. What kinds of stories draw you in?",next:{es:"¿Te importa más un buen personaje o una trama que sorprenda?",en:"Do you care more about a compelling character or a surprising plot?"}},
      {id:"art",terms:["arte","dibujo","dibujar","fotografia","art","drawing","photography"],es:"Me interesa cómo una imagen puede contar algo sin explicarlo. ¿Te gusta más crear imágenes o descubrir las de otras personas?",en:"An image can tell a story without explaining it. Do you prefer making images or discovering other people's work?",next:{es:"Si tuvieras que retratar tu día en una imagen, ¿qué pondrías?",en:"If you captured your day in one image, what would be in it?"}}
    ];
    const theme=personalInterest?casualThemes.find(item=>has(q,item.terms)):null;
    if(theme)return reply(theme[lang],[],{topic:"casual",theme:theme.id,visitor:{...context.visitor,interest:theme.id}});
    if(has(q,["que me gusta","que te dije que me gustaba","what do i like"])){
      const remembered=casualThemes.find(item=>item.id===context.visitor?.interest);
      return reply(remembered?(es?`Me hablaste de ${remembered.terms[0]}.`:`You mentioned ${remembered.terms.at(-1)}.`):(es?"Todavía no me has contado qué te gusta.":"You haven't told me what you like yet."));
    }
    if(context.topic==="casual"&&words(q).length<14&&!mentioned.length&&has(q,["prefiero","me atrae","las letras","el ritmo","rock","pop","rap","explorar","competir","personajes","crear imagenes","both","i prefer","lyrics","rhythm"])){
      const current=casualThemes.find(item=>item.id===context.theme);
      if(current&&!/^(hola|gracias|thanks|adios|bye)/.test(q))return reply(current.next[lang],[],context);
    }
    const learningRequest=has(q,["quiero aprender","como aprendo","aprender a programar","empezar a programar","learn to code","want to learn","learning programming","start coding"]);
    if(learningRequest&&!has(q,["html","css","javascript","python","programar","programacion","programming","code","coding","web"]))return reply(es?"Podemos dividirlo en pasos: elige algo pequeño que quieras lograr, intenta hacerlo y anota dónde te atoras. ¿Qué parte te gustaría practicar primero?":"We can break it into steps: pick a small thing you'd like to achieve, try it, and note where you get stuck. What part would you like to practice first?",[],{topic:"chat"});
    if(learningRequest||(context.topic==="learning"&&has(q,["ya se","ya conozco","siguiente","que sigue","que hago","i know","next","what now"]))){
      const known=new Set(context.visitor?.learned||[]);
      if(has(q,["ya se","ya conozco","i know"]))["html","css","javascript","python"].filter(term=>has(q,[term])).forEach(term=>known.add(term));
      const path=has(q,["python"])?["python"]:has(q,["css"])&&!has(q,["html"])?["css","javascript"]:has(q,["javascript"])?["javascript"]:["html","css","javascript"];
      const next=path.find(term=>!known.has(term));
      const explanation=glossary.find(item=>item.terms[0]===next)?.[lang];
      const text=next?(es?`Podemos empezar por ${next.toUpperCase()}. ${explanation}\n\nPrueba algo pequeño, comprueba qué ocurre y cambia una cosa a la vez.`:`We can start with ${next.toUpperCase()}. ${explanation}\n\nTry something small, check what happens, and change one thing at a time.`):(es?"Pon lo que ya sabes en un proyecto pequeño: una lista de tareas con añadir, completar y borrar. Empieza por esas tres acciones y mejora la presentación después.":"Put what you know into a small project: a task list with add, complete, and delete actions. Start with those three actions, then improve the presentation.");
      return reply(text,[],{topic:"learning",concepts:next?[next]:[],visitor:{...context.visitor,learned:[...known]}},next?[es?`Dame un ejemplo de ${next.toUpperCase()}`:`Give me an example of ${next.toUpperCase()}`]:[]);
    }
    if(has(q,["que puedes hacer","que sabes hacer","ayuda","help me","what can you do","help"])&&!mentioned.length)return reply(es?"Puedo comparar proyectos, contarte qué hizo David, buscar tecnologías y llevarte a una sección. También podemos salir del tema: un chiste, un acertijo o un mini poema. ¿Qué te apetece?":"I can compare projects, explain David's role, look up technologies, and take you to a section. We can also switch gears with a joke, a riddle, or a short poem. What sounds good?",[],context,es?["Compara Beyond y Plant Bud","Cuéntame un chiste"]:["Compare Beyond and Plant Bud","Tell me a joke"]);
    if(has(q,["no responde","no te pregunte eso","no entendiste","eres tonto","you misunderstood","that is not what i asked","wrong answer","you are stupid"]))return reply(es?"Va, probemos de otra forma. Dime qué parte quieres saber y voy directo a eso.":"Let's try that again. Tell me which part you meant, and I'll focus on that.",[],context,context.projectId?projectQuestions(projects.find(p=>p.project===context.projectId)||projects[0]||{title:"Beyond"}):[]);
    if(/^(adios|hasta luego|nos vemos|bye|goodbye|see you)( bro| man| amigo)?$/.test(q))return reply(choose(es?["¡Nos vemos! Aquí queda el portafolio para cuando quieras volver.","¡Hasta luego! Que tengas un buen día."]:["See you! The portfolio will be here whenever you want to come back.","Take care. Have a good day!"]));
    if(has(q,["estoy triste","me siento mal","estoy solo","estoy cansado","estoy estresado","tengo mucha tarea","i am sad","i feel down","i feel lonely","i am tired","i feel stressed"]))return reply(es?"Suena a un día pesado. Si quieres, cuéntame qué te está costando más; también podemos hacer una pausa con algo ligero.":"Sounds like a rough day. Tell me what's been hardest if you'd like; we can also take a break with something light.",[],{topic:"chat"},es?["Cuéntame algo divertido","Dame una idea creativa"]:["Tell me something funny","Give me a creative idea"]);
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
    const ordinal=ordinalIndex(q,context.candidateIds?.length||0);
    if(!selected.length&&ordinal!==null&&context.candidateIds)selected=projects.filter(p=>p.project===context.candidateIds[ordinal]);
    if(!mentioned.length&&has(q,["el otro","the other one"])&&context.candidateIds?.length){
      const other=projects.filter(p=>context.candidateIds.includes(p.project)&&p.project!==context.projectId);
      if(other.length===1)selected=other;
      else if(other.length>1)return reply(es?"¿Cuál de estos quieres explorar?":"Which of these would you like to explore?",other,{...context},other.slice(0,2).map(p=>es?`Cuéntame sobre ${p.title}`:`Tell me about ${p.title}`));
    }
    if(mentioned.length&&context.projectId&&has(q,["otro","other"])&&mentioned[0].project===context.projectId)selected=previous.filter(p=>p.project!==context.projectId);
    if(selected.length&&!fields.length&&!overview&&(short||mentioned.length&&words(q).length<7||ordinal!==null)&&context.fields?.length)fields=context.fields;
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
    if(recommendation&&projects.length&&(selected.length||plural||context.topic==="list"||has(q,["portfolio","portafolio","por donde empiezo","where should i start"]))){
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
    const listRequest=plural||has(q,["project","proyecto","portfolio","portafolio","que ha hecho","what has david built","en que ha trabajado","what has he built","what is david working on"])||((context.topic==="list")&&(fields.length||/\b(?:19|20)\d{2}\b/.test(q)||has(q,["recientes","latest","recent","newest","todos","all","moviles","mobile"])));
    if(listRequest||namedTech.length){
      let list=[...projects];const year=/\b(?:19|20)\d{2}\b/.exec(q)?.[0];if(year)list=list.filter(p=>p.fields.date.includes(year));
      const negated=has(q,["sin","without","not using","no usan","no utiliza"]);
      if(namedTech.length)list=list.filter(p=>p.fields.technologies.length&&(negated?namedTech.every(tech=>!p.fields.technologies.includes(tech)):has(q,["or","o"])?namedTech.some(tech=>p.fields.technologies.includes(tech)):namedTech.every(tech=>p.fields.technologies.includes(tech))));
      const unfinished=has(q,["not completed","not finished","unfinished","no terminados","no finalizados","sin terminar"]);
      const state=unfinished||has(q,["completed","finished","finalizado","finalizados","terminado","terminados"]) ? "completed" : has(q,["prototype","prototipo","prototipos"]) ? "prototype" : has(q,["in development","en desarrollo"]) ? "in-development" : "";
      if(state)list=list.filter(p=>p.fields.status&&(unfinished?p.fields.status!==state:p.fields.status===state));
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
      if(intent(q,["languages","idiomas","idioma","speak","habla","comunica","bilingue"])&&f.languages)parts.push(es?`David habla ${translated(f.languages,lang).replace(/\s*\/\s*/g," y ")}.`:`David speaks ${f.languages.replace(/\s*\/\s*/g," and ")}.`);
      if(intent(q,["education","school","estudios","educacion","estudia","estudiante","formacion","colegio","escolaridad","academic background"])&&f.education)parts.push(es?`Su formación publicada es ${translated(f.education,lang).toLowerCase()}.`:`His listed education is ${f.education.toLowerCase()}.`);
      if((intent(q,["based","location","country","from","live","lives","vive","pais","ubicacion","donde es","de donde","reside","residencia","located"])||(context.topic==="profile"&&has(q,["where","donde"])))&&f.location)parts.push(es?`David está ubicado en ${f.location}.`:`David is based in ${f.location}.`);
      if(intent(q,["interests","hobbies","intereses","interesa","gusta","pasatiempos"])){const text=normalize(f.about.join(" "));const interests=[{term:"mathematics",es:"matemáticas",en:"mathematics"},{term:"technology",es:"tecnología",en:"technology"},{term:"writing",es:"escritura",en:"writing"}].filter(item=>has(text,[item.term])).map(item=>item[lang]);if(interests.length)parts.push(es?`Le interesan ${joinList(interests,true)}.`:`He's interested in ${joinList(interests,false)}.`);}
      if(intent(q,["strengths","fortalezas","personalidad","personality"])&&f.strengths?.length)parts.push((es?"En su perfil menciona estas fortalezas (texto original): ":"His profile lists these strengths: ")+f.strengths.slice(0,5).join(", ")+".");
      if(intent(q,["internship","pasantia","practicas","opportunity","oportunidad","academic path","carrera","career","ingenieria"])){
        const detail=f.details?.filter(d=>has(normalize(d.label),["academic path","my academic path","what im looking for","what i m looking for","what i am looking for"]));
        if(detail?.length)parts.push((es?"Esto cuenta en su perfil (texto original):\n":"Here's what his profile says:\n")+detail.map(d=>d.value).join("\n"));
      }
      if(parts.length)return reply(parts.join("\n"),[profile],{topic:"profile"});
      if(has(q,["who is david","quien es david","about david","sobre david","conocer a david"]))return reply((es?`${f.name}${f.location?", de "+f.location:""}. `:`${f.name}${f.location?", based in "+f.location:""}. `)+(f.education?(es?`Su formación publicada es ${translated(f.education,lang).toLowerCase()}. `:`His listed education is ${f.education.toLowerCase()}. `):"")+(es?"Aquí puedes conocer sus proyectos y su lado creativo.":"You can explore his projects and creative side here."),[profile],{topic:"profile"},es?["¿Qué le interesa?","Muéstrame sus proyectos"]:["What are his interests?","Show me his projects"]);
    }
    if(fields.includes("technologies")||intent(q,["skills","habilidades","programar","coding","programacion","sabe hacer","what can he do","que domina"]))return allTech.length?reply((es?"En sus proyectos aparecen ":"His projects list ")+joinList(allTech,es)+".",projects,{topic:"skills"}):unknown();
    const networks=profile?.fields.networks||[];
    const network=networks.find(item=>has(q,[normalize(item.label)]));
    if(network)return reply(`${network.label}: ${network.url}`,[{id:"contact",title:network.label,href:"index.html#contact"}],{topic:"navigation"});
    const navigation=[{terms:["contact","contacto","contactar","email","correo","phone","telefono","redes sociales","social media","linkedin","instagram","vsco"],section:"contact"},{terms:["certificates","certificaciones","certificados","achievements","logros"],section:"certificates"}];
    const target=navigation.find(item=>intent(q,item.terms));
    if(target){const source=sources.find(s=>target.path?s.href===target.path:s.section===target.section);if(source)return reply(target.section==="contact"?(networks.length?(es?`Sus redes publicadas son ${joinList(networks.map(item=>item.label),true)}. Puedes abrirlas en la sección de contacto.`:`His published profiles are ${joinList(networks.map(item=>item.label),false)}. You can open them in the contact section.`):(es?"Te dejo la sección de contacto. Los datos de ejemplo todavía no cuentan como canales confirmados.":"Here's the contact section. Placeholder details aren't confirmed contact channels yet.")):(es?"Te llevo a esa parte del portafolio. Puedes abrirla aquí:":"Here's that part of the portfolio. You can open it below:"),[source],{topic:"navigation"});}
    const retrieved=retrieve(sources,q);
    if(retrieved[0])return reply((es?"Encontré esto en el sitio (texto original):\n":"I found this on the site (in its original language):\n")+retrieved[0].text.slice(0,600),[retrieved[0].source],{topic:"quote"});
    return unknown();
  }
  function answer(sources, question, options={}) {
    const input=String(question||"").slice(0,1000).trim();
    const context=options.context||{},q=normalize(input);
    // Resolve a correction before matching entities, so an old name doesn't
    // accidentally turn "not Beyond, I meant Plant Bud" into a comparison.
    const correction=/(?:\bme refiero a\b|\bquise decir\b|\bi meant\b|\brather than that\b)\s+(.+)$/i.exec(input)?.[1];
    if(correction)return answerSingle(sources,correction,options);
    if(/^(si|claro|dale|vale|ok|okay|yes|sure|go ahead)( por favor| please)?$/.test(q)&&context.offered?.length){
      if(context.offered.length===1)return answerSingle(sources,context.offered[0],options);
      const text=options.lang==="es"?"Claro. ¿Con cuál de estas seguimos?":"Sure. Which of these would you like to explore?";
      return {answer:text,sources:[],context:{...context,lastAnswer:text,turn:(context.turn||0)+1},suggestions:context.offered.slice(0,2)};
    }
    if(context.topic==="concept"&&context.concepts?.length&&has(q,["lo usa","lo utiliza","lo uso","usa eso","he use it","he uses it","projects use it","proyectos aparece"]))return answerSingle(sources,`projects use ${context.concepts.join(" ")}`,options);
    // Split only question-led clauses, never project names or technology lists.
    const parts=input.split(/\?\s*(?=¿|[a-záéíóúñ])|\s+(?:y|and|además|also)\s+(?=¿?(?:qué|que|cuál|cual|dónde|donde|cómo|como|cuándo|cuando|what|which|where|how|when)(?=\s|[¿?!.,:]|$))/iu).map(part=>part.trim()).filter(part=>normalize(part));
    if(parts.length<2)return answerSingle(sources,input,options);
    let state=context;const results=[];
    for(const part of parts.slice(0,3)){const result=answerSingle(sources,part,{...options,context:state});results.push(result);state=result.context;}
    if(results.every(result=>result.context.projectId===state.projectId))state={...state,fields:[...new Set(results.flatMap(result=>result.context.fields||[]))]};
    return {answer:[...new Set(results.map(result=>result.answer))].join("\n\n"),sources:links(results.flatMap(result=>result.sources)),context:state,suggestions:[]};
  }
  return {compact, normalize, safeHref, detectLanguage, parseProjects, extractDocument, projectSources, credentialSources, profileSource, manualSources, retrieve, answer};
});
