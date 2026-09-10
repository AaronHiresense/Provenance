"""Public operational endpoints expose health without secrets or paths."""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["PROVENANCE_LLM_PROVIDER"] = "mock"

import app

CASES = Path(__file__).resolve().parents[1] / "cases"


def _load(name):
    return json.loads((CASES / f"{name}.json").read_text(encoding="utf-8-sig"))


def test_health_is_liveness_only():
    assert app.health() == {"status": "ok"}


def test_runtime_is_safe_and_describes_capabilities():
    result = app.runtime()
    assert result["processing"]["provider"] == "mock"
    assert result["processing"]["external_model"] is False
    assert "path" not in str(result).lower()
    assert "key" not in str(result).lower()
    assert result["capabilities"]["streaming_analysis"] is True
    assert result["capabilities"]["independent_origin_records"] is True
    assert result["reference_snapshot"]["provenance"] == "synthetic_demo"
    assert result["reference_snapshot"]["available"] is True


def test_ready_checks_registry_and_storage(monkeypatch):
    monkeypatch.setattr(app, "_registry_status", lambda: (True, "2026-07-22"))
    monkeypatch.setattr(app, "_storage_ready", lambda: True)
    assert app.ready()["status"] == "ready"


def test_missing_dependency_is_not_ready(monkeypatch):
    monkeypatch.setattr(app, "_registry_status", lambda: (False, None))
    monkeypatch.setattr(app, "_storage_ready", lambda: True)
    try:
        app.ready()
    except app.HTTPException as exc:
        assert exc.status_code == 503
        assert exc.detail["registry"] is False
    else:
        raise AssertionError("readiness must fail without the registry")


def test_prepared_case_clicks_never_poison_the_reuse_archive(tmp_path, monkeypatch):
    """A prepared lot (req.case) is clicked repeatedly by every visitor — by
    design, not by mistake. It must never be treated as a desk submission, or
    the second person to click 'genuine_hsi' gets SUSPECT for a case the
    product itself sells as a one-click, always-right reference."""
    monkeypatch.setenv("PROVENANCE_ARCHIVE", str(tmp_path / "lots.jsonl"))
    for _ in range(3):
        r = app.analyze(app.AnalyzeRequest(case="genuine_hsi"))
        checks = {f["check"] for f in r["ledger"]["findings"]}
        assert "dossier_reuse" not in checks
        assert r["verdict"] == "GENUINE"
    assert not (tmp_path / "lots.jsonl").exists()


def test_check_the_work_yourself_samples_never_poison_the_archive(tmp_path, monkeypatch):
    """The six downloadable 'check the work yourself' samples run through the
    raw-text path with a generic case_id — the same shape a reviewer's own
    paste uses. They must still be recognised as reference content and never
    archived, or the second visitor to click 'Run as text' gets a different
    verdict than the one the page promises."""
    monkeypatch.setenv("PROVENANCE_ARCHIVE", str(tmp_path / "lots.jsonl"))
    combined = Path(__file__).resolve().parents[1] / "samples" / "combined"
    sample_files = sorted(combined.glob("*.txt"))
    assert sample_files, "no sample fixtures found to test against"
    for path in sample_files:
        text = path.read_text(encoding="utf-8-sig")
        for _ in range(2):
            r = app.analyze(app.AnalyzeRequest(raw_text=text, case_id="live"))
            checks = {f["check"] for f in r["ledger"]["findings"]}
            assert "dossier_reuse" not in checks, path.name
    assert not (tmp_path / "lots.jsonl").exists()


def test_composers_own_prefilled_dossier_never_poisons_the_archive(tmp_path, monkeypatch):
    """The Dossier JSON tab opens pre-filled with genuine_hsi's own
    documents, verbatim, so a reviewer sees a real example instead of an
    empty box. Submitted as req.dossier (not req.case), that default must
    still be recognised as a reference view, not a desk submission."""
    monkeypatch.setenv("PROVENANCE_ARCHIVE", str(tmp_path / "lots.jsonl"))
    dossier = {"case_id": "genuine_hsi", "documents": _load("genuine_hsi")["documents"]}
    for _ in range(3):
        r = app.analyze(app.AnalyzeRequest(dossier=dossier))
        checks = {f["check"] for f in r["ledger"]["findings"]}
        assert "dossier_reuse" not in checks
        assert r["verdict"] == "GENUINE"
    assert not (tmp_path / "lots.jsonl").exists()


