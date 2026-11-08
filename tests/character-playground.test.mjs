import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DOMParser} from 'linkedom';
import {SPRITES, SPRITE_REFERENCE} from '../assets/js/character-sprites.js';

const root = new URL('../', import.meta.url);
const parse = name => new DOMParser().parseFromString(fs.readFileSync(new URL(name, root), 'utf8'), 'text/html');

test('both home layouts place the playground directly before contact without adding a navigation stop', () => {
  for (const name of ['index.html', 'index-mobile.html']) {
    const doc = parse(name);
    const playground = doc.querySelector('[data-character-playground]');
    assert(playground, name);
    assert.equal(playground.id, 'playground');
    assert.equal(playground.nextElementSibling.id, 'contact');
    assert(!playground.classList.contains('section'), 'the main scroll-navigation list stays unchanged');
    assert.equal(doc.querySelector('.nav a[href="#playground"]'), null);
    assert.equal(doc.querySelectorAll('[data-character-playground]').length, 1);
    assert(doc.querySelector('link[href="assets/css/character-playground.css"]'));
    assert.equal(doc.querySelector('script[src="assets/js/character-playground.js"]').getAttribute('type'), 'module');
    assert(doc.getElementById(playground.getAttribute('aria-labelledby')));
  }
});

test('desktop and phone share complete accessible controls, loading feedback and instructions', () => {
  const entries = ['index.html', 'index-mobile.html'].map(parse);
  for (const doc of entries) {
    const canvas = doc.querySelector('[data-game-canvas]');
    assert.equal(canvas.getAttribute('tabindex'), '0');
    assert(canvas.getAttribute('aria-label').includes('Space'));
    const instructions = doc.getElementById(canvas.getAttribute('aria-describedby'));
    assert(instructions);
    for (const label of ['Move', 'Jump', 'Attack']) assert(instructions.textContent.includes(label));
    assert.equal(doc.querySelector('[data-game-status]'), null, 'the action narration is removed');
    assert.deepEqual([...doc.querySelector('.game-toolbar-actions').children].map(b => b.hasAttribute('data-game-fullscreen') ? 'fullscreen' : b.hasAttribute('data-game-sound') ? 'sound' : b.hasAttribute('data-game-pause') ? 'pause' : b.hasAttribute('data-game-reset') ? 'restart' : 'unexpected'), ['fullscreen','sound','pause','restart']);
    assert(doc.querySelector('[data-game-gear]').closest('.game-touch-controls'), 'Gear 2 stays within thumb reach');
    assert.equal(doc.querySelector('[data-game-help]').getAttribute('role'), 'status');
    assert.equal(doc.querySelector('[data-game-help]').getAttribute('aria-live'), 'polite', 'loading and pause feedback remain accessible');
    for (const selector of ['[data-game-start]', '[data-game-pause]', '[data-game-reset]', '[data-game-gear]']) {
      const button = doc.querySelector(selector);
      assert.equal(button.getAttribute('type'), 'button');
      assert(button.hasAttribute('disabled'), 'controls wait for a fully loaded character');
      assert(button.getAttribute('aria-label') || button.textContent.trim());
    }
    assert.equal(doc.querySelector('[data-game-gear]').getAttribute('aria-pressed'), 'false');
    const haki=doc.querySelector('[data-game-haki]');
    assert(haki.hasAttribute('disabled'));assert.equal(haki.getAttribute('type'),'button');
    assert(haki.getAttribute('aria-label').includes('1:00'));assert(instructions.textContent.includes('Haki'));
    assert(instructions.textContent.includes('Gear 2'));
    const controls = [...doc.querySelectorAll('[data-game-control]')];
    assert.deepEqual(controls.map(button => button.dataset.gameControl), ['left', 'right', 'jump', 'attack']);
    for (const button of controls) {
      assert.equal(button.getAttribute('type'), 'button');
      assert(button.getAttribute('aria-label'));
      assert(button.hasAttribute('disabled'));
    }
    const ids = [...doc.querySelectorAll('[id]')].map(node => node.id);
    assert.equal(new Set(ids).size, ids.length, 'new game IDs cannot collide with existing portfolio controls');
  }
  const copy = doc => doc.querySelector('[data-character-playground]').textContent.replace(/\s+/g, ' ').trim();
  assert.equal(copy(entries[0]), copy(entries[1]));
});

