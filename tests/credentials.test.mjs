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
    if (!entry.pdf) continue;
    let current = new URL("./", root);
    for (const part of entry.pdf.split("/")) {
      assert(fs.readdirSync(current).includes(part), `Case-sensitive path missing: ${entry.pdf}`);
      current = new URL(encodeURIComponent(part) + (part.endsWith(".pdf") ? "" : "/"), current);
    }
    assert.equal(path.extname(entry.pdf), ".pdf");
  }
});

test("unfilled achievement spaces remain explicitly pending and never become chat facts", () => {
  assert(data.achievements.length > 0);
  assert(data.achievements.every(record => record.pending && !record.pdf && !record.year));
  assert(data.achievements.every(record => record.logo === ""));
  for (const record of data.certificates) {
    if (record.logo) assert(fs.existsSync(new URL(record.logo, root)), `Missing logo: ${record.logo}`);
  }
  const sources = core.credentialSources(data);
  assert.equal(sources.length, data.certificates.filter(record => !record.pending).length);
  assert(sources.every(source => !data.achievements.some(record => source.id.endsWith(record.id))));
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
