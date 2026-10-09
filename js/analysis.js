// Text analysis: tokenizing, finding the target, counting neighbors and
// their pairwise co-occurrence. Pure functions (no DOM) so they can be
// tested in Node as well.

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}\p{M}'’\-]*/gu;

// Tokenizing is the most expensive step; cache per document object so that
// slider changes (window size, top N, ranking...) don't re-tokenize the corpus.
const tokenCache = new WeakMap();
function tokensOf(doc) {
  let t = tokenCache.get(doc);
  if (!t) { t = tokenize(doc.text); tokenCache.set(doc, t); }
  return t;
}

export function tokenize(text) {
  const out = [];
  for (const m of String(text).matchAll(WORD_RE)) {
    let raw = m[0].replace(/['’]s$/i, '').replace(/['’\-]+$/, '');
    if (!raw) continue;
    out.push({ raw, low: raw.toLocaleLowerCase() });
  }
  return out;
}

/** Inflected forms we treat as "the same word" as the search term. */
export function targetForms(word) {
  const w = word.toLocaleLowerCase();
  const forms = new Set([w, w + 's', w + 'es', w + 'e', w + 'n', w + 'en', w + 'er', w + 'ern', w + 'ed', w + 'ing']);
  if (w.endsWith('y')) forms.add(w.slice(0, -1) + 'ies');
  if (w.endsWith('e')) { forms.add(w + 'd'); forms.add(w.slice(0, -1) + 'ing'); }
  if (w.endsWith('s') && w.length > 3) forms.add(w.slice(0, -1));
  if (w.endsWith('ies')) forms.add(w.slice(0, -3) + 'y');
  return forms;
}

function isNoise(t) {
  return t.length < 3 || /^\p{N}/u.test(t) || /^[\p{N}\-]+$/u.test(t);
}

/**
 * Find every occurrence of `term` (one or more words) in `docs` and
 * extract a ±window context around each occurrence.
 * Returns { windows: [{ words:[low...], text, doc }], occurrences, docsWithHits }.
 */
export function extractWindows(docs, term, window, stop) {
  const q = tokenize(term).map((t) => t.low);
  if (!q.length) return { windows: [], occurrences: 0, docsWithHits: 0, qTokens: q };
  const lastForms = targetForms(q[q.length - 1]);
  const allTargetForms = new Set(q.flatMap((t) => [...targetForms(t)]));
  const seenText = new Set();
  const seenWin = new Set();
  const windows = [];
  let occurrences = 0;
  let docsWithHits = 0;

  for (const doc of docs) {
    const key = doc.text.trim().toLowerCase();
    if (seenText.has(key)) continue; // identical text from two sources
    seenText.add(key);
    const toks = tokensOf(doc);
    let hit = false;
    for (let i = 0; i + q.length <= toks.length; i++) {
      let ok = true;
      for (let j = 0; j < q.length - 1; j++) if (toks[i + j].low !== q[j]) { ok = false; break; }
      if (!ok || !lastForms.has(toks[i + q.length - 1].low)) continue;
      occurrences++;
      hit = true;
      const a = Math.max(0, i - window);
      const b = Math.min(toks.length, i + q.length + window);
      const words = [];
      for (let k = a; k < b; k++) {
        if (k >= i && k < i + q.length) continue;
        const w = toks[k].low;
        if (stop.has(w) || allTargetForms.has(w) || isNoise(w)) continue;
        words.push(w);
      }
      const text = toks.slice(a, b).map((t) => t.raw).join(' ');
      const sig = text.toLowerCase();
      if (seenWin.has(sig)) continue; // boilerplate repeated verbatim
      seenWin.add(sig);
      windows.push({ words, text, doc });
    }
    if (hit) docsWithHits++;
  }
  return { windows, occurrences, docsWithHits, qTokens: q };
}