test('every character animation uses an existing local PNG with valid atlas rectangles and anchors', () => {
  const files = fs.readdirSync(new URL('assets/sprites/', root));
  const expected = ['base.png', 'waiting.png', 'running.png', 'Jumping.png', 'base-attack.png', 'jump-attack.png', 'inactivity.png'];
  assert.deepEqual(new Set(Object.values(SPRITES).map(sheet => sheet.src)), new Set(expected.map(file => `assets/sprites/${file}`)));
  assert(SPRITE_REFERENCE.height > 0);
  assert(SPRITE_REFERENCE.pelvisToFloor > 0);
  for (const [name, sheet] of Object.entries(SPRITES)) {
    const file = sheet.src.split('/').at(-1);
    assert(files.includes(file), `${name}: preserve filename casing for GitHub Pages`);
    const bytes = fs.readFileSync(new URL(sheet.src, root));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    assert(sheet.frames.length > 0, `${name}: needs usable frames`);
    for (const frame of sheet.frames) {
      assert.equal(frame.rect.length, 4);
      const [x, y, w, h] = frame.rect;
      assert(frame.rect.every(Number.isInteger));
      assert(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height, `${name}: crop must stay inside its original sprite sheet`);
      assert.equal(frame.pivot.length, 2);
      assert(frame.pivot.every(Number.isFinite), `${name}: stable character anchor`);
      assert(Number.isFinite(frame.scale) && frame.scale > 0, `${name}: preserve proportions`);
      if (frame.airClip) assert(frame.airClip.every(point => point.length === 2 && point.every(Number.isFinite)));
    }
  }
});

test('the survival HUD, result summary and persistent discovery collection remain separate from controls', () => {
  for (const name of ['index.html', 'index-mobile.html']) {
    const doc = parse(name);
    const game = doc.querySelector('[data-character-playground]');
    const hud=game.querySelector('.game-hud');
    assert.equal(hud.parentElement.className,'game-shell');
    assert.equal(hud.nextElementSibling,game.querySelector('.game-arena-slot'),'HUD stays outside the battlefield');
    assert(game.querySelector('.game-arena-slot').contains(game.querySelector('[data-game-stage]')));
    assert.equal(hud.querySelectorAll('.game-hud-panel').length,4);
    assert(hud.querySelector('[data-game-health-trail]'));
    assert(hud.querySelector('[data-game-gear-note]'));
    const gearPrompt=hud.querySelector('[data-game-gear-prompt]');
    assert(gearPrompt.hasAttribute('hidden'));
    assert.match(gearPrompt.querySelector('.game-gear-prompt-keyboard').textContent,/Press G.*activate/);
    assert.match(gearPrompt.querySelector('.game-gear-prompt-touch').textContent,/Tap G2.*activate/);
    assert.equal(hud.querySelectorAll('.game-hud-emblem').length,4);
    for (const selector of ['[data-game-time]', '[data-game-kills]', '[data-game-gear-time]', '[data-game-health-value]', '[data-game-title]', '[data-game-summary]']) assert(game.querySelector(selector), selector);
    for (const selector of ['[data-game-health]', '[data-game-charge]']) {
      const meter = game.querySelector(selector);
      assert.equal(meter.getAttribute('role'), 'meter');
      assert.equal(meter.getAttribute('aria-valuemin'), '0');
      assert.equal(meter.getAttribute('aria-valuemax'), '100');
      assert(meter.getAttribute('aria-label'));
    }
    assert(game.querySelector('[data-game-health-bar]'));
    assert(game.querySelector('[data-game-charge-bar]'));
    const records = game.querySelector('[data-game-records]');
    assert.equal(records.tagName, 'DETAILS');
    assert.equal(records.hasAttribute('open'), false);
    assert(records.querySelector('summary'));
    assert(records.querySelector('[data-game-record-list]'));
    const toast = game.querySelector('[data-game-achievement]');
    assert.equal(toast.closest('[data-game-stage]'), null, 'discovery notifications must never cover the character or battlefield');
    assert.equal(toast.closest('.game-touch-controls'), null, 'discovery notifications must never block touch actions');
    assert.equal(toast.parentElement.getAttribute('aria-live'), 'polite');
    assert.equal(game.querySelector('[data-game-summary]').hidden, true);
    assert(game.querySelector('.game-overlay-mark').textContent.includes('SURVIVAL'));
  }
});
