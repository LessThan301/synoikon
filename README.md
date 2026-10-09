# Contexter

**The company a word keeps, drawn from real text on the web.**

Type a word. Contexter gathers hundreds of real sentences that contain it, looks at
the words that appear around it, and draws them as an interactive semantic network.

- **Circle area** = how often a neighbor word appears near your word (radius ∝ √frequency).
- **Line length** = how often two words appear together: the more they co-occur, the **shorter** the line.
- **Line thickness / opacity** = the same strength, so strong ties are also bold.
- Circles are borderless; the search word is the orange circle in the centre (with a soft halo).

Idea: “For any word, it finds a population of instances on the web, then builds an
interactive semantic network … Size of circles shows frequency of neighbors.”

## Using it

- Type a word or short phrase and press **Map it** (or try an example chip).
- **Hover** a circle: its connections light up, the tooltip shows counts, and the side
  panel shows real text samples where both words appear.
- **Click** a circle (or a row in the neighbor table) to map that word instead.
- **Drag** circles, **scroll/pinch** to zoom, drag the background to pan. ⤢ fits, ⤓ downloads an SVG.
- **Settings**: ranking mode (Distinctive/Frequency), number of neighbors, context window (± words), minimum co-occurrence for a line,
  maximum lines per word, corpus size, English/German stopwords, which sources to use.
- Language selector (EN, DE, FR, ES, IT, NL) switches the Wikipedia/Wikiquote/Wiktionary editions.
- Links are shareable: `…/#q=river&lang=en` (add `&rank=frequency` for frequency mode).

## Where the text comes from

All requests go straight from the browser to free, key-less, CORS-enabled APIs. Nothing is stored.

| Source | What is used |
| --- | --- |
| Wikipedia search (`list=search`) | up to 250/500/1000 search-result snippets around the word |
| Wikipedia extracts (`prop=extracts`, intro) | plain-text intros of the top matching articles |
| Wikiquote search | snippets from quotations |
| Wiktionary search (off by default) | dictionary usage snippets |
| Hacker News via Algolia (English only) | comments containing the word |

## Method

1. **Collect** texts from the enabled sources (in parallel; one failing source doesn’t break the rest). Duplicate texts are removed.
2. **Tokenize** (Unicode-aware, lower-cased) and find every occurrence of the search word, including simple inflections (river/rivers, Wald/Walde…). Multi-word phrases are matched as a sequence.
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

## Run locally

It’s plain static files (ES modules), so it needs a local web server rather than `file://`:

```bash
cd contexter
python3 -m http.server 8000
# open http://localhost:8000
```

D3 v7 is loaded from the jsDelivr CDN. Background word frequencies (`data/freq-*.txt`, top 40k words for EN/DE/FR/ES/IT/NL, about 220 KB gzipped each, loaded only for the selected language) come from [IlyaSemenov/wikipedia-word-frequency](https://github.com/IlyaSemenov/wikipedia-word-frequency) (MIT).

### Tests (optional)

```bash
node tests/analysis.test.mjs                   # analysis on a tiny corpus
node tests/ranking.test.mjs river en           # Frequency vs Distinctive top-30 on a live corpus
npm i playwright && npx playwright install chromium
python3 -m http.server 8765 &                  # from the repo root
node tests/e2e.mjs river en                    # headless end-to-end check, saves screenshots
```

## Hosting

Any static host works. On GitHub Pages: push to GitHub → *Settings → Pages* → deploy from the `main` branch, root folder.

## Limitations

- Corpus = what free APIs return (mostly encyclopedic text plus Hacker News), so it’s skewed toward Wikipedia-style usage (e.g. place names for “river”). It doesn’t represent all language on the web.
- Search snippets are short (≈30 words), so wide windows mostly help with article intros and comments.
- Stemming is deliberately simple (plural/inflection suffixes only).
- Neighbors are ranked by raw frequency, so very general words can rank high. Use the stopword toggles or a higher *N*.
