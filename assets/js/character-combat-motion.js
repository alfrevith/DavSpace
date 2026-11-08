// Secondary combat motion uses the existing artwork at its original proportions.
export const KICK_EXTRA_REACH = 120;
export const KICK_DIRECTION = Object.freeze({ x: 1 / Math.sqrt(5), y: 2 / Math.sqrt(5) });
const clamp = value => Math.max(0, Math.min(1, value));
const bands = new WeakMap();

export function chargeMotion(strength, time, reduced = false) {
  const power = clamp(strength);
  const age = Math.max(0, time);
  const settle = 1 - Math.exp(-age * 18);
  const breathing = reduced ? 0 : Math.sin(age * 6.5) * (.004 + .008 * power);
  // Rotate around the back foot: the stance braces instead of floating upward.
  return { angle: (-(.018 + .07 * power) + breathing) * settle, pivotX: -20 };
}

export function kickExtension(pose, x, y, facing, width, floor, frame, scale) {
  if (pose.phase !== 'dive' || pose.grounded) return 0;
  const t = clamp(pose.phaseProgress / .14);
  const release = t * t * (3 - 2 * t);
  const footReach = (frame.legStretch.tip[0] - frame.pivot[0]) * scale;
  const sideSpace = Math.max(0, (facing > 0 ? width - x : x) - 12 - footReach);
  const groundSpace = Math.max(0, floor - y);
  return Math.max(0, Math.min(KICK_EXTRA_REACH * release, groundSpace / KICK_DIRECTION.y, sideSpace / KICK_DIRECTION.x));
}

function polygon(context, points) {
  context.beginPath();
  points.forEach(([x, y], index) => { if (index) context.lineTo(x, y); else context.moveTo(x, y); });
  context.closePath();
}

function cleanSilhouette(context, frame) {
  if (frame.airClip) { polygon(context, frame.airClip); context.clip(); }
}

function halfPlane(context, anchor, lower) {
  const d = KICK_DIRECTION, n = { x: d.y, y: -d.x };
  const [ax, ay] = anchor;
  const low = lower ? 0 : -2000, high = lower ? 2000 : 0;
  polygon(context, [[-2000, low], [2000, low], [2000, high], [-2000, high]].map(([u, v]) => [ax + n.x * u + d.x * v, ay + n.y * u + d.y * v]));
  context.clip();
}

function shinBand(image, frame, document) {
  const revision = image.spriteRevision || 0;
  const cached = bands.get(image);
  if (cached?.revision === revision && cached.frame === frame) return cached.canvas;
  const canvas = document.createElement('canvas');
  const { anchor, bandWidth, bandHeight } = frame.legStretch;
  canvas.width = bandWidth;
  canvas.height = bandHeight;
  const context = canvas.getContext('2d');
  const d = KICK_DIRECTION, n = { x: d.y, y: -d.x };
  context.imageSmoothingEnabled = false;
  context.setTransform(n.x, d.x, n.y, d.y,
    bandWidth / 2 - n.x * anchor[0] - n.y * anchor[1],
    bandHeight / 2 - d.x * anchor[0] - d.y * anchor[1]);
  cleanSilhouette(context, frame);
  context.drawImage(image, ...frame.rect, 0, 0, frame.rect[2], frame.rect[3]);
  // A transition canvas can keep its identity while its skin tint changes.
  bands.set(image, {canvas, revision, frame});
  return canvas;
}

export function drawExtendedKick(context, image, frame, scale, extension, document = globalThis.document) {
  const [sx, sy, sw, sh] = frame.rect;
  const [px, py] = frame.pivot;
  if (!frame.legStretch || extension <= .01) {
    context.drawImage(image, sx, sy, sw, sh, -px * scale, -py * scale, sw * scale, sh * scale);
    return;
  }
  const d = KICK_DIRECTION, n = { x: d.y, y: -d.x };
  const { anchor, bandWidth, bandHeight } = frame.legStretch;
  const extra = extension / scale;
  const band = shinBand(image, frame, document);
  context.save();
  context.translate(-px * scale, -py * scale);
  context.scale(scale, scale);

  // Upper leg and body remain exactly where the source animation put them.
  context.save();
  cleanSilhouette(context, frame);
  halfPlane(context, anchor, false);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  context.restore();

  // Stretch a thin oblique shin section along its own axis, not the whole model.
  context.save();
  context.transform(n.x, n.y, d.x, d.y, anchor[0], anchor[1]);
  context.drawImage(band, 0, 0, bandWidth, bandHeight,
    -bandWidth / 2, -bandHeight / 2, bandWidth, extra + bandHeight);
  context.restore();

  // Translate the remaining calf and sandal as one rigid piece.
  context.save();
  context.translate(d.x * extra, d.y * extra);
  cleanSilhouette(context, frame);
  halfPlane(context, anchor, true);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  context.restore();
  context.restore();
}
