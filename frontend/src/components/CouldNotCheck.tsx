import { useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import type { AnalysisResult } from "../types";
import { checkLabel } from "../labels";
import { ChevronIcon, FileIcon, InfoIcon, ShieldAlertIcon } from "./Icons";
import { Section } from "./Section";

/** The backend ships standing limits with every verdict plus case-specific ones.
 *
 *  Redesigned as a clear Forensic Scope & Unverified Claims Disclosure
 *  so evaluators and auditors understand the boundaries of offline verification.
 */
export function CouldNotCheck({ result: r }: { result: AnalysisResult }) {
  const [showStanding, setShowStanding] = useState(false);
  const [showClaims, setShowClaims] = useState(false);
  const caseLines = r.ledger.findings.filter((f) => /abstain|unavailable/.test(f.result.toLowerCase()));
  const standing = r.cannot_determine.filter((x) => !x.startsWith("In this case"));
  const unchecked = r.unchecked_claims ?? [];

  return (
    <Section
      title="Audit Scope & Unverified Claims Disclosure"
      aside={
        caseLines.length || unchecked.length ? (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-slate-400">Boundary Notice:</span>
            <span className="font-bold text-amber-700 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full dark:text-amber-300">
              {caseLines.length} Abstaining · {unchecked.length} Unverified Field{unchecked.length === 1 ? "" : "s"}
            </span>
          </div>
        ) : (
          <span className="chip chip-gen">100% Scope Signal Coverage</span>
        )
      }
    >
      <div className="space-y-3.5 text-[13px]">
        {/* ── 1. SCOPE BOUNDARY WARNING NOTICE ────────────────────────────── */}
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldAlertIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                Forensic Boundary & Transparency Notice
              </span>
              <p className="text-amber-950/90 dark:text-amber-200 leading-relaxed">
                The items below represent extracted claims or checks where no third-party offline registry database exists. 
                They are cross-checked for internal document consistency, but are explicitly disclosed as <strong>unverified against external authorities</strong> so they are never mistaken for certified approvals.
              </p>
            </div>
          </div>
        </div>

        {/* ── 2. CASE-SPECIFIC ABSTAINING CHECKS (NO SIGNAL) ──────────────── */}
        {caseLines.length > 0 && (
          <div className="space-y-2">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Abstaining Checks (Specific to this Lot)
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {caseLines.map((f, i) => (
                <div
                  key={i}
                  className="flex flex-col justify-between gap-1.5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {checkLabel(f.check)}
                    </span>
                    <span className="chip chip-neu shrink-0 text-[10px]">No Signal</span>
                  </div>
                  <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {f.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 3. EXTRACTED CLAIMS NOT VERIFIED AGAINST OUTSIDE REGISTRY ───── */}
        {unchecked.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setShowClaims((v) => !v)}
              className="w-full border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40 flex items-center justify-between text-left cursor-pointer"
              aria-expanded={showClaims}
            >
              <div className="flex items-center gap-2">
                <FileIcon className="h-4 w-4 text-slate-500" />
                <div>
                  <span className="font-mono text-[11.5px] font-bold text-slate-800 dark:text-slate-200 block">
                    {unchecked.length} Extracted Document Fields (Cross-Doc Consistency Checked)
                  </span>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block font-mono">
                    Parsed from uploaded paperwork · no third-party offline database
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded font-semibold">
                  {showClaims ? "Hide Fields" : "View Fields"}
                </span>
                <ChevronIcon open={showClaims} className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </button>

            <AnimatePresence initial={false}>
              {showClaims && (
                <m.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {unchecked.map((c, i) => (
                        <div
                          key={i}
                          className="flex flex-col justify-between gap-1 rounded-xl border border-slate-200/70 bg-slate-50/40 p-2.5 dark:border-slate-800 dark:bg-slate-950/30"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                              {c.attribute.replace(/_/g, " ")}
                            </span>
                            <span className="font-mono text-[9.5px] text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
                              {c.source_doc}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">
                            {c.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-800">
                      * Note: These values were read from the submitted paperwork and checked for consistency across documents, but have no live offline registry to verify against.
                    </p>
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── 4. STANDING LIMITS ACCORDION (10 INHERENT AUDIT LIMITS) ─────── */}
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/40 p-3.5 dark:border-slate-800 dark:bg-slate-950/20">
          <button
            type="button"
            onClick={() => setShowStanding((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
            aria-expanded={showStanding}
          >
            <div className="flex items-center gap-2">
              <InfoIcon className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Standing Inherent Limitations of Offline Verification ({standing.length} Inherent Bounds)
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
              <span>{showStanding ? "Hide" : "Expand limits"}</span>
              <ChevronIcon open={showStanding} className="h-3.5 w-3.5" />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {showStanding && (
              <m.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800">
                  <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs text-slate-600 dark:text-slate-400">
                    {standing.map((x, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 rounded-lg bg-white p-2.5 border border-slate-200/60 dark:bg-slate-900 dark:border-slate-800"
                      >
                        <span className="font-mono text-[10px] font-bold text-slate-400 mt-0.5">
                          #{i + 1}
                        </span>
                        <span className="leading-relaxed">{x}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Section>
  );
}

