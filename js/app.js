import { collectCorpus, SOURCES } from './sources.js';
import { buildNetwork, targetForms } from './analysis.js';
import { renderGraph } from './graph.js';
import { STOP_EN, STOP_DE } from './stopwords.js';
import { loadReference } from './reference.js';

const $ = (id) => document.getElementById(id);
const els = {
  form: $('search'), term: $('term'), lang: $('lang'), go: $('go'), svg: $('graph'),
  empty: $('empty'), loading: $('loading'), loadingText: $('loadingText'), error: $('error'), errorText: $('errorText'),
  topN: $('topN'), window: $('window'), minCooc: $('minCooc'), maxLinks: $('maxLinks'), size: $('size'),
  stopEn: $('stopEn'), stopDe: $('stopDe'), sourceBoxes: $('sourceBoxes'),
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
for (const w of ['river', 'trust', 'light', 'Wald', 'bridge', 'freedom']) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = w;
  b.onclick = () => { if (w === 'Wald') els.lang.value = 'de'; search(w); };
  els.examples.appendChild(b);
}

const enabledSources = () => [...els.sourceBoxes.querySelectorAll('input:checked')].map((i) => i.value);
const stopwords = () => {
  const s = new Set();
  if (els.stopEn.checked) STOP_EN.forEach((w) => s.add(w));
  if (els.stopDe.checked) STOP_DE.forEach((w) => s.add(w));
  return s;
};
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
  const enabled = enabledSources();
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
  let reference = null;
  state.refError = '';
  if (rankMode() === 'distinctive') {
    try { reference = await loadReference(state.lang); }
    catch (err) { state.refError = `Background word list for “${state.lang}” could not be loaded (${err.message}); ranking by frequency instead.`; }
    if (aid !== state.analyseId) return; // superseded
  }
  if (!corpus.docs.length) {
    const errs = corpus.report.filter((r) => r.error);
    show('error', errs.length === corpus.report.length
      ? `All sources failed: ${errs.map((e) => `${e.label}: ${e.error}`).join('; ')}`
      : `No text found for “${term}”. Check the spelling or try another language.`);
    renderStats(null);
    return;
  }
  const net = buildNetwork(corpus.docs, term, { ...params(), stop: stopwords(), rank: rankMode(), reference });
  state.net = net;
  renderStats(net);
  if (net.nodes.length < 2) {
    show('error', `Found ${net.stats.occurrences} occurrence(s) of “${term}”, but not enough recurring neighbors to draw a network. Try a larger corpus, a wider window, or another word.`);
    state.graph?.stop(); els.svg.innerHTML = '';
    return;
  }
  show('none');
  state.graph?.stop();
  state.graph = renderGraph(els.svg, net, {
    onSelect: (word) => search(word),
    onFocus: (d) => renderSamples(d),
  });
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
    ? `<p><b>${net.stats.occurrences}</b> instances of “${esc(state.term)}” in <b>${net.stats.docsWithHits}</b> of ${net.stats.docs} texts,
       giving <b>${net.stats.windows}</b> unique context windows and <b>${net.stats.vocabulary}</b> distinct neighbor words.
       Showing the top <b>${net.nodes.length - 1}</b> ${net.stats.rank === 'distinctive'
         ? `<b>most distinctive</b> neighbors (of ${net.stats.eligible} that pass the significance test)`
         : 'most <b>frequent</b> neighbors'} with <b>${net.stats.pairLinks}</b> neighbor–neighbor lines.</p>
       ${state.refError ? `<p class="err">${esc(state.refError)}</p>` : ''}<ul>${rep}</ul>`
    : `<ul>${rep}</ul>`;
}

