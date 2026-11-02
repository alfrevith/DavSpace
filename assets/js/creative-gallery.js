((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else factory().init(root,root.document,root.CreativeCore);})(globalThis,()=>{
  async function init(win,doc,core) {
    const kind=doc.body.dataset.world;
    if(!['photography','drawings'].includes(kind))return;
    const base=new URL('../../',doc.querySelector('script[src$="creative-gallery.js"]').src),$=s=>doc.querySelector(s);
    const status=$('[data-status]'),dialog=$('#art-viewer'),stage=$('.art-stage'),paper=$('[data-art-paper]');
    let items=[],selected=0,mode=kind==='photography'&&doc.body.dataset.galleryStart==='sheet'?'sheet':'strip',image=null,zoomed=false,loadRevision=0;
    const count=n=>String(n).padStart(2,'0');
    const close=()=>{if(kind==='photography'&&win.PhotographyRoom?.requestClose)win.PhotographyRoom.requestClose(()=>dialog.close());else dialog.close();};
    const openDialog=core.bindDialog(win,dialog,close,()=>{loadRevision++;image?.removeAttribute('src');image=null;paper.replaceChildren();});
    function preview(entry,container) {
      container.replaceChildren();
      if(entry.preview){const thumb=doc.createElement('img');thumb.src=entry.preview;thumb.alt=entry.title;thumb.loading='lazy';thumb.decoding='async';thumb.width=entry.previewWidth||entry.width||900;thumb.height=entry.previewHeight||entry.height||650;
        thumb.addEventListener('error',()=>{const note=doc.createElement('span');note.className='preview-missing';note.textContent='Preview unavailable · Open original ↗';container.replaceChildren(note);},{once:true});container.append(thumb);
      }else{const label=doc.createElement('span');label.className='preview-missing';label.textContent=entry.title+' · Open original ↗';container.append(label);}
    }
    function selection(delta=0) {
      if(!items.length)return;
      const frame=$('.art-frame');
      selected=core.step(selected,delta,items.length);const entry=items[selected];
      preview(entry,$('[data-selected-image]'));
      $('[data-frame-number]').textContent=`${kind==='photography'?'PHOTO':'PAGE'} ${count(selected+1)}`;
      $('[data-item-number]').textContent=`${count(selected+1)} / ${count(items.length)} · ${kind==='photography'?'A MOMENT OBSERVED':'A LINE IMAGINED'}`;
      $('[data-position]').textContent=`${count(selected+1)} / ${count(items.length)}`;
      $('[data-item-title]').textContent=entry.title;
      $('[data-item-description]').textContent=entry.description||'';
      $('[data-item-details]').textContent=[entry.date,entry.location,entry.camera].filter(Boolean).join(' · ');
      $('[data-prev]').disabled=items.length<2;$('[data-next]').disabled=items.length<2;
      doc.querySelectorAll('[data-sheet-index]').forEach(button=>{button.setAttribute('aria-pressed',String(Number(button.dataset.sheetIndex)===selected));});
      if(delta&&!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
        if(kind==='drawings'&&win.SketchbookMotion?.turnPage)win.SketchbookMotion.turnPage(delta);
        else if(kind==='photography'&&win.PhotographyRoom?.advance)win.PhotographyRoom.advance(delta);
        else frame.animate?.(kind==='drawings'?[{transform:'perspective(1000px) rotateY(-5deg)',opacity:.5},{transform:'none',opacity:1}]:[{transform:`translateX(${delta>0?12:-12}px)`,opacity:.4},{transform:'none',opacity:1}],{duration:320,easing:'ease-out'});
      }
    }
    function setMode(next) {
      mode=next==='sheet'?'sheet':'strip';
      $('[data-strip]').hidden=!items.length||mode!=='strip';$('[data-pagination]').hidden=!items.length||mode!=='strip';$('[data-sheet]').hidden=!items.length||mode!=='sheet';
      doc.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
    }
    function showImage(delta=0) {
      selected=core.step(selected,delta,items.length);selection();
      const entry=items[selected],revision=++loadRevision;
      if(kind==='photography')win.PhotographyRoom?.imageChanging?.(entry,delta);
      image?.removeAttribute('src');paper.replaceChildren();zoomed=false;stage.classList.remove('is-zoomed');$('[data-art-zoom]').setAttribute('aria-pressed','false');
      $('#art-title').textContent=entry.title;$('[data-art-caption]').textContent=[entry.description,entry.date,entry.location,entry.camera].filter(Boolean).join(' · ');
      $('[data-art-position]').textContent=`${selected+1} / ${items.length}`;
      $('[data-art-original]').href=entry.url;
      $('[data-art-prev]').disabled=items.length<2;$('[data-art-next]').disabled=items.length<2;
      const label=$('[data-art-status]');label.hidden=false;label.textContent='Loading original image…';stage.setAttribute('aria-busy','true');
      image=doc.createElement('img');image.alt=entry.title;image.decoding='async';const current=image;
      image.addEventListener('load',()=>{if(revision!==loadRevision||!dialog.open)return;paper.replaceChildren(current);label.hidden=true;stage.removeAttribute('aria-busy');},{once:true});
      image.addEventListener('error',()=>{if(revision!==loadRevision||!dialog.open)return;label.textContent='This image could not load. Try the Original link below.';stage.removeAttribute('aria-busy');},{once:true});
      image.src=entry.url;
    }
    function open(opener){if(!items.length)return;if(kind==='photography')win.PhotographyRoom?.beforeOpen?.(opener,items[selected]);openDialog(opener);showImage();if(kind==='photography')win.PhotographyRoom?.opened?.();}
    $('[data-open]').addEventListener('click',event=>open(event.currentTarget));
    $('[data-inspect]').addEventListener('click',event=>open(event.currentTarget));
    doc.querySelectorAll('[data-feature-index]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.featureIndex);if(Number.isInteger(index)&&items[index]){selected=index;open(button);}}));
    $('[data-prev]').addEventListener('click',()=>selection(-1));$('[data-next]').addEventListener('click',()=>selection(1));
    $('[data-art-prev]').addEventListener('click',()=>showImage(-1));$('[data-art-next]').addEventListener('click',()=>showImage(1));
    $('[data-art-zoom]').addEventListener('click',()=>{zoomed=!zoomed;stage.classList.toggle('is-zoomed',zoomed);$('[data-art-zoom]').setAttribute('aria-pressed',String(zoomed));});
    doc.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
    doc.addEventListener('keydown',event=>{
      if(!items.length||event.altKey||event.ctrlKey||event.metaKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
      // Keep arrow keys available to tab controls and unrelated page links.
      if(!dialog.open&&!event.target.closest('.art-collection'))return;
      if(dialog.open&&zoomed)return;
      event.preventDefault();const delta=event.key==='ArrowRight'?1:-1;if(dialog.open)showImage(delta);else selection(delta);
    });
    core.swipe($('[data-strip]'),delta=>selection(delta));core.swipe(stage,delta=>{if(!zoomed&&dialog.open)showImage(delta);});
    try{
      items=await core.load(win,base,kind);status.hidden=true;$('[data-count]').textContent=`${count(items.length)} ${kind==='photography'?'PHOTOS':'PAGES'}`;$('[data-empty]').hidden=!!items.length;
      if(items.length){
        const fragment=doc.createDocumentFragment();
        items.forEach((entry,index)=>{const button=doc.createElement('button');button.type='button';button.className='contact-frame';button.dataset.sheetIndex=index;button.setAttribute('aria-label',`Open ${entry.title}`);const art=doc.createElement('span');art.className='contact-image';preview(entry,art);const caption=doc.createElement('span');caption.className='contact-caption';caption.textContent=`${count(index+1)} / ${entry.title}`;button.append(art,caption);button.addEventListener('click',()=>{selected=index;open(button);});fragment.append(button);});
        $('[data-sheet]').replaceChildren(fragment);selection();
      }
      setMode(mode);
      if(kind==='photography')win.PhotographyRoom?.ready?.(items);
    }catch{status.textContent='The collection could not load. Please refresh to try again.';$('[data-count]').textContent='ARCHIVE UNAVAILABLE';}
    win.addEventListener('pagehide',()=>{if(dialog.open)dialog.close();});
    return {get selected(){return selected;},get mode(){return mode;}};
  }
  return {init};
});
