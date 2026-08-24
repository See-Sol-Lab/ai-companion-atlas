# Hong Kong production deploy

Production site: `https://ailover-atlas.com`

The GitHub `main` branch is the source of truth. The Hong Kong VPS keeps a read-only checkout at `/srv/atlas-source` and serves static files from `/var/www/atlas`.

## Normal release flow

1. Make and verify changes locally.
2. Commit and push them to GitHub `main`.
3. SSH to the Hong Kong VPS.
4. Run:

   ```bash
   atlas-deploy
   ```

5. Review the pending commit list and answer `y` to deploy.

`atlas-deploy` pulls `main`, syncs public static files, removes deployment-inappropriate hardcoded Cloudflare Turnstile tags for the HK build, applies commit-based cache busting to comment/submission entrypoints, and runs production smoke checks.

## What deploy does NOT touch

The command intentionally leaves all dynamic production state alone:

- `/opt/ai-lover-atlas-api` — Python API runtime
- `/var/lib/ai-lover-atlas/atlas.db` — SQLite comments / likes / submissions
- `/etc/ai-lover-atlas-api.env` — production secrets
- Caddy / SSH / firewall configuration

Cloudflare Pages remains a separate mirror and can continue using Turnstile. The HK production site reads `/api/config` and uses Aliyun Captcha.

## Server paths

- Read-only Git checkout: `/srv/atlas-source`
- Public web root: `/var/www/atlas`
- Deploy command: `/usr/local/bin/atlas-deploy`
- API service: `atlas-api.service`
