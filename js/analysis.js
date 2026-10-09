// Text analysis: tokenizing, finding the target, counting neighbors and
// their pairwise co-occurrence. Pure functions (no DOM) so they can be
// tested in Node as well.

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}\p{M}'’\-]*/gu;

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
    const toks = tokenize(doc.text);
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
export function buildNetwork(docs, term, { window = 5, topN = 30, minCooc = 2, maxLinksPerNode = 6, stop = new Set() } = {}) {
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
      if (!surface.has(k)) surface.set(k, new Map());
      const s = surface.get(k); s.set(t, (s.get(t) || 0) + 1);
      set.add(k);
    }
    for (const k of set) ctx.set(k, (ctx.get(k) || 0) + 1);
    winSets.push(set);
  }

  const vocab = freq.size;
  const top = [...freq.entries()]
    .filter(([k]) => (ctx.get(k) || 0) >= Math.min(2, ex.windows.length))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([k]) => k);
  const idx = new Map(top.map((k, i) => [k, i]));

  // pairwise co-occurrence among the top-N neighbors
  const pair = new Map();
  const samples = new Map(top.map((k) => [k, []]));
  ex.windows.forEach((w, wi) => {
    const present = [...winSets[wi]].filter((k) => idx.has(k)).sort((a, b) => idx.get(a) - idx.get(b));
    for (const k of present) { const arr = samples.get(k); if (arr.length < 6) arr.push(w.text); }
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const key = present[i] + '\u0000' + present[j];
        pair.set(key, (pair.get(key) || 0) + 1);
      }
    }
  });

  const label = (k) => [...surface.get(k).entries()].sort((a, b) => b[1] - a[1])[0][0];
  const nodes = [
    { id: '__target__', label: term.trim(), freq: ex.occurrences, cooc: ex.windows.length, target: true },
    ...top.map((k) => ({ id: k, label: label(k), freq: freq.get(k), cooc: ctx.get(k), samples: samples.get(k) })),
  ];

  const links = top.map((k) => ({ source: '__target__', target: k, weight: ctx.get(k), kind: 'target' }));
  // neighbor–neighbor links: above threshold, and only each node's strongest few
  const cand = [...pair.entries()]
    .map(([key, c]) => { const [a, b] = key.split('\u0000'); return { source: a, target: b, weight: c, kind: 'pair' }; })
    .filter((l) => l.weight >= minCooc)
    .sort((a, b) => b.weight - a.weight);
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
    },
  };
}
