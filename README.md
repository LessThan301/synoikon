# Synoikon

**The company a word keeps, drawn from real text on the web.**

> **Status (2026-10-10): synoikon.com shows a "coming soon" placeholder** (on `main`) until an Impressum is in place.
> The full app lives on this `app` branch; tag `app-live-2026-10-10` marks exactly what was live. The daily
> precompute workflow is disabled.
>
> **To restore the app on synoikon.com:**
> ```bash
> git fetch origin
> git checkout main
> git reset --hard origin/app          # or: git merge origin/app  (keeps the placeholder commits in history)
> git push --force-with-lease origin main   # only needed after reset --hard
> gh workflow enable precompute.yml -R LessThan301/synoikon
> gh workflow run precompute.yml -R LessThan301/synoikon    # optional: refresh precomputed words now
> ```
> Keep the `CNAME` file (synoikon.com). Before going live: add the Impressum/privacy page (e.g. link it from the
> sidebar footer and `about.html`), and fix the Cloudflare Web Analytics hostname (Web Analytics → Manage site →
> hostname `synoikon.com`, or put a new token in `js/analytics.js`). Returning visitors pick up the app again
> automatically: the placeholder's `/sw.js` unregisters itself, and the app registers its own service worker.
> Note: the placeholder period's commits on `main` only delete files and add the placeholder, so `git merge origin/app`
> would keep those deletions; use `git reset --hard origin/app` (or `git revert` the placeholder commit) to bring every file back.


