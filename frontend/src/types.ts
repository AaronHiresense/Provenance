// Mirrors the JSON returned by app.py / pipeline.analyze().

export type Verdict = "GENUINE" | "SUSPECT" | "UNVERIFIABLE";
export type Subtype = "missing" | "inaccessible" | "contradictory" | "insufficient" | null;
export type Direction = "supports_genuine" | "supports_suspect" | "neutral";
export type Strength = "weak" | "moderate" | "strong" | "dispositive";
export type SourceTier = "authoritative" | "derived" | "self_reported" | "heuristic";
export type Dimension = "identity" | "certification" | "provenance" | "custody";

export interface SourceRef {
  record_id: string;
  page: number | null;
  start: number | null;
  end: number | null;
  quote: string;
  grounding: "verified" | "unlocated" | "user_confirmed";
}

export interface Finding {
  assertion: string;
  check: string;
  result: string;
  direction: Direction;
  strength: Strength;
  source_tier: SourceTier;
  dimension: Dimension;
  detail: string;
  source_doc: string;
  finding_id: string;
  entity_ids: string[];
  shipment_ids: string[];
  source_refs: SourceRef[];
  status: "pass" | "fail" | "abstain" | "unavailable";
  reference_version: string | null;
  reason_code: string;
}

export interface Assertion {
  entity: string;
  attribute: string;
  value: string;
  source_doc: string;
  date: string | null;
  assertion_id: string;
  entity_id: string | null;
  shipment_id: string | null;
  source_ref: SourceRef | null;
}

export interface EvidenceEntity {
  entity_id: string;
  display_name: string;
  cin: string | null;
  gstin: string | null;
  resolved: boolean;
}

export interface EvidenceRelationship {
  relationship_id: string;
  kind: string;
  shipment_id: string | null;
  from_entity_id: string | null;
  to_entity_id: string | null;
  lot: string | null;
  part: string | null;
  quantity: string | null;
  unit: string | null;
  effective_from: string | null;
  effective_to: string | null;
  source_refs: SourceRef[];
}

export interface ReferenceSnapshot {
  version: string;
  provenance?: "synthetic_demo" | string;
  coverage?: string;
  as_of?: string;
  record_count?: number;
  content_hash?: string;
  available?: boolean;
  matching_records?: number;
}

export interface TypedEvidence {
  documents: Array<Record<string, unknown>>;
  entities: EvidenceEntity[];
  relationships: EvidenceRelationship[];
  participations: Array<{ entity_id: string; role: string; document_id: string; relationship_id: string }>;
  reference_snapshot: ReferenceSnapshot;
  independent_records: Array<Record<string, unknown>>;
}

export interface Contradiction {
  topic: string;
  benign: string;
  malicious: string;
  resolution: string;
  resolved_direction: Direction | "unresolved";
}

export interface Challenge {
  attack: string;
  weakest_link: string;
  decisive_artefact: string;
  held: boolean;
  why: string;
  engine: "llm" | "deterministic_fallback" | "skipped";
  revised: boolean;
  from?: Verdict;
  outcome?: "held" | "upheld" | "overridden" | "blocked";
  override_reason?: string;
  blocked?: boolean;
  blocked_reason?: string;
}

export interface Reasoning {
  contradictions: Contradiction[];
  narrative: string;
  recommended_verdict: Verdict;
  engine: "llm" | "deterministic_fallback";
  challenge?: Challenge;
}

export interface UncheckedClaim {
  attribute: string;
  value: string;
  entity: string;
  source_doc: string;
}

export interface CounterfactualRow {
  check: string;
  assertion: string;
  result: string;
  direction: Direction;
  strength: Strength;
  source_tier: SourceTier;
  becomes: string;
}

export interface Counterfactual {
  baseline: string;
  decisive: CounterfactualRow[];
  considered: number;
  note: string;
  method: string;
}

export interface Lean {
  direction: "suspect" | "genuine" | "none";
  confidence: "low" | "none";
  basis: string;
}