def test_editing_a_prefilled_field_the_fingerprint_ignores_still_reads_as_reference(
        tmp_path, monkeypatch):
    """Reported live: a visitor removed the BIS Licence line from the
    pre-filled Paperwork example (to see how the pipeline reacts to a
    missing field) and got SUSPECT/UNVERIFIABLE via dossier_reuse — a
    finding with nothing to do with the edit they made. BIS licence isn't
    one of archive.FINGERPRINT_ATTRS, so the edited dossier's identity
    fingerprint is byte-identical to the public pre-filled default every
    visitor's browser already shares; it must still read as a reference
    view, not a stranger's reused paperwork."""
    monkeypatch.setenv("PROVENANCE_ARCHIVE", str(tmp_path / "lots.jsonl"))
    edited_text = (
        "CERTIFICATE OF CONFORMITY\n"
        "Manufacturer: HSI AUTOMOTIVES PRIVATE LIMITED\n"
        "CIN: U29309TN1997PTC039462\nState: Tamil Nadu\nRole: manufacturer\n"
        "Part Number: BC-2209\nCertificate No: HSI-COC-33108\n"
        "Certificate Date: 2024-05-10\n"
        "We certify these brake caliper assemblies conform to IS 15100 and "
        "were produced at our Sriperumbudur plant.\n"
        "---\n"
        "TAX INVOICE\nSupplier: HSI AUTOMOTIVES PRIVATE LIMITED\n"
        "CIN: U29309TN1997PTC039462\nGSTIN: 33AABCH4501R1ZK\n"
        "State: Tamil Nadu\nInvoice No: HSI/2024/07751\n"
        "Invoice Date: 2024-05-15\nPart Number: BC-2209\n"
        "Lot Code: SPB-240420-00412\nQty: 24 units front brake caliper assemblies\n"
        "---\n"
        "DISPATCH NOTE\nCompany: HSI AUTOMOTIVES PRIVATE LIMITED\n"
        "Part Number: BC-2209\nLot Code: SPB-240420-00412\n"
        "Manufacturing Date: 2024-04-20\nShip Date: 2024-05-15\n"
        "Carrier: BlueDart Surface, Chennai hub"
    )
    req = app.AnalyzeRequest(raw_text=edited_text, case_id="live")
    dossier = app._dossier_from_request(req)
    assert app._is_reference_request(req, dossier) is True

    r = app.analyze(req)
    checks = {f["check"] for f in r["ledger"]["findings"]}
    assert "dossier_reuse" not in checks
    assert r["verdict"] == "GENUINE"
    assert not (tmp_path / "lots.jsonl").exists()


