// GIF89a frames are decoded once, then selected by game time. This preserves
// transparency/disposal and allows pause/replay on browsers without ImageDecoder.
export function decodeGif(data) {
  const bytes = new Uint8Array(data); let p = 0;
  const byte = () => { if (p >= bytes.length) throw Error('Truncated GIF'); return bytes[p++]; };
  const word = () => byte() | byte() << 8;
  const text = n => Array.from({length:n}, byte).map(n=>String.fromCharCode(n)).join('');
  if (!/^GIF8[79]a$/.test(text(6))) throw Error('Invalid GIF');
  const width=word(),height=word(),flags=byte(),background=byte();byte();
  if (!width || !height || width*height>4194304) throw Error('GIF dimensions exceed budget');
  const palette = size => Array.from({length:size},()=>[byte(),byte(),byte()]);
  const global = flags&128 ? palette(2**((flags&7)+1)) : null;
  const blocks = () => { const parts=[];let size;while((size=byte())){if(p+size>bytes.length)throw Error('Truncated GIF block');parts.push(bytes.slice(p,p+size));p+=size;}const out=new Uint8Array(parts.reduce((s,b)=>s+b.length,0));let at=0;for(const part of parts){out.set(part,at);at+=part.length;}return out; };
  let pixels=new Uint8ClampedArray(width*height*4),control={},previous=null,duration=0;
  const frames=[];
  function clear(rect, transparent) {
    const color = !transparent && global?.[background];
    for(let y=rect.y;y<rect.y+rect.h;y++)for(let x=rect.x;x<rect.x+rect.w;x++){
      const at=(y*width+x)*4;pixels[at]=color?.[0]||0;pixels[at+1]=color?.[1]||0;pixels[at+2]=color?.[2]||0;pixels[at+3]=color?255:0;
    }
  }
  while(p<bytes.length){
    const block=byte();if(block===59)break;
    if(block===33){
      const label=byte();
      if(label===249){if(byte()!==4)throw Error('Invalid GIF control');const f=byte();control={dispose:f>>2&7,delay:Math.max(.01,word()/100),transparent:!!(f&1),index:byte()};if(byte()!==0)throw Error('Invalid GIF terminator');}
      else blocks();
      continue;
    }
    if(block!==44)throw Error('Unsupported GIF block');
    const rect={x:word(),y:word(),w:word(),h:word()},f=byte();
    if(!rect.w||!rect.h||rect.x+rect.w>width||rect.y+rect.h>height)throw Error('Invalid GIF frame');
    const colors=f&128?palette(2**((f&7)+1)):global;
    if(!colors)throw Error('Missing GIF palette');
    const minimum=byte(),compressed=blocks();
    if(minimum<2||minimum>8)throw Error('Invalid GIF LZW code size');
    if(previous?.dispose===2)clear(previous.rect,previous.transparent);
    if(previous?.dispose===3)pixels=previous.backup;
    if(!frames.length)clear({x:0,y:0,w:width,h:height},control.transparent);
    const backup=control.dispose===3?pixels.slice():null;
    const indices=decodeLzw(compressed,minimum,rect.w*rect.h);
    const rows=[];
    if(f&64){for(const [start,step]of[[0,8],[4,8],[2,4],[1,2]])for(let y=start;y<rect.h;y+=step)rows.push(y);}
    else for(let y=0;y<rect.h;y++)rows.push(y);
    let i=0;
    for(const row of rows)for(let x=0;x<rect.w;x++){
      const color=indices[i++];if(control.transparent&&color===control.index)continue;
      if(!colors[color])throw Error('Invalid GIF color');
      const at=((rect.y+row)*width+rect.x+x)*4;
      const rgb=colors[color];pixels[at]=rgb[0];pixels[at+1]=rgb[1];pixels[at+2]=rgb[2];pixels[at+3]=255;
    }
    const delay=control.delay||.1;
    frames.push({pixels:pixels.slice(),delay,start:duration});duration+=delay;
    if(frames.length*width*height>16777216)throw Error('GIF frames exceed budget');
    previous={...control,rect,backup};control={};
  }
  if(!frames.length)throw Error('Empty GIF');
  return {width,height,frames,duration};
}

function decodeLzw(bytes, minimum, length) {
  const prefix=new Uint16Array(4096),suffix=new Uint8Array(4096),stack=new Uint8Array(4097),out=new Uint8Array(length);
  const clear=1<<minimum,end=clear+1;let bits=0,size=minimum+1,next=end+1,old=-1,first=0,written=0;
  for(let i=0;i<clear;i++)suffix[i]=i;
  while(bits+size<=bytes.length*8){
    let code=0;for(let i=0;i<size;i++)code|=((bytes[(bits+i)>>3]>>((bits+i)&7))&1)<<i;bits+=size;
    if(code===clear){size=minimum+1;next=end+1;old=-1;continue;}if(code===end)break;
    const input=code;let top=0;
    if(code===next&&old>=0){stack[top++]=first;code=old;}else if(code>=next)throw Error('Invalid GIF LZW code');
    while(code>=clear){if(top>=4096)throw Error('Invalid GIF LZW chain');stack[top++]=suffix[code];code=prefix[code];}
    first=code;stack[top++]=first;
    while(top){if(written>=length)throw Error('Excess GIF pixels');out[written++]=stack[--top];}
    if(old>=0&&next<4096){prefix[next]=old;suffix[next++]=first;if(next===(1<<size)&&size<12)size++;}
    old=input;
  }
  if(written!==length)throw Error('Missing GIF pixels');return out;
}

export async function loadGif(url, document=globalThis.document) {
  const response=await fetch(url);if(!response.ok)throw Error('GIF unavailable');
  const gif=decodeGif(await response.arrayBuffer());
  const frames=[];
  for(const frame of gif.frames){
    const canvas=document.createElement('canvas');canvas.width=gif.width;canvas.height=gif.height;
    const ctx=canvas.getContext('2d');const image=ctx.createImageData(gif.width,gif.height);image.data.set(frame.pixels);ctx.putImageData(image,0,0);
    frames.push({image:canvas,delay:frame.delay,start:frame.start});
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {...gif,frames};
}

export function gifFrameAt(gif, seconds) {
  const time=Math.max(0,seconds)%gif.duration;
  return gif.frames.findLast(frame=>frame.start<=time)||gif.frames[0];
}
