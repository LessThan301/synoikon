#!/usr/bin/env node
// Precompute networks for popular words and the upcoming words of the day.
// Runs the same fetch + analysis as the browser app and writes compact JSON to
// data/precomputed/<lang>/<word>.json plus a per-language index.json.
//
// usage: node tools/precompute.mjs [--days 30] [--max-age 30] [--limit 400] [--langs en,de] [--words river,Wald] [--force]
//        [--index-only]  just rebuild index.json files
//        [--cache DIR]  also save raw corpora there;  [--offline]  re-encode from DIR only (no network)
//
// Politeness towards Wikimedia: identifies itself with Api-User-Agent/User-Agent
// ("LessThan301 contexter (github.com/LessThan301/contexter)"), at most 3 requests in
// flight at any time, honours Retry-After on 429/503 and backs off exponentially.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { collectCorpus, setMaxConcurrent, requestStats, cleanText } from '../js/sources.js';
import { parseReference } from '../js/reference.js';
import { STOP_EN } from '../js/stopwords.js';
import { LANGS, getLang } from '../js/languages.js';
import { WOTD, POPULAR, wordOfDay, slug } from '../js/words.js';
import { encode, DEFAULTS } from '../js/precomputed.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/precomputed');
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const DAYS = +arg('days', 30);
const MAX_AGE_DAYS = +arg('max-age', 30);
const LIMIT = +arg('limit', 2000);
const FORCE = process.argv.includes('--force');
const ONLY_LANGS = arg('langs', '') ? arg('langs').split(',') : null;
const ONLY_WORDS = arg('words', '') ? arg('words').split(',').map(slug) : null;
const CACHE = arg('cache', '');
const OFFLINE = process.argv.includes('--offline');
setMaxConcurrent(3);
async function getCorpus(job) {
  const cf = CACHE && path.join(CACHE, job.lang, `${slug(job.word)}.json`);
  if (cf && OFFLINE) {
    const c = JSON.parse(fs.readFileSync(cf, 'utf8'));
    c.docs = c.docs.map((d) => ({ ...d, text: cleanText(d.text) })).filter((d) => d.text.trim());
    return c;
  }
  const corpus = await collectCorpus(job.word, { lang: job.lang, size: DEFAULTS.size, enabled: DEFAULTS.sources });
  if (cf) { fs.mkdirSync(path.dirname(cf), { recursive: true }); fs.writeFileSync(cf, JSON.stringify(corpus)); }
  return corpus;
}

// ---- which words --------------------------------------------------------------
const today = new Date();
const jobs = [];
for (const l of LANGS) {
  if (ONLY_LANGS && !ONLY_LANGS.includes(l.code)) continue;
  const words = new Map();
  for (let d = 0; d < DAYS; d++) {
    const w = wordOfDay(l.code, new Date(today.getTime() + d * 86400000));
    words.set(slug(w.word), { word: w.word, why: d === 0 ? 'wotd-today' : 'wotd' });
  }
  for (const w of POPULAR[l.code]) if (!words.has(slug(w.word))) words.set(slug(w.word), { word: w.word, why: 'popular' });
  for (const [s, { word, why }] of words) {
    if (ONLY_WORDS && !ONLY_WORDS.includes(s)) continue;
    const file = path.join(OUT, l.code, `${s}.json`);
    let age = Infinity;
    try { age = (Date.now() - Date.parse(JSON.parse(fs.readFileSync(file, 'utf8')).generated)) / 86400000; } catch { /* missing */ }
    if (!FORCE && age < MAX_AGE_DAYS) continue;
    jobs.push({ lang: l.code, word, file, why, age });
  }
}
// missing files first, then the stalest; today's words before everything else
jobs.sort((a, b) => (b.why === 'wotd-today') - (a.why === 'wotd-today') || b.age - a.age);
jobs.length = process.argv.includes('--index-only') ? 0 : Math.min(jobs.length, LIMIT);
console.log(`${jobs.length} words to (re)compute (days=${DAYS}, max-age=${MAX_AGE_DAYS}d)`);

// ---- per-language resources ---------------------------------------------------
const read = (f) => fs.readFileSync(path.join(ROOT, 'data', f), 'utf8');
const res = new Map();
function resources(code) {
  if (!res.has(code)) {
    const stop = new Set(STOP_EN);
    if (code !== 'en') read(`stop-${code}.txt`).split('\n').filter((w) => w && !w.startsWith('#')).forEach((w) => stop.add(w));
    res.set(code, { stop, reference: parseReference(read(`freq-${code}.txt`)) });
  }
  return res.get(code);
}

// ---- run (3 words at a time; the request gate keeps ≤ 3 HTTP requests in flight) ----
const t0 = Date.now();
const done = { ok: 0, kept: 0, failed: [] };
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    const lang = getLang(job.lang);
    try {
      const corpus = await getCorpus(job);
      const errors = corpus.report.filter((r) => r.error);
      if (errors.length && fs.existsSync(job.file)) { // don't replace good data with partial data
        done.kept++; console.log(`  keep ${job.lang}/${job.word}: ${errors.map((e) => `${e.label}: ${e.error}`).join('; ')}`); continue;
      }
      const { stop, reference } = resources(lang.code);
      const rec = encode(corpus, job.word, { lang, stop, reference });
      const n = rec.order.distinctive.length;
      if (rec.order.frequency.length < 5) { done.failed.push(`${job.lang}/${job.word} (${rec.stats.occurrences} hits)`); console.log(`  FAIL ${job.lang}/${job.word}: only ${rec.order.frequency.length} neighbours`); continue; }
      fs.mkdirSync(path.dirname(job.file), { recursive: true });
      fs.writeFileSync(job.file, JSON.stringify(rec));
      done.ok++;
      console.log(`  ${String(done.ok).padStart(4)} ${job.lang}/${job.word} [${job.why}] hits ${rec.stats.occurrences}, distinctive ${n}, ${(JSON.stringify(rec).length / 1024).toFixed(1)} KB: ${rec.order.distinctive.slice(0, 6).map((i) => rec.words[i][1] || rec.words[i][0]).join(', ')}`);
    } catch (err) {
      done.failed.push(`${job.lang}/${job.word} (${err.message})`);
      console.log(`  FAIL ${job.lang}/${job.word}: ${err.message}`);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);

// ---- indexes (from whatever files exist, so older words stay available) ----------
const summary = {};
for (const l of LANGS) {
  const dir = path.join(OUT, l.code);
  if (!fs.existsSync(dir)) continue;
  const words = {};
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    words[f.slice(0, -5)] = { w: rec.word, t: rec.generated.slice(0, 10), n: rec.stats.occurrences };
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ v: 1, lang: l.code, words }));
  summary[l.code] = Object.keys(words).length;
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ v: 1, langs: summary }, null, 1));
const mins = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`done in ${mins} min: ${done.ok} written, ${done.kept} kept (source errors), ${done.failed.length} failed; ${requestStats.requests} requests, ${requestStats.retries} retries (${requestStats.retryAfterWaits} with Retry-After)`);
if (done.failed.length) console.log('failed:', done.failed.join(', '));
if (!process.argv.includes('--index-only')) fs.writeFileSync(path.join(OUT, 'last-run.json'), JSON.stringify({ finished: new Date().toISOString(), minutes: +mins, written: done.ok, kept: done.kept, failed: done.failed, requests: requestStats.requests, retries: requestStats.retries }, null, 1));
