import { collectCorpus, SOURCES } from './sources.js';
import { buildNetwork } from './analysis.js';
import { createGraph } from './graph.js';
import { STOP_EN } from './stopwords.js';
import { loadReference } from './reference.js';
import { LANGS, getLang, tokenize, formMatcher, normalize } from './languages.js';

const $ = (id) => document.getElementById(id);
const els = {
  form: $('search'), term: $('term'), lang: $('lang'), go: $('go'), canvas: $('graph'),
  empty: $('empty'), loading: $('loading'), loadingText: $('loadingText'), error: $('error'), errorText: $('errorText'),
  topN: $('topN'), window: $('window'), minCooc: $('minCooc'), maxLinks: $('maxLinks'), size: $('size'),
  stopLang: $('stopLang'), stopEn: $('stopEn'), stopLangName: $('stopLangName'), stopEnRow: $('stopEnRow'), sourceBoxes: $('sourceBoxes'),
  stats: $('stats'), statsBox: $('statsBox'), samples: $('samples'), samplesBox: $('samplesBox'), sampleFor: $('sampleFor'),
  tableBox: $('tableBox'), tableBody: $('tableBody'), examples: $('examples'),
};

const state = { corpus: null, corpusKey: '', term: '', lang: 'en', graph: null, net: null, requestId: 0, analyseId: 0, refError: '' };
const rankMode = () => document.querySelector('input[name=rank]:checked').value;

// ---- setup ---------------------------------------------------------------
for (const [key, src] of Object.entries(SOURCES)) {
  const lab = document.createElement('label');
  lab.className = 'check';
  lab.innerHTML = `<input type="checkbox" value="${key}" ${src.default ? 'checked' : ''}> ${src.label}`;
  els.sourceBoxes.appendChild(lab);
}
// language selector: native names, grouped
for (const group of [...new Set(LANGS.map((l) => l.group))]) {
  const og = document.createElement('optgroup');
  og.label = group;
  for (const l of LANGS.filter((x) => x.group === group)) {
    const o = document.createElement('option');
    o.value = l.code;
    o.textContent = l.native === l.english ? l.native : `${l.native} (${l.english})`;
    og.appendChild(o);
  }
  els.lang.appendChild(og);
}
els.lang.value = 'en';
for (const [w, lang] of [['river', 'en'], ['trust', 'en'], ['河流', 'zh'], ['नदी', 'hi'], ['نهر', 'ar'], ['Wald', 'de'], ['freedom', 'en']]) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = w; b.dir = 'auto';
  b.title = getLang(lang).english;
  b.onclick = () => { els.lang.value = lang; onLangChange(); search(w); };
  els.examples.appendChild(b);
}

