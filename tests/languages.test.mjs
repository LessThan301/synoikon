// Fetch a live corpus for each language's sample word and print the top neighbors.
// usage: node tests/languages.test.mjs [codes...]
import fs from 'fs';
import { buildNetwork } from '../js/analysis.js';
import { parseReference } from '../js/reference.js';
import { collectCorpus } from '../js/sources.js';
import { STOP_EN } from '../js/stopwords.js';
import { LANGS } from '../js/languages.js';
const read = (f) => fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8');
const codes = process.argv.slice(2);
const rows = [];
for (const lang of LANGS.filter((l) => !codes.length || codes.includes(l.code))) {
  const corpus = await collectCorpus(lang.sample, { lang: lang.code, size: 500, enabled: ['wikiSnippets', 'wikiIntros', 'wikiquote', 'hackerNews'] });
  const stop = new Set(STOP_EN);
  if (lang.code !== 'en') read(`stop-${lang.code}.txt`).split('\n').filter((w) => w && !w.startsWith('#')).forEach((w) => stop.add(w));
  const reference = parseReference(read(`freq-${lang.code}.txt`));
  const net = buildNetwork(corpus.docs, lang.sample, { topN: 30, stop, rank: 'distinctive', reference, lang });
  const src = corpus.report.map((r) => `${r.key}:${r.error ? 'ERR(' + r.error + ')' : r.count}`).join(' ');
  await new Promise((r) => setTimeout(r, 1500)); // be polite to the APIs
  rows.push({ code: lang.code, word: lang.sample, nodes: net.nodes.length, hits: net.stats.occurrences, src });
  console.log(`${lang.code} ${lang.sample} | ${src} | hits ${net.stats.occurrences} | nodes ${net.nodes.length} | ${net.nodes.slice(1, 13).map((n) => n.label).join(', ')}`);
}
fs.writeFileSync('languages-result.json', JSON.stringify(rows, null, 1));
