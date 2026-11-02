import test from 'node:test';
import assert from 'node:assert/strict';
import emulsion from '../assets/js/photography-emulsion.js';

test('the latent image reveals actual highlights before shadows without changing source colors', () => {
  const w=40,h=30,pixels=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;pixels[p]=pixels[p+1]=pixels[p+2]=x<w/2?255:0;pixels[p+3]=255;}
  const original=pixels.slice(),result=emulsion.analyze(pixels,w,h);
  assert.deepEqual(pixels,original);
  let light=0,dark=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){assert(result.field[y*w+x]>=0&&result.field[y*w+x]<=1);if(x<w/2)light+=result.field[y*w+x];else dark+=result.field[y*w+x];}
  assert(light<dark*.5);assert.deepEqual(result.color,[255,255,255]);
});
test('development is monotonic, starts transparent, ends opaque, and modifies only alpha', () => {
  const field=new Float32Array([0,.1,.3,.6,1]),pixels=new Uint8ClampedArray(20).fill(255);
  let previous=new Uint8ClampedArray(5);
  for(const p of [0,.1,.35,.7,1]){
    emulsion.paintAlpha(field,p,pixels);
    for(let i=0;i<5;i++){assert(pixels[i*4+3]>=previous[i]);assert.equal(pixels[i*4],255);assert.equal(pixels[i*4+1],255);assert.equal(pixels[i*4+2],255);previous[i]=pixels[i*4+3];if(p===0)assert.equal(previous[i],0);if(p===1)assert.equal(previous[i],255);}
  }
});
test('shared image transitions contain portrait and landscape frames without changing aspect ratio', () => {
  const box={left:20,top:30,width:600,height:400};
  assert.deepEqual(emulsion.fitRect(300,600,box),{left:220,top:30,width:200,height:400});
  assert.deepEqual(emulsion.fitRect(1200,600,box),{left:20,top:80,width:600,height:300});
  assert.equal(emulsion.analyze([],0,0),null);
});
