#!/usr/bin/env bash
set -euo pipefail

CADDYFILE="/etc/caddy/Caddyfile"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MARKER="atlas-downloads.json"
backup=""

if [ "$(id -u)" -ne 0 ]; then
  printf 'Run this installer from the DogYun root console.\n' >&2
  exit 1
fi

install -d -o caddy -g caddy -m 0755 /var/log/caddy
install -m 0755 "$SCRIPT_DIR/atlas-download-stats.py" /usr/local/bin/atlas-download-stats

if ! grep -Fq "$MARKER" "$CADDYFILE"; then
  backup="${CADDYFILE}.before-download-stats.$(date +%Y%m%d-%H%M%S)"
  cp -a "$CADDYFILE" "$backup"

  python3 - "$CADDYFILE" <<'PY'
from pathlib import Path
import os
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
opening = "ailover-atlas.com, www.ailover-atlas.com {\n"
if text.count(opening) != 1:
    raise SystemExit("Expected one Atlas site block; Caddyfile was not changed.")

logging = """ailover-atlas.com, www.ailover-atlas.com {
    @notGuiInstaller not path /deepseekgui/releases/*/DeepSeekGUI-Setup-*.exe
    skip_log @notGuiInstaller

    log {
        output file /var/log/caddy/atlas-downloads.json {
            mode 0644
            roll_size 10MiB
            roll_keep 10
            roll_keep_for 720h
        }
        format filter {
            request>remote_ip delete
            request>client_ip delete
            request>remote_port delete
            request>host delete
            request>proto delete
            request>headers delete
            request>tls delete
            bytes_read delete
            user_id delete
            duration delete
            resp_headers delete
            wrap json
        }
    }
"""
replacement = text.replace(opening, logging, 1)
temporary = path.with_name(f".{path.name}.download-stats.tmp")
metadata = path.stat()
temporary.write_text(replacement, encoding="utf-8")
os.chmod(temporary, metadata.st_mode)
os.chown(temporary, metadata.st_uid, metadata.st_gid)
os.replace(temporary, path)
PY

  if ! caddy validate --config "$CADDYFILE" --adapter caddyfile; then
    cp -a "$backup" "$CADDYFILE"
    printf 'Caddy validation failed; restored %s\n' "$backup" >&2
    exit 1
  fi
fi

if ! systemctl reload caddy; then
  if [ -n "$backup" ]; then
    cp -a "$backup" "$CADDYFILE"
    systemctl reload caddy
  fi
  printf 'Caddy reload failed; the previous configuration was restored.\n' >&2
  exit 1
fi
systemctl is-active --quiet caddy
printf 'Download logging is active. Run: atlas-download-stats\n'
