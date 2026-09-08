#!/usr/bin/env python3
"""Summarize privacy-filtered DeepSeekGUI installer access logs."""

from __future__ import annotations

import gzip
import json
import os
from collections import Counter, defaultdict
from datetime import datetime
from glob import glob
from pathlib import Path
from sys import argv
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo


DEFAULT_LOG_GLOB = "/var/log/caddy/atlas-downloads*"
DEFAULT_WEBROOT = "/var/www/atlas"
INSTALLER_PREFIX = "/deepseekgui/releases/"
INSTALLER_NAME_PREFIX = "DeepSeekGUI-Setup-"
LOCAL_TIMEZONE = ZoneInfo("Asia/Shanghai")


def open_log(path: str):
    """Open a plain or gzip-compressed Caddy JSON log as text."""
    if path.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return open(path, "r", encoding="utf-8", errors="replace")


def human_bytes(value: int) -> str:
    """Format a byte count for a compact terminal report."""
    units = ("B", "KiB", "MiB", "GiB", "TiB")
    amount = float(value)
    for unit in units:
        if amount < 1024 or unit == units[-1]:
            return f"{amount:.2f} {unit}"
        amount /= 1024
    raise AssertionError("unreachable")


def installer_size(webroot: str, uri_path: str) -> int:
    """Return the deployed installer size for an access-log URI."""
    file_path = Path(webroot, uri_path.lstrip("/"))
    try:
        return file_path.stat().st_size
    except FileNotFoundError:
        return 0


def main() -> None:
    """Read Caddy logs and print aggregate installer transfer statistics."""
    log_glob = argv[1] if len(argv) > 1 else DEFAULT_LOG_GLOB
    webroot = argv[2] if len(argv) > 2 else DEFAULT_WEBROOT
    paths = sorted(path for path in glob(log_glob) if os.path.isfile(path))
    requests = 0
    transferred = 0
    equivalents = 0.0
    by_day: dict[str, list[float]] = defaultdict(lambda: [0, 0, 0.0])
    by_version: dict[str, list[float]] = defaultdict(lambda: [0, 0, 0.0])
    statuses: Counter[int] = Counter()
    first_timestamp: datetime | None = None
    last_timestamp: datetime | None = None

    for path in paths:
        with open_log(path) as log:
            for line in log:
                try:
                    entry = json.loads(line)
                    request = entry.get("request", {})
                    uri_path = urlsplit(request.get("uri", "")).path
                    parts = uri_path.strip("/").split("/")
                    if (
                        request.get("method") != "GET"
                        or not uri_path.startswith(INSTALLER_PREFIX)
                        or len(parts) != 4
                        or parts[:2] != ["deepseekgui", "releases"]
                        or not parts[3].startswith(INSTALLER_NAME_PREFIX)
                        or not parts[3].endswith(".exe")
                    ):
                        continue
                    status = int(entry.get("status", 0))
                    if status not in (200, 206):
                        continue
                    size = int(entry.get("size", 0))
                    timestamp = datetime.fromtimestamp(float(entry["ts"]), LOCAL_TIMEZONE)
                except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                    continue

                version = parts[2]
                full_size = installer_size(webroot, uri_path)
                equivalent = size / full_size if full_size else 0.0
                day = timestamp.date().isoformat()

                requests += 1
                transferred += size
                equivalents += equivalent
                statuses[status] += 1
                by_day[day][0] += 1
                by_day[day][1] += size
                by_day[day][2] += equivalent
                by_version[version][0] += 1
                by_version[version][1] += size
                by_version[version][2] += equivalent
                first_timestamp = min(first_timestamp, timestamp) if first_timestamp else timestamp
                last_timestamp = max(last_timestamp, timestamp) if last_timestamp else timestamp

    print("AI Lover Atlas · DeepSeekGUI 下载统计")
    if not paths:
        print("尚未生成下载日志。统计会从首次安装包请求开始。")
        return
    if requests == 0:
        print("日志已经启用，目前还没有成功的安装包下载请求。")
        return

    print(f"统计范围：{first_timestamp:%Y-%m-%d %H:%M:%S} — {last_timestamp:%Y-%m-%d %H:%M:%S}（北京时间）")
    print(f"下载请求：{requests}（200: {statuses[200]}，206: {statuses[206]}）")
    print(f"实际传输：{human_bytes(transferred)}")
    print(f"折算完整安装包：{equivalents:.2f} 次")

    print("\n按版本：")
    for version, (count, size, equivalent) in sorted(by_version.items()):
        print(f"  {version}: {int(count)} 个请求，{human_bytes(int(size))}，折算 {equivalent:.2f} 次")

    print("\n按日：")
    for day, (count, size, equivalent) in sorted(by_day.items()):
        print(f"  {day}: {int(count)} 个请求，{human_bytes(int(size))}，折算 {equivalent:.2f} 次")


if __name__ == "__main__":
    main()
