"""Typed, additive evidence structures shared by extraction and reference data.

These structures describe provenance; they do not decide authenticity.  Trusted
reference records are created only by :mod:`reference_store`, never from a
submitted dossier.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass, field
from typing import Optional


GROUNDING_STATES = ("verified", "unlocated", "user_confirmed")
ROLES = ("manufacturer", "distributor", "carrier", "recipient")
RECORD_KINDS = (
    "oem_dispatch", "distributor_authorization", "carrier_receipt",
    "goods_receipt",
)


def stable_id(prefix: str, *parts: object) -> str:
    raw = "\x1f".join(str(p or "").strip() for p in parts)
    return f"{prefix}-{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]}"


@dataclass(frozen=True)
class SourceRef:
    record_id: str
    page: Optional[int] = None
    start: Optional[int] = None
    end: Optional[int] = None
    quote: str = ""
    grounding: str = "unlocated"

    def __post_init__(self) -> None:
        if self.grounding not in GROUNDING_STATES:
            raise ValueError(f"bad grounding: {self.grounding}")

    def to_dict(self) -> dict:
        return asdict(self)


def locate_source_ref(record_id: str, text: str, value: str) -> SourceRef:
    """Locate an exact submitted value without trusting model-made offsets."""
    match = re.search(re.escape(str(value)), text, flags=re.IGNORECASE)
    if not match:
        return SourceRef(record_id=record_id)
    return SourceRef(record_id=record_id, page=1, start=match.start(),
                     end=match.end(), quote=text[match.start():match.end()],
                     grounding="verified")


@dataclass(frozen=True)
class Entity:
    entity_id: str
    display_name: str
    cin: Optional[str] = None
    gstin: Optional[str] = None
    resolved: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class Relationship:
    relationship_id: str
    kind: str
    shipment_id: Optional[str] = None
    from_entity_id: Optional[str] = None
    to_entity_id: Optional[str] = None
    lot: Optional[str] = None
    part: Optional[str] = None
    quantity: Optional[str] = None
    unit: Optional[str] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None
    source_refs: list[SourceRef] = field(default_factory=list)

    def to_dict(self) -> dict:
        value = asdict(self)
        value["source_refs"] = [r.to_dict() for r in self.source_refs]
        return value


@dataclass(frozen=True)
class IndependentRecord:
    record_id: str
    kind: str
    issuer_entity: str
    recorded_at: Optional[str] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None
    shipment_id: Optional[str] = None
    lot: Optional[str] = None
    part: Optional[str] = None
    from_party: Optional[str] = None
    to_party: Optional[str] = None
    quantity: Optional[str] = None
    unit: Optional[str] = None
    territory: Optional[str] = None
    related_record_ids: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.kind not in RECORD_KINDS:
            raise ValueError(f"bad record kind: {self.kind}")

    def to_dict(self) -> dict:
        return asdict(self)


def document_descriptor(doc: dict) -> dict:
    text = str(doc.get("text") or "")
    document_id = str(doc.get("doc_id") or stable_id("doc", text))
    return {
        "document_id": document_id,
        "content_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "media_type": str(doc.get("media_type") or "text/plain"),
        "original_filename": doc.get("original_filename"),
        "source_kind": "submitted",
        "received_at": doc.get("received_at"),
        "supersedes_document_id": doc.get("supersedes_document_id"),
    }
