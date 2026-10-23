// Map legend: "?" button in the graph tools toggles a small translucent table (EN/DE).
(function () {
  var btn = document.getElementById('legendBtn'), box = document.getElementById('legend');
  if (!btn || !box) return;
  var DE = { cap: 'Was du siehst', k1: 'Kreisgröße', v1: 'Wie oft das Wort in der Nähe deines Suchworts vorkommt', k2: 'Linienlänge / -stärke', v2: 'Wie oft zwei Wörter zusammen vorkommen: kürzer und kräftiger = häufiger',
    k3: '„12× near …“', v3: 'So oft im Wortfenster um dein Suchwort gefunden (Standard ±5)', k4: '„in 8 of 120 windows“', v4: 'In wie vielen Textausschnitten beide Wörter vorkommen',
    k5: '#3', v5: 'Rang unter den Nachbarwörtern', k6: 'Distinctiveness', v6: 'Wie viel häufiger als in allgemeinem Text (nur bei Ranking „distinctive“)', k7: 'Often with', v7: 'Andere Nachbarwörter, mit denen es verbunden ist, mit gemeinsamer Anzahl',
    foot: 'Fahre mit der Maus über einen Kreis, um diese Zahlen zu sehen (auf Touchscreens: Kreis gedrückt halten und ziehen) · Klicken oder Tippen kartiert das Wort', btn: 'Was die Karte zeigt' };
  if ((navigator.language || '').slice(0, 2) === 'de') {
    box.querySelectorAll('[data-l]').forEach(function (el) { if (DE[el.dataset.l]) el.textContent = DE[el.dataset.l]; });
    btn.title = DE.btn; btn.setAttribute('aria-label', DE.btn);
  }
  function set(open) { box.hidden = !open; btn.setAttribute('aria-expanded', String(open)); try { localStorage.setItem('synoikon.legend', open ? '1' : '0'); } catch (e) {} }
  btn.addEventListener('click', function (e) { e.stopPropagation(); set(box.hidden); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) { set(false); btn.focus(); } });
  var saved = null; try { saved = localStorage.getItem('synoikon.legend'); } catch (e) {}
  set(saved === '1');
})();
