#!/usr/bin/env node
// Static, crawlable pages for precomputed words: w/<lang>/<word>/index.html, language and
// word indexes, sitemap.xml and robots.txt. Run after tools/precompute.mjs (+ render-og.mjs).
// usage: node tools/build-pages.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LANGS, getLang } from '../js/languages.js';
import { WOTD, POPULAR, slug } from '../js/words.js';
import { decode } from '../js/precomputed.js';
import { ATTRIBUTION } from '../js/card.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://synoikon.com/';
const PRE = path.join(ROOT, 'data/precomputed');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = (s) => encodeURIComponent(slug(s));
const pageUrl = (code, word) => `${SITE}w/${code}/${enc(word)}/`;
const fmtX = (lr) => { const x = 2 ** lr; return x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`; };

// ---- load records ----------------------------------------------------------------
const recs = new Map(); // code -> Map(slug -> rec)
for (const l of LANGS) {
  const dir = path.join(PRE, l.code);
  if (!fs.existsSync(dir)) continue;
  const m = new Map();
  for (const f of fs.readdirSync(dir).sort()) if (f.endsWith('.json') && f !== 'index.json') m.set(f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  if (m.size) recs.set(l.code, m);
}
// concept -> { code: word } for hreflang alternates; slug -> {gloss, concept} per language
const concepts = new Map(), meta = new Map();
for (const [kind, lists] of [['wotd', WOTD], ['popular', POPULAR]]) {
  for (const [code, list] of Object.entries(lists)) {
    for (const w of list) {
      const key = `${kind}:${w.concept}`;
      if (!concepts.has(key)) concepts.set(key, {});
      concepts.get(key)[code] = w.word;
      meta.set(`${code}/${slug(w.word)}`, { gloss: w.gloss, concept: key, kind });
    }
  }
}
const has = (code, word) => recs.get(code)?.has(slug(word));

// ---- shared chrome ---------------------------------------------------------------
// UI chrome in the page's language (data/i18n/<code>.json, machine-translated; English keys)
const I18N = new Map();
const T = (code, str, ...a) => {
  if (!I18N.has(code)) { const f = path.join(ROOT, 'data', 'i18n', `${code}.json`); I18N.set(code, code !== 'en' && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}); }
  return (I18N.get(code)[str] ?? str).replace(/\{(\d)\}/g, (m, i) => (a[i] ?? m));
};
const head = ({ title, desc, canonical, og, lang = 'en', dir = 'ltr', rel, alternates = '', extra = '' }) => `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${canonical}">
${alternates}  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Synoikon">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${og}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#05030f">
  <link rel="manifest" href="${rel}manifest.webmanifest">
  <link rel="icon" href="${rel}icons/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="${rel}icons/apple-touch-icon.png">
  <link rel="stylesheet" href="${rel}css/page.css">
  <link rel="stylesheet" href="${rel}css/nebula.css">
${extra}</head>
<body>
  <header class="top">
    <a class="brand" href="${rel}"><img src="${rel}icons/favicon.svg" alt="" width="30" height="30">Synoikon</a>
    <nav><a href="${rel}w/">${esc(T(lang, 'All words'))}</a><a href="${rel}about.html">${esc(T(lang, 'About'))}</a></nav>
  </header>
`;
const foot = (rel, code = 'en') => `  <footer class="foot">${esc(T(code, 'Text: Wikipedia/Wikiquote, CC BY-SA 4.0 (excerpts, with links to the source pages); Hacker News comments © their authors.'))}
    ${esc(T(code, 'Made with'))} <a href="${rel}">Synoikon</a> · <a href="${rel}about.html">${esc(T(code, 'About & attribution'))}</a> · <a href="https://github.com/LessThan301/synoikon">${esc(T(code, 'Source on GitHub'))}</a> · <a href="${rel}../impressum/">Impressum</a> · <a href="${rel}../datenschutz/">Datenschutz / Privacy</a></footer>
  <script type="module">
    import { loadAnalytics } from '${rel}js/analytics.js';
    loadAnalytics();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('${rel}sw.js', { scope: '${rel}' }).catch(() => {});
  </script>
</body>
</html>
`;

// ---- word pages ---------------------------------------------------------------------
const written = [];
const sitemap = [];
for (const [code, m] of recs) {
  const lang = getLang(code);
  for (const [s, rec] of m) {
    const dir = path.join(ROOT, 'w', code, s);
    fs.mkdirSync(dir, { recursive: true });
    const rel = '../../../';
    const info = meta.get(`${code}/${s}`);
    const dist = decode(rec, { rank: 'distinctive', topN: 20 }).nodes.slice(1);
    const freq = decode(rec, { rank: 'frequency', topN: 20 }).nodes.slice(1);
    const top5 = dist.slice(0, 6).map((n) => n.label).join(', ');
    const gloss = code !== 'en' && info ? ` (“${info.gloss}”)` : '';
    const title = T(code, '{0}: the words that keep it company · Synoikon', `${rec.word}${gloss}`);
    const desc = T(code, 'Which words appear around “{0}” on Wikipedia? Most distinctive: {1}. An interactive network drawn from {2} real instances in {3} texts.', rec.word, top5, rec.stats.occurrences, rec.stats.docsWithHits);
    const ogFile = path.join(dir, 'og.png');
    const og = fs.existsSync(ogFile) ? `${pageUrl(code, rec.word)}og.png` : `${SITE}og.png`;
    let alternates = '';
    if (info) {
      const alts = Object.entries(concepts.get(info.concept)).filter(([c, w]) => has(c, w));
      if (alts.length > 1) alternates = alts.map(([c, w]) => `  <link rel="alternate" hreflang="${c}" href="${pageUrl(c, w)}">\n`).join('')
        + (alts.some(([c]) => c === 'en') ? `  <link rel="alternate" hreflang="x-default" href="${pageUrl('en', concepts.get(info.concept).en)}">\n` : '');
    }
    const app = `${rel}#q=${encodeURIComponent(rec.word)}&lang=${code}`;
    const li = (n, score) => `<li><bdi>${esc(n.label)}</bdi> <small dir="ltr">${score(n)}</small></li>`;
    const mark = (text) => esc(text);
    const jsonld = { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, inLanguage: code, url: pageUrl(code, rec.word),
      dateModified: rec.generated, isPartOf: { '@type': 'WebSite', name: 'Synoikon', url: SITE },
      about: { '@type': 'DefinedTerm', name: rec.word, inDefinedTermSet: `${lang.english} Wikipedia` } };
    const others = [...m.values()].filter((r) => r !== rec).map((r) => `<li><a href="../${enc(r.word)}/" dir="auto">${esc(r.word)}</a></li>`).join('');
    const html = head({ title, desc, canonical: pageUrl(code, rec.word), og, lang: code, dir: lang.dir, rel, alternates,
      extra: `  <script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>\n` })
      + `  <main class="page">
    <p class="sub">${esc(lang.native)}${info ? ` · ${esc(T(code, info.kind === 'wotd' ? 'word of the day list' : 'popular word'))}` : ''}</p>
    <h1 dir="auto">${esc(rec.word)}</h1>
    <p class="sub">${code !== 'en' && info ? `“<span dir="ltr">${esc(info.gloss)}</span>” · ` : ''}${esc(T(code, 'The words found around it in {0} instances from Wikipedia{1}.', rec.stats.occurrences, `${rec.report.some((r) => r.key === 'wikiquote' && r.count) ? ', Wikiquote' : ''}${rec.report.some((r) => r.key === 'hackerNews' && r.count) ? ', Hacker News' : ''}`))}</p>
    <div class="actions"><a class="btn" href="${app}">${esc(T(code, 'Open the interactive map →'))}</a><a class="btn secondary" href="${app}&amp;rank=frequency">${esc(T(code, 'Ranked by frequency'))}</a></div>
    <figure><img src="${fs.existsSync(ogFile) ? 'og.png' : `${rel}og.png`}" width="1200" height="630" alt="${esc(T(code, 'Network of the words around “{0}”: {1}', rec.word, top5))}"><figcaption>${esc(T(code, 'Circle area = how often a word appears near “{0}”; shorter, thicker lines = words that often appear together.', rec.word))}</figcaption></figure>
    <div class="cols">
      <section><h2>${esc(T(code, 'Most distinctive neighbours'))}</h2><ol class="words">${dist.map((n) => li(n, (d) => (d.lr != null ? fmtX(d.lr) : ''))).join('')}</ol>
        <p class="muted"><small>${esc(T(code, '× = how many times more often than in general Wikipedia text.'))}</small></p></section>
      <section><h2>${esc(T(code, 'Most frequent neighbours'))}</h2><ol class="words">${freq.map((n) => li(n, (d) => `${d.freq}`)).join('')}</ol></section>
    </div>
    <h2>${esc(T(code, 'In context'))}</h2>
    <ul class="samples">${rec.docs.slice(0, 8).map(([source, t, url, text]) => `<li dir="auto">${mark(text)} <a href="${esc(url)}" rel="nofollow noopener" dir="auto">${esc(source)} · ${esc(t)}</a></li>`).join('')}</ul>
    <h2>${esc(T(code, 'More words'))}</h2>
    <ul class="chips">${others}</ul>
    <p class="muted"><small>${esc(T(code, 'Precomputed on {0} with default settings (±{1} words, medium corpus). The interactive map can refresh it with live data.', rec.generated.slice(0, 10), rec.settings.window))}</small></p>
    ${code !== 'en' ? `<p class="muted"><small>${esc(T(code, 'Machine-translated interface; corrections welcome.'))}</small></p>` : ''}
  </main>
` + foot(rel, code);
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    written.push(`${code}/${s}`);
    sitemap.push({ loc: pageUrl(code, rec.word), lastmod: rec.generated.slice(0, 10), alts: alternates });
  }
}

