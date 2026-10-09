// Per-language configuration and the language-aware tokenizer.
// Pure module (no DOM): used by the browser app and by the Node build/test scripts.

const MAJOR = 'Most spoken';
const EU = 'European';

/**
 * code     Wikipedia/Wikiquote/Wiktionary subdomain
 * native   name shown in the selector
 * dir      text direction of the script
 * minLen   shortest neighbor word kept (UTF-16 units)
 * forms    how inflected forms of the search word are matched:
 *          'en'     English/German suffix rules (river/rivers, Wald/Walde…)
 *          'prefix' stem = word minus its last stemTrim letters (if ≥ stemMin long), followed by ≤ maxExtra letters
 *          'exact'  exact match (after normalisation)
 * plurals  merge simple -s/-es plurals among neighbors
 * segment  'intl' → Intl.Segmenter word segmentation (Chinese), with a character-bigram fallback
 * font     extra web font (Fontsource via jsDelivr) loaded on demand
 * freq     background frequency list source (see README)
 */
export const LANGS = [
  { code: 'en', native: 'English', english: 'English', group: MAJOR, forms: 'en', plurals: true, hn: true, freq: 'wikipedia-ilya', sample: 'river' },
  { code: 'zh', native: '中文', english: 'Chinese (Mandarin)', group: MAJOR, forms: 'exact', minLen: 2, segment: 'intl', freq: 'leipzig', sample: '河流',
    font: { family: 'Noto Sans SC', pkg: 'noto-sans-sc' } },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', group: MAJOR, forms: 'prefix', stemMin: 3, maxExtra: 4, minLen: 2, freq: 'leipzig', sample: 'नदी',
    font: { family: 'Noto Sans Devanagari', pkg: 'noto-sans-devanagari' } },
  { code: 'es', native: 'Español', english: 'Spanish', group: MAJOR, forms: 'prefix', plurals: true, freq: 'wikipedia-ilya', sample: 'río' },
  { code: 'ar', native: 'العربية', english: 'Arabic', group: MAJOR, dir: 'rtl', forms: 'exact', minLen: 2, freq: 'wikipedia-ilya', sample: 'نهر',
    font: { family: 'Noto Naskh Arabic', pkg: 'noto-naskh-arabic' } },
  { code: 'fr', native: 'Français', english: 'French', group: MAJOR, forms: 'prefix', plurals: true, freq: 'wikipedia-ilya', sample: 'fleuve' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali', group: MAJOR, forms: 'prefix', stemMin: 3, maxExtra: 4, minLen: 2, freq: 'leipzig', sample: 'নদী',
    font: { family: 'Noto Sans Bengali', pkg: 'noto-sans-bengali' } },
  { code: 'pt', native: 'Português', english: 'Portuguese', group: MAJOR, forms: 'prefix', plurals: true, freq: 'wikipedia-ilya', sample: 'rio' },
  { code: 'ru', native: 'Русский', english: 'Russian', group: MAJOR, forms: 'prefix', stemMin: 4, maxExtra: 2, freq: 'wikipedia-ilya', sample: 'река' },
  { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian', group: MAJOR, forms: 'prefix', stemMin: 99, freq: 'leipzig', sample: 'sungai' },
  { code: 'ur', native: 'اردو', english: 'Urdu', group: MAJOR, dir: 'rtl', forms: 'prefix', stemMin: 99, maxExtra: 2, minLen: 2, freq: 'leipzig', sample: 'دریا',
    font: { family: 'Noto Nastaliq Urdu', pkg: 'noto-nastaliq-urdu' } },
  { code: 'de', native: 'Deutsch', english: 'German', group: EU, forms: 'en', plurals: true, freq: 'wikipedia-ilya', sample: 'Fluss' },
  { code: 'it', native: 'Italiano', english: 'Italian', group: EU, forms: 'prefix', plurals: true, freq: 'wikipedia-ilya', sample: 'fiume' },
  { code: 'pl', native: 'Polski', english: 'Polish', group: EU, forms: 'prefix', stemMin: 4, maxExtra: 2, freq: 'wikipedia-ilya', sample: 'rzeka' },
  { code: 'uk', native: 'Українська', english: 'Ukrainian', group: EU, forms: 'prefix', stemMin: 4, maxExtra: 2, freq: 'wikipedia-ilya', sample: 'річка' },
  { code: 'nl', native: 'Nederlands', english: 'Dutch', group: EU, forms: 'prefix', stemMin: 99, plurals: true, freq: 'wikipedia-ilya', sample: 'rivier' },
  { code: 'ro', native: 'Română', english: 'Romanian', group: EU, forms: 'prefix', freq: 'leipzig', sample: 'râu' },
  { code: 'el', native: 'Ελληνικά', english: 'Greek', group: EU, forms: 'prefix', stemMin: 5, stemTrim: 2, freq: 'leipzig', sample: 'ποταμός' },
  { code: 'hu', native: 'Magyar', english: 'Hungarian', group: EU, forms: 'prefix', stemMin: 99, maxExtra: 5, freq: 'leipzig', sample: 'folyó' },
  { code: 'cs', native: 'Čeština', english: 'Czech', group: EU, forms: 'prefix', stemMin: 4, maxExtra: 2, freq: 'leipzig', sample: 'řeka' },
  { code: 'sv', native: 'Svenska', english: 'Swedish', group: EU, forms: 'prefix', stemMin: 99, freq: 'wikipedia-ilya', sample: 'flod' },
].map((l) => ({ dir: 'ltr', minLen: 3, stemMin: 5, stemTrim: 1, maxExtra: 3, plurals: false, hn: false, ...l }));

