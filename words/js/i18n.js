// UI translation. English strings are the keys (data/i18n/en.json lists them); data/i18n/<code>.json maps them.
// Static text and title/aria-label/placeholder attributes are translated automatically (MutationObserver);
// strings with placeholders go through t('… {0} …', value).
const ATTRS = ['title', 'aria-label', 'placeholder', 'label', 'alt'];
const RTL = new Set(['ar', 'ur']);
let dict = {}, keys = new Set(), code = 'en';
const listeners = [];
export const uiLang = () => code;
export function t(s, ...a) { return (dict[s] ?? s).replace(/\{(\d)\}/g, (m, i) => (a[i] ?? m)); }
export function onUiLang(f) { listeners.push(f); }

function trText(n) {
  const v = n.nodeValue, cur = v.trim();
  if (!cur) return;
  const key = n.__tr === cur ? n.__en : cur;
  if (!keys.has(key)) return;
  const out = t(key);
  n.__en = key; n.__tr = out;
  if (out !== cur) n.nodeValue = v.replace(cur, out);
}
function trAttrs(el) {
  for (const a of ATTRS) {
    if (!el.hasAttribute || !el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a), st = (el.__i18n ||= {});
    const key = st[a] && st[a].tr === cur ? st[a].en : cur;
    if (!keys.has(key)) continue;
    const out = t(key); st[a] = { en: key, tr: out };
    if (out !== cur) el.setAttribute(a, out);
  }
}
function walk(root) {
  if (root.nodeType === 3) return root.parentElement?.closest('[data-no-i18n]') ? undefined : trText(root);
  if (root.nodeType !== 1 || root.closest?.('[data-no-i18n]')) return;
  trAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: (n) => (n.nodeType === 1 && n.hasAttribute('data-no-i18n') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? trText(n) : trAttrs(n);
}
let busy = false;
const mo = new MutationObserver((muts) => {
  if (busy) return; busy = true;
  for (const m of muts) {
    if (m.type === 'characterData') { if (!m.target.parentElement?.closest('[data-no-i18n]')) trText(m.target); }
    else if (m.type === 'attributes') trAttrs(m.target);
    else m.addedNodes.forEach(walk);
  }
  mo.takeRecords(); busy = false;
});

export async function setUiLang(c) {
  if (!keys.size) keys = new Set(await fetch('data/i18n/en.json').then((r) => r.json()).catch(() => []));
  let d = {};
  if (c !== 'en') d = await fetch(`data/i18n/${c}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  dict = d; code = Object.keys(d).length || c === 'en' ? c : 'en';
  document.documentElement.lang = code;
  document.documentElement.dir = RTL.has(code) ? 'rtl' : 'ltr';
  // blocks with inline markup: <el data-i18n="@key"> gets the translated HTML (our own trusted files)
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.__en ??= el.innerHTML; el.innerHTML = dict[el.dataset.i18n] ?? el.__en; });
  if (document.documentElement.dataset.titleKey) document.title = `${t(document.documentElement.dataset.titleKey)} · Synoikon`;
  busy = true; walk(document.body); mo.takeRecords(); busy = false;
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  for (const f of listeners) f(code);
}

// Pages without the app (About): same choice as the app (explicit choice, else map language, else browser language).
export function pageLang(codes) {
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const pick = get('synoikon.uilang');
  if (pick && pick !== 'auto' && codes.includes(pick)) return pick;
  const map = get('synoikon.lang');
  if (map && map !== 'en' && codes.includes(map)) return map;
  return (navigator.languages || [navigator.language || 'en']).map((x) => x.slice(0, 2)).find((x) => codes.includes(x)) || 'en';
}