function renderSamples(d) {
  const net = state.net;
  if (!net) return;
  els.samplesBox.classList.remove('hidden');
  const forms = new Set(state.term.toLowerCase().split(/\s+/).flatMap((t) => [...targetForms(t)]));
  let items;
  if (d && !d.target) {
    els.sampleFor.textContent = `· with “${d.label}”`;
    items = (d.samples || []).map((text) => ({ text }));
  } else {
    els.sampleFor.textContent = '';
    const seen = new Set();
    items = state.corpus.docs.filter((doc) => {
      const t = doc.text.toLowerCase();
      if (seen.has(doc.source + doc.title) || ![...forms].some((f) => t.includes(f))) return false;
      seen.add(doc.source + doc.title); return true;
    }).slice(0, 12).map((doc) => ({ text: excerpt(doc.text, forms), doc }));
  }
  const neighbor = d && !d.target ? d.id : null;
  els.samples.innerHTML = items.map(({ text, doc }) => `<li>${mark(text, forms, neighbor)}${doc
    ? ` <a href="${doc.url}" target="_blank" rel="noopener">${esc(doc.source)} · ${esc(doc.title)}</a>` : ''}</li>`).join('');
}

function renderTable(net) {
  els.tableBox.classList.remove('hidden');
  $('tableNote').textContent = net.stats.rank === 'distinctive'
    ? 'Ranked by distinctiveness (log₂ ratio vs. general Wikipedia text). Circle area still shows frequency.'
    : 'Ranked by frequency inside the context windows.';
  els.tableBody.innerHTML = net.nodes.filter((n) => !n.target)
    .map((n) => `<tr data-w="${esc(n.label)}"><td>${esc(n.label)}</td><td>${n.freq}</td><td>${n.cooc}</td><td>${n.lr == null ? '–' : n.lr.toFixed(1)}</td></tr>`).join('');
}
els.tableBody.addEventListener('click', (e) => { const tr = e.target.closest('tr'); if (tr) search(tr.dataset.w); });

function excerpt(text, forms) {
  const low = text.toLowerCase();
  let pos = -1;
  for (const f of forms) { const p = low.search(new RegExp(`(^|[^\\p{L}])${escRe(f)}([^\\p{L}]|$)`, 'u')); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }
  if (pos < 0) pos = 0;
  const a = Math.max(0, pos - 120);
  return (a > 0 ? '… ' : '') + text.slice(a, pos + 160).trim() + (pos + 160 < text.length ? ' …' : '');
}
function mark(text, forms, neighbor) {
  return esc(text).replace(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’\-]*/gu, (w) => {
    const l = w.toLowerCase();
    if (forms.has(l)) return `<mark>${w}</mark>`;
    if (neighbor && (l === neighbor || l.replace(/(ies|es|s)$/, '') === neighbor.replace(/(ies|es|s)$/, ''))) return `<mark class="n">${w}</mark>`;
    return w;
  });
}
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
for (const el of [els.stopEn, els.stopDe]) el.addEventListener('change', analyse);
for (const r of document.querySelectorAll('input[name=rank]')) r.addEventListener('change', () => { if (state.term) updateHash(state.term, state.lang); analyse(); });
for (const el of [els.size, els.lang, els.sourceBoxes]) el.addEventListener('change', () => { if (state.term) search(state.term); });
$('zoomIn').onclick = () => state.graph?.zoomBy(1.3);
$('zoomOut').onclick = () => state.graph?.zoomBy(1 / 1.3);
$('zoomFit').onclick = () => state.graph?.fit();
$('download').onclick = downloadSvg;
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => state.net && analyse(), 300); });

function downloadSvg() {
  if (!state.net) return;
  const clone = els.svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = 'text{font-family:system-ui,sans-serif;fill:#e9ecf7;paint-order:stroke;stroke:rgba(15,18,32,.85);stroke-width:3px}.target text{font-weight:700}';
  clone.prepend(style);
  const vb = clone.getAttribute('viewBox').split(/[ ,]+/);
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', vb[0]); bg.setAttribute('y', vb[1]); bg.setAttribute('width', vb[2]); bg.setAttribute('height', vb[3]); bg.setAttribute('fill', '#0f1220');
  clone.insertBefore(bg, style.nextSibling);
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `contexter-${state.term}.svg`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---- start (supports shareable links like #q=river&lang=en) ---------------
if (typeof d3 === 'undefined') {
  show('error', 'The graph library (D3) could not be loaded. Check your connection or ad-blocker and reload.');
} else {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('rank') === 'frequency') document.querySelector('input[name=rank][value=frequency]').checked = true;
  if (h.get('lang') && [...els.lang.options].some((o) => o.value === h.get('lang'))) els.lang.value = h.get('lang');
  if (h.get('q')) search(h.get('q')); else show('empty');
}
