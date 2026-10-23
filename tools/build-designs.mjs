// Design concepts for review: copies the built home page and word app into <out>/design/{a,b,c}/ and layers a theme
// stylesheet on top (design/<x>.css). Preview only: noindex, no service worker, precomputed /w/ pages left out.
// usage: node tools/build-designs.mjs [_site]
import fs from 'fs';
import path from 'path';
const OUT = process.argv[2] || '_site';
const CONCEPTS = { a: 'Broadsheet', b: 'Nebula', c: 'Kontrast' };
const copy = (src, dst, skip = () => false) => {
  if (skip(src)) return;
  if (fs.statSync(src).isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(src)) copy(path.join(src, f), path.join(dst, f), skip); }
  else fs.copyFileSync(src, dst);
};
const bar = (x, rel) => `<nav class="design-bar" aria-label="Design concepts" style="position:fixed;z-index:9999;bottom:12px;right:12px;display:flex;gap:4px;align-items:center;padding:6px 8px;background:#111;color:#fff;font:600 12px/1 system-ui,sans-serif;border-radius:999px;box-shadow:0 4px 16px rgba(0,0,0,.35)">`
  + `<style>.design-bar a{color:#fff!important;font-weight:600!important;text-shadow:none!important}.design-bar a[aria-current]{color:#111!important}</style><span style="padding:0 6px;opacity:.75">Concept ${x.toUpperCase()} · ${CONCEPTS[x]}</span>`
  + Object.keys(CONCEPTS).map((k) => `<a href="${rel}../${k}/${rel.includes('..') ? 'words/' : ''}" ${k === x ? 'aria-current="page" ' : ''}style="background:${k === x ? '#fff' : 'transparent'};text-decoration:none;padding:5px 9px;border-radius:999px;text-shadow:none">${k.toUpperCase()}</a>`).join('')
  + `<a href="${rel}../../${rel.includes('..') ? 'words/' : ''}" style="color:#fff;opacity:.7;text-decoration:none;padding:5px 8px">current</a></nav>`;
const inject = (file, css, rel, x) => {
  let h = fs.readFileSync(file, 'utf8');
  h = h.replace('<head>', '<head>\n  <meta name="robots" content="noindex, nofollow">');
  h = h.replace(/(<link rel="stylesheet"[^>]*>)(?![\s\S]*<link rel="stylesheet")/, `$1\n  <link rel="stylesheet" href="${css}">`);
  h = h.replace(/<link rel="canonical"[^>]*>\s*/g, '');
  h = h.replace('</body>', `${bar(x, rel)}\n</body>`);
  fs.writeFileSync(file, h);
};
for (const x of Object.keys(CONCEPTS)) {
  const d = path.join(OUT, 'design', x);
  fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true });
  for (const f of ['index.html', 'home.css', 'home.js']) fs.copyFileSync(path.join(OUT, f), path.join(d, f));
  copy(path.join(OUT, 'words'), path.join(d, 'words'), (p) => /[/\\]words[/\\](w|sw\.js|og\.png)$/.test(p));
  fs.copyFileSync(path.join('design', `${x}.css`), path.join(d, 'design.css'));
  // home: legal pages and app live one level up
  let home = fs.readFileSync(path.join(d, 'index.html'), 'utf8').replace(/href="(impressum|datenschutz)\/"/g, 'href="../../$1/"');
  fs.writeFileSync(path.join(d, 'index.html'), home);
  inject(path.join(d, 'index.html'), 'design.css', './', x);
  inject(path.join(d, 'words', 'index.html'), '../design.css', '../', x);
  inject(path.join(d, 'words', 'about.html'), '../design.css', '../', x);
}
fs.writeFileSync(path.join(OUT, 'design', 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Synoikon design concepts</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:10vh auto;padding:0 16px}a{display:block;margin:10px 0;font-size:1.2rem}</style>
<h1>Synoikon design concepts (preview)</h1>${Object.entries(CONCEPTS).map(([k, n]) => `<a href="${k}/">${k.toUpperCase()} · ${n}</a> <a href="${k}/words/#q=river&amp;lang=en">↳ word app</a>`).join('')}`);
console.log('design concepts built in', path.join(OUT, 'design'));
