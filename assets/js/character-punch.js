// Extend only a straight section of the original arm. The body and fist keep
// their original proportions, and the existing sprite supplies every pixel.
export const PUNCH_EXTRA_REACH = 300;

const clamp = value => Math.max(0, Math.min(1, value));

export function punchExtension(pose, x, facing, width, frame, scale) {
  const progress = clamp(pose.phaseProgress);
  let amount = 0;
  if (pose.phase === 'strike') amount = 1 - (1 - clamp(progress / .45)) ** 3;
  if (pose.phase === 'recovery') {
    const t = clamp(progress / .6);
    amount = 1 - t * t * (3 - 2 * t);
  }
  const nativeReach = (frame.rect[2] - frame.pivot[0]) * scale;
  const space = (facing > 0 ? width - x : x) - 12;
  const chargedReach = PUNCH_EXTRA_REACH * clamp(pose.chargeStrength || 0);
  return Math.max(0, Math.min(chargedReach, space - nativeReach)) * amount;
}

export function drawPunch(context, image, frame, scale, extension) {
  const [sx, sy, sw, sh] = frame.rect;
  const [px, py] = frame.pivot;
  const left = -px * scale, top = -py * scale;
  const drawOriginal = () => context.drawImage(image, sx, sy, sw, sh, left, top, sw * scale, sh * scale);
  if (!frame.armStretch || extension <= .01) { drawOriginal(); return; }

  const [zx, zy, zw, zh] = frame.armStretch.zone;
  const [bx, by, bw, bh] = frame.armStretch.sample;
  // Keep the complete sprite except the distal arm, which moves with the fist.
  context.save();
  context.beginPath();
  context.rect(left, top, sw * scale, sh * scale);
  context.rect(left + zx * scale, top + zy * scale, zw * scale, zh * scale);
  context.clip('evenodd');
  drawOriginal();
  context.restore();

  // A narrow, straight skin/outline sample forms the elastic section without
  // enlarging the knuckles, sleeve, head, torso or legs.
  context.drawImage(image, sx + bx, sy + by, bw, bh,
    left + bx * scale, top + by * scale, extension + bw * scale, bh * scale);
  context.drawImage(image, sx + zx, sy + zy, zw, zh,
    left + zx * scale + extension, top + zy * scale, zw * scale, zh * scale);
}
