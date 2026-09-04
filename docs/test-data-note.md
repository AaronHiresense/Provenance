# PROVENANCE — test data (submission package)

The test data is the `cases/` folder: **13 dossiers**, each a JSON file of
supply-chain documents plus an `expected` verdict. Every dossier is anchored
to a **real MCA registry record** (see `docs/synthetic-data-note.md` for the
construction and aliasing policy) — a juror checking any CIN on the MCA
portal finds exactly what our ledger claims. Any of these can be fed to the
system through the UI (case library, dossier JSON, or pasted as plain text),
and new variants in the same shape run without code changes.

## Dossier format

```json
{
  "case_id": "...", "title": "...",
  "expected": {"verdict": "GENUINE|SUSPECT|UNVERIFIABLE", "subtype": null},
  "display_aliases": {"REAL NAME": "STAGE NAME"},   // optional
  "documents": [
    {"doc_id": "DOC-1", "doc_type": "certificate_of_conformity",
     "date": "YYYY-MM-DD", "text": "CERTIFICATE OF CONFORMITY\n..."}
  ]
}
```

Document `text` is free text — labeled lines (`CIN: ...`, `GSTIN: ...`)
extract most reliably, but the extraction stage handles prose. Plain pasted
text (documents separated by a `---` line) also works, via the live-case tab.

## The 13 cases and what each one tests

| Case | Expected | What it demonstrates |
|---|---|---|
| genuine_hsi | GENUINE | clean trail from an established manufacturer; all 17 checks agree |
| genuine_bonfiglioli | GENUINE | second clean anchor, with BIS licence + type approval |
| genuine_norde_llp | GENUINE | an LLP: identity checks abstain (no NIC) instead of guessing |
| genuine_hsi_typolot | GENUINE | a typo'd lot code that must NOT flip the verdict — heuristics never outrank authoritative support |
| suspect_velomax (aliased) | SUSPECT | certificate predates incorporation, wrong-state GSTIN, ships before manufacture, prompt-injection attempt neutralised |
| suspect_zephyr (aliased) | SUSPECT | single contradiction: registry says the "manufacturer" is a trader |
| suspect_meridian (aliased) | SUSPECT | certificate issued by a struck-off company |
| suspect_novakraft (aliased) | SUSPECT | geography mismatch: GSTIN and dispatch state contradict the claimed state |
| suspect_cloned_spec | SUSPECT | **cloned paperwork**: a genuine supplier's identity borrowed wholesale — every identity check passes; the claimed spec contradicts the OEM's published sheet |
| contrast_cascade (aliased) | UNVERIFIABLE/contradictory | merged supplier: rules-only says SUSPECT, the full agent recognises the registry-documented amalgamation and holds for the NCLT order |
| unverifiable_ghost | UNVERIFIABLE/missing | well-formed CIN with no registry record: a gap, not proof — with a work order |
| unverifiable_kestrel_thin (aliased) | UNVERIFIABLE/insufficient | identity alone never certifies goods: one cover letter is not a paper trail |
| unverifiable_falconridge_bis (aliased) | UNVERIFIABLE/inaccessible | the decisive check (BIS licence) cannot be run offline — named as such |

## Reproducing the numbers

```bash
python eval.py            # mock engine: 13/13 exact, deterministic
python eval.py --live     # live LLM path: 13/13
python eval.py --rules-only   # 12/13 — the cascade divergence is the
                              # designed demonstration of what stage 4 adds
```

## Building a new scenario from this data

Take any case and change one fact — a date, a state, a standard, a status —
and the relevant validator responds; the system routes checks by claim type,
not by scenario. The raw-text tab accepts documents with no formatting at
all.
