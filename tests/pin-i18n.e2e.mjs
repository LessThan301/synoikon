// Pinning (Ctrl/⌘+click, long-press) and UI translation. usage: node tests/pin-i18n.e2e.mjs [base] [shotsDir]
import { chromium, devices } from 'playwright';
const [base = 'http://localhost:8765/', shots = ''] = process.argv.slice(2);
let fail = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fail++; };
const b = await chromium.launch();
const ready = (pg) => pg.waitForFunction(() => window.__synoikon?.count().nodes > 1, null, { timeout: 60000 });
async function nodePos(pg, i = 1) { return pg.evaluate((i) => { return window.__synoikon.screenPos(i); }, i); }

// desktop, German UI via browser language, map language English
{
  const ctx = await b.newContext({ viewport: { width: 1300, height: 850 }, locale: 'de-DE' });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(base + '#q=river&lang=en'); await ready(pg); await pg.waitForTimeout(2500);
  ok(await pg.locator('#hSearch').textContent() === 'Suche & Sprache', 'German UI from browser language (heading)');
  ok((await pg.locator('#go').innerText()) === 'Kartieren', 'button translated');
  ok((await pg.locator('#stats').innerText()).includes('Vorkommen von „river“'), 'stats translated');
  const p = await nodePos(pg, 1);
  ok(!!p, 'node position available');
  await pg.mouse.move(p.x, p.y); await pg.waitForTimeout(300);
  const tip = await pg.locator('#tooltip').innerText();
  ok(/× bei river/.test(tip) && tip.includes('Fenstern'), 'hover box translated: ' + tip.split('\n')[1]);
  await pg.keyboard.down('Control'); await pg.mouse.click(p.x, p.y); await pg.keyboard.up('Control'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => window.__synoikon.pinned()) === p.label, 'Ctrl+click pins ' + p.label);
  ok(!(await pg.evaluate(() => location.hash)).includes('q=' + encodeURIComponent(p.label)), 'Ctrl+click does not navigate');
  await pg.mouse.move(20, 400); await pg.waitForTimeout(200);
  ok(await pg.locator('#tooltip.pinned').isVisible(), 'pinned panel stays when the mouse leaves');
  await pg.click('#legendBtn'); await pg.waitForTimeout(200);
  await pg.locator('#topN').fill('20'); await pg.waitForTimeout(1500);
  ok(await pg.locator('#tooltip.pinned').isVisible() && await pg.locator('#legend').isVisible(), 'stays pinned with legend open and slider moved');
  if (shots) await pg.screenshot({ path: `${shots}/anchor-desktop-de.png` });
  await pg.click('#tooltip .tip-x'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => window.__synoikon.pinned()) === null && !(await pg.locator('#tooltip').isVisible()), 'close × unpins');
  // explicit UI language choice
  await pg.selectOption('#uiLang', 'fr'); await pg.waitForTimeout(800);
  ok(await pg.locator('#hSearch').textContent() === 'Recherche et langue', 'UI language selector switches to French');
  if (shots) await pg.screenshot({ path: `${shots}/i18n-desktop-fr.png` });
  await pg.selectOption('#uiLang', 'auto'); await pg.waitForTimeout(500);
  ok(errs.length === 0, 'no page errors ' + errs.join('; '));
  await ctx.close();
}
// map language drives the UI (auto): Hindi, Arabic, Chinese
for (const [code, word] of [['hi', 'नदी'], ['ar', 'نهر'], ['zh', '河流']]) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 850 }, locale: 'en-US' });
  const pg = await ctx.newPage(); await pg.goto(base + `#q=${encodeURIComponent(word)}&lang=${code}`); await ready(pg); await pg.waitForTimeout(2000);
  const h = await pg.locator('#hSearch').textContent();
  ok(h !== 'Search & language', `${code}: UI follows map language (${h})`);
  if (shots && code !== 'hi') await pg.screenshot({ path: `${shots}/i18n-desktop-${code}.png` });
  await ctx.close();
}
// phone: long-press pins
{
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'de-DE' });
  const pg = await ctx.newPage(); await pg.goto(base + '#q=river&lang=en'); await ready(pg); await pg.waitForTimeout(2500);
  const p = await nodePos(pg, 1);
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await pg.waitForTimeout(800);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pg.waitForTimeout(600);
  ok(await pg.evaluate(() => window.__synoikon.pinned()) === p.label, 'long-press pins on touch: ' + p.label);
  ok(!(await pg.evaluate(() => location.hash)).includes('q=' + encodeURIComponent(p.label)), 'long-press does not navigate');
  await pg.click('#legendBtn'); await pg.waitForTimeout(300);
  if (shots) await pg.screenshot({ path: `${shots}/anchor-mobile-de.png` });
  ok(await pg.locator('#tooltip.pinned').isVisible(), 'pinned panel visible with legend open on phone');
  if (shots) { await pg.click('#legendBtn'); await pg.click('#tooltip .tip-x'); await pg.click('#menuBtn'); await pg.waitForTimeout(500); await pg.screenshot({ path: `${shots}/i18n-mobile-de.png` }); }
  await ctx.close();
}
await b.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
