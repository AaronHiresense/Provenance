"""Fetch mca.duckdb on first boot of a hosted deployment.

No-op when the DB already exists at PROVENANCE_DB (or the project root).
Otherwise downloads it from MCA_DB_URL — typically a GitHub release asset
(releases accept files up to 2GB; upload the local mca.duckdb once with:
  gh release create data-v1 mca.duckdb --title "MCA registry snapshot"
and use the asset's download URL).
"""
from __future__ import annotations

import os
import sys
import urllib.request
from pathlib import Path


def main() -> int:
    target = Path(os.environ.get("PROVENANCE_DB")
                  or Path(__file__).resolve().parents[1] / "mca.duckdb")
    if target.exists() and target.stat().st_size > 100_000_000:
        print(f"[fetch_db] {target} present "
              f"({target.stat().st_size / 1e6:,.0f} MB) — nothing to do")
        return 0
    url = os.environ.get("MCA_DB_URL")
    if not url:
        print("[fetch_db] no DB found and MCA_DB_URL is not set — the app "
              "will fail on the first registry lookup. Set MCA_DB_URL or "
              "mount a volume with mca.duckdb.")
        return 0  # let the app start; mock/demo endpoints still respond
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".part")
    print(f"[fetch_db] downloading {url} -> {target} …")

    def hook(blocks, bs, total):
        done = blocks * bs
        if total > 0 and blocks % 2000 == 0:
            print(f"[fetch_db]   {done / 1e6:,.0f} / {total / 1e6:,.0f} MB",
                  flush=True)

    urllib.request.urlretrieve(url, tmp, reporthook=hook)
    tmp.replace(target)
    print(f"[fetch_db] done ({target.stat().st_size / 1e6:,.0f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
