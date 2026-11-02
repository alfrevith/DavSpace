// Static entrances work without JS. Re-run after editing data/journey.json.
import fs from 'node:fs';
import { doorArt, doorArrow } from './creative-entrances-template.mjs';
import { worldStep } from './world-switcher-template.mjs';
const data=JSON.parse(fs.readFileSync('data/journey.json','utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=i=>String(i+1).padStart(2,'0');
const social=(key,label=key)=>`<a href="${esc(data.socials[key])}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)} (opens in a new tab)">${esc(label)} <span aria-hidden="true">↗</span></a>`;
const stations=data.stations.map((s,i)=>`<article class="journey-chapter creative-station station-${s.id}" id="beyond-the-code-${num(i)}" data-journey-chapter="${i}" style="--chapter-color:${s.color}" aria-labelledby="beyond-the-code-title-${num(i)}">
  <div class="journey-visual"><a class="creative-entrance entrance-${s.id}" href="${s.id}.html" data-world-link="${s.id}" aria-label="${esc(s.action)}">${doorArt(s.id,esc)}</a></div>
  <div class="journey-copy"><p class="journey-chapter-label">WORLD ${num(i)} <span>${esc(s.room)}</span></p><h3 id="beyond-the-code-title-${num(i)}">${s.title}</h3><p class="journey-chapter-subtitle">${s.subtitle}</p><p class="journey-summary">${esc(s.description)}</p><a class="journey-explore" href="${s.id}.html" data-world-link="${s.id}"><span class="door-action-label">${esc(s.action)}</span><span class="door-action-icon" aria-hidden="true">${doorArrow}</span></a><div class="creative-socials">${s.id!=='writing'?social('instagram','Instagram'):''}${s.id==='photography'?social('vsco','VSCO'):''}</div></div>
  ${s.transition?`<div class="journey-bridge" aria-hidden="true"><svg viewBox="0 0 700 85" preserveAspectRatio="none"><path d="M0 8 C180 8 180 76 350 76 S520 8 700 8"/><path class="journey-bridge-light" d="M0 8 C180 8 180 76 350 76 S520 8 700 8"/></svg><p><span>ANOTHER WAY TO CREATE</span>${s.transition}</p></div>`:''}
</article>`).join('\n');
for(const filename of ['index.html','index-mobile.html']){
  let html=fs.readFileSync(filename,'utf8');
  const section=`<!-- journey:start -->
<section class="section journey-section" id="beyond-the-code" aria-labelledby="beyond-the-code-title">
  <span class="journey-eyebrow${filename.includes('mobile')?' mobile-eyebrow':''}">beyond-the-code/&gt;</span>
  <header class="journey-heading"><div><p class="journey-kicker">A DIFFERENT SIDE OF ME</p><h2 id="beyond-the-code-title">Beyond <em>the Code.</em></h2></div><p class="journey-period">THREE WORLDS<br><span>One curious mind.</span></p></header>
  <p class="journey-tagline">${data.subtitle}</p><p class="journey-intro">${data.intro}</p>
  <div class="journey-console"><nav class="journey-chapters" aria-label="Creative worlds"><div class="journey-track" aria-hidden="true"><span></span></div>${data.stations.map((s,i)=>worldStep(s,num(i),esc)).join('')}</nav><div class="journey-console-meta"><p><span data-journey-position>00 / 03</span> worlds encountered</p><span data-journey-current>Choose a world ↗</span></div></div>
  <div class="journey-scenes">${stations}</div>
</section>
<!-- journey:end -->`;
  html=html.replace(/<!-- journey:start -->[\s\S]*?<!-- journey:end -->/,section.replace(/[ \t]+$/gm,''));
  html=html.replace(/(href="#beyond-the-code"[^>]*>[\s\S]*?)(journey|beyond-code|extra)(<\/span>|<\/a>)/, '$1extra$3');
  if(!html.includes('href="assets/css/creative-entrances.css"'))html=html.replace('</head>','<link rel="stylesheet" href="assets/css/creative-entrances.css">\n</head>');
  if(!html.includes('href="assets/css/creative-transitions.css"'))html=html.replace('</head>','<link rel="stylesheet" href="assets/css/creative-transitions.css">\n</head>');
  if(!html.includes('href="assets/css/creative-world-switcher.css"'))html=html.replace('</head>','<link rel="stylesheet" href="assets/css/creative-world-switcher.css">\n</head>');
  if(!html.includes('src="assets/js/creative-transitions.js"'))html=html.replace('</body>','<script src="assets/js/creative-transitions.js" defer></script>\n</body>');
  if(!html.includes('src="assets/js/creative-passage.js"'))html=html.replace('<script src="assets/js/creative-transitions.js"','<script src="assets/js/creative-passage.js" defer></script>\n<script src="assets/js/creative-transitions.js"');
  fs.writeFileSync(filename,html);
}