// ---- indexes -------------------------------------------------------------------------
for (const [code, m] of recs) {
  const lang = getLang(code);
  const rel = '../../';
  const list = [...m.values()].sort((a, b) => a.word.localeCompare(b.word, code));
  const html = head({ title: `${lang.native} · ${T(code, 'All words')} · Synoikon`, desc: `Word networks for ${list.length} ${lang.english} words, drawn from real Wikipedia text: ${list.slice(0, 12).map((r) => r.word).join(', ')}…`,
    canonical: `${SITE}w/${code}/`, og: `${SITE}og.png`, lang: code, dir: lang.dir, rel })
    + `  <main class="page"><h1 dir="auto">${esc(lang.native)}</h1><p class="sub">${esc(T(code, '{0} precomputed words.', list.length))} <a href="${rel}#lang=${code}">${esc(T(code, 'Any other word works live in the app.'))}</a></p>
    <ul class="chips">${list.map((r) => `<li><a href="${enc(r.word)}/" dir="auto">${esc(r.word)}</a></li>`).join('')}</ul></main>
` + foot(rel, code);
  fs.writeFileSync(path.join(ROOT, 'w', code, 'index.html'), html);
  sitemap.push({ loc: `${SITE}w/${code}/`, lastmod: list.map((r) => r.generated.slice(0, 10)).sort().pop() });
}
{
  const rel = '../';
  const html = head({ title: 'All words · Synoikon', desc: `Precomputed word networks in ${recs.size} languages, drawn from real Wikipedia text.`, canonical: `${SITE}w/`, og: `${SITE}og.png`, rel })
    + `  <main class="page"><h1>All words</h1><p class="sub">Precomputed networks for popular words and upcoming words of the day. Any other word works live in the <a href="${rel}">app</a>.</p>
    <ul class="langs">${[...recs.keys()].map((c) => `<li><a href="${c}/"><b dir="auto">${esc(getLang(c).native)}</b><br><span class="muted">${esc(getLang(c).english)} · ${recs.get(c).size} words</span></a></li>`).join('')}</ul></main>
` + foot(rel);
  fs.mkdirSync(path.join(ROOT, 'w'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'w', 'index.html'), html);
}

// ---- sitemap + robots -----------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  `  <url><loc>${SITE}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
  `  <url><loc>${SITE}about.html</loc><priority>0.5</priority></url>`,
  `  <url><loc>${SITE}w/</loc><lastmod>${today}</lastmod><priority>0.7</priority></url>`,
  ...sitemap.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod>${(u.alts || '').split('\n').filter(Boolean)
    .map((a) => a.trim().replace(/^<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">$/, '<xhtml:link rel="alternate" hreflang="$1" href="$2"/>')).join('')}</url>`),
  '</urlset>', ''].join('\n');
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /offline.html
Sitemap: ${SITE}sitemap.xml
`);
console.log(`built ${written.length} word pages in ${recs.size} languages, ${sitemap.length + 3} sitemap URLs`);
