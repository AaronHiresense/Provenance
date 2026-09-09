// Plain-language vocabulary for everything the pipeline emits. The backend
// speaks in check identifiers, tiers and dimensions; the desk that uses this
// tool does not. Every mapping has a fallback so a new validator still renders.

import type { AnalysisResult, Contradiction, Dimension, Finding, SourceTier, Strength, Subtype, Verdict } from "./types";

const CHECK_LABELS: Record<string, string> = {
  role_claim_recorded: "Dossier describes the company as the manufacturer",
  cin_decode: "Company identifier (CIN) is well formed",
  registry_exists: "Company exists in the MCA registry",
  cin_vs_registry: "Documents match the registry record",
  company_status_active: "Company is active on the registry",
  nic_is_manufacturing: "Registered activity is manufacturing",
  gstin_checksum: "GST number passes its checksum",
  gstin_state_matches_claim: "GST state matches the documents",
  gstin_embedded_pan: "PAN inside the GST number is well formed",
  cert_date_after_incorporation: "Certificate is dated after incorporation",
  ship_date_after_mfg_date: "Shipped after manufacture",
  receive_date_after_ship_date: "Received after dispatch",
  dispatch_state_matches_origin: "Dispatched from the supplier's state",
  bis_licence_valid: "BIS licence is valid for this holder",
  tac_within_5_years: "Type approval is within its validity",
  lot_code_grammar: "Lot code follows the OEM format",
  spec_matches_oem_sheet: "Part specification matches the OEM sheet",
  eway_validity_vs_distance: "E-way bill validity fits the distance",
  hsn_matches_part: "HSN code matches the part",
  entry_port_mode_consistent: "Entry port matches the transport mode",
  route_distance_sanity: "Claimed route distance is plausible",
  cross_doc_field_drift: "Fields agree across documents",
  injection_screen: "No instructions aimed at the reviewer",
  successor_registry_lookup: "Successor company found in the registry",
  dossier_reuse: "This paperwork has not been seen before",
  lot_code_collision: "This lot code carries one paper trail",
};

