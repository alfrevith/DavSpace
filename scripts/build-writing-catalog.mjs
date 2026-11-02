import fs from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const catalogPath = 'data/writing.json';
const previous = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
const existing = new Map((previous.works || []).map(entry => [entry.pdf, entry]));
const reservedIds = new Set((previous.works || []).map(entry => entry.id)), usedIds = new Set();
async function discover(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await discover(file));
    else if (entry.isFile() && /\.pdf$/i.test(entry.name)) found.push(file.replaceAll('\\', '/'));
  }
  return found.sort((a, b) => a.localeCompare(b, 'es'));
}
const works = [];
for (const [directory, type] of [['pdfs/poems', 'poetry'], ['pdfs/stories', 'story']]) {
  for (const file of await discover(directory)) {
    const saved = existing.get(file), filename = path.basename(file, path.extname(file));
    const task = getDocument({ data: new Uint8Array(await fs.readFile(file)), useSystemFonts: true });
    try {
      const pdf = await task.promise, metadata = await pdf.getMetadata();
      const infoTitle = String(metadata.info.Title || '').trim();
      const page = await pdf.getPage(1), content = await page.getTextContent();
      const firstLine = content.items.filter(item => typeof item.str === 'string').reduce((lines, item) => {
        if (!lines.length || lines.at(-1).end) lines.push({ text: '', end: false });
        lines.at(-1).text += item.str; lines.at(-1).end = item.hasEOL;
        return lines;
      }, []).map(line => line.text.trim()).find(Boolean);
      const reliableTitle = infoTitle && !/^(?:untitled|document\d*|microsoft\s+word)/i.test(infoTitle) ? infoTitle : type === 'poetry' && firstLine && firstLine.length <= 100 ? firstLine : filename;
      const slug = filename.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let id = saved?.id;
      if (!id) {
        const stem = `${type}-${slug || 'manuscript'}`;
        id = stem;
        for (let suffix = 2; reservedIds.has(id) || usedIds.has(id); suffix++) id = `${stem}-${suffix}`;
      }
      if (usedIds.has(id)) throw new Error(`Duplicate manuscript id: ${id}. Update data/writing.json before building.`);
      usedIds.add(id);
      works.push({ ...saved, id, type, pdf: file, title: saved?.title || reliableTitle,
        author: saved?.author || metadata.info.Author || null, cover: saved?.cover || null,
        description: saved?.description || '', date: saved?.date || null, pages: pdf.numPages,
        order: Number.isFinite(saved?.order) ? saved.order : works.length + 1 });
    } finally { await task.destroy(); }
  }
}
// Keep explicitly curated works outside the two automatically scanned folders.
for (const entry of previous.works || []) {
  if (/^pdfs\/(poems|stories)\//.test(entry.pdf)) continue;
  if (usedIds.has(entry.id)) throw new Error(`Duplicate manuscript id: ${entry.id}.`);
  usedIds.add(entry.id); works.push(entry);
}
await fs.writeFile(catalogPath, JSON.stringify({ works }, null, 2) + '\n');
console.log(`Writing catalog: ${works.filter(work => work.type === 'poetry').length} poems, ${works.filter(work => work.type === 'story').length} stories. Original PDFs are read only.`);
