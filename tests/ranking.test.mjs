// Compare Frequency vs Distinctive ranking on a saved or live corpus.
// usage: node tests/ranking.test.mjs river en [corpus.json]
import fs from 'fs';
import { buildNetwork } from '../js/analysis.js';
import { parseReference } from '../js/reference.js';
import { collectCorpus } from '../js/sources.js';
import { STOP_EN, STOP_DE } from '../js/stopwords.js';
const [word = 'river', lang = 'en', file] = process.argv.slice(2);
const corpus = file ? JSON.parse(fs.readFileSync(file, 'utf8'))
  : await collectCorpus(word, { lang, size: 500, enabled: ['wikiSnippets', 'wikiIntros', 'wikiquote', 'hackerNews'] });
const reference = parseReference(fs.readFileSync(new URL(`../data/freq-${lang}.txt`, import.meta.url), 'utf8'));
const stop = new Set([...STOP_EN, ...STOP_DE]);
for (const rank of ['frequency', 'distinctive']) {
  const net = buildNetwork(corpus.docs, word, { topN: 30, stop, rank, reference });
  console.log(`${rank.toUpperCase()} (${net.stats.eligible} eligible):`,
    net.nodes.slice(1).map((n) => `${n.label}(${n.freq},${n.lr.toFixed(1)})`).join(' '));
}
