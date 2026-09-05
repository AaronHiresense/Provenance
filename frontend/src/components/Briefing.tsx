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

/** Turn whatever was pasted or dropped into a request: a dossier JSON if it
 *  parses as one, otherwise plain document text. */
function classify(text: string): BriefInput | null {
  const t = text.trim();
  if (!t) return null;
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t) as Dossier;
      if (Array.isArray(j.documents)) return { kind: "dossier", dossier: j };
    } catch {
      /* not JSON, treat as text */
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
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Live read of the paperwork, debounced; cancels the previous request.
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

  return (
    <m.div className="mx-auto w-full max-w-5xl space-y-8" variants={stack} initial="hidden" animate="show">
      <m.div variants={rise} className="space-y-2 pt-2">
        <span className="eyebrow">Investigator for auto-parts paperwork</span>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 text-balance sm:text-4xl dark:text-white">Brief the investigator.</h1>
        <p className="max-w-2xl text-[15px] text-slate-600 text-pretty dark:text-slate-300">
          Drop in the certificate, invoice and dispatch note for one lot. I read them, check every claim against the MCA company registry and the GST and logistics rules, argue the innocent and forgery readings of each contradiction, and give you one verdict with the evidence and your next move.
        </p>
      </m.div>

      <m.section variants={rise} className={`panel relative overflow-hidden transition-colors ${dragging ? "border-blue-500 ring-2 ring-blue-500/30" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
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
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <input type="checkbox" checked={p.rulesOnly} onChange={(e) => p.onRulesOnly(e.target.checked)} className="h-3.5 w-3.5 accent-blue-600" />
              Rules only, skip the reasoning agent
            </label>
            <div className="flex-1" />
            {p.error && (
              <span role="alert" className="text-xs text-rose-700 dark:text-rose-300">
                {p.error}
              </span>
            )}
            <span className="hidden text-[11px] text-slate-400 sm:inline">Ctrl+Enter</span>
            <button type="button" className="btn btn-primary" disabled={!ready || p.busy} onClick={investigate}>
              {p.busy ? <SpinnerIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3 w-3" />}
              Investigate
            </button>
          </div>
        </div>
        <PreflightPanel data={pf} loading={pfLoading && !pf} error={pfError} />
      </m.section>

      {awaiting.length > 0 && (
        <m.section variants={rise} className="space-y-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Waiting on documents</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Paste the new paperwork and I will run the case again.</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {awaiting.map((r) => (
              <button key={r.id} type="button" onClick={() => p.onReopen(r)} className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left hover:bg-amber-100/70 dark:border-amber-900/60 dark:bg-amber-950/30 dark:hover:bg-amber-950/50">
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

      <m.section variants={rise} className="space-y-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Or watch me work a prepared lot</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Real registry records, one click. The expected outcome is shown so nothing is a surprise.</span>
        </div>
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2">
          {p.cases.map((c) => {
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
                className="flex w-56 shrink-0 flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
              >
                <span className="text-[13px] leading-snug font-semibold text-slate-900 dark:text-slate-100">{lot}</span>
                <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{who}</span>
                <span className="mt-auto flex items-center gap-2 pt-1">
                  {v && <span className={`chip ${VERDICT_STYLE[v].chip}`}>{v.charAt(0) + v.slice(1).toLowerCase()}</span>}
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{c.documents} doc{c.documents === 1 ? "" : "s"}</span>
                </span>
              </m.button>
            );
          })}
        </div>
      </m.section>

      <m.div variants={rise} className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="space-y-2 lg:col-span-3">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">Recent lots</h2>
          {recent.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Nothing yet. Every lot you investigate is kept here on this machine, with its verdict and what you decided.</p>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {recent.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => p.onReopen(r)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className={`chip shrink-0 ${VERDICT_STYLE[r.verdict].chip}`}>{r.verdict.charAt(0) + r.verdict.slice(1).toLowerCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">{r.title}</span>
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
          )}
        </section>
        <section className="space-y-2 lg:col-span-2">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">What I check</h2>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <li className="flex gap-2"><FileIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" /><span><b className="font-semibold text-slate-900 dark:text-slate-100">Identity.</b> The CIN against 3.67 million MCA registry records: name, state, status, incorporation date, registered activity. GST numbers by checksum, state code and embedded PAN.</span></li>
            <li className="flex gap-2"><FileIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" /><span><b className="font-semibold text-slate-900 dark:text-slate-100">Certification.</b> Certificate dates against incorporation, BIS licence holder, type-approval validity, the standard on the OEM sheet.</span></li>
            <li className="flex gap-2"><FileIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" /><span><b className="font-semibold text-slate-900 dark:text-slate-100">Custody and logistics.</b> Manufacture, dispatch and receipt in order; dispatch state; e-way validity against distance; route distance; HSN against part; port against mode of entry.</span></li>
            <li className="flex gap-2"><FileIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" /><span><b className="font-semibold text-slate-900 dark:text-slate-100">Tampering.</b> Lot-code grammar, fields that drift between documents, and any line that tries to instruct the reviewer.</span></li>
          </ul>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Registry snapshot 22 Jul 2026, {snapshotAge} days old. Companies registered since then are reported as unknown, never guessed. Everything runs on this machine.
          </p>
        </section>
      </m.div>
    </m.div>
  );
}
