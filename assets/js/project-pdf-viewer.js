(() => {
  const assets = new URL("../pdfjs/", document.currentScript.src);
  let library;
  const loadLibrary = () => library ||= import(new URL("pdf.min.mjs", assets).href).then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", assets).href;
    return pdfjs;
  }).catch(error => { library = null; throw error; });

  function createImageReader({mount,url,title,dialog,detailsSelector}) {
    const root=document.createElement('div');root.className='project-reader';
    root.innerHTML=`<div class="project-reader-toolbar" aria-label="Image controls"><div class="project-reader-controls"><button type="button" data-image-out aria-label="Zoom out">−</button><button type="button" data-image-fit aria-label="Fit image width">Fit</button><button type="button" data-image-in aria-label="Zoom in">+</button><button type="button" data-image-expand aria-label="Expand document" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg></button></div><a class="project-pdf-link project-reader-open" target="_blank" rel="noopener noreferrer">Open image ↗</a></div><div class="project-reader-viewport" tabindex="0" role="region" aria-label="Original recognition image"><div class="project-reader-paper"></div><div class="project-reader-message" role="status">Loading image…<progress class="project-reader-progress" aria-label="Image loading"></progress></div></div>`;
    mount.replaceChildren(root);
    const $=s=>root.querySelector(s),viewport=$('.project-reader-viewport'),paper=$('.project-reader-paper'),message=$('.project-reader-message');
    $('.project-reader-open').href=url.href;
    let alive=true,ready=false,zoom=1,resizeTimer,lastWidth=0;
    const image=document.createElement('img');image.alt=title+' — original document';image.decoding='async';image.style.maxWidth='none';image.style.height='auto';
    const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>{b.disabled=true;});viewport.setAttribute('aria-busy','true');
    function fit(){if(!alive||!ready)return;const width=Math.max(100,viewport.clientWidth-12);image.style.width=Math.round(Math.min(image.naturalWidth,width)*zoom)+'px';$('[data-image-out]').disabled=zoom<=.5;$('[data-image-in]').disabled=zoom>=3;}
    image.addEventListener('load',()=>{if(!alive)return;ready=true;paper.replaceChildren(image);message.hidden=true;viewport.removeAttribute('aria-busy');buttons.forEach(b=>{b.disabled=false;});fit();},{once:true});
    image.addEventListener('error',()=>{if(!alive)return;message.textContent='The image could not load. Open the original image above to try again.';viewport.removeAttribute('aria-busy');},{once:true});
    $('[data-image-in]').addEventListener('click',()=>{zoom=Math.min(3,zoom+.25);fit();});
    $('[data-image-out]').addEventListener('click',()=>{zoom=Math.max(.5,zoom-.25);fit();});
    $('[data-image-fit]').addEventListener('click',()=>{zoom=1;viewport.scrollLeft=0;viewport.scrollTop=0;fit();});
    $('[data-image-expand]').addEventListener('click',()=>{const expanded=!dialog.classList.contains('is-document-focused');dialog.classList.toggle('is-document-focused',expanded);const details=dialog.querySelector(detailsSelector);if(details)details.hidden=expanded;const workspace=dialog.querySelector('.project-workspace, .credential-workspace');if(workspace)workspace.scrollTop=0;$('[data-image-expand]').setAttribute('aria-pressed',String(expanded));$('[data-image-expand]').setAttribute('aria-label',expanded?'Restore record layout':'Expand document');resize();});
    function resize(){const width=viewport.clientWidth;if(width===lastWidth)return;lastWidth=width;clearTimeout(resizeTimer);resizeTimer=setTimeout(fit,100);}
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(viewport);window.addEventListener('resize',resize);
    image.src=url.href;
    return {destroy(){alive=false;clearTimeout(resizeTimer);observer?.disconnect();window.removeEventListener('resize',resize);image.removeAttribute('src');paper.replaceChildren();mount.replaceChildren();dialog.classList.remove('is-document-focused');const details=dialog.querySelector(detailsSelector);if(details)details.hidden=false;}};
  }
  window.ProjectPDFViewer = {
    create({mount, url, title, dialog, detailsSelector = ".project-details", initialPage = 1, onPageChange = () => {}}) {
      if(/\.(png|jpe?g|webp)$/i.test(url.pathname))return createImageReader({mount,url,title,dialog,detailsSelector});
      const root = document.createElement("div");
      root.className = "project-reader";
      root.innerHTML = `
        <div class="project-reader-toolbar" aria-label="PDF controls">
          <div class="project-reader-controls"><button type="button" data-reader-prev aria-label="Previous page" title="Previous page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><label class="project-reader-page"><span class="reader-sr-only">Page number</span><input data-reader-page type="number" min="1" value="1" aria-label="Page number" /><span>/ <span data-reader-total>—</span></span></label><button type="button" data-reader-next aria-label="Next page" title="Next page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button></div>
          <div class="project-reader-controls"><button type="button" data-reader-out aria-label="Zoom out" title="Zoom out">−</button><button type="button" data-reader-fit title="Fit page width" aria-label="Fit page width">Fit</button><button type="button" data-reader-in aria-label="Zoom in" title="Zoom in">+</button><span class="project-reader-divider"></span><button type="button" data-reader-expand title="Expand document" aria-label="Expand document" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg></button></div>
          <a class="project-pdf-link project-reader-open" target="_blank" rel="noopener noreferrer">Open PDF <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a>
        </div>
        <div class="project-reader-viewport" tabindex="0" role="region" aria-label="Interactive PDF pages"><div class="project-reader-paper" data-reader-paper></div><div class="project-reader-message" data-reader-message role="status"><span data-reader-loading-label>Preparing PDF reader…</span><progress class="project-reader-progress" data-reader-progress max="100" aria-label="PDF download progress"></progress></div></div>
        <div class="reader-sr-only" role="status"><span data-reader-position>Visual documentation</span><span data-reader-zoom>Fit to width</span></div>`;
      mount.replaceChildren(root);
      const $ = selector => root.querySelector(selector);
      $(".project-reader-open").href = url.href;
      $(".project-reader-open").setAttribute("aria-label", `Open ${title} PDF in a new tab`);
      const viewport = $(".project-reader-viewport"), paper = $("[data-reader-paper]"), pageInput = $("[data-reader-page]"), message = $("[data-reader-message]");
      let alive = true, loading, pdf, task, pageNumber = 1, zoom = null, renderedScale = 1, revision = 0, resizeTimer, lastWidth = 0;
      const controls = [...root.querySelectorAll("button, input")];
      viewport.setAttribute("aria-busy", "true");
      controls.forEach(control => { control.disabled = true; });
      function sync() {
        pageInput.value = pageNumber;
        $("[data-reader-prev]").disabled = !pdf || pageNumber <= 1;
        $("[data-reader-next]").disabled = !pdf || pageNumber >= pdf.numPages;
        $("[data-reader-out]").disabled = !pdf || zoom !== null && zoom <= .25;
        $("[data-reader-in]").disabled = !pdf || zoom !== null && zoom >= 3;
        $("[data-reader-position]").textContent = pdf ? `Page ${pageNumber} of ${pdf.numPages}` : "Visual documentation";
      }
      function fail(text = "This document couldn't be displayed here.") {
        if (!alive) return;
        viewport.removeAttribute("aria-busy");
        message.hidden = false;message.replaceChildren();
        const p = document.createElement("span");p.textContent = text;
        const a = document.createElement("a");a.href = url.href;a.target = "_blank";a.rel = "noopener noreferrer";a.textContent = "Open full PDF ↗";
        message.append(p,a);
      }
      async function render() {
        if (!pdf || !alive) return;
        const current = ++revision;
        task?.cancel();
        viewport.setAttribute("aria-busy", "true");
        try {
          const page = await pdf.getPage(pageNumber);
          if (!alive || current !== revision) return;
          const natural = page.getViewport({scale:1});
          const fit = Math.max(.15, (viewport.clientWidth - 12) / natural.width);
          const scale = zoom === null ? fit : zoom;
          const size = page.getViewport({scale});
          const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8000000 / (size.width * size.height)));
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(size.width * density);canvas.height = Math.floor(size.height * density);
          canvas.style.width = `${size.width}px`;canvas.style.height = `${size.height}px`;
          canvas.setAttribute("role", "img");canvas.setAttribute("aria-label", `${title}, PDF page ${pageNumber}. Open the full PDF reader for text and more options.`);
          task = page.render({canvasContext:canvas.getContext("2d",{alpha:false}),background:"#ffffff",viewport:size,transform:density===1?null:[density,0,0,density,0,0]});
          await task.promise;
          if (!alive || current !== revision) return;
          paper.querySelectorAll('canvas').forEach(old=>{old.width=0;old.height=0;});
          paper.replaceChildren(canvas);message.hidden = true;
          onPageChange(pageNumber, pdf.numPages);
          renderedScale = scale;
          $("[data-reader-zoom]").textContent = `${Math.round(scale * 100)}%${zoom === null ? " · Fit width" : ""}`;
          $("[data-reader-fit]").setAttribute("aria-pressed", String(zoom === null));
          $("[data-reader-fit]").title = `Fit page width · ${Math.round(scale * 100)}%`;
          viewport.removeAttribute("aria-busy");
          sync();
        } catch (error) {
          if (current !== revision || !alive || error.name === "RenderingCancelledException") return;
          viewport.removeAttribute("aria-busy");fail();
        }
      }
      function navigate(value) {
        if (!pdf) return;
        const next = Math.max(1,Math.min(pdf.numPages,Number(value)));
        if (!Number.isInteger(next)) {sync();return;}
        pageNumber = next;
        viewport.scrollLeft = 0;viewport.scrollTop = 0;sync();render();
      }
      function resize() { const width=viewport.clientWidth;if(width===lastWidth)return;lastWidth=width;clearTimeout(resizeTimer);resizeTimer = setTimeout(render,100); }
      $("[data-reader-prev]").addEventListener("click",()=>navigate(pageNumber-1));
      $("[data-reader-next]").addEventListener("click",()=>navigate(pageNumber+1));
      pageInput.addEventListener("change",()=>navigate(pageInput.value));
      pageInput.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();navigate(pageInput.value);}});
      function changeZoom(step) {
        zoom = Math.max(.25,Math.min(3,(zoom ?? renderedScale)+step));
        render();
      }
      $("[data-reader-in]").addEventListener("click",()=>changeZoom(.2));
      $("[data-reader-out]").addEventListener("click",()=>changeZoom(-.2));
      $("[data-reader-fit]").addEventListener("click",()=>{zoom=null;viewport.scrollLeft=0;viewport.scrollTop=0;render();});
      $("[data-reader-expand]").addEventListener("click",()=>{
        const expanded = !dialog.classList.contains("is-document-focused");
        dialog.classList.toggle("is-document-focused",expanded);
        const details = dialog.querySelector(detailsSelector);
        if (details) details.hidden = expanded;
        const workspace = dialog.querySelector(".project-workspace, .credential-workspace");
        if (workspace) workspace.scrollTop = 0;
        $("[data-reader-expand]").setAttribute("aria-pressed",String(expanded));
        $("[data-reader-expand]").setAttribute("aria-label",expanded?"Restore document layout":"Expand document");
        $("[data-reader-expand]").title=expanded?"Restore document layout":"Expand document";
        resize();
      });
      viewport.addEventListener("keydown",event=>{if(event.key==="ArrowLeft"){event.preventDefault();navigate(pageNumber-1);}if(event.key==="ArrowRight"){event.preventDefault();navigate(pageNumber+1);}});
      const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
      observer?.observe(viewport);
      window.addEventListener("resize",resize);
      loadLibrary().then(async pdfjs=>{
        if (!alive) return;
        loading = pdfjs.getDocument({url:url.href,cMapUrl:new URL("cmaps/",assets).href,cMapPacked:true,standardFontDataUrl:new URL("standard_fonts/",assets).href,wasmUrl:new URL("wasm/",assets).href,disableAutoFetch:true,disableStream:true});
        const progress=$('[data-reader-progress]'), label=$('[data-reader-loading-label]');
        loading.onProgress = ({loaded,total}) => {
          if(!alive || pdf)return;
          if(Number.isFinite(total)&&total>0){
            const percent=Math.min(100,Math.max(0,Math.round(loaded/total*100)));
            progress.value=percent;
            label.textContent=percent===100?'Preparing the first page…':`Loading PDF… ${percent}%`;
          } else {
            progress.removeAttribute('value');label.textContent='Loading PDF…';
          }
        };
        loading.onPassword = ()=>{fail("This PDF needs a password. Please use the full reader.");loading.destroy().catch(()=>{});};
        pdf = await loading.promise;
        if (!alive) return;
        pageNumber=Math.max(1,Math.min(pdf.numPages,Math.trunc(Number(initialPage))||1));
        progress.value=100;label.textContent='Preparing the first page…';
        $("[data-reader-total]").textContent = pdf.numPages;pageInput.max = pdf.numPages;
        controls.forEach(control=>{control.disabled=false;});sync();render();
      }).catch(()=>fail());
      return {goTo:navigate,get page(){return pageNumber;},destroy(){alive=false;revision++;clearTimeout(resizeTimer);observer?.disconnect();window.removeEventListener("resize",resize);task?.cancel();loading?.destroy().catch(()=>{});dialog.classList.remove("is-document-focused");const details=dialog.querySelector(detailsSelector);if(details)details.hidden=false;paper.querySelectorAll('canvas').forEach(canvas=>{canvas.width=0;canvas.height=0;});mount.replaceChildren();}};
    }
  };
})();
