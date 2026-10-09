#!/usr/bin/env node
// Write content hashes into sw.js so a changed app shell / data list gets a new cache.
// usage: node tools/stamp-sw.mjs [--check]   (--check: exit 1 if sw.js is out of date)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const swPath = path.join(ROOT, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8');
const list = JSON.parse('[' + sw.match(/const SHELL_FILES = \[([\s\S]*?)\];/)[1].replace(/'/g, '"').replace(/\bD3\b/, '"D3"').replace(/,\s*$/, '') + ']');
const hash = (files) => {
  const h = crypto.createHash('sha256');
  for (const f of files) h.update(f + '\0' + fs.readFileSync(path.join(ROOT, f)));
  return h.digest('hex').slice(0, 12);
};
const shellFiles = list.filter((f) => f !== 'D3' && f !== './');
const dataFiles = fs.readdirSync(path.join(ROOT, 'data')).filter((f) => /^(stop|freq)-..\.txt$/.test(f)).sort().map((f) => `data/${f}`);
const v = hash(shellFiles), dv = hash(dataFiles);
const out = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${v}';`).replace(/const DATA_VERSION = '[^']*';/, `const DATA_VERSION = '${dv}';`);
if (process.argv.includes('--check')) {
  if (out !== sw) { console.log(`FAIL sw.js stamp is stale (expected ${v}/${dv}); run node tools/stamp-sw.mjs`); process.exit(1); }
  console.log(`PASS sw.js stamp current (${v}/${dv})`);
} else {
  fs.writeFileSync(swPath, out);
  console.log(`sw.js stamped: shell ${v}, data ${dv}`);
}
