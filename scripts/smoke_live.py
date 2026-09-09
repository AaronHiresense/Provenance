"""Bounded, non-mutating smoke checks for a deployed PROVENANCE service."""
from __future__ import annotations

import argparse
import json
import urllib.request


def get(base: str, path: str):
    with urllib.request.urlopen(base.rstrip("/") + path, timeout=30) as response:
        return response.status, json.load(response)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("base_url")
    parser.add_argument("--commit")
    args = parser.parse_args()
    for path in ("/api/health", "/api/ready", "/api/runtime", "/api/cases"):
        status, body = get(args.base_url, path)
        if status != 200:
            raise RuntimeError(f"{path}: HTTP {status}")
        print(f"{path}: ok")
        if path == "/api/ready" and body.get("status") != "ready":
            raise RuntimeError(f"readiness payload: {body}")
        if path == "/api/runtime" and args.commit and body.get("source_commit") != args.commit:
            raise RuntimeError(
                f"runtime commit {body.get('source_commit')} != {args.commit}")
        if path == "/api/cases" and not body:
            raise RuntimeError("no prepared cases returned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
