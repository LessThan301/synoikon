// Curated word lists: "word of the day" (66 evocative concepts) and popular words (20 concepts),
// aligned by concept across all 21 languages so pages can link translations (hreflang).
// Entry syntax: "word" (gloss = the English concept) or "word=gloss" when a language uses a
// different word because the literal translation is ambiguous for the matcher (e.g. French "été"
// is also "been", Dutch "zon" would match "zondag").
// Pure module: used by the app, the precompute script and the static-page builder.

export const WOTD_CONCEPTS = 'moon|sea|forest|mountain|fire|dream|light|storm|bread|honey|river|island|desert|snow|rain|wind|star|sun|garden|bridge|road|horse|wolf|bird|tree|flower|rose|gold|silver|iron|salt|wine|tea|coffee|music|song|dance|book|library|school|city|village|house|mother|friend|love|hope|freedom|peace|war|time|memory|silence|shadow|mirror|window|door|key|map|ship|train|clock|bell|winter|summer|autumn'.split('|');
export const POPULAR_CONCEPTS = 'life|death|god|money|water|family|work|science|art|truth|power|history|nature|food|health|language|heart|dog|cat|climate'.split('|');

const WOTD_RAW = {
  en: WOTD_CONCEPTS.join('|'),
  zh: '月亮|海洋|森林|高山|火焰|梦想|光明|风暴|面包|蜂蜜|河流|岛屿|沙漠|雪花|雨水|微风=breeze|星星|太阳|花园|桥梁|道路|骏马|狼群=wolf pack|鸟类|树木|花朵|玫瑰|黄金|白银|钢铁=steel|食盐|葡萄酒|茶叶|咖啡|音乐|歌曲|舞蹈|书籍|图书馆|学校|城市|村庄|家园=homeland|母亲|朋友|爱情|希望|自由|和平|战争|时间|记忆|沉默|影子|镜子|窗户|大门=gate|钥匙|地图|船只|火车|时钟|钟声=bell toll|冬天|夏天|秋天',
  hi: 'चाँद|समुद्र|जंगल|पहाड़|अग्नि|सपना|प्रकाश|तूफ़ान|रोटी|शहद|नदी|द्वीप|रेगिस्तान|बर्फ़|वर्षा|पवन|नक्षत्र|सूर्य|बगीचा|सेतु|सड़क|घोड़ा|भेड़िया|पक्षी|पेड़|फूल|गुलाब|स्वर्ण|चाँदी|लोहा|नमक|शराब|चाय|कॉफ़ी|संगीत|गाना|नृत्य|पुस्तक|पुस्तकालय|विद्यालय|शहर|गाँव|मकान|माता|मित्र|प्रेम|आशा|स्वतंत्रता|शांति|युद्ध|समय|स्मृति|मौन|छाया|दर्पण|खिड़की|दरवाज़ा|चाबी|मानचित्र|जहाज़|रेलगाड़ी|घड़ी|घंटी|सर्दी|गर्मी|शरद',
  es: 'luna|mar|bosque|montaña|fuego|sueño|luz|tormenta|pan|miel|río|isla|desierto|nieve|lluvia|viento|estrella|sol|jardín|puente|camino|caballo|lobo|pájaro|árbol|flor|rosa|oro|plata|hierro|sal|vino|té|café|música|canción|danza|libro|biblioteca|escuela|ciudad|aldea|casa|madre|amigo|amor|esperanza|libertad|paz|guerra|tiempo|memoria|silencio|sombra|espejo|ventana|puerta|llave|mapa|barco|tren|reloj|campana|invierno|verano|otoño',
  ar: 'قمر|بحر|غابة|جبل|نار|حلم|ضوء|عاصفة|خبز|عسل|نهر|جزيرة|صحراء|ثلج|مطر|رياح|نجم|شمس|حديقة|جسر|طريق|حصان|ذئب|طائر|شجرة|زهرة|وردة|ذهب|فضة|حديد|ملح|نبيذ|شاي|قهوة|موسيقى|أغنية|رقص|كتاب|مكتبة|مدرسة|مدينة|قرية|بيت|والدة|صديق|حب|أمل|حرية|سلام|حرب|زمن|ذاكرة|صمت|ظل|مرآة|نافذة|باب|مفتاح|خريطة|سفينة|قطار|ساعة|جرس|شتاء|صيف|خريف',
  fr: 'lune|mer|forêt|montagne|feu|rêve|lumière|tempête|pain|miel|rivière|île|désert|neige|pluie|vent|étoile|soleil|jardin|pont|chemin|cheval|loup|oiseau|arbre|fleur|rose|trésor=treasure|argent|fer|sel|vin|thé|café|musique|chanson|danse|livre|bibliothèque|école|ville|village|maison|mère|ami|amour|espoir|liberté|paix|guerre|temps|mémoire|silence|ombre|miroir|fenêtre|porte|clé|carte|navire|train|horloge|cloche|hiver|printemps=spring|automne',
  bn: 'চাঁদ|সমুদ্র|অরণ্য|পাহাড়|আগুন|স্বপ্ন|জ্যোৎস্না=moonlight|ঝড়|রুটি|মধু|নদী|দ্বীপ|মরুভূমি|তুষার|বৃষ্টি|বাতাস|নক্ষত্র|সূর্য|বাগান|সেতু|রাস্তা|ঘোড়া|নেকড়ে|পাখি|গাছ|ফুল|গোলাপ|সোনা|রুপা|লোহা|লবণ|আঙুর=grape|দারুচিনি=cinnamon|কফি|সঙ্গীত|গান|নৃত্য|বই|গ্রন্থাগার|বিদ্যালয়|শহর|গ্রাম|ঘর|জননী|বন্ধু|ভালোবাসা|প্রত্যাশা|স্বাধীনতা|শান্তি|যুদ্ধ|সময়|স্মৃতি|নীরবতা|ছায়া|আয়না|জানালা|দরজা|চাবি|মানচিত্র|জাহাজ|ট্রেন|ঘড়ি|ঘণ্টা|শীত|গ্রীষ্ম|শরৎ',
  pt: 'lua|mar|floresta|montanha|fogo|sonho|luz|tempestade|pão|mel|rio|ilha|deserto|neve|chuva|vento|estrela|sol|jardim|ponte|estrada|cavalo|lobo|pássaro|árvore|flor|rosa|ouro|prata|ferro|sal|vinho|chá|café|música|canção|dança|livro|biblioteca|escola|cidade|aldeia|casa|mãe|amigo|amor|esperança|liberdade|paz|guerra|tempo|memória|silêncio|sombra|espelho|janela|porta|chave|mapa|navio|trem|relógio|sino|inverno|verão|outono',
  ru: 'луна|море|лес|гора|огонь|мечта|свет|буря|хлеб|мёд|река|остров|пустыня|снег|дождь|ветер|звезда|солнце|сад|мост|дорога|лошадь|волк|птица|дерево|цветок|роза|золото|серебро|железо|соль|вино|чай|кофе|музыка|песня|танец|книга|библиотека|школа|город|деревня|дом|мама|друг|любовь|надежда|свобода|мир|война|время|память|тишина|тень|зеркало|окно|дверь|ключ|карта|корабль|поезд|будильник=alarm clock|колокол|зима|лето|осень',
  id: 'bulan|laut|hutan|gunung|api|mimpi|cahaya|badai|roti|lebah=bee|sungai|pulau|gurun|salju|hujan|angin|bintang|matahari|taman|jembatan|jalan|kuda|serigala|burung|pohon|bunga|mawar|emas|perak|besi|garam|anggur|teh|kopi|musik|lagu|tarian|buku|perpustakaan|sekolah|kota|pedesaan=countryside|rumah|ibu|sahabat|cinta|harapan|kebebasan|perdamaian|perang|waktu|kenangan|keheningan|bayangan|cermin|jendela|pintu|kunci|atlas|kapal|kereta|arloji=watch|lonceng|kemarau=dry season|pelangi=rainbow|embun=dew',
  ur: 'چاند|سمندر|جنگل|پہاڑ|آتش|خواب|روشنی|طوفان|روٹی|شہد|دریا|جزیرہ|صحرا|برف|بارش|آندھی=gale|ستارہ|سورج|باغ|مینار=minaret|سڑک|گھوڑا|بھیڑیا|پرندہ|درخت|پھول|گلاب|سونا|چاندی|لوہا|نمک|شراب|چائے|قہوہ|موسیقی|گیت|رقص|کتاب|لائبریری|مدرسہ|شہر|گاؤں|گھر|ماں|دوست|محبت|امید|آزادی|امن|جنگ|وقت|یاد|خاموشی|سایہ|آئینہ|کھڑکی|دروازہ|چابی|نقشہ|جہاز|ریل|گھڑی|گھنٹی|سردی|گرمی|خزاں',
  de: 'Mond|Meer|Wald|Berg|Feuer|Traum|Licht|Sturm|Brot|Honig|Fluss|Insel|Wüste|Schnee|Regen|Wind|Stern|Sonne|Garten|Brücke|Straße|Pferd|Wolf|Vogel|Baum|Blume|Rose|Gold|Silber|Eisen|Salz|Wein|Tee|Kaffee|Musik|Lied|Tanz|Buch|Bibliothek|Schule|Stadt|Dorf|Haus|Mutter|Freund|Liebe|Hoffnung|Freiheit|Frieden|Krieg|Zeit|Erinnerung|Stille|Schatten|Spiegel|Fenster|Tür|Schlüssel|Landkarte|Schiff|Zug|Uhr|Glocke|Winter|Sommer|Herbst',
  it: 'luna|mare|foresta|montagna|fuoco|sogno|luce|tempesta|pane|miele|fiume|isola|deserto|neve|pioggia|vento|stella|sole|giardino|ponte|strada|cavallo|lupo|uccello|albero|fiore|rosa|oro|argento|ferro|zafferano=saffron|vino|tè|caffè|musica|canzone|danza|libro|biblioteca|scuola|città|villaggio|casa|madre|amico|amore|speranza|libertà|pace|guerra|tempo|memoria|silenzio|ombra|specchio|finestra|porta|chiave|mappa|nave|treno|orologio|campana|inverno|estate|autunno',
  pl: 'księżyc|morze|las|góra|ogień|marzenie|światło|burza|chleb|miód|rzeka|wyspa|pustynia|śnieg|deszcz|wiatr|gwiazda|słońce|ogród|most|droga|koń|wilk|ptak|drzewo|kwiat|róża|złoto|srebro|żelazo|sól|wino|herbata|kawa|muzyka|piosenka|taniec|książka|biblioteka|szkoła|miasto|wieś|dom|matka|przyjaciel|miłość|nadzieja|wolność|pokój|wojna|czas|pamięć|cisza|cień|lustro|okno|drzwi|klucz|mapa|statek|pociąg|zegar|dzwon|zima|lato|jesień',
  uk: 'місяць|море|ліс|гора|вогонь|мрія|світло|буря|хліб|бджола=bee|річка|острів|пустеля|сніг|дощ|вітер|зірка|сонце|сад|переправа=crossing|дорога|кінь|вовк|птах|дерево|квітка|троянда|золото|срібло|залізо|сіль|вино|чай|кава|музика|пісня|танець|книга|бібліотека|школа|місто|село|дім|мама|друг|кохання|надія|свобода|мир|війна|вічність=eternity|спогад|тиша|тінь|дзеркало|вікно|двері|ключ|карта|корабель|потяг|годинник|дзвін|зима|літо|осінь',
  nl: 'maanlicht=moonlight|oceaan=ocean|bossen=forests|berg|vuur|droom|licht|storm|brood|honing|rivier|eiland|woestijn|sneeuw|regen|wind|sterren=stars|zonlicht=sunlight|tuin|brug|straat=street|paard|wolf|vogel|boom|bloem|roos|goud|zilver|ijzer|zout|wijn|thee|koffie|muziek|lied|dans|boek|bibliotheek|school|hoofdstad=capital|dorp|huis|moeder|vriend|liefde|hoop|vrijheid|vrede|oorlog|eeuwigheid=eternity|herinnering|stilte|schaduw|spiegel|raam|deur|sleutel|kaart|schip|trein|klok|beiaard=carillon|winter|zomer|herfst',
  ro: 'lună|ocean=ocean|pădure|munte|focul|visul|lumină|furtună|pâine|miere|râu|insulă|deșert|zăpadă|ploaie|vânt|stele=stars|soare|grădină|podul|drum|armăsar=stallion|lupul|pasăre|copac|floare|trandafir|aurul|argint|fier|sare|vinul|ceai|cafea|muzică|cântec|dans|carte|bibliotecă|școală|oraș|sat|casă|mamă|prieten|dragoste|speranță|libertate|pace|război|timp|amintire|liniște|umbră|oglindă|fereastră|ușă|cheie|hartă|navă|tren|ceas|clopot|iarnă|vară|toamnă',
  el: 'φεγγάρι|θάλασσα|δάσος|οροσειρά=mountain range|πυρκαγιά=wildfire|όνειρο|φως|καταιγίδα|ψωμί|μέλισσα=bee|ποταμός|νησί|έρημος|χιονόπτωση=snowfall|βροχή|άνεμος|αστέρι|ήλιος|κήπος|γέφυρα|δρόμος|άλογο|αετός=eagle|πουλί|δέντρο|λουλούδι|τριαντάφυλλο|χρυσός|ασήμι|σίδηρος|αλάτι|κρασί|τσάι|καφές|μουσική|τραγούδι|χορός|βιβλίο|βιβλιοθήκη|σχολείο|πόλη|χωριό|σπίτι|μητέρα|φίλος|αγάπη|ελπίδα|ελευθερία|ειρήνη|πόλεμος|χρόνος|μνήμη|σιωπή|σκιά|καθρέφτης|παράθυρο|κατώφλι=threshold|κλειδί|χάρτης|πλοίο|σιδηρόδρομος=railway|ρολόι|καμπάνα|χειμώνας|καλοκαίρι|φθινόπωρο',
  hu: 'holdfény=moonlight|tenger|erdő|hegy|tűz|álom|fény|vihar|kenyér|méz|folyó|sziget|sivatag|hóesés=snowfall|eső|szél|csillag|napfény=sunshine|kert|híd|országút=highway|csikó=foal|farkas|madár|fenyő=pine|virág|rózsa|arany|ezüst|acél=steel|fűszer=spice|szőlő=grape|tea|kávé|zene|dallam=melody|tánc|könyv|könyvtár|iskola|város|falu|ház|édesanya|barát|szerelem|remény|szabadság|béke|háború|idő|emlék|csend|árnyék|tükör|ablak|ajtó|kulcs|térkép|hajó|vonat|óra|harang|tél|nyár|lombhullás=leaf fall',
  cs: 'měsíc|moře|les|pohoří=mountain range|oheň|snění=dreaming|světlo|bouře|chléb|včela=bee|řeka|ostrov|poušť|sníh|déšť|vítr|hvězda|slunce|zahrada|most|cesta|kůň|vlk|pták|strom|květina|růže|zlato|stříbro|železo|sůl|víno|čaj|káva|hudba|píseň|tanec|kniha|knihovna|škola|město|vesnice|dům|matka|přítel|láska|naděje|svoboda|smír=reconciliation|válka|věčnost=eternity|paměť|ticho|stín|zrcadlo|okno|dveře|klíč|mapa|loď|vlak|hodiny|zvon|zima|prázdniny=holidays|podzim',
  sv: 'måne|hav|skog|berg|eld|dröm|ljus|storm|bröd|honung|flod|skärgård=archipelago|öken|snö|regn|vind|stjärna|solen=the sun|trädgård|brygga=jetty|vägen=the road|häst|varg|fågel|träd|blomma|rosor=roses|guld|silver|järn|salt|vinet=the wine|kanel=cinnamon|kaffe|musik|sång|dansen=the dance|bok|bibliotek|skola|storstad=metropolis|landsbygd=countryside|hus|mamma|vänskap=friendship|kärlek|förhoppning|frihet|freden=the peace|krig|evighet=eternity|minne|tystnad|skugga|spegel|fönster|dörr|nyckel|karta|skepp|tåg|klocka|kyrkklocka=church bell|vinter|sommar|höst',
};

