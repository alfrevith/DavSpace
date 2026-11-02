import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DOMParser } from 'linkedom';
import fire from '../assets/js/writing-fire.js';

const root = new URL('../', import.meta.url);
function discover(directory) {
  return fs.readdirSync(new URL(directory + '/', root), { withFileTypes: true }).flatMap(entry => {
    const file = directory + '/' + entry.name;
    return entry.isDirectory() ? discover(file) : entry.isFile() && /\.pdf$/i.test(entry.name) ? [file] : [];
  });
}

test('every real poetry/story PDF is catalogued once and remains directly accessible without JavaScript', () => {
  const { works } = JSON.parse(fs.readFileSync(new URL('data/writing.json', root), 'utf8'));
  const files = [...discover('pdfs/poems'), ...discover('pdfs/stories')];
  const managed = works.filter(work => /^pdfs\/(poems|stories)\//.test(work.pdf));
  assert.deepEqual(managed.map(work => work.pdf).sort(), files.sort());
  assert.equal(new Set(works.map(work => work.id)).size, works.length);
  const document = new DOMParser().parseFromString(fs.readFileSync(new URL('writing.html', root), 'utf8'), 'text/html');
  const links = [...document.querySelectorAll('.original-manuscripts a')];
  for (const work of managed) {
    assert.equal(work.type, work.pdf.startsWith('pdfs/poems/') ? 'poetry' : 'story');
    assert(work.title.trim() && Number.isInteger(work.pages) && work.pages > 0);
    assert.equal(path.extname(work.pdf).toLowerCase(), '.pdf');
    const link = links.find(link => link.getAttribute('href') === work.pdf);
    assert(link, `Missing direct original: ${work.pdf}`);
    assert(link.textContent.includes(work.title));
  }
});

test('flame tips and curved sides retain headroom at mobile and desktop sizes, including a full flare', () => {
  for (const [width, height] of [[250, 190], [520, 270]]) for (let i = 0; i < 180; i++) {
    const tongues = fire.frame(width, height, i / 30, (i % 60) / 59);
    assert.equal(tongues.length, 6);
    for (const flame of tongues) {
      for (const value of Object.values(flame)) assert(Number.isFinite(value));
      assert(flame.height > 0 && flame.width > 0 && flame.alpha > 0 && flame.alpha <= 1);
      assert(flame.base - flame.height > height * .08, 'A flame tip must never hit the canvas edge');
      const reach = flame.width * 1.3 + Math.abs(flame.bend) + Math.abs(flame.tip);
      assert(flame.x - reach > 0 && flame.x + reach < width);
    }
  }
  assert.deepEqual(fire.frame(0, 0, 0), []);
});

test('the flare grows taller continuously while resting flames move without random frame-to-frame jumps', () => {
  for (let i = 0; i < 120; i++) {
    const calm = fire.frame(520, 270, i / 30), next = fire.frame(520, 270, (i + 1) / 30);
    const flare = fire.frame(520, 270, i / 30, 1);
    assert(flare.reduce((sum, f) => sum + f.height, 0) > calm.reduce((sum, f) => sum + f.height, 0) * 1.15);
    for (let j = 0; j < calm.length; j++) {
      assert(Math.abs(next[j].height - calm[j].height) < 5);
      assert(Math.abs(next[j].tip - calm[j].tip) < 2);
    }
  }
});

test('the illustrated painter uses finite curves and restores Canvas opacity and compositing', () => {
  const initial = { globalAlpha: .42, globalCompositeOperation: 'source-over', fillStyle: '#123456' };
  const stack = []; let curves = 0, fills = 0;
  const finite = (...values) => values.forEach(value => assert(Number.isFinite(value)));
  const gradient = (...values) => { finite(...values); return { addColorStop(offset,color) { assert(offset>=0&&offset<=1);assert.equal(typeof color,'string'); } }; };
  const context = { ...initial,
    save() { stack.push(Object.fromEntries(Object.keys(initial).map(key=>[key,this[key]]))); },
    restore() { assert(stack.length);Object.assign(this,stack.pop()); },
    translate:finite,scale:finite,clearRect:finite,moveTo:finite,
    createLinearGradient:gradient,createRadialGradient:gradient,
    beginPath(){},closePath(){},bezierCurveTo(...values){finite(...values);curves++;},
    fill(){fills++;},fillRect(...values){finite(...values);fills++;}
  };
  for (const time of [0,.7,1.4,3]) {
    fire.paint(context,520,270,time,1);
    assert.deepEqual(Object.fromEntries(Object.keys(initial).map(key=>[key,context[key]])),initial);
    assert.equal(stack.length,0);
  }
  assert(curves>0&&fills>0);
});
