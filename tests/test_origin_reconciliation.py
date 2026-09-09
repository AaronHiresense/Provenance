import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["PROVENANCE_LLM_PROVIDER"] = "mock"

import pipeline
import reference_store
import validators
from ledger import Assertion, Ledger
from verdict import decide

CASES = Path(__file__).resolve().parents[1] / "cases"


def run(name, rules_only=True):
    dossier = json.loads((CASES / f"{name}.json").read_text(encoding="utf-8-sig"))
    return pipeline.analyze(dossier, rules_only=rules_only)


def checks(result):
    return {f["check"]: f for f in result["ledger"]["findings"]}


def test_linked_clean_chain_is_eligible_with_exact_sources():
    result = run("origin_late_distributor")
    assert result["verdict"] == "GENUINE"
    assert result["genuine_eligibility"]["eligible"] is True
    rows = checks(result)
    assert rows["lot_matches_dispatch"]["status"] == "pass"
    assert rows["custody_sequence_reconciles"]["status"] == "pass"
    assert rows["distributor_authorization_valid"]["status"] == "pass"
    assert {r["record_id"] for r in rows["lot_matches_dispatch"]["source_refs"]} >= {
        "DOC-INV", "OEM-DSP-1001"}


def test_same_shipment_wrong_lot_is_specific_strong_contradiction():
    result = run("origin_substitution")
    row = checks(result)["lot_matches_dispatch"]
    assert result["verdict"] == "SUSPECT"
    assert row["status"] == "fail" and row["strength"] == "strong"
    assert "SPB-240421-00999" in row["detail"]
    assert "SPB-240420-00412" in row["detail"]
    assert {r["record_id"] for r in row["source_refs"]} >= {
        "DOC-GRN", "OEM-DSP-1001"}


def test_partial_snapshot_absence_is_gap_and_specific_work_order():
    result = run("origin_missing_dispatch")
    assert result["verdict"] == "UNVERIFIABLE"
    assert result["subtype"] == "insufficient"
    assert checks(result)["lot_matches_dispatch"]["status"] == "abstain"
    assert "independent OEM dispatch" in result["missing_artefact"]


def test_two_valid_split_shipments_do_not_create_reuse_flag():
    result = run("origin_split_shipment")
    assert result["verdict"] == "GENUINE"
    bad = [f for f in result["ledger"]["findings"]
           if f["direction"] == "supports_suspect"]
    assert bad == []


def test_exact_unit_allocation_excess_is_suspect_and_deduplicated():
    assertions = [
        Assertion("Maker", "shipment_id", "S-1", "D-1"),
        Assertion("Maker", "part_number", "P-1", "D-1"),
        Assertion("Maker", "lot_code", "L-1", "D-1"),
        Assertion("Maker", "quantity", "11", "D-1"),
        Assertion("Maker", "unit", "units", "D-1"),
    ]
    record = {"record_id": "R-1", "kind": "oem_dispatch",
              "shipment_id": "S-1", "lot": "L-1", "part": "P-1",
              "quantity": "10", "unit": "units", "recorded_at": "2024-01-01"}
    rows = validators.reconcile_independent_records(
        assertions, [record, dict(record)], "test-v1")
    quantity = next(f for f in rows if f.check == "quantity_allocation_reconciles")
    assert quantity.status == "fail"
    assert "11" in quantity.detail and "10" in quantity.detail


def test_conflicting_independent_event_forces_contradictory_abstention():
    assertions = [Assertion("Maker", "shipment_id", "S-1", "D-1"),
                  Assertion("Maker", "part_number", "P-1", "D-1"),
                  Assertion("Maker", "lot_code", "L-1", "D-1")]
    records = [
        {"record_id":"R-1","kind":"oem_dispatch","shipment_id":"S-1",
         "lot":"L-1","part":"P-1","recorded_at":"2024-01-01"},
        {"record_id":"R-2","kind":"oem_dispatch","shipment_id":"S-1",
         "lot":"L-2","part":"P-1","recorded_at":"2024-01-01"},
    ]
    ledger = Ledger(validators.reconcile_independent_records(
        assertions, records, "test-v1"))
    result = decide(ledger, {}, rules_only=True, n_documents=2)
    assert result["verdict"] == "UNVERIFIABLE"
    assert result["subtype"] == "contradictory"


def test_counterfactual_recomputes_origin_gate():
    result = run("origin_late_distributor")
    assert result["counterfactual"]["baseline"] == "GENUINE"
    lot_rows = [r for r in result["counterfactual"]["decisive"]
                if r["check"] == "lot_matches_dispatch"]
    assert lot_rows and lot_rows[0]["becomes"].startswith("UNVERIFIABLE")
