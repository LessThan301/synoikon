// RTL layout (ar, ur) and translation of the rarely seen screens. usage: node tests/rtl-i18n.e2e.mjs [base] [shotsDir]
import { chromium } from 'playwright';
const [base = 'http://localhost:8765/', shots = ''] = process.argv.slice(2);
let fail = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fail++; };
const b = await chromium.launch();
const ready = (pg) => pg.waitForFunction(() => window.__synoikon?.count().nodes > 1, null, { timeout: 60000 });
const box = (pg, sel) => pg.locator(sel).first().boundingBox();

for (const [code, word, heading] of [['ar', 'إله', 'البحث واللغة'], ['ur', 'تاریخ', '']]) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 850 }, locale: code });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(base + `#q=${encodeURIComponent(word)}&lang=${code}`); await ready(pg); await pg.waitForTimeout(2500);
  ok(await pg.evaluate(() => document.documentElement.dir) === 'rtl', `${code}: html dir=rtl`);
  if (heading) ok((await pg.locator('#hSearch').textContent()).trim() === heading, `${code}: sidebar heading translated`);
  const sb = await box(pg, '.sidebar'), gr = await box(pg, '#graph'), tools = await box(pg, '.graph-tools');
  ok(sb.x > gr.x, `${code}: sidebar on the right (sidebar x ${Math.round(sb.x)} > graph x ${Math.round(gr.x)})`);
  ok(tools.x + tools.width > gr.x + gr.width - 80, `${code}: icon bar at the top right of the map`);
  ok(await pg.evaluate(() => getComputedStyle(document.getElementById('graph')).direction) === 'ltr', `${code}: map canvas stays LTR`);
  ok(await pg.evaluate(() => getComputedStyle(document.querySelector('.sidebar h2')).textAlign) !== 'left', `${code}: sidebar text not left-aligned`);
  // pin a panel: it goes to the left side, away from the icon bar
  const p = await pg.evaluate(() => window.__synoikon.screenPos(1));
  await pg.keyboard.down('Control'); await pg.mouse.click(p.x, p.y); await pg.keyboard.up('Control'); await pg.waitForTimeout(400);
  const pin = await box(pg, '.pins .tooltip.pinned');
  ok(pin && pin.x < gr.x + gr.width / 2, `${code}: pinned panel on the left`);
  await pg.click('#legendBtn'); await pg.waitForTimeout(300);
  ok(await pg.locator('#legend').isVisible(), `${code}: legend opens`);
  if (shots) await pg.screenshot({ path: `${shots}/rtl-${code}.png` });
  ok(!errs.length, `${code}: no page errors ${errs.join('; ')}`);
  await ctx.close();
}

// share dialog in French
{
  const ctx = await b.newContext({ viewport: { width: 1300, height: 850 }, locale: 'fr-FR' });
  const pg = await ctx.newPage();
  await pg.goto(base + '#q=river&lang=en'); await ready(pg); await pg.waitForTimeout(2000);
  await pg.click('#share'); await pg.waitForTimeout(1200);
  ok((await pg.locator('#shareTitle').textContent()).trim() === 'Partager cette carte', 'share dialog title in French');
  ok((await pg.locator('#shareImage').textContent()).trim() === 'Partager l’image…', 'share button in French');
  ok(await pg.locator('#shareUrl').getAttribute('aria-label') === 'Lien partageable', 'share link label in French');
  if (shots) await pg.screenshot({ path: `${shots}/i18n-share-fr.png` });
  await ctx.close();
}

// About page in German
{
  const ctx = await b.newContext({ viewport: { width: 1100, height: 1300 }, locale: 'de-DE' });
  const pg = await ctx.newPage();
  await pg.goto(base + 'about.html'); await pg.waitForTimeout(1200);
  ok((await pg.locator('h1').textContent()).trim() === 'Über Synoikon', 'About h1 in German');
  ok((await pg.locator('[data-i18n="@about.p1"]').textContent()).startsWith('Gib ein Wort ein'), 'About block HTML in German');
  ok((await pg.title()).startsWith('Über & Quellen'), 'About title in German');
  if (shots) await pg.screenshot({ path: `${shots}/i18n-about-de.png` });
  await pg.goto(base + 'about.html'); await ctx.close();
  const c2 = await b.newContext({ locale: 'ar' }); const p2 = await c2.newPage();
  await p2.goto(base + 'about.html'); await p2.waitForTimeout(1000);
  ok(await p2.evaluate(() => document.documentElement.dir) === 'rtl', 'About page RTL in Arabic');
  await c2.close();
}

// precomputed word page in Spanish, Arabic
{
  const ctx = await b.newContext({ viewport: { width: 1100, height: 1400 } });
  const pg = await ctx.newPage();
  await pg.goto(base + 'w/es/agua/');
  ok(await pg.evaluate(() => document.documentElement.lang) === 'es', '/w/es page lang=es');
  ok((await pg.locator('.btn').first().textContent()).includes('Abrir el mapa interactivo'), '/w/es chrome in Spanish');
  ok(await pg.locator('link[rel=alternate][hreflang]').count() > 1, '/w/es has hreflang alternates');
  if (shots) await pg.screenshot({ path: `${shots}/i18n-wpage-es.png` });
  await pg.goto(base + 'w/ar/' + encodeURIComponent('إله') + '/');
  ok(await pg.evaluate(() => document.documentElement.dir) === 'rtl' && await pg.locator('header.top[dir=ltr]').count() === 0, '/w/ar page fully RTL');
  ok((await pg.locator('h2').first().textContent()).includes('الجيران'), '/w/ar headings in Arabic');
  await ctx.close();
}
await b.close();
console.log(fail ? `${fail} FAILED` : 'all passed'); process.exit(fail ? 1 : 0);
