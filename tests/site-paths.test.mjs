import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DOMParser} from "linkedom";

const root = new URL("../", import.meta.url);
const pages = fs.readdirSync(root).filter(file => file.endsWith(".html"));
// Simulate a GitHub Pages project URL rather than assuming domain-root hosting.
const site = "https://example.test/Portafolio/";

test("main navigation matches the published portfolio sections", () => {
  const document = new DOMParser().parseFromString(fs.readFileSync(new URL("index.html",root),"utf8"),"text/html");
  const ids = ["start", "about-me", "projects", "certificates", "journey", "contact"];
  assert.deepEqual([...document.querySelectorAll("main .section[id]")].map(section=>section.id),ids);
  assert.deepEqual([...document.querySelectorAll(".nav a")].map(link=>link.getAttribute("href")),ids.map(id=>"#"+id));
});

function existingPath(relative) {
  let directory = root;
  for (const [index, part] of relative.split("/").entries()) {
    assert(fs.readdirSync(directory).includes(part), `Missing or incorrect casing: ${relative}`);
    const final = index === relative.split("/").length - 1;
    directory = new URL(encodeURIComponent(part) + (final ? "" : "/"), directory);
  }
  return directory;
}

for (const page of pages) {
  const document = new DOMParser().parseFromString(fs.readFileSync(new URL(page,root),"utf8"),"text/html");
  test(`${page}: sharing previews use the published base, a lightweight image and a sanitizer-safe title`, () => {
    const published = new URL('https://alfrevith.github.io/DavSpace/');
    assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'), published.href);
    assert.equal(document.querySelector('meta[property="og:url"]').getAttribute('content'), published.href);
    assert(document.title.replace(/<[^>]*>/g, '').includes('David Menjivar'));
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      assert.equal(document.querySelector(selector).getAttribute('content'), document.title);
    }
    const image = new URL(document.querySelector('meta[property="og:image"]').getAttribute('content'));
    assert.equal(image.origin, published.origin);
    assert(image.pathname.startsWith(published.pathname));
    assert.equal(document.querySelector('meta[name="twitter:image"]').getAttribute('content'), image.href);
    const localImage = existingPath(decodeURIComponent(image.pathname.slice(published.pathname.length)));
    const bytes = fs.readFileSync(localImage);
    assert(bytes.length < 300000, 'share image stays small for mobile preview fetchers');
    assert.equal(bytes.readUInt16BE(0), 0xffd8, 'published JPEG metadata matches the actual format');
  });
  test(`${page}: local scripts, styles and images resolve under a project subdirectory`, () => {
    for (const node of document.querySelectorAll("script[src], link[href], img[src]")) {
      const value = node.getAttribute(node.tagName === "LINK" ? "href" : "src");
      if (!value) continue;
      const url = new URL(value,site+page);
      if (url.origin !== new URL(site).origin) continue;
      assert(url.href.startsWith(site), `Resource escapes the project base: ${value}`);
      existingPath(decodeURIComponent(url.pathname.slice(new URL(site).pathname.length)));
    }
  });
  test(`${page}: local navigation still reaches existing pages and sections`, () => {
    for (const link of document.querySelectorAll("a[href]")) {
      const url = new URL(link.getAttribute("href"),site+page);
      if (url.origin !== new URL(site).origin || !url.pathname.endsWith(".html")) continue;
      assert(url.href.startsWith(site));
      const target = existingPath(decodeURIComponent(url.pathname.slice(new URL(site).pathname.length)));
      if (!url.hash) continue;
      const targetDocument = new DOMParser().parseFromString(fs.readFileSync(target,"utf8"),"text/html");
      assert(targetDocument.getElementById(decodeURIComponent(url.hash.slice(1))), `Missing section: ${url.href}`);
    }
  });
}
