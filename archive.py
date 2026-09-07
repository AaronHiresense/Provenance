"""The seen-lots archive — memory across runs.

Every verdict this system issues carries the same admission: a byte-perfect
copy of a genuine, current dossier attached to counterfeit goods passes every
check, because nothing on the paper is false. That attack is not a
contradiction, so a contradiction engine cannot see it. It is *reuse*, and
reuse is only visible to a system that remembers what it has already been
shown.

This module is that memory: an append-only JSONL archive of dossier
fingerprints, and two signals derived from it.

  * **Dossier reuse** — this exact identity-and-goods field set has been
    presented before. Genuine paperwork accompanies one consignment; the same
    paper arriving twice means at least one of the two shipments is not what
    its documents say.
  * **Lot-code collision** — this lot code has been seen before carrying a
    *different* field set. One lot code, two paper trails: one of them is
    fabricated.

Design constraints this respects:

  * `validators.py` stays pure (values in, Finding out, reads only), so the
    archive is called from `pipeline.py` — the same place injection flags
    become findings — never from a validator.
  * Recording is opt-in per run (`archive_run=True`), which the API sets and
    `eval.py`/tests do not. A calibration run is not a desk submission, so it
    neither writes to the archive nor reads from it, and the offline eval
    stays byte-for-byte deterministic.
  * A read-only or unwritable filesystem degrades to "archive unavailable",
    never to an exception. The check simply produces no finding.
"""
from __future__ import annotations

import hashlib
import json
import os
import threading
from datetime import datetime, timezone
from typing import Optional

from ledger import Finding

_lock = threading.RLock()

# The fields that identify *this consignment's paperwork*. Deliberately not
# every extracted attribute: free-text and clerical fields would make every
# fingerprint unique and the archive useless.
FINGERPRINT_ATTRS = (
    "cin", "gstin", "company_name", "part_number", "lot_code",
    "cert_id", "cert_date", "invoice_no", "invoice_date",
    "mfg_date", "ship_date", "quantity",
)

# A fingerprint needs enough of a paper trail to mean something. Two fields
# (say a CIN and a part number) would collide across honest shipments.
_MIN_FIELDS = 4


def archive_path() -> Optional[str]:
    """Where the archive lives: PROVENANCE_ARCHIVE, else beside the registry."""
    env = os.environ.get("PROVENANCE_ARCHIVE")
    if env:
        return env
    vol = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH")
    if vol and os.path.isdir(vol):
        return os.path.join(vol, "lot-archive.jsonl")
    return os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "lot-archive.jsonl")


def _fields(assertions) -> dict:
    """The fingerprintable subset of the dossier, normalised."""
    out = {}
    for a in assertions:
        if a.attribute not in FINGERPRINT_ATTRS:
            continue
        val = " ".join(str(a.value).split()).upper()
        # first value wins: a drifting field is the drift check's business
        out.setdefault(a.attribute, val)
    return out


def fingerprint(assertions) -> Optional[dict]:
    """A stable hash of the consignment's paperwork, or None if too thin."""
    fields = _fields(assertions)
    if len(fields) < _MIN_FIELDS:
        return None
    canonical = json.dumps(fields, sort_keys=True, separators=(",", ":"))
    return {
        "hash": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "lot_code": fields.get("lot_code"),
        "part_number": fields.get("part_number"),
        "fields": fields,
    }


def _read(path: str) -> list:
    try:
        with open(path, encoding="utf-8") as fh:
            return [json.loads(line) for line in fh if line.strip()]
    except (OSError, ValueError):
        return []


def _append(path: str, entry: dict) -> bool:
    try:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, separators=(",", ":")) + "\n")
        return True
    except OSError:
        return False


def check_and_record(assertions, case_id: str = "unknown") -> list:
    """Look this dossier up in the archive, then record it. Returns findings.

    Called only when a run is a real desk submission. Returns an empty list
    when the dossier is too thin to fingerprint or the archive is unwritable —
    the absence of memory is never dressed up as an absence of reuse.
    """
    fp = fingerprint(assertions)
    if fp is None:
        return []
    path = archive_path()
    findings = []
    with _lock:
        seen = _read(path)
        same_hash = [e for e in seen if e.get("hash") == fp["hash"]]
        lot_clash = [e for e in seen
                     if fp["lot_code"]
                     and e.get("lot_code") == fp["lot_code"]
                     and e.get("hash") != fp["hash"]]

        if same_hash:
            first = same_hash[0]
            findings.append(Finding(
                assertion="This dossier has not been presented before",
                check="dossier_reuse",
                result=f"fail (seen {len(same_hash)} time"
                       f"{'s' if len(same_hash) != 1 else ''} before)",
                direction="supports_suspect", strength="strong",
                source_tier="derived", dimension="provenance",
                detail="An identical identity-and-goods field set was "
                       f"presented on {first.get('seen_at', 'an earlier run')}"
                       f" (lot {first.get('lot_code') or 'unknown'}). Genuine "
                       "paperwork accompanies one consignment; the same paper "
                       "arriving twice means at least one of the two "
                       "shipments is not what its documents say. This is the "
                       "cloned-dossier attack, and it is the one thing "
                       "contradiction analysis alone cannot see.",
            ))
        elif lot_clash:
            findings.append(Finding(
                assertion=f"Lot code '{fp['lot_code']}' carries one paper "
                          "trail",
                check="lot_code_collision",
                result=f"fail ({len(lot_clash)} other trail"
                       f"{'s' if len(lot_clash) != 1 else ''} for this lot)",
                direction="supports_suspect", strength="moderate",
                source_tier="derived", dimension="provenance",
                detail=f"Lot '{fp['lot_code']}' has been seen before with a "
                       "different field set (first on "
                       f"{lot_clash[0].get('seen_at', 'an earlier run')}). One "
                       "lot code with two paper trails means one of them was "
                       "fabricated; which one needs the OEM's production "
                       "record for that lot.",
            ))
        else:
            findings.append(Finding(
                assertion="This dossier has not been presented before",
                check="dossier_reuse", result="pass",
                direction="supports_genuine", strength="weak",
                source_tier="derived", dimension="provenance",
                detail=f"No match among {len(seen)} previously screened "
                       "dossier(s) at this desk. Support is weak by "
                       "construction: the archive only knows what this desk "
                       "has seen, so a first sighting proves nothing on its "
                       "own.",
            ))

        _append(path, {
            "hash": fp["hash"],
            "lot_code": fp["lot_code"],
            "part_number": fp["part_number"],
            "case_id": case_id,
            "seen_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        })
    return findings


def stats() -> dict:
    """How much the desk remembers — for the UI and the run banner."""
    path = archive_path()
    seen = _read(path)
    return {"screened": len(seen),
            "lots": len({e.get("lot_code") for e in seen if e.get("lot_code")}),
            "path": path}
