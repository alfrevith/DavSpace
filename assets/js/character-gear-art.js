import { SPRITES, SPRITE_REFERENCE } from './character-sprites.js';

export function isSkinColor(r, g, b) {
  return r >= 110 && g >= 55 && b >= 20 && r - g >= 2 && r - g <= 150 && g - b >= 2 && g / r >= .37;
}

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

// Classify connected flesh regions, not individual highlight/shadow colors.
// Previously a single golden-looking skin shadow could reject a whole limb.
export function makeSkinMask(data, width, height, frames = []) {
  const count = width * height;
  const tags = new Uint8Array(count);
  const queue = new Int32Array(count);
  const mask = new Uint8Array(count);
  for (let index = 0; index < count; index++) {
    const offset = index * 4;
    // Near-transparent source noise must not connect a hand to a gold prop.
    if (data[offset + 3] < 64) continue;
    const r = data[offset], g = data[offset + 1], b = data[offset + 2];
    if (isSkinColor(r, g, b)) tags[index] = 1;
  }
  // Baked-in impact dust is not skin even when its warm highlights are peach.
  for (const frame of frames) if (frame.airClip) {
    const [sx, sy, sw, sh] = frame.rect;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      if (!insidePolygon(x + .5, y + .5, frame.airClip)) tags[(sy + y) * width + sx + x] = 0;
    }
  }
  for (let first = 0; first < count; first++) {
    if (tags[first] !== 1) continue;
    let head = 0, tail = 1, red = 0, green = 0, blue = 0, weight = 0;
    queue[0] = first;
    tags[first] = 2;
    while (head < tail) {
      const index = queue[head++], x = index % width, offset = index * 4;
      const alpha = data[offset + 3] / 255;
      red += data[offset] * alpha; green += data[offset + 1] * alpha; blue += data[offset + 2] * alpha; weight += alpha;
      for (const next of [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, index - width, index + width]) {
        if (next >= 0 && next < count && tags[next] === 1) { tags[next] = 2; queue[tail++] = next; }
      }
    }
    const flesh = weight >= 1 && red / weight >= 190 && (red - green) / weight >= 25 &&
      blue / red >= .45 && (green - blue) / weight <= 78;
    if (flesh) for (let index = 0; index < tail; index++) mask[queue[index]] = 1;
  }
  // Include faint skin edge pixels without crossing the sprite's dark outline.
  for (let pass = 0; pass < 2; pass++) {
    const added = [];
    for (let index = 0; index < count; index++) {
      const offset = index * 4;
      if (mask[index] || !data[offset + 3] || data[offset + 3] >= 64 || !isSkinColor(data[offset], data[offset + 1], data[offset + 2])) continue;
      const x = index % width;
      if (x > 0 && mask[index - 1] || x + 1 < width && mask[index + 1] || index >= width && mask[index - width] || index + width < count && mask[index + width]) added.push(index);
    }
    for (const index of added) mask[index] = 1;
  }
  return mask;
}

export function tintSkinPixels(data, mask) {
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index]) continue;
    const offset = index * 4;
    const r = data[offset], g = data[offset + 1], b = data[offset + 2];
    const pinkGreen = Math.round(g * .82);
    data[offset] = Math.min(255, r + 8);
    data[offset + 1] = pinkGreen;
    data[offset + 2] = Math.min(255, Math.max(b + 22, pinkGreen + 5 + Math.round((r - g) * .12)));
  }
  return data;
}

