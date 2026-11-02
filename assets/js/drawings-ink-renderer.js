/* Derive a small, temporary vector sketch from a preview. Source files and
   displayed image pixels are never modified. No original image is requested. */
((root, factory) => {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SketchbookInk = factory();
})(globalThis, () => {
  const cache = new Map();
  const neighbors = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  function contours(pixels, width, height) {
    if (width < 3 || height < 3 || pixels.length !== width * height * 4) return [];
    const size = width * height;
    const gray = new Float32Array(size), magnitude = new Float32Array(size);
    const dx = new Float32Array(size), dy = new Float32Array(size), edge = new Uint8Array(size);
    let peak = 0;
    for (let i = 0; i < size; i++) {
      const offset = i * 4, alpha = pixels[offset + 3] / 255;
      gray[i] = (pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722) * alpha + 255 * (1 - alpha);
    }
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      dx[i] = -gray[i - width - 1] + gray[i - width + 1] - 2 * gray[i - 1] + 2 * gray[i + 1] - gray[i + width - 1] + gray[i + width + 1];
      dy[i] = -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] + gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      magnitude[i] = Math.hypot(dx[i], dy[i]);
      peak = Math.max(peak, magnitude[i]);
    }
    const threshold = Math.max(48, peak * .1);
    // Thin the gradient to strokes, rather than drawing thick bands of pixels.
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const i = y * width + x, value = magnitude[i];
      if (value < threshold) continue;
      const ax = Math.abs(dx[i]), ay = Math.abs(dy[i]);
      const step = ax > ay * 2.4 ? 1 : ay > ax * 2.4 ? width : dx[i] * dy[i] > 0 ? width + 1 : width - 1;
      if (value > magnitude[i - step] && value >= magnitude[i + step]) edge[i] = 1;
    }
    const lines = [];
    for (let start = 0; start < size; start++) {
      if (!edge[start]) continue;
      const points = [];
      let current = start, previousDirection = -1;
      while (current >= 0) {
        edge[current] = 0;
        const x = current % width, y = Math.floor(current / width);
        points.push([x + .5, y + .5]);
        let next = -1, direction = -1, best = -Infinity;
        neighbors.forEach(([nx, ny], index) => {
          const xx = x + nx, yy = y + ny, candidate = yy * width + xx;
          if (xx < 1 || xx >= width - 1 || yy < 1 || yy >= height - 1 || !edge[candidate]) return;
          const distance = previousDirection < 0 ? 0 : Math.min(Math.abs(index - previousDirection), 8 - Math.abs(index - previousDirection));
          const score = magnitude[candidate] * .001 - distance;
          if (score > best) { best = score; next = candidate; direction = index; }
        });
        current = next; previousDirection = direction;
      }
      if (points.length < 6) continue;
      const stride = Math.max(2, Math.ceil(points.length / 200));
      const sampled = points.filter((_, i) => i === 0 || i === points.length - 1 || i % stride === 0);
      lines.push({ length: points.length, d: sampled.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('') });
    }
    return lines.sort((a, b) => b.length - a.length).slice(0, 72);
  }

  function createTracing(image, doc) {
    let sketch = cache.get(image.currentSrc || image.src);
    if (!sketch) {
      const ratio = Math.min(1, 200 / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(3, Math.round(image.naturalWidth * ratio));
      const height = Math.max(3, Math.round(image.naturalHeight * ratio));
      const canvas = doc.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(image, 0, 0, width, height);
      const lines = contours(context.getImageData(0, 0, width, height).data, width, height);
      canvas.width = canvas.height = 0;
      sketch = { width, height, lines };
      if (cache.size >= 8) cache.delete(cache.keys().next().value);
      cache.set(image.currentSrc || image.src, sketch);
    }
    if (!sketch.lines.length) return null;
    const ns = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'image-ink-tracing');
    svg.setAttribute('viewBox', `0 0 ${sketch.width} ${sketch.height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    for (const line of sketch.lines) {
      const path = doc.createElementNS(ns, 'path');
      path.setAttribute('d', line.d); path.setAttribute('pathLength', '1'); path.setAttribute('data-ink-stroke', '');
      svg.append(path);
    }
    return svg;
  }
  return { contours, createTracing };
});
