// Rebuilds data/stop-*.txt and data/freq-*.txt (except the original six
// Wikipedia lists en/de/fr/es/it/nl, built earlier with the same procedure).
//
// Inputs (not committed, download first):
//   stopwords-iso.json   https://github.com/stopwords-iso/stopwords-iso (MIT)
//   ILYA_DIR/<code>wiki-*.txt   https://github.com/IlyaSemenov/wikipedia-word-frequency (MIT)
//   LEIPZIG_DIR/<iso3>_wikipedia_2021_300K/*-sentences.txt   https://wortschatz.uni-leipzig.de/en/download (CC BY)
// usage: node tools/build-data.mjs <stopwords-iso.json> <ILYA_DIR> <LEIPZIG_DIR>
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { LANGS, normalize, tokenize } from '../js/languages.js';
import { STOP_DE_EXTRA } from '../js/stopwords.js';

const [isoFile, ilyaDir, lzDir] = process.argv.slice(2);
const out = new URL('../data/', import.meta.url);
const K = 40000;
const WORDLIKE = /^[\p{L}\p{M}][\p{L}\p{N}\p{M}\u200c\u200d'’\-]*$/u;

// Wiki boilerplate (disambiguation phrases, "see also", Commons notices, "(in English: …)")
// that otherwise shows up as neighbors of almost any word.
const WIKI_EXTRA = {
  zh: '可以 指 消歧义 消歧義 页面 頁面 条目 條目 维基 維基 参见 參見 英语 英語',
  hi: 'पृष्ठ लेख देखें अन्य अंग्रेज़ी अंग्रेजी विकिपीडिया जाता जाती जाते तथा रूप',
  es: 'puede referirse desambiguación véase artículo página wikipedia editar inglés',
  ar: 'صفحة مقالة انظر يمكن يشير توضيح ويكيبيديا الإنجليزية إنجليزية تعديل مصدري ويكي بيانات',
  fr: 'peut désigner homonymie homonymes voir projets correspondants article page wikipédia anglais fiche technique distribution détails titre',
  bn: 'পৃষ্ঠা নিবন্ধ দেখুন উইকিপিডিয়া ইংরেজি সাথে এক হিসেবে সালে',
  pt: 'pode referir desambiguação significados editar código-fonte ver página artigo wikipédia inglês',
  ru: 'может означать значения викискладе см статья страница википедия англ английский',
  id: 'merujuk dapat disambiguasi lihat halaman artikel wikipedia inggris',
  ur: 'صفحہ مضمون دیکھیں ویکیپیڈیا انگریزی',
  de: 'begriffsklärung sammlung bildern videos audiodateien commons englisch',
  it: 'può riferirsi disambigua pagina voce vedi inglese wikipedia',
  pl: 'zobacz może oznaczać ujednoznacznienie strona artykuł wikipedii angielski ang',
  uk: 'може означати значення вікісховищі див стаття сторінка вікіпедія англ англійська',
  nl: 'zie verwijzen verwijst doorverwijspagina pagina artikel engels',
  ro: 'vedeți referi poate dezambiguizare pagina articol engleză',
  el: 'δειτε αναφερεται αποσαφηνιση σελιδα αρθρο αγγλικα',
  hu: 'lásd jelentheti egyértelműsítő lap cikk angolul',
  cs: 'může označovat rozcestník wikipedii heslo encyklopedický slovníkové článek stránka viz anglicky',
  sv: 'syfta avse förgreningssida sida artikel engelska',
};

// ---- stopwords ----
const iso = JSON.parse(fs.readFileSync(isoFile, 'utf8'));
for (const lang of LANGS) {
  if (lang.code === 'en') continue; // English uses the hand-made list in js/stopwords.js
  const words = new Set();
  for (const w of [...(iso[lang.code] || []), ...(lang.code === 'de' ? STOP_DE_EXTRA : []), ...(WIKI_EXTRA[lang.code] || '').split(' ').filter(Boolean)]) {
    for (const t of tokenize(w, lang)) words.add(t.low);
  }
  fs.writeFileSync(new URL(`stop-${lang.code}.txt`, out),
    `# stopwords-iso (MIT) "${lang.code}" list${lang.code === 'de' ? ' + Synoikon German list' : ''} + Synoikon wiki-boilerplate additions, normalised\n${[...words].sort().join('\n')}\n`);
  console.log('stop', lang.code, words.size);
}

if (process.env.ONLY_STOP) process.exit(0);

// ---- frequency lists ----
function write(lang, counts, total, source) {
  const top = [...counts.entries()].filter(([w, c]) => c >= 2 && WORDLIKE.test(w)).sort((a, b) => b[1] - a[1]).slice(0, K);
  const sig = (c) => { const s = String(c); return s.length > 3 ? +(s.slice(0, 3) + '0'.repeat(s.length - 3)) : c; };
  fs.writeFileSync(new URL(`freq-${lang.code}.txt`, out),
    `# ${source}; top ${top.length} words, normalised with Synoikon's tokenizer\n#total ${total}\n${top.map(([w, c]) => `${w} ${sig(c)}`).join('\n')}\n`);
  console.log('freq', lang.code, 'total', total, 'words', top.length, 'last', top[top.length - 1]);
}

const ISO3 = { hi: 'hin', bn: 'ben', ur: 'urd', id: 'ind', ro: 'ron', el: 'ell', hu: 'hun', cs: 'ces', zh: 'cmn' };
for (const lang of LANGS) {
  if (['en', 'de', 'fr', 'es', 'it', 'nl'].includes(lang.code)) continue;
  const counts = new Map();
  let total = 0;
  if (lang.freq === 'wikipedia-ilya') {
    const file = fs.readdirSync(ilyaDir).find((f) => f.startsWith(`${lang.code}wiki-`));
    for (const line of fs.readFileSync(path.join(ilyaDir, file), 'utf8').split('\n')) {
      const sp = line.lastIndexOf(' ');
      if (sp < 1) continue;
      const c = +line.slice(sp + 1);
      total += c;
      const w = normalize(line.slice(0, sp).toLowerCase(), lang);
      counts.set(w, (counts.get(w) || 0) + c);
    }
    write(lang, counts, total, `Wikipedia (${file.replace('.txt', '')}) word frequencies; github.com/IlyaSemenov/wikipedia-word-frequency (MIT)`);
  } else {
    const dir = path.join(lzDir, `${ISO3[lang.code]}_wikipedia_2021_300K`);
    const file = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('-sentences.txt')));
    const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
    for await (const line of rl) {
      const tab = line.indexOf('\t');
      for (const t of tokenize(line.slice(tab + 1), lang)) { total++; counts.set(t.low, (counts.get(t.low) || 0) + 1); }
    }
    write(lang, counts, total, `Leipzig Corpora Collection ${path.basename(dir)} (CC BY), counted with Synoikon's tokenizer`);
  }
}
