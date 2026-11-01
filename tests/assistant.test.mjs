import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DOMParser} from "linkedom";
import core from "../assets/js/assistant-core.js";

const parse=html=>new DOMParser().parseFromString(html,"text/html");
const projects={beyond:{title:"Beyond",status:"completed",role:"Frontend / Backend",type:["Web"],date:"2026",mode:"individual",technologies:["HTML","CSS","JavaScript"],description:""},plant:{title:"Plant Bud",date:"2026",type:["Web","PWA"],technologies:["Python","JavaScript"],role:"Developer"},older:{title:"Earlier Work",date:"2024",status:"prototype",type:["Prototype"],technologies:[]}};
function fixture() {
  const doc=parse(`<html><title>David Menjivar</title><main>
    <section class="section" id="start"><h1 class="name">David Menjivar</h1><dl class="profile-facts"><div><dt>Based in</dt><dd>El Salvador</dd></div><div><dt>Education</dt><dd>High School</dd></div></dl><dl class="profile-languages"><dd>English / Spanish</dd></dl></section>
    <section class="section" id="about-me"><h2>About</h2><div class="about-introduction"><p>Mathematics, technology, and writing are my interests.</p></div><article class="mind-panel" aria-hidden="true">Creative thinking</article><span aria-hidden="true">decorative duplicate</span></section>
    <section class="section" id="projects"><div id="project-list">${Object.entries(projects).map(([id,p])=>`<button data-project="${id}"><strong class="project-title">${p.title}</strong><span class="project-footer"><span>Web</span><time>${p.date}</time></span></button>`).join("")}</div></section>
    <section class="section" id="contact"><div class="contact-details">Not active yet <p>contacto@gmail.com +503 0000-0000</p></div><p>Contact David</p></section>
    <a href="photography.html">Photos</a></main></html>`);
  const sources=[...core.extractDocument(doc),...core.projectSources(projects,doc),core.profileSource(doc),...core.extractDocument(parse('<main><h1>Photography</h1><p>Photo gallery</p></main>'),"photography.html")];
  return {doc,sources};
}
const ask=(question,options={})=>core.answer(fixture().sources,question,options);

