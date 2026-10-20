import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const read = file => readFile(new URL(`../${file}`, import.meta.url));
const installerPath = '/ai-gameboy/downloads/pocket_night_shop.py';

test('Night Shop download is the unmodified upstream single-file game with its license', async () => {
  const source = await read(installerPath.slice(1));
  assert.equal(source.length, 108572);
  assert.equal(createHash('sha256').update(source).digest('hex'), '43eea9a6af841f817babdaceae815d30ff109f7f29136301368016dc87119834');
  assert.ok(source.includes(Buffer.from('PolyForm Noncommercial License 1.0.0')));
  assert.ok((await read('ai-gameboy/downloads/LICENSE.txt')).includes(Buffer.from('Required Notice: Copyright See-Sol-Lab')));
});

test('both download pages use the same local file and explain the requirements', async () => {
  for (const file of ['ai-gameboy/index.html', 'en/ai-gameboy/index.html']) {
    const page = (await read(file)).toString('utf8');
    assert.ok(page.includes(`href="${installerPath}" download="pocket_night_shop.py"`));
    assert.ok(page.includes('Python 3.11+'));
    assert.ok(page.includes('pocket_night_shop.save.sqlite3'));
    assert.ok(page.includes('/ai-gameboy/downloads/LICENSE.txt'));
    assert.ok(page.includes('class="night-shop-poster"'));
    assert.ok(page.includes('src="/ai-gameboy/assets/pocket-night-shop-poster.png"'));
    assert.ok(page.includes('43eea9a6af841f817babdaceae815d30ff109f7f29136301368016dc87119834'));
    assert.ok(!page.includes('/en/ai-gameboy/downloads/'));
  }
  const project = JSON.parse((await read('projects/ai-gameboy.json')).toString('utf8'));
  assert.equal(project.directUrl, 'https://www.ailover-atlas.com/ai-gameboy/');
  assert.ok(project.badges.some(badge => badge.tone === 'no-vpn'));
  assert.ok((await read('en/projects/ai-gameboy/index.html')).includes(Buffer.from('href="/en/ai-gameboy/"')));
  const poster = await read('ai-gameboy/assets/pocket-night-shop-poster.png');
  assert.equal(poster.readUInt32BE(16), 1080);
  assert.equal(poster.readUInt32BE(20), 1440);
});
