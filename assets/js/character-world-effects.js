// Shared visual and damage envelopes keep large attacks honest.
export const WORLD_EFFECTS = Object.freeze({explosionRadius: 152, explosionLife: .72,
  tornadoHeight: 300, tornadoRadius: 64, tornadoDuration: .6, healthWidth: 72});
const clamp = value => Math.max(0, Math.min(1, value));
export function explosionRadius(effect) {
  const progress = clamp(effect.age / effect.life);
  if (progress >= .84 || effect.harmless) return 0;
  return effect.radius * [.5, .86, 1, .88][Math.min(3, Math.floor(progress * 4))];
}
export function tornadoGeometry(enemy) {
  const t = enemy.mode === 'aim' ? 1 : clamp(enemy.modeTime / .08);
  const growth = t * t * (3 - 2 * t);
  return {height: 167 + (WORLD_EFFECTS.tornadoHeight - 167) * growth,
    radius: 28 + (WORLD_EFFECTS.tornadoRadius - 28) * growth};
}
