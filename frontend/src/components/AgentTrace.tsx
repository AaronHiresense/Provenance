import { useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import type { Stage } from "../types";
import type { StepState } from "../hooks/useAgentRun";
import { BorderBeam, ShimmerText, StatusDot } from "./effects";
import { ChevronIcon } from "./Icons";

const STEP_META: Record<Stage, { title: string; agent: string; blurb: string }> = {
  extract: { title: "Extraction agent", agent: "reads", blurb: "turns each document into typed claims; strips anything that tries to instruct the reviewer" },
  validate: { title: "Validators", agent: "checks", blurb: "22 deterministic checks against the MCA registry, GSTN rules and the logistics tables" },
  ledger: { title: "Evidence ledger", agent: "records", blurb: "every finding with its source, strength and dimension" },
  reason: { title: "Reasoning agent", agent: "argues", blurb: "an innocent and a forgery reading for each contradiction, resolved by tier" },
  verdict: { title: "Verdict", agent: "decides", blurb: "governance rules: authoritative beats heuristic, tiers are never averaged" },
};

interface Props {
  steps: StepState[];
  running: boolean;
  elapsedMs: number | null;
}

function duration(s: StepState): string | null {
  if (s.startedMs === undefined || s.endedMs === undefined) return null;
  return `${Math.max(0, s.endedMs - s.startedMs)} ms`;
}

export function AgentTrace({ steps, running, elapsedMs }: Props) {
  const done = !running && steps.every((s) => s.status === "done" || s.status === "skipped");
  const [open, setOpen] = useState(true);
  const expanded = running || open;
  const doneCount = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const fill = Math.max(0, doneCount - 1) / (steps.length - 1);

  return (
    <m.section className="panel relative overflow-hidden" aria-label="Agent run" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {running && <BorderBeam radius={12} />}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={expanded} disabled={running} className="flex w-full items-center gap-3 px-5 py-3.5 text-left disabled:cursor-default">
        <span className="relative flex h-2.5 w-2.5">
          {running && <m.span className="absolute inset-0 rounded-full bg-blue-500" animate={{ scale: [1, 2.2], opacity: [0.7, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }} />}
          <span className={`relative h-2.5 w-2.5 rounded-full ${running ? "bg-blue-500" : done ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
        </span>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Agent run</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {running ? <ShimmerText>{steps.find((s) => s.status === "running") ? `${STEP_META[steps.find((s) => s.status === "running")!.stage].title} ${STEP_META[steps.find((s) => s.status === "running")!.stage].agent}…` : "Starting…"}</ShimmerText> : done ? `${doneCount} steps${elapsedMs !== null ? ` · ${elapsedMs < 1000 ? `${elapsedMs} ms` : `${(elapsedMs / 1000).toFixed(1)} s`} of compute` : ""}` : "Idle"}
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {!running && (
            <>
              {open ? "Hide steps" : "Show steps"}
              <ChevronIcon open={open} className="h-3.5 w-3.5" />
            </>
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <m.div key="steps" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: "easeOut" }} className="overflow-hidden">
            <ol className="relative mx-5 mb-4 mt-1 border-t border-slate-100 pt-3 dark:border-slate-800">
              {/* connector rail and its fill */}
              <span aria-hidden="true" className="absolute top-6 bottom-4 left-[11px] w-0.5 rounded bg-slate-200 dark:bg-slate-800" />
              <m.span aria-hidden="true" className="absolute top-6 left-[11px] w-0.5 origin-top rounded bg-emerald-500" style={{ height: "calc(100% - 2.5rem)" }} animate={{ scaleY: fill }} initial={{ scaleY: 0 }} transition={{ duration: 0.45, ease: "easeOut" }} />
              {steps.map((s) => {
                const meta = STEP_META[s.stage];
                const dur = duration(s);
                return (
                  <li key={s.stage} className="relative flex items-start gap-3 py-2">
                    <StatusDot status={s.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-[13px] font-semibold ${s.status === "pending" ? "text-slate-500 dark:text-slate-500" : "text-slate-900 dark:text-slate-100"}`}>{meta.title}</span>
                        {s.status === "skipped" && <span className="chip chip-neu">skipped</span>}
                        <span className="ml-auto font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {dur ? (
                            <m.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              {dur}
                            </m.span>
                          ) : s.status === "running" ? (
                            "…"
                          ) : (
                            ""
                          )}
                        </span>
                      </div>
                      <m.p key={s.status + s.detail} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {s.status === "running" ? <ShimmerText>{s.detail}</ShimmerText> : s.status === "pending" ? meta.blurb : s.detail}
                      </m.p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </m.div>
        )}
      </AnimatePresence>
    </m.section>
  );
}
