import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mapCopy, translationKey, publicStaticPages, publicScripts, pagePath } from '../scripts/english.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFile(path.join(root, file), 'utf8');
const projectFiles = (await readdir(path.join(root, 'projects'))).filter(file => file.endsWith('.json'));
const pages = [...publicStaticPages, ...projectFiles.map(file => `projects/${file.slice(0, -5)}/index.html`)];

test('translation changes copy but preserves identifiers and executable scripts', () => {
  const input = '<p id="中文" title="中文">中文</p><script>const name="中文";</script>';
  assert.equal(mapCopy(input, text => text.replaceAll('中文', 'English')), '<p id="中文" title="English">English</p><script>const name="中文";</script>');
  assert.equal(translationKey('更新 2026-09-20'), '更新');
});

test('every public page has a paired English route, canonical and language switch', async () => {
  const sitemap = await read('sitemap.xml');
  for (const file of pages) {
    const zh = await read(file);
    const en = await read(`en/${file}`);
    const route = pagePath(file);
    assert.ok(en.includes('<html lang="en">'), file);
    assert.ok(en.includes(`rel="canonical" href="https://www.ailover-atlas.com/en${route}"`), file);
    assert.ok(en.includes(`class="language-switch" href="${route}"`), file);
    assert.ok(zh.includes(`class="language-switch" href="/en${route}"`), file);
    assert.equal((en.match(/hreflang="x-default"/g) || []).length, 1, file);
    assert.ok(sitemap.includes(`<loc>https://www.ailover-atlas.com/en${route}</loc>`), file);
    assert.deepEqual(en.match(/>Updated \d{4}-\d{2}-\d{2}/g)?.map(s => s.slice(-10)), zh.match(/>更新 \d{4}-\d{2}-\d{2}/g)?.map(s => s.slice(-10)), file);
  }
});

test('English internal page and asset links resolve without translating release paths', async () => {
  const targets = new Set();
  for (const file of pages) {
    const html = await read(`en/${file}`);
    for (const match of html.matchAll(/\b(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)) {
      const target = match[1];
      if (target.startsWith('//') || target.includes('/releases/')) continue;
      targets.add(target.endsWith('/') ? `${target}index.html` : target);
    }
  }
  for (const target of targets) await access(path.join(root, target));
  const download = await read('en/deepseekgui/download/index.html');
  assert.ok(!download.includes('/en/deepseekgui/releases/'));
  for (const file of publicScripts) assert.ok((await read(`en/${file}`)).length > 0);
});
