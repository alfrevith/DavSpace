/* Illustrated, tapered flame ribbons. Curved silhouettes and luminous cores
   stay crisp in CSS-pixel space, with transparent headroom on every side. */
((root, factory) => { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ManuscriptFire = factory(); })(globalThis, () => {
  const seeds = [
    [.25, .022, .31, 1.1], [.46, .026, .43, 2.7], [.65, .037, .60, .4],
    [.76, .045, .74, 1.8], [.83, .027, .51, 4.1], [.90, .018, .33, 5.3]
  ];
  function frame(width, height, time, strength = 0) {
    if (!(width > 0 && height > 0) || !Number.isFinite(time)) return [];
    const heat = Math.max(0, Math.min(1, strength));
    return seeds.map(([position, spread, length, phase]) => {
      const breath = .87 + .08 * Math.sin(time * 2.3 + phase) + .05 * Math.sin(time * 4.1 + phase * 2);
      const radius = width * spread * (.85 + heat * .34);
      return { x: width * (position + Math.sin(time * 1.4 + phase) * .009), base: height * .94,
        width: radius, height: height * Math.min(.84, length * (breath + heat * .3)),
        bend: width * .016 * Math.sin(time * 2.1 + phase),
        tip: width * .022 * Math.sin(time * 2.8 + phase * 1.7), alpha: .72 + heat * .2 };
    });
  }
  function ribbon(context, flame, core = false) {
    const w = flame.width * (core ? .46 : 1), h = flame.height * (core ? .74 : 1);
    const bend = flame.bend * (core ? .7 : 1), tip = flame.tip * (core ? .7 : 1);
    context.save(); context.translate(flame.x, flame.base);
    const color = context.createLinearGradient(0, -h, 0, 0);
    if (core) {
      color.addColorStop(0, '#ffc56b00'); color.addColorStop(.32, '#ffca7b80');
      color.addColorStop(.7, '#ffe5aceb'); color.addColorStop(.93, '#fff3c9f0'); color.addColorStop(1, '#fff0b900');
    } else {
      color.addColorStop(0, '#d84f2000'); color.addColorStop(.16, '#d85c252e');
      color.addColorStop(.5, '#ef792775'); color.addColorStop(.85, '#ffb549bd'); color.addColorStop(1, '#ffc56800');
    }
    context.globalAlpha = flame.alpha; context.fillStyle = color;
    context.beginPath(); context.moveTo(-w * .75, 0);
    context.bezierCurveTo(-w * 1.25, -h * .16, -bend * .2 - w * .28, -h * .38, bend - w * .24, -h * .53);
    context.bezierCurveTo(bend + w * .12, -h * .72, tip - w * .12, -h * .9, tip, -h);
    context.bezierCurveTo(tip + w * .3, -h * .74, bend + w * .9, -h * .58, bend + w * .65, -h * .4);
    context.bezierCurveTo(w * 1.3, -h * .18, w * .9, -h * .03, w * .65, 0);
    context.closePath(); context.fill(); context.restore();
  }
  function paint(context, width, height, time, strength = 0) {
    context.clearRect(0, 0, width, height);
    context.save(); context.globalCompositeOperation = 'screen';
    context.translate(width * .73, height * .9); context.scale(1, .22);
    const glow = context.createRadialGradient(0, 0, 0, 0, 0, width * .29);
    glow.addColorStop(0, 'rgba(255,174,65,' + (.24 + strength * .15) + ')');
    glow.addColorStop(.4, '#dc731f18'); glow.addColorStop(1, '#dc731f00');
    context.fillStyle = glow; context.fillRect(-width * .3, -width * .3, width * .6, width * .6); context.restore();
    context.save(); context.globalCompositeOperation = 'screen';
    for (const flame of frame(width, height, time, strength)) { ribbon(context, flame); ribbon(context, flame, true); }
    context.restore();
  }
  return { frame, paint };
});
