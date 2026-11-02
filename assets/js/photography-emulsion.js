/* Temporary alpha masks reveal the photograph's own light. RGB values are never
   graded, inverted or filtered. The untouched image replaces the canvas at rest. */
((root, factory) => {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PhotographyEmulsion = factory();
})(globalThis, () => {
  const cache = new Map();
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const hash = (a, b) => { let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967295; };
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
    const top = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx;
    const bottom = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  }
  function analyze(pixels, width, height) {
    if (width < 1 || height < 1 || pixels.length !== width * height * 4) return null;
    const field = new Float32Array(width * height);
    let min = Infinity, max = -Infinity, weight = 0, red = 0, green = 0, blue = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x, p = i * 4, alpha = pixels[p + 3] / 255;
      const light = (pixels[p] * .2126 + pixels[p + 1] * .7152 + pixels[p + 2] * .0722) / 255 * alpha;
      const nx = x / width, ny = y / height;
      const cloud = noise(nx * 4.2, ny * 4.2) * .72 + noise(nx * 13.7 + 3, ny * 13.7 + 9) * .28;
      field[i] = .58 * (1 - light) + .30 * cloud + .12 * (nx * .6 + ny * .4);
      min = Math.min(min, field[i]); max = Math.max(max, field[i]);
      const contribution = light * light * alpha;
      red += pixels[p] * contribution; green += pixels[p + 1] * contribution; blue += pixels[p + 2] * contribution; weight += contribution;
    }
    const range = Math.max(.001, max - min);
    for (let i = 0; i < field.length; i++) field[i] = (field[i] - min) / range;
    return { field, width, height, color: weight > .001 ? [red, green, blue].map(c => Math.round(c / weight)) : [190, 157, 105] };
  }
  function paintAlpha(field, progress, pixels) {
    const front = clamp(progress) * 1.24;
    for (let i = 0; i < field.length; i++) pixels[i * 4 + 3] = Math.round(smooth((front - field[i]) / .24) * 255);
  }
  function fitRect(naturalWidth, naturalHeight, box) {
    const ratio = Math.min(box.width / naturalWidth, box.height / naturalHeight);
    const width = naturalWidth * ratio, height = naturalHeight * ratio;
    return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height };
  }
  function sample(image, doc) {
    const key = image.currentSrc || image.src;
    if (cache.has(key)) return cache.get(key);
    if (!image.naturalWidth || !image.naturalHeight) return null;
    const scale = Math.min(1, 144 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = analyze(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    canvas.width = canvas.height = 0;
    if (cache.size >= 12) cache.delete(cache.keys().next().value);
    cache.set(key, result);
    return result;
  }
  function develop(image, { duration = 1250, delay = 0, mobile = false, onFinish = () => {} } = {}) {
    const doc = image.ownerDocument, win = doc.defaultView, data = sample(image, doc);
    if (!data || !image.isConnected || !image.parentElement) return null;
    const parent = image.parentElement, box = { left: 0, top: 0, width: image.clientWidth, height: image.clientHeight };
    const fit = fitRect(image.naturalWidth, image.naturalHeight, box);
    if (fit.width < 2 || fit.height < 2) return null;
    const layer = doc.createElement('canvas'), context = layer.getContext('2d', { alpha: true });
    const mask = doc.createElement('canvas'); mask.width = data.width; mask.height = data.height;
    const maskContext = mask.getContext('2d');
    if (!context || !maskContext) return null;
    const limit = mobile ? 600 : 1000;
    const scale = Math.min(mobile ? 1 : 1.5, limit / Math.max(fit.width, fit.height));
    layer.width = Math.max(1, Math.round(fit.width * scale)); layer.height = Math.max(1, Math.round(fit.height * scale));
    layer.className = 'photo-development'; layer.setAttribute('aria-hidden', 'true');
    Object.assign(layer.style, { left: image.offsetLeft + fit.left + 'px', top: image.offsetTop + fit.top + 'px', width: fit.width + 'px', height: fit.height + 'px' });
    const buffer = maskContext.createImageData(data.width, data.height);
    for (let i = 0; i < buffer.data.length; i += 4) buffer.data[i] = buffer.data[i + 1] = buffer.data[i + 2] = 255;
    const originalOpacity = image.style.opacity;
    let frame = 0, start = null, last = -Infinity, done = false;
    image.style.opacity = '0'; parent.append(layer);
    function finish() {
      if (done) return;
      done = true; win.cancelAnimationFrame(frame); image.style.opacity = originalOpacity;
      layer.remove(); layer.width = layer.height = mask.width = mask.height = 0;
      onFinish();
    }
    function render(time) {
      if (done) return;
      if (!image.isConnected || doc.hidden) { finish(); return; }
      if (start === null) start = time;
      const progress = (time - start - delay) / duration;
      if (progress >= 1) { finish(); return; }
      frame = win.requestAnimationFrame(render);
      if (progress < 0 || time - last < (mobile ? 1000 / 24 : 1000 / 30)) return;
      last = time;
      paintAlpha(data.field, progress, buffer.data); maskContext.putImageData(buffer, 0, 0);
      context.clearRect(0, 0, layer.width, layer.height);
      context.globalCompositeOperation = 'source-over';
      context.drawImage(image, 0, 0, layer.width, layer.height);
      context.globalCompositeOperation = 'destination-in';
      context.drawImage(mask, 0, 0, layer.width, layer.height);
      context.globalCompositeOperation = 'source-over';
    }
    frame = win.requestAnimationFrame(render);
    return { cancel: finish, color: data.color, get canvas() { return layer; } };
  }
  return { analyze, paintAlpha, fitRect, sample, develop };
});
