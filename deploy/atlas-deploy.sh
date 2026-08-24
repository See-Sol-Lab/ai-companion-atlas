#!/usr/bin/env bash
set -euo pipefail

SOURCE="/srv/atlas-source"
WEBROOT="/var/www/atlas"
SITE="https://ailover-atlas.com"

say() { printf '\n[atlas-deploy] %s\n' "$*"; }
fail() { printf '\n[atlas-deploy] ERROR: %s\n' "$*" >&2; exit 1; }

for command in git rsync sed find curl python3; do
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
  "$SOURCE/" "$WEBROOT/"

# Hong Kong production uses Aliyun Captcha. Older generated HTML may still
# contain Cloudflare Turnstile tags; strip them at deploy time. This is safe
# to keep after the generator is fully neutral because it then becomes a no-op.
find "$WEBROOT" -type f -name '*.html' -exec \
  sed -i '/challenges\.cloudflare\.com\/turnstile/d' {} +

# Use the deployed Git commit as a cache-busting version for the two dynamic
# entrypoints whose providers differ between the HK production site and the
# Cloudflare mirror.
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

rm -f "$WEBROOT/captcha-test.html"
printf '%s\n' "$DEPLOY_SHA" > "$WEBROOT/.deployed-commit"

say "Running production smoke checks..."
curl -fsS "$SITE/" >/dev/null
curl -fsS "$SITE/api/config" | python3 -c \
  'import json,sys; data=json.load(sys.stdin); assert data.get("captchaProvider") == "aliyun"'
curl -fsS "$SITE/api/likes?project=time-anchor" >/dev/null

say "Deployment complete: ${DEPLOY_SHA}"
printf 'Site: %s\n' "$SITE"
printf 'Dynamic API / SQLite / secrets were not modified.\n'
