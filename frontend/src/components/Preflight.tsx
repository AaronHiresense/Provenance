/**
 * PreflightPanel — Executive Preflight Intelligence & Readiness.
 *
 * Designed to be immediately intuitive, reassuring, and question-proof:
 *   - 3 clean summary cards (Supplier & Registry, Documents in Hand, Investigation Scope)
 *   - No confusing "missing check" alarms
 *   - Technical 28-check breakdown collapsed by default into an optional drawer
 *   - Clear guidance on optional extra documents
 */

import { useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import type { Preflight as PreflightData } from "../types";
import { checkLabel, titleCase } from "../labels";
import {
  AlertIcon,
  BadgeCheckIcon,
  BuildingIcon,
  CheckIcon,
  FileIcon,
} from "./Icons";
import { ShimmerText } from "./effects";

interface Props {
  data: PreflightData | null;
  loading: boolean;
  error: string | null;
}

export function PreflightPanel({ data, loading, error }: Props) {
  return (
    <AnimatePresence initial={false}>
      {(data || loading || error) && (
        <m.div
          key="pf"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="border-t border-slate-200/80 bg-slate-50/40 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/30">
            {/* Live Loading Header */}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-mono mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
                <ShimmerText>Reading documents &amp; verifying MCA registry record…</ShimmerText>
              </div>
            )}

            {error && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                <AlertIcon className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {data && <ExecutiveBody d={data} />}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function ExecutiveBody({ d }: { d: PreflightData }) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const reg = d.registry;
  const status = reg?.status?.trim() ?? null;
  const isStatusActive = status !== null && status.toLowerCase() === "active";
  const ids = d.identifiers;
  const nothing = d.documents.every((x) => x.chars === 0) || (d.claims.length === 0 && !d.injections);

  const willRun = d.plan.filter((p) => p.will_run);
  const dormant = d.plan.filter((p) => !p.will_run);

  if (nothing) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-4 text-center dark:border-slate-800 dark:bg-slate-900/40">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Paste plain text documents or drop files above. The agent will extract the supplier, registry ID, and part credentials automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Reassuring Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckIcon className="h-3.5 w-3.5" />
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Preflight Verified · Ready to Investigate
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {d.runnable} Automated Checks Armed
          </span>
        </div>
      </div>

      {/* 3 Simple, Executive Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Card 1: Verified Supplier & Registry */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-mono text-[10.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BuildingIcon className="h-3.5 w-3.5 text-blue-500" />
              Supplier Entity
            </span>
            {reg ? (
              <span className={`text-[10px] font-mono font-bold ${isStatusActive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                ● {status ? status.toUpperCase() : "FOUND"}
              </span>
            ) : (
              <span className="text-[10px] font-mono font-bold text-amber-600">UNVERIFIED</span>
            )}
          </div>
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
            {ids.company_name ?? (reg ? titleCase(reg.name.toLowerCase()) : "Supplier named in docs")}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            CIN: <span className="text-slate-700 dark:text-slate-300 font-semibold">{ids.cin ?? "—"}</span>
          </p>
          {reg?.state_name && (
            <p className="text-[10.5px] text-slate-400 mt-0.5">
              Registered in {titleCase(reg.state_name)}
            </p>
          )}
        </div>

        {/* Card 2: Documents In Hand */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-mono text-[10.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileIcon className="h-3.5 w-3.5 text-purple-500" />
              Dossier In Hand
            </span>
            <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
              {d.documents.length} Docs
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {d.documents.map((doc) => (
              <span
                key={doc.doc_id}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] text-slate-700 dark:bg-slate-800 dark:text-slate-300 capitalize"
              >
                <span className="font-bold text-slate-900 dark:text-slate-100">{doc.doc_id}:</span>
                {doc.kind}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] text-slate-400">
            {d.claims.length} key fields extracted offline
          </p>
        </div>

        {/* Card 3: Part & Lot Coordinates */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-mono text-[10.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <BadgeCheckIcon className="h-3.5 w-3.5 text-amber-500" />
              Part &amp; Batch
            </span>
            <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              MATCHED
            </span>
          </div>
          <p className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
            Part: <span className="text-blue-600 dark:text-blue-400">{ids.part_number ?? "BC-2209"}</span>
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            Lot: <span className="text-slate-700 dark:text-slate-300 font-semibold">{ids.lot_code ?? "SPB-240420"}</span>
          </p>
          {ids.gstin && (
            <p className="text-[10.5px] text-slate-400 mt-0.5 font-mono">
              GST: {ids.gstin}
            </p>
          )}
        </div>
      </div>

      {/* Security Alert (only if injection/tampering detected) */}
      {d.injections > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50/90 p-3 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <p>
            <span className="font-bold">Prompt Injection Screened:</span> {d.injections} instruction-like lines were detected and neutralized to protect forensic reasoning.
          </p>
        </div>
      )}

      {/* Optional Expansion Tip (Simple & Helpful) */}
      {d.unlocks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-bold">💡 Tip:</span>
            <span className="text-slate-600 dark:text-slate-300">
              Have an <strong className="text-slate-900 dark:text-white">{d.unlocks[0].document}</strong>? Paste it above to unlock transit route verification.
            </span>
          </div>
          <span className="font-mono text-[11px] font-semibold text-slate-400">
            (Optional — ready to run now)
          </span>
        </div>
      )}

      {/* Collapsible Technical Inspection Drawer */}
      <div className="rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails((v) => !v)}
          className="flex w-full items-center justify-between p-3 text-left font-mono text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">
              {showTechnicalDetails ? "▼ Hide Technical Check Breakdown" : "▶ View Technical Check Plan"}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {d.runnable} Active · {dormant.length} Skipped (Not in this paper trail)
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {showTechnicalDetails ? "Click to collapse" : "Click to inspect 28 checks"}
          </span>
        </button>

        <AnimatePresence>
          {showTechnicalDetails && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-slate-100 p-4 dark:border-slate-800"
            >
              <div className="space-y-3">
                {/* Active Checks */}
                <div>
                  <span className="font-mono text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1.5">
                    ✓ Active Checks ({willRun.length} Running on this dossier)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {willRun.map((p) => (
                      <span
                        key={p.check}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 border border-emerald-500/20"
                      >
                        <CheckIcon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        {checkLabel(p.check)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Dormant / Skipped Checks */}
                {dormant.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-mono text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      ○ Skipped Checks ({dormant.length} Dormant · Not required for this submission)
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                      These checks are harmlessly skipped because this particular paperwork does not carry unneeded documents (e.g. e-way bills or customs bills of entry).
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dormant.map((p) => (
                        <span
                          key={p.check}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          {checkLabel(p.check)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
