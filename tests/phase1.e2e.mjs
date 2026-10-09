// Phase 1 end-to-end checks: PWA installability + service worker + offline, word of the day,
// precomputed words, Share map, static word pages, analytics gating.
// Serve first: node tools/serve.mjs 8765   (mounts the repo at /synoikon/ like GitHub Pages)
// usage: node tests/phase1.e2e.mjs [base=http://localhost:8765/synoikon/] [width=1400] [height=900]
import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { wordOfDay, POPULAR } from '../js/words.js';

const [base = 'http://localhost:8765/synoikon/', width = '1400', height = '900'] = process.argv.slice(2);
const mobile = +width < 600;
const live = !base.includes('localhost');
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-pwa-'));
const context = await chromium.launchPersistentContext(userDir, {
  viewport: { width: +width, height: +height }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 3 : 1, acceptDownloads: true,
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = context.pages()[0] || await context.newPage();
const errors = [];
const watch = (p) => {
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
};
watch(page);
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };
const G = (fn, arg) => page.evaluate(fn, arg);
const appState = () => G(() => window.__synoikonApp.state());

// Analytics stub (installed first, so test runs never send real beacons — also on the live site).
const cfReqs = [];
await context.route(/cloudflareinsights\.com/, (r) => { cfReqs.push(r.request().url()); r.fulfill({ contentType: 'text/javascript', body: 'window.__beacon = 1;' }); });

// Web Share stub (headless Chromium has no share sheet): records calls, supports files.
await context.addInitScript(() => {
  window.__shared = [];
  if (new URLSearchParams(location.search).has('stubshare')) {
    navigator.canShare = (d) => !!(d && d.files && d.files.length);
    navigator.share = async (d) => { window.__shared.push({ files: d.files.map((f) => ({ name: f.name, type: f.type, size: f.size })), url: d.url, title: d.title }); };
  }
});

// ---- 1. PWA: manifest, installability, service worker ------------------------------
await page.goto(base, { waitUntil: 'networkidle' });
const cdp = await context.newCDPSession(page);
const man = await cdp.send('Page.getAppManifest');
const manifest = JSON.parse(man.data || '{}');
ok(man.errors.length === 0 && manifest.name === 'Synoikon', `manifest parses (${man.url}) errors=${JSON.stringify(man.errors)}`);
const scopeUrl = new URL(manifest.scope, man.url).href, startUrl = new URL(manifest.start_url, man.url).href;
ok(scopeUrl === base && startUrl.startsWith(base), `start_url ${startUrl} and scope ${scopeUrl} are inside the /synoikon/ subpath`);
const purposes = manifest.icons.map((i) => `${i.sizes}:${i.purpose}`);
ok(purposes.includes('192x192:any') && purposes.includes('512x512:any') && purposes.includes('512x512:maskable'), `icons 192/512 + maskable: ${purposes.join(', ')}`);
for (const icon of manifest.icons.filter((i) => i.type === 'image/png')) {
  const dims = await G(async (src) => { const img = new Image(); img.src = src; await img.decode(); return `${img.naturalWidth}x${img.naturalHeight}`; }, new URL(icon.src, man.url).href);
  ok(dims === icon.sizes, `icon ${icon.src} is really ${icon.sizes}`);
}
ok(manifest.display === 'standalone' && manifest.theme_color && manifest.background_color, 'display standalone, theme/background colours');
await G(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: 'networkidle' });
ok(await G(() => !!navigator.serviceWorker.controller), 'service worker controls the page after reload');
let inst = await cdp.send('Page.getInstallabilityErrors');
for (let i = 0; i < 10 && inst.installabilityErrors.length; i++) { await page.waitForTimeout(500); inst = await cdp.send('Page.getInstallabilityErrors'); }
ok(inst.installabilityErrors.length === 0, `Chromium installability check: ${inst.installabilityErrors.length ? JSON.stringify(inst.installabilityErrors) : 'installable'}`);
const caches = await G(async () => { const out = {}; for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).length; return out; });
ok(Object.keys(caches).some((k) => k.startsWith('synoikon-shell-')), `versioned shell cache: ${JSON.stringify(caches)}`);
ok(await page.locator('#install').count() === 1, 'install button present (shown when the browser fires beforeinstallprompt)');

// ---- 2. word of the day ---------------------------------------------------------------
const today = wordOfDay('en');
ok((await page.locator('#wotdWord').innerText()).trim() === today.word, `start screen shows today's word "${today.word}" (${today.date} UTC)`);
let t0 = Date.now();
await page.click('#wotdWord');
await page.waitForFunction(() => window.__synoikon.count().nodes > 1);
const wotdMs = Date.now() - t0;
let st = await appState();
ok(st.precomputed && st.term === today.word, `today's word opens from precomputed data in ${wotdMs} ms`);
ok(wotdMs < 2500, 'precomputed word appears quickly (< 2.5 s incl. layout)');
ok(/Precomputed on/.test(await page.locator('#stats').textContent()), 'stats panel says "Precomputed on …" with a refresh button');
const de = wordOfDay('de');
await page.goto(base + '#wotd&lang=de', { waitUntil: 'networkidle' });
await page.waitForFunction((w) => window.__synoikonApp.state().term === w && window.__synoikon.count().nodes > 1, de.word);
ok((await G(() => document.getElementById('lang').value)) === 'de', `#wotd&lang=de opens "${de.word}" in German`);

