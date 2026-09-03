"""Unit tests for the deterministic validators, run against real rows from
the mca.duckdb `companies` table:

  * U45200KA2026PTC221821 — BIKEBLOOM MOTORWORKS, Karnataka, reg. 2026-06-01,
    NIC 45200 (trading), Active
  * U29309TN1997PTC039462 — HSI AUTOMOTIVES, Tamil Nadu, reg. 1997-11-21,
    NIC 29309 (manufacturing), Active
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import registry
import validators as v
from ledger import Assertion

TRADER_CIN = "U45200KA2026PTC221821"
MFG_CIN = "U29309TN1997PTC039462"
VALID_GSTIN_TN = "33AABCH4501R1ZK"   # checksum-valid, Tamil Nadu
VALID_GSTIN_MH = "27AABCB9302F1ZZ"   # checksum-valid, Maharashtra


# -- gstin_checksum ----------------------------------------------------------

def test_gstin_checksum_valid():
    f = v.gstin_checksum(VALID_GSTIN_TN)
    assert f.result == "pass" and f.direction == "supports_genuine"

def test_gstin_checksum_known_public_example():
    assert v.gstin_checksum("27AAPFU0939F1ZV").result == "pass"

def test_gstin_checksum_wrong_check_char():
    f = v.gstin_checksum("33AABCH4501R1ZA")
    assert f.result == "fail" and f.direction == "supports_suspect"

def test_gstin_checksum_malformed():
    f = v.gstin_checksum("33ABC123")
    assert "malformed" in f.result and f.direction == "supports_suspect"


# -- gstin_state_matches_claim (incl. aliases) -------------------------------

def test_gstin_state_match():
    f = v.gstin_state_matches_claim(VALID_GSTIN_TN, "Tamil Nadu")
    assert f.result == "pass"

def test_gstin_state_mismatch():
    f = v.gstin_state_matches_claim(VALID_GSTIN_MH, "Karnataka")
    assert f.result == "fail" and f.direction == "supports_suspect"

def test_alias_orissa_is_odisha():
    f = v.gstin_state_matches_claim("21AABCH4501R1Z" +
                                    v.gstin_check_char("21AABCH4501R1Z"),
                                    "Orissa")
    assert f.result == "pass"

def test_alias_pondicherry_and_chattisgarh():
    assert registry.states_equivalent("Pondicherry", "puducherry")
    assert registry.states_equivalent("Chattisgarh", "chhattisgarh")

def test_alias_jammu_and_kashmir_code_01():
    assert registry.code_for_state_name("Jammu & Kashmir") == "01"

def test_alias_merged_ut_code_26():
    assert registry.code_for_state_name("Dadra & Nagar Haveli") == "26"
    assert registry.code_for_state_name("Daman and Diu") == "26"

def test_unknown_state_code_flagged():
    f = v.gstin_state_matches_claim("99AABCH4501R1ZK", "Karnataka")
    assert f.direction == "supports_suspect"


# -- gstin_embedded_pan ------------------------------------------------------

def test_embedded_pan_company_type_passes():
    f = v.gstin_embedded_pan(VALID_GSTIN_TN)  # AABCH...: 4th char C = company
    assert f.result == "pass"

def test_embedded_pan_mismatch_with_claimed():
    f = v.gstin_embedded_pan(VALID_GSTIN_TN, claimed_pan="ZZZZZ9999Z")
    assert f.result == "fail" and f.direction == "supports_suspect"

def test_embedded_pan_matches_claimed():
    f = v.gstin_embedded_pan(VALID_GSTIN_TN, claimed_pan="AABCH4501R")
    assert f.result == "pass"


# -- cin_decode --------------------------------------------------------------

def test_cin_decode_trader():
    f, d = v.cin_decode(TRADER_CIN)
    assert f.result == "pass"
    assert d["nic_code"] == "45200" and d["state_name"] == "karnataka"
    assert d["year"] == 2026 and d["ownership"] == "PTC" and not d["listed"]

def test_cin_decode_manufacturer():
    _, d = v.cin_decode(MFG_CIN)
    assert d["nic_code"] == "29309" and d["state_name"] == "tamil nadu"
    assert d["year"] == 1997

def test_cin_decode_malformed():
    f, d = v.cin_decode("U12INVALID")
    assert d is None and f.direction == "supports_suspect"

def test_cin_decode_llpin_abstains():
    f, d = v.cin_decode("ACY-8688")
    assert "abstain" in f.result and f.direction == "neutral"
    assert d["kind"] == "llpin"


# -- registry_exists / cin_vs_registry (real DB rows) ------------------------

def test_registry_exists_real_row():
    row = registry.lookup_cin(MFG_CIN)
    f = v.registry_exists(MFG_CIN, row)
    assert f.result == "pass" and f.source_tier == "authoritative"
    assert "HSI AUTOMOTIVES" in f.detail

def test_registry_exists_fake_cin():
    f = v.registry_exists("U99999XX2020PTC000000",
                          registry.lookup_cin("U99999XX2020PTC000000"))
    assert "not found" in f.result and f.direction == "supports_suspect"

def test_cin_vs_registry_matches():
    row = registry.lookup_cin(MFG_CIN)
    fs = v.cin_vs_registry(MFG_CIN, {
        "company_name": "HSI Automotives Private Limited",
        "state": "Tamil Nadu",
        "incorporation_date": "1997-11-21",
    }, row)
    assert len(fs) == 3 and all(f.result == "pass" for f in fs)

def test_cin_vs_registry_name_mismatch():
    row = registry.lookup_cin(MFG_CIN)
    fs = v.cin_vs_registry(MFG_CIN, {"company_name": "TOTALLY OTHER CO"}, row)
    assert fs[0].result == "fail" and fs[0].direction == "supports_suspect"


# -- temporal checks ---------------------------------------------------------

def test_cert_before_incorporation_dispositive():
    row = registry.lookup_cin(TRADER_CIN)   # registered 2026-06-01
    f = v.cert_date_after_incorporation("2025-11-02", row["registration_date"])
    assert f.result == "fail" and f.strength == "dispositive"

def test_cert_after_incorporation_ok():
    row = registry.lookup_cin(MFG_CIN)      # registered 1997-11-21
    f = v.cert_date_after_incorporation("2024-05-10", row["registration_date"])
    assert f.result == "pass"

def test_ship_before_mfg_fails():
    f = v.ship_date_after_mfg_date("2026-07-25", "2026-07-30")
    assert f.result == "fail" and f.direction == "supports_suspect"

def test_ship_after_mfg_ok():
    assert v.ship_date_after_mfg_date("2024-05-15", "2024-04-20").result == "pass"

def test_unparseable_dates_abstain():
    f = v.ship_date_after_mfg_date("someday", "2024-01-01")
    assert f.direction == "neutral"


# -- company_status_active ---------------------------------------------------

def test_status_active_real_row():
    row = registry.lookup_cin(MFG_CIN)
    f = v.company_status_active(MFG_CIN, row)
    assert f.result == "pass"

def test_status_struck_off():
    f = v.company_status_active("X", {"status": "Strike Off"})
    assert f.direction == "supports_suspect" and f.strength == "strong"


def test_status_amalgamated_is_moderate_with_succession_context():
    f = v.company_status_active("U34300TZ1972PTC000642",
                                {"status": "Amalgamated"})
    assert f.direction == "supports_suspect" and f.strength == "moderate"
    assert "successor" in f.detail


def test_cin_decode_tz_roc_code_is_tamil_nadu():
    _, d = v.cin_decode("U34300TZ1972PTC000642")
    assert d["state_name"] == "tamil nadu"


# -- custody checks ----------------------------------------------------------

def test_receive_before_ship_fails():
    f = v.receive_date_after_ship_date("2024-10-01", "2024-10-03")
    assert f.result == "fail" and f.dimension == "custody"


def test_receive_after_ship_ok():
    assert v.receive_date_after_ship_date("2024-10-05", "2024-10-03").result == "pass"


def test_dispatch_state_mismatch_flagged():
    f = v.dispatch_state_matches_origin("Haryana", "tamil nadu")
    assert f.result == "fail" and f.strength == "moderate"


def test_dispatch_state_alias_aware():
    assert v.dispatch_state_matches_origin("Orissa", "odisha").result == "pass"


# -- nic_is_manufacturing ----------------------------------------------------

def test_nic_manufacturing_2008():
    f = v.nic_is_manufacturing(MFG_CIN, "29309")
    assert f.result == "pass"

def test_nic_manufacturing_2004_34xx():
    f = v.nic_is_manufacturing("U34300DL2001PTC000001", "34300")
    assert f.result == "pass"

def test_nic_trading_45xxx_flagged():
    f = v.nic_is_manufacturing(TRADER_CIN, "45200")
    assert f.result == "fail" and f.direction == "supports_suspect"

def test_nic_llp_abstains():
    f = v.nic_is_manufacturing("ACY-8688", None)
    assert f.result == "abstain" and f.direction == "neutral"


# -- bis / tac / lot code ----------------------------------------------------

def test_bis_stub_known_licence():
    f = v.bis_licence_valid("CM/L-7411032", "HSI AUTOMOTIVES PRIVATE LIMITED")
    assert f.result == "pass"

def test_bis_stub_wrong_holder():
    f = v.bis_licence_valid("CM/L-7411032", "BIKEBLOOM MOTORWORKS")
    assert f.result == "fail"

def test_bis_unknown_licence_neutral():
    f = v.bis_licence_valid("CM/L-0000000")
    assert f.direction == "neutral" and "stub" in f.result

def test_tac_within_5_years():
    assert v.tac_within_5_years("2023-08-12", "2024-05-15").result == "pass"

def test_tac_expired():
    f = v.tac_within_5_years("2018-01-01", "2026-09-01")
    assert f.result == "fail"

def test_tac_future_dated():
    f = v.tac_within_5_years("2030-01-01", "2026-09-01")
    assert f.direction == "supports_suspect"


def test_lot_code_valid():
    f = v.lot_code_grammar("SPB-240420-00412", "2024-05-15")
    assert f.result == "pass"

def test_lot_code_bad_grammar():
    f = v.lot_code_grammar("CLP-2607-XX")
    assert f.result == "fail" and f.dimension == "provenance"

def test_lot_code_impossible_date():
    f = v.lot_code_grammar("SPB-241399-00412")
    assert "invalid" in f.result


# -- cross_doc_field_drift ---------------------------------------------------

def test_field_drift_detected():
    assertions = [
        Assertion("X", "gstin", "33AABCH4501R1ZK", "DOC-1"),
        Assertion("X", "gstin", "29AABCH4501R1ZQ", "DOC-2"),
    ]
    fs = v.cross_doc_field_drift(assertions)
    assert len(fs) == 1 and fs[0].direction == "supports_suspect"

def test_no_drift_when_consistent():
    assertions = [
        Assertion("X", "gstin", "33AABCH4501R1ZK", "DOC-1"),
        Assertion("X", "gstin", "33aabch4501r1zk ", "DOC-2"),
    ]
    assert v.cross_doc_field_drift(assertions) == []
