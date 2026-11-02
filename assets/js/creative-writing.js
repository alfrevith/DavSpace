((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else factory().init(root,root.document,root.CreativeCore);})(globalThis,()=>{
  async function init(win,doc,core) {
    if(doc.body.dataset.world!=='writing')return;
    const base=new URL('../../',doc.querySelector('script[src$="creative-writing.js"]').src),$=s=>doc.querySelector(s),dialog=$('#literary-reader'),library=$('[data-library]');
    let works=[],category='poetry',reader=null,storage;
    try{storage=win.localStorage;}catch{/* Private storage is optional. */}
    const close=()=>dialog.close();
    const openDialog=core.bindDialog(win,dialog,close,()=>{reader?.destroy();reader=null;if(doc.fullscreenElement===dialog)doc.exitFullscreen?.().catch(()=>{});win.BurningManuscript?.closed?.();});
    function open(entry,opener) {
      $('#reader-title').textContent=entry.title;
      $('[data-download]').href=entry.url;$('[data-download]').setAttribute('download',decodeURIComponent(new URL(entry.url).pathname.split('/').pop()));$('[data-original]').href=entry.url;
      const page=core.storedPage(storage,entry.id);
      $('[data-resume-note]').textContent=page>1?`Resuming at page ${page}.`:'';
      win.BurningManuscript?.beforeOpen?.();openDialog(opener);
      reader?.destroy();
      reader=win.ProjectPDFViewer.create({mount:$('[data-pdf-mount]'),url:new URL(entry.url),title:entry.title,dialog,initialPage:page,onPageChange:(number)=>core.storedPage(storage,entry.id,number)});
      win.BurningManuscript?.opened?.();
    }
    function collection(next,{focus=false}={}) {
      category=next==='story'?'story':'poetry';
      doc.querySelectorAll('[data-collection]').forEach(tab=>{const active=tab.dataset.collection===category;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();});
      $('#literary-collection').setAttribute('aria-labelledby','tab-'+category);
      const entries=works.filter(work=>work.type===category);$('[data-count]').textContent=`${String(entries.length).padStart(2,'0')} ${category==='poetry'?'POEMS':'STORIES'}`;
      $('[data-empty]').hidden=entries.length>0;$('[data-empty-title]').textContent=category==='poetry'?'Room for a poem.':'A story has room to grow.';$('[data-empty-copy]').textContent=category==='poetry'?'Poems will find their home here.':'The first stories will find their place on this shelf.';
      library.replaceChildren();
      entries.forEach(entry=>{
        const button=doc.createElement('button');button.type='button';button.className='literary-book';
        button.dataset.workId=entry.id;button.dataset.workKind=entry.type;
        const cover=doc.createElement('span');cover.className='book-cover';
        const type=doc.createElement('span');type.className='book-category';type.textContent=category==='poetry'?'POETRY / A MANUSCRIPT':'STORIES / A WORLD OF WORDS';
        const title=doc.createElement('span');title.className='book-title';title.textContent=entry.title;
        if(entry.preview){const image=doc.createElement('img');image.src=entry.preview;image.alt='';image.loading='lazy';image.decoding='async';image.width=400;image.height=550;image.addEventListener('error',()=>image.remove(),{once:true});cover.append(image);}
        cover.append(type,title);const author=doc.createElement('span');author.className='book-author';author.textContent=entry.author||'';cover.append(author);
        if(Number.isInteger(entry.pages)&&entry.pages>0){const pages=doc.createElement('span');pages.className='book-page-count';pages.textContent=`${entry.pages} ${entry.pages===1?'PAGE':'PAGES'}`;cover.append(pages);}
        const details=doc.createElement('span');details.className='book-details';details.textContent=[entry.description,entry.date].filter(Boolean).join(' · ');
        const action=doc.createElement('span');action.className='book-action';const page=core.storedPage(storage,entry.id);action.textContent=page>1?`Continue reading · page ${page} ↗`:'Open manuscript ↗';
        button.append(cover,details,action);button.addEventListener('click',()=>open(entry,button));library.append(button);
      });
      win.BurningManuscript?.collection?.(library,category);
    }
    doc.querySelectorAll('[data-collection]').forEach(tab=>{tab.addEventListener('click',()=>collection(tab.dataset.collection));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();collection(event.key==='Home'?'poetry':event.key==='End'?'story':category==='poetry'?'story':'poetry',{focus:true});});});
    const fullscreen=$('[data-fullscreen]');
    fullscreen.hidden=!dialog.requestFullscreen;
    fullscreen.addEventListener('click',async()=>{try{if(doc.fullscreenElement===dialog)await doc.exitFullscreen();else await dialog.requestFullscreen();}catch{dialog.classList.toggle('is-document-focused');}});
    doc.addEventListener('fullscreenchange',()=>{fullscreen.textContent=doc.fullscreenElement===dialog?'Exit fullscreen':'Fullscreen';});
    dialog.addEventListener('keydown',event=>{if(event.defaultPrevented||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();reader?.goTo(reader.page+(event.key==='ArrowRight'?1:-1));}});
    try{works=await core.load(win,base,'writing');$('[data-status]').hidden=true;collection(category);}catch{$('[data-status]').textContent='The library could not load. Please refresh to try again.';}
    win.addEventListener('pagehide',()=>{if(dialog.open)close();});
    return {get category(){return category;}};
  }
  return {init};
});
