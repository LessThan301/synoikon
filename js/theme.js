// Theme switch (Light / Dark / System) shared by all Synoikon pages that use it. Self-contained, no dependencies.
// The pre-paint part (data-theme on <html>) is inlined in each page's <head>; this file adds the control and live updates.
// Usage: <script src=".../theme.js" data-slot="CSS selector(s) to append the control to (top bar)" defer></script>
(function () {
  var KEY = 'synoikon-theme', root = document.documentElement, mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  var T = { en: ['Theme', 'Light mode', 'Dark mode', 'System setting'], de: ['Design', 'Hell', 'Dunkel', 'Systemeinstellung'],
    fr: ['Thème', 'Mode clair', 'Mode sombre', 'Réglage du système'], es: ['Tema', 'Modo claro', 'Modo oscuro', 'Ajuste del sistema'],
    it: ['Tema', 'Modalità chiara', 'Modalità scura', 'Impostazione di sistema'], pt: ['Tema', 'Modo claro', 'Modo escuro', 'Configuração do sistema'],
    nl: ['Thema', 'Lichte modus', 'Donkere modus', 'Systeeminstelling'], pl: ['Motyw', 'Tryb jasny', 'Tryb ciemny', 'Ustawienie systemowe'],
    cs: ['Motiv', 'Světlý režim', 'Tmavý režim', 'Nastavení systému'], sv: ['Tema', 'Ljust läge', 'Mörkt läge', 'Systeminställning'],
    hu: ['Téma', 'Világos mód', 'Sötét mód', 'Rendszerbeállítás'], ro: ['Temă', 'Mod luminos', 'Mod întunecat', 'Setarea sistemului'],
    el: ['Θέμα', 'Φωτεινή λειτουργία', 'Σκοτεινή λειτουργία', 'Ρύθμιση συστήματος'], ru: ['Тема', 'Светлая тема', 'Тёмная тема', 'Как в системе'],
    uk: ['Тема', 'Світла тема', 'Темна тема', 'Як у системі'], id: ['Tema', 'Mode terang', 'Mode gelap', 'Pengaturan sistem'],
    zh: ['主题', '浅色模式', '深色模式', '跟随系统'], hi: ['थीम', 'लाइट मोड', 'डार्क मोड', 'सिस्टम सेटिंग'], bn: ['থিম', 'লাইট মোড', 'ডার্ক মোড', 'সিস্টেম সেটিং'],
    ar: ['المظهر', 'الوضع الفاتح', 'الوضع الداكن', 'إعداد النظام'], ur: ['تھیم', 'لائٹ موڈ', 'ڈارک موڈ', 'سسٹم سیٹنگ'] };
  function pref() { try { var p = localStorage.getItem(KEY); return p === 'light' || p === 'dark' ? p : 'system'; } catch (e) { return 'system'; } }
  function apply() { var p = pref(), dark = p === 'dark' || (p === 'system' && mq && mq.matches);
    var was = root.getAttribute('data-theme'); root.setAttribute('data-theme', dark ? 'dark' : 'light'); root.setAttribute('data-theme-pref', p);
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = dark ? '#141413' : '#f4f2ec';
    document.querySelectorAll('.theme-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === p)); });
    if (was !== root.getAttribute('data-theme')) window.dispatchEvent(new CustomEvent('synoikon-theme', { detail: { theme: dark ? 'dark' : 'light', pref: p } })); }
  function set(p) { try { if (p === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch (e) {} apply(); }
  function lang() { var l = (root.lang || navigator.language || 'en').slice(0, 2).toLowerCase(); return T[l] ? l : 'en'; }
  var ICONS = { light: '☀', dark: '☾', system: '◐' };
  function build(el) { var t = T[lang()], box = document.createElement('div'); box.className = 'theme-seg'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', t[0]); box.setAttribute('data-no-i18n', '');
    ['light', 'dark', 'system'].forEach(function (v, i) { var b = document.createElement('button'); b.type = 'button'; b.dataset.v = v; b.title = t[i + 1];
      b.innerHTML = '<span class="ico" aria-hidden="true">' + ICONS[v] + '</span><span class="lbl"></span>'; b.querySelector('.lbl').textContent = t[i + 1];
      b.addEventListener('click', function () { set(v); }); box.appendChild(b); });
    el.appendChild(box); return box; }
  function relabel() { var t = T[lang()]; document.querySelectorAll('.theme-seg').forEach(function (box) { box.setAttribute('aria-label', t[0]);
    box.querySelectorAll('button').forEach(function (b, i) { b.title = t[i + 1]; b.querySelector('.lbl').textContent = t[i + 1]; }); }); }
  apply();
  if (mq) (mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply));
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
  new MutationObserver(relabel).observe(root, { attributes: true, attributeFilter: ['lang'] });
  var cs = document.currentScript;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mountWith(cs); }); else mountWith(cs);
  // Placement: inline right after the Impressum / Datenschutz links (one control per page).
  function mountWith(s) { if (document.querySelector('.theme-seg')) return apply();
    var imp = document.querySelector('a#impressum, a[href*="impressum"]'), after = imp;
    if (imp) { var n = imp.nextElementSibling, k = imp.nextSibling; // the privacy link usually follows (maybe after a " · " text node)
      if (n && /datenschutz|privacy/i.test(n.getAttribute('href') || '') && (k === n || (k && k.nodeType === 3 && /^\s*[·|]?\s*$/.test(k.textContent) && k.nextSibling === n))) after = n; }
    var holder = document.createElement('span'); holder.className = 'theme-anchor';
    var box = build(holder);
    if (after) { if (after.parentNode.tagName === 'P' || /·/.test((after.nextSibling && after.nextSibling.textContent) || '')) after.parentNode.insertBefore(document.createTextNode(' '), after.nextSibling);
      after.parentNode.insertBefore(holder, after.nextSibling && after.nextSibling.nodeType === 3 && after.nextSibling.textContent === ' ' ? after.nextSibling.nextSibling : after.nextSibling); }
    else document.body.appendChild(holder);
    apply(); }
  window.synoikonTheme = { set: set, get: pref };
})();
