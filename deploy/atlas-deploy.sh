#!/usr/bin/env bash
set -euo pipefail

SOURCE="/srv/atlas-source"
WEBROOT="/var/www/atlas"
SITE="https://www.ailover-atlas.com"
ANALYTICS_TOKEN="b8477ada2f504530bf2b707ee1ac3efe"
STAGING=""

say() { printf '\n[atlas-deploy] %s\n' "$*"; }
fail() { printf '\n[atlas-deploy] ERROR: %s\n' "$*" >&2; exit 1; }
cleanup() {
  if [ -n "$STAGING" ] && [ -d "$STAGING" ]; then
    rm -rf "$STAGING"
  fi
}
trap cleanup EXIT

for command in git rsync sed find curl python3 grep node mktemp; do
  command -v "$command" >/dev/null 2>&1 || fail "missing command: $command"
done

[ -d "$SOURCE/.git" ] || fail "$SOURCE is not a Git repository"
[ -d "$WEBROOT" ] || fail "$WEBROOT does not exist"

cd "$SOURCE"

if [ -n "$(git status --porcelain)" ]; then
  git status --short
  fail "server source checkout has local changes; refusing to overwrite them"
fi

say "Fetching GitHub main..."
git fetch origin main --quiet

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/main)"

printf 'Current : %s\n' "$(git rev-parse --short=12 "$LOCAL_SHA")"
printf 'GitHub  : %s\n' "$(git rev-parse --short=12 "$REMOTE_SHA")"

if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
  printf '\nPending commits:\n'
  git log --oneline --no-decorate "$LOCAL_SHA..$REMOTE_SHA"
else
  printf '\nGitHub main is already pulled; this will redeploy the current commit.\n'
fi

if [ "${1:-}" != "--yes" ]; then
  printf '\nDeploy this version to ailover-atlas.com? [y/N] '
  read -r answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) say "Cancelled. Nothing changed."; exit 0 ;;
  esac
fi

say "Updating source checkout..."
git pull --ff-only origin main
DEPLOY_SHA="$(git rev-parse --short=12 HEAD)"

# Generate cards/detail pages in a disposable staging copy so the checked-out
# Git repository stays clean. From now on, adding a project JSON to GitHub is
# enough for HK production: deploy regenerates index.html and every detail page.
say "Generating project catalog..."
STAGING="$(mktemp -d /tmp/atlas-deploy.XXXXXX)"
rsync -a --exclude='.git/' --exclude='node_modules/' "$SOURCE/" "$STAGING/"
(
  cd "$STAGING"
  node scripts/generate-projects.mjs
)

say "Syncing public website files..."
rsync -a --delete \
  --exclude='.git/' \
  --exclude='.github/' \
  --exclude='functions/' \
  --exclude='migrations/' \
  --exclude='scripts/' \
  --exclude='tests/' \
  --exclude='deploy/' \
  --exclude='node_modules/' \
  --exclude='README.md' \
  --exclude='COMMENTS_SETUP.md' \
  --exclude='wrangler.jsonc' \
  --exclude='_routes.json' \
  "$STAGING/" "$WEBROOT/"

# Hong Kong production uses Aliyun Captcha. Older/generated HTML may still
# contain Cloudflare Turnstile tags; strip them at deploy time.
find "$WEBROOT" -type f -name '*.html' -exec \
  sed -i '/challenges\.cloudflare\.com\/turnstile/d' {} +

# Use the deployed Git commit as a cache-busting version for the two dynamic
# entrypoints whose providers differ between HK production and the CF mirror.
if [ -f "$WEBROOT/index.html" ]; then
  sed -E -i \
    "s#submission\.js(\?v=[^\"']+)?#submission.js?v=${DEPLOY_SHA}#g" \
    "$WEBROOT/index.html"
fi

if [ -d "$WEBROOT/projects" ]; then
  find "$WEBROOT/projects" -type f -name 'index.html' -exec \
    sed -E -i \
    "s#detail-comments\.js(\?v=[^\"']+)?#detail-comments.js?v=${DEPLOY_SHA}#g" \
    {} +
fi

# Cloudflare Web Analytics is intentionally injected only into the Hong Kong
# production copy. GitHub source and the Cloudflare Pages mirror stay beacon-free.
say "Injecting production Web Analytics..."
python3 - "$WEBROOT" "$ANALYTICS_TOKEN" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])
token = sys.argv[2]
marker = "<!-- Cloudflare Web Analytics -->"
snippet = (
    f'{marker}<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" '
    f'data-cf-beacon=\'{{"token":"{token}"}}\'></script>'
    '<!-- End Cloudflare Web Analytics -->'
)

injected = 0
for path in root.rglob("*.html"):
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    if marker in text:
        continue
    if "</body>" not in text:
        continue
    path.write_text(text.replace("</body>", f"{snippet}\n</body>", 1), encoding="utf-8")
    injected += 1

print(f"[atlas-deploy] Analytics injected into {injected} HTML files.")
PY

rm -f "$WEBROOT/captcha-test.html"
printf '%s\n' "$DEPLOY_SHA" > "$WEBROOT/.deployed-commit"

say "Running production smoke checks..."
HOME_SMOKE="$STAGING/home-smoke.html"
curl -fsS "$SITE/" -o "$HOME_SMOKE"
grep -Fq "$ANALYTICS_TOKEN" "$HOME_SMOKE" || fail "Web Analytics beacon missing from production homepage"
curl -fsS "$SITE/api/config" | python3 -c \
  'import json,sys; data=json.load(sys.stdin); assert data.get("captchaProvider") == "aliyun"'
curl -fsS "$SITE/api/likes?project=time-anchor" >/dev/null

# If the EBO community submission exists in the deployed source, make sure its
# generated detail page also exists in production. Download the whole response
# before grepping so `grep -q` cannot close a pipe early and make curl report 23.
if [ -f "$SOURCE/projects/ebo-air2-mcp-guide.json" ]; then
  EBO_SMOKE="$STAGING/ebo-smoke.html"
  curl -fsS "$SITE/projects/ebo-air2-mcp-guide/" -o "$EBO_SMOKE"
  grep -Fq "EBO Air 2 MCP" "$EBO_SMOKE" || \
    fail "generated EBO Air 2 project page missing from production"
fi

say "Deployment complete: ${DEPLOY_SHA}"
printf 'Site: %s\n' "$SITE"
printf 'Project catalog: generated from GitHub JSON files.\n'
printf 'Cloudflare Web Analytics: active on HK production HTML.\n'
printf 'Dynamic API / SQLite / secrets were not modified.\n'
