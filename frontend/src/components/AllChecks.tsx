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
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 font-mono text-[10.5px] font-bold text-rose-700 dark:text-rose-400">
        <XIcon className="h-3 w-3 shrink-0" />
        FAIL
      </span>
    );
  }
  if (kind === "supports") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400">
        <CheckIcon className="h-3 w-3 shrink-0" />
        PASS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-slate-300/60 bg-slate-100/70 px-2 py-0.5 font-mono text-[10.5px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
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
              <span className="inline-flex rounded border border-slate-200/80 bg-slate-100/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {SOURCE_LABELS[f.source_tier]}
              </span>
              {f.source_doc && (
                <span className="font-mono text-[9.5px] text-slate-400 truncate max-w-[130px]">
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
                  <span className="rounded bg-slate-200/70 px-1.5 py-0.5 dark:bg-slate-800 font-bold">
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
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
                        🛡️ Benign Reading (Innocent)
                      </span>
                      <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {c.benign}
                      </p>
                    </div>

                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block mb-1">
                        🚨 Malicious Reading (Forgery)
                      </span>
                      <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {c.malicious}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
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
  const [filter, setFilter] = useState<"all" | "fail" | "pass" | "neutral">("all");

  const filteredFindings = useMemo(() => {
    if (filter === "all") return findings;
    if (filter === "fail") return findings.filter((f) => f.direction === "supports_suspect");
    if (filter === "pass") return findings.filter((f) => f.direction === "supports_genuine");
    return findings.filter((f) => f.direction === "neutral");
  }, [findings, filter]);

  const grouped = useMemo(() => {
    const m = new Map<Dimension, Finding[]>();
    for (const g of GROUPS) m.set(g.key, []);
    for (const f of filteredFindings) m.get(f.dimension)?.push(f);
    for (const list of m.values()) list.sort(byConsequence);
    return m;
  }, [filteredFindings]);

  // Open groups with contradictions by default
  const [openGroups, setOpenGroups] = useState<Set<Dimension>>(() => {
    const s = new Set<Dimension>();
    for (const f of findings) {
      if (f.direction === "supports_suspect") s.add(f.dimension);
    }
    // If none failed, open the first group
    if (s.size === 0 && GROUPS[0]) s.add(GROUPS[0].key);
    return s;
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
      title={`Forensic Check Matrix (${findings.length} Total Checks)`}
      badge="FORENSIC MATRIX · 22 CHECKS"
      subtitle="Comprehensive statutory cross-examination across all 4 regulatory dimensions"
      tint="emerald"
      icon={BadgeCheckIcon}
      aside={
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              filter === "all"
                ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            All ({findings.length})
          </button>
          {c.supports_suspect > 0 && (
            <button
              type="button"
              onClick={() => setFilter("fail")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                filter === "fail"
                  ? "bg-rose-600 text-white shadow-2xs"
                  : "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              }`}
            >
              🚨 {c.supports_suspect} Fail
            </button>
          )}
          <button
            type="button"
            onClick={() => setFilter("pass")}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              filter === "pass"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            }`}
          >
            ✔ {c.supports_genuine} Pass
          </button>
          {c.neutral > 0 && (
            <button
              type="button"
              onClick={() => setFilter("neutral")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                filter === "neutral"
                  ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              ⚪ {c.neutral} Neutral
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {GROUPS.map((g) => {
          const list = grouped.get(g.key) ?? [];
          if (!list.length && filter !== "all") return null;
          const bad = list.filter((f) => f.direction === "supports_suspect").length;
          const good = list.filter((f) => f.direction === "supports_genuine").length;
          const total = list.length;
          const open = openGroups.has(g.key);
          const GroupIcon = GROUP_ICONS[g.key];

          const passPercent = total > 0 ? (good / total) * 100 : 0;
          const failPercent = total > 0 ? (bad / total) * 100 : 0;

          return (
            <div
              key={g.key}
              className={`overflow-hidden rounded-2xl border transition-all shadow-2xs ${
                bad > 0
                  ? "border-rose-300 bg-white ring-1 ring-rose-500/10 dark:border-rose-900/60 dark:bg-slate-900"
                  : "border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              {/* Header Button with Micro-Progress Segment */}
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      bad > 0
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    <GroupIcon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {g.name}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                        ({total} check{total === 1 ? "" : "s"})
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block truncate mt-0.5 max-w-xl">
                      {g.description}
                    </span>
                  </div>
                </div>

                {/* Right side: Mini-Integrity Progress Bar & Status Pill */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* Micro Progress Bar */}
                  <div className="hidden sm:flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
                      {bad > 0 ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {bad} Contradiction{bad === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {good}/{total} Verified
                        </span>
                      )}
                    </div>

                    <div className="h-1.5 w-24 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                      {failPercent > 0 && (
                        <div
                          style={{ width: `${failPercent}%` }}
                          className="h-full bg-rose-500"
                        />
                      )}
                      {passPercent > 0 && (
                        <div
                          style={{ width: `${passPercent}%` }}
                          className="h-full bg-emerald-500"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-slate-600">
                    <ChevronIcon open={open} className="h-3.5 w-3.5" />
                  </div>
                </div>
              </button>

              {/* Table Ledger Drawer */}
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

