import test from 'node:test';
import assert from 'node:assert/strict';
import renderer from '../assets/js/drawings-ink-renderer.js';

test('the temporary sketch follows an actual rectangular contour and leaves source pixels untouched', () => {
  const width = 40, height = 30, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 7; y < 23; y++) for (let x = 10; x < 30; x++) {
    const i = (y * width + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
  }
  const original = pixels.slice(), lines = renderer.contours(pixels, width, height);
  assert(lines.length > 0);
  assert.deepEqual(pixels, original);
  const points = lines.flatMap(line => [...line.d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]));
  for (const [x, y] of points) {
    const nearVertical = Math.min(Math.abs(x - 10), Math.abs(x - 30)) < 2;
    const nearHorizontal = Math.min(Math.abs(y - 7), Math.abs(y - 23)) < 2;
    assert(nearVertical || nearHorizontal, `unexpected mark at ${x}, ${y}`);
  }
  assert(Math.max(...points.map(p => p[0])) > 28);
  assert(Math.min(...points.map(p => p[0])) < 11);
});

test('blank and transparent previews produce no invented drawing', () => {
  assert.deepEqual(renderer.contours(new Uint8ClampedArray(20 * 20 * 4).fill(255), 20, 20), []);
  const transparent = new Uint8ClampedArray(20 * 20 * 4);
  for (let i = 0; i < transparent.length; i += 4) transparent[i] = i % 255;
  assert.deepEqual(renderer.contours(transparent, 20, 20), []);
  assert.deepEqual(renderer.contours([], 0, 0), []);
});

test('a detailed preview has a bounded number of strokes and all marks remain inside its canvas', () => {
  const width = 200, height = 160, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = (Math.floor(x / 5) + Math.floor(y / 7)) % 2 ? 0 : 255;
    const i = (y * width + x) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
  }
  const lines = renderer.contours(pixels, width, height);
  assert(lines.length > 0 && lines.length <= 72);
  for (const line of lines) for (const point of line.d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)) {
    assert(Number(point[1]) > 0 && Number(point[1]) < width);
    assert(Number(point[2]) > 0 && Number(point[2]) < height);
  }
});
