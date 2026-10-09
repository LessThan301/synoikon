// Compare Frequency vs Distinctive ranking for any supported language on a live corpus.
// usage: node tests/ranking.test.mjs [word] [lang] [corpus.json]
import fs from 'fs';
import { buildNetwork } from '../js/analysis.js';
import { parseReference } from '../js/reference.js';
import { collectCorpus } from '../js/sources.js';
import { STOP_EN } from '../js/stopwords.js';
import { getLang } from '../js/languages.js';
const [word = 'river', code = 'en', file] = process.argv.slice(2);
const lang = getLang(code);
const corpus = file ? JSON.parse(fs.readFileSync(file, 'utf8'))
  : await collectCorpus(word, { lang: code, size: 500, enabled: ['wikiSnippets', 'wikiIntros', 'wikiquote', 'hackerNews'] });
const read = (f) => fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8');
const reference = parseReference(read(`freq-${code}.txt`));
const stop = new Set(STOP_EN);
if (code !== 'en') read(`stop-${code}.txt`).split('\n').filter((w) => w && !w.startsWith('#')).forEach((w) => stop.add(w));
for (const rank of ['frequency', 'distinctive']) {
  const net = buildNetwork(corpus.docs, word, { topN: 30, stop, rank, reference, lang });
  console.log(`${rank.toUpperCase()} (${net.stats.occurrences} hits, ${net.stats.eligible} eligible):`,
    net.nodes.slice(1).map((n) => `${n.label}(${n.freq},${n.lr.toFixed(1)})`).join(' '));
}
