// Mirrors the JSON returned by app.py / pipeline.analyze().

export type Verdict = "GENUINE" | "SUSPECT" | "UNVERIFIABLE";
export type Subtype = "missing" | "inaccessible" | "contradictory" | "insufficient" | null;
export type Direction = "supports_genuine" | "supports_suspect" | "neutral";
export type Strength = "weak" | "moderate" | "strong" | "dispositive";
export type SourceTier = "authoritative" | "derived" | "self_reported" | "heuristic";
export type Dimension = "identity" | "certification" | "provenance" | "custody";

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
}

export interface Assertion {
  entity: string;
  attribute: string;
  value: string;
  source_doc: string;
  date: string | null;
}

export interface Contradiction {
  topic: string;
  benign: string;
  malicious: string;
  resolution: string;
  resolved_direction: Direction | "unresolved";
}

export interface Reasoning {
  contradictions: Contradiction[];
  narrative: string;
  recommended_verdict: Verdict;
  engine: "llm" | "deterministic_fallback";
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
  ledger: { findings: Finding[] };
  reasoning: Reasoning | null;
  rules_only: boolean;
  actions: { oem: string; distributor: string; service: string };
  cannot_determine: string[];
  counts: { supports_suspect: number; supports_genuine: number; neutral: number };
  case_id: string;
  extraction: { engine: "llm" | "fallback_parser"; dropped_assertions: number };
  assertions: Assertion[];
  injection_flags: { source_doc: string; content: string }[];
  registry_row: RegistryRow | null;
  llm_provider: "mock" | "anthropic" | "openai_compat";
  llm_model: string | null;
  aliased: boolean;
  elapsed_ms?: number;
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
