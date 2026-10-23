// Builds data/i18n/<code>.json (English UI string -> translation) from tools/i18n/<code>.txt (one string per line, same order as en.txt).
// Machine translations: need review by native speakers.
import fs from 'fs';
const dir = 'tools/i18n', en = fs.readFileSync(`${dir}/en.txt`, 'utf8').replace(/\n$/, '').split('\n');
fs.mkdirSync('data/i18n', { recursive: true });
fs.writeFileSync('data/i18n/en.json', JSON.stringify(en) + '\n');
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.txt') && f !== 'en.txt')) {
  const tr = fs.readFileSync(`${dir}/${f}`, 'utf8').replace(/\n$/, '').split('\n');
  if (tr.length !== en.length) throw new Error(`${f}: ${tr.length} lines, expected ${en.length}`);
  fs.writeFileSync(`data/i18n/${f.replace('.txt', '.json')}`, JSON.stringify(Object.fromEntries(en.map((s, i) => [s, tr[i]]))) + '\n');
}
console.log(`i18n: ${en.length} strings`);
