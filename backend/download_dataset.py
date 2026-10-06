"""Fetch the documented 2024 XKDR India Air Quality Database Parquet files.

Set AEROSENSE_DATA_API_KEY to a key obtained from XKDR. The public demo key is
documented by XKDR and can read the 2024 files, but has a 10,000-row query cap.
Raw data are kept outside version control under backend/data/raw/xkdr/2024/.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import requests

BASE = "https://airquality.xkdr.org/v1"
ROOT = Path(__file__).resolve().parent
DEST = ROOT / "data" / "raw" / "xkdr" / "2024"


def main() -> None:
    key = os.environ.get("AEROSENSE_DATA_API_KEY", "").strip()
    if not key:
        raise SystemExit("Set AEROSENSE_DATA_API_KEY to an XKDR API key first.")
    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {key}", "User-Agent": "AeroSense-ML-training/1.0"})
    DEST.mkdir(parents=True, exist_ok=True)
    meta = session.get(f"{BASE}/meta", timeout=30)
    meta.raise_for_status()
    api_meta = meta.json()
    files_response = session.get(f"{BASE}/files", timeout=30)
    files_response.raise_for_status()
    files = [item for item in files_response.json()["files"] if item.get("year") == 2024 and item.get("kind") == "measurements"]
    if len(files) != 12:
        raise RuntimeError(f"Expected 12 monthly 2024 files, found {len(files)}")
    stations_key = "v1/stations.parquet"
    downloads = files + [{"key": stations_key, "month": 0, "bytes": None}]
    for item in downloads:
        relative = item["key"].split("/", 2)[-1]
        target = DEST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and target.stat().st_size > 0:
            continue
        response = session.get(f"{BASE}/files/{item['key']}", timeout=120)
        response.raise_for_status()
        if not response.content.startswith(b"PAR1"):
            raise RuntimeError(f"Unexpected non-Parquet response for {item['key']}")
        target.write_bytes(response.content)
        print(f"Fetched {item['key']} ({len(response.content):,} bytes)")
    manifest = {
        "dataset": "India Air Quality Database",
        "publisher": "XKDR Forum",
        "sources": ["Central Pollution Control Board CAAQM network", "US Department of State monitors via AirNow"],
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "api_url": "https://airquality.xkdr.org",
        "api_exported_at": api_meta.get("exported_at"),
        "training_period": "2024-01-01 through 2024-12-31 (IST)",
        "geographic_coverage": "India-wide; CPCB CAAQM stations. City coverage is enumerated in model metadata after filtering.",
        "target": "hourly city-median PM2.5 concentration, µg/m³",
        "raw_files": [item["key"] for item in files],
        "raw_data_committed": False,
    }
    (DEST / "source_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
