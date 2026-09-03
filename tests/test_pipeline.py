"""End-to-end pipeline tests over the bundled demo cases (mock LLM mode)."""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["PROVENANCE_LLM_PROVIDER"] = "mock"

import pipeline

CASES = Path(__file__).resolve().parents[1] / "cases"


def _run(name, rules_only=False):
    dossier = json.loads((CASES / f"{name}.json").read_text(encoding="utf-8"))
    return pipeline.analyze(dossier, rules_only=rules_only)


def test_genuine_hsi():
    r = _run("genuine_hsi")
    assert r["verdict"] == "GENUINE"
    assert r["counts"]["supports_suspect"] == 0
    assert r["aliased"] is False


def test_genuine_bonfiglioli():
    r = _run("genuine_bonfiglioli")
    assert r["verdict"] == "GENUINE"
    checks = {f["check"]: f for f in r["ledger"]["findings"]}
    assert checks["bis_licence_valid"]["result"] == "pass"


def test_genuine_norde_llp_abstains():
    r = _run("genuine_norde_llp")
    assert r["verdict"] == "GENUINE"
    checks = {f["check"]: f for f in r["ledger"]["findings"]}
    assert "abstain" in checks["cin_decode"]["result"]
    assert checks["nic_is_manufacturing"]["result"] == "abstain"


def test_suspect_velomax_aliased():
    r = _run("suspect_velomax")
    assert r["verdict"] == "SUSPECT"
    assert r["aliased"] is True
    assert len(r["injection_flags"]) == 1
    blob = json.dumps(r)
    assert "BIKEBLOOM" not in blob.upper()
    assert "VELOMAX" in blob
    # the CIN stays real so the record is independently verifiable
    assert "U45200KA2026PTC221821" in blob


def test_suspect_zephyr_activity_mismatch():
    r = _run("suspect_zephyr")
    assert r["verdict"] == "SUSPECT"
    assert "ZELIO" not in json.dumps(r).upper()
    checks = {f["check"]: f for f in r["ledger"]["findings"]}
    assert checks["nic_is_manufacturing"]["direction"] == "supports_suspect"
    # this case's ONLY hard contradiction is the trading NIC
    others = [f for f in r["ledger"]["findings"]
              if f["direction"] == "supports_suspect"
              and f["check"] != "nic_is_manufacturing"]
    assert others == []


def test_suspect_meridian_struck_off():
    r = _run("suspect_meridian")
    assert r["verdict"] == "SUSPECT"
    checks = {f["check"]: f for f in r["ledger"]["findings"]}
    assert "Strike Off" in checks["company_status_active"]["result"]


def test_unverifiable_ghost_missing_registry_record():
    r = _run("unverifiable_ghost")
    assert r["verdict"] == "UNVERIFIABLE"
    assert r["subtype"] == "missing"
    assert "MCA" in r["missing_artefact"]
    assert r["interim_action"]
    assert r["lean"] is not None


def test_rules_only_skips_reasoning():
    r = _run("suspect_velomax", rules_only=True)
    assert r["verdict"] == "SUSPECT"
    assert r["reasoning"] is None


def test_contrast_cascade_full_vs_rules_only():
    """The merged-supplier contrast demo: rules-only calls it SUSPECT, the
    full agent recognises the documented amalgamation and downgrades to
    UNVERIFIABLE pending the NCLT order."""
    full = _run("contrast_cascade")
    assert full["verdict"] == "UNVERIFIABLE"
    assert full["subtype"] == "contradictory"
    assert "NCLT" in full["missing_artefact"]
    assert "UNIVERSAL BRAKES" not in json.dumps(full).upper()
    ro = _run("contrast_cascade", rules_only=True)
    assert ro["verdict"] == "SUSPECT"


def test_kestrel_identity_only_is_insufficient():
    r = _run("unverifiable_kestrel_thin")
    assert r["verdict"] == "UNVERIFIABLE"
    assert r["subtype"] == "insufficient"
    assert "GSTIN" in r["missing_artefact"]


def test_falconridge_bis_inaccessible():
    r = _run("unverifiable_falconridge_bis")
    assert r["verdict"] == "UNVERIFIABLE"
    assert r["subtype"] == "inaccessible"
    assert "BIS" in r["missing_artefact"]


def test_typolot_heuristic_cannot_beat_authoritative():
    r = _run("genuine_hsi_typolot")
    assert r["verdict"] == "GENUINE"
    checks = {f["check"]: f for f in r["ledger"]["findings"]}
    assert checks["lot_code_grammar"]["direction"] == "supports_suspect"
    assert checks["dispatch_state_matches_origin"]["result"] == "pass"


def test_raw_text_wrapping():
    text = ("CERTIFICATE OF CONFORMITY\nManufacturer: HSI AUTOMOTIVES "
            "PRIVATE LIMITED\nCIN: U29309TN1997PTC039462\nState: Tamil Nadu\n"
            "Certificate Date: 2024-05-10\n---\nTAX INVOICE\n"
            "Supplier: HSI AUTOMOTIVES PRIVATE LIMITED\n"
            "GSTIN: 33AABCH4501R1ZK\nState: Tamil Nadu\n"
            "Lot Code: SPB-240420-00412")
    dossier = pipeline.dossier_from_raw_text(text, "jury-raw")
    assert len(dossier["documents"]) == 2
    assert dossier["documents"][0]["doc_id"] == "DOC-1"
    assert dossier["documents"][1]["text"].startswith("TAX INVOICE")
    r = pipeline.analyze(dossier)
    checks = {f["check"] for f in r["ledger"]["findings"]}
    assert "registry_exists" in checks and "gstin_checksum" in checks