export function createGearArt(document) {
  const cache = new WeakMap();
  function source(image, tint = 0, rect = null, definition = null) {
    if (tint <= 0) return image;
    let entry = cache.get(image);
    if (!entry) {
      const pink = document.createElement('canvas');
      pink.width = image.naturalWidth || image.width;
      pink.height = image.naturalHeight || image.height;
      const context = pink.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, pink.width, pink.height);
      const sheet = definition || Object.values(SPRITES).find(sheet => typeof image.src === 'string' && image.src.endsWith(sheet.src));
      tintSkinPixels(pixels.data, makeSkinMask(pixels.data, pink.width, pink.height, sheet?.frames));
      context.putImageData(pixels, 0, 0);
      entry = { pink, blend: null, key: '', rect: null };
      cache.set(image, entry);
    }
    if (tint >= .999) return entry.pink;
    const strength = Math.round(tint * 16) / 16;
    if (strength <= 0) return image;
    if (strength >= 1) return entry.pink;
    const region = rect || [0, 0, entry.pink.width, entry.pink.height];
    const key = `${strength}:${region.join(',')}`;
    if (entry.key === key) return entry.blend;
    if (!entry.blend) {
      entry.blend = document.createElement('canvas');
      entry.blend.width = entry.pink.width;
      entry.blend.height = entry.pink.height;
      entry.blend.spriteRevision = 0;
    }
    const context = entry.blend.getContext('2d');
    if (entry.rect) context.clearRect(...entry.rect);
    context.imageSmoothingEnabled = false;
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1 - strength;
    context.drawImage(image, ...region, ...region);
    // Add premultiplied colors, keeping the original alpha/silhouette intact.
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = strength;
    context.drawImage(entry.pink, ...region, ...region);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    entry.key = key;
    entry.rect = [...region];
    entry.blend.spriteRevision++;
    return entry.blend;
  }

  function drawFrame(context, name, index, images, tint, height = 142) {
    const frame = SPRITES[name].frames[index];
    const image = images.get(name);
    if (!image) return;
    const scale = height / SPRITE_REFERENCE.height * frame.scale;
    const pelvis = SPRITE_REFERENCE.pelvisToFloor * height / SPRITE_REFERENCE.height;
    context.drawImage(source(image, tint, frame.rect), ...frame.rect,
      -frame.pivot[0] * scale, -pelvis - frame.pivot[1] * scale, frame.rect[2] * scale, frame.rect[3] * scale);
  }

  function drawTransformation(context, images, visual, reduced = false) {
    const progress = visual.progress;
    const tint = visual.tint;
    context.imageSmoothingEnabled = false;
    if (progress < .1 || visual.state === 'reverting') {
      drawFrame(context, 'waiting', 0, images, tint);
      return;
    }
    if (progress < .22 || progress > .9) {
      drawFrame(context, 'jumping', 0, images, tint);
      return;
    }
    // The reference pose is assembled from the original bent legs, bowed head,
    // jacket and straight forearm. No original image is replaced or redrawn.
    const legs = SPRITES.jumping.frames[0];
    const legScale = 142 / SPRITE_REFERENCE.height * legs.scale;
    const legImage = source(images.get('jumping'), tint, legs.rect);
    context.drawImage(legImage, legs.rect[0], legs.rect[1] + 330, legs.rect[2], 141,
      -159 * legScale, (330 - 468) * legScale, legs.rect[2] * legScale, 141 * legScale);

    const arm = SPRITES.baseAttack.frames[3];
    const armScale = 142 / SPRITE_REFERENCE.height * arm.scale;
    const armImage = source(images.get('baseAttack'), tint, arm.rect);
    context.save();
    context.translate(-20, -59);
    context.rotate(1.23);
    context.drawImage(armImage, 1855, 350, 272, 82, 0, -35 * armScale, 272 * armScale, 82 * armScale);
    context.restore();

    const upper = SPRITES.jumpAttack.frames[3];
    const scale = 142 / SPRITE_REFERENCE.height * upper.scale;
    const upperImage = source(images.get('jumpAttack'), tint, upper.rect);
    const tremor = reduced ? 0 : Math.round(Math.sin(progress * 95)) * (progress < .76 ? 1 : 0);
    context.save();
    context.translate(tremor, -22);
    context.scale(scale, scale);
    context.translate(-upper.pivot[0], -upper.pivot[1]);
    const outline = [[0, 0], [436, 0], [436, 290], [336, 290], [336, 355], [236, 355], [236, 300], [110, 300], [95, 325], [0, 325]];
    context.beginPath();
    outline.forEach(([x, y], index) => { if (index) context.lineTo(x, y); else context.moveTo(x, y); });
    context.closePath();
    // Remove the old raised fist. The original straight-arm frame supplies the
    // planted fist, rather than leaving a duplicate hand in the pose.
    context.moveTo(0, 144); context.lineTo(85, 144); context.lineTo(100, 174);
    context.lineTo(95, 213); context.lineTo(65, 230); context.lineTo(0, 230); context.closePath();
    context.clip('evenodd');
    context.drawImage(upperImage, ...upper.rect, 0, 0, upper.rect[2], upper.rect[3]);
    context.restore();
  }
  return { source, drawTransformation };
}
