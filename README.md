# Synoikon — Coming Soon placeholder

`main` publishes only a noindex Coming Soon page to https://synoikon.com (GitHub Pages, branch `main`, root).
Every other path returns the same page via `404.html`. `sw.js` removes old app service workers/caches on returning devices.

The full site is archived, not deleted: tags `release-2026-11-06-restore` / `nebula-live-2026-10-24` (520a7aa).
Placeholder snapshot: tag `nebula-main-placeholder-2026-11-06`. Do not publish the archived site without explicit approval.

## Run / check locally
    python3 -m http.server 8000        # open http://localhost:8000
    tools/verify.sh                    # file checks
    tools/verify.sh https://synoikon.com    # live checks incl. custom 404 (python http.server does not serve 404.html, so the 404 checks only pass on Pages)

`tools/coming-soon/` holds the source copies (`index.html` = live page, `index.nebula.html` = variant).
