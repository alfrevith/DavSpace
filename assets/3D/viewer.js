const model = document.querySelector('model-viewer');
const status = document.querySelector('#status');
const reset = document.querySelector('#reset');
let loaded = false;
const fail = () => { status.hidden=false; status.textContent='The 3D model could not load. Hide it and try again.'; };
model.addEventListener('load', () => { loaded=true; status.hidden=true; reset.disabled=false; });
model.addEventListener('error', fail);
reset.addEventListener('click', () => {
  model.cameraOrbit='45deg 70deg auto';
  model.cameraTarget='auto auto auto';
  model.fieldOfView='auto';
  model.jumpCameraToGoal();
});
// Keep focus trapped in the parent project dialog, including inside this frame.
document.addEventListener('keydown', event => {
  if(event.key==='Escape') { event.preventDefault(); parent.postMessage({type:'pot-c-model-close'},location.origin); }
  if(event.key==='Tab' && (event.shiftKey && document.activeElement===model || !event.shiftKey && document.activeElement===reset)) {
    event.preventDefault(); parent.postMessage({type:'pot-c-model-focus-toggle'},location.origin);
  }
});
try {
  await import('../model-viewer/model-viewer.min.js');
  // This viewer uses uncompressed, self-contained GLB data: no decoder CDN.
  customElements.get('model-viewer').modelCacheSize=0;
} catch { fail(); }
setTimeout(() => { if(!loaded)fail(); },90000);
