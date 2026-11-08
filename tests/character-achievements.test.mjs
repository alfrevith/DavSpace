import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DOMParser} from 'linkedom';
import {characterPlaygroundMarkup} from '../scripts/character-playground-template.mjs';
import {ACHIEVEMENT_FACTS, ACHIEVEMENT_STORAGE_KEY, createAchievementLog} from '../assets/js/character-achievements.js';

const rootURL = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, rootURL), 'utf8');
const parse = html => new DOMParser().parseFromString(html, 'text/html');
const sourceText = file => read(file).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
function memoryStorage(initial = null) {
  let value = initial;
  return {getItem: () => value, setItem(key, next) { assert.equal(key, ACHIEVEMENT_STORAGE_KEY); value = next; }, get value() { return value; }};
}
function setup({storage = memoryStorage(), random = () => 0} = {}) {
  const doc = parse(characterPlaygroundMarkup());
  const root = doc.querySelector('[data-character-playground]');
  return {doc, root, storage, log: createAchievementLog({root, storage, random})};
}

test('every discovery is backed by published local evidence and a working source link', () => {
  assert(ACHIEVEMENT_FACTS.length >= 20);
  assert.equal(new Set(ACHIEVEMENT_FACTS.map(entry => entry.id)).size, ACHIEVEMENT_FACTS.length);
  for (const entry of ACHIEVEMENT_FACTS) {
    assert(entry.title && entry.text && entry.source.label);
    assert(entry.text.length <= 100, `${entry.id}: toast copy stays readable on phones`);
    for (const evidence of entry.source.evidence) assert(sourceText(entry.source.file).includes(evidence), `${entry.id}: unsupported fact, review ${entry.source.file}`);
    for (const page of ['index.html', 'index-mobile.html']) {
      const base = new URL(`https://example.test/DavSpace/${page}`);
      const target = new URL(entry.source.href, base);
      assert.equal(target.origin, base.origin);
      assert(target.pathname.startsWith('/DavSpace/'));
      const local = target.pathname.slice('/DavSpace/'.length);
      assert(fs.existsSync(new URL(local, rootURL)));
      if (target.hash) assert(parse(read(local)).getElementById(target.hash.slice(1)), entry.source.href);
    }
  }
});

test('only 15-kill milestones unlock discoveries; time controls the toast, not rewards', () => {
  const s = setup();
  assert.equal(s.log.advance(0,600).length, 0);
  assert.equal(s.log.advance(14,900).length, 0);
  const first = s.log.advance(15,901);
  assert.equal(first.length, 1);
  assert.equal(first[0].seconds, 901);
  assert.equal(first[0].kills, 15);
  assert.equal(s.root.querySelector('[data-game-achievement]').hidden, false);
  assert.equal(s.root.querySelector('[data-game-achievement-text]').textContent, first[0].text);
  for (let frame = 0; frame < 500; frame++) assert.equal(s.log.advance(15,901).length, 0);
  assert.equal(s.log.records.length, 1);
  s.log.setActive(false);
  s.log.advance(30,920);
  assert.equal(s.root.querySelector('[data-game-achievement]').hidden, false, 'pause cannot consume the toast lifetime');
  s.log.setActive(true);
  s.log.advance(15,907);
  assert.equal(s.root.querySelector('[data-game-achievement]').hidden, true);
  assert.equal(s.log.advance(30,910).length, 1);
  assert.equal(s.log.records.length, 2);
});

test('restart and reload retain unique discoveries, while random selection avoids repeats until complete', () => {
  const storage = memoryStorage();
  const s = setup({storage});
  assert.equal(s.log.advance(45).length, 3);
  assert.equal(new Set(s.log.records.map(entry => entry.id)).size, 3);
  s.log.resetRun();
  assert.equal(s.log.records.length, 3);
  assert.equal(s.log.advance(14).length, 0);
  assert.equal(s.log.advance(15).length, 1);
  assert.equal(s.log.records.length, 4);
  const restored = setup({storage});
  assert.equal(restored.log.records.length, 4);
  assert.equal(restored.root.querySelector('[data-game-record-list]').children.length, 4);
  assert.equal(restored.root.querySelector('[data-game-record-count]').textContent, '4');
  assert.equal(restored.root.querySelector('[data-game-record-empty]').hidden, true);
  assert.equal(restored.log.advance(15)[0].repeat, false);
  restored.log.advance(15 * (ACHIEVEMENT_FACTS.length + 3));
  assert.equal(restored.log.records.length, ACHIEVEMENT_FACTS.length);
  const repeat = restored.log.advance(15 * (ACHIEVEMENT_FACTS.length + 4));
  assert.equal(repeat.length, 1);
  assert.equal(repeat[0].repeat, true);
  assert.equal(restored.log.records.length, ACHIEVEMENT_FACTS.length);
});

test('denied, missing and corrupt storage keep gameplay usable without trusting persisted markup', () => {
  for (const storage of [null, {getItem() { throw Error('Denied'); }, setItem() { throw Error('Denied'); }}, memoryStorage('{bad-json'), memoryStorage(JSON.stringify({version: 999, records: []}))]) {
    const s = setup({storage});
    assert.equal(s.log.records.length, 0);
    assert.equal(s.log.advance(15).length, 1);
    assert.equal(s.log.records.length, 1);
  }
  const malicious = '<img src=x onerror=alert(1)>';
  const storage = memoryStorage(JSON.stringify({version: 1, records: [
    {id: malicious, seconds: 15, text: malicious, href: 'javascript:alert(1)'},
    {id: ACHIEVEMENT_FACTS[0].id, seconds: 15, text: malicious, href: 'javascript:alert(1)'},
    {id: ACHIEVEMENT_FACTS[0].id, seconds: 30},
    {id: ACHIEVEMENT_FACTS[1].id, seconds: 'NaN'}
  ]}));
  const s = setup({storage});
  assert.equal(s.log.records.length, 1);
  const item = s.root.querySelector('[data-game-record-list]').firstElementChild;
  assert.equal(item.querySelector('img,script'), null);
  assert(!item.textContent.includes(malicious));
  assert.equal(item.querySelector('a').getAttribute('href'), ACHIEVEMENT_FACTS[0].source.href);
});

test('a blocked browser localStorage getter is handled before loading the log', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, get() { throw Error('SecurityError'); }});
    const log = createAchievementLog({random: () => 0});
    assert.equal(log.advance(15).length, 1);
    assert.equal(log.records.length, 1);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('invalid clocks, random sources and disposal cannot create unbounded or duplicate records', () => {
  const s = setup({random: () => NaN});
  for (const value of [NaN, Infinity, -1, '15', undefined]) assert.deepEqual(s.log.advance(value), []);
  assert.equal(s.log.advance(1e9).length, ACHIEVEMENT_FACTS.length);
  assert.equal(s.log.records.length, ACHIEVEMENT_FACTS.length);
  s.log.hideToast();
  assert.equal(s.root.querySelector('[data-game-achievement]').hidden, true);
  s.log.dispose();
  assert.equal(s.log.advance(1e9 + 15).length, 0);
});
