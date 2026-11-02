import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {DOMParser} from "linkedom";
import core from "../assets/js/assistant-core.js";

const root = new URL("../", import.meta.url);
const data = JSON.parse(fs.readFileSync(new URL("data/credentials.json", root), "utf8"));

test("archive entries have unique stable identities and existing case-sensitive document paths", () => {
  const ids = new Set();
  for (const entry of [...data.certificates, ...data.achievements]) {
    assert.match(entry.id, /^[\w-]{1,80}$/);
    assert(!ids.has(entry.id)); ids.add(entry.id);
    assert.equal(typeof entry.title, "string"); assert(entry.title.trim());
    assert.equal(typeof entry.pending, "boolean");
    if(entry.logo)assert(fs.existsSync(new URL(entry.logo,root)),`Missing logo: ${entry.logo}`);
    const file=entry.image||entry.pdf;
    if (!file) continue;
    let current = new URL("./", root);
    for (const [index,part] of file.split("/").entries()) {
      assert(fs.readdirSync(current).includes(part), `Case-sensitive path missing: ${file}`);
      current = new URL(encodeURIComponent(part) + (index===file.split('/').length-1 ? "" : "/"), current);
    }
    assert(['.pdf','.png'].includes(path.extname(file)));
  }
});

test("all six published achievements replace templates and join the chat's factual knowledge", () => {
  assert.equal(data.achievements.length,6);
  assert(data.achievements.every(record => !record.pending && record.image && record.year));
  assert(data.achievements.every(record => record.logo));
  for (const record of data.certificates) {
    if (record.logo) assert(fs.existsSync(new URL(record.logo, root)), `Missing logo: ${record.logo}`);
  }
  const sources = core.credentialSources(data);
  assert.equal(sources.length, data.certificates.length+data.achievements.length);
  assert(data.achievements.every(record=>sources.some(source=>source.id==='credential:'+record.id)));
});

test("published record edits, additions and removals flow into chat knowledge independently", () => {
  const draft = {certificates: [{id:"test-record",title:"Local testing certificate",year:"2027",description:"The confirmed result was 888/1000.",pending:true}]};
  assert.deepEqual(core.credentialSources(draft), []);
  draft.certificates[0].pending = false;
  let sources = core.credentialSources(draft);
  assert.equal(sources.length, 1);
  assert.match(sources[0].text, /888\/1000/);
  draft.certificates[0].description = "The revised confirmed result was 900/1000.";
  sources = core.credentialSources(draft);
  assert.match(sources[0].text, /900\/1000/);
  assert(!sources[0].text.includes("888"));
  draft.certificates = [];
  assert.deepEqual(core.credentialSources(draft), []);
  assert.deepEqual(core.credentialSources({achievements: "invalid"}), []);
});

test("the live-page fallback does not index pending cards or decorative carousel copies", () => {
  const document = new DOMParser().parseFromString('<main><section class="section" id="certificates"><h2>Certificates and Achievements</h2><div class="credential-lane"><button class="credential-card" data-pending>Unconfirmed placeholder award</button><button aria-hidden="true">Duplicate record</button></div><p class="credential-explore-hint">Drag to explore</p></section></main>', "text/html");
  const sources = core.extractDocument(document);
  assert(sources.length > 0);
  assert(!sources.some(source => /Unconfirmed|Duplicate|Drag/.test(source.text)));
});

test("a certificate-specific question retrieves the published result and links to the archive", () => {
  const reply = core.answer(core.credentialSources(data), "What score is recorded for Microsoft Excel Expert?", {lang:"en"});
  assert.match(reply.answer, /972\/1000/);
  assert.equal(reply.sources[0].href, "index.html#certificates");
});

test("Spanish score paraphrases distinguish earned marks from the passing threshold",()=>{
  const sources=core.credentialSources(data);
  for(const question of ["¿Con qué nota aprobó Excel Expert?","Oye, ¿qué puntaje obtuvo en Microsoft Excel Expert?"])
    assert.match(core.answer(sources,question,{lang:"es"}).answer,/972\/1000/);
  const threshold=core.answer(sources,"¿Cuál es la nota mínima para aprobar Excel Expert?",{lang:"es"});
  assert.match(threshold.answer,/700/);assert(!threshold.answer.includes("972"));
});
test("ambiguous certificates ask a useful question and carry the requested field into an ordinal reply",()=>{
  const sources=core.credentialSources(data);
  const first=core.answer(sources,"¿Qué puntaje obtuvo en Excel?",{lang:"es"});
  assert.match(first.answer,/cuál/);assert.equal(first.suggestions.length,2);
  const second=core.answer(sources,"El segundo",{lang:"es",context:first.context});
  assert.match(second.answer,/960\/1000/);
  const date=core.answer(sources,"¿Y cuándo?",{lang:"es",context:second.context});
  assert.match(date.answer,/2025-10-31/);
});
test("credential lists filter by year, compare actual scores and exclude unearned achievements",()=>{
  const sources=core.credentialSources(data);
  const older=core.answer(sources,"Muestra las certificaciones de 2025",{lang:"es"});
  assert.match(older.answer,/Microsoft Excel/);assert(!older.answer.includes("Expert"));
  const compare=core.answer(sources,"Compara las notas de Excel y Excel Expert",{lang:"es"});
  assert.match(compare.answer,/972\/1000/);assert.match(compare.answer,/960\/1000/);
  assert.match(core.answer(sources,"¿Qué logros tiene?",{lang:"es"}).answer,/Challenge Day/);
  assert.equal(core.answer(sources,"Muestra los certificados de David",{lang:"es"}).sources.length,4);
  assert.equal(core.answer(sources,"Muestra certificados de Python",{lang:"es"}).sources.length,0);
});
test('TOEIC records retain their year, score, original image and institutional context',()=>{
  const sources=core.credentialSources(data);
  assert.match(core.answer(sources,'¿Qué puntaje tiene TOEIC 2025?',{lang:'es'}).answer,/595 puntos/);
  assert.match(core.answer(sources,'What score is recorded for TOEIC 2024?').answer,/435 points/);
  assert.equal(data.achievements.find(r=>r.id==='contextos-illustrated-memoir').date,'2026-01-29');
});
