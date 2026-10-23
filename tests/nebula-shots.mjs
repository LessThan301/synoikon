// Nebula theme screenshots + basic contrast check. usage: node tests/nebula-shots.mjs [base] [shotsDir]
import { chromium, devices } from 'playwright';
const [B = 'http://localhost:8770/', S = 'shots'] = process.argv.slice(2);
let fail = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fail++; };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const shot = async (url, name, wait = 900) => { await p.goto(B + url); await p.waitForTimeout(wait); if (name) await p.screenshot({ path: `${S}/${name}.png` }); };
await shot('', 'nebula-home');
ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(5, 3, 15)', 'home uses the Nebula background');
await p.goto(B + 'words/#q=river&lang=en'); await p.waitForFunction(() => window.__synoikon?.count().nodes > 1, null, { timeout: 60000 }); await p.waitForTimeout(2500);
await p.screenshot({ path: `${S}/nebula-words.png` });
// map FPS while dragging the view
const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(n / 1.5); }; requestAnimationFrame(f); }));
ok(fps > 30, `word app frame rate ${Math.round(fps)} fps`);
await p.click('#share'); await p.waitForTimeout(1200); await p.screenshot({ path: `${S}/nebula-share.png` }); await p.keyboard.press('Escape');
await shot('impressum/', 'nebula-impressum'); await shot('datenschutz/', 'nebula-datenschutz');
await shot('words/about.html', 'nebula-about'); await shot('words/w/es/agua/', 'nebula-wpage');
await p.goto(B + 'words/#q=' + encodeURIComponent('إله') + '&lang=ar'); await p.waitForFunction(() => window.__synoikon?.count().nodes > 1, null, { timeout: 60000 }); await p.waitForTimeout(2000);
ok(await p.evaluate(() => document.documentElement.dir) === 'rtl', 'Arabic still RTL'); await p.screenshot({ path: `${S}/nebula-rtl-ar.png` });
// WCAG contrast of body/muted text against the page background
const ratio = await p.evaluate(() => {
  const L = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const bg = L('rgb(14,10,38)'); const out = {};
  for (const [k, v] of Object.entries({ ink: '--ink', muted: '--muted', link: '--accent2' })) { const d = document.createElement('div'); d.style.color = `var(${v})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); const l = L(c); out[k] = ((Math.max(l, bg) + .05) / (Math.min(l, bg) + .05)).toFixed(1); }
  return out; });
ok(Object.values(ratio).every((r) => r >= 4.5), 'text contrast ≥ 4.5:1 on panels ' + JSON.stringify(ratio));
ok(!errs.length, 'no page errors ' + errs.join('; '));
const m = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' }); const mp = await m.newPage();
await mp.goto(B); await mp.waitForTimeout(800); await mp.screenshot({ path: `${S}/nebula-mobile.png`, fullPage: true });
ok(await mp.evaluate(() => getComputedStyle(document.body, '::before').animationName) === 'none', 'reduced motion: no star animation');
await mp.goto(B + 'words/#q=river&lang=en'); await mp.waitForFunction(() => window.__synoikon?.count().nodes > 1, null, { timeout: 60000 }); await mp.waitForTimeout(2500);
await mp.screenshot({ path: `${S}/nebula-mobile-words.png` });
await b.close(); console.log(fail ? `${fail} FAILED` : 'all passed'); process.exit(fail ? 1 : 0);