const POPULAR_RAW = {
  en: POPULAR_CONCEPTS.join('|'),
  zh: '生命|死亡|上帝|金钱|水源=water source|家庭|工作|科学|艺术|真理|权力|历史|自然|食物|健康|语言|心脏|家犬=domestic dog|家猫=domestic cat|气候',
  hi: 'जीवन|मृत्यु|ईश्वर|पैसा|पानी|परिवार|कार्य|विज्ञान|चित्रकला=painting|सत्य|शक्ति|इतिहास|प्रकृति|भोजन|स्वास्थ्य|भाषा|हृदय|कुत्ता|बिल्ली|जलवायु',
  es: 'vida|muerte|dios|dinero|agua|familia|trabajo|ciencia|arte|verdad|fuerza=strength|historia|naturaleza|comida|salud|lengua|corazón|perro|gato|clima',
  ar: 'حياة|موت|إله|مال|ماء|عائلة|عمل|علم|فن|حقيقة|قوة|تاريخ|طبيعة|طعام|صحة|لغة|قلب|كلب|قطة|مناخ',
  fr: 'vie|mort|dieu|monnaie=currency|eau|famille|travail|science|art|vérité|pouvoir|histoire|nature|nourriture|santé|langue|cœur|chien|chat|climat',
  bn: 'জীবন|মৃত্যু|ঈশ্বর|টাকা|পানি|পরিবার|কাজ|বিজ্ঞান|শিল্প|সত্য|ক্ষমতা|ইতিহাস|প্রকৃতি|খাদ্য|স্বাস্থ্য|ভাষা|হৃদয়|কুকুর|বিড়াল|জলবায়ু',
  pt: 'vida|morte|deus|dinheiro|água|família|trabalho|ciência|arte|verdade|força=strength|história|natureza|comida|saúde|língua|coração|cão|gato|clima',
  ru: 'жизнь|смерть|бог|деньги|вода|семья|работа|наука|искусство|истина|власть|история|природа|пища|здоровье|язык|сердце|собака|кошка|климат',
  id: 'kehidupan|kematian|tuhan|uang|air|keluarga|kerja|sains|kesenian|kebenaran|kekuasaan|sejarah|lingkungan=environment|makanan|kesehatan|bahasa|jantung|anjing|kucing|iklim',
  ur: 'زندگی|موت|خدا|پیسہ|پانی|خاندان|کام|سائنس|فن|سچ|طاقت|تاریخ|فطرت|کھانا|صحت|زبان|قلب|کتے=dogs|بلیاں=cats|موسم=weather',
  de: 'Leben|Tod|Gott|Geld|Wasser|Familie|Arbeit|Wissenschaft|Kunst|Wahrheit|Macht|Geschichte|Natur|Essen|Gesundheit|Sprache|Herz|Hund|Katze|Klima',
  it: 'vita|morte|dio|denaro|acqua|famiglia|lavoro|scienza|arte|verità|forza=strength|storia|natura|cibo|salute|lingua|cuore|cane|gatto|clima',
  pl: 'życie|śmierć|bóg|pieniądze|woda|rodzina|praca|nauka|sztuka|prawda|władza|historia|przyroda|jedzenie|zdrowie|język|serce|pies|kot|klimat',
  uk: 'життя|смерть|бог|гроші|вода|родина|робота|наука|мистецтво|правда|влада|історія|природа|їжа|медицина=medicine|мова|серце|собака|кіт|клімат',
  nl: 'leven|dood|god|rijkdom=wealth|water|familie|werk|wetenschap|kunst|waarheid|macht|geschiedenis|natuur|voedsel|gezondheid|taal|hart|honden=dogs|katten=cats|klimaat',
  ro: 'viață|moarte|dumnezeu|bani|izvor=spring (water)|familie|muncă|știință|artă|adevăr|putere|istorie|natură|mâncare|sănătate|limbă|inimă|câine|pisică|climă',
  el: 'ύπαρξη=existence|θάνατος|θεότητα=deity|χρήματα|νερό|οικογένεια|δουλειά|επιστήμη|ζωγραφική=painting|αλήθεια|εξουσία|ιστορία|περιβάλλον=environment|φαγητό|υγεία|γλώσσα|καρδιά|σκύλος|γάτα|κλιματική=climatic',
  hu: 'élet|halál|isten|pénz|víz|család|munka|tudomány|művészet|igazság|hatalom|történelem|természet|étel|egészség|nyelv|szívverés=heartbeat|kutya|macska|éghajlat',
  cs: 'život|smrt|bůh|peníze|voda|rodina|práce|věda|umění|pravda|síla=strength|historie|příroda|jídlo|zdraví|jazyk|srdce|pes|kočka|klima',
  sv: 'liv|död|gud|pengar|vatten|familj|arbete|vetenskap|konsten=the art|sanning|makt|historia|natur|måltid=meal|hälsa|språk|hjärta|hundar=dogs|katt|klimat',
};

