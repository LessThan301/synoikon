// Browser check for every language: graph renders, fonts load, RTL, no console errors.
// Serve the repo root first (python3 -m http.server 8765).
// usage: node tests/languages.e2e.mjs [baseUrl] [width] [height] [codes...]
import { chromium } from 'playwright';
import { LANGS } from '../js/languages.js';
const [base = 'http://localhost:8765/', width = '1400', height = '900', ...codes] = process.argv.slice(2);
const mobile = +width < 600;
const browser = await chromium.launch();
const results = [];
for (const lang of LANGS.filter((l) => !codes.length || codes.includes(l.code))) {
  const context = await browser.newContext({ viewport: { width: +width, height: +height }, hasTouch: mobile, isMobile: mobile });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const t0 = Date.now();
  await page.goto(`${base}#q=${encodeURIComponent(lang.sample)}&lang=${lang.code}`);
  let nodes = 0, labels = [], font = null, extra = {};
  try {
    await page.waitForFunction(() => window.__synoikon?.count().nodes > 1 || !document.getElementById('error').classList.contains('hidden'), null, { timeout: 60000 });
    nodes = await page.evaluate(() => window.__synoikon.count().nodes);
    labels = await page.evaluate(() => window.__synoikon.labels().slice(0, 8));
    if (lang.font) {
      await page.waitForTimeout(1500);
      font = await page.evaluate((f) => [...document.fonts].some((ff) => ff.family.replace(/"/g, '') === f && ff.status === 'loaded'), lang.font.family);
    }
    extra = await page.evaluate(() => ({
      dir: getComputedStyle(document.getElementById('term')).direction,
      stopName: document.getElementById('stopLangName').textContent,
      hnDisabled: document.querySelector('#sourceBoxes input[value=hackerNews]').disabled,
      sampleDir: document.querySelector('#samples li')?.getAttribute('dir'),
      overflow: document.documentElement.scrollWidth > innerWidth,
      stats: document.querySelector('#stats p')?.textContent.replace(/\s+/g, ' ').slice(0, 90),
    }));
    if (['zh', 'hi', 'ar', 'ur', 'bn', 'el'].includes(lang.code)) await page.screenshot({ path: `./lang-${lang.code}-${width}.png` });
  } catch (e) { errors.push('timeout/err: ' + e.message.split('\n')[0]); }
  results.push({ code: lang.code, word: lang.sample, nodes, ms: Date.now() - t0, font, ...extra, errors: errors.length });
  console.log(lang.code, lang.sample, 'nodes', nodes, 'font', font, JSON.stringify(extra), labels.join(' '), errors.length ? 'ERRORS: ' + errors.join(' | ') : '');
  await context.close();
  await new Promise((r) => setTimeout(r, 1500));
}
const bad = results.filter((r) => r.nodes < 10 || r.errors || r.overflow || (r.font === false));
console.log(bad.length ? `FAIL: ${bad.map((r) => r.code).join(', ')}` : `PASS: all ${results.length} languages render`);
if (bad.length) process.exitCode = 1;
await browser.close();
