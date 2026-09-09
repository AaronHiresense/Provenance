"""Read-only, server-selected independent reference snapshots."""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path

from evidence import IndependentRecord

BASE = Path(__file__).resolve().parent
DEFAULT_VERSION = "demo-v1"


@dataclass(frozen=True)
class ReferenceSnapshot:
    version: str
    provenance: str
    coverage: str
    as_of: str
    records: tuple[IndependentRecord, ...]
    content_hash: str

    def summary(self) -> dict:
        return {
            "version": self.version,
            "provenance": self.provenance,
            "coverage": self.coverage,
            "as_of": self.as_of,
            "record_count": len(self.records),
            "content_hash": self.content_hash,
        }


def configured_version() -> str:
    # The request body is deliberately not consulted.
    return os.environ.get("PROVENANCE_REFERENCE_VERSION", DEFAULT_VERSION)


def load_snapshot(version: str | None = None) -> ReferenceSnapshot:
    selected = version or configured_version()
    if not selected.replace("-", "").isalnum():
        raise ValueError("invalid configured reference version")
    path = BASE / "references" / selected / "snapshot.json"
    raw = path.read_bytes()
    payload = json.loads(raw.decode("utf-8-sig"))
    records = tuple(IndependentRecord(**r) for r in payload.get("records", []))
    return ReferenceSnapshot(
        version=payload["version"], provenance=payload["provenance"],
        coverage=payload["coverage"], as_of=payload["as_of"], records=records,
        content_hash=hashlib.sha256(raw).hexdigest(),
    )


def public_evidence(snapshot: ReferenceSnapshot, dossier: dict) -> list[dict]:
    """Return bounded records linked by exact IDs appearing in the dossier."""
    text = "\n".join(str(d.get("text") or "")
                     for d in dossier.get("documents", []))
    shipments = set(_label_values(text, "shipment_id"))
    lots = set(_label_values(text, "lot"))
    parts = set(_label_values(text, "part"))
    out = []
    for record in snapshot.records:
        # A supplied shipment reference is the strongest link. If present but
        # absent from this partial pack, do not broaden the query until a
        # common part number happens to match an unrelated record.
        if shipments:
            matched = record.shipment_id in shipments
        else:
            matched = bool(record.lot in lots and record.part in parts)
        if matched:
            out.append(record.to_dict())
    return out


def _label_values(text: str, key: str) -> list[str]:
    labels = {
        "shipment_id": r"(?:shipment|dispatch)(?: id| ref(?:erence)?)?",
        "lot": r"(?:lot|batch)(?: code| no)?",
        "part": r"part(?: number| no)?",
    }
    import re
    return [m.group(1).strip() for m in re.finditer(
        rf"(?im)^\s*{labels[key]}\s*[:=]\s*([^\r\n]+)", text)]
