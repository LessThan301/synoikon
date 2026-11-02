#!/usr/bin/env node
// Build-time fetch of "where to watch" data (JustWatch via TMDB) for the Zimmer tracker.
// Visitors' browsers never call TMDB: this writes home/zimmer/providers.json and self-hosts logos.
// Token: env TMDB_TOKEN (v4 read access token) or the file given by TMDB_TOKEN_FILE. Never logged.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const Z = path.join(ROOT, 'home/zimmer'), OUT = path.join(Z, 'providers.json'), LOGOS = path.join(Z, 'logos');
const TOKEN = (process.env.TMDB_TOKEN || (process.env.TMDB_TOKEN_FILE ? fs.readFileSync(process.env.TMDB_TOKEN_FILE, 'utf8') : '')).trim();
if (!TOKEN) { console.error('TMDB_TOKEN missing'); process.exit(1); }
const html = fs.readFileSync(path.join(Z, 'a/index.html'), 'utf8');
const grab = (n) => JSON.parse(html.match(new RegExp('const ' + n + ' = (.*);\\n'))[1]);
const FILMS = grab('FILMS').concat(grab('DOCS'), grab('UP')), IMDB = grab('IMDB');
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { ids: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(p) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://api.themoviedb.org/3' + p, { headers: { Authorization: 'Bearer ' + TOKEN, accept: 'application/json' } });
    if (r.status === 429) { await sleep(1500 * (i + 1)); continue; }
    if (!r.ok) throw new Error('TMDB ' + r.status + ' for ' + p.split('?')[0]);
    return r.json();
  } throw new Error('TMDB rate limit');
}
const out = { updated: new Date().toISOString().slice(0, 10), ids: {}, films: {}, providers: {}, regions: {} };
const used = new Set(); let matched = 0;
for (const f of FILMS) {
  const k = f[0] + '|' + f[1]; let tmdb = old.ids[k] || null;
  try {
    if (!tmdb && IMDB[k]) { const r = await api('/find/' + IMDB[k] + '?external_source=imdb_id'); const m = r.movie_results[0] || r.tv_results[0]; if (m) tmdb = (r.movie_results[0] ? 'movie/' : 'tv/') + m.id; }
    if (!tmdb) { const r = await api('/search/movie?query=' + encodeURIComponent(f[0]) + '&year=' + f[1]); if (r.results[0]) tmdb = 'movie/' + r.results[0].id; }
    if (!tmdb) continue; matched++; out.ids[k] = tmdb;
    const wp = (await api('/' + tmdb + '/watch/providers')).results || {}; const per = {};
    for (const [cc, v] of Object.entries(wp)) {
      const e = {}; for (const t of ['flatrate', 'free', 'ads', 'rent', 'buy']) if (v[t]) { e[t] = v[t].sort((a, b) => a.display_priority - b.display_priority).map((p) => { used.add(p.provider_id); out.providers[p.provider_id] = [p.provider_name, p.logo_path]; return p.provider_id; }); }
      if (Object.keys(e).length) per[cc] = e;
    }
    out.films[k] = per;
  } catch (e) { console.error(k + ': ' + e.message); if (old.films?.[k]) { out.ids[k] = tmdb; out.films[k] = old.films[k]; } }
  await sleep(60);
}
const reg = await api('/watch/providers/regions?language=en-US');
for (const r of reg.results) out.regions[r.iso_3166_1] = r.english_name;
fs.mkdirSync(LOGOS, { recursive: true });
for (const id of used) {
  const lp = out.providers[id][1], file = path.join(LOGOS, id + '.jpg');
  if (lp && !fs.existsSync(file)) { const r = await fetch('https://image.tmdb.org/t/p/w45' + lp); if (r.ok) fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); }
  out.providers[id] = [out.providers[id][0], fs.existsSync(file) ? id : 0];
}
normalize(out);
fs.writeFileSync(OUT, JSON.stringify(out));
// Merge variants of one brand ("... with Ads", "... Amazon Channel", "Standard with Ads", "Amazon Video" = Prime Video, ...)
// into one entry per film, listed once in its best group (Streaming > Free > Rent > Buy), with an "also" note.
function clean(n) {
  let c = n.trim().replace(/\s+(amazon|apple tv|roku premium|roku)\s+channel$/i, '').replace(/\s+(free\s+)?with\s+ads$/i, '')
    .replace(/\s+(standard|basic|essential|premium plus|premium)$/i, '').replace(/\s+(store|stream)$/i, '').trim();
  if (/^amazon( prime)? video$/i.test(c)) c = 'Amazon Prime Video';
  if (/^apple tv\+?$/i.test(c)) c = 'Apple TV';
  if (/^rtl\+ max$/i.test(c)) c = 'RTL+';
  return c.replace(/ plus$/i, '+').replace(/^(disney|paramount|mgm) plus\b/i, '$1+');
}
function normalize(o) {
  const key = (n) => clean(n).toLowerCase().replace(/[^a-z0-9+]/g, '').replace(/\++$/, '');
  const brands = {}, brandOf = {};
  for (const [id, [name, logo]] of Object.entries(o.providers)) {
    const k = key(name), c = clean(name); const b = brands[k] || (brands[k] = { id: +id, name: c, logo: 0, exact: false });
    if (name.trim() === c && !b.exact) { b.id = +id; b.name = c; b.exact = true; if (logo) b.logo = +id; }
    if (!b.logo && logo) b.logo = +id; brandOf[id] = k;
  }
  const P = {};
  for (const b of Object.values(brands)) P[b.id] = [b.name, b.logo];
  for (const per of Object.values(o.films)) for (const cc of Object.keys(per)) {
    const e = per[cc], n = {}, seen = {}, also = {};
    for (const [g, src] of [['flatrate', e.flatrate], ['free', (e.free || []).concat(e.ads || [])], ['rent', e.rent], ['buy', e.buy]]) for (const pid of src || []) {
      const b = brands[brandOf[pid]].id;
      if (seen[b] === undefined) { seen[b] = g; (n[g] || (n[g] = [])).push(b); }
      else if (seen[b] !== g && (g === 'rent' || g === 'buy')) { const a = also[b] || (also[b] = []); if (!a.includes(g)) a.push(g); }
    }
    if (Object.keys(also).length) n.also = Object.fromEntries(Object.entries(also).map(([b, a]) => [b, a.join(' ')]));
    per[cc] = n;
  }
  o.providers = P;
}
const de = Object.values(out.films).filter((p) => p.DE).length, deS = Object.values(out.films).filter((p) => p.DE && (p.DE.flatrate || p.DE.free || p.DE.ads)).length;
console.log(`films ${FILMS.length}, matched ${matched}, with providers in DE ${de} (streaming ${deS}), providers ${used.size}, regions ${Object.keys(out.regions).length}`);
