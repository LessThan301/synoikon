// Old Contexter URLs (LessThan301/contexter redirect repo) land on the same page of Synoikon,
// and devices that installed the old app get its service worker + caches cleaned up.
// usage: node tests/redirect.e2e.mjs [width=1400] [height=900]
import { chromium } from 'playwright';
const [width = '1400', height = '900'] = process.argv.slice(2);
const HOST = 'https://lessthan301.github.io';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: +width, height: +height }, isMobile: +width < 600, hasTouch: +width < 600 });
await context.route('**/static.cloudflareinsights.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };

const cases = [
  ['/contexter/', '/synoikon/'],
  ['/contexter', '/synoikon/'],
  ['/contexter/w/en/forest/', '/synoikon/w/en/forest/'],
  ['/contexter/#q=river&lang=en', '/synoikon/#q=river&lang=en'],
  ['/contexter/?source=pwa', '/synoikon/?source=pwa'],
  ['/contexter/#wotd&lang=de', /^\/synoikon\/#(wotd&lang=de|q=[^&]+&lang=de)$/], // the app resolves #wotd to today's word
  ['/contexter/about.html', '/synoikon/about.html'],
  ['/contexter/sitemap.xml', '/synoikon/sitemap.xml'],
];
for (const [from, to] of cases) {
  await page.goto(HOST + from);
  await page.waitForURL((u) => u.pathname.startsWith('/synoikon'), { timeout: 15000 }).catch(() => {});
  const u = new URL(page.url());
  const got = u.pathname + u.search + decodeURIComponent(u.hash);
  ok(typeof to === 'string' ? got === to : to.test(got), `${from} → ${got}`);
}
await page.goto(HOST + '/contexter/w/en/forest/');
await page.waitForURL('**/synoikon/w/en/forest/');
ok(/forest/.test(await page.title()) && /Synoikon/.test(await page.title()), `old word page link shows the Synoikon page: "${await page.title()}"`);
await page.goto(HOST + '/contexter/#q=river&lang=en');
await page.waitForFunction(() => window.__synoikon?.count().nodes > 1, null, { timeout: 45000 });
ok(true, 'old #q=river link opens the river map in Synoikon');

// simulate a device that installed Contexter: old caches + its service worker at /contexter/
await page.goto(HOST + '/synoikon/about.html');
await page.evaluate(async () => { await (await caches.open('contexter-shell-old')).put('/contexter/x', new Response('x')); await caches.open('contexter-api'); });
await context.route(HOST + '/contexter/old-app.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>old</title><script>navigator.serviceWorker.register("./sw.js", { scope: "./" })</script>' }));
await page.goto(HOST + '/contexter/old-app.html');
await page.waitForURL('**/synoikon/**', { timeout: 20000 }).catch(() => {});
ok(new URL(page.url()).pathname.startsWith('/synoikon/'), `kill-switch service worker moves an old app window to Synoikon (${page.url()})`);
await page.waitForTimeout(1000);
const left = await page.evaluate(async () => ({ caches: (await caches.keys()).filter((k) => k.startsWith('contexter-')), regs: (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope).filter((s) => s.includes('/contexter/')) }));
ok(left.caches.length === 0 && left.regs.length === 0, `old caches and service worker removed (${JSON.stringify(left)})`);
ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
console.log(fails ? `FAIL ${fails} check(s)` : `PASS redirects (${width}×${height})`);
await browser.close();
process.exitCode = fails ? 1 : 0;
