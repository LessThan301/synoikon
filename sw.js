// Synoikon service worker.
// VERSION / DATA_VERSION are content hashes written by tools/stamp-sw.mjs; when any app-shell
// file (or data list) changes, the cache name changes and old caches are deleted on activate.
const VERSION = '6f298b356b6c';
const DATA_VERSION = 'f737ac5bcc52';
const SHELL = `synoikon-shell-${VERSION}`;
const DATA = `synoikon-data-${DATA_VERSION}`;       // stopword + background frequency lists (per language, on demand)
const PRE = 'synoikon-precomputed';                   // precomputed networks: stale-while-revalidate
const API = 'synoikon-api';                           // recent search results (Wikimedia/HN): stale-while-revalidate
const PAGES = 'synoikon-pages';                       // visited static word pages
const FONTS = 'synoikon-fonts';                       // Fontsource CSS + woff2 from jsDelivr
const LIMITS = { [PRE]: 250, [API]: 160, [PAGES]: 60, [FONTS]: 60 };
const D3 = 'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js';
const SHELL_FILES = [
  './', 'index.html', 'about.html', 'offline.html', 'manifest.webmanifest',
  'css/style.css', 'css/page.css',
  'js/app.js', 'js/analysis.js', 'js/graph.js', 'js/languages.js', 'js/reference.js', 'js/sources.js', 'js/stopwords.js',
  'js/words.js', 'js/precomputed.js', 'js/card.js', 'js/pwa.js', 'js/analytics.js', 'js/sidebar.js', 'js/legend.js',
  'icons/favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
  D3,
];
const SCOPE = new URL('./', self.location).href;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES.map((u) => new Request(new URL(u, SCOPE), { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if ((k.startsWith('synoikon-shell-') && k !== SHELL) || (k.startsWith('synoikon-data-') && k !== DATA) || k.startsWith('contexter-')) await caches.delete(k); // contexter-*: caches of the app's former name/path
    }
    await self.clients.claim();
  })());
});

async function trim(name) {
  const max = LIMITS[name];
  if (!max) return;
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]); // oldest first
}
async function put(name, req, res) {
  const c = await caches.open(name);
  await c.delete(req, { ignoreVary: true }); // re-insert = most recent (keys() is insertion-ordered)
  await c.put(req, res);
  await trim(name);
}
async function cacheFirst(name, req) {
  const hit = await caches.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) put(name, req, res.clone());
  return res;
}
async function staleWhileRevalidate(name, req, event) {
  const c = await caches.open(name);
  const hit = await c.match(req, { ignoreVary: true });
  const fresh = fetch(req).then(async (res) => { if (res.ok) await put(name, req, res.clone()); return res; });
  if (hit) { event.waitUntil(fresh.catch(() => {})); return hit; }
  return fresh;
}
async function navigate(req, event) {
  try {
    const res = await fetch(req);
    if (res.ok && new URL(req.url).pathname.includes('/w/')) event.waitUntil(put(PAGES, req, res.clone()));
    return res;
  } catch {
    const hit = await caches.match(req, { ignoreSearch: true, ignoreVary: true })
      || (new URL(req.url).pathname === new URL(SCOPE).pathname && await caches.match(new URL('./', SCOPE).href));
    return hit || caches.match(new URL('offline.html', SCOPE).href);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // e.g. the analytics beacon POST: untouched
  const url = new URL(req.url);
  if (url.hostname.endsWith('cloudflareinsights.com')) return; // never intercept analytics
  if (req.mode === 'navigate' && req.url.startsWith(SCOPE)) { event.respondWith(navigate(req, event)); return; }
  if (req.url.startsWith(SCOPE)) {
    const path = url.pathname.slice(new URL(SCOPE).pathname.length);
    if (path.startsWith('data/precomputed/')) event.respondWith(staleWhileRevalidate(PRE, req, event));
    else if (/^data\/(stop|freq)-[a-z]{2}\.txt$/.test(path)) event.respondWith(cacheFirst(DATA, req));
    else if (SHELL_FILES.includes(path) || path === '') event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }
  if (/\.(wikipedia|wikiquote|wiktionary)\.org$/.test(url.hostname) && url.pathname.endsWith('/api.php')) { event.respondWith(staleWhileRevalidate(API, req, event)); return; }
  if (url.hostname === 'hn.algolia.com') { event.respondWith(staleWhileRevalidate(API, req, event)); return; }
  if (req.url === D3) { event.respondWith(caches.match(req).then((hit) => hit || fetch(req))); return; }
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/@fontsource/')) event.respondWith(cacheFirst(FONTS, req));
});
