import { useMemo, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import type { AnalysisResult, Dimension, Finding } from "../types";
import {
  GROUPS,
  SOURCE_LABELS,
  STRENGTH_LABELS,
  byConsequence,
  checkLabel,
  findingLabel,
  pairReasoning,
  resultKind,
  rulingLabel,
} from "../labels";
import {
  BadgeCheckIcon,
  BoxIcon,
  CheckIcon,
  ChevronIcon,
  FingerprintIcon,
  ShieldIcon,
  XIcon,
} from "./Icons";
import { Section } from "./Section";

const GROUP_ICONS: Record<Dimension, typeof ShieldIcon> = {
  identity: ShieldIcon,
  certification: BadgeCheckIcon,
  custody: BoxIcon,
  provenance: FingerprintIcon,
};

function StatusBadge({ kind }: { kind: ReturnType<typeof resultKind> }) {
  if (kind === "contradicts") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-rose-700 dark:text-rose-400">
        <XIcon className="h-3 w-3 shrink-0" />
        FAIL
      </span>
    );
  }
  if (kind === "supports") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
        <CheckIcon className="h-3 w-3 shrink-0" />
        PASS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-300/60 bg-slate-100/70 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      NEUTRAL
    </span>
  );
}

function Row({ f, reasoning }: { f: Finding; reasoning: ReturnType<typeof pairReasoning> }) {
  const [open, setOpen] = useState(false);
  const kind = resultKind(f);
  const c = reasoning.get(f);
  const contradicts = f.direction === "supports_suspect";

  return (
    <>
      <div role="row" className="contents">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="col-span-4 grid grid-cols-subgrid items-center border-t border-slate-100/90 text-left transition-colors hover:bg-slate-50/80 dark:border-slate-800/80 dark:hover:bg-slate-800/40 cursor-pointer"
        >
          {/* Status Column */}
          <div className="px-3 py-3">
            <StatusBadge kind={kind} />
          </div>

          {/* Check & Observed Evidence Column */}
          <div className="min-w-0 px-3 py-3">
            <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              {contradicts ? findingLabel(f) : checkLabel(f.check)}
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
              {f.detail || f.assertion || "Verified against statutory / cross-document record"}
            </p>
          </div>

          {/* Source Tier & Document Column */}
          <div className="px-3 py-3">
            <div className="flex flex-col items-start gap-0.5">
              <span className="inline-flex rounded border border-slate-200/80 bg-slate-100/70 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {SOURCE_LABELS[f.source_tier]}
              </span>
              {f.source_doc && (
                <span className="font-mono text-[10px] text-slate-400 truncate max-w-[130px]">
                  {f.source_doc}
                </span>
              )}
            </div>
          </div>

          {/* Expand Chevron Column */}
          <div className="px-3 py-3 text-right text-slate-400">
            <ChevronIcon open={open} className="h-4 w-4 ml-auto" />
          </div>
        </button>
      </div>

      {/* Forensic Deep-Dive Drawer */}
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="col-span-4 overflow-hidden"
          >
            <div className="border-t border-slate-100 bg-slate-50/80 p-4 text-xs dark:border-slate-800/90 dark:bg-slate-950/60 space-y-3">
              {/* Fact observation & strength */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2 dark:border-slate-800/60">
                <div className="text-slate-700 dark:text-slate-300 font-medium">
                  <span className="font-bold text-slate-900 dark:text-slate-100">Observed Fact: </span>
                  {f.detail}
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="rounded bg-slate-200/70 px-1.5 py-0.5 dark:bg-slate-800">
                    Strength: {STRENGTH_LABELS[f.strength]}
                  </span>
                  {f.result && (
                    <span className="rounded bg-slate-200/70 px-1.5 py-0.5 dark:bg-slate-800">
                      Result: {f.result}
                    </span>
                  )}
                </div>
              </div>

              {/* Dual Hypotheses (Innocent vs Forgery Reading) */}
              {c && (
                <div className="space-y-2 pt-1">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Forensic Duality & Reasoning
                  </span>
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
                        🛡️ Benign Reading (Innocent)
                      </span>
                      <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {c.benign}
                      </p>
                    </div>

                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block mb-1">
                        🚨 Malicious Reading (Forgery)
                      </span>
                      <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {c.malicious}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <span className={`chip shrink-0 ${rulingLabel(f, c).cls}`}>
                      {rulingLabel(f, c).text}
                    </span>
                    <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      <span className="font-semibold text-slate-900 dark:text-slate-200">
                        Resolution:{" "}
                      </span>
                      {c.resolution}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function AllChecks({ result: r }: { result: AnalysisResult }) {
  const findings = r.ledger.findings;
  const reasoning = useMemo(() => pairReasoning(findings, r.reasoning), [findings, r.reasoning]);
  const grouped = useMemo(() => {
    const m = new Map<Dimension, Finding[]>();
    for (const g of GROUPS) m.set(g.key, []);
    for (const f of findings) m.get(f.dimension)?.push(f);
    for (const list of m.values()) list.sort(byConsequence);
    return m;
  }, [findings]);

  // Open the group holding the most consequential finding by default.
  const [openGroups, setOpenGroups] = useState<Set<Dimension>>(() => {
    const top = [...findings].sort(byConsequence)[0];
    return new Set(top && top.direction !== "neutral" ? [top.dimension] : []);
  });

  const toggle = (k: Dimension) =>
    setOpenGroups((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const c = r.counts;

  return (
    <Section
      title={`All ${findings.length} checks`}
      aside={
        <div className="flex items-center gap-2 font-mono text-xs">
          {c.supports_suspect > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-rose-700 dark:text-rose-400 font-bold">
              <XIcon className="h-3 w-3" /> {c.supports_suspect} Fail
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400 font-bold">
            <CheckIcon className="h-3 w-3" /> {c.supports_genuine} Pass
          </span>
          {c.neutral > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {c.neutral} Neutral
            </span>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {GROUPS.map((g) => {
          const list = grouped.get(g.key) ?? [];
          if (!list.length) return null;
          const bad = list.filter((f) => f.direction === "supports_suspect").length;
          const good = list.filter((f) => f.direction === "supports_genuine").length;
          const open = openGroups.has(g.key);
          const GroupIcon = GROUP_ICONS[g.key];

          // Edge accent styling based on findings within this pillar
          const accentBorder = bad > 0 ? "border-l-4 border-l-rose-500" : "border-l-4 border-l-emerald-500";

          return (
            <div
              key={g.key}
              className={`overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 ${accentBorder}`}
            >
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50 cursor-pointer"
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    bad > 0
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  <GroupIcon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100">
                      {g.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                      ({list.length} check{list.length === 1 ? "" : "s"})
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                    {g.description}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {bad > 0 ? (
                    <span className="font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                      {bad} Contradiction{bad === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {good} Verified
                    </span>
                  )}
                  <ChevronIcon open={open} className="h-4 w-4 text-slate-400 transition-transform" />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <m.div
                    key="table"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="overflow-hidden border-t border-slate-100 dark:border-slate-800"
                  >
                    <div className="overflow-x-auto">
                      <div
                        role="table"
                        className="grid min-w-[640px] grid-cols-[100px_1fr_160px_40px]"
                      >
                        <div role="row" className="contents">
                          {["Status", "Evaluation & Observed Fact", "Forensic Source", ""].map(
                            (h, i) => (
                              <div
                                key={i}
                                role="columnheader"
                                className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/90 px-3 py-2 border-b border-slate-100 dark:bg-slate-950/60 dark:border-slate-800 dark:text-slate-400"
                              >
                                {h}
                              </div>
                            )
                          )}
                        </div>
                        {list.map((f, i) => (
                          <Row key={`${f.check}-${i}`} f={f} reasoning={reasoning} />
                        ))}
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
