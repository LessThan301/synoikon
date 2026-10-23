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
  ok((await pg.evaluate(() => window.__synoikon.pinned()))[0] === p.label, 'Ctrl+click pins ' + p.label);
  ok(!(await pg.evaluate(() => location.hash)).includes('q=' + encodeURIComponent(p.label)), 'Ctrl+click does not navigate');
  await pg.mouse.move(20, 400); await pg.waitForTimeout(200);
  ok(await pg.locator('.pins .tooltip.pinned').first().isVisible(), 'pinned panel stays when the mouse leaves');
  await pg.click('#legendBtn'); await pg.waitForTimeout(200);
  await pg.locator('#topN').fill('20'); await pg.waitForTimeout(1500);
  ok(await pg.locator('.pins .tooltip.pinned').first().isVisible() && await pg.locator('#legend').isVisible(), 'stays pinned with legend open and slider moved');
  if (shots) await pg.screenshot({ path: `${shots}/anchor-desktop-de.png` });
  await pg.click('.pins .tip-x'); await pg.waitForTimeout(200);
  ok((await pg.evaluate(() => window.__synoikon.pinned())).length === 0 && !(await pg.locator('#tooltip').isVisible()), 'close × unpins');
  // comparison: up to 3 panels in total (pinned + hover)
  await pg.click('#legendBtn'); await pg.waitForTimeout(200);
  const P = []; for (let i = 1; i <= 4; i++) P.push(await nodePos(pg, i));
  const ctrlClick = async (q) => { await pg.keyboard.down('Control'); await pg.mouse.click(q.x, q.y); await pg.keyboard.up('Control'); await pg.waitForTimeout(250); };
  const pinsNow = () => pg.evaluate(() => window.__synoikon.pinned());
  await ctrlClick(P[0]); await pg.mouse.move(P[1].x, P[1].y); await pg.waitForTimeout(300);
  ok((await pinsNow()).length === 1 && await pg.locator('#tooltip').isVisible(), 'hover panel shows next to 1 pinned panel');
  await ctrlClick(P[1]); await ctrlClick(P[2]);
  ok((await pinsNow()).length === 3 && await pg.locator('.pins .tooltip.pinned').count() === 3, '3 panels pinned');
  await pg.mouse.move(P[3].x, P[3].y); await pg.waitForTimeout(300);
  ok(!(await pg.locator('#tooltip').isVisible()), 'with 3 pinned, hovering a 4th shows no extra panel');
  await ctrlClick(P[3]);
  const noteTxt = await pg.locator('.pin-note').innerText();
  ok((await pinsNow()).length === 3 && /3/.test(noteTxt), '4th pin refused with note: ' + noteTxt);
  if (shots) await pg.screenshot({ path: `${shots}/compare-desktop.png` });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150); // closes legend first
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  ok((await pinsNow()).length === 0, 'Esc unpins all');
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
  ok((await pg.evaluate(() => window.__synoikon.pinned()))[0] === p.label, 'long-press pins on touch: ' + p.label);
  ok(!(await pg.evaluate(() => location.hash)).includes('q=' + encodeURIComponent(p.label)), 'long-press does not navigate');
  const p2 = await nodePos(pg, 2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p2.x, y: p2.y }] }); await pg.waitForTimeout(800);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await pg.waitForTimeout(500);
  ok((await pg.evaluate(() => window.__synoikon.pinned())).length === 2, 'second long-press pins a 2nd panel');
  await pg.click('#legendBtn'); await pg.waitForTimeout(300);
  const lb = await pg.locator('#legend').boundingBox(), pb = await pg.locator('.pins').boundingBox();
  ok(lb.y + lb.height <= pb.y + 1, `legend and pinned panels do not overlap on phone (${Math.round(lb.y + lb.height)} <= ${Math.round(pb.y)})`);
  if (shots) { await pg.screenshot({ path: `${shots}/compare-mobile.png` }); await pg.screenshot({ path: `${shots}/anchor-mobile-de.png` }); }
  ok(await pg.locator('.pins .tooltip.pinned').first().isVisible(), 'pinned panel visible with legend open on phone');
  if (shots) { await pg.click('#legendBtn'); await pg.keyboard.press('Escape'); await pg.keyboard.press('Escape'); await pg.click('#menuBtn'); await pg.waitForTimeout(500); await pg.screenshot({ path: `${shots}/i18n-mobile-de.png` }); }
  await ctx.close();
}
await b.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
