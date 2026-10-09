// Old URLs land on the same page of https://synoikon.com:
//  - lessthan301.github.io/contexter/*  (LessThan301/contexter redirect repo: index.html/404.html)
//  - lessthan301.github.io/synoikon/*   (GitHub Pages redirect after setting the custom domain)
//  - www.synoikon.com/*                 (GitHub Pages redirects www to the apex)
// and devices that installed the old Contexter app get its service worker + caches retired.
// usage: node tests/redirect.e2e.mjs [width=1400] [height=900] [scheme=https]
import { chromium } from 'playwright';
const [width = '1400', height = '900', scheme = 'https'] = process.argv.slice(2);
const GH = 'https://lessthan301.github.io';
const NEW = 'synoikon.com';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: +width, height: +height }, isMobile: +width < 600, hasTouch: +width < 600 });
await context.route('**/static.cloudflareinsights.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };
const landed = () => { const u = new URL(page.url()); return { scheme: u.protocol.slice(0, -1), where: u.host + u.pathname + u.search + decodeURIComponent(u.hash) }; };

const WOTD = new RegExp(`^${NEW}/#(wotd&lang=de|q=[^&]+&lang=de)$`); // the app resolves #wotd to today's word
const cases = [
  [`${GH}/contexter/`, `${NEW}/`],
  [`${GH}/contexter`, `${NEW}/`],
  [`${GH}/contexter/w/en/forest/`, `${NEW}/w/en/forest/`],
  [`${GH}/contexter/#q=river&lang=en`, `${NEW}/#q=river&lang=en`],
  [`${GH}/contexter/?source=pwa`, `${NEW}/?source=pwa`],
  [`${GH}/contexter/#wotd&lang=de`, WOTD],
  [`${GH}/contexter/about.html`, `${NEW}/about.html`],
  [`${GH}/synoikon/`, `${NEW}/`],
  [`${GH}/synoikon/w/en/forest/`, `${NEW}/w/en/forest/`],
  [`${GH}/synoikon/#q=river&lang=en`, `${NEW}/#q=river&lang=en`],
  [`${GH}/synoikon/sitemap.xml`, `${NEW}/sitemap.xml`],
  [`${scheme}://www.${NEW}/`, `${NEW}/`],
  [`${scheme}://www.${NEW}/w/en/forest/`, `${NEW}/w/en/forest/`],
  [`http://${NEW}/about.html`, `${NEW}/about.html`],
];
for (const [from, to] of cases) {
  try { await page.goto(from); } catch (e) { ok(false, `${from}: ${e.message.split('\n')[0]}`); continue; }
  await page.waitForURL((u) => u.host === NEW, { timeout: 15000 }).catch(() => {});
  if (to instanceof RegExp) await page.waitForURL((u) => to.test(u.host + u.pathname + decodeURIComponent(u.hash)), { timeout: 15000 }).catch(() => {});
  const { scheme: s, where } = landed();
  ok((typeof to === 'string' ? where === to : to.test(where)) && s === scheme, `${from} → ${s}://${where}`);
}
await page.goto(`${GH}/contexter/w/en/forest/`);
await page.waitForURL((u) => u.host === NEW && u.pathname === '/w/en/forest/');
ok(/forest/.test(await page.title()) && /Synoikon/.test(await page.title()), `old word page link shows the Synoikon page: "${await page.title()}"`);
await page.goto(`${GH}/contexter/#q=river&lang=en`);
await page.waitForFunction(() => window.__synoikon?.count().nodes > 1, null, { timeout: 45000 });
ok(true, 'old #q=river link opens the river map on synoikon.com');

// simulate a device that installed Contexter: old caches + its service worker at /contexter/
await context.route(`${GH}/contexter/old-app.html`, (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><title>old</title><script>
  (async () => { await (await caches.open('contexter-shell-old')).put('/contexter/x', new Response('x')); await caches.open('synoikon-api');
    navigator.serviceWorker.register('./sw.js', { scope: './' }); })();</script>` }));
await context.route(`${GH}/contexter/check.html`, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>check</title>' }));
await page.goto(`${GH}/contexter/old-app.html`);
await page.waitForURL((u) => u.host === NEW, { timeout: 20000 }).catch(() => {});
ok(new URL(page.url()).host === NEW, `kill-switch service worker moves an old app window to synoikon.com (${page.url()})`);
await page.goto(`${GH}/contexter/check.html`);
const left = await page.evaluate(async () => ({ caches: await caches.keys(), regs: (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope) }));
ok(left.caches.filter((k) => /^(contexter|synoikon)-/.test(k)).length === 0 && left.regs.filter((s) => s.includes('/contexter/')).length === 0, `old caches and service worker removed on lessthan301.github.io (${JSON.stringify(left)})`);
ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
console.log(fails ? `FAIL ${fails} check(s)` : `PASS redirects (${width}×${height}, ${scheme})`);
await browser.close();
process.exitCode = fails ? 1 : 0;
