// General-language background frequencies (word counts from all of Wikipedia
// in that language), used to tell distinctive neighbors from merely common ones.
// Data: github.com/IlyaSemenov/wikipedia-word-frequency (MIT), top 40k words.

const cache = new Map();

export function parseReference(text) {
  const counts = new Map();
  let total = 0;
  let min = Infinity;
  for (const line of text.split('\n')) {
    if (!line) continue;
    if (line.startsWith('#total ')) { total = +line.slice(7); continue; }
    if (line.startsWith('#')) continue;
    const sp = line.lastIndexOf(' ');
    const c = +line.slice(sp + 1);
    counts.set(line.slice(0, sp), c);
    if (c < min) min = c;
  }
  // Words not in the top-40k list are rarer than the cutoff: assume half of it.
  return { counts, total, floor: min / 2 };
}

export function loadReference(lang) {
  if (!cache.has(lang)) {
    const p = fetch(`data/freq-${lang}.txt`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(parseReference);
    p.catch(() => cache.delete(lang)); // allow retry
    cache.set(lang, p);
  }
  return cache.get(lang);
}
