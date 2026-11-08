// The supplied artwork has irregular margins and differently scaled sheets.
// Sample original pixels directly. Enemy pivots are at the feet; projectile
// pivots are at their center. A uniform scale preserves every model's shape.
const frame = (rect, x, y, scale = 1) => ({
  rect, pivot: [x - rect[0], y - rect[1]], scale
});

export const WORLD_REFERENCE = Object.freeze({
  marineHeight: 640,
  explosionDiameter: 392,
  scenery: Object.freeze({ width: 1672, height: 941, floorY: 790 })
});

export const ACHIEVEMENT_LAYOUT = Object.freeze({
  imageSize: [2172, 724],
  panelRect: [75, 125, 2023, 472],
  textRect: [565, 195, 1440, 330]
});

export const WORLD_SPRITES = {
  scenery: {
    src: 'assets/sprites/scenery.png',
    frames: [frame([0, 0, 1672, 941], 836, 790)]
  },
  marine1Base: {
    src: 'assets/sprites/marine-1/base.png',
    frames: [frame([164, 191, 919, 1014], 600, 1202, .635)]
  },
  marine1Walk: {
    src: 'assets/sprites/marine-1/walking.png',
    frames: [
      frame([70, 22, 557, 684], 365, 703, .944),
      frame([786, 22, 563, 684], 1089, 703, .944),
      frame([1514, 23, 558, 683], 1814, 703, .944)
    ]
  },
  marine1Aim: {
    src: 'assets/sprites/marine-1/pointing.png',
    frames: [
      frame([37, 27, 620, 678], 329, 702, .952),
      frame([758, 33, 653, 672], 1043, 702, .952),
      {...frame([1472, 41, 683, 664], 1749, 702, .952), muzzle: [679, 276]}
    ]
  },
  marine2Base: {
    src: 'assets/sprites/marine-2/base.png',
    frames: [frame([158, 190, 1038, 1018], 600, 1205, .632)]
  },
  marine2Walk: {
    src: 'assets/sprites/marine-2/walking.png',
    frames: [
      frame([53, 16, 568, 685], 308, 698, .944),
      frame([781, 21, 569, 680], 1036.5, 698, .944),
      frame([1508, 32, 576, 669], 1760.5, 698, .944)
    ]
  },
  marine2Attack: {
    src: 'assets/sprites/marine-2/attack.png',
    frames: [
      frame([43, 153, 405, 433], 240, 583, 1.5),
      frame([507, 161, 369, 425], 757, 583, 1.5),
      frame([951, 181, 568, 405], 1239, 583, 1.5),
      frame([1539, 199, 589, 387], 1861, 583, 1.5)
    ]
  },
  marine2Upper: {
    src: 'assets/sprites/marine-2/attack-2.png',
    frames: [
      frame([33, 221, 424, 412], 258, 630, 1.576),
      frame([495, 193, 560, 439], 807, 629, 1.576),
      frame([1097, 125, 488, 505], 1340, 627, 1.576),
      frame([1654, 107, 462, 529], 1885, 633, 1.576)
    ]
  },
  marine2Swirl: {
    src: 'assets/sprites/marine-2/swirl-attack-2.png',
    frames: [
      frame([140, 40, 551, 618], 415.5, 655, 1.3),
      frame([816, 40, 553, 623], 1092.5, 660, 1.3),
      frame([1498, 33, 557, 630], 1776.5, 660, 1.3)
    ]
  },
  bullet: {
    src: 'assets/sprites/marine-1/bullet.png',
    frames: [frame([469, 528, 299, 198], 642, 626)]
  },
  bulletAnimation: {
    src: 'assets/sprites/marine-1/bullet-animation.png',
    frames: [frame([175, 205, 411, 297], 415, 355),
      frame([844, 174, 447, 386], 1114, 355),
      frame([1559, 206, 451, 303], 1830, 355)]
  },
  cannonball: {
    src: 'assets/sprites/cannonball/base.png',
    frames: [frame([270, 274, 715, 717], 627.5, 632.5)]
  },
  explosion: {
    src: 'assets/sprites/cannonball/explosion.png',
    frames: [
      // Full 543px cells preserve every spark and smoke puff, including faint
      // alpha edges. Center the visible effect and match its shared damage
      // envelope (.5, .86, 1, .88) with a uniform scale per frame.
      frame([0, 0, 543, 724], 300, 334, 392 * .5 / 306),
      frame([543, 0, 543, 724], 829, 335, .86),
      frame([1086, 0, 543, 724], 1356, 338, 392 / 390),
      frame([1629, 0, 543, 724], 1895, 333, 392 * .88 / 354)
    ]
  },
  health: {
    src: 'assets/sprites/health.png',
    frames: [frame([93, 194, 1060, 932], 623, 1123)]
  },
  achievement: {
    src: 'assets/sprites/achievement.png',
    frames: [frame([75, 125, 2023, 472], 1086, 361)]
  }
};

// The final pointing frame supplies the actual barrel opening, shared by
// physics, aim indicators and rendering rather than independent magic offsets.
export function getRifleMuzzle(enemy) {
  const pose = WORLD_SPRITES.marine1Aim.frames[2];
  const scale = (enemy.height || 124) / WORLD_REFERENCE.marineHeight * pose.scale;
  return {x: enemy.x + (enemy.facing === -1 ? -1 : 1) * (pose.muzzle[0] - pose.pivot[0]) * scale,
    y: enemy.y + (pose.muzzle[1] - pose.pivot[1]) * scale};
}