const enabledSources = () => [...els.sourceBoxes.querySelectorAll('input:checked')].map((i) => i.value);
// Stopwords: English list is built in; other languages are fetched on demand.
const stopFiles = new Map();
function loadStopFile(code) {
  if (!stopFiles.has(code)) {
    const p = fetch(`data/stop-${code}.txt`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((t) => new Set(t.split('\n').filter((w) => w && !w.startsWith('#'))));
    p.catch(() => stopFiles.delete(code));
    stopFiles.set(code, p);
  }
  return stopFiles.get(code);
}
const stopCache = new Map(); // same Set object per combination => analysis cache hits
async function stopwords(code) {
  const own = els.stopLang.checked;
  const en = code === 'en' ? own : els.stopEn.checked;
  const key = `${code}|${own}|${en}`;
  if (!stopCache.has(key)) {
    const s = new Set();
    if (en) STOP_EN.forEach((w) => s.add(w));
    if (own && code !== 'en') {
      try { (await loadStopFile(code)).forEach((w) => s.add(w)); }
      catch (err) { state.stopError = `Stopword list for ${getLang(code).english} could not be loaded (${err.message}).`; return s; }
    }
    stopCache.set(key, s);
  }
  return stopCache.get(key);
}

// Web fonts for scripts that many systems lack (loaded only when needed).
const fontLoads = new Map();
function ensureFont(lang) {
  if (!lang.font) return Promise.resolve();
  if (!fontLoads.has(lang.code)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://cdn.jsdelivr.net/npm/@fontsource/${lang.font.pkg}@5/index.css`;
    document.head.appendChild(link);
    fontLoads.set(lang.code, new Promise((res) => { link.onload = res; link.onerror = res; }));
  }
  return fontLoads.get(lang.code);
}
async function fontsFor(lang, text) {
  if (!lang.font) return;
  await ensureFont(lang);
  try { await document.fonts.load(`16px "${lang.font.family}"`, text); } catch { /* fall back to system fonts */ }
}

function onLangChange() {
  const lang = getLang(els.lang.value);
  els.stopLangName.textContent = lang.native;
  els.stopEnRow.classList.toggle('hidden', lang.code === 'en');
  for (const input of els.sourceBoxes.querySelectorAll('input')) {
    const ok = SOURCES[input.value].langs.includes(lang.code);
    input.disabled = !ok;
    input.parentElement.classList.toggle('na', !ok);
    input.parentElement.title = ok ? '' : `Not available in ${lang.english}`;
  }
  els.term.placeholder = lang.code === 'en' ? 'Type a word, e.g. river' : `${lang.native}: ${lang.sample}`;
  ensureFont(lang);
}
const params = () => ({
  topN: +els.topN.value, window: +els.window.value, minCooc: +els.minCooc.value, maxLinksPerNode: +els.maxLinks.value,
});

function show(which, text) {
  els.empty.classList.toggle('hidden', which !== 'empty');
  els.loading.classList.toggle('hidden', which !== 'loading');
  els.error.classList.toggle('hidden', which !== 'error');
  if (which === 'loading') els.loadingText.textContent = text || 'Collecting text…';
  if (which === 'error') els.errorText.textContent = text;
}

// ---- main flow -----------------------------------------------------------
async function search(term) {
  term = (term || '').trim();
  if (!term) return;
  els.term.value = term;
  const lang = els.lang.value;
  const size = +els.size.value;
  const enabled = enabledSources().filter((k) => SOURCES[k].langs.includes(lang));
  if (!enabled.length) { show('error', 'Select at least one source in Settings.'); return; }
  const key = [term.toLowerCase(), lang, size, enabled.join(',')].join('|');
  updateHash(term, lang);
  document.title = `${term} · Contexter`;

  const id = ++state.requestId;
  if (state.corpusKey !== key) {
    show('loading', `Collecting text about “${term}”…`);
    els.go.disabled = true;
    try {
      const corpus = await collectCorpus(term, {
        lang, size, enabled,
        onProgress: (d, t, label) => { if (id === state.requestId) els.loadingText.textContent = `Collecting text about “${term}”… ${d}/${t} sources (${label} done)`; },
      });
      if (id !== state.requestId) return; // a newer search has started
      state.corpus = corpus; state.corpusKey = key;
    } catch (err) {
      if (id === state.requestId) show('error', `Could not reach the text sources (${err.message}). Check your connection and try again.`);
      return;
    } finally {
      if (id === state.requestId) els.go.disabled = false;
    }
  }
  state.term = term;
  state.lang = lang;
  await analyse();
}

function updateHash(term, lang) {
  history.replaceState(null, '', `#q=${encodeURIComponent(term)}&lang=${lang}${rankMode() === 'frequency' ? '&rank=frequency' : ''}`);
}

async function analyse() {
  const { corpus, term } = state;
  if (!corpus) return;
  const aid = ++state.analyseId;
  const lang = getLang(state.lang);
  let reference = null;
  state.refError = '';
  state.stopError = '';
  const stop = await stopwords(lang.code);
  if (aid !== state.analyseId) return;
  if (rankMode() === 'distinctive') {
    try { reference = await loadReference(state.lang); }
    catch (err) { state.refError = `Background word list for ${lang.english} could not be loaded (${err.message}); ranking by frequency instead.`; }
    if (aid !== state.analyseId) return; // superseded
  }
  if (!corpus.docs.length) {
    const errs = corpus.report.filter((r) => r.error);
    show('error', errs.length === corpus.report.length
      ? `All sources failed: ${errs.map((e) => `${e.label}: ${e.error}`).join('; ')}`
      : `No text found for “${term}”. Check the spelling or try another language.`);
    state.graph?.clear(); state.drawnTerm = '';
    renderStats(null);
    return;
  }
  const net = buildNetwork(corpus.docs, term, { ...params(), stop, rank: rankMode(), reference, lang });
  state.net = net;
  renderStats(net);
  if (net.nodes.length < 2) {
    show('error', `Found ${net.stats.occurrences} occurrence(s) of “${term}”, but not enough recurring neighbors to draw a network. Try a larger corpus, a wider window, or another word.`);
    state.graph?.clear(); state.drawnTerm = '';
    return;
  }
  show('none');
  state.graph.setLanguage(lang);
  state.graph.setData(net, { resetView: state.drawnTerm !== `${term}|${state.lang}` });
  fontsFor(lang, net.nodes.map((n) => n.label).join('')).then(() => { if (aid === state.analyseId) state.graph.redraw(); });
  state.drawnTerm = `${term}|${state.lang}`;
  renderSamples(null);
  renderTable(net);
}

// ---- side panel ----------------------------------------------------------
function renderStats(net) {
  els.statsBox.classList.remove('hidden');
  const rep = state.corpus.report.map((r) => r.error
    ? `<li class="err">${r.label}: failed (${esc(r.error)})</li>`
    : `<li>${r.label}: <b>${r.count}</b> texts</li>`).join('');
  els.stats.innerHTML = net
    ? `<p><b>${net.stats.occurrences}</b> instances of “<bdi>${esc(state.term)}</bdi>” (${esc(getLang(state.lang).english)}) in <b>${net.stats.docsWithHits}</b> of ${net.stats.docs} texts,
       giving <b>${net.stats.windows}</b> unique context windows and <b>${net.stats.vocabulary}</b> distinct neighbor words.
       Showing the top <b>${net.nodes.length - 1}</b> ${net.stats.rank === 'distinctive'
         ? `<b>most distinctive</b> neighbors (of ${net.stats.eligible} that pass the significance test)`
         : 'most <b>frequent</b> neighbors'} with <b>${net.stats.pairLinks}</b> neighbor–neighbor lines.</p>
       ${[state.refError, state.stopError].filter(Boolean).map((e) => `<p class="err">${esc(e)}</p>`).join('')}<ul>${rep}</ul>`
    : `<ul>${rep}</ul>`;
}

function renderSamples(d) {
  const net = state.net;
  if (!net) return;
  const lang = getLang(state.lang);
  els.samplesBox.classList.remove('hidden');
  const hl = highlighter(state.term, lang);
  let items;
  if (d && !d.target) {
    els.sampleFor.innerHTML = `· with “<bdi>${esc(d.label)}</bdi>”`;
    items = (d.samples || []).map((text) => ({ text }));
  } else {
    els.sampleFor.textContent = '';
    const seen = new Set();
    items = [];
    for (const doc of state.corpus.docs) {
      if (items.length >= 12) break;
      if (seen.has(doc.source + doc.title)) continue;
      const pos = hl.first(doc.text);
      if (pos < 0) continue;
      seen.add(doc.source + doc.title);
      const a = Math.max(0, pos - 120);
      items.push({ doc, text: (a > 0 ? '… ' : '') + doc.text.slice(a, pos + 160).trim() + (pos + 160 < doc.text.length ? ' …' : '') });
    }
  }
  const neighbor = d && !d.target ? d.id : null;
  els.samples.innerHTML = items.map(({ text, doc }) => `<li dir="auto">${hl.mark(text, neighbor)}${doc
    ? ` <a href="${doc.url}" target="_blank" rel="noopener" dir="auto">${esc(doc.source)} · ${esc(doc.title)}</a>` : ''}</li>`).join('');
}

/** Find / highlight the search word (and optionally a neighbor) in snippets, language-aware. */
function highlighter(term, lang) {
  const needle = term.trim().toLowerCase();
  if (lang.segment === 'intl') { // Chinese: substring matching
    const re = (w) => new RegExp(escRe(w), 'gi');
    return {
      first: (text) => text.toLowerCase().indexOf(needle),
      mark: (text, nb) => {
        let h = esc(text).replace(re(esc(term.trim())), (m) => `\u0001${m}\u0002`);
        if (nb) h = h.replace(re(esc(nb)), (m) => `<mark class="n">${m}</mark>`);
        return h.replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>');
      },
    };
  }
  const q = tokenize(term, lang).map((t) => t.low);
  const isTarget = formMatcher(q[q.length - 1] || '', lang);
  const plural = (w) => (lang.plurals ? w.replace(/(ies|es|s)$/, '') : w);
  return {
    first: (text) => { for (const t of tokenize(text, lang)) if (isTarget(t.low)) return t.s; return -1; },
    mark: (text, nb) => {
      const toks = tokenize(text, lang);
      let out = '', last = 0;
      for (const t of toks) {
        const cls = isTarget(t.low) ? '' : nb && plural(t.low) === plural(nb) ? ' class="n"' : null;
        if (cls === null) continue;
        out += esc(text.slice(last, t.s)) + `<mark${cls}>${esc(text.slice(t.s, t.e))}</mark>`;
        last = t.e;
      }
      return out + esc(text.slice(last));
    },
  };
}

function renderTable(net) {
  els.tableBox.classList.remove('hidden');
  $('tableNote').textContent = net.stats.rank === 'distinctive'
    ? 'Ranked by distinctiveness (log₂ ratio vs. general Wikipedia text). Circle area still shows frequency.'
    : 'Ranked by frequency inside the context windows.';
  els.tableBody.innerHTML = net.nodes.filter((n) => !n.target)
    .map((n) => `<tr data-w="${esc(n.label)}"><td dir="auto">${esc(n.label)}</td><td>${n.freq}</td><td>${n.cooc}</td><td>${n.lr == null ? '–' : n.lr.toFixed(1)}</td></tr>`).join('');
}
els.tableBody.addEventListener('click', (e) => { const tr = e.target.closest('tr'); if (tr) search(tr.dataset.w); });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- events --------------------------------------------------------------
els.form.addEventListener('submit', (e) => { e.preventDefault(); search(els.term.value); });
let t;
for (const id of ['topN', 'window', 'minCooc', 'maxLinks']) {
  const input = els[id];
  const out = $(`${id}Out`);
  input.addEventListener('input', () => {
    out.textContent = input.value;
    clearTimeout(t); t = setTimeout(analyse, 150);
  });
}
for (const el of [els.stopLang, els.stopEn]) el.addEventListener('change', analyse);
for (const r of document.querySelectorAll('input[name=rank]')) r.addEventListener('change', () => { if (state.term) updateHash(state.term, state.lang); analyse(); });
els.lang.addEventListener('change', onLangChange);
for (const el of [els.size, els.lang, els.sourceBoxes]) el.addEventListener('change', () => { if (state.term) search(state.term); });
$('zoomIn').onclick = () => state.graph?.zoomBy(1.3);
$('zoomOut').onclick = () => state.graph?.zoomBy(1 / 1.3);
$('zoomFit').onclick = () => state.graph?.fit();
$('download').onclick = downloadSvg;

function downloadSvg() {
  const svg = state.net && state.graph?.toSVG();
  if (!svg) return;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `contexter-${state.term}.svg`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---- start (supports shareable links like #q=river&lang=en) ---------------
if (typeof d3 === 'undefined') {
  show('error', 'The graph library (D3) could not be loaded. Check your connection or ad-blocker and reload.');
} else {
  state.graph = createGraph(els.canvas, document.getElementById('tooltip'), {
    onSelect: (word) => search(word),
    onFocus: (d) => renderSamples(d),
  });
  window.__contexter = state.graph.debug; // read-only hooks for automated tests
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('rank') === 'frequency') document.querySelector('input[name=rank][value=frequency]').checked = true;
  if (h.get('lang') && [...els.lang.options].some((o) => o.value === h.get('lang'))) els.lang.value = h.get('lang');
  onLangChange();
  if (h.get('q')) search(h.get('q')); else show('empty');
}
