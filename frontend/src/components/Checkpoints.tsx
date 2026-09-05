import { useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import type { AnalysisResult } from "../types";
import { DESKS, type Desk, type LotStatus, type RunRecord } from "../history";
import { splitEvidence, findingLabel, titleCase } from "../labels";
import { CheckIcon } from "./Icons";
import { Section } from "./Section";

interface Props {
  result: AnalysisResult;
  desk: Desk;
  record: RunRecord | null;
  onStatus: (status: LotStatus, awaiting?: string) => void;
}

interface Move {
  key: string;
  label: string;
  detail: string;
  status?: LotStatus;
  draft?: () => string;
  primary?: boolean;
}

function supplierName(r: AnalysisResult): string {
  return r.registry_row ? titleCase(r.registry_row.name.toLowerCase()) : "the supplier";
}

/** Deterministic drafts. The agent writes the note; the user decides whether
 *  to send it. Nothing leaves the machine. */
function draftRequest(r: AnalysisResult): string {
  const s = supplierName(r);
  const cin = r.registry_row?.cin ?? "(CIN not found)";
  return [
    `Subject: Document request before we can release lot ${r.case_id}`,
    "",
    `Dear ${s},`,
    "",
    "We are verifying the paperwork for the lot below before it can move.",
    `Supplier: ${s} · CIN ${cin}`,
    "",
    "One document decides the case:",
    `  ${r.missing_artefact ?? "the missing record named in our review"}`,
    "",
    `Until it arrives: ${r.interim_action ?? "the lot stays on hold."}`,
    "",
    "Please send a certified copy at your earliest convenience and we will re-run the verification the same day.",
    "",
    "Regards,",
    "Goods-inward desk",
  ].join("\n");
}

function draftHold(r: AnalysisResult): string {
  const { primary } = splitEvidence(r.ledger.findings);
  const s = supplierName(r);
  const lines = primary.slice(0, 4).map((f) => `  - ${findingLabel(f)}`);
  return [
    `Subject: Lot ${r.case_id} placed on hold pending verification`,
    "",
    `Dear ${s},`,
    "",
    "Our document verification found that the paperwork for this lot contradicts the official records:",
    ...lines,
    "",
    "The lot is quarantined and payment is frozen until these points are resolved. Please provide the originals and an explanation for each item.",
    "",
    "Regards,",
    "Goods-inward desk",
  ].join("\n");
}

function draftReferral(r: AnalysisResult): string {
  const { primary, suspect } = splitEvidence(r.ledger.findings);
  const s = supplierName(r);
  return [
    `Brand-protection referral: lot ${r.case_id}`,
    "",
    `Supplier: ${s} · CIN ${r.registry_row?.cin ?? "n/a"} · registry status ${r.registry_row?.status ?? "unknown"}`,
    `Verdict: ${r.verdict}${r.subtype ? ` (${r.subtype})` : ""} · ${suspect.length} of ${r.ledger.findings.length} checks contradict the records`,
    "",
    "Decisive and strong findings:",
    ...primary.map((f) => `  - ${findingLabel(f)}: ${f.detail}`),
    "",
    "Requested: physical sample of the lot for inspection and a legal review of the supplier relationship.",
  ].join("\n");
}

function draftArchive(r: AnalysisResult): string {
  return [
    `Provenance archive entry`,
    `Lot: ${r.case_id}`,
    `Supplier: ${supplierName(r)} · CIN ${r.registry_row?.cin ?? "n/a"}`,
    `Verdict: ${r.verdict} · ${r.counts.supports_genuine} checks support, ${r.counts.supports_suspect} contradict`,
    `Registry snapshot: 2026-07-22 · reasoning ${r.rules_only ? "skipped" : r.reasoning?.engine ?? "n/a"}`,
    `Recorded: ${new Date().toISOString()}`,
  ].join("\n");
}

function movesFor(r: AnalysisResult, desk: Desk): Move[] {
  if (r.verdict === "SUSPECT") {
    const base: Move[] = [
      { key: "quarantine", label: "Mark the lot quarantined", detail: "Records the hold here and freezes the lot in your recent list.", status: "quarantined", primary: desk === "distributor" },
      { key: "hold", label: "Draft the hold notice to the supplier", detail: "Lists the findings that contradict the records. You review and send.", draft: () => draftHold(r) },
      { key: "refer", label: "Draft the brand-protection referral", detail: "A summary for the OEM with the decisive evidence and a sample request.", draft: () => draftReferral(r), status: "referred", primary: desk === "oem" },
    ];
    if (desk === "service") base.unshift({ key: "nofit", label: "Do not fit; flag affected job cards", detail: "Marks the lot so it is not fitted, and reminds you to inform customers with parts already fitted.", status: "quarantined", primary: true });
    return base;
  }
  if (r.verdict === "UNVERIFIABLE") {
    return [
      { key: "request", label: "Draft the request for the missing document", detail: "Names exactly the one document that decides this case.", draft: () => draftRequest(r), primary: true },
      { key: "await", label: "Hold the lot and wait for it", detail: "Keeps this lot on the briefing screen until you paste the new paperwork; I will run it again.", status: "awaiting" },
    ];
  }
  return [
    { key: "release", label: "Release the lot", detail: desk === "service" ? "Fit normally and record the lot code against the job card." : "Release to inventory with the dossier linked to the lot code.", status: "released", primary: true },
    { key: "archive", label: "Copy the provenance archive entry", detail: "A one-paragraph record of what was checked and when.", draft: () => draftArchive(r) },
  ];
}

export function Checkpoints({ result, desk, record, onStatus }: Props) {
  const moves = movesFor(result, desk);
  const [openDraft, setOpenDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const deskLabel = DESKS.find((d) => d.key === desk)?.label ?? desk;

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked; the text is selectable */
    }
  };

  return (
    <Section title="Your next moves" aside={`For the ${deskLabel.toLowerCase()} desk · nothing is sent without you`}>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {moves.map((mv) => {
          const done = mv.status && record?.status === mv.status;
          const isOpen = openDraft === mv.key;
          return (
            <div key={mv.key} className={`flex flex-col gap-2 rounded-lg border bg-white p-3.5 dark:bg-slate-900 ${mv.primary ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 dark:border-slate-800"}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{mv.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{mv.detail}</p>
                </div>
                {done && (
                  <span className="chip chip-gen shrink-0">
                    <CheckIcon className="h-3 w-3" /> Done
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {mv.status && !done && (
                  <button type="button" className={`btn ${mv.primary && !mv.draft ? "btn-primary" : ""}`} onClick={() => onStatus(mv.status!, mv.status === "awaiting" ? (result.missing_artefact ?? undefined) : undefined)}>
                    {mv.status === "awaiting" ? "Hold and wait" : mv.status === "released" ? "Release" : mv.status === "referred" ? "Mark referred" : "Confirm"}
                  </button>
                )}
                {mv.draft && (
                  <button type="button" className={`btn ${mv.primary ? "btn-primary" : ""}`} onClick={() => setOpenDraft(isOpen ? null : mv.key)} aria-expanded={isOpen}>
                    {isOpen ? "Hide draft" : "Draft it for me"}
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {mv.draft && isOpen && (
                  <m.div key="draft" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                      <pre className="max-h-64 overflow-auto p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200">{mv.draft()}</pre>
                      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800">
                        <span>Drafted from the evidence. Edit before sending.</span>
                        <button type="button" className="font-medium text-blue-700 hover:underline dark:text-blue-400" onClick={() => void copy(mv.key, mv.draft!())}>
                          {copied === mv.key ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
