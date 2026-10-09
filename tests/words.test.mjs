// Word-of-the-day lists and the daily pick.
import { WOTD, POPULAR, WOTD_CONCEPTS, wordOfDay, utcDay, wotdIndex, slug } from '../js/words.js';
import { LANGS, tokenize } from '../js/languages.js';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
for (const l of LANGS) {
  ok(WOTD[l.code]?.length >= 60, `${l.code}: ≥60 words of the day`);
  ok(POPULAR[l.code]?.length >= 20, `${l.code}: ≥20 popular words`);
  const slugs = WOTD[l.code].map((w) => slug(w.word));
  ok(new Set(slugs).size === slugs.length, `${l.code}: no duplicate words (${slugs.filter((s, i) => slugs.indexOf(s) !== i)})`);
  for (const w of [...WOTD[l.code], ...POPULAR[l.code]]) {
    if (l.segment !== 'intl') ok(tokenize(w.word, l).length === 1, `${l.code}: "${w.word}" is a single token`);
    ok(!/[/\\?#%]/.test(w.word), `${l.code}: "${w.word}" is path-safe`);
  }
}
// deterministic, UTC-based
const a = wordOfDay('de', new Date('2026-10-09T00:00:00Z')), b = wordOfDay('de', new Date('2026-10-09T23:59:59Z'));
ok(a.word === b.word && a.date === '2026-10-09', 'same word all UTC day');
ok(wordOfDay('de', new Date('2026-10-08T23:59:59Z')).date === '2026-10-08', 'changes at 00:00 UTC');
const days = Array.from({ length: WOTD_CONCEPTS.length }, (_, i) => wotdIndex(utcDay(new Date('2026-01-01')) + i));
ok(new Set(days).size === WOTD_CONCEPTS.length, 'cycle visits every concept once');
ok(wordOfDay('zh', new Date('2026-10-09T12:00Z')).concept === wordOfDay('sv', new Date('2026-10-09T12:00Z')).concept, 'same concept in every language');
console.log(fails ? `FAIL ${fails}` : `PASS words: ${LANGS.length} languages × ${WOTD.en.length} words of the day + ${POPULAR.en.length} popular`);
process.exitCode = fails ? 1 : 0;
