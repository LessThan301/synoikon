import { LANGS } from './languages.js';

const ALL = LANGS.map((l) => l.code);

// Corpus collection. Every source here is free, key-less and CORS-enabled,
// so the whole app can run as static files (e.g. on GitHub Pages).

const TIMEOUT_MS = 15000;
// Wikimedia's API etiquette: identify the tool and a contact. Browsers may not override
// User-Agent, but Wikimedia's CORS policy explicitly allows the Api-User-Agent header.
export const API_USER_AGENT = 'LessThan301 synoikon (github.com/LessThan301/synoikon)';
const IS_NODE = typeof window === 'undefined';
const isWikimedia = (url) => /^https:\/\/[a-z-]+\.(wikipedia|wikiquote|wiktionary)\.org\//.test(url);

// Optional global limit on concurrent requests (the precompute script sets 3).
let maxConcurrent = Infinity, active = 0;
const waiting = [];
export function setMaxConcurrent(n) { maxConcurrent = n; }
async function acquire() {
  if (active < maxConcurrent) { active++; return; }
  await new Promise((r) => waiting.push(r));
  active++;
}
function release() { active--; waiting.shift()?.(); }
export const requestStats = { requests: 0, retries: 0, retryAfterWaits: 0 };

/** Seconds to wait from a Retry-After header (delta-seconds or HTTP date), capped. */
export function retryAfterMs(value, cap = 120000) {
  if (!value) return null;
  const secs = /^\d+$/.test(value.trim()) ? +value : (Date.parse(value) - Date.now()) / 1000;
  return Number.isFinite(secs) ? Math.min(cap, Math.max(0, secs * 1000)) : null;
}

async function getJSON(url, attempt = 0) {
  await acquire();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let data, error;
  try {
    const headers = {};
    if (isWikimedia(url)) headers['Api-User-Agent'] = API_USER_AGENT;
    if (IS_NODE) headers['User-Agent'] = `${API_USER_AGENT} Node.js`;
    requestStats.requests++;
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) {
      error = new Error(`HTTP ${res.status}`);
      error.retry = res.status === 429 || res.status >= 500;
      error.wait = retryAfterMs(res.headers.get('Retry-After'));
    } else data = await res.json();
  } catch (err) {
    error = err;
  } finally {
    clearTimeout(timer);
    release();
  }
  if (!error) return data;
  // Rate limits / transient errors: honour Retry-After, else back off exponentially; retry up to 3 times.
  if (attempt < 3 && (error.retry || error.name === 'TypeError')) {
    requestStats.retries++;
    if (error.wait != null) requestStats.retryAfterWaits++;
    await new Promise((r) => setTimeout(r, error.wait ?? (1000 * 2 ** attempt + Math.random() * 500)));
    return getJSON(url, attempt + 1);
  }
  throw error;
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

// Template sentences from disambiguation/sister-project boxes that otherwise show up as
// "neighbours" of every word (e.g. "Look up gold in Wiktionary, the free dictionary.").
const BOILERPLATE = [
  /look up [^.]{1,80}? in wiktionary,? the free dictionary\.?/gi,
  /wiktionary,? the free dictionary/gi,
  /the free encyclopedia/gi,
];
export function cleanText(text) {
  let t = text;
  for (const re of BOILERPLATE) t = t.replace(re, ' ');
  return t;
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
    label: 'Wikipedia search snippets', langs: ALL, default: true,
    fetch: (term, lang, size) => mediaWikiSnippets(`${lang}.wikipedia.org`, 'Wikipedia snippets', term, size),
  },
  wikiIntros: {
    label: 'Wikipedia article intros', langs: ALL, default: true,
    fetch: (term, lang, size) => wikipediaIntros(lang, term, Math.max(20, Math.round(size / 10))),
  },
  wikiquote: {
    label: 'Wikiquote', langs: ALL, default: true,
    fetch: (term, lang, size) => mediaWikiSnippets(`${lang}.wikiquote.org`, 'Wikiquote', term, Math.round(size / 2)),
  },
  wiktionary: {
    label: 'Wiktionary', langs: ALL, default: false,
    fetch: (term, lang, size) => mediaWikiSnippets(`${lang}.wiktionary.org`, 'Wiktionary', term, Math.round(size / 4)),
  },
  hackerNews: {
    label: 'Hacker News comments (English only)', langs: ['en'], default: true,
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
      const docsOk = r.value.map((d) => ({ ...d, text: cleanText(d.text || '') })).filter((d) => d.text.trim());
      docs.push(...docsOk);
      report.push({ key: keys[i], label, count: docsOk.length });
    } else {
      report.push({ key: keys[i], label, count: 0, error: String(r.reason?.message || r.reason) });
    }
  });
  return { docs, report };
}
