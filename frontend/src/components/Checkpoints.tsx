import { useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import type { AnalysisResult } from "../types";
import { DESKS, type Desk, type LotStatus, type RunRecord } from "../history";
import { splitEvidence, findingLabel, titleCase } from "../labels";
import { BuildingIcon, CheckIcon, CopyIcon, TruckIcon, UserIcon } from "./Icons";
import { Section } from "./Section";

interface Props {
  result: AnalysisResult;
  desk: Desk;
  onDesk?: (d: Desk) => void;
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

const DESK_CONFIG: Record<
  Desk,
  {
    name: string;
    subtitle: string;
    icon: typeof TruckIcon;
    tint: string;
    badgeCls: string;
    borderCls: string;
    mandate: string;
  }
> = {
  distributor: {
    name: "Distributor Desk",
    subtitle: "Goods Inward & Commercial Quarantine",
    icon: TruckIcon,
    tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    badgeCls: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300",
    borderCls: "border-blue-500/80 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/10",
    mandate: "Quarantine inventory, freeze supplier disbursement in ERP, issue formal debit notice & request verified e-way bills.",
  },
  oem: {
    name: "OEM Brand Protection",
    subtitle: "Counterfeit Interception & Legal Seizure",
    icon: BuildingIcon,
    tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    badgeCls: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300",
    borderCls: "border-purple-500/80 ring-2 ring-purple-500/20 bg-purple-50/20 dark:bg-purple-950/10",
    mandate: "Prepare statutory enforcement dossier under Section 103 Trademark Act, request physical sample seizure & initiate FIR legal action.",
  },
  service: {
    name: "Showroom & Service",
    subtitle: "Workshop Safety & Warranty Rejection",
    icon: UserIcon,
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    badgeCls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300",
    borderCls: "border-emerald-500/80 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10",
    mandate: "Flag affected job cards (Do Not Fit) in DMS, reject warranty reimbursement claim and protect workshop technician safety.",
  },
};

function supplierName(r: AnalysisResult): string {
  return r.registry_row ? titleCase(r.registry_row.name.toLowerCase()) : "the supplier";
}

function draftRequest(r: AnalysisResult): string {
  const s = supplierName(r);
  const cin = r.registry_row?.cin ?? "(CIN not found)";
  return [
    `Subject: Document request before release of lot ${r.case_id}`,
    "",
    `Dear ${s},`,
    "",
    "We are verifying the paperwork for the lot below before it can proceed.",
    `Supplier: ${s} · CIN ${cin}`,
    "",
    "One decisive document is required:",
    `  ${r.missing_artefact ?? "the missing record named in our review"}`,
    "",
    `Until it arrives: ${r.interim_action ?? "the lot stays on hold."}`,
    "",
    "Please send a certified copy at your earliest convenience and we will re-run the verification the same day.",
    "",
    "Regards,",
    "Provenance Verification Desk",
  ].join("\n");
}

function draftHold(r: AnalysisResult): string {
  const { primary } = splitEvidence(r.ledger.findings);
  const s = supplierName(r);
  const lines = primary.slice(0, 4).map((f) => `  - ${findingLabel(f)}`);
  return [
    `Subject: Lot ${r.case_id} quarantined pending forensic verification`,
    "",
    `Dear ${s},`,
    "",
    "Our document verification found that the paperwork for this lot contradicts official records:",
    ...lines,
    "",
    "The physical lot is quarantined in ERP and commercial payment is frozen until these items are resolved.",
    "Please provide the originals and an explanation for each item.",
    "",
    "Regards,",
    "Goods Inward & Quarantine Desk",
  ].join("\n");
}

function draftReferral(r: AnalysisResult): string {
  const { primary, suspect } = splitEvidence(r.ledger.findings);
  const s = supplierName(r);
  return [
    `Brand-Protection Statutory Referral: Lot ${r.case_id}`,
    "",
    `Supplier: ${s} · CIN ${r.registry_row?.cin ?? "n/a"} · Registry Status ${r.registry_row?.status ?? "unknown"}`,
    `Verdict: ${r.verdict}${r.subtype ? ` (${r.subtype})` : ""} · ${suspect.length} of ${r.ledger.findings.length} checks contradict official records`,
    "",
    "Decisive Contradictions:",
    ...primary.map((f) => `  - ${findingLabel(f)}: ${f.detail}`),
    "",
    "Action Requested: Physical sample seizure for metallurgical testing and legal review under Trade Marks Act Section 103.",
  ].join("\n");
}

function draftWarrantyReject(r: AnalysisResult): string {
  const s = supplierName(r);
  return [
    `Workshop & Warranty Alert: Do Not Fit Lot ${r.case_id}`,
    "",
    `Supplier: ${s} · CIN ${r.registry_row?.cin ?? "n/a"}`,
    `Verdict: ${r.verdict} · Provenance verification failed.`,
    "",
    "Directives for Dealership & Service Workshops:",
    "  1. Freeze job cards associated with this lot batch code.",
    "  2. Do not fit part to customer vehicles.",
    "  3. Reject warranty reimbursement claims for this lot number.",
    "  4. Segregate parts in physical red-bin quarantine.",
  ].join("\n");
}

function draftArchive(r: AnalysisResult): string {
  return [
    `Provenance Certified Audit Record`,
    `Lot: ${r.case_id}`,
    `Supplier: ${supplierName(r)} · CIN ${r.registry_row?.cin ?? "n/a"}`,
    `Verdict: ${r.verdict} · ${r.counts.supports_genuine} checks support, ${r.counts.supports_suspect} contradict`,
    `Registry Snapshot: 2026-07-22 · Verification Mode: ${r.rules_only ? "Deterministic Rules" : "Full 5-Stage Pipeline"}`,
    `Recorded: ${new Date().toISOString()}`,
  ].join("\n");
}

/**
 * Returns ONLY the specific moves tailored for the selected operational desk.
 */
function dedicatedMovesFor(r: AnalysisResult, desk: Desk): Move[] {
  if (r.verdict === "SUSPECT") {
    if (desk === "distributor") {
      return [
        {
          key: "quarantine",
          label: "Mark lot quarantined in ERP",
          detail: "Freezes lot disbursement and records hold in inventory ledger.",
          status: "quarantined",
          primary: true,
        },
        {
          key: "hold",
          label: "Draft supplier debit & hold notice",
          detail: "Formal commercial notice citing specific contradictory findings.",
          draft: () => draftHold(r),
          primary: true,
        },
      ];
    }
    if (desk === "oem") {
      return [
        {
          key: "refer",
          label: "Submit brand-protection legal referral",
          detail: "Initiates statutory review and logs serial in OEM counterfeit repository.",
          status: "referred",
          primary: true,
        },
        {
          key: "legal_dossier",
          label: "Draft statutory referral dossier",
          detail: "Complete evidence summary for Trademark Act Section 103 seizure & police FIR.",
          draft: () => draftReferral(r),
          primary: true,
        },
      ];
    }
    // Showroom & Service
    return [
      {
        key: "nofit",
        label: "Flag affected job cards (Do Not Fit)",
        detail: "Locks batch in Dealer Management System (DMS) to prevent vehicle fitment.",
        status: "quarantined",
        primary: true,
      },
      {
        key: "warranty_reject",
        label: "Draft warranty rejection notice",
        detail: "Technical memo rejecting reimbursement and ordering red-bin segregation.",
        draft: () => draftWarrantyReject(r),
        primary: true,
      },
    ];
  }

  if (r.verdict === "UNVERIFIABLE") {
    return [
      {
        key: "request",
        label: "Draft missing document request",
        detail: `Requests ${r.missing_artefact ?? "decisive missing document"} from supplier.`,
        draft: () => draftRequest(r),
        primary: true,
      },
      {
        key: "await",
        label: "Hold lot & await document",
        detail: "Places lot in pending status until fresh paperwork is supplied.",
        status: "awaiting",
      },
    ];
  }

  // GENUINE
  return [
    {
      key: "release",
      label: desk === "service" ? "Authorize workshop vehicle fitment" : "Release lot to active inventory",
      detail:
        desk === "service"
          ? "Authorizes technician fitment and records verified lot code on job card."
          : "Releases lot to active distribution channels with digital provenance passport.",
      status: "released",
      primary: true,
    },
    {
      key: "archive",
      label: "Generate certified audit certificate",
      detail: "Creates an immutable provenance audit record of all passed checks.",
      draft: () => draftArchive(r),
    },
  ];
}

export function Checkpoints({ result, desk, onDesk, record, onStatus }: Props) {
  const activeCfg = DESK_CONFIG[desk];
  const ActiveIcon = activeCfg.icon;
  const moves = dedicatedMovesFor(result, desk);
  const [openDraft, setOpenDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const otherDesks = DESKS.filter((d) => d.key !== desk);

  return (
    <Section
      title="Operational Action & Playbook Center"
      aside={
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-slate-400">Desk Focus:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{activeCfg.name}</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* ── 1. SEGMENTED DESK SELECTOR & ACTIVE PLAYBOOK HERO ────────── */}
        <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          {/* Top Segmented Tab Switcher */}
          {onDesk && (
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-950/40">
              <span className="px-3 font-mono text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Operating Desk Focus:
              </span>
              <div className="flex items-center gap-1">
                {DESKS.map((d) => {
                  const cfg = DESK_CONFIG[d.key];
                  const Icon = cfg.icon;
                  const isCur = desk === d.key;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => onDesk(d.key)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        isCur
                          ? "bg-white text-slate-900 shadow-xs ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{cfg.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Desk Hero Body */}
          <div className="p-5 sm:p-6 space-y-4">
            {/* Header with Mandate */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${activeCfg.tint}`}>
                  <ActiveIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {activeCfg.name} Playbook
                    </h3>
                    <span className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-full ${activeCfg.badgeCls}`}>
                      Primary Directives
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    {activeCfg.mandate}
                  </p>
                </div>
              </div>
            </div>

            {/* Focused Action Cards for this specific Desk */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 pt-1">
              {moves.map((mv) => {
                const done = mv.status && record?.status === mv.status;
                const isOpen = openDraft === mv.key;
                return (
                  <div
                    key={mv.key}
                    className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-2xs transition-all ${
                      mv.primary
                        ? activeCfg.borderCls
                        : "border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100">
                          {mv.label}
                        </span>
                        {done && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] font-bold text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 dark:text-emerald-400 shrink-0">
                            <CheckIcon className="h-3 w-3" /> Done
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {mv.detail}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      {mv.status && !done && (
                        <button
                          type="button"
                          className="btn btn-primary cursor-pointer text-xs"
                          onClick={() =>
                            onStatus(
                              mv.status!,
                              mv.status === "awaiting" ? result.missing_artefact ?? undefined : undefined
                            )
                          }
                        >
                          {mv.status === "awaiting"
                            ? "Hold & Wait"
                            : mv.status === "released"
                            ? "Confirm Release"
                            : mv.status === "referred"
                            ? "Confirm Referral"
                            : "Execute Quarantine"}
                        </button>
                      )}
                      {mv.draft && (
                        <button
                          type="button"
                          className="btn cursor-pointer text-xs"
                          onClick={() => setOpenDraft(isOpen ? null : mv.key)}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? "Close Notice Preview" : "View & Copy Draft Notice"}
                        </button>
                      )}
                    </div>

                    {/* Expandable Draft Communication Box */}
                    <AnimatePresence initial={false}>
                      {mv.draft && isOpen && (
                        <m.div
                          key="draft"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 p-3 space-y-2">
                            <pre className="max-h-64 overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                              {mv.draft()}
                            </pre>
                            <div className="flex justify-end pt-1 border-t border-slate-200/60 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => copy(mv.key, mv.draft!())}
                                className="inline-flex items-center gap-1 font-mono text-[10.5px] font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                              >
                                <CopyIcon className="h-3.5 w-3.5" />
                                {copied === mv.key ? "Copied to clipboard!" : "Copy Notice Text"}
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
          </div>
        </div>

        {/* ── 2. CROSS-FUNCTIONAL VISIBILITY STRIP (OTHER DESKS) ────────── */}
        {onDesk && otherDesks.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2.5">
              Cross-Functional Desk Perspectives (Click to Switch Focus)
            </span>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {otherDesks.map((d) => {
                const cfg = DESK_CONFIG[d.key];
                const Icon = cfg.icon;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => onDesk(d.key)}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-white p-3 text-left transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60 cursor-pointer group"
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.tint}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {cfg.name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 group-hover:translate-x-0.5 transition-transform">
                          Switch →
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {cfg.subtitle} · {result.actions[d.key]}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
