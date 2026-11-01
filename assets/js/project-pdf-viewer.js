(() => {
  const assets = new URL("../pdfjs/", document.currentScript.src);
  let library;
  const loadLibrary = () => library ||= import(new URL("pdf.min.mjs", assets).href).then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", assets).href;
    return pdfjs;
  }).catch(error => { library = null; throw error; });

  window.ProjectPDFViewer = {
    create({mount, url, title, dialog, detailsSelector = ".project-details"}) {
      const root = document.createElement("div");
      root.className = "project-reader";
      root.innerHTML = `
        <div class="project-reader-toolbar" aria-label="PDF controls">
          <div class="project-reader-controls"><button type="button" data-reader-prev aria-label="Previous page" title="Previous page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><label class="project-reader-page"><span class="reader-sr-only">Page number</span><input data-reader-page type="number" min="1" value="1" aria-label="Page number" /><span>/ <span data-reader-total>—</span></span></label><button type="button" data-reader-next aria-label="Next page" title="Next page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button></div>
          <div class="project-reader-controls"><button type="button" data-reader-out aria-label="Zoom out" title="Zoom out">−</button><button type="button" data-reader-fit title="Fit page width" aria-label="Fit page width">Fit</button><button type="button" data-reader-in aria-label="Zoom in" title="Zoom in">+</button><span class="project-reader-divider"></span><button type="button" data-reader-expand title="Expand document" aria-label="Expand document" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg></button></div>
          <a class="project-pdf-link project-reader-open" target="_blank" rel="noopener noreferrer">Open PDF <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a>
        </div>
        <div class="project-reader-viewport" tabindex="0" role="region" aria-label="Interactive PDF pages"><div class="project-reader-paper" data-reader-paper></div><p class="project-reader-message" data-reader-message role="status">Preparing your document…</p></div>
        <div class="reader-sr-only" role="status"><span data-reader-position>Visual documentation</span><span data-reader-zoom>Fit to width</span></div>`;
      mount.replaceChildren(root);
      const $ = selector => root.querySelector(selector);
      $(".project-reader-open").href = url.href;
      $(".project-reader-open").setAttribute("aria-label", `Open ${title} PDF in a new tab`);
      const viewport = $(".project-reader-viewport"), paper = $("[data-reader-paper]"), pageInput = $("[data-reader-page]"), message = $("[data-reader-message]");
      let alive = true, loading, pdf, task, pageNumber = 1, zoom = null, renderedScale = 1, revision = 0, resizeTimer;
      const controls = [...root.querySelectorAll("button, input")];
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
          paper.replaceChildren(canvas);message.hidden = true;
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
        viewport.scrollTop = 0;sync();render();
      }
      function resize() { clearTimeout(resizeTimer);resizeTimer = setTimeout(render,100); }
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
      $("[data-reader-fit]").addEventListener("click",()=>{zoom=null;render();});
      $("[data-reader-expand]").addEventListener("click",()=>{
        const expanded = !dialog.classList.contains("is-document-focused");
        dialog.classList.toggle("is-document-focused",expanded);
        const details = dialog.querySelector(detailsSelector);
        if (details) details.hidden = expanded;
        $("[data-reader-expand]").setAttribute("aria-pressed",String(expanded));
        $("[data-reader-expand]").setAttribute("aria-label",expanded?"Restore project layout":"Expand document");
        $("[data-reader-expand]").title=expanded?"Restore project layout":"Expand document";
        resize();
      });
      viewport.addEventListener("keydown",event=>{if(event.key==="ArrowLeft"){event.preventDefault();navigate(pageNumber-1);}if(event.key==="ArrowRight"){event.preventDefault();navigate(pageNumber+1);}});
      const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
      observer?.observe(viewport);
      window.addEventListener("resize",resize);
      loadLibrary().then(async pdfjs=>{
        if (!alive) return;
        loading = pdfjs.getDocument({url:url.href,cMapUrl:new URL("cmaps/",assets).href,cMapPacked:true,standardFontDataUrl:new URL("standard_fonts/",assets).href,wasmUrl:new URL("wasm/",assets).href,disableAutoFetch:true,disableStream:true});
        loading.onPassword = ()=>{fail("This PDF needs a password. Please use the full reader.");loading.destroy().catch(()=>{});};
        pdf = await loading.promise;
        if (!alive) return;
        $("[data-reader-total]").textContent = pdf.numPages;pageInput.max = pdf.numPages;
        controls.forEach(control=>{control.disabled=false;});sync();render();
      }).catch(()=>fail());
      return {destroy(){alive=false;revision++;clearTimeout(resizeTimer);observer?.disconnect();window.removeEventListener("resize",resize);task?.cancel();loading?.destroy().catch(()=>{});dialog.classList.remove("is-document-focused");const details=dialog.querySelector(detailsSelector);if(details)details.hidden=false;mount.replaceChildren();}};
    }
  };
})();
