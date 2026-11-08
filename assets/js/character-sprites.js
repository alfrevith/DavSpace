// Original artwork is sampled directly; these uneven sheets are not tile grids.
// Rectangles include a small transparent gutter. Pivots are relative to each rect.
// A uniform per-frame scale matches the hat across differently sized source art.
export const SPRITE_REFERENCE = Object.freeze({ height: 675, pelvisToFloor: 227 });

const HAT_WIDTH = 405;
const round = value => Math.round(value * 10000) / 10000;

function grounded(rect, centerX, floorY, hatWidth) {
  const scale = HAT_WIDTH / hatWidth;
  return {
    rect,
    // This virtual pelvis anchors the soles to the same floor without stretching
    // the model. Leaning, breathing and the running stride remain in the artwork.
    pivot: [round(centerX - rect[0]), round(floorY - rect[1] - SPRITE_REFERENCE.pelvisToFloor / scale)],
    scale: round(scale)
  };
}

function airborne(rect, pelvis, hatWidth, calibratedScale) {
  return {
    rect,
    // In the air, the actual belt/hip is the anchor: curled legs must not pull
    // the whole body down or produce a second jump inside the animation.
    pivot: [pelvis[0] - rect[0], pelvis[1] - rect[1]],
    scale: round(calibratedScale ?? HAT_WIDTH / hatWidth)
  };
}

export const SPRITES = {
  base: {
    src: "assets/sprites/base.png",
    frames: [grounded([236, 59, 782, 1162], 653, 1218, 731)]
  },
  waiting: {
    src: "assets/sprites/waiting.png",
    frames: [
      grounded([153, 16, 439, 677], 389.5, 690, 405),
      grounded([857, 29, 442, 661], 1087.5, 687, 407),
      grounded([1568, 13, 441, 681], 1804, 691, 407)
    ]
  },
  running: {
    src: "assets/sprites/running.png",
    frames: [
      grounded([249, 22, 467, 691], 455, 710, 427),
      grounded([810, 15, 521, 671], 1067, 683, 439),
      grounded([1448, 26, 470, 688], 1663, 711, 430)
    ]
  },
  jumping: {
    src: "assets/sprites/Jumping.png",
    frames: [
      airborne([65, 220, 347, 471], [224, 553.5], 310),
      airborne([463, 206, 364, 480], [638, 538], 301),
      // The source has an isolated black mark at y532..584, below the flying
      // character (which ends at y512). Exclude the mark without editing art.
      airborne([875, 38, 338, 478], [1041, 351.5], 302),
      airborne([1296, 89, 353, 500], [1462, 409], 304),
      grounded([1708, 227, 390, 464], 1904, 688, 311)
    ]
  },
  baseAttack: {
    src: "assets/sprites/base-attack.png",
    frames: [
      grounded([36, 52, 413, 632], 256, 681, 379),
      // Keep the planted front sandal fixed through charge and extension. The
      // belt itself leans left in frame 1 and would make the whole model jump.
      grounded([537, 52, 413, 632], 745, 681, 379),
      grounded([1016, 55, 439, 629], 1224, 681, 395),
      {
        ...grounded([1535, 52, 592, 632], 1762, 681, 392),
        armStretch: { zone: [400, 280, 192, 112], sample: [400, 298, 8, 64] }
      }
    ]
  },
  jumpAttack: {
    src: "assets/sprites/jump-attack.png",
    frames: [
      // The first hat tilts toward the camera; width alone would enlarge the
      // torso by another ten percent. This visual calibration stays uniform.
      airborne([72, 101, 345, 550], [263, 450], 286, 1.3),
      airborne([569, 96, 360, 587], [765, 420], 299),
      airborne([1071, 100, 464, 605], [1251, 420], 283),
      {
        ...grounded([1655, 167, 436, 545], 1845, 708, 324),
        legStretch: { anchor: [214, 421], bandWidth: 120, bandHeight: 12, tip: [310, 541] },
        // During descent, mask the baked-in side dust while keeping the leg
        // and sandal. At impact the renderer can show the complete original.
        airClip: [[0, 0], [436, 0], [436, 355], [325, 355], [280, 400],
          [260, 450], [295, 490], [310, 515], [310, 541], [155, 541],
          [155, 515], [165, 475], [140, 420], [115, 355], [0, 355]]
      }
    ]
  },
  inactivity: {
    src: "assets/sprites/inactivity.png",
    frames: [
      grounded([40, 83, 371, 575], 245.5, 655, 336),
      grounded([452, 79, 374, 578], 668.5, 654, 336),
      grounded([862, 81, 400, 576], 1096.5, 654, 346),
      grounded([1308, 80, 374, 578], 1507, 655, 340),
      grounded([1740, 81, 377, 577], 1943.5, 655, 342)
    ]
  }
};
