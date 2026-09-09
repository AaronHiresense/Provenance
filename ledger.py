"""Stage 3 — the evidence ledger.

Every deterministic check and every LLM observation lands here as a Finding.
The ledger is the single source of truth that reason.py and verdict.py read;
nothing downstream is allowed to look at raw documents again.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional

from evidence import SourceRef, stable_id

# -- controlled vocabularies -------------------------------------------------

DIRECTIONS = ("supports_genuine", "supports_suspect", "neutral")
STRENGTHS = ("weak", "moderate", "strong", "dispositive")
SOURCE_TIERS = ("authoritative", "derived", "self_reported", "heuristic")
DIMENSIONS = ("identity", "certification", "provenance", "custody")

# Tier precedence, highest first. reason.py/verdict.py must resolve conflicts
# by tier, never by averaging across tiers.
TIER_RANK = {"authoritative": 3, "derived": 2, "self_reported": 1, "heuristic": 0}
STRENGTH_RANK = {"dispositive": 3, "strong": 2, "moderate": 1, "weak": 0}


@dataclass
class Assertion:
    """A typed claim extracted from one document (stage 1 output)."""
    entity: str
    attribute: str
    value: str
    source_doc: str
    date: Optional[str] = None
    assertion_id: str = ""
    entity_id: Optional[str] = None
    shipment_id: Optional[str] = None
    source_ref: Optional[SourceRef] = None

    def __post_init__(self) -> None:
        if not self.assertion_id:
            self.assertion_id = stable_id(
                "ast", self.source_doc, self.entity, self.attribute, self.value)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Finding:
    """One row of the evidence ledger."""
    assertion: str          # human-readable restatement of what was checked
    check: str              # validator name, e.g. "gstin_checksum"
    result: str             # pass | fail | abstain | unavailable + short detail
    direction: str          # supports_genuine | supports_suspect | neutral
    strength: str           # weak | moderate | strong | dispositive
    source_tier: str        # authoritative | derived | self_reported | heuristic
    dimension: str          # identity | certification | provenance | custody
    detail: str = ""        # free-text explanation for the UI / reasoning stage
    source_doc: str = ""    # the document whose assertion this check consumed
    finding_id: str = ""
    entity_ids: list[str] = field(default_factory=list)
    shipment_ids: list[str] = field(default_factory=list)
    source_refs: list[SourceRef] = field(default_factory=list)
    status: str = ""
    reference_version: Optional[str] = None
    reason_code: str = ""

    def __post_init__(self) -> None:
        if self.direction not in DIRECTIONS:
            raise ValueError(f"bad direction: {self.direction}")
        if self.strength not in STRENGTHS:
            raise ValueError(f"bad strength: {self.strength}")
        if self.source_tier not in SOURCE_TIERS:
            raise ValueError(f"bad source_tier: {self.source_tier}")
        if self.dimension not in DIMENSIONS:
            raise ValueError(f"bad dimension: {self.dimension}")
        if not self.status:
            token = str(self.result).split(" ", 1)[0].lower()
            self.status = token if token in ("pass", "fail", "abstain", "unavailable") else "abstain"
        if not self.finding_id:
            self.finding_id = stable_id(
                "fnd", self.check, ",".join(self.entity_ids),
                ",".join(self.shipment_ids), self.assertion)
        if not self.reason_code:
            self.reason_code = f"{self.check}.{self.status}"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Ledger:
    findings: list = field(default_factory=list)

    def add(self, finding: Finding) -> None:
        self.findings.append(finding)

    def extend(self, findings) -> None:
        for f in findings:
            self.add(f)

    def by_direction(self, direction: str) -> list:
        return [f for f in self.findings if f.direction == direction]

    def by_dimension(self, dimension: str) -> list:
        return [f for f in self.findings if f.dimension == dimension]

    def highest_tier_with_signal(self) -> Optional[str]:
        """The most authoritative tier that produced a non-neutral finding."""
        best = None
        for f in self.findings:
            if f.direction == "neutral":
                continue
            if best is None or TIER_RANK[f.source_tier] > TIER_RANK[best]:
                best = f.source_tier
        return best

    def to_dict(self) -> dict:
        return {"findings": [f.to_dict() for f in self.findings]}