export const LANG = Object.fromEntries(LANGS.map((l) => [l.code, l]));
export const getLang = (code) => LANG[code] || LANG.en;

// ---- normalisation (applied to tokens, the search word, stopwords and background lists alike)
const AR_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g; // harakat, Quranic marks, tatweel
const AR_ARTICLE = /^(?:وال|فال|بال|كال|لل|ال)(?=.{3,})/u;                  // clitic + definite article
export function normalize(low, lang) {
  switch (lang.code) {
    case 'ar':
      return low.replace(AR_MARKS, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(AR_ARTICLE, '');
    case 'ur':
      return low.replace(AR_MARKS, '');
    case 'el': // accent-insensitive: νερό == ΝΕΡΟ
      return low.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
    default:
      return low;
  }
}

// ---- tokenizer -------------------------------------------------------------
// Letters/digits followed by letters, digits, combining marks (Devanagari/Bengali
// vowel signs, Arabic harakat), ZWNJ/ZWJ (Indic conjuncts, Persian/Urdu), apostrophes, hyphens.
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}\p{M}\u200c\u200d'’\-]*/gu;
const HAN_RUN = /\p{Script=Han}+/gu;
// Bigram fallback: skip bigrams that contain very frequent function characters.
const HAN_FUNCTION = new Set('的是一了在和有也为為之与與等及中又称稱名指被以于於其这這那个個们們它他她我你不就都而并並或从從到对對把将將由所上下'.split(''));

let segmenterCache = null;
export const segmenterSupported = () => typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
let forceFallback = false;
export function setSegmenterFallback(v) { forceFallback = v; } // for tests

function pushWord(out, raw, s, lang) {
  raw = raw.replace(/['’]s$/i, '').replace(/['’\-\u200c\u200d]+$/, '');
  if (!raw) return;
  out.push({ raw, low: normalize(raw.toLowerCase(), lang), s, e: s + raw.length });
}

export function tokenize(text, lang = LANG.en) {
  text = String(text);
  const out = [];
  if (lang.segment === 'intl') {
    if (segmenterSupported() && !forceFallback) {
      segmenterCache ??= new Intl.Segmenter(lang.code, { granularity: 'word' });
      for (const s of segmenterCache.segment(text)) {
        if (s.isWordLike) pushWord(out, s.segment, s.index, lang);
      }
      return out;
    }
    // Fallback: overlapping character bigrams for Han runs, regex words elsewhere.
    let last = 0;
    for (const m of text.matchAll(HAN_RUN)) {
      for (const w of text.slice(last, m.index).matchAll(WORD_RE)) pushWord(out, w[0], last + w.index, lang);
      const run = m[0];
      if (run.length === 1) pushWord(out, run, m.index, lang);
      for (let i = 0; i + 1 < run.length; i++) {
        if (HAN_FUNCTION.has(run[i]) || HAN_FUNCTION.has(run[i + 1])) continue;
        pushWord(out, run.slice(i, i + 2), m.index + i, lang);
      }
      last = m.index + run.length;
    }
    for (const w of text.slice(last).matchAll(WORD_RE)) pushWord(out, w[0], last + w.index, lang);
    return out;
  }
  for (const m of text.matchAll(WORD_RE)) pushWord(out, m[0], m.index, lang);
  return out;
}

// ---- matching inflected forms of the search word ----------------------------
function englishForms(w) {
  const forms = new Set([w, w + 's', w + 'es', w + 'e', w + 'n', w + 'en', w + 'er', w + 'ern', w + 'ed', w + 'ing']);
  if (w.endsWith('y')) forms.add(w.slice(0, -1) + 'ies');
  if (w.endsWith('e')) { forms.add(w + 'd'); forms.add(w.slice(0, -1) + 'ing'); }
  if (w.endsWith('s') && w.length > 3) forms.add(w.slice(0, -1));
  if (w.endsWith('ies')) forms.add(w.slice(0, -3) + 'y');
  return forms;
}

/** Predicate: is token form `t` an inflection of (normalised) word `w`? */
export function formMatcher(w, lang) {
  if (lang.forms === 'en') { const f = englishForms(w); return (t) => f.has(t); }
  if (lang.forms === 'prefix') {
    const stem = w.length >= lang.stemMin ? w.slice(0, -lang.stemTrim) : w;
    const max = stem.length + lang.maxExtra;
    return (t) => t === w || (t.length <= max && t.length >= stem.length && t.startsWith(stem));
  }
  return (t) => t === w;
}

/** Forms of the search word for highlighting snippets (finite set for display). */
export function displayForms(term, lang) {
  return tokenize(term, lang).map((t) => formMatcher(t.low, lang));
}
