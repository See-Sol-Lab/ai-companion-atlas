# Hong Kong production deploy

Production site: `https://www.ailover-atlas.com`

The GitHub `main` branch is the source of truth. The Hong Kong VPS keeps a read-only checkout at `/srv/atlas-source` and serves static files from `/var/www/atlas`.

## Normal release flow

1. Make and verify changes locally, or add/update a project JSON in GitHub.
2. Commit and push changes to GitHub `main`.
3. From Windows PowerShell run:

   ```powershell
   ssh -t atlas atlas-deploy
   ```

4. Review the pending commit list and answer `y` to deploy.

`atlas-deploy` pulls `main`, creates a disposable staging copy, runs `node scripts/generate-projects.mjs` there, and publishes the generated homepage cards and detail pages. The real Git checkout stays clean.

For HK production it also removes generated/hardcoded Cloudflare Turnstile tags, applies commit-based cache busting to comment/submission entrypoints, injects Cloudflare Web Analytics only into the HK public copy, and runs production smoke checks.

Because generation happens during deploy, adding one valid `projects/<slug>.json` file to GitHub is enough to create the corresponding homepage card and detail page on the HK site.

## Server prerequisite

The deploy command requires Node.js because the project generator is an `.mjs` script. Verify with:

```bash
node --version
```

On Debian 12, install it once if needed:

```bash
sudo apt update
sudo apt install -y nodejs
```

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
