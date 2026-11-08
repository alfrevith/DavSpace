// Duration is the complete supplied MP3; the controller uses the decoded
// buffer duration when available, including on devices with another sample rate.
import { gifFrameAt } from './character-gif.js';
export const HAKI_TUNING=Object.freeze({unlockAt:60,cooldown:60,suppression:6,fadeStart:4,visualDuration:8,duration:14.6808125});
const clamp=n=>Math.max(0,Math.min(1,n));
export const hakiSuppresses = effect => !!effect && effect.age < Math.min(HAKI_TUNING.suppression,effect.duration);
export function hakiEnvelope(effect) {
  if(!effect||effect.age<0)return 0;
  const end=Math.min(HAKI_TUNING.visualDuration,effect.duration),start=Math.min(HAKI_TUNING.fadeStart,end*.5);
  if(effect.age>=end)return 0;
  const fade=clamp((end-effect.age)/(end-start));
  return Math.min(clamp(effect.age/.25),fade*fade*(3-2*fade));
}
export function drawHakiBack(ctx, effect, width, height, reduced=false, actor=null) {
  const strength=hakiEnvelope(effect);if(!strength)return;
  const origin=actor?{x:actor.x,y:actor.y-72}:effect;
  ctx.save();
  if(!reduced){
    const wave=(effect.age%2.8)/1.25;
    const far=Math.hypot(Math.max(origin.x,width-origin.x),Math.max(origin.y,height-origin.y));
    if(wave<1){
      const radius=far*Math.pow(wave,.8),thickness=10+wave*18;
      ctx.fillStyle=`rgba(245, 35, 72, ${strength*(1-wave)*.55})`;
      // Four-pixel scan lines make a stepped annulus rather than a smooth SVG.
      for(let y=0;y<height;y+=4){
        const dy=y+2-origin.y;if(Math.abs(dy)>radius)continue;
        const outer=Math.sqrt(radius*radius-dy*dy),inner=Math.sqrt(Math.max(0,Math.max(0,radius-thickness)**2-dy*dy));
        const l=Math.floor((origin.x-outer)/4)*4,r=Math.ceil((origin.x+outer)/4)*4;
        const il=Math.floor((origin.x-inner)/4)*4,ir=Math.ceil((origin.x+inner)/4)*4;
        ctx.fillRect(l,y,Math.max(4,il-l),4);ctx.fillRect(ir,y,Math.max(4,r-ir),4);
      }
    }
  }
  ctx.restore();
}
export function drawHakiFront(ctx,effect,gif,actor,reduced=false,width=960,height=440) {
  const strength=hakiEnvelope(effect);if(!strength)return;
  ctx.save();ctx.fillStyle=`rgba(122, 6, 34, ${strength*.29})`;ctx.fillRect(0,0,width,height);ctx.restore();
  if(!gif)return;
  const time=reduced?gif.duration*.36:effect.age%gif.duration;
  const frame=gifFrameAt(gif,time);
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=strength*.85;
  const size=256;ctx.drawImage(frame.image,Math.round(actor.x-size/2),Math.round(actor.y-72-size/2),size,size);
  ctx.restore();
}
