// Impressum / Datenschutz: DE/EN toggle, spam-obfuscated email, contact form.
(function () {
  var CFG = window.LEGAL_CFG || {};
  // language: #en / #de, else browser language (German -> de, anything else -> en)
  function setLang(l) {
    document.documentElement.lang = l;
    document.querySelectorAll('[data-lang]').forEach(function (el) { el.hidden = el.dataset.lang !== l; });
    document.querySelectorAll('.langs button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.set === l)); });
  }
  var h = location.hash.slice(1), start = h === 'en' || h === 'de' ? h : ((navigator.language || 'de').slice(0, 2) === 'de' ? 'de' : 'en');
  document.querySelectorAll('.langs button').forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.set); history.replaceState(null, '', '#' + b.dataset.set); }); });
  setLang(start);
  // email: assembled at runtime from reversed parts, so it is not in the HTML source
  var addr = ['moc', 'nokionys', 'tkatnok'].map(function (s) { return s.split('').reverse().join(''); });
  addr = addr[2] + '@' + addr[1] + '.' + addr[0];
  document.querySelectorAll('.js-mail').forEach(function (el) { var a = document.createElement('a'); a.href = 'mailto:' + addr; a.textContent = addr; el.replaceWith(a); });
  // contact form
  document.querySelectorAll('form.cform').forEach(function (f) {
    var de = f.closest('[data-lang]').dataset.lang === 'de', out = f.querySelector('.msg'), t0 = Date.now();
    var T = de ? { prev: 'Vorschau: Das Formular ist noch nicht aktiv, es wird nichts gesendet. Bitte nutze vorerst die E-Mail-Adresse.', ok: 'Danke, deine Nachricht wurde gesendet.', err: 'Senden fehlgeschlagen. Bitte schreib direkt an die E-Mail-Adresse.', wait: 'Bitte kurz warten und erneut versuchen.' }
                 : { prev: 'Preview: the form is not active yet, nothing is sent. Please use the email address for now.', ok: 'Thanks, your message was sent.', err: 'Sending failed. Please write to the email address instead.', wait: 'Please wait a moment and try again.' };
    if (!CFG.contactEndpoint) f.querySelector('.note').textContent = T.prev;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!CFG.contactEndpoint) { out.textContent = T.prev; return; }
      var last = +(localStorage.getItem('synoikon-contact-at') || 0);
      if (Date.now() - last < 60000) { out.textContent = T.wait; return; }
      var d = new FormData(f), body = { name: d.get('name') || '', email: d.get('email'), message: d.get('message'), website: d.get('website') || '', elapsed: Date.now() - t0, lang: de ? 'de' : 'en' };
      f.querySelector('button').disabled = true;
      fetch(CFG.contactEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw r; localStorage.setItem('synoikon-contact-at', String(Date.now())); out.textContent = T.ok; f.reset(); })
        .catch(function (r) { out.textContent = r && r.status === 429 ? T.wait : T.err; })
        .then(function () { f.querySelector('button').disabled = false; });
    });
  });
})();
