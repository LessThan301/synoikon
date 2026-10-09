import { chromium } from 'playwright';
const word = process.argv[2] || 'river';
const lang = process.argv[3] || 'en';
const width = +(process.argv[4] || 1400), height = +(process.argv[5] || 900);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + r.failure()?.errorText));
await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' });
await page.selectOption('#lang', lang);
await page.fill('#term', word);
const t0 = Date.now();
await page.click('#go');
await page.waitForSelector('#graph g.node', { timeout: 45000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => ({
  nodes: document.querySelectorAll('#graph g.node').length,
  links: document.querySelectorAll('#graph line.link').length,
  labels: [...document.querySelectorAll('#graph g.node text')].slice(0, 25).map((t) => t.textContent),
  stats: document.getElementById('stats').innerText,
  samples: document.querySelectorAll('#samples li').length,
  hash: location.hash,
}));
console.log('time ms', Date.now() - t0, JSON.stringify(info, null, 1));
await page.screenshot({ path: `./shot-${word}-${width}.png` });
// hover a neighbor, check tooltip + dimming
const nodes = page.locator('#graph g.node:not(.target) circle.body');
await nodes.nth(0).hover({ force: true });
await page.waitForTimeout(300);
console.log('tooltip:', await page.locator('.tooltip').innerText(), '| dimmed:', await page.locator('#graph .dim').count());
await page.screenshot({ path: `./shot-${word}-hover.png` });
// slider change
await page.locator('#topN').fill('15');
await page.waitForTimeout(800);
console.log('nodes after topN=15:', await page.locator('#graph g.node').count());
// click node -> new search
const lbl = await page.locator('#graph g.node:not(.target) text').nth(0).textContent();
await page.locator('#graph g.node:not(.target) circle.body').nth(0).click({ force: true });
await page.waitForFunction((l) => document.querySelector('#term').value === l, lbl, { timeout: 10000 });
await page.waitForSelector('#graph g.node.target', { timeout: 45000 });
await page.waitForTimeout(1500);
console.log('clicked', lbl, '-> target now', await page.locator('#graph g.node.target text').textContent(), 'nodes', await page.locator('#graph g.node').count());
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
