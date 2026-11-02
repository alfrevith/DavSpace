// Static content keeps the story readable without JS and available to the chat.
// Re-run after editing data/journey.json; no build is needed to publish the site.
import fs from 'node:fs';
import {DOMParser} from 'linkedom';
const data=JSON.parse(fs.readFileSync('data/journey.json','utf8'));
const doc=new DOMParser().parseFromString(fs.readFileSync('index.html','utf8'),'text/html');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=i=>String(i+1).padStart(2,'0');
const artwork=key=>doc.querySelector(`#project-list [data-project="${key}"] img`)?.getAttribute('src')||'images/thumbnail-social-v2.jpg';
const projectData={window:{}};
// The public literal parser avoids evaluating editable project data here.
import core from '../assets/js/assistant-core.js';
projectData.window.PORTFOLIO_PROJECTS=core.parseProjects(fs.readFileSync('data/projects.js','utf8'));
const labels=new Map([['html','HTML'],['css','CSS'],['ui-ux','UI / UX design'],['teamwork','Teamwork'],['application-logic','Application logic'],['front-end','Front-end development'],['responsive','Responsive design'],['front-end-architecture','Front-end architecture']]);
for(const chapter of data.chapters)for(const skill of chapter.skills)if(!labels.has(skill.id))labels.set(skill.id,skill.label);
const link=(c,label,cls='journey-explore')=>c.key==='portfolio'?`<a class="${cls}" href="#start">${label}<span aria-hidden="true">↗</span></a>`:`<a class="${cls}" href="#projects" data-journey-project="${c.key}">${label}<span aria-hidden="true">↗</span></a>`;
const bridge=(c,i)=>`<div class="journey-bridge" aria-hidden="true"><svg viewBox="0 0 700 85" preserveAspectRatio="none"><path d="M0 8 C180 8 180 76 350 76 S520 8 700 8"/><path class="journey-bridge-light" d="M0 8 C180 8 180 76 350 76 S520 8 700 8"/></svg><p><span>${i<5?'NEXT CHAPTER':'AN OPEN END'}</span>${esc(c.transition)}</p></div>`;
const chapters=data.chapters.map((c,i)=>{
  const record=projectData.window.PORTFOLIO_PROJECTS[c.key];
  const state=record?.status==='prototype'?'Early prototype':c.key==='portfolio'?'The space you are exploring':'A completed project';
  return `<article class="journey-chapter" id="journey-${number(i)}" data-journey-chapter="${i}" data-journey-key="${c.key}" data-journey-applied="${esc(c.applied.join(' '))}" style="--chapter-color:${c.color}" aria-labelledby="journey-title-${number(i)}">
    <div class="journey-visual"><figure class="journey-evidence"><span class="journey-year" aria-hidden="true">${c.year}</span><div class="journey-image-frame"><img src="${artwork(c.key)}" alt="${esc(c.title)} ${c.key==='portfolio'?'portfolio preview':'original project preview'}" loading="lazy" decoding="async" width="900" height="650"><span class="journey-evidence-corner" aria-hidden="true">${number(i)} / FIELD NOTES</span></div><figcaption><span>${esc(state)}</span><span>${esc(c.stage)}</span></figcaption></figure></div>
    <div class="journey-copy"><p class="journey-chapter-label">CHAPTER ${number(i)} <span>${c.year}</span></p><h3 id="journey-title-${number(i)}">${esc(c.title)}</h3><p class="journey-chapter-subtitle">${esc(c.subtitle)}</p><p class="journey-summary">${esc(c.summary)}</p>
      <div class="journey-role"><span>MY CONTRIBUTION</span><p>${esc(c.role)}</p></div>
      <details class="journey-notes"><summary>Behind this chapter <span aria-hidden="true">+</span></summary><div><h4>The challenge</h4><p>${esc(c.challenge)}</p><h4>The work &amp; what it taught me</h4>${c.story.map(p=>`<p>${esc(p)}</p>`).join('')}</div></details>
      <blockquote class="journey-lesson"><span>WHAT STAYED WITH ME</span><p>“${esc(c.lesson)}”</p></blockquote>
      <div class="journey-skills"><p>SKILLS DEVELOPED <span>Trace a connection ↗</span></p><ul>${c.skills.map((s,j)=>`<li style="--skill-order:${j}"><button type="button" disabled data-journey-skill="${s.id}" aria-haspopup="dialog">${esc(s.label)}</button></li>`).join('')}</ul></div>
      ${link(c,c.key==='portfolio'?'Explore this space':'Explore the project')}
    </div>
    ${bridge(c,i)}
  </article>`;
}).join('\n');
const markup=mobile=>`<!-- journey:start -->
<section class="section journey-section" id="journey" aria-labelledby="journey-title">
  <span class="journey-eyebrow${mobile?' mobile-eyebrow':''}">my-journey/&gt;</span>
  <header class="journey-heading"><div><p class="journey-kicker">FROM CURIOSITY TO CREATION</p><h2 id="journey-title">My <em>Journey.</em></h2></div><p class="journey-period">2024 <span aria-hidden="true">—</span> Present<br><span>Six chapters. An open horizon.</span></p></header>
  <p class="journey-intro">${esc(data.intro)}</p>
  <div class="journey-console"><nav class="journey-chapters" aria-label="Journey chapters"><div class="journey-track" aria-hidden="true"><span></span></div>${data.chapters.map((c,i)=>`<a href="#journey-${number(i)}" data-journey-step="${i}" aria-label="Chapter ${number(i)}: ${esc(c.title)}, ${c.year}"><span>${number(i)}</span><small>${c.year}</small></a>`).join('')}<a href="#journey-future" data-journey-step="6" aria-label="Chapter 07: the future"><span>07</span><small>Next</small></a></nav><div class="journey-console-meta"><p><span data-journey-position>00 / 06</span> chapters encountered <span class="journey-console-separator">·</span> <strong data-journey-count>0</strong> skills connected</p><button class="journey-map-open" type="button" data-journey-map-open aria-haspopup="dialog" hidden>Explore the connections <span aria-hidden="true">↗</span></button></div></div>
  <div class="journey-scenes">${chapters}
    <article class="journey-future journey-chapter" id="journey-future" data-journey-chapter="6" aria-labelledby="journey-future-title"><p class="journey-chapter-label">CHAPTER 07 <span>THE FUTURE</span></p><div class="journey-horizon" aria-hidden="true"><span></span><i></i></div><h3 id="journey-future-title">Still Learning.<br><em>Still Creating.</em></h3><p>${esc(data.future.description)}</p><p class="journey-future-closing">${esc(data.future.closing)}</p><a href="#contact" class="journey-explore">Let’s build what’s next <span aria-hidden="true">↗</span></a></article>
  </div>
  <dialog class="journey-dialog" id="journey-map-dialog" aria-labelledby="journey-map-title"><header><div><p class="journey-kicker">A GROWING SET OF CONNECTIONS</p><h3 id="journey-map-title">Nothing learned <em>in isolation.</em></h3></div><button type="button" data-journey-map-close aria-label="Close knowledge map">×</button></header><div class="journey-map-body"><div class="journey-map-intro"><label for="journey-skill-select">Follow a skill through the chapters</label><select id="journey-skill-select">${[...labels].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,label])=>`<option value="${id}">${esc(label)}</option>`).join('')}</select><p data-journey-map-summary role="status"></p><p class="journey-map-hint">A connection means a skill appears or is applied in this story. It isn’t a proficiency rating.</p></div><ol class="journey-map-nodes" aria-label="Skill connections across projects">${data.chapters.map((c,i)=>`<li data-journey-node="${i}" style="--chapter-color:${c.color}"><span class="journey-node-index">${number(i)}</span><div><span class="journey-node-year">${c.year}</span><h4>${esc(c.title)}</h4><span data-journey-node-state></span></div><a href="#journey-${number(i)}" data-journey-map-chapter="${i}" aria-label="Read the ${esc(c.title)} chapter">↗</a></li>`).join('')}</ol></div></dialog>
</section>
<!-- journey:end -->`;
for(const filename of ['index.html','index-mobile.html']){
  let html=fs.readFileSync(filename,'utf8');const section=markup(filename.includes('mobile'));
  if(html.includes('<!-- journey:start -->'))html=html.replace(/<!-- journey:start -->[\s\S]*?<!-- journey:end -->/,section);
  else {const at=html.indexOf('<section class="contact-section');if(at<0)throw Error('Missing contact section in '+filename);html=html.slice(0,at)+section+'\n\n                '+html.slice(at);}
  if(!html.includes('href="assets/css/journey.css"'))html=html.replace('</head>','<link rel="stylesheet" href="assets/css/journey.css">\n</head>');
  if(!html.includes('src="assets/js/journey.js"'))html=html.replace('</body>','<script src="assets/js/journey.js" defer></script>\n</body>');
  if(!html.includes('href="#journey"')){
    const anchor=/<a\b[^>]*href="#certificates"[^>]*>[\s\S]*?<\/a>/.exec(html)?.[0];
    const projectAnchor=/<a\b[^>]*href="#projects"[^>]*>[\s\S]*?<\/a>/.exec(html)?.[0];
    if(!anchor||!projectAnchor)throw Error('Missing section navigation');
    html=html.replace(anchor,anchor+projectAnchor.replaceAll('projects','journey'));
  }
  fs.writeFileSync(filename,html);
}
