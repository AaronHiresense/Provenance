import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import * as m from "motion/react-m";
import { stagger, type Variants } from "motion/react";
import { api } from "../api";
import type { CaseSummary, Dossier, Preflight as PreflightData, Verdict } from "../types";
import { VERDICT_STYLE } from "../labels";
import { type RunRecord, timeAgo } from "../history";
import { PreflightPanel } from "./Preflight";
import { BorderBeam } from "./effects";
import { FileIcon, PlayIcon, SpinnerIcon, UploadIcon } from "./Icons";

export type BriefInput = { kind: "case"; file: string } | { kind: "raw"; text: string } | { kind: "dossier"; dossier: Dossier };

interface Props {
  cases: CaseSummary[];
  historyList: RunRecord[];
  busy: boolean;
  rulesOnly: boolean;
  onRulesOnly: (v: boolean) => void;
  onInvestigate: (input: BriefInput) => void;
  onReopen: (rec: RunRecord) => void;
  error: string | null;
}

const SNAPSHOT = new Date("2026-07-22");

const stack: Variants = { hidden: {}, show: { transition: { delayChildren: stagger(0.07, { startDelay: 0.05 }) } } };
const rise: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };

const PIPELINE_STAGES = [
  { id: "1", name: "Extraction Agent", blurb: "Entity & claim extraction" },
  { id: "2", name: "22 Validators", blurb: "MCA registry & GST rules" },
  { id: "3", name: "Evidence Ledger", blurb: "Tier & strength ranking" },
  { id: "4", name: "Reasoning Agent", blurb: "Adversarial debate" },
  { id: "5", name: "Verdict Engine", blurb: "Dispositive decision" },
];

function classify(text: string): BriefInput | null {
  const t = text.trim();
  if (!t) return null;
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t) as Dossier;
      if (Array.isArray(j.documents)) return { kind: "dossier", dossier: j };
    } catch {
      /* not JSON */
    }
  }
  return { kind: "raw", text: t };
}

function splitTitle(title: string): { lot: string; who: string } {
  const [lot, ...rest] = title.split(" — ");
  return { lot, who: rest.join(" — ") };
}