test("the same chat automatically detects Spanish and English, retaining language for short follow-ups",()=>{
  assert.equal(core.detectLanguage("¿Qué tecnologías utiliza Beyond?","en"),"es");
  assert.equal(core.detectLanguage("What technologies does Beyond use?","es"),"en");
  assert.equal(core.detectLanguage("Beyond","es"),"es");
  assert.equal(core.detectLanguage("y su rol?","en"),"es");
});
test("project answers use just the requested field instead of returning an unrelated biography",()=>{
  const result=ask("¿Qué tecnologías utiliza Beyond?",{lang:"es"});
  assert.match(result.answer,/HTML.*CSS.*JavaScript/);
  assert(!result.answer.includes("Python"));
  assert.equal(result.sources[0].project,"beyond");
});
test("follow-ups refer to a known project and explicit new project names replace that context",()=>{
  const first=ask("Tell me about Beyond");
  const second=ask("And its role?",{context:first.context});
  assert.match(second.answer,/Frontend \/ Backend/);
  const third=ask("What technologies does Plant Bud use?",{context:second.context});
  assert.match(third.answer,/Python/);
  assert.equal(third.context.projectId,"plant");
});
test("unknown fields and personal questions explicitly remain unknown, even with a project in context",()=>{
  for(const question of ["How old is David?","¿Cuál es la edad de David?","Is Beyond secure?","How many users does Beyond have?","What is David's salary?"]) {
    assert.match(ask(question,{lang:"en",context:{projectId:"beyond"}}).answer,/don't have.*information/);
  }
  assert.match(ask("Why did David create Beyond?").answer,/don't have.*recorded/);
});
test("project lists filter by year and status without treating missing fields as facts",()=>{
  const result=ask("Show me the projects from 2024");
  assert.match(result.answer,/Earlier Work/);assert(!result.answer.includes("Plant Bud"));
  assert.match(ask("Show me the completed projects").answer,/Beyond/);
  assert(!ask("Show me the completed projects").answer.includes("Plant Bud"));
  assert.match(ask("Show me the latest projects").answer,/Beyond/);
  assert.match(ask("Show me the projects from 2020").answer,/couldn't find projects/);
});
test("project comparisons and technology lookups read all matching project records",()=>{
  const result=ask("Compare the technologies of Beyond and Plant Bud");
  assert.match(result.answer,/Beyond/);assert.match(result.answer,/Plant Bud/);assert.equal(result.sources.length,2);
  assert.match(ask("Which projects use Python?").answer,/Plant Bud/);
  assert(!ask("Which projects use Python?").answer.includes("Beyond"));
});
test("published profile answers adapt labels and known values to each language",()=>{
  assert.match(ask("¿Qué idiomas habla?",{lang:"es"}).answer,/inglés.*español/i);
  assert.match(ask("¿Dónde vive David?",{lang:"es"}).answer,/El Salvador/);
  assert.match(ask("¿Qué estudia David?",{lang:"es"}).answer,/educación secundaria/i);
  assert.match(ask("What are David's interests?").answer,/mathematics, technology and writing/);
});
test("minor typos and compact project names still find the requested facts",()=>{
  assert.match(ask("What technolgies does Beyond use?").answer,/JavaScript/);
  assert.match(ask("Tell me about PlantBud").answer,/Plant Bud/);
});
test("training answers are editable, bilingual and authoritative only when published",()=>{
  const entry={id:"beyond-motivation",published:true,title:"Beyond motivation",questions:{en:["Why did David build Beyond?"],es:["¿Por qué creó Beyond?"]},answers:{en:"An authored answer.",es:"Una respuesta escrita por David."},href:"index.html#projects",project:"beyond"};
  const sources=[...fixture().sources,...core.manualSources({entries:[entry]})];
  assert.equal(core.answer(sources,"Why did David build Beyond?").answer,"An authored answer.");
  assert.equal(core.answer(sources,"¿Por qué creó Beyond?",{lang:"es"}).answer,"Una respuesta escrita por David.");
  assert.equal(core.manualSources({entries:[{...entry,published:false}]}).length,0);
  assert.equal(core.manualSources({entries:[{...entry,answers:{en:"Changed",es:"Cambiada"}}]})[0].answers.es,"Cambiada");
});
test("an unknown personal question cannot match a training answer just because it names the same project",()=>{
  const sources=core.manualSources({entries:[{id:"motivation",published:true,questions:["Why did David create Beyond?"],answers:{en:"Real motivation"}}]});
  assert.match(core.answer(sources,"How much money did Beyond earn?").answer,/don't have.*information/);
});
test("missing translations are labeled as original text, rather than invented",()=>{
  const sources=core.manualSources({entries:[{id:"faq",published:true,questions:["¿Por qué creó Beyond?"],answers:{en:"Actual English answer."}}]});
  assert.match(core.answer(sources,"¿Por qué creó Beyond?",{lang:"es"}).answer,/idioma original/);
});
test("ambiguous training matches do not arbitrarily choose one person's fact",()=>{
  const entries=[1,2].map(id=>({id:"fact"+id,published:true,questions:["Why this hobby?"],answers:{en:"Answer "+id}}));
  const result=core.answer(core.manualSources({entries}),"Why this hobby?");
  assert(!result.answer.includes("Answer 1")&&!result.answer.includes("Answer 2"));
});
test("new sections are immediately searchable as honest quotes, without generated prose",()=>{
  const doc=parse('<main><section id="new-publication" class="section"><h2>Research notes</h2><p>The telescope collection contains three notebooks.</p></section></main>');
  const result=core.answer(core.extractDocument(doc),"Tell me about the telescope collection");
  assert.match(result.answer,/original language/);assert.match(result.answer,/three notebooks/);
  assert.equal(result.sources[0].href,"index.html#new-publication");
});
test("gallery navigation is allowed, while placeholders and decorative text never become personal facts",()=>{
  const {sources}=fixture();
  assert.equal(core.answer(sources,"Show me photography").sources[0].href,"photography.html");
  assert(!sources.some(s=>s.text.includes("contacto@gmail.com")||s.text.includes("decorative duplicate")));
  assert(sources.some(s=>s.text.includes("Creative thinking")));
  assert.equal(core.profileSource(parse('<title>Drawings</title><main>Gallery</main>')),null);
  assert(!core.answer(sources,"What is his email?").answer.includes("contacto@gmail.com"));
});
test("fresh project data parses as literals, rejects executable code and retains punctuation in strings",async()=>{
  const script=await readFile(new URL("../data/projects.js",import.meta.url),"utf8");
  assert(core.parseProjects(script).beyond.title);
  assert.equal(core.parseProjects('window.PORTFOLIO_PROJECTS={x:{title:"A \\"quote\\"",},};'.replaceAll('\\\\','\\')).x.title,'A "quote"');
  assert.throws(()=>core.parseProjects('window.PORTFOLIO_PROJECTS = (() => { globalThis.hacked = true; })();'));
  assert.throws(()=>core.parseProjects('window.PORTFOLIO_PROJECTS={}; alert("bad");'));
});
test("unsafe navigation data is replaced with an internal portfolio destination",()=>{
  for(const href of ["javascript:alert(1)","https://evil.example","../private","index.html?redirect=bad"])
    assert.equal(core.safeHref(href),"index.html#about-me");
});
test("the shipped chat has no API configuration, language controls or provider calls",async()=>{
  const script=await readFile(new URL("../assets/js/assistant.js",import.meta.url),"utf8");
  assert(!/generativelanguage|GEMINI_|api\/chat|endpoint|data-chat-lang|localStorage|sessionStorage/.test(script));
  assert(!/method\s*:\s*["']POST/.test(script));
  const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
  assert(!html.includes("assistant-config.js"));
});

test("one natural question can ask for several project facts without losing a clause",()=>{
  const result=ask("¿Con qué está hecho Beyond y qué rol tuvo David?",{lang:"es"});
  assert.match(result.answer,/HTML.*CSS.*JavaScript/);
  assert.match(result.answer,/Frontend \/ Backend/);
  assert(result.suggestions.every(q=>!(/\brol\b|\bhecho\b/.test(q))));
});
test("a short project switch inherits the last field, while an explicit overview resets it",()=>{
  const first=ask("What technologies does Beyond use?");
  const second=ask("And Plant Bud?",{context:first.context});
  assert.match(second.answer,/Python/);assert(!second.answer.includes("Developer"));
  const third=ask("Tell me about Plant Bud",{context:first.context});
  assert.match(third.answer,/Developer/);
});
test("ordinal references resolve against the last list and the other one asks when ambiguous",()=>{
  const first=ask("Show me the projects");
  const second=ask("The second one",{context:first.context});
  assert.equal(second.context.projectId,"plant");
  const third=ask("The other one",{context:second.context});
  assert.match(third.answer,/Which of these/);
  assert.equal(third.sources.length,2);
});
test("comparisons distinguish shared technologies and missing records",()=>{
  const result=ask("Compare Beyond and Plant Bud");
  assert.match(result.answer,/Both list JavaScript/);
  const follow=ask("Which uses Python?",{context:result.context});
  assert.match(follow.answer,/Python is listed among Plant Bud/);
  assert.match(follow.answer,/don't have Python recorded for Beyond/);
});
test("unregistered technologies never turn into false matches or categorical negatives",()=>{
  const result=ask("Which projects use Rust?");
  assert.match(result.answer,/couldn't find/);assert.equal(result.sources.length,0);
  const specific=ask("Does Beyond use Rust?");
  assert.match(specific.answer,/don't have Rust recorded/);
  assert(!specific.answer.includes("does not use"));
});
test("authored answers recognize semantic paraphrases but never transfer to a different project",()=>{
  const {sources}=fixture();
  sources.push(...core.manualSources({entries:[{id:"why",published:true,project:"beyond",questions:["Why did David build Beyond?"],answers:{en:"The real motivation."}}]}));
  assert.equal(core.answer(sources,"What inspired Beyond?").answer,"The real motivation.");
  assert.notEqual(core.answer(sources,"Why did David build Plant Bud?").answer,"The real motivation.");
});
test("unknown replies stay short, friendly, actionable and do not expose a long disclaimer",()=>{
  const result=ask("¿Cuál es su edad?",{lang:"es"});
  assert.equal(result.answer,"No tengo esa información registrada, pero puedo ayudarte con los proyectos o las habilidades de David.");
  assert.equal(result.suggestions.length,2);
  assert(ask("What is David's salary?").answer.split(" ").length<24);
});
test("repeat casual requests vary naturally and maintain a conversation topic",()=>{
  for(const q of ["Hola bro","Cuéntame un chiste","Escribe un poema","Estoy aburrido"]){
    const first=ask(q,{lang:"es"});const second=ask(q,{lang:"es",context:first.context});
    assert.notEqual(first.answer,second.answer);
    assert(!first.answer.includes("No tengo esa información"));
  }
  const joke=ask("Tell me a joke");
  assert.equal(ask("Another",{context:joke.context}).context.topic,"joke");
});
test("a riddle has a real answer and tracks a correct guess or a request for the solution",()=>{
  const first=ask("Dame una adivinanza",{lang:"es"});
  assert(first.context.riddle);
  const solution=ask("Dame la respuesta",{lang:"es",context:first.context});
  assert(solution.answer.includes(first.context.riddle.es));
  assert.match(ask(first.context.riddle.accept[0],{lang:"es",context:first.context}).answer,/Exacto/);
});
test("safe local arithmetic respects parentheses and percentages without evaluating code",()=>{
  assert.match(ask("How much is (12 + 3) * 4?").answer,/60$/);
  assert.match(ask("¿Cuánto es el 15% de 200?",{lang:"es"}).answer,/30$/);
  assert.match(ask("Calculate 10 / 0").answer,/doesn't give a valid result/);
  assert(!ask("What is David's age, 2026-2000?").answer.includes("26"));
  assert(!ask("alert(1+2)").answer.includes("alert("));
});
test("technical explanations do not get confused with project lookups and permit follow-up concepts",()=>{
  const first=ask("¿Qué es frontend?",{lang:"es"});
  assert.match(first.answer,/pantallas, botones/);assert.equal(first.sources.length,0);
  assert.match(ask("¿Y backend?",{lang:"es",context:first.context}).answer,/servidor/);
  assert.match(ask("What is CSS?").answer,/layout/);
});
test("being more conversational never fabricates David's favorite jokes or a human identity",()=>{
  assert.match(ask("What is David's favorite joke?").answer,/don't have/);
  assert.match(ask("Who are you?").answer,/not David or a person/);
  assert(!ask("I'm sad").answer.includes("David feels"));
});
test("training supports several authored responses without changing their facts",()=>{
  const sources=core.manualSources({entries:[{id:"variants",published:true,questions:["Why this project?"],answers:{en:["One authored explanation.","Another authored explanation."]}}]});
  const first=core.answer(sources,"Why this project?");
  const second=core.answer(sources,"Why this project?",{context:first.context});
  assert.notEqual(first.answer,second.answer);
  assert(sources[0].variants.en.includes(second.answer));
});