// ---- 3. precomputed interactivity ----------------------------------------------------------
const pop = today.word; // always among the first words precomputed
await page.goto(base + `#q=${pop}&lang=en`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__synoikon.count().nodes > 1);
st = await appState();
ok(st.precomputed, `popular word "${pop}" loads precomputed`);
const distinct = await G(() => window.__synoikon.labels().join());
if (mobile) { await page.click('#menuBtn'); await page.waitForTimeout(350); } // settings drawer
await page.click('.seg label:has(input[value=frequency])');
await page.waitForTimeout(300);
ok((await G(() => window.__synoikon.labels().join())) !== distinct && (await appState()).precomputed, 'rank toggle works on precomputed data (no fetch)');
await page.click('.seg label:has(input[value=distinctive])');
if (mobile) { await page.keyboard.press('Escape'); await page.waitForTimeout(350); }
await page.locator('#topN').evaluate((el) => { el.value = 50; el.dispatchEvent(new Event('input')); });
await page.waitForFunction(() => window.__synoikon.count().nodes === 51);
ok((await appState()).precomputed, 'neighbours slider (≤80) stays on precomputed data');
await page.locator('#topN').evaluate((el) => { el.value = 30; el.dispatchEvent(new Event('input')); });
if (!live) {
  await page.locator('#window').evaluate((el) => { el.value = 7; el.dispatchEvent(new Event('input')); });
  await page.waitForFunction(() => window.__synoikonApp.state().live, null, { timeout: 45000 });
  ok(true, 'changing the context window switches to live data automatically');
  await page.locator('#window').evaluate((el) => { el.value = 5; el.dispatchEvent(new Event('input')); });
}

// ---- 4. share map ---------------------------------------------------------------------------
await page.goto(base + `?stubshare=${mobile ? 1 : 0}#q=${pop}&lang=en`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__synoikon.count().nodes > 1);
await page.click('#share');
await page.waitForFunction(() => document.getElementById('cardPreview').naturalWidth > 0);
const dimsOf = () => G(() => { const i = document.getElementById('cardPreview'); return `${i.naturalWidth}x${i.naturalHeight}`; });
ok((await dimsOf()) === '1200x630', 'share card preview is 1200×630');
const url = await page.locator('#shareUrl').inputValue();
ok(url === `${base}w/en/${encodeURIComponent(pop)}/`, `share link points to the static word page: ${url}`);
await page.screenshot({ path: `./phase1-share-${width}.png` });
await page.click('.share-dlg .seg label:has(input[value=square])');
await page.waitForFunction(() => document.getElementById('cardPreview').naturalWidth === 1080);
ok((await dimsOf()) === '1080x1080', 'square variant is 1080×1080');
const card = await G(async () => { const b = await window.__synoikonApp.card('og'); const bm = await createImageBitmap(b); const c = new OffscreenCanvas(bm.width, bm.height); const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
  const d = x.getImageData(0, 0, bm.width, bm.height).data; let colored = 0; for (let i = 0; i < d.length; i += 4 * 97) if (Math.abs(d[i] - d[i + 2]) > 60) colored++; return { type: b.type, size: b.size, colored }; });
ok(card.type === 'image/png' && card.size > 20000 && card.colored > 50, `card PNG has the network drawn (${(card.size / 1024).toFixed(0)} KB, ${card.colored} coloured samples)`);
if (mobile) {
  ok(await page.locator('#shareImage').isVisible(), 'mobile: "Share image…" offered when navigator.canShare({files}) is true');
  await page.click('#shareImage');
  await page.waitForFunction(() => window.__shared.length > 0);
  const sh = await G(() => window.__shared[0]);
  ok(sh.files[0].type === 'image/png' && sh.files[0].size > 20000 && sh.url === url, `Web Share called with ${sh.files[0].name} + link`);
} else {
  const canShare = await G(() => !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] }));
  ok((await page.locator('#shareImage').isVisible()) === canShare, `"Share image…" shown only where file sharing is supported (canShare=${canShare}); otherwise Download PNG is primary`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#downloadPng')]);
  ok(/\.png$/.test(dl.suggestedFilename()), `PNG downloads as ${dl.suggestedFilename()}`);
}
await page.click('#copyLink');
await page.waitForTimeout(200);
const clip = await G(() => navigator.clipboard.readText().catch(() => ''));
ok(clip === url || /copy/i.test(await page.locator('#shareStatus').innerText()), 'copy link copies the shareable URL');
await page.keyboard.press('Escape');

