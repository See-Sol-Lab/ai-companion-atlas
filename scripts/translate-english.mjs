// Explicit editorial operation: only published site copy is sent for translation.
// Normal site generation uses the saved dictionary without network requests.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapCopy, translationKey, publicStaticPages } from './english.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projects = await Promise.all((await readdir(path.join(root, 'projects'))).filter(f => f.endsWith('.json')).map(async f => JSON.parse(await readFile(path.join(root, 'projects', f), 'utf8'))));
const dictionaryPath = path.join(root, 'locales/en.json');
let copy;
try { copy = JSON.parse(await readFile(dictionaryPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; copy = {}; }
Object.assign(copy, JSON.parse(await readFile(path.join(root, 'locales/en-ui.json'), 'utf8')));
for (const p of projects) if (p.name.zh !== p.name.en) copy[p.name.zh] = p.name.en;
const strings = new Set();
for (const file of [...publicStaticPages, ...projects.map(p => `projects/${p.slug}/index.html`)]) {
  mapCopy(await readFile(path.join(root, file), 'utf8'), text => {
    const key = translationKey(text);
    if (/[\u3400-\u9fff]/u.test(key) && !copy[key]) strings.add(key);
    return text;
  });
}
const batches = [];
let batch = [], length = 0;
for (const text of strings) {
  if (length + text.length > 2200 && batch.length) { batches.push(batch); batch = []; length = 0; }
  batch.push(text); length += text.length + 12;
}
if (batch.length) batches.push(batch);
console.log(`Translating ${strings.size} public strings in ${batches.length} batches.`);
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < batches.length) {
    const index = next++, items = batches[index];
    const source = items.map((text, i) => `[[${i}]] ${text.replace(/\s*\n\s*/g, ' ')}`).join('\n');
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.search = new URLSearchParams({client:'gtx',sl:'zh-CN',tl:'en',dt:'t',q:source});
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`Translation HTTP ${response.status} at batch ${index}`);
    const result = await response.json();
    const text = result[0].map(item => item[0]).join('');
    const matches = [...text.matchAll(/\[\[\s*(\d+)\s*\]\]\s*([\s\S]*?)(?=\[\[\s*\d+\s*\]\]|$)/g)];
    if (matches.length !== items.length || matches.some((m, i) => Number(m[1]) !== i || !m[2].trim())) throw new Error(`Translation markers changed in batch ${index}`);
    matches.forEach((m,i) => { copy[items[i]] = m[2].trim(); });
    console.log(`Translated batch ${index+1}/${batches.length}`);
  }
}));
await mkdir(path.dirname(dictionaryPath), { recursive: true });
await writeFile(dictionaryPath, JSON.stringify(copy, null, 2)+'\n');
console.log(`Saved ${Object.keys(copy).length} English strings.`);