export function Briefing(p: Props) {
  const [text, setText] = useState("");
  const [pf, setPf] = useState<PreflightData | null>(null);
  const [pfLoading, setPfLoading] = useState(false);
  const [pfError, setPfError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState<"ALL" | Verdict>("ALL");

  const boxRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const input = classify(text);
    if (!input || input.kind === "case") {
      setPf(null);
      setPfLoading(false);
      setPfError(null);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPfLoading(true);
    const t = setTimeout(() => {
      api
        .preflight(input.kind === "raw" ? { raw_text: input.text, case_id: "live", rules_only: false } : { dossier: input.dossier, rules_only: false }, ctrl.signal)
        .then((d) => {
          if (!ctrl.signal.aborted) {
            setPf(d);
            setPfError(null);
          }
        })
        .catch((e: Error) => {
          if (!ctrl.signal.aborted) setPfError(e.message);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setPfLoading(false);
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text]);

  const investigate = useCallback(() => {
    const input = classify(text);
    if (input) p.onInvestigate(input);
  }, [text, p]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      investigate();
    }
  };

  const readFiles = async (files: FileList | File[]) => {
    const parts: string[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 200_000) continue;
      parts.push(await f.text());
    }
    if (parts.length) setText((prev) => [prev.trim(), ...parts].filter(Boolean).join("\n---\n"));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void readFiles(e.dataTransfer.files);
  };

  const ready = classify(text) !== null;
  const snapshotAge = Math.round((Date.now() - SNAPSHOT.getTime()) / 86_400_000);
  const awaiting = p.historyList.filter((r) => r.status === "awaiting");
  const recent = p.historyList.slice(0, 6);

  const filteredCases = p.cases.filter((c) => {
    if (category === "ALL") return true;
    return c.expected === category;
  });

  return (
    <m.div className="mx-auto w-full max-w-5xl space-y-8" variants={stack} initial="hidden" animate="show">
      {/* Hero Header */}
      <m.div variants={rise} className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">Agentic Investigator for Auto-Parts Paperwork</span>
          <span className="chip chip-reg font-mono text-[10.5px]">3.67M MCA Registry Records</span>
          <span className="chip chip-neu font-mono text-[10.5px]">Fully Offline</span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Brief the investigator.
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
          Drop in the certificate, invoice and dispatch note for one lot. I read them, check every claim against the MCA company registry and GST/logistics rules, argue innocent vs. forgery readings of each contradiction, and give you one verdict with evidence.
        </p>

        {/* Pipeline Stage Bar */}
        <div className="pt-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PIPELINE_STAGES.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                <span className="font-mono text-[10px] font-semibold text-slate-400 dark:text-slate-500">STAGE 0{s.id}</span>
                <div className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">{s.name}</div>
                <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate">{s.blurb}</div>
              </div>
            ))}
          </div>
        </div>
      </m.div>

      {/* Main Dossier Drop Area */}
      <m.section
        variants={rise}
        className={`panel relative overflow-hidden transition-colors ${dragging ? "border-blue-500 ring-2 ring-blue-500/30" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {pfLoading && <BorderBeam radius={12} duration={3} />}
        <div className="p-2">
          <label htmlFor="brief" className="sr-only">
            Paperwork for one lot
          </label>
          <textarea
            id="brief"
            ref={boxRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            rows={text ? Math.min(16, Math.max(6, text.split("\n").length + 1)) : 6}
            placeholder={"Paste the paperwork here, or drop the files. Separate documents with a line of ---\n\nCERTIFICATE OF CONFORMITY\nManufacturer: …\nCIN: …\n---\nTAX INVOICE\nGSTIN: …"}
            className="w-full resize-none rounded-lg bg-transparent px-4 py-3 font-mono text-[12.5px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
            <label className="btn cursor-pointer">
              <UploadIcon className="h-3.5 w-3.5" />
              Add files
              <input type="file" accept=".txt,.md,.json,text/plain,application/json" multiple className="sr-only" onChange={(e) => e.target.files && void readFiles(e.target.files)} />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={p.rulesOnly} onChange={(e) => p.onRulesOnly(e.target.checked)} className="h-3.5 w-3.5 accent-blue-600" />
              Rules only, skip the reasoning agent
            </label>
            <div className="flex-1" />
            {p.error && (
              <span role="alert" className="text-xs text-rose-700 dark:text-rose-300">
                {p.error}
              </span>
            )}
            <span className="hidden text-[11px] font-mono text-slate-400 sm:inline">Ctrl+Enter</span>
            <button type="button" className="btn btn-primary" disabled={!ready || p.busy} onClick={investigate}>
              {p.busy ? <SpinnerIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3 w-3" />}
              Investigate
            </button>
          </div>
        </div>
        <PreflightPanel data={pf} loading={pfLoading && !pf} error={pfError} />
      </m.section>

      {/* Waiting items section */}
      {awaiting.length > 0 && (
        <m.section variants={rise} className="space-y-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Waiting on documents</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Paste the new paperwork and I will run the case again.</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {awaiting.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => p.onReopen(r)}
                className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left hover:bg-amber-100/70 dark:border-amber-900/60 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
              >
                <span className="chip chip-unv mt-0.5 shrink-0">Awaiting</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{r.title}</span>
                  <span className="block text-xs text-slate-600 dark:text-slate-300">{r.awaiting}</span>
                </span>
              </button>
            ))}
          </div>
        </m.section>
      )}

      {/* Prepared Benchmark Dossiers */}
      <m.section variants={rise} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Or watch me work a prepared lot</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Real registry records, one click. Select a case to run the agent.</span>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(["ALL", "GENUINE", "SUSPECT", "UNVERIFIABLE"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCategory(tab)}
                className={`relative rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  category === tab ? "text-slate-900 dark:text-white font-semibold" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                }`}
              >
                {category === tab && (
                  <m.span
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-md bg-white shadow-sm dark:bg-slate-700"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredCases.map((c) => {
            const { lot, who } = splitTitle(c.title);
            const v = c.expected as Verdict | undefined;

            return (
              <m.button
                key={c.file}
                type="button"
                disabled={p.busy}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => p.onInvestigate({ kind: "case", file: c.file })}
                className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-3.5 text-left hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="text-[13px] leading-snug font-semibold text-slate-900 dark:text-slate-100">{lot}</span>
                <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{who}</span>
                <span className="mt-auto flex items-center gap-2 pt-2">
                  {v && <span className={`chip ${VERDICT_STYLE[v].chip}`}>{v.charAt(0) + v.slice(1).toLowerCase()}</span>}
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{c.documents} doc{c.documents === 1 ? "" : "s"}</span>
                </span>
              </m.button>
            );
          })}
        </div>
      </m.section>

      {/* System Capabilities & Recent History Split */}
      <m.div variants={rise} className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="space-y-3 lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Recent Audit History</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Kept locally on this machine</span>
          </div>

          {recent.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              No recent investigations. Select a prepared dossier above or paste paperwork to begin.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {recent.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => p.onReopen(r)}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <span className={`chip shrink-0 ${VERDICT_STYLE[r.verdict].chip}`}>
                        {r.verdict.charAt(0) + r.verdict.slice(1).toLowerCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{r.title}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                          {r.supplier ?? "supplier unknown"} · {r.contradictions} contradiction{r.contradictions === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="chip chip-neu shrink-0 capitalize">{r.status}</span>
                      <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">{timeAgo(r.at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-3 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Verification Engine Capabilities</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">22 Deterministic Rules</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <FileIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>1. Identity Resolution</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                CIN decode vs. 3.67M MCA registry records, incorporation date, active status, GSTIN checksums & embedded PAN logic.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <FileIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>2. Certification Audit</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
                Certificate dates vs. incorporation, BIS licence holder lookup, type approval validity windows & OEM specifications.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <FileIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>3. Custody & Logistics</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Manufacturing & dispatch order, e-way bill validity vs. distance, route sanity, HSN classification & entry port mode.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <FileIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>4. Tampering & Prompt Defense</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Lot code grammar, cross-document field drift detection, and instruction injection hygiene filter.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            MCA Registry snapshot date: 22 Jul 2026 ({snapshotAge} days old). 100% local execution.
          </p>
        </section>
      </m.div>
    </m.div>
  );
}