function parse(raw, concepts) {
  const out = {};
  for (const [code, s] of Object.entries(raw)) {
    const items = s.split('|');
    if (items.length !== concepts.length) throw new Error(`${code}: ${items.length} words, expected ${concepts.length}`);
    out[code] = items.map((it, i) => {
      const [word, gloss] = it.split('=');
      return { word: word.normalize('NFC').trim(), gloss: gloss || concepts[i], concept: concepts[i] };
    });
  }
  return out;
}
export const WOTD = parse(WOTD_RAW, WOTD_CONCEPTS);
export const POPULAR = parse(POPULAR_RAW, POPULAR_CONCEPTS);

// ---- word of the day: same for everyone, changes at 00:00 UTC --------------
const DAY_MS = 86400000;
export const utcDay = (date = new Date()) => Math.floor(date.getTime() / DAY_MS);
// Fixed pseudo-random order of the concepts (so consecutive days are unrelated).
const ORDER = (() => {
  const idx = WOTD_CONCEPTS.map((_, i) => i);
  let s = 0x2026c0de;
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
})();
export const wotdIndex = (day) => ORDER[((day % ORDER.length) + ORDER.length) % ORDER.length];
/** Today's word for a language: { word, gloss, concept, day, date: 'YYYY-MM-DD' }. */
export function wordOfDay(code, date = new Date()) {
  const day = utcDay(date);
  const list = WOTD[code] || WOTD.en;
  return { ...list[wotdIndex(day)], day, date: new Date(day * DAY_MS).toISOString().slice(0, 10) };
}

/** URL path segment / file name for a word (lower-case, NFC). */
export const slug = (word) => word.normalize('NFC').trim().toLowerCase();
