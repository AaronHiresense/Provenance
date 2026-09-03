# PROVENANCE — business note

## The problem, in money

India's automotive aftermarket is estimated around **₹33,000 crore**, with
industry bodies (ACMA/SIAM analyses) putting counterfeit/spurious share in
the region of **a third of the market** — figures vary by study and part
category, and we quote them as industry estimates, not measurements. The
harm concentrates in safety-critical parts: brake components, steering,
airbags — where a fake is not lost margin but a recall, a warranty dispute,
or an injury claim.

## Who pays, who uses

**The OEM pays; the distributor desk uses it.** Authorized distributors
carry warranty liability and lose the franchise when spurious parts surface
in their channel. The OEM mandates dossier verification across its
authorized network the same way it mandates every other channel-compliance
control — and receives the append-only evidence ledgers as an audit trail.
(An adversarial distributor is an insider-threat problem; the ledger being
reviewable by the OEM, not self-graded, is the control for that.)

Three deployment levels, matching the per-verdict actions the system already
issues:

| Level | Moment | Action on SUSPECT |
|---|---|---|
| OEM brand protection | channel audits | open case, request physical sample |
| Distributor incoming-goods QA (primary) | goods receipt | quarantine lot, freeze payment |
| Showroom / service | fitment | do not fit; source verified channel |

## Unit economics

- **Per dossier**: seconds of compute on commodity hardware (deterministic
  checks are milliseconds; one LLM reasoning pass ~10s; zero marginal cost
  in rules-only mode). No per-lookup API fees — the registry is a local
  snapshot refreshed by a nightly one-script sync.
- **Against**: one warranty claim on a failed brake part, one channel-audit
  investigation, or one liability event. A single prevented fitment of a
  counterfeit safety part pays for years of dossier screening.
- **The abstention economics**: an UNVERIFIABLE is not an investigation —
  it is a one-line supplier email naming the single missing document, with
  the lot held in the meantime. Wrong GENUINE = recall; our hold = a
  two-day delay.

## Scalability

- The registry query path is a local DuckDB file: 3.67M rows, indexed CIN
  lookups effectively instant, ~200ms name searches — one desk or a
  regional hub runs on one machine.
- Throughput scales linearly with LLM capacity, and degrades gracefully:
  rules-only mode screens at full speed with no model at all, reserving
  LLM reasoning for the ambiguous minority.
- Adding an OEM = adding its lot-code grammar and spec references — data,
  not code.

## Roadmap (named, not vaporware)

1. **Dossier-hash / lot-reuse registry** — catches the cloned-genuine-
   paperwork attack (layer two; the current system states this limit on
   every verdict).
2. **Live BIS + GSTN integration** where the deployment has connectivity —
   replacing today's declared stub and offline checks.
3. **Multi-party dossier support** — verifying carriers and distributors,
   not only the manufacturer-role entity.
4. **Nightly registry sync** — productionizing the snapshot refresh that is
   currently one manual script run.
5. **OCR/image ingestion** with document-forensics signals.
