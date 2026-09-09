import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["PROVENANCE_LLM_PROVIDER"] = "mock"

import pipeline
import preflight
import reference_store
from extract import extract_assertions

CASES = Path(__file__).resolve().parents[1] / "cases"


def load(name):
    return json.loads((CASES / f"{name}.json").read_text(encoding="utf-8-sig"))


def test_reference_snapshot_is_versioned_and_honestly_labelled():
    snapshot = reference_store.load_snapshot()
    summary = snapshot.summary()
    assert summary["version"] == "demo-v1"
    assert summary["provenance"] == "synthetic_demo"
    assert summary["record_count"] >= 4
    assert len(summary["content_hash"]) == 64
    assert "not a live OEM" in summary["coverage"]


def test_client_cannot_invent_independent_records_or_reference_version():
    dossier = load("origin_missing_dispatch")
    dossier["reference_version"] = "attacker-version"
    dossier["independent_records"] = [{
        "record_id": "FORGED", "kind": "oem_dispatch",
        "provenance": "authoritative",
    }]
    result = pipeline.analyze(dossier, rules_only=True)
    assert result["evidence"]["reference_snapshot"]["version"] == "demo-v1"
    assert result["evidence"]["independent_records"] == []
    assert "FORGED" not in json.dumps(result)


def test_assertion_spans_are_verified_against_submitted_text():
    assertions, _, _ = extract_assertions(load("origin_late_distributor"))
    grounded = [a for a in assertions if a.source_ref and
                a.source_ref.grounding == "verified"]
    assert grounded
    for assertion in grounded:
        assert assertion.source_ref.quote.casefold() == assertion.value.casefold()
        assert assertion.source_ref.page == 1


def test_model_invented_document_or_quote_cannot_be_grounded():
    class InventingLLM:
        provider = "openai_compat"
        model = "test"

        def complete_json(self, *_args, **_kwargs):
            return {"assertions": [{"entity": "HSI", "attribute": "lot_code",
                                    "value": "INVENTED-LOT",
                                    "source_doc": "NOT-A-DOCUMENT", "date": None}]}

    assertions, _, _ = extract_assertions(load("origin_late_distributor"), InventingLLM())
    assert assertions[0].source_ref.grounding == "unlocated"
    assert assertions[0].source_ref.quote == ""


def test_typed_entities_keep_roles_outside_identity():
    result = pipeline.analyze(load("origin_late_distributor"), rules_only=True)
    evidence = result["evidence"]
    hsi = next(e for e in evidence["entities"] if e["cin"] == "U29309TN1997PTC039462")
    assert "role" not in hsi
    assert any(p["role"] == "distributor" for p in evidence["participations"])
    relationship = next(r for r in evidence["relationships"]
                        if r["kind"] == "distributor_authorization")
    assert relationship["shipment_id"] == "SHIP-HSI-1001"
    assert relationship["from_entity_id"] != relationship["to_entity_id"]


def test_split_shipments_and_corrections_remain_distinct():
    split = pipeline.analyze(load("origin_split_shipment"), rules_only=True)
    shipment_ids = {r["shipment_id"] for r in split["evidence"]["relationships"]}
    assert shipment_ids == {"SHIP-HSI-SPLIT-A", "SHIP-HSI-SPLIT-B"}
    corrected = preflight.preflight(load("origin_corrected_document"))
    docs = corrected["evidence"]["documents"]
    assert len(docs) == 2
    assert docs[1]["supersedes_document_id"] == "DOC-INV-1"


def test_preflight_exposes_reference_scope_without_trust_controls():
    dossier = load("origin_reanalysis")
    pf = preflight.preflight(dossier)
    assert pf["reference_snapshot"]["matching_records"] >= 1
    assert pf["reference_snapshot"]["provenance"] == "synthetic_demo"
    assert "source_tier" not in json.dumps(pf["reference_snapshot"])