def test_a_real_submission_still_triggers_reuse_detection(tmp_path, monkeypatch):
    """The archive fix must exempt known reference identities only — a
    genuine desk submission of a lot whose identity-and-goods fields match
    none of the shipped cases or samples, presented twice, is still the
    cloned-paperwork attack the archive exists to catch. Deliberately not
    genuine_hsi's own documents under a different case_id: that dossier's
    fingerprint *is* a known demo identity regardless of its label, so it
    is correctly exempt now — this test needs paperwork that shares no
    fingerprint with any of the 21 cases or 6 samples.

    A lot outside the synthetic demo-v1 reference snapshot has no
    independent dispatch anchor to match, so the first submission abstains
    at UNVERIFIABLE(insufficient) rather than reaching GENUINE — that cap
    is a real, documented property of the current custody-reconciliation
    policy, not something this test is asserting incidentally."""
    monkeypatch.setenv("PROVENANCE_ARCHIVE", str(tmp_path / "lots.jsonl"))
    # Real CIN (HSI, already used across several demo cases) so registry
    # identity checks resolve genuinely — but a lot code, invoice and cert
    # number not used by any of the 21 cases, so the *fingerprint* (which is
    # what must trigger reuse detection, not the company) is genuinely novel.
    dossier = {
        "case_id": "a-reviewers-own-lot",
        "documents": [{
            "doc_id": "DOC-1", "doc_type": "certificate_of_conformity",
            "date": "2025-09-01",
            "text": "CERTIFICATE OF CONFORMITY\n"
                    "Manufacturer: HSI AUTOMOTIVES PRIVATE LIMITED\n"
                    "CIN: U29309TN1997PTC039462\nState: Tamil Nadu\n"
                    "Role: manufacturer\nPart Number: BC-2209\n"
                    "Certificate No: HSI-COC-99001\nCertificate Date: 2025-09-01\n"
                    "We certify these brake caliper assemblies conform to IS 15100.",
        }, {
            "doc_id": "DOC-2", "doc_type": "tax_invoice", "date": "2025-09-05",
            "text": "TAX INVOICE\nSupplier: HSI AUTOMOTIVES PRIVATE LIMITED\n"
                    "CIN: U29309TN1997PTC039462\nGSTIN: 33AABCH4501R1ZK\n"
                    "State: Tamil Nadu\nInvoice No: HSI/2025/90210\n"
                    "Invoice Date: 2025-09-05\nPart Number: BC-2209\n"
                    "Lot Code: ZZZ-250901-77001\nQty: 60 units front brake caliper assemblies",
        }, {
            "doc_id": "DOC-3", "doc_type": "dispatch_note", "date": "2025-09-05",
            "text": "DISPATCH NOTE\nCompany: HSI AUTOMOTIVES PRIVATE LIMITED\n"
                    "Part Number: BC-2209\nLot Code: ZZZ-250901-77001\n"
                    "Manufacturing Date: 2025-08-28\nShip Date: 2025-09-05\n"
                    "Carrier: BlueDart Surface, Chennai hub",
        }],
    }
    first = app.analyze(app.AnalyzeRequest(dossier=dossier))
    assert (first["verdict"], first.get("subtype")) == ("UNVERIFIABLE", "insufficient")
    first_reuse = [f for f in first["ledger"]["findings"] if f["check"] == "dossier_reuse"]
    assert first_reuse and first_reuse[0]["direction"] != "supports_suspect", \
        "a first sighting must record itself, not accuse itself"

    second = app.analyze(app.AnalyzeRequest(dossier=dossier))
    reuse = [f for f in second["ledger"]["findings"] if f["check"] == "dossier_reuse"]
    assert reuse and reuse[0]["direction"] == "supports_suspect"
    assert second["verdict"] == "SUSPECT"


def _aliased_case_name():
    for p in CASES.glob("*.json"):
        d = json.loads(p.read_text(encoding="utf-8-sig"))
        if d.get("display_aliases"):
            return p.stem, list(d["display_aliases"].keys())
    raise AssertionError("no aliased case found in cases/ to test against")


def test_get_case_route_never_leaks_the_real_name_or_the_alias_map():
    """A prepared case marked aliased must not be de-anonymisable by simply
    fetching its own case file: /api/analyze and /api/analyze/stream already
    alias their output, but GET /api/cases/{name} served the raw fixture —
    real name, real registry status, and the display_aliases map itself,
    unauthenticated, to anyone who guessed or was shown the URL."""
    case_name, real_names = _aliased_case_name()
    result = app.get_case(case_name)
    assert "display_aliases" not in result
    assert result["aliased"] is True
    blob = json.dumps(result).lower()
    for real in real_names:
        assert real.lower() not in blob, f"real name {real!r} leaked via GET /api/cases/{{name}}"


def test_preflight_never_leaks_the_real_name_for_an_aliased_case():
    """preflight_mod.preflight() must see the real dossier (it looks up the
    real CIN against the real registry), but its response — identifiers,
    registry row, claims — reached the client unaliased. Same fix applied
    to /api/analyze already; preflight needs it independently since it has
    its own code path that never touched pipeline._apply_aliases."""
    case_name, real_names = _aliased_case_name()
    result = app.preflight(app.AnalyzeRequest(case=case_name))
    assert result["aliased"] is True
    blob = json.dumps(result).lower()
    for real in real_names:
        assert real.lower() not in blob, f"real name {real!r} leaked via /api/preflight"


def test_dossier_from_request_still_sees_the_real_case_for_analysis():
    """The scrub is a display-layer fix, not a pipeline change: /api/analyze
    must still validate the real CIN against the real registry row, or the
    aliasing fix would have silently broken every prepared-case verdict."""
    case_name, _ = _aliased_case_name()
    result = app.analyze(app.AnalyzeRequest(case=case_name))
    assert result["registry_row"] is not None, \
        "the pipeline lost the real dossier and could not resolve the registry row"
