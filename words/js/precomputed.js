// Compact precomputed networks (data/precomputed/<lang>/<word>.json).
//
// A file stores, for the default settings (window ±5, medium corpus, default sources,
// stopwords on), the top-80 neighbours in BOTH ranking modes plus all pair counts ≥ 2
// among them. decode() rebuilds exactly what buildNetwork() returns for any
// topN ≤ 80, minCooc ≥ 2 and any maxLinksPerNode, so the rank toggle and three of the
// sliders work instantly and offline. Other settings fall back to a live fetch.
import { buildNetwork } from './analysis.js';
import { tokenize, formMatcher } from './languages.js';
import { slug } from './words.js';

export const FORMAT = 1;
export const DEFAULTS = { window: 5, size: 500, minCoocFloor: 2, maxTopN: 80, sources: ['wikiSnippets', 'wikiIntros', 'wikiquote', 'hackerNews'] };
export const precomputedPath = (code, word) => `data/precomputed/${code}/${encodeURIComponent(slug(word))}.json`;

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

/** Position of the first occurrence of the search word in a text (language-aware). */
export function firstHit(text, term, lang) {
  if (lang.segment === 'intl') return text.toLowerCase().indexOf(term.trim().toLowerCase());
  const q = tokenize(term, lang).map((t) => t.low);
  const isTarget = formMatcher(q[q.length - 1] || '', lang);
  for (const t of tokenize(text, lang)) if (isTarget(t.low)) return t.s;
  return -1;
}

/** Build the compact record (Node build script). */
export function encode({ docs, report }, term, { lang, stop, reference, generated = new Date().toISOString() }) {
  const opts = { window: DEFAULTS.window, topN: DEFAULTS.maxTopN, minCooc: DEFAULTS.minCoocFloor, maxLinksPerNode: Infinity, stop, lang };
  const nets = {
    distinctive: buildNetwork(docs, term, { ...opts, rank: 'distinctive', reference }),
    frequency: buildNetwork(docs, term, { ...opts, rank: 'frequency', reference }),
  };
  const words = [], index = new Map(), texts = [], textIdx = new Map();
  const wordId = (n) => {
    if (!index.has(n.id)) {
      index.set(n.id, words.length);
      words.push([n.id, n.label === n.id ? 0 : n.label, n.freq, n.cooc, r3(n.lr), r3(n.g2), null]);
    }
    return index.get(n.id);
  };
  const order = {};
  for (const [mode, net] of Object.entries(nets)) order[mode] = net.nodes.filter((n) => !n.target).map(wordId);
  // tooltip/sample snippets for the 30 best neighbours of each mode (2 each, deduplicated)
  for (const net of Object.values(nets)) {
    for (const n of net.nodes.filter((d) => !d.target).slice(0, 30)) {
      const w = words[index.get(n.id)];
      if (w[6]) continue;
      w[6] = (n.samples || []).slice(0, 2).map((t) => {
        t = t.length > 160 ? t.slice(0, 160) + '…' : t;
        if (!textIdx.has(t)) { textIdx.set(t, texts.length); texts.push(t); }
        return textIdx.get(t);
      });
    }
  }
  const pairs = [], seen = new Set();
  for (const net of Object.values(nets)) {
    for (const l of net.links) {
      if (l.kind !== 'pair') continue;
      const a = index.get(l.source), b = index.get(l.target);
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(Math.min(a, b), Math.max(a, b), l.weight);
    }
  }
  // a dozen sample instances for the "Sample instances" panel
  const sampleDocs = [], seenDoc = new Set();
  for (const doc of docs) {
    if (sampleDocs.length >= 12) break;
    if (seenDoc.has(doc.source + doc.title)) continue;
    const pos = firstHit(doc.text, term, lang);
    if (pos < 0) continue;
    seenDoc.add(doc.source + doc.title);
    const a = Math.max(0, pos - 120);
    sampleDocs.push([doc.source, doc.title, doc.url, (a > 0 ? '… ' : '') + doc.text.slice(a, pos + 160).trim() + (pos + 160 < doc.text.length ? ' …' : '')]);
  }
  const st = nets.frequency.stats;
  return {
    v: FORMAT, word: term, lang: lang.code, generated, settings: { window: DEFAULTS.window, size: DEFAULTS.size },
    report: report.map((r) => (r.error ? { key: r.key, label: r.label, count: 0, error: r.error } : { key: r.key, label: r.label, count: r.count })),
    stats: { docs: st.docs, docsWithHits: st.docsWithHits, occurrences: st.occurrences, windows: st.windows, vocabulary: st.vocabulary,
      eligible: { distinctive: nets.distinctive.stats.eligible, frequency: st.eligible }, distinctiveOk: nets.distinctive.stats.rank === 'distinctive' },
    target: { freq: nets.frequency.nodes[0].freq, cooc: nets.frequency.nodes[0].cooc },
    words, order, pairs, texts, docs: sampleDocs,
  };
}

/** Can these settings be served from the precomputed record? */
export const covers = (p) => p.topN <= DEFAULTS.maxTopN && p.minCooc >= DEFAULTS.minCoocFloor && p.window === DEFAULTS.window;

/** Rebuild a network (same shape as buildNetwork's) from a record. */
export function decode(rec, { rank = 'distinctive', topN = 30, minCooc = 2, maxLinksPerNode = 6 } = {}) {
  const mode = rank === 'distinctive' && rec.stats.distinctiveOk ? 'distinctive' : 'frequency';
  const top = rec.order[mode].slice(0, topN);
  const n = top.length;
  const pos = new Map(top.map((w, i) => [w, i]));
  const W = rec.words;
  const nodes = [
    { id: '__target__', label: rec.word, freq: rec.target.freq, cooc: rec.target.cooc, target: true },
    ...top.map((wi, i) => {
      const [id, label, freq, cooc, lr, g2, s] = W[wi];
      const node = { id, label: label || id, freq, cooc, samples: (s || []).map((t) => rec.texts[t]), rank: i + 1 };
      if (lr != null) { node.lr = lr; node.g2 = g2; }
      return node;
    }),
  ];
  const links = top.map((wi) => ({ source: '__target__', target: W[wi][0], weight: W[wi][3], kind: 'target' }));
  // same candidate order as buildNetwork: i<j in rank order, then stable sort by weight
  const m = new Uint32Array(n * n);
  for (let k = 0; k < rec.pairs.length; k += 3) {
    const a = pos.get(rec.pairs[k]), b = pos.get(rec.pairs[k + 1]);
    if (a === undefined || b === undefined) continue;
    m[Math.min(a, b) * n + Math.max(a, b)] = rec.pairs[k + 2];
  }
  const cand = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c = m[i * n + j];
      if (c >= minCooc) cand.push({ source: W[top[i]][0], target: W[top[j]][0], weight: c, kind: 'pair' });
    }
  }
  cand.sort((a, b) => b.weight - a.weight);
  const deg = new Map();
  for (const l of cand) {
    const da = deg.get(l.source) || 0, db = deg.get(l.target) || 0;
    if (da >= maxLinksPerNode && db >= maxLinksPerNode) continue;
    deg.set(l.source, da + 1); deg.set(l.target, db + 1);
    links.push(l);
  }
  return {
    nodes, links,
    stats: { ...rec.stats, eligible: rec.stats.eligible[mode], pairLinks: links.length - n, rank: mode, precomputed: rec.generated },
  };
}