/** Merge simple plural/singular pairs (e.g. "bank" + "banks") into one key. */
function canonicalMap(counts) {
  const map = new Map();
  for (const w of counts.keys()) {
    let key = w;
    for (const [suf, rep] of [['ies', 'y'], ['es', ''], ['s', '']]) {
      if (w.endsWith(suf) && w.length - suf.length >= 3) {
        const base = w.slice(0, -suf.length) + rep;
        if (counts.has(base)) { key = base; break; }
      }
    }
    map.set(w, key);
  }
  return map;
}

/**
 * Build the semantic network.
 *  freq(w)      = occurrences of w inside all context windows      -> node AREA
 *  cooc(T, w)   = number of windows containing w                    -> link target–w
 *  cooc(a, b)   = number of windows containing both a and b         -> link a–b
 */
/**
 * Association of a neighbor with the search word, against a general-language
 * reference corpus (Wikipedia word counts).
 *   a = count inside context windows (Nin tokens in total)
 *   r = count in the reference corpus (R tokens in total)
 *   E = expected count inside windows if the word were as common as in general text
 *   g2 = Dunning log-likelihood (2x2 table) -> is the difference significant?
 *   lr = log2((a + 1) / (E + 1)) -> how much more often than expected (add-one smoothed)
 */
export function association(a, Nin, r, R) {
  const E = (Nin * (a + r)) / (Nin + R);
  const E2 = (R * (a + r)) / (Nin + R);
  const term = (o, e) => (o > 0 ? o * Math.log(o / e) : 0);
  const g2 = 2 * (term(a, E) + term(Nin - a, Nin - E) + term(r, E2) + term(R - r, R - E2));
  return { expected: E, g2: a >= E ? g2 : -g2, lr: Math.log2((a + 1) / (E + 1)) };
}

export const DISTINCTIVE = { minWindows: 3, minG2: 10.83 /* p < 0.001 */ };

// Stage 1 (windows, counts, association scores) depends only on the corpus,
// term, window size, stopwords and background list. Cache it so sliders like
// "neighbors shown" or "min. co-occurrence" only redo the cheap selection.
const prepCache = new WeakMap(); // docs array -> Map(key -> prep)
const ids = new WeakMap();
let nextId = 1;
const idOf = (o) => { if (!ids.has(o)) ids.set(o, nextId++); return ids.get(o); };

function prepare(docs, term, window, stop) {
  let byKey = prepCache.get(docs);
  if (!byKey) { byKey = new Map(); prepCache.set(docs, byKey); }
  const key = `${term.trim().toLowerCase()}|${window}|${idOf(stop)}`;
  if (byKey.has(key)) return byKey.get(key);

  const ex = extractWindows(docs, term, window, stop);
  const raw = new Map();
  for (const w of ex.windows) for (const t of w.words) raw.set(t, (raw.get(t) || 0) + 1);
  const canon = canonicalMap(raw);

  const freq = new Map();     // key -> total occurrences
  const surface = new Map();  // key -> Map(surface form -> count)
  const ctx = new Map();      // key -> #windows containing it
  const winSets = [];
  for (const w of ex.windows) {
    const set = new Set();
    for (const t of w.words) {
      const k = canon.get(t);
      freq.set(k, (freq.get(k) || 0) + 1);
      let sm = surface.get(k);
      if (!sm) { sm = new Map(); surface.set(k, sm); }
      sm.set(t, (sm.get(t) || 0) + 1);
      set.add(k);
    }
    for (const k of set) ctx.set(k, (ctx.get(k) || 0) + 1);
    winSets.push([...set]);
  }
  let Nin = 0;
  for (const v of freq.values()) Nin += v;
  const prep = { ex, freq, surface, ctx, winSets, Nin, assocBy: new WeakMap() };
  if (byKey.size > 12) byKey.delete(byKey.keys().next().value);
  byKey.set(key, prep);
  return prep;
}