export interface RegistryRow {
  cin: string;
  name: string;
  status: string | null;
  state_name: string | null;
  registration_date: string | null;
  nic_code: string | null;
  industry: string | null;
}

export interface AnalysisResult {
  verdict: Verdict;
  subtype: Subtype;
  missing_artefact: string | null;
  interim_action: string | null;
  lean: Lean | null;
  confidence: {
    level: "high" | "medium" | "low" | "none";
    scope: "documentary_assessment";
    basis: string[];
    limitations: string[];
  };
  dimension_status: Record<Dimension, {
    status: "supported" | "contradicted" | "incomplete" | "unavailable" | "not_applicable";
    support: number;
    contradictions: number;
    gaps: number;
  }>;
  ledger: { findings: Finding[] };
  reasoning: Reasoning | null;
  rules_only: boolean;
  actions: { oem: string; distributor: string; service: string };
  cannot_determine: string[];
  counts: { supports_suspect: number; supports_genuine: number; neutral: number };
  case_id: string;
  extraction: { engine: "llm" | "fallback_parser"; dropped_assertions: number };
  assertions: Assertion[];
  evidence: TypedEvidence;
  injection_flags: { source_doc: string; content: string }[];
  registry_row: RegistryRow | null;
  llm_provider: "mock" | "anthropic" | "openai_compat";
  llm_model: string | null;
  aliased: boolean;
  elapsed_ms?: number;
  unchecked_claims: UncheckedClaim[];
  counterfactual: Counterfactual;
}

export interface ArchiveStats {
  screened: number;
  lots: number;
  path: string;
  cleared?: boolean;
}

export type Stage = "extract" | "validate" | "ledger" | "reason" | "verdict";
export type StageStatus = "running" | "done" | "skipped";

/** One line of the NDJSON stream from /api/analyze/stream. */
export interface StageEvent {
  type: "stage";
  stage: Stage;
  status: StageStatus;
  detail: string;
  ms: number;
  claims?: number;
  injections?: number;
  checks?: number;
  contradict?: number;
  support?: number;
  engine?: string;
  challenged?: boolean;
  challenge_held?: boolean;
  recommended?: Verdict;
  verdict?: Verdict;
  subtype?: Subtype;
}

export interface ResultEvent {
  type: "result";
  result: AnalysisResult;
}

export type StreamEvent = StageEvent | ResultEvent;

/** What the agent understands before it runs (POST /api/preflight). */
export interface PreflightPlanItem {
  check: string;
  will_run: boolean;
  reason: string | null;
}
export interface Preflight {
  documents: { doc_id: string; kind: string; chars: number; date: string | null }[];
  claims: Assertion[];
  identifiers: { company_name: string | null; cin: string | null; gstin: string | null; lot_code: string | null; part_number: string | null };
  registry: { cin: string; name: string; status: string | null; state_name: string | null; registration_date: string | null; nic_code: string | null } | null;
  injections: number;
  plan: PreflightPlanItem[];
  runnable: number;
  total: number;
  unlocks: { document: string; checks: string[] }[];
  evidence: Omit<TypedEvidence, "reference_snapshot" | "independent_records">;
  reference_snapshot: ReferenceSnapshot;
  aliased: boolean;
}

export interface CaseSummary {
  file: string;
  case_id: string;
  title: string;
  documents: number;
  expected?: Verdict | null;
  aliased?: boolean;
}

/** A downloadable set of sample paperwork, already joined the way the
 *  composer joins an upload, so a reviewer can feed the system by hand. */
export interface SampleSet {
  file: string;
  url: string;
  label: string;
  expected?: Verdict | null;
  bytes: number;
}

export interface DossierDocument {
  doc_id: string;
  doc_type: string;
  date: string | null;
  text: string;
}

export interface Dossier {
  case_id: string;
  title?: string;
  documents: DossierDocument[];
  expected?: { verdict: Verdict; subtype: Subtype };
  display_aliases?: Record<string, string>;
}

export type AnalyzeRequest =
  | { case: string; rules_only: boolean }
  | { raw_text: string; case_id: string; rules_only: boolean }
  | { dossier: Dossier; rules_only: boolean };
