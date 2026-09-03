# PROVENANCE — synthetic data construction note

The rules require synthetic data realism to be defended. Our construction
principle: **the only synthetic artefact in this system is the forged
document itself — which is also the only synthetic artefact in the
real-world version of this problem.**

## Anchoring: every dossier stands on a real registry record

No supplier in any demo case is invented. Every CIN/LLPIN quoted on a
synthetic document belongs to a real company in the MCA master dataset
(data.gov.in, 3.67M records, snapshot 2026-07-22), carrying its **real**
incorporation date, registered state, company status, and NIC activity code.
A juror who looks any CIN up on the MCA portal finds exactly what our
ledger claims.

The contradictions are therefore real data, not fabrications:

- the "certificate predates incorporation" case anchors on a company
  genuinely registered June 2026 with a genuinely trading (45xxx) NIC code;
- the "struck-off supplier" case anchors on a company the registry really
  records as Strike Off;
- the "merged supplier" case anchors on a manufacturer the registry really
  records as Amalgamated.

## Aliasing: real attributes, protected names

Real companies must not be shown as counterfeiters on a public stage. In
every non-genuine case the display name is aliased (e.g. a real amalgamated
brake manufacturer appears as "Cascade Brake Systems"); the CIN and all
structural attributes stay real, so verification remains possible while no
real firm is accused. The verdict language is likewise framed as "this
record's attributes do not support the document's claim" — never an
accusation of the record-holder. The UI marks aliased cases, and we disclose
the practice to the jury.

## Document formats

Synthetic certificates, invoices and dispatch notes model their fields on
public format sources: standard Certificate-of-Conformity structure,
commercial invoice / e-way bill field sets (GSTIN, invoice number, HSN-level
quantities), and ARAI type-approval documentation — which itself mandates a
"BIS Licence for Safety Critical Components", the basis of our BIS check.
GSTINs are generated with the genuine mod-36 check-digit algorithm
(validated against public examples), so they are structurally
indistinguishable from issued ones except where a case deliberately breaks
the rules.

## Deliberately not modelled (out of scope for a documents investigation)

Holograms and physical security marks; QR authentication; scan/image
forensics (fonts, seals, pixel artefacts); physical measurement of parts.
These appear in the product's "what this system cannot determine" block —
the same list we would give a buyer.

## Known data-quality facts we surface rather than hide

- ~3,132 registry rows carry impossible registration dates (years like 1111
  or 9076); we set these to "date unknown" and the affected checks abstain.
- The registry mixes NIC-2004 and NIC-2008 classification schemes; our
  activity check accepts both automotive ranges (34xx and 29xx) and says so.