export function checkLabel(check: string): string {
  return CHECK_LABELS[check] ?? check.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// How the same check reads when it failed: a statement of what went wrong,
// not the claim that was tested.
const FAIL_LABELS: Record<string, string> = {
  cin_decode: "Company identifier (CIN) is malformed",
  registry_exists: "Company is not in the MCA registry",
  cin_vs_registry: "Documents do not match the registry record",
  company_status_active: "Company is not active on the registry",
  nic_is_manufacturing: "Registered activity is trade, not manufacturing",
  gstin_checksum: "GST number fails its checksum",
  gstin_state_matches_claim: "GST state does not match the documents",
  gstin_embedded_pan: "PAN inside the GST number does not fit",
  cert_date_after_incorporation: "Certificate predates the company's incorporation",
  ship_date_after_mfg_date: "Shipped before it was manufactured",
  receive_date_after_ship_date: "Received before it was dispatched",
  dispatch_state_matches_origin: "Dispatched from a different state than the supplier's",
  bis_licence_valid: "BIS licence does not match this holder",
  tac_within_5_years: "Type approval has lapsed or is misdated",
  lot_code_grammar: "Lot code does not follow the OEM format",
  spec_matches_oem_sheet: "Part specification differs from the OEM sheet",
  eway_validity_vs_distance: "E-way bill validity does not fit the distance",
  hsn_matches_part: "HSN code does not match the part",
  successor_registry_lookup: "Named successor is absent from the registry",
  dossier_reuse: "This exact paperwork has been presented before",
  lot_code_collision: "This lot code already carries a different paper trail",
  entry_port_mode_consistent: "Entry port does not match the transport mode",
  route_distance_sanity: "Claimed route distance is implausible",
  cross_doc_field_drift: "Fields differ across documents",
  injection_screen: "A document tried to instruct the reviewer",
};

/** Label for a finding in its own outcome: what went wrong when it
 *  contradicts, otherwise the claim it confirmed or could not assess. */
export function findingLabel(f: Finding): string {
  if (f.direction === "supports_suspect") return FAIL_LABELS[f.check] ?? `${checkLabel(f.check)}: contradicted`;
  return checkLabel(f.check);
}

/** Backend sentences sometimes quote a check identifier in brackets; swap
 *  it for the human label so the vocabulary stays consistent on screen. */
export function humanize(text: string): string {
  return text.replace(/\b([a-z]+(?:_[a-z0-9]+)+)\b/g, (m) => (CHECK_LABELS[m] ? CHECK_LABELS[m].toLowerCase() : m));
}

/** First sentence of a detail string, for use as a headline. */
export function firstSentence(s: string): string {
  const m = s.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : s;
}

export const SOURCE_LABELS: Record<SourceTier, string> = {
  authoritative: "MCA registry",
  derived: "Computed",
  self_reported: "Stated in dossier",
  heuristic: "Pattern",
};

export const STRENGTH_LABELS: Record<Strength, string> = {
  dispositive: "Decisive",
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
};

export const STRENGTH_RANK: Record<Strength, number> = { dispositive: 3, strong: 2, moderate: 1, weak: 0 };
export const TIER_RANK: Record<SourceTier, number> = { authoritative: 3, derived: 2, self_reported: 1, heuristic: 0 };

export const GROUPS: { key: Dimension; name: string; description: string }[] = [
  { key: "identity", name: "Identity", description: "who the supplier is, per the MCA registry and GSTN" },
  { key: "certification", name: "Certification", description: "certificates, BIS licence, type approval, specification" },
  { key: "custody", name: "Custody", description: "dates, distances and geography of the shipment" },
  { key: "provenance", name: "Provenance", description: "lot codes, cross-document consistency, tampering" },
];

export type ResultKind = "supports" | "contradicts" | "none";

export function resultKind(f: Finding): ResultKind {
  if (f.direction === "supports_suspect") return "contradicts";
  if (f.direction === "supports_genuine") return "supports";
  return "none";
}

export const RESULT_LABELS: Record<ResultKind, string> = {
  supports: "Supports",
  contradicts: "Contradicts",
  none: "No signal",
};

/** Consequence order: contradictions first (strongest, most authoritative
 *  first), then support, then findings with no signal. */
export function byConsequence(a: Finding, b: Finding): number {
  const order: Record<ResultKind, number> = { contradicts: 0, supports: 1, none: 2 };
  const ka = order[resultKind(a)];
  const kb = order[resultKind(b)];
  if (ka !== kb) return ka - kb;
  const sa = STRENGTH_RANK[a.strength] * 10 + TIER_RANK[a.source_tier];
  const sb = STRENGTH_RANK[b.strength] * 10 + TIER_RANK[b.source_tier];
  return sb - sa;
}

/** Split the suspect findings into the ones that decided the verdict and the
 *  weaker signals that only colour it. Mirrors the governance floor in
 *  verdict.py: strong-or-better from a non-pattern source, or any decisive. */
export function splitEvidence(findings: Finding[]) {
  const suspect = findings.filter((f) => f.direction === "supports_suspect").sort(byConsequence);
  const primary = suspect.filter((f) => f.strength === "dispositive" || (STRENGTH_RANK[f.strength] >= 2 && f.source_tier !== "heuristic"));
  const weaker = suspect.filter((f) => !primary.includes(f));
  const support = findings.filter((f) => f.direction === "supports_genuine").sort(byConsequence);
  return { suspect, primary, weaker, support };
}

/** Match a reasoner contradiction to a ledger finding, consuming each once. */
export function pairReasoning(findings: Finding[], reasoning: AnalysisResult["reasoning"]): Map<Finding, Contradiction> {
  const out = new Map<Finding, Contradiction>();
  if (!reasoning) return out;
  const pool = [...reasoning.contradictions];
  for (const f of findings) {
    if (f.direction !== "supports_suspect") continue;
    let i = pool.findIndex((c) => c.topic === `${f.check}: ${f.assertion}`);
    if (i === -1) i = pool.findIndex((c) => c.topic.startsWith(f.check));
    if (i !== -1) {
      out.set(f, pool[i]);
      pool.splice(i, 1);
    }
  }
  return out;
}

export function rulingLabel(f: Finding, c: Contradiction): { text: string; cls: string } {
  if (c.resolved_direction === "unresolved") return { text: "Unresolved", cls: "chip-unv" };
  if (c.resolved_direction === f.direction) return { text: "Upheld", cls: "chip-sus" };
  return { text: "Overridden", cls: "chip-gen" };
}

export const SUBTYPE_LABELS: Record<Exclude<Subtype, null>, string> = {
  missing: "A decisive record is missing",
  inaccessible: "A record cannot be reached offline",
  contradictory: "Official records contradict each other",
  insufficient: "Not enough evidence to certify the goods",
};

export const VERDICT_STYLE: Record<Verdict, { word: string; bar: string; tint: string; chip: string }> = {
  GENUINE: {
    word: "text-emerald-600 dark:text-emerald-400",
    bar: "border-emerald-500",
    tint: "from-emerald-50 dark:from-emerald-950/40",
    chip: "chip-gen",
  },
  SUSPECT: {
    word: "text-rose-600 dark:text-rose-400",
    bar: "border-rose-500",
    tint: "from-rose-50 dark:from-rose-950/40",
    chip: "chip-sus",
  },
  UNVERIFIABLE: {
    word: "text-amber-600 dark:text-amber-400",
    bar: "border-amber-500",
    tint: "from-amber-50 dark:from-amber-950/40",
    chip: "chip-unv",
  },
};

/** One generic, evidence-based summary sentence describing why the verdict was reached. */
export function verdictSentence(r: AnalysisResult): string {
  const { primary, suspect, support } = splitEvidence(r.ledger.findings);
  const decisive = primary.filter((f) => f.strength === "dispositive").length;
  const strong = primary.length - decisive;
  const totalVerified = r.counts.supports_genuine || support.length;

  if (r.verdict === "GENUINE") {
    return `Documentary support: ${totalVerified} checks support the submitted claims within the records available to this system, with no governing contradiction.`;
  }
  if (r.verdict === "SUSPECT") {
    const parts: string[] = [];
    if (strong) parts.push(`${strong} strong`);
    if (decisive) parts.push(`${decisive} decisive`);
    const qual = parts.length ? ` (${parts.join(" and ")})` : "";
    return `Suspect documentation: ${suspect.length} check${suspect.length === 1 ? "" : "s"} expose${suspect.length === 1 ? "s" : ""} unresolved record or rule inconsistencies${qual}.`;
  }
  return "Unverifiable documentation: Mandatory supply-chain records are missing or unconfirmed in the current dossier.";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
