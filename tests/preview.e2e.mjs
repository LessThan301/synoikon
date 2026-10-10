// Preview build checks (LessThan301/synoikon-preview): noindex everywhere, robots.txt disallows all,
// "Preview" badge, no analytics requests, installable PWA under the subpath, app + word pages work,
// no console errors. usage: node tests/preview.e2e.mjs [base=https://lessthan301.github.io/synoikon-preview/] [width] [height]
import { chromium } from 'playwright';
const [base = 'https://lessthan301.github.io/synoikon-preview/', width = '1400', height = '900'] = process.argv.slice(2);
const SITE = process.env.PREVIEW_SITE || 'https://lessthan301.github.io/synoikon-preview/'; // public URL the build was made for
const mobile = +width < 600;
const ctx = await chromium.launchPersistentContext('', { viewport: { width: +width, height: +height }, isMobile: mobile, hasTouch: mobile });
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [], analytics = [], external = new Set();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(e.message));
ctx.on('request', (r) => { const u = new URL(r.url()); if (/cloudflareinsights/.test(u.host)) analytics.push(r.url()); if (!r.url().startsWith(new URL(base).origin)) external.add(u.host); });
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };
const G = (fn, a) => page.evaluate(fn, a);
const robotsMeta = () => G(() => document.querySelector('meta[name=robots]')?.content);

await page.goto(base, { waitUntil: 'networkidle' });
ok(await robotsMeta() === 'noindex,nofollow', 'app: <meta name="robots" content="noindex,nofollow">');
ok(await page.locator('.preview-badge').isVisible() && (await page.locator('.preview-badge').innerText()).trim().toLowerCase() === 'preview', 'app: "Preview" badge visible');
const canon = await G(() => document.querySelector('link[rel=canonical]').href);
ok(canon === SITE, `canonical points at the preview (${canon})`);
// installable under the subpath
await page.reload({ waitUntil: 'networkidle' });
const cdp = await ctx.newCDPSession(page);
const man = await cdp.send('Page.getAppManifest');
const manifest = JSON.parse(man.data || '{}');
ok(new URL(manifest.scope, man.url).href === base && new URL(manifest.start_url, man.url).href.startsWith(base) && /preview/i.test(manifest.name), `manifest "${manifest.name}", scope/start_url inside ${new URL(base).pathname}`);
let inst = await cdp.send('Page.getInstallabilityErrors');
for (let i = 0; i < 10 && inst.installabilityErrors.length; i++) { await page.waitForTimeout(500); inst = await cdp.send('Page.getInstallabilityErrors'); }
ok(inst.installabilityErrors.length === 0, `installable: ${JSON.stringify(inst.installabilityErrors)}`);
const sw = await G(async () => { const r = await navigator.serviceWorker.getRegistration(); return { scope: r?.scope, caches: await caches.keys() }; });
ok(sw.scope === base && sw.caches.every((k) => k.startsWith('synoikon-preview-')), `service worker scope ${sw.scope}, caches ${JSON.stringify(sw.caches)}`);
// the app works on precomputed data
await page.goto(base + '#q=gold&lang=en', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__synoikon?.count().nodes > 1 && window.__synoikonApp.state().precomputed, null, { timeout: 30000 });
ok(true, 'gold loads from precomputed data');
// word page + about + robots.txt
for (const p of ['w/en/forest/', 'about.html', 'w/', 'offline.html']) {
  const r = await page.goto(base + p, { waitUntil: 'networkidle' });
  ok(r.status() === 200 && await robotsMeta() === 'noindex,nofollow' && await page.locator('.preview-badge').isVisible(), `${p}: 200, noindex,nofollow, badge`);
}
ok(await page.locator('link[rel=stylesheet]').evaluateAll((ls) => ls.every((l) => l.sheet)), 'offline page styles load from the subpath');
await page.goto(base + 'w/en/forest/');
const c2 = await G(() => document.querySelector('link[rel=canonical]').href);
ok(c2 === SITE + 'w/en/forest/', `word page canonical ${c2}`);
const robots = await (await ctx.request.get(base + 'robots.txt')).text();
ok(/User-agent: \*\s+Disallow: \/\s*$/.test(robots), `robots.txt disallows all: ${JSON.stringify(robots)}`);
const sitemap = await (await ctx.request.get(base + 'sitemap.xml')).text();
ok(!sitemap.includes('https://synoikon.com/') && sitemap.includes(SITE), 'sitemap uses preview URLs');
ok(analytics.length === 0 && await G(() => !document.querySelector('script[data-cf-beacon]')), `no analytics requests (${analytics.length})`);
console.log('other hosts contacted:', [...external].join(', ') || 'none');
ok(errors.length === 0, `no console errors/warnings${errors.length ? ': ' + errors.join(' | ') : ''}`);
console.log(fails ? `FAIL ${fails} check(s)` : `PASS preview (${width}×${height})`);
await ctx.close(); process.exitCode = fails ? 1 : 0;
