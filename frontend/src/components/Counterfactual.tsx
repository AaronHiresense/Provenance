/**
 * Counterfactual — Interactive What-If Sensitivity & Stress Testing Laboratory.
 *
 * Demonstrates deterministic governance mechanics:
 *   - Interactive load-bearing finding strike-outs
 *   - Live Before vs After Evidence Ledger Diff
 *   - Plain-English Forensic "Why It Changed" explanation
 *   - Exact Statutory Governance Rule triggers
 */

import { useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import type { AnalysisResult, CounterfactualRow, Verdict } from "../types";
import { VERDICT_STYLE, checkLabel } from "../labels";
import {
  AlertIcon,
  CheckCircleIcon,
  RefreshIcon,
  ShieldAlertIcon,
  ShieldIcon,
} from "./Icons";
import { Section } from "./Section";

interface Props {
  result: AnalysisResult;
}

function getForensicExplanation(
  actual: Verdict,
  simulated: string,
  check: string,
  counts: { supports_suspect: number; supports_genuine: number; neutral: number }
): {
  headline: string;
  detail: string;
  rule: string;
  beforeContradictions: number;
  afterContradictions: number;
} {
  const label = checkLabel(check);

  if (actual === "SUSPECT" && simulated === "GENUINE") {
    return {
      headline: "Sole Contradictory Anchor Cleared",
      detail: `Removing "${label}" eliminates the only suspect finding on the ledger. Because all remaining corporate identity, GST, and statutory certification checks remain valid (${counts.supports_genuine} supporting checks), the dossier immediately satisfies the requirements for GENUINE.`,
      rule: "Governance Rule 4: With 0 contradictions on the ledger and complete statutory baseline, the dossier qualifies for Genuine certification.",
      beforeContradictions: counts.supports_suspect,
      afterContradictions: Math.max(0, counts.supports_suspect - 1),
    };
  }

  if (actual === "SUSPECT" && simulated === "UNVERIFIABLE") {
    return {
      headline: "Violation Removed, But Incomplete Corroboration",
      detail: `Removing "${label}" clears the definitive proof of tampering or discrepancy. However, the remaining documents lack sufficient independent corroboration to certify the part as genuine, so the engine safely abstains.`,
      rule: "Governance Rule 3: Without a dispositive violation, insufficient documentary evidence escalates to UNVERIFIABLE rather than guessing.",
      beforeContradictions: counts.supports_suspect,
      afterContradictions: Math.max(0, counts.supports_suspect - 1),
    };
  }

  if (actual === "GENUINE" && simulated === "UNVERIFIABLE") {
    return {
      headline: "Critical Statutory Anchor Missing",
      detail: `"${label}" was an essential authoritative anchor (e.g. MCA active registry status or ARAI type-approval). Removing it creates an evidentiary gap, causing the governance engine to abstain rather than issue an unbacked genuine verdict.`,
      rule: "Governance Rule 1: A Genuine verdict requires an unbroken chain of authoritative statutory proofs.",
      beforeContradictions: counts.supports_suspect,
      afterContradictions: counts.supports_suspect,
    };
  }

  return {
    headline: "Decision Boundary Shifted",
    detail: `Removing "${label}" alters the balance of evidence on the ledger, causing the deterministic rules engine to pivot the outcome from ${actual} to ${simulated}.`,
    rule: "Stage 5 Governance Rules Re-evaluation",
    beforeContradictions: counts.supports_suspect,
    afterContradictions: Math.max(0, counts.supports_suspect - 1),
  };
}

export function Counterfactual({ result: r }: Props) {
  const cf = r.counterfactual;
  if (!cf) return null;
  const decisive = cf.decisive;

  // Struck-out finding indexes for interactive simulation
  const [simulatedRemoved, setSimulatedRemoved] = useState<number | null>(null);

  const toggleSimulate = (idx: number) => {
    setSimulatedRemoved((prev) => (prev === idx ? null : idx));
  };

  const activeSimulation: CounterfactualRow | null =
    simulatedRemoved !== null ? decisive[simulatedRemoved] : null;

  const simExplanation = activeSimulation
    ? getForensicExplanation(
        r.verdict,
        activeSimulation.becomes,
        activeSimulation.check,
        r.counts
      )
    : null;

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
                  className="flex items-center gap-1 font-mono text-[10.5px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 px-2.5 py-1 rounded-lg bg-blue-500/10 cursor-pointer border border-blue-500/20"
                >
                  <RefreshIcon className="h-3 w-3" /> Reset Simulation
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
              const becomesVerdict = d.becomes as Verdict;
              const becomesStyle = VERDICT_STYLE[becomesVerdict] ?? {
                bg: "bg-slate-100 dark:bg-slate-800",
                border: "border-slate-300 dark:border-slate-700",
                word: "text-slate-700 dark:text-slate-300",
                chip: "chip-neu",
              };

              return (
                <div
                  key={i}
                  onClick={() => toggleSimulate(i)}
                  className={`group relative flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer ${
                    isStruck
                      ? "border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/50 dark:bg-amber-950/30 shadow-md"
                      : "border-slate-200/90 bg-white hover:border-purple-300 hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                            isStruck
                              ? "bg-amber-500 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 group-hover:bg-purple-500/10 group-hover:text-purple-600"
                          }`}
                        >
                          {isStruck ? <AlertIcon className="h-4 w-4" /> : <ShieldIcon className="h-4 w-4" />}
                        </div>
                        <span
                          className={`text-[13.5px] font-bold transition-all ${
                            isStruck
                              ? "line-through text-slate-400 dark:text-slate-500"
                              : "text-slate-900 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400"
                          }`}
                        >
                          {checkLabel(d.check)}
                        </span>
                      </div>

                      <span className="chip chip-src shrink-0">
                        {d.source_tier} · {d.strength}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>If struck out, verdict pivots to:</span>
                      <span className={`chip ${becomesStyle.chip} font-mono font-bold text-[11px]`}>
                        {d.becomes}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Toggle Switch Bar */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800/80 font-mono text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${isStruck ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                      {isStruck ? "Struck Out (Simulating Loss)" : "Active in Actual Ledger"}
                    </span>
                    <span
                      className={`font-bold transition-colors ${
                        isStruck
                          ? "text-amber-700 dark:text-amber-400 underline"
                          : "text-purple-600 dark:text-purple-400 group-hover:text-purple-700"
                      }`}
                    >
                      {isStruck ? "Click to restore anchor ↺" : "⚡ Click to simulate removal →"}
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

        {/* ── 3. DETAILED BEFORE VS AFTER FORENSIC IMPACT PANEL ─────────── */}
        <AnimatePresence>
          {activeSimulation && simExplanation && (
            <m.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="rounded-2xl border-2 border-amber-500/70 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent p-5 shadow-md dark:border-amber-500/60 dark:bg-slate-900/95 space-y-4"
            >
              {/* Header Title & Restore Button */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-amber-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                    <ShieldAlertIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                      Simulated Alternative Reality · Forensic Impact Analysis
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Simulating hypothetical removal of: <strong className="text-slate-900 dark:text-slate-100 underline">{checkLabel(activeSimulation.check)}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSimulatedRemoved(null)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 font-mono text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 cursor-pointer"
                >
                  <RefreshIcon className="h-3 w-3" /> Restore Actual Ledger
                </button>
              </div>

              {/* Before vs After Comparison Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Before Box (Actual) */}
                <div className="rounded-xl border border-slate-200 bg-white/90 p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-950/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                      Actual Baseline State
                    </span>
                    <span className="chip chip-sus font-mono font-bold text-[11px]">
                      {r.verdict}
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Contradictions on Ledger:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">{simExplanation.beforeContradictions}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Supporting Findings:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{r.counts.supports_genuine}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                    Includes active finding: <span className="font-semibold text-slate-700 dark:text-slate-300">{checkLabel(activeSimulation.check)}</span>
                  </p>
                </div>

                {/* After Box (Simulated Shift) */}
                <div className="rounded-xl border border-amber-500/40 bg-amber-50/60 p-3.5 shadow-2xs dark:border-amber-500/30 dark:bg-amber-950/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      Simulated State (If Finding Removed)
                    </span>
                    <span className={`chip ${(VERDICT_STYLE[activeSimulation.becomes as Verdict] ?? { chip: "chip-gen" }).chip} font-mono font-bold text-[11px]`}>
                      {activeSimulation.becomes}
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between text-slate-700 dark:text-slate-200">
                      <span>Contradictions on Ledger:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{simExplanation.afterContradictions} (Cleared)</span>
                    </div>
                    <div className="flex justify-between text-slate-700 dark:text-slate-200">
                      <span>Supporting Findings:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{r.counts.supports_genuine} (Retained)</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 pt-1 border-t border-amber-500/20 font-semibold">
                    Verdict flips because zero contradictory flags remain
                  </p>
                </div>
              </div>

              {/* Plain-English Forensic "Why It Changed" Callout */}
              <div className="rounded-xl border border-amber-500/30 bg-white/80 p-3.5 dark:bg-slate-950/70 space-y-1.5">
                <span className="font-mono text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>💡</span>
                  Why This Happened ({simExplanation.headline})
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {simExplanation.detail}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-start gap-2">
                  <span className="font-mono text-[10.5px] font-bold text-purple-700 dark:text-purple-400 shrink-0">
                    Governance Rule:
                  </span>
                  <span className="font-mono text-[10.5px] text-slate-600 dark:text-slate-400 leading-tight">
                    {simExplanation.rule}
                  </span>
                </div>
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