Live: **https://synoikon.com/** · installable as an app · works offline for popular words ·
[today’s word](https://synoikon.com/#wotd) · [all precomputed words](https://synoikon.com/w/) · [about & attribution](https://synoikon.com/about.html)

*Formerly **Contexter**.* Old links (`lessthan301.github.io/contexter/…` and `lessthan301.github.io/synoikon/…`, including `#q=`
links and `/w/` pages) redirect to the same page on synoikon.com: `/synoikon/` via GitHub Pages' custom-domain redirect, `/contexter/` via the small [LessThan301/contexter](https://github.com/LessThan301/contexter) repo, whose `sw.js` also
retires the old app's service worker and caches on devices that installed it; saved settings carry over.

Type a word. Synoikon gathers hundreds of real sentences that contain it, looks at
the words that appear around it, and draws them as an interactive semantic network.

- **Circle area** = how often a neighbor word appears near your word (radius ∝ √frequency).
- **Line length** = how often two words appear together: the more they co-occur, the **shorter** the line.
- **Line thickness / opacity** = the same strength, so strong ties are also bold.
- Circles are borderless; the search word is the orange circle in the centre (with a soft halo).

Idea: “For any word, it finds a population of instances on the web, then builds an
interactive semantic network … Size of circles shows frequency of neighbors.”

## Using it

- Type a word or short phrase and press **Map it** (or try an example chip).
- **Sidebar** (left, full height): *Search & language*, *Ranking*, *Network* sliders, *Sources*, *Stopwords*, *Display & export*
  and *Results* (corpus, samples, neighbor table), each scrolling inside the sidebar. On desktop it is open by default; the
  panel button collapses it to an icon rail (the map widens and refits; the search moves to a top bar; the choice is remembered).
  Rail icons jump to a section. On phones (< 768 px) it is a drawer: ☰ opens it over the map, Esc / × / tapping outside closes it.
- **Hover** a circle: its connections light up, the tooltip shows counts, and the sidebar
  shows real text samples where both words appear.
- **Click** a circle (or a row in the neighbor table) to map that word instead.
- **Drag** circles, **scroll/pinch** to zoom, drag the background to pan. ⤢ fits, ⤓ downloads an SVG.
- **Settings**: ranking mode (Distinctive/Frequency), number of neighbors, context window (± words), minimum co-occurrence for a line,
  maximum lines per word, corpus size, stopwords (the selected language's list, plus optionally English), which sources to use.
- The **language selector** (21 languages, shown by native name) switches the Wikipedia/Wikiquote/Wiktionary editions, the tokenizer, the stopwords and the background list. See [Languages](#languages).
- Links are shareable: `…/#q=river&lang=en` (add `&rank=frequency` for frequency mode). `…/#wotd` (optionally `&lang=de`) opens today’s word.
- **Today’s word** (start screen): one word per language per day, the same for everyone, changing at 00:00 UTC.
- **Share map** (share icon under the zoom buttons): a PNG card (1200×630 or 1080×1080) with the word, language, the network,
  the link and the text attribution. *Share image…* uses the Web Share API with files where the browser supports it (mobile);
  otherwise *Download PNG*. *Copy link* copies the static word page (for precomputed words, which has a proper preview image) or the `#q=` link.
- **Install app**: appears under *Display & export* where the browser supports install prompts (Chrome/Edge/Android). On iOS use Safari’s *Share → Add to Home Screen*.

## Where the text comes from

All requests go straight from the browser to free, key-less, CORS-enabled APIs (Wikimedia requests carry
`Api-User-Agent: LessThan301 synoikon (github.com/LessThan301/synoikon)`, which Wikimedia’s CORS policy allows).
The only stored text is the precomputed popular words (below).

| Source | What is used |
| --- | --- |
| Wikipedia search (`list=search`) | up to 250/500/1000 search-result snippets around the word |
| Wikipedia extracts (`prop=extracts`, intro) | plain-text intros of the top matching articles |
| Wikiquote search | snippets from quotations |
| Wiktionary search (off by default) | dictionary usage snippets |
| Hacker News via Algolia (English only) | comments containing the word |

## Languages

| Language | Code | Text sources | Stopwords | Background list (Distinctive) | Tokenization / matching notes |
| --- | --- | --- | --- | --- | --- |
| English | en | Wikipedia, Wikiquote, Wiktionary, Hacker News | Synoikon's own list | Wikipedia (IlyaSemenov) | suffix rules (river/rivers) |
| 中文 Chinese (Mandarin) | zh | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Leipzig `cmn_wikipedia_2021_300K` | `Intl.Segmenter` words; search word matched as a substring; bigram fallback |
| हिन्दी Hindi | hi | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Leipzig `hin_wikipedia_2021_300K` | stem prefix (नदी → नदियों) |
| Español | es | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Wikipedia (IlyaSemenov) | stem prefix, plurals merged |
| العربية Arabic | ar | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Wikipedia (IlyaSemenov), re-normalised | diacritics/tatweel removed, alef unified, ال/وال/بال/لل… article stripped |
| Français | fr | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Wikipedia (IlyaSemenov) | stem prefix, plurals merged |
| বাংলা Bengali | bn | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Leipzig `ben_wikipedia_2021_300K` | stem prefix |
| Português | pt | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Wikipedia (IlyaSemenov) | stem prefix, plurals merged |
| Русский Russian | ru | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Wikipedia (IlyaSemenov) | stem prefix (река → реки/реке/рекой) |
| Bahasa Indonesia | id | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Leipzig `ind_wikipedia_2021_300K` | word + up to 3 letters (sungainya) |
| اردو Urdu | ur | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Leipzig `urd_wikipedia_2021_300K` | diacritics removed; word + ≤ 2 letters (دریائے) |
| Deutsch | de | Wikipedia, Wikiquote, Wiktionary | Synoikon list + stopwords-iso + wiki terms | Wikipedia (IlyaSemenov) | suffix rules |
| Italiano | it | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Wikipedia (IlyaSemenov) | stem prefix (fiume → fiumi) |
| Polski | pl | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Wikipedia (IlyaSemenov) | stem prefix |
| Українська | uk | Wikipedia, Wikiquote, Wiktionary | stopwords-iso (only 73 words) + wiki terms | Wikipedia (IlyaSemenov) | stem prefix |
| Nederlands | nl | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Wikipedia (IlyaSemenov) | word + up to 3 letters |
| Română | ro | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Leipzig `ron_wikipedia_2021_300K` | stem prefix |
| Ελληνικά Greek | el | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Leipzig `ell_wikipedia_2021_300K` | accent-insensitive; stem prefix |
| Magyar | hu | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Leipzig `hun_wikipedia_2021_300K` | word + up to 5 letters (folyóban) |
| Čeština | cs | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Leipzig `ces_wikipedia_2021_300K` | stem prefix |
| Svenska | sv | Wikipedia, Wikiquote, Wiktionary | stopwords-iso + wiki terms | Wikipedia (IlyaSemenov) | word + up to 3 letters |

- **Hacker News** is English-only, so it's disabled for the other languages.
- **Lazy loading:** stopword lists (`data/stop-xx.txt`, 1–8 KB), background lists (`data/freq-xx.txt`, ~200 KB gzipped) and web fonts are fetched only when a language is used.
- **Tokenizer:** Unicode-aware. A word is a letter or digit followed by letters, digits, **combining marks** (`\p{M}`: Devanagari/Bengali vowel signs and viramas, Arabic harakat), ZWJ/ZWNJ (Indic conjuncts, Urdu), apostrophes and hyphens.
- **Chinese:** segmented with `Intl.Segmenter('zh', {granularity: 'word'})` (Chrome/Edge/Safari, Firefox ≥ 125). Older browsers fall back to overlapping character bigrams that skip very frequent function characters (tested: noticeably noisier, but usable).
- **Right-to-left (Arabic, Urdu):**
  - The search box, snippets, table cells and labels use `dir="auto"` / `<bdi>`.
  - Canvas labels are drawn with `direction = 'rtl'`.
  - The SVG export marks RTL labels.
- **Fonts:** Devanagari, Bengali, Arabic (Noto Naskh), Urdu (Noto Nastaliq) and Simplified Chinese (Noto Sans SC, split by Unicode range so only the needed glyphs download) come from [Fontsource](https://fontsource.org/) on jsDelivr (SIL OFL). They load only for those languages; the canvas waits for them and redraws.
  - The downloaded SVG names the same font stack, so the viewer needs those fonts or system fonts for the script.

## Method

1. **Collect** texts from the enabled sources (in parallel; one failing source doesn’t break the rest). Duplicate texts are removed.
2. **Tokenize** (Unicode-aware, lower-cased, language-specific normalisation; see [Languages](#languages)) and find every occurrence of the search word, including simple inflections. Multi-word phrases are matched as a sequence; Chinese words as substrings.
3. For each occurrence take a **context window** of ±*w* words. Identical windows (boilerplate) are counted once. Stopwords, numbers, very short tokens and forms of the search word itself are dropped; simple plurals are merged with their singular.
4. **Counts**
   - `freq(n)` = occurrences of neighbor *n* inside all windows → node area.
   - `cooc(word, n)` = number of windows containing *n* → line from the centre.
   - `cooc(a, b)` = number of windows containing both *a* and *b* → line between neighbors.
5. **Choose the top *N* neighbors** with the *Rank neighbors by* toggle:
   - **Distinctive** (default) ranks by association strength, not raw count. Each neighbor’s count inside the windows, `a` (out of `Nin` window tokens), is compared with its count `r` in all of Wikipedia in that language (`R` tokens; bundled lists in `data/`).
     - `E = Nin·(a+r)/(Nin+R)` is how often the word would appear in the windows if it were as common as in general text.
     - **Score** = smoothed log-ratio `log2((a+1)/(E+1))`. A score of 3 means about 8× more often than expected. The +1 (add-one) smoothing keeps tiny expected counts from blowing up.
     - **Filters:** a word must appear in **≥ 3 windows** and have Dunning **log-likelihood G² ≥ 10.83** (p < 0.001). One-off rarities can’t dominate.
     - Words missing from the 40k-word list get a count of half the list’s cutoff.
     - Effect: generic words (south, north, water, state, united…) drop out, and words that really belong to the target (tributary, flowing, basin, creek, rises…) move up.
   - **Frequency** ranks by raw count (must appear in ≥ 2 windows).
   - Either way, **circle area is still frequency**. Only *which* neighbors appear changes. The tooltip and neighbor table show the distinctiveness score (plus the ≈× factor and G² in the tooltip).

   Why not use the rest of the fetched text as the background? Every fetched text was retrieved *because* it contains the word, so it’s biased toward that word’s topic. Tested on “river”, an in-corpus background mostly pushed obscure river names up and left generic words like *major* and *south* near the top. A general-language reference fixes that.
6. Neighbor–neighbor lines need at least the minimum co-occurrence, and each word keeps only its strongest few lines to avoid a hairball.
7. **Layout** (D3 force simulation). Each line’s strength is `s = √(count / max count)` on one scale for all lines. Its preferred length (the gap between circle edges) is `gap = gapMin + (gapMax − gapMin)·(1 − s)`, so frequent pairs sit close together. Strong lines also pull harder, plus mild repulsion and collision so circles don’t overlap. The search word is pinned at the centre. Its circle uses the same area scale but is capped so it doesn’t fill the screen (the tooltip says when the cap applies).

## Rendering & performance

The network is drawn on a single `<canvas>` (sharp on high-DPI screens; device pixel ratio capped at 2), not as SVG elements:

- **One draw per frame.** Simulation ticks, zoom, drag and hover only mark the canvas dirty, and a `requestAnimationFrame` callback repaints it once. Pointer moves are coalesced to one hit test per frame.
- **The layout stops when settled.** New nodes start near their target distance, so the simulation converges in about 2 s with no big synchronous pre-computation, then stops (`alphaMin`). Hover never restarts it. Dragging warms it gently (`alphaTarget 0.12`). On slider changes, existing words keep their positions.
- **Cheap hit testing:** a linear distance scan over at most 81 circles, with no DOM listeners per node.
- **Level of detail:** labels smaller than 7 px on screen are skipped, except the search word and the hovered word's neighbors. Off-screen circles, labels and lines are culled.
- **Lines are stroked individually** with styles bucketed (width/opacity quantised). On software-rasterised canvases this is several times faster than one giant path.
- **Analysis is cached:** tokenisation is done once per corpus, and windows/counts/scores once per window size and stopword setting. "Neighbors shown", "min. co-occurrence" and "max. lines" redraw in a few ms.
- **SVG download** is generated on demand from the current layout.

Measured in headless Chromium with 4× CPU throttling, 80 neighbors, ±15 window and ~350 lines (`tests/perf.mjs`):

| Interaction | before (SVG) | after (canvas) |
| --- | --- | --- |
| drag a node, GPU raster | 2.8 fps | 60 fps |
| wheel zoom, GPU raster | 1.5 fps | 60 fps |
| hover sweep, GPU raster | 7 fps | 60 fps (one run had a single 1 s first-hover stall in SwiftShader) |
| hover sweep, software raster | 34 fps (p95 83 ms) | 54–60 fps |
| drag a node, software raster | 31 fps (p95 67 ms) | 51–54 fps |
| wheel zoom, software raster | 60 fps | 44 fps (zoomed-in thick strokes are rasterised on the main thread) |
| slider change → new layout (longest frame) | 567 ms | 150 ms |

## App features

### Installable, offline-capable (PWA)

- `manifest.webmanifest`: name, 192/512 icons + maskable icons, theme colours, `start_url`/`scope` relative to the manifest so
  they resolve to the site root `/`, and a *Word of the day* shortcut.
- `sw.js` (scope `/`). Cache names carry content hashes written by `node tools/stamp-sw.mjs`; old caches are deleted on activate.

  | Cache | What | Strategy |
  | --- | --- | --- |
  | `synoikon-shell-<hash>` | HTML, CSS, JS modules, icons, D3 | precached on install, cache-first |
  | `synoikon-data-<hash>` | stopword + background lists, per language as used | cache-first |
  | `synoikon-precomputed` | precomputed networks (≤250) | stale-while-revalidate |
  | `synoikon-api` | recent search results from Wikimedia/HN (≤160 responses ≈ the last 30–40 searches) | stale-while-revalidate |
  | `synoikon-pages` / `synoikon-fonts` | visited word pages (≤60) / script fonts (≤60) | network-first / cache-first |

  Offline, the app opens, precomputed words and recent searches work, and other words show an offline message listing what is available.
  Unknown pages fall back to `offline.html`. Requests to Cloudflare’s analytics are never intercepted (and POSTs are never touched).

### Word of the day

`js/words.js` holds 66 evocative concepts (moon, sea, forest … autumn) translated into all 21 languages, plus 20 popular concepts.
Literal translations that the word matcher would confuse were replaced (e.g. French *été* is also “been”, Dutch *zon* would match
*zondag*); the substitute carries its own English gloss. The day’s word is `concepts[shuffle[day mod 66]]` with
`day = floor(UTC ms / 86 400 000)` and a fixed seeded shuffle, so it is identical worldwide and the same concept in every language.

### Precomputed popular words

`node tools/precompute.mjs` runs the same fetch + analysis as the browser for the next 30 days of words of the day plus the 20 popular
words in every language (≈1 050 words), and writes `data/precomputed/<lang>/<word>.json` (~13 KB each). A file stores the
top 80 neighbours in both ranking modes plus every pair count ≥ 2 among them, so the app rebuilds **exactly** the live network
(verified by `tests/precomputed.test.mjs`) for any *Neighbors shown* ≤ 80, *Min. co-occurrence* ≥ 2, any *Max. lines* and either ranking,
instantly and offline. Changing the window, corpus size, sources or stopwords, or pressing *Refresh with live data*, fetches live text.

Politeness: `Api-User-Agent`/`User-Agent` with contact, at most 3 requests in flight, `Retry-After` honoured on 429/503,
exponential back-off otherwise. Files younger than 30 days are skipped.

`.github/workflows/precompute.yml` runs daily at 02:17 UTC (and on demand) and stays short: it computes today's and the next two
days' words of the day, then rotates through missing or > 30-day-old popular words (≤ 60 per run, `--budget-min 20` wall-clock
budget, `--word-timeout 180` per word; on GitHub runners Wikimedia answers ~3× slower than from a home connection, ~30 s/word).
Then it renders Open Graph images for new/refreshed words, rebuilds pages and sitemap, commits, pushes and requests a Pages build.
Steps have their own timeouts and anything finished is still committed if precompute is cut short.

### Static word pages (SEO)

`node tools/build-pages.mjs` writes `w/<lang>/<word>/index.html` for every precomputed word: title, meta description with the
top neighbours, canonical URL, Open Graph/Twitter tags with a pre-rendered 1200×630 image (`og.png`, made by
`node tools/render-og.mjs` with the app’s own card renderer in headless Chromium, then palette-quantized to ~40 KB),
`hreflang` links to the same concept in other languages, JSON-LD, top neighbour lists, sample sentences with source links,
and a button into the interactive map. Also `w/` and `w/<lang>/` indexes, `sitemap.xml`, `robots.txt` and `about.html`.

### Analytics

Cloudflare Web Analytics (cookieless) is configured in `js/analytics.js` (`CF_ANALYTICS.token`; empty = off). It loads only on
`synoikon.com` (and `www.`), so local runs and tests send nothing, and it runs on the app, `about.html` and every word page.

## Run locally

It’s plain static files (ES modules), so it needs a local web server rather than `file://`.
`tools/serve.mjs` serves the repo at the site root, like synoikon.com (the offline page and service worker expect that):

```bash
cd synoikon
node tools/serve.mjs 8765
# open http://localhost:8765/
```

D3 v7 and the script web fonts are loaded from the jsDelivr CDN.

### Data sources & credits

- **Background word frequencies** (`data/freq-*.txt`, top 40k words, frequencies rounded to 3 significant digits):
  - en, de, fr, es, it, nl, pt, ru, pl, uk, sv, ar: whole-Wikipedia counts from [IlyaSemenov/wikipedia-word-frequency](https://github.com/IlyaSemenov/wikipedia-word-frequency) (MIT).
  - zh, hi, bn, ur, id, ro, el, hu, cs: not in that set (its Chinese list isn't word-segmented). For these, Synoikon counted words itself, with its own tokenizer, in the 300K-sentence Wikipedia corpora of the [Leipzig Corpora Collection](https://wortschatz.uni-leipzig.de/en/download) (downloads licensed CC BY, per their [terms](https://wortschatz.uni-leipzig.de/en/usage)). Citation: D. Goldhahn, T. Eckart, U. Quasthoff, *Building Large Monolingual Dictionaries at the Leipzig Corpora Collection: From 100 to 200 Languages*, LREC 2012.
- **Stopwords:** [stopwords-iso](https://github.com/stopwords-iso/stopwords-iso) (MIT), normalised with Synoikon's tokenizer. Synoikon adds a few wiki-boilerplate words per language (disambiguation phrases, "see also", "(in English: …)"). English uses Synoikon's own list.
- **Fonts:** Google Noto via Fontsource (SIL Open Font License).
- **Rebuilding the data:** `node tools/build-data.mjs <stopwords-iso.json> <ilya-dir> <leipzig-dir>` (inputs are downloaded separately; see the header of the script).

### Tests (optional)

```bash
node tests/analysis.test.mjs                   # analysis on a tiny corpus
node tests/ranking.test.mjs river en           # Frequency vs Distinctive top-30 on a live corpus
npm i playwright && npx playwright install chromium
python3 -m http.server 8765 &                  # from the repo root
node tests/e2e.mjs river en                    # end-to-end: search, ranking toggle, hover, zoom, drag, slider, SVG, click
node tests/e2e.mjs river en 390 844            # same on a 390 px touch phone (pinch, touch drag, tap)
node tests/perf.mjs http://localhost:8765/     # FPS / frame-time profile under 4x CPU throttling
node tests/languages.test.mjs                  # Node: live corpus + top neighbors for every language's sample word
node tests/languages.e2e.mjs                   # browser: every language renders, fonts load, RTL, no console errors
node tests/ranking.test.mjs río es             # Frequency vs Distinctive for any word/language
node tests/words.test.mjs                      # word-of-the-day lists (≥60 × 21, single tokens, UTC day logic)
node tests/precomputed.test.mjs                # precomputed record decodes to exactly the live network (482 checks)
node tools/stamp-sw.mjs --check                # sw.js cache version matches the current files
node tools/serve.mjs 8765 &                    # browser tests use the local server:
node tests/phase1.e2e.mjs http://localhost:8765/            # PWA installability (CDP), SW, offline, WOTD, precomputed, share, pages, analytics
node tests/phase1.e2e.mjs http://localhost:8765/ 390 844    # same on a phone (Web Share with files is stubbed)
node tests/sidebar.e2e.mjs http://localhost:8765/            # sidebar: rail collapse, canvas refit, persistence, keyboard, RTL
node tests/sidebar.e2e.mjs http://localhost:8765/ 390 844    # drawer: open/close, backdrop, Esc, focus trap
node tests/redirect.e2e.mjs [1400 900|390 844]                          # live: old /contexter/, /synoikon/ and www links reach synoikon.com
```

The e2e/perf/language tests take the base URL as an argument (`http://localhost:8765/`).

## Hosting

Any static host works. Live on GitHub Pages (deploy from `main`, root folder) with the custom domain **synoikon.com** (`CNAME` file; DNS at Cloudflare, DNS-only: apex A records to GitHub Pages, `www` CNAME to `lessthan301.github.io`; GitHub redirects `www` and `lessthan301.github.io/synoikon/` to the apex).

## Limitations

- Corpus = what free APIs return (mostly encyclopedic text plus Hacker News), so it’s skewed toward Wikipedia-style usage (e.g. place names for “river”). It doesn’t represent all language on the web.
- Search snippets are short (≈30 words), so wide windows mostly help with article intros and comments.
- Stemming is deliberately simple: suffix rules for English/German, and elsewhere "stem prefix + a few letters".
  - This misses forms that change the stem (Arabic broken plurals نهر → أنهار, Czech řeka → řece) and occasionally catches an unrelated word that shares the prefix.
  - Neighbors are not lemmatised: Slavic, Hungarian, etc. show several case forms of one word (басейн / басейну).
- **Chinese:**
  - Wikipedia returns a mix of Simplified and Traditional characters, so variants such as 境内/境內 appear as separate words.
  - The background list comes from a mixed-script corpus.
  - Single-character words are ignored.
- **Greek:** labels are shown without accents (matching is accent-insensitive).
- **Arabic:** labels are shown without the article ال.
- **Background lists:** the Leipzig-based lists (zh, hi, bn, ur, id, ro, el, hu, cs) come from only about 4–6 M tokens, versus 0.2–2.5 G for the whole-Wikipedia lists. Rare words in those languages get less reliable distinctiveness scores.
- **Stopwords:** stopwords-iso quality varies (Ukrainian has only 73 words; the Russian list contains a few content words). Function words like Hindi वाली can still appear. In Distinctive mode they rarely matter.
- **Foreign names:** many wikis cite foreign names ("(English: river)"), so words like *river* / *rio* show up as neighbors in several languages.
- **Hacker News:** English only.
- Neighbors are ranked by raw frequency, so very general words can rank high. Use the stopword toggles or a higher *N*.
- **Precomputed words** use the default settings only; other settings fetch live text. They are up to 30 days old.
  `data/precomputed` contains short excerpts of CC BY-SA text (and short HN excerpts), so those files are CC BY-SA too.
- **Rich link previews** exist only for precomputed words (`/w/…` pages). `#q=` links show the generic preview because
  crawlers don’t run JavaScript or read URL fragments.
  The copy here documents intent; submit `sitemap.xml` in Google Search Console instead.
- **Install button** needs `beforeinstallprompt` (Chromium); Safari/iOS and Firefox use their own menus. **Web Share with files**
  works on Android Chrome and iOS Safari; elsewhere the card is downloaded.
- **Updates** reach installed/offline users on the second load after a deploy (the new service worker installs in the background).
- **Repository growth:** each precomputed word adds ~13 KB JSON + ~40 KB OG image; refreshes rewrite JSON only.
