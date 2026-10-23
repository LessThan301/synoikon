// Map legend: "?" button in the graph tools toggles a small translucent table (translated via i18n.js).
(function () {
  var btn = document.getElementById('legendBtn'), box = document.getElementById('legend');
  if (!btn || !box) return;
  function set(open) { box.hidden = !open; btn.setAttribute('aria-expanded', String(open)); try { localStorage.setItem('synoikon.legend', open ? '1' : '0'); } catch (e) {} }
  btn.addEventListener('click', function (e) { e.stopPropagation(); set(box.hidden); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) { e.preventDefault(); set(false); btn.focus(); } });
  var saved = null; try { saved = localStorage.getItem('synoikon.legend'); } catch (e) {}
  set(saved === '1');
})();