function associations(prep, reference) {
  let assoc = prep.assocBy.get(reference);
  if (!assoc) {
    assoc = new Map();
    for (const [k, a] of prep.freq) {
      let r = 0;
      for (const form of prep.surface.get(k).keys()) r += reference.counts.get(form) ?? 0;
      if (r === 0) r = reference.floor;
      assoc.set(k, association(a, prep.Nin, r, reference.total));
    }
    prep.assocBy.set(reference, assoc);
  }
  return assoc;
}

export function buildNetwork(docs, term, { window = 5, topN = 30, minCooc = 2, maxLinksPerNode = 6, stop = new Set(), rank = 'frequency', reference = null } = {}) {
  const prep = prepare(docs, term, window, stop);
  const { ex, freq, surface, ctx, winSets } = prep;
  const vocab = freq.size;
  const assoc = reference ? associations(prep, reference) : new Map();

  const useDistinctive = rank === 'distinctive' && reference;
  let candidates = [...freq.entries()];
  if (useDistinctive) {
    candidates = candidates
      .filter(([k]) => (ctx.get(k) || 0) >= DISTINCTIVE.minWindows && assoc.get(k).g2 >= DISTINCTIVE.minG2)
      .sort((a, b) => assoc.get(b[0]).lr - assoc.get(a[0]).lr || b[1] - a[1]);
  } else {
    candidates = candidates
      .filter(([k]) => (ctx.get(k) || 0) >= Math.min(2, ex.windows.length))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  const eligible = candidates.length;
  const top = candidates.slice(0, topN).map(([k]) => k);
  const n = top.length;
  const idx = new Map(top.map((k, i) => [k, i]));

  // pairwise co-occurrence among the top-N neighbors (dense n×n counts)
  const pair = new Uint32Array(n * n);
  const samples = top.map(() => []);
  const present = [];
  for (let wi = 0; wi < winSets.length; wi++) {
    present.length = 0;
    for (const k of winSets[wi]) { const i = idx.get(k); if (i !== undefined) present.push(i); }
    if (!present.length) continue;
    present.sort((a, b) => a - b);
    const text = ex.windows[wi].text;
    for (let a = 0; a < present.length; a++) {
      const i = present[a];
      if (samples[i].length < 6) samples[i].push(text);
      for (let b = a + 1; b < present.length; b++) pair[i * n + present[b]]++;
    }
  }

  const label = (k) => [...surface.get(k).entries()].sort((a, b) => b[1] - a[1])[0][0];
  const nodes = [
    { id: '__target__', label: term.trim(), freq: ex.occurrences, cooc: ex.windows.length, target: true },
    ...top.map((k, i) => ({ id: k, label: label(k), freq: freq.get(k), cooc: ctx.get(k), samples: samples[i], rank: i + 1, ...(assoc.get(k) || {}) })),
  ];

  const links = top.map((k) => ({ source: '__target__', target: k, weight: ctx.get(k), kind: 'target' }));
  // neighbor–neighbor links: above threshold, and only each node's strongest few
  const cand = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const c = pair[i * n + j];
      if (c >= minCooc) cand.push({ source: top[i], target: top[j], weight: c, kind: 'pair' });
    }
  }
  cand.sort((a, b) => b.weight - a.weight);
  const deg = new Map();
  for (const l of cand) {
    const da = deg.get(l.source) || 0;
    const db = deg.get(l.target) || 0;
    if (da >= maxLinksPerNode && db >= maxLinksPerNode) continue;
    deg.set(l.source, da + 1); deg.set(l.target, db + 1);
    links.push(l);
  }

  return {
    nodes, links,
    stats: {
      docs: docs.length, docsWithHits: ex.docsWithHits, occurrences: ex.occurrences,
      windows: ex.windows.length, vocabulary: vocab, pairLinks: links.length - top.length,
      rank: useDistinctive ? 'distinctive' : 'frequency', eligible,
    },
  };
}
