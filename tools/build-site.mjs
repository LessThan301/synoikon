#!/usr/bin/env node
// Build a deployable copy of the site for a given public URL.
//   preview:     node tools/build-site.mjs --out _site --site https://lessthan301.github.io/synoikon-preview/ --preview
//   production:  node tools/build-site.mjs --out _site --site https://synoikon.com/
// The source (this branch) is written for production at the domain root (https://synoikon.com/).
// For another URL it rewrites absolute URLs and root paths (canonical/OG/hreflang/JSON-LD, sitemap, robots,
// offline page, manifest id). The app itself uses relative URLs, and the service-worker scope follows sw.js.
// --preview additionally: analytics off, <meta name="robots" content="noindex,nofollow"> on every page,
// robots.txt "Disallow: /", a "Preview" badge, separate cache names, no CNAME (no custom domain).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', '_site'));
const SITE = arg('site', 'https://synoikon.com/');
const PREVIEW = process.argv.includes('--preview');
const PROD_SITE = 'https://synoikon.com/';
if (!/^https:\/\/[^/]+\/(.+\/)?$/.test(SITE)) throw new Error(`--site must be an https URL ending in "/": ${SITE}`);
const BASE = new URL(SITE).pathname; // "/" or "/synoikon-preview/"
const INCLUDE = ['index.html', 'about.html', 'offline.html', 'manifest.webmanifest', 'sw.js', 'robots.txt', 'sitemap.xml', 'og.png', 'css', 'js', 'icons', 'data', 'w'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of INCLUDE) fs.cpSync(path.join(ROOT, f), path.join(OUT, f), { recursive: true });
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
if (new URL(SITE).host === new URL(PROD_SITE).host) fs.copyFileSync(path.join(ROOT, 'CNAME'), path.join(OUT, 'CNAME'));

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const edit = (file, fn) => { const s = fs.readFileSync(file, 'utf8'); const t = fn(s); if (t !== s) fs.writeFileSync(file, t); };
const out = (f) => path.join(OUT, f);

const BADGE_CSS = '\n/* preview build */\n.preview-badge { position: fixed; right: 10px; bottom: 10px; z-index: 100; pointer-events: none; font: 700 11px/1 system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #1b1300; background: #f2b134; border-radius: 999px; padding: 6px 10px; box-shadow: 0 2px 8px rgba(0,0,0,.35); }\n';
const BADGE = '<div class="preview-badge" role="note" aria-label="Preview build">Preview</div>';
let pages = 0;
for (const file of walk(OUT)) {
  const ext = path.extname(file);
  if (!['.html', '.xml', '.txt', '.webmanifest'].includes(ext)) continue;
  edit(file, (s) => {
    if (SITE !== PROD_SITE) s = s.split(PROD_SITE).join(SITE);
    if (ext === '.html') {
      pages++;
      if (BASE !== '/') s = s.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}`); // root-absolute paths (offline page)
      if (PREVIEW) {
        s = s.replace(/\s*<meta name="robots" content="[^"]*">/g, '');
        s = s.replace(/<meta charset="utf-8">/i, (m) => `${m}\n  <meta name="robots" content="noindex,nofollow">`);
        s = s.replace('</body>', `  ${BADGE}\n</body>`);
      }
    }
    return s;
  });
}
edit(out('manifest.webmanifest'), (s) => s.replace('"id": "/",', `"id": "${BASE}",`));
if (PREVIEW) {
  fs.writeFileSync(out('robots.txt'), 'User-agent: *\nDisallow: /\n');
  edit(out('js/analytics.js'), (s) => s.replace(/token: '[0-9a-f]+'/, "token: ''"));
  for (const css of ['css/style.css', 'css/page.css']) fs.appendFileSync(out(css), BADGE_CSS);
  // own cache names, so the production app and the old Contexter clean-up worker never touch them
  edit(out('sw.js'), (s) => s.replace(/(['`])synoikon-/g, '$1synoikon-preview-').replace("k.startsWith('contexter-')", "k.startsWith('contexter-') || /^synoikon-(shell|data|precomputed|api|pages|fonts)/.test(k)"));
  edit(out('manifest.webmanifest'), (s) => s.replace('"name": "Synoikon"', '"name": "Synoikon (preview)"').replace('"short_name": "Synoikon"', '"short_name": "Syn preview"'));
}
// sanity checks
const leftovers = walk(OUT).filter((f) => /\.(html|xml|txt|webmanifest)$/.test(f) && SITE !== PROD_SITE && fs.readFileSync(f, 'utf8').includes(PROD_SITE));
if (leftovers.length) throw new Error(`production URL left in ${leftovers.length} files, e.g. ${leftovers[0]}`);
if (PREVIEW && /token: '[0-9a-f]+'/.test(fs.readFileSync(out('js/analytics.js'), 'utf8'))) throw new Error('analytics token still set in preview');
console.log(execFileSync(process.execPath, [path.join(ROOT, 'tools/stamp-sw.mjs'), '--root', OUT]).toString().trim());
console.log(`built ${PREVIEW ? 'PREVIEW' : 'production'} site for ${SITE} in ${path.relative(process.cwd(), OUT) || OUT}: ${pages} pages, ${walk(OUT).length} files`);
