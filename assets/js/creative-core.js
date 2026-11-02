((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else root.CreativeCore=factory();})(globalThis,()=>{
  // Paths are relative to the site's base, including a GitHub Pages project path.
  function asset(path,base,extension) {
    if(typeof path!=='string'||!path||/^(?:[a-z]+:|\/|\\)/i.test(path))return null;
    try{const url=new URL(path,base);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||!extension.test(url.pathname))return null;return url;}catch{return null;}
  }
  const imagePath=/\.(?:avif|webp|png|jpe?g)$/i,pdfPath=/\.pdf$/i;
  function records(data,kind,base) {
    const seen=new Set();
    return (Array.isArray(data?.[kind==='writing'?'works':'images'])?data[kind==='writing'?'works':'images']:[]).flatMap((entry,index)=>{
      if(!entry||!/^[\w-]{1,100}$/.test(entry.id||'')||seen.has(entry.id)||typeof entry.title!=='string'||!entry.title.trim())return [];
      const url=asset(kind==='writing'?entry.pdf:entry.image,base,kind==='writing'?pdfPath:imagePath);
      if(!url||kind==='writing'&&!['poetry','story'].includes(entry.type))return [];
      seen.add(entry.id);
      const thumb=asset(kind==='writing'?entry.cover:entry.thumbnail,base,imagePath);
      return [{...entry,title:entry.title.trim(),url:url.href,preview:thumb?.href||null,order:Number.isFinite(entry.order)?entry.order:index}];
    }).sort((a,b)=>a.order-b.order);
  }
  async function load(win,base,kind) {
    const response=await win.fetch(new URL(`data/${kind}.json`,base));
    if(!response.ok)throw Error('Collection unavailable');
    return records(await response.json(),kind,base);
  }
  function storedPage(storage,id,value) {try{const key='davspace:reading:'+id;if(value!==undefined)storage?.setItem(key,String(value));return Math.max(1,Math.trunc(Number(storage?.getItem(key)))||1);}catch{return 1;}}
  function step(index,delta,length){return length?((index+delta)%length+length)%length:0;}
  function swipe(surface,callback) {
    let start=null;
    surface.addEventListener('touchstart',e=>{start=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
    surface.addEventListener('touchend',e=>{if(!start||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;start=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)callback(dx<0?1:-1);},{passive:true});
    surface.addEventListener('touchcancel',()=>{start=null;},{passive:true});
  }
  function bindDialog(win,dialog,close,onClose) {
    let opener,scrollTop=0;
    dialog.querySelector('[data-close]').addEventListener('click',close);
    dialog.addEventListener('close',()=>{win.document.documentElement.classList.remove('creative-dialog-open');onClose();if(opener?.isConnected)opener.focus({preventScroll:true});win.scrollTo?.(0,scrollTop);});
    let outsideDown=false;
    const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
    dialog.addEventListener('pointerdown',e=>{outsideDown=e.target===dialog&&outside(e);});
    dialog.addEventListener('click',e=>{if(outsideDown&&e.target===dialog&&outside(e))close();outsideDown=false;});
    return element=>{opener=element;scrollTop=win.scrollY||0;dialog.showModal();win.document.documentElement.classList.add('creative-dialog-open');dialog.querySelector('[data-close]').focus({preventScroll:true});};
  }
  return {asset,imagePath,pdfPath,records,load,storedPage,step,swipe,bindDialog};
});
