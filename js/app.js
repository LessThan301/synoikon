import { collectCorpus, SOURCES } from './sources.js';
import { buildNetwork } from './analysis.js';
import { createGraph } from './graph.js';
import { STOP_EN } from './stopwords.js';
import { loadReference } from './reference.js';
import { LANGS, getLang, tokenize, formMatcher } from './languages.js';
import { POPULAR, wordOfDay, slug } from './words.js';
import { decode, covers, precomputedPath, DEFAULTS } from './precomputed.js';
import { renderCard, cardBlob, FORMATS } from './card.js';
import { setupPWA } from './pwa.js';
import { setupSidebar } from './sidebar.js';
import { loadAnalytics } from './analytics.js';

const $ = (id) => document.getElementById(id);
const els = {
  form: $('search'), term: $('term'), lang: $('lang'), go: $('go'), canvas: $('graph'),
  empty: $('empty'), loading: $('loading'), loadingText: $('loadingText'), error: $('error'), errorText: $('errorText'),
  topN: $('topN'), window: $('window'), minCooc: $('minCooc'), maxLinks: $('maxLinks'), size: $('size'),
  stopLang: $('stopLang'), stopEn: $('stopEn'), stopLangName: $('stopLangName'), stopEnRow: $('stopEnRow'), sourceBoxes: $('sourceBoxes'),
  stats: $('stats'), statsBox: $('statsBox'), samples: $('samples'), samplesBox: $('samplesBox'), sampleFor: $('sampleFor'),
  tableBox: $('tableBox'), tableBody: $('tableBody'), examples: $('examples'), examplesLabel: $('examplesLabel'),
  errorTitle: $('errorTitle'), offlineWords: $('offlineWords'),
};
const SITE = new URL('./', location.href).href.replace(/[?#].*$/, ''); // e.g. https://lessthan301.github.io/contexter/
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const sidebar = setupSidebar({ store });

const state = { corpus: null, corpusKey: '', pre: null, term: '', lang: 'en', graph: null, net: null, requestId: 0, analyseId: 0, refError: '' };
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
function renderExamples(code) {
  const lang = getLang(code);
  els.examplesLabel.textContent = `Popular in ${lang.english} · open instantly`;
  els.examples.innerHTML = '';
  for (const { word, gloss } of POPULAR[code].slice(0, 8)) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = word; b.dir = 'auto';
    if (code !== 'en') b.title = gloss;
    b.onclick = () => search(word);
    els.examples.appendChild(b);
  }
}
function renderWotd(code) {
  const w = wordOfDay(code);
  $('wotdWord').textContent = w.word;
  $('wotdWord').onclick = () => search(w.word);
  $('wotdGloss').textContent = code === 'en' ? 'Tap to see the company it keeps' : `“${w.gloss}” in ${getLang(code).english}`;
  const d = $('wotdDate');
  d.dateTime = w.date;
  d.textContent = new Date(w.date + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  $('wotdLink').href = `#wotd&lang=${code}`;
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
  renderExamples(lang.code);
  renderWotd(lang.code);
  store.set('contexter.lang', lang.code);
}
const params = () => ({
  topN: +els.topN.value, window: +els.window.value, minCooc: +els.minCooc.value, maxLinksPerNode: +els.maxLinks.value,
});

function show(which, text) {
  els.empty.classList.toggle('hidden', which !== 'empty');
  els.loading.classList.toggle('hidden', which !== 'loading');
  els.error.classList.toggle('hidden', which !== 'error');
  if (which === 'loading') els.loadingText.textContent = text || 'Collecting text…';
  if (which === 'error') { els.errorText.textContent = text; els.errorTitle.textContent = 'Hmm.'; els.offlineWords.classList.add('hidden'); }
  for (const id of ['share', 'sbShare', 'sbSvg', 'sbFit']) $(id).disabled = which !== 'none';
}

// ---- main flow -----------------------------------------------------------
// Settings that the precomputed files were built with (anything else needs live text).
function preSettingsOk() {
  const enabled = enabledSources().filter((k) => SOURCES[k].langs.includes(els.lang.value));
  const dflt = DEFAULTS.sources.filter((k) => SOURCES[k].langs.includes(els.lang.value));
  return +els.size.value === DEFAULTS.size && enabled.join() === dflt.join() && els.stopLang.checked
    && (els.lang.value === 'en' || els.stopEn.checked);
}
const preIndex = new Map(); // lang -> Promise<index json | null>
function loadPreIndex(code) {
  if (!preIndex.has(code)) {
    preIndex.set(code, fetch(`data/precomputed/${code}/index.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return preIndex.get(code);
}
async function loadPrecomputed(code, term) {
  const idx = await loadPreIndex(code);
  if (!idx?.words?.[slug(term)]) return null;
  try {
    const r = await fetch(precomputedPath(code, term));
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function search(term, { live = false } = {}) {
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
  // 1) precomputed popular words load instantly (and work offline)
  if (!live && preSettingsOk() && state.corpusKey !== key) {
    if (state.pre && state.pre.lang === lang && slug(state.pre.word) === slug(term)) { state.term = term; state.lang = lang; await analyse(); return; }
    const pre = await loadPrecomputed(lang, term);
    if (id !== state.requestId) return;
    if (pre) {
      state.pre = pre; state.corpus = null; state.corpusKey = '';
      state.term = pre.word; state.lang = lang;
      await analyse();
      return;
    }
  }
  // 2) live text from the APIs
  if (state.corpusKey !== key) {
    show('loading', `Collecting text about “${term}”…`);
    els.go.disabled = true;
    try {
      const corpus = await collectCorpus(term, {
        lang, size, enabled,
        onProgress: (d, t, label) => { if (id === state.requestId) els.loadingText.textContent = `Collecting text about “${term}”… ${d}/${t} sources (${label} done)`; },
      });
      if (id !== state.requestId) return; // a newer search has started
      // every source unreachable (not just empty) → treat as offline
      if (corpus.report.every((r) => r.error && (!navigator.onLine || /fetch|network|load failed/i.test(r.error)))) throw new Error('offline');
      state.corpus = corpus; state.corpusKey = key;
    } catch (err) {
      if (id === state.requestId) showFetchError(err);
      return;
    } finally {
      if (id === state.requestId) els.go.disabled = false;
    }
  }
  state.pre = null;
  state.term = term;
  state.lang = lang;
  await analyse();
}

/** Network failure: explain, and when offline offer the words that work without a connection. */
async function showFetchError(err) {
  if (navigator.onLine && err.message !== 'offline') {
    show('error', `Could not reach the text sources (${err.message}). Check your connection and try again.`);
    return;
  }
  show('error', 'You seem to be offline: the text sources can’t be reached. New words need a connection, but popular words and your recent searches still work:');
  els.errorTitle.textContent = 'Offline';
  const code = els.lang.value;
  const idx = await loadPreIndex(code);
  const words = Object.values(idx?.words || {}).map((w) => w.w).slice(0, 24);
  els.offlineWords.innerHTML = '';
  for (const w of words) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = w; b.dir = 'auto'; b.onclick = () => search(w);
    els.offlineWords.appendChild(b);
  }
  els.offlineWords.classList.toggle('hidden', !words.length);
  if (!words.length) els.errorText.textContent = 'You’re offline and nothing is cached for this language yet. Reconnect and try again.';
}

function updateHash(term, lang) {
  history.replaceState(null, '', `#q=${encodeURIComponent(term)}&lang=${lang}${rankMode() === 'frequency' ? '&rank=frequency' : ''}`);
}

async function analyse() {
  const { corpus, pre, term } = state;
  if (!corpus && !pre) return;
  const aid = ++state.analyseId;
  const lang = getLang(state.lang);
  let reference = null;
  state.refError = '';
  state.stopError = '';
  let net;
  if (pre) {
    const p = { ...params(), rank: rankMode() };
    if (!covers({ ...p, window: +els.window.value }) || !preSettingsOk()) { search(term, { live: true }); return; } // needs live text
    net = decode(pre, p);
  } else {
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
    net = buildNetwork(corpus.docs, term, { ...params(), stop, rank: rankMode(), reference, lang });
  }
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
  $('resultsEmpty').hidden = true;
  const report = state.pre ? state.pre.report : state.corpus.report;
  const preNote = state.pre
    ? `<p class="pre-note">⚡ Precomputed on ${esc(state.pre.generated.slice(0, 10))} with default settings. <button type="button" id="refreshLive">Refresh with live data</button></p>` : '';
  const rep = report.map((r) => r.error
    ? `<li class="err">${r.label}: failed (${esc(r.error)})</li>`
    : `<li>${r.label}: <b>${r.count}</b> texts</li>`).join('');
  els.stats.innerHTML = net
    ? `<p><b>${net.stats.occurrences}</b> instances of “<bdi>${esc(state.term)}</bdi>” (${esc(getLang(state.lang).english)}) in <b>${net.stats.docsWithHits}</b> of ${net.stats.docs} texts,
       giving <b>${net.stats.windows}</b> unique context windows and <b>${net.stats.vocabulary}</b> distinct neighbor words.
       Showing the top <b>${net.nodes.length - 1}</b> ${net.stats.rank === 'distinctive'
         ? `<b>most distinctive</b> neighbors (of ${net.stats.eligible} that pass the significance test)`
         : 'most <b>frequent</b> neighbors'} with <b>${net.stats.pairLinks}</b> neighbor–neighbor lines.</p>
       ${[state.refError, state.stopError].filter(Boolean).map((e) => `<p class="err">${esc(e)}</p>`).join('')}${preNote}<ul>${rep}</ul>`
    : `<ul>${rep}</ul>`;
  $('refreshLive')?.addEventListener('click', () => search(state.term, { live: true }));
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
    if (state.pre) items = state.pre.docs.map(([source, title, url, text]) => ({ text, doc: { source, title, url } }));
    for (const doc of state.pre ? [] : state.corpus.docs) {
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
els.tableBody.addEventListener('click', (e) => { const tr = e.target.closest('tr'); if (tr) { sidebar.closeDrawer({ restoreFocus: false }); search(tr.dataset.w); } });

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
$('sbFit').onclick = () => { sidebar.closeDrawer(); state.graph?.fit(); };
$('sbSvg').onclick = downloadSvg;

function downloadSvg() {
  const svg = state.net && state.graph?.toSVG();
  if (!svg) return;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `contexter-${state.term}.svg`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---- share map ---------------------------------------------------------------
const share = { format: 'og', blob: null, url: '' };
async function shareUrl() {
  const idx = await loadPreIndex(state.lang);
  if (idx?.words?.[slug(state.term)]) return `${SITE}w/${state.lang}/${encodeURIComponent(slug(state.term))}/`;
  return `${SITE}#q=${encodeURIComponent(state.term)}&lang=${state.lang}`;
}
function cardInfo(url) {
  const lang = getLang(state.lang);
  return {
    word: state.term,
    langLine: lang.native === lang.english ? lang.native : `${lang.native} · ${lang.english}`,
    neighbors: state.net.nodes.filter((n) => !n.target).slice(0, 6).map((n) => n.label),
    rankLabel: state.net.stats.rank === 'distinctive' ? 'Most distinctive neighbours' : 'Most frequent neighbours',
    url, fontStack: state.graph.debug.fontStack(),
  };
}
async function makeCard(format) {
  const lang = getLang(state.lang);
  await fontsFor(lang, state.term + state.net.nodes.map((n) => n.label).join(''));
  state.graph.settleNow();
  return cardBlob(renderCard(state.graph, cardInfo(share.url), format));
}
async function openShare() {
  if (!state.net || !state.graph.hasData()) return;
  const dlg = $('shareDlg');
  share.url = await shareUrl();
  $('shareUrl').value = share.url;
  $('shareStatus').textContent = '';
  const file = () => new File([share.blob], `contexter-${slug(state.term)}-${state.lang}-${share.format}.png`, { type: 'image/png' });
  const canShareFiles = () => !!navigator.canShare && navigator.canShare({ files: [file()] });
  async function refresh() {
    share.format = document.querySelector('input[name=cardFormat]:checked').value;
    share.blob = await makeCard(share.format);
    const img = $('cardPreview');
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(share.blob);
    img.width = FORMATS[share.format].w; img.height = FORMATS[share.format].h;
    $('shareImage').classList.toggle('hidden', !canShareFiles());
    $('downloadPng').classList.toggle('primary', !canShareFiles());
  }
  for (const r of document.querySelectorAll('input[name=cardFormat]')) r.onchange = refresh;
  $('shareImage').onclick = async () => {
    try {
      await navigator.share({ files: [file()], title: `${state.term} · Contexter`, text: `The company “${state.term}” keeps`, url: share.url });
      $('shareStatus').textContent = 'Shared.';
    } catch (err) { if (err.name !== 'AbortError') { $('shareStatus').textContent = `Sharing failed (${err.message}); downloading instead.`; download(); } }
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(share.blob); a.download = file().name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    $('shareStatus').textContent = `Downloaded ${a.download}.`;
  };
  $('downloadPng').onclick = download;
  $('copyLink').onclick = async () => {
    try { await navigator.clipboard.writeText(share.url); $('shareStatus').textContent = 'Link copied.'; }
    catch { $('shareUrl').select(); $('shareStatus').textContent = 'Press Ctrl/⌘+C to copy the selected link.'; }
  };
  if (!dlg.open) dlg.showModal();
  await refresh();
}
$('share').onclick = openShare;
$('sbShare').onclick = openShare;

// ---- routing: #q=river&lang=en[&rank=frequency] · #wotd[&lang=de] · start page -----
function route() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('rank') === 'frequency') document.querySelector('input[name=rank][value=frequency]').checked = true;
  const code = h.get('lang') || store.get('contexter.lang');
  if (code && LANGS.some((l) => l.code === code)) els.lang.value = code;
  onLangChange();
  if (h.has('wotd')) search(wordOfDay(els.lang.value).word);
  else if (h.get('q')) search(h.get('q'));
  else home();
}
function home() {
  state.requestId++; state.analyseId++;
  state.term = ''; state.net = null; state.drawnTerm = '';
  state.graph?.clear();
  for (const b of [els.statsBox, els.samplesBox, els.tableBox]) b.classList.add('hidden');
  $('resultsEmpty').hidden = false;
  document.title = 'Contexter · the company a word keeps';
  show('empty');
}
for (const a of document.querySelectorAll('.home-link')) a.addEventListener('click', (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  sidebar.closeDrawer({ restoreFocus: false });
  history.pushState(null, '', location.pathname + location.search);
  home();
});
window.addEventListener('hashchange', () => {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has('wotd') || (h.get('q') && h.get('q') !== state.term)) route();
});

// ---- start ---------------------------------------------------------------------
setupPWA({ installButton: $('install') });
loadAnalytics();
if (typeof d3 === 'undefined') {
  show('error', 'The graph library (D3) could not be loaded. Check your connection or ad-blocker and reload.');
} else {
  state.graph = createGraph(els.canvas, document.getElementById('tooltip'), {
    onSelect: (word) => search(word),
    onFocus: (d) => renderSamples(d),
  });
  window.__contexter = state.graph.debug; // read-only hooks for automated tests
  window.__contexterApp = { // test/build hooks (OG image rendering)
    sidebar: () => ({ collapsed: sidebar.isCollapsed(), open: sidebar.isOpen(), mobile: sidebar.isMobile() }),
    state: () => ({ term: state.term, lang: state.lang, precomputed: !!state.pre, live: !!state.corpus, rank: state.net?.stats.rank }),
    search: (w, opts) => search(w, opts),
    card: async (format = 'og', url) => { share.url = url || await shareUrl(); return makeCard(format); },
    cardDataURL: async (format = 'og', url) => { const b = await window.__contexterApp.card(format, url); return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); },
  };
  route();
}
