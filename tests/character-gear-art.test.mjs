import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inflateSync} from 'node:zlib';
import {makeSkinMask, tintSkinPixels} from '../assets/js/character-gear-art.js';
import {SPRITES} from '../assets/js/character-sprites.js';

// Decode the repository's RGBA8 PNGs with Node only; asset verification must
// also run after a clean npm ci without a native image authoring dependency.
function rgbaPNG(bytes) {
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.equal(bytes[24], 8); assert.equal(bytes[25], 6); assert.equal(bytes[28], 0);
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * 4;
  const data = new Uint8ClampedArray(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], begin = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? data[begin + x - 4] : 0, up = y ? data[begin + x - stride] : 0, diagonal = y && x >= 4 ? data[begin + x - stride - 4] : 0;
      const prediction = filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth(left, up, diagonal) : 0;
      data[begin + x] = (raw[y * (stride + 1) + x + 1] + prediction) & 255;
    }
  }
  return {width, height, data};
}

test('selective skin tint preserves opaque clothing, gold, hair and every alpha byte', () => {
  const colors = [[250,190,135,255], [214,140,94,180], [250,190,45,255], [207,24,32,255], [38,60,106,255], [12,12,14,255], [244,244,245,255], [255,0,0,0]];
  // Swatches are separated, as the original sprites separate skin and cloth
  // with dark/transparent outlines rather than joining their warm palettes.
  const original = new Uint8ClampedArray(colors.flatMap(color => [...color, 0, 0, 0, 0])), result = new Uint8ClampedArray(original);
  const mask = makeSkinMask(original, colors.length * 2, 1);
  tintSkinPixels(result, mask);
  assert.notDeepEqual([...result.slice(0, 3)], colors[0].slice(0, 3));
  for (let index = 2; index < colors.length; index++) assert.deepEqual([...result.slice(index * 8, index * 8 + 4)], colors[index]);
  for (let index = 0; index < colors.length * 2; index++) assert.equal(result[index * 4 + 3], original[index * 4 + 3]);
});

test('connected skin shadows stay pink even when an individual shade resembles gold', () => {
  const colors = [[250,190,135,255], [214,140,94,255], [148,90,60,255], [0,0,0,0], [250,190,45,255]];
  const original = new Uint8ClampedArray(colors.flat()), mask = makeSkinMask(original, 5, 1);
  assert.deepEqual([...mask], [1,1,1,0,0]);
  const tinted = tintSkinPixels(new Uint8ClampedArray(original), mask);
  for (let x = 0; x < 3; x++) assert(tinted[x * 4 + 2] > tinted[x * 4 + 1], 'highlights and shadows must both have a pink hue');
  assert.deepEqual([...tinted.slice(16)], colors[4], 'the separate golden prop stays unchanged');
});

test('all original sheets keep exact dimensions, transparency and unmasked pixels under Gear 2', () => {
  for (const sheet of Object.values(SPRITES)) {
    const bytes = fs.readFileSync(new URL('../' + sheet.src, import.meta.url));
    const {width, height, data} = rgbaPNG(bytes);
    const mask = makeSkinMask(data, width, height, sheet.frames);
    const tinted = tintSkinPixels(new Uint8ClampedArray(data), mask);
    assert.equal(tinted.length, width * height * 4);
    let changed = 0;
    for (let pixel = 0; pixel < mask.length; pixel++) {
      const offset = pixel * 4;
      assert.equal(tinted[offset + 3], data[offset + 3], sheet.src + ': silhouette/alpha');
      if (!mask[pixel]) {
        if (tinted[offset] !== data[offset] || tinted[offset + 1] !== data[offset + 1] || tinted[offset + 2] !== data[offset + 2]) assert.fail(sheet.src + ': clothing pixel altered');
      } else {
        changed++;
        assert(tinted[offset + 2] > tinted[offset + 1], sheet.src + ': every selected shade must be pink');
      }
    }
    assert(changed > 500, sheet.src + ': skin must actually change');
    // The crown of every original hat stays gold/red, including its shading.
    for (const frame of sheet.frames) {
      const [x, y, w, h] = frame.rect;
      const hatWidth = Math.min(w, 405 / frame.scale);
      for (let py = y + 3; py < y + h * .1; py++) for (let px = Math.floor(x + hatWidth * .35); px < x + hatWidth * .6; px++) {
        assert.equal(mask[py * width + px], 0, sheet.src + ': hat crown must not turn pink');
      }
    }
  }
});

