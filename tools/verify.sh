#!/usr/bin/env bash
# Verifies the Coming Soon placeholder. Usage: tools/verify.sh [base-url]  (default: local files only)
set -euo pipefail
cd "$(dirname "$0")/.."
fail=0; ok(){ echo "PASS $1"; }; bad(){ echo "FAIL $1"; fail=1; }
cmp -s index.html 404.html && ok "404.html == index.html" || bad "404.html differs from index.html"
cmp -s index.html tools/coming-soon/index.html && ok "index.html matches tools/coming-soon" || bad "index.html differs from tools/coming-soon"
grep -q 'name="robots" content="noindex"' index.html && ok "noindex meta" || bad "noindex meta missing"
grep -q 'Disallow: /' robots.txt && ok "robots disallow" || bad "robots.txt"
[ "$(cat CNAME)" = synoikon.com ] && ok "CNAME" || bad "CNAME"
node --check sw.js && ok "sw.js syntax" || bad "sw.js syntax"
if [ $# -gt 0 ]; then
  b=${1%/}
  for p in / /index.html /robots.txt /sw.js; do c=$(curl -s -o /dev/null -w '%{http_code}' "$b$p"); [ "$c" = 200 ] && ok "$p 200" || bad "$p $c"; done
  for p in /app/ /de/ /about.html; do c=$(curl -s -o /tmp/vb -w '%{http_code}' "$b$p"); [ "$c" = 404 ] && grep -q 'coming soon' /tmp/vb && ok "$p 404 placeholder" || bad "$p $c"; done
  curl -s "$b/" | grep -q 'coming soon' && ok "home is Coming Soon" || bad "home not Coming Soon"
fi
exit $fail
