// Headless end-to-end check. Serve the repo root first: python3 -m http.server 8765
// usage: node tests/e2e.mjs [word] [lang] [width] [height] [baseUrl]
import { chromium } from 'playwright';
import fs from 'fs';
const [word = 'river', lang = 'en', width = '1400', height = '900', base = 'http://localhost:8765/'] = process.argv.slice(2);
const mobile = +width < 600;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: +width, height: +height }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 3 : 1, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + r.failure()?.errorText));
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) process.exitCode = 1; };
const G = (fn, arg) => page.evaluate(fn, arg);
// settings live in a sidebar; on phones it is an off-canvas drawer that has to be opened first
const openSettings = async () => { if (mobile) { await page.click('#menuBtn'); await page.waitForTimeout(350); } };
const closeSettings = async () => { if (mobile) { await page.keyboard.press('Escape'); await page.waitForTimeout(350); } };

await page.goto(base, { waitUntil: 'networkidle' });
await page.selectOption('#lang', lang);
await page.fill('#term', word);
const t0 = Date.now();
await page.click('#go');
await page.waitForFunction(() => window.__contexter?.count().nodes > 1, null, { timeout: 45000 });
console.log('graph after', Date.now() - t0, 'ms', JSON.stringify(await G(() => window.__contexter.count())));
ok((await G(() => window.__contexter.count().nodes)) === 31, 'river-type search draws 30 neighbors + target');
ok(await G(() => { const c = document.getElementById('graph'); return c.width > 0 && c.height > 0 && c.width === Math.round(c.getBoundingClientRect().width * Math.min(2, devicePixelRatio)); }), 'canvas backing store matches size × devicePixelRatio (capped at 2)');
await page.screenshot({ path: `./shot-${word}-${width}.png` });

// ranking modes
const distinct = await G(() => window.__contexter.labels());
await openSettings();
await page.click('.seg label:has(input[value=frequency])');
await page.waitForTimeout(600);
const freq = await G(() => window.__contexter.labels());
console.log('DISTINCTIVE:', distinct.join(' '));
console.log('FREQUENCY:  ', freq.join(' '));
ok(freq.join() !== distinct.join(), 'ranking toggle changes the neighbor set');
await page.click('.seg label:has(input[value=distinctive])');
await page.waitForTimeout(600);
await closeSettings();
console.log('table first rows:', (await page.locator('#tableBody tr').evaluateAll((rs) => rs.slice(0, 3).map((r) => [...r.cells].map((c) => c.textContent).join(' ')))).join(' | '));

// wait for the layout to settle (simulation stops itself)
await page.waitForFunction(() => window.__contexter.settled(), null, { timeout: 15000 });
ok(true, 'simulation settles and stops');

// hover (desktop only: touch has no hover)
if (!mobile) {
  const p = await G(() => window.__contexter.screenPos(1));
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(200);
  const tip = await page.locator('.tooltip').innerText();
  ok(!(await page.locator('.tooltip').evaluate((e) => e.classList.contains('hidden'))) && tip.startsWith(p.label), `hover shows tooltip for "${p.label}"`);
  console.log('tooltip:', tip.replace(/\n/g, ' / '));
  await page.screenshot({ path: `./shot-${word}-hover.png` });
  await page.mouse.move(5, 5);
}

// zoom (wheel on desktop, buttons everywhere)
const before = await G(() => window.__contexter.screenPos(1));
await page.click('#zoomIn'); await page.waitForTimeout(400);
const after = await G(() => window.__contexter.screenPos(1));
ok(before.x !== after.x || before.y !== after.y, 'zoom button changes the view');
await page.click('#zoomFit'); await page.waitForTimeout(700);

// pinch zoom (touch only)
if (mobile) {
  const cdp = await context.newCDPSession(page);
  const box = await page.locator('#graph').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height - 80;
  const a = await G(() => [window.__contexter.screenPos(0), window.__contexter.screenPos(1)]);
  const d0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  const pts = (s) => [{ x: cx - s, y: cy, id: 0 }, { x: cx + s, y: cy, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(20) });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(20 + i * 8) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  const b = await G(() => [window.__contexter.screenPos(0), window.__contexter.screenPos(1)]);
  const d1 = Math.hypot(b[0].x - b[1].x, b[0].y - b[1].y);
  ok(d1 > d0 * 1.5, `pinch zooms in (node spacing ${Math.round(d0)} → ${Math.round(d1)} px)`);
  await page.click('#zoomFit'); await page.waitForTimeout(700);
}

// drag a node
{
  const p = await G(() => window.__contexter.screenPos(2));
  if (mobile) {
    // touch drag via CDP touch events
    const cdp = await context.newCDPSession(page);
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await tp('touchStart', p.x, p.y);
    for (let i = 1; i <= 10; i++) await tp('touchMove', p.x + i * 6, p.y + i * 4);
    await tp('touchEnd');
  } else {
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(p.x + i * 6, p.y + i * 4);
    await page.mouse.up();
  }
  await page.waitForTimeout(100);
  const q = await G(() => window.__contexter.screenPos(2));
  ok(Math.hypot(q.x - p.x, q.y - p.y) > 20 && q.label === p.label, `drag moves "${p.label}" (${Math.round(Math.hypot(q.x - p.x, q.y - p.y))}px)`);
}

// slider redraw
await openSettings();
await page.locator('#topN').fill('15');
await closeSettings();
await page.waitForTimeout(500);
ok((await G(() => window.__contexter.count().nodes)) === 16, 'neighbors slider redraws (15 + target)');

// SVG download
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
const svg = fs.readFileSync(await dl.path(), 'utf8');
ok(svg.startsWith('<svg') && (svg.match(/<circle/g) || []).length === 17 && svg.includes('</svg>'), `SVG export (${svg.length} bytes, ${(svg.match(/<line/g) || []).length} lines)`);

// click / tap a node to re-center
await page.waitForTimeout(800);
const c = await G(() => window.__contexter.screenPos(1));
if (mobile) await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y);
await page.waitForFunction((l) => window.__contexter.targetLabel() === l && window.__contexter.count().nodes > 1, c.label, { timeout: 45000 });
ok(true, `${mobile ? 'tap' : 'click'} on "${c.label}" re-centres the map on it`);
ok(await G(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
await page.waitForTimeout(1500);
ok(errors.length === 0, 'no console errors: ' + (errors.join('; ') || 'none'));
await browser.close();
