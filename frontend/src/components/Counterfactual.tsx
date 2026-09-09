import { useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import type { AnalysisResult } from "../types";
import { checkLabel } from "../labels";
import { AlertIcon, CheckCircleIcon, RefreshIcon, ShieldAlertIcon, ShieldIcon } from "./Icons";
import { Section } from "./Section";

/** What would have to be different for the answer to be different.
 *
 *  Interactive What-If Stress Testing Laboratory:
 *  Allows users and presenters to simulate the removal of load-bearing findings
 *  in real time, visualizing how the deterministic governance rules pivot.
 */
export function Counterfactual({ result: r }: { result: AnalysisResult }) {
  const cf = r.counterfactual;
  if (!cf) return null;
  const decisive = cf.decisive;

  // Struck-out finding indexes for the interactive simulation
  const [simulatedRemoved, setSimulatedRemoved] = useState<number | null>(null);

  const toggleSimulate = (idx: number) => {
    setSimulatedRemoved((prev) => (prev === idx ? null : idx));
  };

  const activeSimulation = simulatedRemoved !== null ? decisive[simulatedRemoved] : null;

  return (
    <Section
      title="What-If Stress Testing & Sensitivity Analysis"
      badge="STAGE 05 · SENSITIVITY LAB"
      subtitle="Deterministic counterfactual testing: isolating load-bearing findings where removing one observation pivots the verdict"
      tint="purple"
      icon={ShieldAlertIcon}
      aside={
        decisive.length ? (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-slate-400">Sensitivity Index:</span>
            <span className="font-bold text-purple-700 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full dark:text-purple-300">
              {decisive.length} Load-Bearing Anchor{decisive.length === 1 ? "" : "s"}
            </span>
          </div>
        ) : (
          <span className="chip chip-gen">Fortified Ledger · 0 Single Points of Failure</span>
        )
      }
    >
      <div className="space-y-4">
        {/* ── 1. EXPLANATORY HEADER & SENSITIVITY METRIC ──────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/30 text-xs">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Deterministic Counterfactual Analysis (Stage 5 Isolation)
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {cf.note}
            </p>
          </div>

          {decisive.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Click any pillar to simulate removal:
              </span>
              {simulatedRemoved !== null && (
                <button
                  type="button"
                  onClick={() => setSimulatedRemoved(null)}
                  className="flex items-center gap-1 font-mono text-[10.5px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 px-2 py-1 rounded bg-blue-500/10 cursor-pointer"
                >
                  <RefreshIcon className="h-3 w-3" /> Reset
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── 2. INTERACTIVE LOAD-BEARING PILLARS ──────────────────────────── */}
        {decisive.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {decisive.map((d, i) => {
              const isStruck = simulatedRemoved === i;
              return (
                <div
                  key={i}
                  onClick={() => toggleSimulate(i)}
                  className={`group relative flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer ${
                    isStruck
                      ? "border-amber-500/80 ring-2 ring-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20"
                      : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                            isStruck
                              ? "bg-amber-500 text-white"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {isStruck ? <AlertIcon className="h-4 w-4" /> : <ShieldIcon className="h-4 w-4" />}
                        </div>
                        <span
                          className={`text-[13.5px] font-bold transition-all ${
                            isStruck
                              ? "line-through text-slate-400 dark:text-slate-500"
                              : "text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                          }`}
                        >
                          {checkLabel(d.check)}
                        </span>
                      </div>

                      <span className="chip chip-src shrink-0">
                        {d.source_tier} · {d.strength}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      Remove this one observation and the verdict flips to:{" "}
                      <strong className="font-bold text-slate-950 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">
                        {d.becomes}
                      </strong>
                    </p>
                  </div>

                  {/* Interactive Toggle Switch Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 font-mono text-[11px]">
                    <span className="text-slate-400">
                      {isStruck ? "🔴 Struck Out (Simulating Loss)" : "🟢 Active in Verdict Ledger"}
                    </span>
                    <span
                      className={`font-bold transition-colors ${
                        isStruck
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                      }`}
                    >
                      {isStruck ? "Click to restore anchor ↑" : "⚡ Click to simulate strike-out →"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 text-xs text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200 flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-[13px] mb-0.5">Highly Robust & Fortified Evidence Ledger</span>
              <p className="leading-relaxed">
                {cf.note}. The evidence carries sufficient redundancy across multiple independent tiers so that removing any single observation does not shift the decision.
              </p>
            </div>
          </div>
        )}

        {/* ── 3. FLOATING SIMULATED COUNTERFACTUAL REALITY CALLOUT ─────────── */}
        <AnimatePresence>
          {activeSimulation && (
            <m.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="rounded-2xl border-2 border-amber-500/60 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 shadow-sm dark:bg-slate-900/90"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                    <ShieldAlertIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Simulated Alternative Reality
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Pillar Struck Out: <span className="font-bold underline">{checkLabel(activeSimulation.check)}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">Actual Verdict:</span>
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {r.verdict}
                      </span>
                      <span className="text-slate-400">➔</span>
                      <span className="text-xs text-slate-500">Simulated Result:</span>
                      <span className="font-mono text-xs font-bold text-rose-700 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full dark:text-rose-300">
                        {activeSimulation.becomes}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSimulatedRemoved(null)}
                  className="btn btn-primary text-xs shrink-0 cursor-pointer self-start sm:self-auto"
                >
                  Restore Actual Verdict Ledger
                </button>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* ── 4. FOOTER METHODOLOGY ───────────────────────────────────────── */}
        <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
          * {cf.method}
        </p>
      </div>
    </Section>
  );
}

