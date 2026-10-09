// Corpus collection. Every source here is free, key-less and CORS-enabled,
// so the whole app can run as static files (e.g. on GitHub Pages).

const TIMEOUT_MS = 15000;

async function getJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const decoder = typeof document !== 'undefined' ? document.createElement('textarea') : null;
export function htmlToText(html) {
  if (!html) return '';
  const noTags = String(html)
    .replace(/<\s*(br|p|div|li)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  if (decoder) { decoder.innerHTML = noTags; return decoder.value; }
  return noTags.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');
}

function qs(params) {
  return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

// MediaWiki full-text search: every hit comes with a snippet around the term.
async function mediaWikiSnippets(host, sourceName, term, total) {
  const out = [];
  for (let offset = 0; offset < total; offset += 500) {
    const limit = Math.min(500, total - offset);
    const url = `https://${host}/w/api.php?` + qs({
      action: 'query', list: 'search', srsearch: term, srlimit: limit, sroffset: offset,
      srprop: 'snippet', format: 'json', origin: '*',
    });
    const data = await getJSON(url);
    const hits = data?.query?.search ?? [];
    for (const h of hits) {
      out.push({
        source: sourceName, title: h.title,
        url: `https://${host}/wiki/${encodeURIComponent(h.title.replace(/ /g, '_'))}`,
        text: htmlToText(h.snippet),
      });
    }
    if (hits.length < limit || !data.continue) break;
  }
  return out;
}

// Plain-text intro sections of the top matching articles (longer running text).
async function wikipediaIntros(lang, term, pages) {
  const out = [];
  for (let offset = 0; offset < pages; offset += 20) {
    const url = `https://${lang}.wikipedia.org/w/api.php?` + qs({
      action: 'query', generator: 'search', gsrsearch: term, gsrlimit: 20, gsroffset: offset,
      prop: 'extracts', exintro: 1, explaintext: 1, exlimit: 20, format: 'json', origin: '*',
    });
    const data = await getJSON(url);
    const pagesObj = data?.query?.pages ?? {};
    for (const p of Object.values(pagesObj)) {
      if (!p.extract) continue;
      out.push({
        source: 'Wikipedia articles', title: p.title,
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
        text: p.extract,
      });
    }
    if (!data.continue) break;
  }
  return out;
}

// Hacker News comments & stories via the public Algolia search API.
async function hackerNews(term, n) {
  const url = 'https://hn.algolia.com/api/v1/search?' + qs({
    query: term, tags: 'comment', hitsPerPage: n, typoTolerance: 'false',
  });
  const data = await getJSON(url);
  return (data.hits ?? []).map((h) => ({
    source: 'Hacker News', title: h.story_title || `comment by ${h.author}`,
    url: `https://news.ycombinator.com/item?id=${h.objectID}`,
    text: htmlToText(h.comment_text),
  }));
}

export const SOURCES = {
  wikiSnippets: {
    label: 'Wikipedia search snippets', langs: ['en', 'de', 'fr', 'es', 'it', 'nl'], default: true,
    fetch: (term, lang, size) => mediaWikiSnippets(`${lang}.wikipedia.org`, 'Wikipedia snippets', term, size),
  },
  wikiIntros: {
    label: 'Wikipedia article intros', langs: ['en', 'de', 'fr', 'es', 'it', 'nl'], default: true,
    fetch: (term, lang, size) => wikipediaIntros(lang, term, Math.max(20, Math.round(size / 10))),
  },
  wikiquote: {
    label: 'Wikiquote', langs: ['en', 'de', 'fr', 'es', 'it', 'nl'], default: true,
    fetch: (term, lang, size) => mediaWikiSnippets(`${lang}.wikiquote.org`, 'Wikiquote', term, Math.round(size / 2)),
  },
  wiktionary: {
    label: 'Wiktionary', langs: ['en', 'de', 'fr', 'es', 'it', 'nl'], default: false,
    fetch: (term, lang, size) => mediaWikiSnippets(`${lang}.wiktionary.org`, 'Wiktionary', term, Math.round(size / 4)),
  },
  hackerNews: {
    label: 'Hacker News comments', langs: ['en'], default: true,
    fetch: (term, lang, size) => hackerNews(term, Math.min(1000, Math.round(size / 2))),
  },
};

/**
 * Gather a corpus for `term`. Sources are fetched in parallel; a failing
 * source is reported but does not break the others.
 */
export async function collectCorpus(term, { lang = 'en', size = 500, enabled, onProgress } = {}) {
  const keys = Object.keys(SOURCES).filter((k) => enabled.includes(k) && SOURCES[k].langs.includes(lang));
  let done = 0;
  const results = await Promise.allSettled(keys.map(async (k) => {
    try { return await SOURCES[k].fetch(term, lang, size); }
    finally { done++; onProgress?.(done, keys.length, SOURCES[k].label); }
  }));
  const docs = [];
  const report = [];
  results.forEach((r, i) => {
    const label = SOURCES[keys[i]].label;
    if (r.status === 'fulfilled') {
      const docsOk = r.value.filter((d) => d.text && d.text.trim());
      docs.push(...docsOk);
      report.push({ key: keys[i], label, count: docsOk.length });
    } else {
      report.push({ key: keys[i], label, count: 0, error: String(r.reason?.message || r.reason) });
    }
  });
  return { docs, report };
}