// ---- 5. offline ---------------------------------------------------------------------------
{
  await context.setOffline(true);
  await page.goto(base + `#q=${pop}&lang=en`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__synoikon?.count().nodes > 1, null, { timeout: 15000 });
  ok((await appState()).precomputed, 'offline: app shell + a precomputed word load from the service worker');
  await page.fill('#term', 'zzqxnotcached'); await page.click('#go');
  await page.waitForFunction(() => !document.getElementById('error').classList.contains('hidden'), null, { timeout: 30000 });
  const msg = (await page.locator("#error").innerText()).replace(/\n+/g, " ");
  ok(/offline/i.test(msg) && (await page.locator('#offlineWords button').count()) > 0, `offline fallback message lists words that work offline: "${msg.split('\n').slice(0, 2).join(' ')}"`);
  const p2 = await context.newPage();
  await p2.goto(base + 'w/xx/not-cached/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  ok(/offline/i.test(await p2.title()), 'offline navigation to an uncached page shows offline.html');
  await p2.close();
  await context.setOffline(false);
  errors.splice(0, errors.length, ...errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR|Failed to load resource/.test(e)));
}

// ---- 6. static word page, sitemap, robots, about -------------------------------------------
const wp = await context.newPage();
watch(wp);
await wp.goto(`${base}w/en/${encodeURIComponent(pop)}/`, { waitUntil: 'networkidle' });
const metaOf = (sel) => wp.locator(sel).getAttribute('content');
ok((await wp.title()).includes(pop) && (await metaOf('meta[name=description]')).length > 80, `word page title/description: "${await wp.title()}"`);
ok((await wp.locator('link[rel=canonical]').getAttribute('href')) === `https://lessthan301.github.io/synoikon/w/en/${encodeURIComponent(pop)}/`, 'canonical URL');
const ogImg = await metaOf('meta[property="og:image"]');
ok(/\/w\/en\/.+\/og\.png$/.test(ogImg), `og:image is the pre-rendered PNG: ${ogImg}`);
ok((await wp.locator('a.btn').first().getAttribute('href')).includes(`#q=${pop}&lang=en`), 'links into the app');
ok(await wp.locator('figure img').evaluate((i) => i.complete && i.naturalWidth === 1200), 'OG image loads on the page');
ok((await wp.locator('link[rel=alternate][hreflang]').count()) >= 2, 'hreflang alternates to the same concept in other languages');
ok(await wp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'word page: no horizontal overflow');
for (const p of ['sitemap.xml', 'robots.txt', 'about.html', 'w/', 'og.png', 'offline.html']) {
  const r = await wp.request.get(base + p);
  ok(r.ok(), `${p} → ${r.status()}`);
}
const sm = await (await wp.request.get(base + 'sitemap.xml')).text();
ok((sm.match(/<url>/g) || []).length > 20 && sm.includes(`/w/en/${encodeURIComponent(pop)}/`), `sitemap lists ${(sm.match(/<url>/g) || []).length} URLs`);
const ar = await context.newPage();
watch(ar);
const arWord = wordOfDay('ar').word;
await ar.goto(`${base}w/ar/${encodeURIComponent(arWord)}/`, { waitUntil: 'networkidle' });
ok((await ar.evaluate(() => document.documentElement.dir)) === 'rtl', 'Arabic word page is dir=rtl');
await ar.close();

// ---- 7. analytics ---------------------------------------------------------------------------
ok(await wp.evaluate(() => !document.querySelector('script[data-cf-beacon]')) === !live, live ? 'production: beacon script present on the word page' : 'localhost: no analytics beacon');
if (live) ok(await page.evaluate(() => !!document.querySelector('script[data-cf-beacon]')), 'production: beacon script present in the app');
const loaded = await page.evaluate(async () => {
  const m = await import('./js/analytics.js');
  const added = m.loadAnalytics({ ...m.CF_ANALYTICS, hosts: [location.hostname] });
  const s = document.querySelector('script[data-cf-beacon]');
  await new Promise((r) => { if (window.__beacon) r(); else { s.onload = r; s.onerror = r; setTimeout(r, 4000); } });
  return { added, cfg: s?.getAttribute('data-cf-beacon'), ran: !!window.__beacon, controlled: !!navigator.serviceWorker.controller };
});
ok((loaded.added || live) && JSON.parse(loaded.cfg).token === 'fd0db7a5d3e946f39be6ce44cc1c35dc', `beacon tag carries the token${live ? ' (already injected at load on production)' : ''}: ${loaded.cfg}`);
ok(loaded.ran && loaded.controlled, 'beacon script loads normally while the service worker controls the page (SW does not intercept it)');
await wp.close();

// ---- 8. layout ---------------------------------------------------------------------------------
await page.goto(base, { waitUntil: 'networkidle' });
ok(await G(() => document.documentElement.scrollWidth <= innerWidth + 1), 'app start page: no horizontal overflow');
await page.screenshot({ path: `./phase1-start-${width}.png` });
ok(errors.length === 0, `no console errors/warnings${errors.length ? ': ' + errors.join(' | ') : ''}`);
console.log(fails ? `FAIL ${fails} check(s)` : `PASS phase 1 (${width}×${height})`);
await context.close();
process.exitCode = fails ? 1 : 0;
