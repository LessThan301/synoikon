// Home page: UI language follows the browser (falls back to English); unfilled legal links show "coming soon".
(function () {
  var T = {
    de: { tag: 'Kleine, kostenlose Werkzeuge, die Zusammenhänge zeigen.', sub: 'Die Wörter um ein Wort. Die Fakten um eine Behauptung. Aus dem Griechischen für „Zusammenleben“.', wTitle: 'Wortnetz', wText: 'Gib ein Wort in einer von 21 Sprachen ein und sieh das Netz der Wörter, die es begleiten, aus echten Wikipedia-Texten.', rText: 'Verbreitete Behauptungen über Elon Musk, SpaceX, Tesla und E-Autos, mit Quellen geprüft. Erst raten, dann die Karte umdrehen.', open: 'Öffnen →', imp: 'Impressum', priv: 'Datenschutz', soon: 'folgt' },
    es: { tag: 'Herramientas pequeñas y gratuitas que muestran el contexto.', sub: 'Las palabras alrededor de una palabra. Los hechos alrededor de una afirmación.', wTitle: 'Red de palabras', wText: 'Escribe una palabra en uno de 21 idiomas y mira la red de palabras que la acompañan, a partir de textos reales de Wikipedia.', rText: 'Afirmaciones populares sobre Elon Musk, SpaceX, Tesla y los coches eléctricos, verificadas con fuentes.', open: 'Abrir →', imp: 'Aviso legal', priv: 'Privacidad', soon: 'próximamente' },
    fr: { tag: 'De petits outils gratuits qui montrent le contexte.', sub: 'Les mots autour d’un mot. Les faits autour d’une affirmation.', wTitle: 'Réseau de mots', wText: 'Tapez un mot dans l’une des 21 langues et voyez le réseau des mots qui l’accompagnent, tiré de vrais textes de Wikipédia.', rText: 'Des affirmations courantes sur Elon Musk, SpaceX, Tesla et les voitures électriques, vérifiées avec des sources.', open: 'Ouvrir →', imp: 'Mentions légales', priv: 'Confidentialité', soon: 'bientôt' }
  };
  var lang = (navigator.language || 'en').slice(0, 2), t = T[lang];
  if (t) { document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { var k = el.dataset.i18n; if (t[k]) el.textContent = t[k]; }); }
  ['impressum', 'privacy'].forEach(function (id) {
    var a = document.getElementById(id);
    if (!a.getAttribute('href')) { a.removeAttribute('href'); a.classList.add('soon'); a.textContent += ' (' + ((t && t.soon) || 'coming soon') + ')'; }
  });
})();
