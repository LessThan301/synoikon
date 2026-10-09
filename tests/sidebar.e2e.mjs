// Settings sidebar: desktop rail collapse/expand + canvas refit + persistence, mobile drawer,
// keyboard access, RTL content, no console errors. Serve the repo first: node tools/serve.mjs 8765
// usage: node tests/sidebar.e2e.mjs [baseUrl] [width] [height]
import { chromium } from 'playwright';
const [base = 'http://localhost:8765/contexter/', width = '1400', height = '900'] = process.argv.slice(2);
const mobile = +width < 768;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: +width, height: +height }, isMobile: +width < 600, hasTouch: +width < 600, deviceScaleFactor: 1, serviceWorkers: 'block' });
await context.route('**/static.cloudflareinsights.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/Service Worker registration blocked/.test(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) fails++; };
const G = (fn, arg) => page.evaluate(fn, arg);
const rect = (sel) => G((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right }; }, sel);
const attr = (sel, a) => page.locator(sel).getAttribute(a);
const inSidebar = () => G(() => document.getElementById('sidebar').contains(document.activeElement));
const nodesInside = () => G(() => { const c = document.getElementById('graph').getBoundingClientRect(); const n = window.__contexter.count().nodes; let inside = 0;
  for (let i = 0; i < n; i++) { const p = window.__contexter.screenPos(i); if (p && p.x >= c.left && p.x <= c.right && p.y >= c.top && p.y <= c.bottom) inside++; } return [inside, n]; });

await page.goto(base + '#q=gold&lang=en', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__contexter?.count().nodes > 1 && window.__contexterApp.state().term === 'gold');
await page.waitForTimeout(1500);

// grouped sections, in order, readable type
const heads = await G(() => [...document.querySelectorAll('#sbBody .sb-sec h2')].map((h) => h.textContent.trim()));
ok(heads.join('|') === 'Search & language|Ranking|Network|Sources|Stopwords|Display & export|Results', `grouped sections: ${heads.join(' · ')}`);
const fs = await G(() => parseFloat(getComputedStyle(document.querySelector('#secNetwork .slider')).fontSize));
ok(fs >= 15, `slider labels use readable type (${fs}px)`);

