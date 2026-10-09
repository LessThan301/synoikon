#!/usr/bin/env node
// Render Open Graph images (1200×630 PNG) for precomputed words with the app's own
// renderer in headless Chromium: w/<lang>/<word>/og.png, plus the generic og.png.
// usage: node tools/render-og.mjs [--force] [--langs en,de] [--generic]
// needs: npm i playwright && npx playwright install chromium
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { serve } from './serve.mjs';
import { slug } from '../js/words.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://lessthan301.github.io/contexter/';
const FORCE = process.argv.includes('--force');
const i = process.argv.indexOf('--langs');
const ONLY = i > 0 ? process.argv[i + 1].split(',') : null;
const port = 8790 + Math.floor(Math.random() * 100);
const server = await serve(port);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/contexter/?og=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__contexterApp);

async function render(code, word, url, file) {
  await page.evaluate(([c]) => { const s = document.getElementById('lang'); s.value = c; s.dispatchEvent(new Event('change')); }, [code]);
  await page.evaluate(([w]) => window.__contexterApp.search(w), [word]);
  await page.waitForFunction(([w]) => { const s = window.__contexterApp.state(); return s.precomputed && s.term === w && window.__contexter.count().nodes > 1; }, [word], { timeout: 20000 });
  const data = await page.evaluate(([u]) => window.__contexterApp.cardDataURL('og', u), [url]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
}

let n = 0, bytes = 0;
const fresh = [];
const t0 = Date.now();
if (process.argv.includes('--generic') || !fs.existsSync(path.join(ROOT, 'og.png'))) {
  // generic image: the "language" network if precomputed, else any English word
  const enDir = path.join(ROOT, 'data/precomputed/en');
  const pick = fs.existsSync(path.join(enDir, 'language.json')) ? 'language'
    : fs.readdirSync(enDir).find((f) => f.endsWith('.json') && f !== 'index.json')?.slice(0, -5);
  if (pick) { await render('en', pick, SITE, path.join(ROOT, 'og.png')); fresh.push(path.join(ROOT, 'og.png')); console.log(`generic og.png (${pick})`); }
}
const pre = path.join(ROOT, 'data/precomputed');
for (const code of fs.readdirSync(pre).filter((d) => fs.statSync(path.join(pre, d)).isDirectory()).sort()) {
  if (ONLY && !ONLY.includes(code)) continue;
  for (const f of fs.readdirSync(path.join(pre, code)).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
    const s = f.slice(0, -5);
    const file = path.join(ROOT, 'w', code, s, 'og.png');
    const { word, generated } = JSON.parse(fs.readFileSync(path.join(pre, code, f), 'utf8'));
    // re-render when the record was regenerated after the image was written (refreshed words)
    if (!FORCE && fs.existsSync(file) && fs.statSync(file).mtimeMs >= Date.parse(generated)) continue;
    try {
      await render(code, word, `${SITE}w/${code}/${encodeURIComponent(slug(word))}/`, file);
      n++; bytes += fs.statSync(file).size; fresh.push(file);
      if (n % 50 === 0) console.log(`  ${n} images, avg ${(bytes / n / 1024).toFixed(0)} KB`);
    } catch (err) { console.log(`  FAIL ${code}/${word}: ${err.message.split('\n')[0]}`); }
  }
}
console.log(`rendered ${n} OG images in ${((Date.now() - t0) / 1000).toFixed(0)} s, avg ${n ? (bytes / n / 1024).toFixed(0) : 0} KB${errors.length ? `; page errors: ${errors.join(' | ')}` : ''}`);
await browser.close();
server.close();
// palette-quantize the new images (~200 KB -> ~40 KB each); skipped if Pillow is missing
for (let k = 0; k < fresh.length; k += 200) {
  try { console.log(execFileSync('python3', [path.join(ROOT, 'tools/quantize-png.py'), ...fresh.slice(k, k + 200)]).toString().trim()); }
  catch (err) { console.log(`(quantize skipped: ${err.message.split('\n')[0]})`); break; }
}
