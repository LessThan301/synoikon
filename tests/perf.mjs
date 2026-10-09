// Frame-time profile under 4x CPU throttling with a heavy graph (80 neighbors, ±15 window).
// usage: node tests/perf.mjs [baseUrl] [width] [height]   (GPU=1 env: SwiftShader GPU raster path)
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:8765/';
const W = +(process.argv[3] || 1400), H = +(process.argv[4] || 900);
const browser = await chromium.launch({ args: process.env.GPU ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : [] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: W < 500 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url + '#q=river&lang=en');
await page.waitForSelector('#topN');
// heavy settings
await page.evaluate(() => {
  const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); };
  set('topN', 80); set('window', 15); set('minCooc', 1); set('maxLinks', 20);
});
await page.waitForFunction(() => document.querySelector('#stats p')?.textContent.includes('top 80'), null, { timeout: 60000 });
await page.waitForTimeout(5000);
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (window.__rec) window.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: false }); });
const startRec = () => page.evaluate(() => { window.__f = []; window.__lt = []; window.__rec = true; const loop = (t) => { if (!window.__rec) return; window.__f.push(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
const stopRec = () => page.evaluate(() => { window.__rec = false; const f = window.__f; const d = f.slice(1).map((t, i) => t - f[i]).filter((x) => x > 1); d.sort((a, b) => a - b); const lt = window.__lt;
  const sum = d.reduce((a, b) => a + b, 0); return { frames: d.length, fps: +(1000 * d.length / sum).toFixed(1), p50: +d[Math.floor(d.length * .5)].toFixed(1), p95: +d[Math.floor(d.length * .95)].toFixed(1), max: +d[d.length - 1].toFixed(1), long: d.filter((x) => x > 50).length, longTasks: lt.length, blockingMs: Math.round(lt.reduce((a, b) => a + Math.max(0, b - 50), 0)) }; });
const res = {};
const box = await page.locator('#graph').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
// 1. simulation: re-run analysis (slider) and measure the settle animation
await startRec();
await page.evaluate(() => { const el = document.getElementById('window'); el.value = 14; el.dispatchEvent(new Event('input')); });
await page.waitForTimeout(4000);
res.simulation = await stopRec(); 
// 2. zoom via wheel
await page.mouse.move(cx, cy);
await startRec();
for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, i < 15 ? -60 : 60); await page.waitForTimeout(50); }
await page.waitForTimeout(500);
res.zoom = await stopRec();
// 3. pan by dragging background
await startRec();
await page.mouse.move(box.x + 30, box.y + box.height - 60); await page.mouse.down();
for (let i = 0; i < 40; i++) { await page.mouse.move(box.x + 30 + i * 5, box.y + box.height - 60 - i * 2); await page.waitForTimeout(16); }
await page.mouse.up(); await page.waitForTimeout(300);
res.pan = await stopRec();
// find a non-target node position (works for svg or canvas via exposed hook)
const pos = await page.evaluate(() => window.__synoikon ? window.__synoikon.screenPos(1) : (() => { const c = document.querySelectorAll('#graph g.node:not(.target) circle.body')[0].getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; })());
// 4. drag a node
await startRec();
await page.mouse.move(pos.x, pos.y); await page.mouse.down();
for (let i = 0; i < 60; i++) { await page.mouse.move(pos.x + Math.sin(i / 6) * 120, pos.y + Math.cos(i / 6) * 80); await page.waitForTimeout(16); }
await page.mouse.up(); await page.waitForTimeout(1500);
res.drag = await stopRec();
// 5. hover sweep across graph
await startRec();
for (let i = 0; i < 80; i++) { await page.mouse.move(box.x + 60 + (i / 80) * (box.width - 120), cy + Math.sin(i / 4) * 150); await page.waitForTimeout(16); }
await page.waitForTimeout(300);
res.hover = await stopRec();
const tipVisible = await page.evaluate(() => !document.querySelector('.tooltip').classList.contains('hidden') || window.__sawTip);
console.log(JSON.stringify({ W, res, nodes: await page.evaluate(() => document.querySelector('#stats p')?.textContent.match(/(\d+) neighbor–neighbor/)?.[1]), errors }, null, 0));
await browser.close();
