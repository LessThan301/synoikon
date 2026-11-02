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
  out.providers[id] = [out.providers[id][0], fs.existsSync(file) ? 1 : 0];
}
fs.writeFileSync(OUT, JSON.stringify(out));
const de = Object.values(out.films).filter((p) => p.DE).length, deS = Object.values(out.films).filter((p) => p.DE && (p.DE.flatrate || p.DE.free || p.DE.ads)).length;
console.log(`films ${FILMS.length}, matched ${matched}, with providers in DE ${de} (streaming ${deS}), providers ${used.size}, regions ${Object.keys(out.regions).length}`);