// Anatomical samples inspected against the original artwork, in native sheet
// coordinates: face, chest, hands, shins and exposed toes in EVERY frame.
// These are independent of the color classifier, including the former gaps.
const SKIN_PROBES = {
  base: [[[623,394],[628,657],[419,877],[695,1097],[463,1094],[414,1133]]],
  waiting: [
    [[389,198],[386,386],[281,454],[474,461],[306,636],[413,629]],
    [[1077,218],[1079,427],[956,478],[1169,484],[999,628],[1114,645]],
    [[1788,246],[1793,355],[1678,449],[1889,458],[1703,585],[1850,599]]
  ],
  running: [
    [[524,195],[322,411],[584,418],[491,614],[337,644]],
    [[1133,187],[898,355],[1216,381],[878,527],[1156,580]],
    [[1732,198],[1541,395],[1779,455],[1691,605],[1757,660]]
  ],
  jumping: [
    [[268,353],[106,511],[297,519],[282,618],[161,620]],
    [[695,355],[493,436],[695,497],[606,566],[673,588]],
    [[1049,320],[1131,284],[908,299],[1078,400],[964,443]],
    [[1504,217],[1326,338],[1554,375],[1455,485],[1522,493]],
    [[1954,364],[1780,512],[1979,530],[1948,618],[1855,620]]
  ],
  baseAttack: [
    [[266,211],[221,361],[351,421],[132,424],[144,578],[323,595]],
    [[771,314],[616,339],[711,354],[804,437],[618,577],[798,582]],
    [[1289,212],[1397,360],[1208,358],[1116,398],[1093,574],[1289,581]],
    [[1859,212],[2068,358],[1775,417],[1616,582],[1821,578],[1873,634]]
  ],
  jumpAttack: [
    [[273,252],[339,348],[252,365],[138,392],[348,443],[212,555],[184,605]],
    [[772,231],[886,294],[789,367],[854,369],[611,389],[723,563],[669,628]],
    [[1443,210],[1286,232],[1263,359],[1130,369],[1214,548],[1163,676]],
    [[1694,326],[1816,377],[1829,463],[1928,462],[1809,521],[1879,663]]
  ],
  inactivity: [
    [[192,299],[217,357],[140,455],[329,492],[160,571],[273,571]],
    [[645,211],[734,431],[551,435],[580,559],[697,565]],
    [[1050,247],[1071,305],[999,426],[1157,426],[999,564],[1125,564]],
    [[1435,318],[1478,361],[1403,452],[1575,489],[1434,599],[1534,570]],
    [[1971,299],[1921,370],[1836,449],[2012,458],[1851,571],[1969,571]]
  ]
};

test('all frames tint exposed anatomy, including transformation pieces and elastic arm/shin samples', () => {
  for (const [name, probes] of Object.entries(SKIN_PROBES)) {
    const sheet = SPRITES[name];
    assert.equal(probes.length, sheet.frames.length, name + ': every animation frame must be covered');
    const {width, height, data} = rgbaPNG(fs.readFileSync(new URL('../' + sheet.src, import.meta.url)));
    const mask = makeSkinMask(data, width, height, sheet.frames);
    const tinted = tintSkinPixels(new Uint8ClampedArray(data), mask);
    for (const [frame, points] of probes.entries()) for (const [x, y] of points) {
      const pixel = y * width + x;
      assert.equal(mask[pixel], 1, `${name}[${frame}] skin gap at ${x},${y}`);
      assert(tinted[pixel * 4 + 2] > tinted[pixel * 4 + 1], `${name}[${frame}] skin must be pink`);
    }
    // These strips are the actual source pixels repeated to extend a limb.
    const strip = name === 'baseAttack' ? [1935,350,8,64] : name === 'jumpAttack' ? [1857,579,24,18] : null;
    if (strip) {
      let skin = 0;
      const [sx, sy, sw, sh] = strip;
      for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) {
        const pixel = y * width + x, offset = pixel * 4;
        if (data[offset + 3] < 128 || data[offset] < 180 || data[offset + 1] < 110 || data[offset + 2] < 80) continue;
        assert.equal(mask[pixel], 1, name + ': elastic limb cannot repeat an untinted skin pixel');
        skin++;
      }
      assert(skin > 100, name + ': inspect the skin strip actually used for stretching');
    }
  }
});