if (!mobile) {
  // ---- desktop: full-height sidebar, open by default, own scroll ----
  const sb = await rect('#sidebar');
  ok(sb.x === 0 && Math.abs(sb.h - +height) <= 1 && sb.w >= 340, `sidebar is open by default and full viewport height (${sb.w}×${sb.h})`);
  const scroll = await G(() => { const b = document.getElementById('sbBody'); return { own: getComputedStyle(b).overflowY, sh: b.scrollHeight, ch: b.clientHeight, page: document.scrollingElement.scrollHeight <= innerHeight }; });
  ok(scroll.own === 'auto' && scroll.page, `settings scroll inside the sidebar (${scroll.ch}px viewport, ${scroll.sh}px content), page itself does not scroll`);
  ok(await page.locator('#term').isVisible() && await G(() => document.getElementById('searchSlotSide').contains(document.getElementById('search'))), 'search form sits in the sidebar while it is expanded');
  ok(await attr('#sbToggle', 'aria-expanded') === 'true', 'toggle button reports aria-expanded="true"');

  // ---- collapse to rail: canvas resizes + refits smoothly ----
  const before = await rect('#graph');
  const frames = await G(() => new Promise((res) => {
    const t = []; let last = performance.now();
    const tick = (now) => { t.push(now - last); last = now; if (t.length < 30) requestAnimationFrame(tick); else res(t); };
    document.getElementById('sbToggle').click(); requestAnimationFrame(tick);
  }));
  const sorted = [...frames].sort((a, b) => a - b), p90 = sorted[Math.floor(sorted.length * 0.9)];
  await page.waitForTimeout(700);
  const after = await rect('#graph');
  const rail = await rect('#sidebar');
  ok(rail.w <= 64 && rail.w >= 48, `collapses to a slim icon rail (${rail.w}px)`);
  ok(after.w - before.w > 250, `graph canvas grows with it (${before.w} → ${after.w}px)`);
  ok(await G(() => { const c = document.getElementById('graph'); return c.width === Math.round(c.getBoundingClientRect().width * Math.min(2, devicePixelRatio)); }), 'canvas backing store resized (ResizeObserver)');
  const [inside, total] = await nodesInside();
  ok(inside === total, `network refitted into the wider canvas (${inside}/${total} nodes visible)`);
  ok(p90 < 50, `collapse animation stays smooth (p90 frame ${p90.toFixed(1)} ms, median ${sorted[15].toFixed(1)} ms)`);
  ok(await attr('#sbToggle', 'aria-expanded') === 'false' && await attr('#sbToggle', 'aria-label') === 'Expand settings', 'toggle now says aria-expanded="false" / "Expand settings"');
  ok(await page.locator('#term').isVisible() && await G(() => document.getElementById('searchSlotTop').contains(document.getElementById('search'))), 'search stays visible (moved to the top bar)');
  ok(await G(() => localStorage.getItem('contexter.sidebar')) === 'collapsed', 'collapsed state saved in localStorage');

  // ---- persistence (applied before first paint) ----
  await page.reload({ waitUntil: 'domcontentloaded' });
  ok(await G(() => document.documentElement.classList.contains('sb-collapsed')), 'collapsed state restored on reload (no flash: set in <head>)');
  await page.waitForFunction(() => window.__contexter?.count().nodes > 1);
  ok((await rect('#sidebar')).w <= 64, 'sidebar still collapsed after reload');

  // ---- rail icon jumps to a section; keyboard toggle ----
  await page.click('.sb-rail button[data-section=secRank]');
  await page.waitForTimeout(500);
  ok((await rect('#sidebar')).w >= 340 && await G(() => document.activeElement?.name === 'rank'), 'rail "Ranking" icon expands the sidebar and focuses the ranking control');
  await page.focus('#sbToggle'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  ok((await rect('#sidebar')).w <= 64, 'toggle works from the keyboard (Enter)');
  await page.keyboard.press('Space'); await page.waitForTimeout(400);
  ok((await rect('#sidebar')).w >= 340 && await G(() => localStorage.getItem('contexter.sidebar')) === 'expanded', 'and back (Space); "expanded" saved');
} else {
  // ---- mobile: off-canvas drawer ----
  const sb = await rect('#sidebar');
  ok(sb.right <= 0 && !(await page.locator('#sidebar').isVisible()), 'drawer is closed (off-canvas) by default');
  ok(await page.locator('#term').isVisible() && await page.locator('#menuBtn').isVisible(), 'search box and settings button visible in the top bar');
  ok(await attr('#menuBtn', 'aria-expanded') === 'false', 'menu button aria-expanded="false"');
  const g0 = await rect('#graph');
  ok(g0.w === +width, `graph uses the full width (${g0.w}px)`);
  await page.click('#menuBtn'); await page.waitForTimeout(400);
  const open = await rect('#sidebar');
  ok(open.x === 0 && open.w <= +width * 0.9 + 1 && Math.abs(open.h - +height) <= 1, `drawer slides in over the graph (${open.w}×${open.h})`);
  ok(await G(() => getComputedStyle(document.getElementById('sbBackdrop')).opacity === '1'), 'backdrop shown');
  ok(await attr('#menuBtn', 'aria-expanded') === 'true' && await attr('#sbToggle', 'aria-label') === 'Close settings', 'aria-expanded="true"; close button labelled');
  ok(await inSidebar(), 'focus moves into the drawer');
  ok((await rect('#graph')).w === g0.w, 'graph is not resized by the drawer (overlay)');
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  ok(await inSidebar(), 'Tab keeps focus inside the open drawer');
  // use a setting inside the drawer
  const before = await G(() => window.__contexter.labels().join());
  await page.click('.seg label:has(input[value=frequency])'); await page.waitForTimeout(400);
  ok(await G(() => window.__contexter.labels().join()) !== before, 'ranking can be changed in the drawer');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok(!(await page.locator('#sidebar').isVisible()) && await G(() => document.activeElement?.id) === 'menuBtn', 'Esc closes the drawer and returns focus to the menu button');
  await page.click('#menuBtn'); await page.waitForTimeout(400);
  await page.mouse.click(+width - 15, +height / 2); await page.waitForTimeout(400);
  ok(!(await page.locator('#sidebar').isVisible()), 'tapping the backdrop closes the drawer');
  await page.click('#menuBtn'); await page.waitForTimeout(400);
  await page.click('#sbToggle'); await page.waitForTimeout(400);
  ok(!(await page.locator('#sidebar').isVisible()), 'close button closes the drawer');
  await page.click('#menuBtn'); await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'networkidle' });
  ok(!(await page.locator('#sidebar').isVisible()), 'drawer starts closed after reload');
}

// ---- RTL content inside the (LTR) sidebar ----
await page.goto(base + '#q=' + encodeURIComponent('ذهب') + '&lang=ar', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__contexter.count().nodes > 1 && window.__contexterApp.state().lang === 'ar');
if (mobile) { await page.click('#menuBtn'); await page.waitForTimeout(400); }
await page.click('#samplesBox summary');
await page.evaluate(() => document.getElementById('samplesBox').scrollIntoView());
await page.waitForTimeout(200);
const rtl = await G(() => {
  const body = document.getElementById('sbBody').getBoundingClientRect();
  const li = document.querySelector('#samples li'); const td = document.querySelector('#tableBody td');
  const lr = li.getBoundingClientRect();
  return { li: getComputedStyle(li).direction, td: getComputedStyle(td).direction, ui: getComputedStyle(document.getElementById('secNetwork')).direction,
    inside: lr.left >= body.left && lr.right <= body.right - 10, sbX: document.getElementById('sidebar').getBoundingClientRect().x };
});
ok(rtl.li === 'rtl' && rtl.td === 'rtl' && rtl.ui === 'ltr' && rtl.sbX === 0, `Arabic: samples/table render RTL inside the LTR settings UI (${JSON.stringify(rtl)})`);
ok(rtl.inside, 'Arabic sample lines (incl. list markers) stay inside the sidebar');
await page.screenshot({ path: `./sidebar-ar-${width}.png` });
ok(await G(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
ok(errors.length === 0, `no console errors/warnings${errors.length ? ': ' + errors.join(' | ') : ''}`);
console.log(fails ? `FAIL ${fails} check(s)` : `PASS sidebar (${width}×${height})`);
await browser.close();
process.exitCode = fails ? 1 : 0;
