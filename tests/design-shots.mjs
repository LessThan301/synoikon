import { chromium, devices } from 'playwright';
const b = await chromium.launch(); const B = 'http://localhost:8770/design/';
for (const x of ['a','b','c']) {
  let c = await b.newContext({ viewport: { width: 1400, height: 900 } }); let p = await c.newPage(); const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto(B + x + '/'); await p.waitForTimeout(800); await p.screenshot({ path: `shots/design-${x}-home.png` });
  await p.goto(B + x + '/words/#q=river&lang=en'); await p.waitForFunction(() => window.__synoikon?.count().nodes > 1, null, { timeout: 60000 }); await p.waitForTimeout(3000);
  await p.screenshot({ path: `shots/design-${x}-words.png` }); console.log(x, 'errors', errs); await c.close();
  c = await b.newContext({ ...devices['iPhone 13'] }); p = await c.newPage();
  await p.goto(B + x + '/'); await p.waitForTimeout(800); await p.screenshot({ path: `shots/design-${x}-mobile.png`, fullPage: true });
  await p.goto(B + x + '/words/#q=river&lang=en'); await p.waitForFunction(() => window.__synoikon?.count().nodes > 1, null, { timeout: 60000 }); await p.waitForTimeout(3000);
  await p.screenshot({ path: `shots/design-${x}-mobile-words.png` }); await c.close();
}
await b.close();
