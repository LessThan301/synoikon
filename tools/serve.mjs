#!/usr/bin/env node
// Static server for the repo at the site root (like GitHub Pages with the synoikon.com custom domain), for tests and builds.
// usage: node tools/serve.mjs [port]
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.md': 'text/markdown; charset=utf-8' };
export function serve(port = 8765, base = '/') {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (base !== '/' && p === base.slice(0, -1)) { res.writeHead(301, { Location: base }); res.end(); return; }
    if (!p.startsWith(base)) { res.writeHead(404); res.end('not found'); return; }
    p = path.join(ROOT, p.slice(base.length));
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = +(process.argv[2] || 8765);
  await serve(port);
  console.log(`serving ${ROOT} at http://localhost:${port}/`);
}
