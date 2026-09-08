# Challenge 07 assessment — 8 September 2026

## Problem and scope

Help a distributor's receiving desk decide whether a component's documentary trail supports its claimed origin, identify the exact discrepancy, and hold unresolved lots for a specific missing record. Documents and records only; physical authenticity is outside the evidence available.

Mode: Builder / hackathon. The user supplied the Challenge 07 brief: investigate, cross-verify, assess, flag; use independent shipment/sourcing signals; distinguish routine variation; cite evidence; state confidence and abstain. Submission deadline and judging weights remain unknown. No additional preferences are assumed.

## Verified baseline

Reviewed the pipeline, validators, archive, verdict policy, frontend source, and submission notes. This was a source review, not a browser usability review.

- Five stages separate extraction, deterministic validation, evidence ledger, reasoning, and verdict.
- Local MCA records anchor identity; BIS, OEM specifications and some route/part checks use bounded reference tables/stubs.
- Existing features include preflight, supplier lookup, streamed stage events, successor lookup, self-critique, counterfactuals, supplier-note drafts, local history, and dossier reuse signals.
- Offline evaluation reproduced 15/15 expected verdicts and subtypes, with 4/15 abstentions. This measures self-authored regression cases, not field accuracy. Live LLM evaluation was not rerun.
- All 110 tests passed using a fresh workspace pytest temporary directory. The first run hit permission errors in the default system temporary directory.

## Premises and cheapest checks

1. The architecture can enforce its documented decision policy: verified on existing regression cases; test unseen evidence and benign edits next.
2. Supplier identity establishes this shipment's origin: unsupported. Add independently sourced OEM dispatch and carrier receipt records, tied to lot, part, quantity and recipient.
3. Repeated paperwork implies substitution: unsafe as a general assumption. Re-analysis, split shipments and corrected documents are legitimate. Introduce shipment identity and dossier versions, then test those benign paths.
4. Users can resolve held cases in the product: partial. History stores summaries; raw pasted dossiers are not retained for full reopening. Demonstrate adding a requested document to the same case and comparing decisions.
5. The product reduces manual effort: unverified. Time a reviewer and the app on the same unseen cases, recording both false releases and unnecessary holds.

## Three approaches

### 1. Submission credibility pass

Estimated effort: half to one day, subject to implementation findings. Correct unsupported UI/pitch claims, derive dimension badges from actual findings, state confidence on every verdict, reconcile submission documents, and rehearse three contrasting cases.

Risk: improves trust without adding much depth to lot-origin verification. Proves that the existing product is coherent and honestly presented.

### 2. Lot-origin investigation and resolution

Estimated effort: two to four focused days. Add a small, clearly labeled synthetic independent-record pack: OEM dispatches, distributor authorizations, carrier receipts and lot quantities. Keep it separate from supplier-submitted documents. Match source entities and shipment events, show the evidence chain, and resolve an awaiting case by attaching a new record with a before/after explanation. Preserve deterministic validation and offline operation.

Risk: entity matching, split shipments and document revisions can create false positives; allow uncertainty and retain source provenance. Synthetic references demonstrate behavior, not production access to OEM data. Proves the brief's central requirement: distinguish an innocent chain change from substitution using independent evidence.

### 3. Real-document intake and evidence export

Estimated effort: four to seven days. Add PDF/image intake with local OCR, field confirmation for uncertain extraction, source-page highlights, and an exportable investigation record.

Risk: OCR variability and packaging can consume the remaining time; extraction errors must not silently become strong accusations. Proves practical usability beyond labeled text and prepared JSON.

Recommendation: complete approach 1 first; if at least several days remain, prioritize approach 2 as the main differentiator. Add OCR after the evidence loop works. Estimates are planning ranges, not commitments.

## Corrections before judging

- The frontend labels certification `BIS Valid` whenever the overall verdict is GENUINE. Derive that label from the actual BIS finding, including unverified/stub states.
- `nothing leaves this machine` is inaccurate for remote-model mode and for a browser using a hosted backend. Show actual processing mode and data destination.
- Keep the required GENUINE verdict, but qualify it as documentary support within the checks performed. Avoid implying physical inspection or automatic fitment authorization.
- Archive reuse must distinguish reopening a case from presenting a separate shipment. A lot can span multiple legitimate consignments.
- Replace the e-way-bill 'teleporting truck' explanation: validity duration is not a minimum travel time or speed limit. A mismatch may merit documentary reconciliation; it does not prove physical impossibility. Official reference: https://docs.ewaybillgst.gov.in/html/faq_new.html
- Update stale 13-case notes and roadmap entries that still describe the implemented archive as future work.
- Add explicit evidence-based confidence for GENUINE and SUSPECT, with reasons and coverage gaps; do not invent calibrated percentages.

## Demo and next action

Build a paired fixture first: same genuine manufacturer and part, same late-added distributor. In one case an independently recorded dispatch/authorization explains the change; in the other the claimed lot, recipient or quantity contradicts that record. Add a third case where the independent record is absent and the system requests it. Only a sufficient new record should change that third verdict.

Demo: suspicious lot and exact conflicting sources; legitimate variation accepted; thin trail held and then reassessed after evidence arrives. Finish by inviting an unseen edit. Keep the real-registry versus synthetic-record distinction visible.

Next action: define these three fixtures and expected findings before changing architecture. An engineering review can then lock the entity/event model and verification cases.
