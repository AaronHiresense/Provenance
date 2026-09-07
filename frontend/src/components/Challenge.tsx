import type { AnalysisResult } from "../types";
import { checkLabel } from "../labels";

/** The agent's attack on its own draft.
 *
 *  Shown next to the verdict rather than buried with the findings, because the
 *  question it answers — "did you try to talk yourself out of this?" — is the
 *  first one a reviewer asks. A challenge can only move a verdict toward
 *  caution; that bound is enforced in code, and stated here. */
export function Challenge({ result: r }: { result: AnalysisResult }) {
  const ch = r.reasoning?.challenge;
  if (!ch || ch.engine === "skipped") return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white">It argued against its own answer</h4>
        {ch.outcome === "upheld" && <span className="chip chip-unv">the attack won · revised from {ch.from}</span>}
        {ch.outcome === "overridden" && <span className="chip chip-sus">overruled by the governance rules</span>}
        {ch.outcome === "blocked" && <span className="chip chip-neu">recorded · cannot move the verdict</span>}
        {(!ch.outcome || ch.outcome === "held") && <span className="chip chip-neu">the answer held</span>}
        {ch.engine === "deterministic_fallback" && <span className="chip chip-src">offline reasoner</span>}
      </div>

      <p className="mt-2.5 text-[13px] text-slate-700 dark:text-slate-300">
        <span className="font-medium text-slate-900 dark:text-white">The attack. </span>
        {ch.attack}
      </p>
      {ch.why && (
        <p className="mt-1.5 text-[13px] text-slate-700 dark:text-slate-300">
          <span className="font-medium text-slate-900 dark:text-white">{ch.revised ? "Why the attack landed. " : "Why the answer held. "}</span>
          {ch.why}
        </p>
      )}
      {ch.outcome === "blocked" && ch.blocked_reason && (
        <p className="mt-1.5 text-[13px] text-slate-700 dark:text-slate-300">
          <span className="font-medium text-slate-900 dark:text-white">Why it changed nothing. </span>
          {ch.blocked_reason}
        </p>
      )}
      {ch.outcome === "overridden" && ch.override_reason && (
        <p className="mt-1.5 text-[13px] text-slate-700 dark:text-slate-300">
          <span className="font-medium text-slate-900 dark:text-white">And then the code overruled it. </span>
          {ch.override_reason}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {ch.weakest_link && (
          <span>
            Leans most on <span className="font-medium text-slate-700 dark:text-slate-300">{checkLabel(ch.weakest_link)}</span>
          </span>
        )}
        {ch.decisive_artefact && <span>Settled by: {ch.decisive_artefact}</span>}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        A successful challenge may only move a verdict toward caution — never from suspicion to approval. The bound is in code, not in the prompt.
      </p>
    </div>
  );
}
