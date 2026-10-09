// Checks that a precomputed record decodes to exactly what the live analysis produces,
// for every ranking mode and a grid of slider values it claims to cover.
// usage: node tests/precomputed.test.mjs [corpus.json] [word] [lang]   (no corpus → fetch live)
import fs from 'fs';
import { buildNetwork } from '../js/analysis.js';
import { parseReference } from '../js/reference.js';
import { collectCorpus } from '../js/sources.js';
import { STOP_EN } from '../js/stopwords.js';
import { getLang } from '../js/languages.js';
import { encode, decode, covers, DEFAULTS } from '../js/precomputed.js';

const [file, word = 'river', code = 'en'] = process.argv.slice(2);
const lang = getLang(code);
const read = (f) => fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8');
const corpus = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : await collectCorpus(word, { lang: code, size: 500, enabled: DEFAULTS.sources });
const stop = new Set(STOP_EN);
if (code !== 'en') read(`stop-${code}.txt`).split('\n').filter((w) => w && !w.startsWith('#')).forEach((w) => stop.add(w));
const reference = parseReference(read(`freq-${code}.txt`));
const rec = JSON.parse(JSON.stringify(encode({ docs: corpus.docs, report: corpus.report || [] }, word, { lang, stop, reference })));
const bytes = JSON.stringify(rec).length;
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
for (const rank of ['distinctive', 'frequency']) {
  for (const topN of [5, 30, 55, 80]) {
    for (const minCooc of [2, 3, 7]) {
      for (const maxLinksPerNode of [0, 3, 6, 20]) {
        const p = { rank, topN, minCooc, maxLinksPerNode };
        ok(covers({ ...p, window: 5 }), 'covers');
        const live = buildNetwork(corpus.docs, word, { ...p, window: 5, stop, reference, lang });
        const pre = decode(rec, p);
        const tag = JSON.stringify(p);
        ok(live.nodes.length === pre.nodes.length, `${tag} node count ${live.nodes.length} vs ${pre.nodes.length}`);
        ok(live.nodes.every((n, i) => n.id === pre.nodes[i].id && n.label === pre.nodes[i].label && n.freq === pre.nodes[i].freq && n.cooc === pre.nodes[i].cooc
          && (n.lr == null || Math.abs(n.lr - pre.nodes[i].lr) < 0.001)), `${tag} nodes identical`);
        const ls = (net) => net.links.map((l) => `${l.source}|${l.target}|${l.weight}|${l.kind}`).join(' ');
        ok(ls(live) === ls(pre), `${tag} links identical (${live.links.length} vs ${pre.links.length})`);
        ok(live.stats.rank === pre.stats.rank && live.stats.eligible === pre.stats.eligible && live.stats.pairLinks === pre.stats.pairLinks, `${tag} stats`);
      }
    }
  }
}
ok(!covers({ topN: 30, minCooc: 1, window: 5 }) && !covers({ topN: 30, minCooc: 2, window: 6 }), 'minCooc 1 / other windows need live data');
ok(rec.docs.length > 0 && rec.docs.every((d) => d[3].length < 400), 'sample instances stored');
console.log(`${word}/${code}: record ${(bytes / 1024).toFixed(1)} KB, ${rec.words.length} words, ${rec.pairs.length / 3} pairs, ${rec.texts.length} texts`);
console.log(fails ? `FAIL ${fails}/${checks}` : `PASS precomputed decode == live analysis (${checks} checks)`);
process.exitCode = fails ? 1 : 0;
