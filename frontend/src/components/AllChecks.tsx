import { useMemo, useState } from "react";
import type { AnalysisResult, Dimension, Finding } from "../types";
import { GROUPS, RESULT_LABELS, SOURCE_LABELS, STRENGTH_LABELS, byConsequence, findingLabel, pairReasoning, resultKind, rulingLabel } from "../labels";
import { ChevronIcon } from "./Icons";
import { Section } from "./Section";

const KIND_CHIP = { contradicts: "chip-sus", supports: "chip-gen", none: "chip-neu" } as const;

function Row({ f, reasoning }: { f: Finding; reasoning: ReturnType<typeof pairReasoning> }) {
  const [open, setOpen] = useState(false);
  const kind = resultKind(f);
  const c = reasoning.get(f);
  return (
    <>
      <div role="row" className="contents">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="col-span-4 grid grid-cols-subgrid items-start border-t border-slate-100 text-left hover:bg-slate-50/70 dark:border-slate-800/70 dark:hover:bg-slate-800/40">
          <div className="px-3 py-3">
            <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100">{findingLabel(f)}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{f.assertion}</p>
          </div>
          <div className="px-3 py-3">
            <span className={`chip ${KIND_CHIP[kind]}`}>{RESULT_LABELS[kind]}</span>
          </div>
          <div className="px-3 py-3">
            <span className="chip chip-src">{SOURCE_LABELS[f.source_tier]}</span>
          </div>
          <div className="px-3 py-3 text-slate-400">
            <ChevronIcon open={open} className="h-4 w-4" />
          </div>
        </button>
      </div>
      {open && (
        <div className="col-span-4 space-y-2 bg-slate-50/70 px-3 pt-1 pb-3.5 text-xs dark:bg-slate-950/40">
          <p className="text-slate-700 dark:text-slate-300">{f.detail}</p>
          <p className="font-mono text-[11px] text-slate-500">
            {f.result}
            {f.source_doc ? ` · ${f.source_doc}` : ""} · strength {STRENGTH_LABELS[f.strength].toLowerCase()}
          </p>
          {c && (
            <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
              <p>
                <span className="eyebrow block text-emerald-700 dark:text-emerald-400">Innocent reading</span>
                {c.benign}
              </p>
              <p>
                <span className="eyebrow block text-rose-700 dark:text-rose-400">Forgery reading</span>
                {c.malicious}
              </p>
              <p className="flex items-start gap-2 md:col-span-2">
                <span className={`chip shrink-0 ${rulingLabel(f, c).cls}`}>{rulingLabel(f, c).text}</span>
                <span className="text-slate-600 dark:text-slate-400">{c.resolution}</span>
              </p>
            </div>
          )}
        </div>
      )}
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
        <span className="inline-flex items-center gap-1.5">
          <span className="chip chip-sus">{c.supports_suspect} contradict</span>
          <span className="chip chip-gen">{c.supports_genuine} support</span>
          <span className="chip chip-neu">{c.neutral} no signal</span>
        </span>
      }
    >
      <div className="flex flex-col gap-2.5">
        {GROUPS.map((g) => {
          const list = grouped.get(g.key) ?? [];
          if (!list.length) return null;
          const bad = list.filter((f) => f.direction === "supports_suspect").length;
          const good = list.filter((f) => f.direction === "supports_genuine").length;
          const open = openGroups.has(g.key);
          return (
            <div key={g.key} className={`overflow-hidden rounded-lg border bg-white dark:bg-slate-900 ${open ? "border-blue-500" : "border-slate-200 dark:border-slate-800"}`}>
              <button type="button" onClick={() => toggle(g.key)} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <ChevronIcon open={open} className="h-4 w-4 text-slate-400" />
                <span className="w-28 text-[13px] font-semibold text-slate-900 dark:text-slate-100">{g.name}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {list.length} check{list.length === 1 ? "" : "s"} · {g.description}
                </span>
                <span className={`chip ${bad ? "chip-sus" : good ? "chip-gen" : "chip-neu"}`}>{bad ? `${bad} contradict${bad === 1 ? "s" : ""}` : good ? `${good} support${good === 1 ? "s" : ""}` : "no signal"}</span>
              </button>
              {open && (
                <div className="overflow-x-auto">
                  <div role="table" className="grid min-w-[640px] grid-cols-[1fr_130px_150px_40px]">
                    <div role="row" className="contents">
                      {["Finding", "Result", "Source", ""].map((h, i) => (
                        <div key={i} role="columnheader" className="eyebrow border-t border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
                          {h}
                        </div>
                      ))}
                    </div>
                    {list.map((f, i) => (
                      <Row key={`${f.check}-${i}`} f={f} reasoning={reasoning} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
