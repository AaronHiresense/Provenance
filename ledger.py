"""Stage 3 — the evidence ledger.

Every deterministic check and every LLM observation lands here as a Finding.
The ledger is the single source of truth that reason.py and verdict.py read;
nothing downstream is allowed to look at raw documents again.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional

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

    def __post_init__(self) -> None:
        if self.direction not in DIRECTIONS:
            raise ValueError(f"bad direction: {self.direction}")
        if self.strength not in STRENGTHS:
            raise ValueError(f"bad strength: {self.strength}")
        if self.source_tier not in SOURCE_TIERS:
            raise ValueError(f"bad source_tier: {self.source_tier}")
        if self.dimension not in DIMENSIONS:
            raise ValueError(f"bad dimension: {self.dimension}")

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
