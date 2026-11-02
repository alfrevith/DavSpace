import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {DOMParser} from "linkedom";
import core from "../assets/js/assistant-core.js";

const script=await readFile(new URL("../assets/js/assistant.js",import.meta.url),"utf8");
const page='<html><body><main><section class="section" id="start"><h1 class="name">David Menjivar</h1></section><section class="section" id="about-me"><p>Writing and photography are interests.</p></section></main></body></html>';
function setup({held=false}={}){
  const document=new DOMParser().parseFromString(page,"text/html"),window=document.defaultView;
  Object.defineProperty(document,"currentScript",{value:{src:"https://example.test/DavSpace/assets/js/assistant.js"}});
  window.PortfolioKnowledge=core;
  window.HTMLElement.prototype.focus=()=>{};
  let now=0;
  const calls=[],pending=[];
  const fetch=(url,{signal}={})=>{
    assert.equal(url.origin,"https://example.test");
    calls.push(url.pathname);
    const text=url.pathname.endsWith("index.html")?page:url.pathname.endsWith("projects.js")?"window.PORTFOLIO_PROJECTS={};":"{}";
    const response={ok:true,text:async()=>text};
    return held?new Promise(resolve=>pending.push(()=>resolve(response))):Promise.resolve(response);
  };
  runInNewContext(script,{window,document,navigator:{language:"es"},URL,DOMParser,fetch,AbortController,setTimeout,clearTimeout,Date:{now:()=>now},matchMedia:()=>({matches:true,addEventListener(){}})});
  const $=selector=>document.querySelector(selector);
  const send=async question=>{$("textarea").value=question;$("form").dispatchEvent(new window.Event("submit",{cancelable:true}));await new Promise(resolve=>setImmediate(resolve));};
  return {$,send,calls,release:async()=>{pending.splice(0).forEach(resolve=>resolve());await new Promise(resolve=>setImmediate(resolve));},advance:ms=>{now+=ms;}};
}
test("chat fetches nothing on startup, reuses its snapshot and refreshes after a minute",async()=>{
  const ui=setup();assert.equal(ui.calls.length,0);
  await ui.send("¿Quién es David?");assert.equal(ui.calls.length,4);
  assert.match(ui.$(".assistant-log").textContent,/David Menjivar/);
  await ui.send("¿Qué le gusta?");assert.equal(ui.calls.length,4);
  ui.advance(60001);await ui.send("¿Quién es David?");assert.equal(ui.calls.length,8);
});
test("reset clears visitor memory and late source reads cannot append a stale answer",async()=>{
  const ui=setup({held:true});await ui.send("Me llamo Alex");
  ui.$(".assistant-reset").click();await ui.release();
  assert.equal(ui.$(".assistant-log").textContent,"");
  assert(!ui.$(".assistant-send").disabled);
  assert(!ui.$(".assistant-log").hasAttribute("aria-busy"));
});
test("a new conversation clears personal context, while rendered messages stay inert text",async()=>{
  const ui=setup();await ui.send("Me llamo Alex");
  await ui.send("¿Cómo me llamo?");assert.match(ui.$(".assistant-log").textContent,/Me dijiste que te llamas Alex/);
  ui.$(".assistant-reset").click();await ui.send("¿Cómo me llamo?");
  assert(!ui.$(".assistant-log").textContent.includes("Alex"));
  await ui.send('<img src=x onerror="alert(1)">');
  assert.equal(ui.$(".assistant-log").querySelectorAll("img").length,0);
});
