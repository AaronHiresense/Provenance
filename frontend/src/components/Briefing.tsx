import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import * as m from "motion/react-m";
import { AnimatePresence, stagger, useReducedMotion, type Variants } from "motion/react";
import { api } from "../api";
import type { CaseSummary, Dossier, Preflight as PreflightData, SampleSet, Verdict } from "../types";
import { VERDICT_STYLE, formatDate, titleCase } from "../labels";
import { type RunRecord, timeAgo } from "../history";
import { PreflightPanel } from "./Preflight";
import { BorderBeam, ShimmerText } from "./effects";
import { ArrowRightIcon, BracesIcon, BuildingIcon, ClockIcon, FileIcon, PlayIcon, RefreshIcon, SearchIcon, SpinnerIcon, UploadIcon } from "./Icons";

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

/** Three ways to start: paperwork (the desk's normal case), a supplier
 *  lookup when only an identifier is to hand, and the dossier JSON the jury
 *  uses. */
type Mode = "paperwork" | "supplier" | "json";
const MODES: { key: Mode; label: string; Icon: typeof FileIcon }[] = [
  { key: "paperwork", label: "Paperwork", Icon: FileIcon },
  { key: "supplier", label: "Supplier lookup", Icon: SearchIcon },
  { key: "json", label: "Dossier JSON", Icon: BracesIcon },
];

const SNAPSHOT = new Date("2026-07-22");

/** The run, told one stage at a time in the agent's voice. The headline
 *  steps through these; the rail beneath shows where it is. */
const STEPS = [
  { key: "extract", label: "Extraction agent", line: "I read every document you put in front of me." },
  { key: "validate", label: "22 validators", line: "I check each claim against 3.67 million registry records and the GST rules." },
  { key: "ledger", label: "Evidence ledger", line: "I write every finding to a ledger, ranked by how much its source can be trusted." },
  { key: "reason", label: "Reasoning agent", line: "I argue the innocent and the forgery reading of each contradiction." },
  { key: "verdict", label: "Verdict", line: "I hand you one verdict, the evidence behind it, and your next move." },
];
const STEP_MS = 3600;

// The prepared lots worth recommending first, and why, in the user's words.
const DEMO_HOOKS: Record<string, string> = {
  suspect_velomax: "a certificate dated before the company existed, and a document that tries to instruct the reviewer",
  contrast_cascade: "a supplier the registry says was merged away, where one court order decides the case",
  suspect_teleport: "an e-way validity claim that does not reconcile with the declared distance",
  genuine_hsi: "a clean paper trail from a manufacturer the registry has known since 1997",
  unverifiable_ghost: "a CIN the registry has never heard of",
  suspect_novakraft: "a GST number registered in a different state from the dispatch",
};
const DEMO_ORDER = Object.keys(DEMO_HOOKS);

/** What each prepared lot demonstrates, as the case book's lead line. */
const LOT_TWISTS: Record<string, string> = {
  genuine_hsi: "Clean paper trail from a manufacturer known since 1997",
  genuine_bonfiglioli: "Clean paper trail from a listed manufacturer",
  genuine_hsi_typolot: "Genuine part, one typo in the lot code",
  genuine_longhaul: "Chennai to Delhi, and the e-way bill checks out",
  genuine_norde_llp: "An LLP: several checks abstain, honestly",
  suspect_velomax: "Certificate predates the company; a note tries to instruct the reviewer",
  suspect_zephyr: "A parts trader posing as the manufacturer",
  suspect_meridian: "Issuer struck off the registry",
  suspect_novakraft: "GST registered in a different state from the dispatch",
  suspect_teleport: "A one-day e-way bill for 2,200 km",
  suspect_cloned_spec: "Cloned paperwork certified to the wrong standard",
  contrast_cascade: "Supplier merged away; one NCLT order decides it",
  unverifiable_ghost: "A CIN the registry has never heard of",
  unverifiable_falconridge_bis: "BIS licence cannot be checked offline",
  unverifiable_kestrel_thin: "A single cover letter and nothing else",
};

const CASE_GROUPS: { v: Verdict; title: string; hint: string; rail: string; dot: string }[] = [
  { v: "GENUINE", title: "Genuine", hint: "paper trails the registry supports", rail: "bg-emerald-500", dot: "bg-emerald-500" },
  { v: "SUSPECT", title: "Suspect", hint: "contradictions the records prove", rail: "bg-rose-500", dot: "bg-rose-500" },
  { v: "UNVERIFIABLE", title: "Unverifiable", hint: "one named document decides each", rail: "bg-amber-500", dot: "bg-amber-500" },
];

const stack: Variants = { hidden: {}, show: { transition: { delayChildren: stagger(0.08, { startDelay: 0.05 }) } } };
const rise: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } } };

const CIN_RE = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$|^[A-Z]{3}-\d{4}$/;
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

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
      /* not JSON */
    }
  }
  return { kind: "raw", text: t };
}

/** A supplier lookup becomes a one-line document the extractor can read. */
function lookupText(id: string): string | null {
  const v = id.trim().toUpperCase();
  if (CIN_RE.test(v)) return `SUPPLIER LOOKUP\nCIN: ${v}`;
  if (GSTIN_RE.test(v)) return `SUPPLIER LOOKUP\nGSTIN: ${v}`;
  return null;
}

function splitTitle(title: string): { lot: string; who: string } {
  const [lot, ...rest] = title.split(" — ");
  return { lot, who: rest.join(" — ") };
}

function partOfDay(): string {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

export function Briefing(p: Props) {
  const [mode, setMode] = useState<Mode>("paperwork");
  const [text, setText] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [lookup, setLookup] = useState("");
  const [pf, setPf] = useState<PreflightData | null>(null);
  const [pfLoading, setPfLoading] = useState(false);
  const [pfError, setPfError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [category, setCategory] = useState<"ALL" | Verdict>("ALL");
  const abortRef = useRef<AbortController | null>(null);

  // What the current mode would send.
  const request = useMemo<BriefInput | null>(() => {
    if (mode === "paperwork") return classify(text);
    if (mode === "json") return classify(jsonText);
    const t = lookupText(lookup);
    return t ? { kind: "raw", text: t } : null;
  }, [mode, text, jsonText, lookup]);
  const lookupInvalid = mode === "supplier" && lookup.trim().length > 0 && !request;

  // Live read of the paperwork, debounced; cancels the previous request.
  useEffect(() => {
    abortRef.current?.abort();
    if (!request || request.kind === "case") {
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
        .preflight(request.kind === "raw" ? { raw_text: request.text, case_id: "live", rules_only: false } : { dossier: request.dossier, rules_only: false }, ctrl.signal)
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
  }, [request]);

  const investigate = useCallback(() => {
    if (request) p.onInvestigate(request);
  }, [request, p]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const single = mode === "supplier";
    if ((single && e.key === "Enter") || ((e.metaKey || e.ctrlKey) && e.key === "Enter")) {
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
    if (!parts.length) return;
    const joined = parts.join("\n---\n");
    if (mode === "json" || (parts.length === 1 && parts[0].trim().startsWith("{"))) {
      setMode("json");
      setJsonText(joined);
    } else {
      setMode("paperwork");
      setText((prev) => [prev.trim(), joined].filter(Boolean).join("\n---\n"));
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void readFiles(e.dataTransfer.files);
  };

  const ready = request !== null && !p.busy;
  const snapshotAge = Math.round((Date.now() - SNAPSHOT.getTime()) / 86_400_000);
  const awaiting = p.historyList.filter((r) => r.status === "awaiting");
  const recent = p.historyList.filter((r) => r.status !== "awaiting").slice(0, 5);
  const demoFiles = DEMO_ORDER.filter((f) => p.cases.some((c) => c.file === f));
  const demoFile = demoFiles.length ? demoFiles[demoIndex % demoFiles.length] : p.cases[0]?.file;
  const demo = p.cases.find((c) => c.file === demoFile);
  const filteredCases = p.cases.filter((c) => category === "ALL" || c.expected === category);
  const submitLabel = mode === "supplier" ? "Run identity checks" : pf ? `Investigate · ${pf.runnable} checks` : "Investigate";

  return (
    <div className="relative isolate">
      {/* The desk: ruled paper under the composer, one lamp over the headline. */}
      <div aria-hidden className="desk-lamp pointer-events-none fixed inset-0 -z-10" />
      <div aria-hidden className="desk-rule pointer-events-none fixed inset-x-0 top-14 bottom-0 -z-10 opacity-70" />

      <m.div className="mx-auto w-full max-w-4xl space-y-7 pt-4 sm:pt-8" variants={stack} initial="hidden" animate="show">
        <m.div variants={rise} className="space-y-2">
          <p className="eyebrow">
            Good {partOfDay()} · registry snapshot 22 Jul 2026, {snapshotAge} days old · 3.67M companies · offline
          </p>
          <HeroSequence />
        </m.div>

        {/* The sheet. */}
        <m.section
          variants={rise}
          className={`sheet relative overflow-hidden transition-[border-color,box-shadow] ${dragging ? "border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,.25)]" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          aria-label="Start an investigation"
        >
          {pfLoading && <BorderBeam radius={12} duration={3} />}
          <div className="sheet-head">
            <div role="tablist" aria-label="How to start" className="flex items-center gap-5">
              {MODES.map(({ key, label, Icon }) => (
                <button key={key} role="tab" type="button" aria-selected={mode === key} onClick={() => setMode(key)} className="utab">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {mode !== "supplier" && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                <UploadIcon className="h-3.5 w-3.5" />
                Upload files
                <input type="file" accept=".txt,.md,.json,text/plain,application/json" multiple className="sr-only" onChange={(e) => e.target.files && void readFiles(e.target.files)} />
              </label>
            )}
          </div>

          {mode === "paperwork" && (
            <>
              <label htmlFor="brief" className="sr-only">
                Paperwork for one lot
              </label>
              <textarea
                id="brief"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKey}
                rows={text ? Math.min(14, Math.max(5, text.split("\n").length + 1)) : 5}
                placeholder={dragging ? "Drop to read" : "Paste the certificate, invoice and dispatch note for one lot, or drop the files. A line of --- separates documents."}
                className="block w-full resize-none bg-transparent px-5 py-4 font-mono text-[12.5px] leading-relaxed text-slate-900 outline-none placeholder:font-sans placeholder:text-[13.5px] placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </>
          )}
          {mode === "json" && (
            <>
              <label htmlFor="brief-json" className="sr-only">
                Dossier JSON
              </label>
              <textarea
                id="brief-json"
                autoFocus
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                onKeyDown={onKey}
                rows={jsonText ? Math.min(14, Math.max(5, jsonText.split("\n").length + 1)) : 5}
                placeholder={'{"case_id": "jury-1", "documents": [{"doc_id": "DOC-1", "doc_type": "tax_invoice", "date": "2026-08-01", "text": "…"}]}'}
                className="block w-full resize-none bg-transparent px-5 py-4 font-mono text-[12.5px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </>
          )}
          {mode === "supplier" && (
            <>
              <label htmlFor="brief-lookup" className="sr-only">
                Supplier identifier
              </label>
              <input
                id="brief-lookup"
                autoFocus
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                onKeyDown={onKey}
                spellCheck={false}
                placeholder="A CIN, LLPIN or GST number, e.g. U29309TN1997PTC039462"
                className="block h-16 w-full bg-transparent px-5 font-mono text-[13px] text-slate-900 outline-none placeholder:font-sans placeholder:text-[13.5px] placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
              <input type="checkbox" checked={p.rulesOnly} onChange={(e) => p.onRulesOnly(e.target.checked)} className="h-3.5 w-3.5 accent-blue-600" />
              Rules only, skip the reasoning agent
            </label>
            {lookupInvalid && <span className="text-[11.5px] text-amber-700 dark:text-amber-400">That is not a CIN, LLPIN or GST number yet.</span>}
            {p.error && (
              <span role="alert" className="text-[11.5px] text-rose-700 dark:text-rose-300">
                {p.error}
              </span>
            )}
            <div className="flex-1" />
            <span className="hidden font-mono text-[11px] text-slate-400 sm:inline">{mode === "supplier" ? "Enter" : "Ctrl+Enter"}</span>
            <button type="button" onClick={investigate} disabled={!ready} className="btn btn-primary">
              {p.busy ? <SpinnerIcon className="h-3.5 w-3.5" /> : <PlayIcon className="h-3 w-3" />}
              {submitLabel}
            </button>
          </div>

          {mode === "supplier" ? <LookupPanel data={pf} loading={pfLoading} error={pfError} /> : <PreflightPanel data={pf} loading={pfLoading && !pf} error={pfError} />}
        </m.section>

        {/* One recommendation, refreshable, not a grid. */}
        {demo && (
          <m.div variants={rise} className="flex min-h-[32px] flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              <PlayIcon className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              Watch me work
            </span>
            <span className="min-w-0">{DEMO_HOOKS[demo.file] ?? splitTitle(demo.title).lot}</span>
            <button type="button" disabled={p.busy} onClick={() => p.onInvestigate({ kind: "case", file: demo.file })} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-blue-700 hover:underline disabled:opacity-50 dark:text-blue-400">
              Run it <ArrowRightIcon className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => setDemoIndex((i) => i + 1)} aria-label="Another prepared lot" title="Another prepared lot" className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white">
              <RefreshIcon className="h-3.5 w-3.5" />
            </button>
          </m.div>
        )}

        {/* Two quiet columns: what this desk has looked at, and what it can try. */}
        <m.div variants={rise} className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-2">
          <section aria-labelledby="recent-h">
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
              <h2 id="recent-h" className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white">
                <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
                Recent lots
                <span className="font-mono text-[11px] font-normal text-slate-400">{recent.length}</span>
              </h2>
              <span className="text-[11px] text-slate-400">Kept on this machine</span>
            </div>
            {awaiting.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/60 px-1 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="px-2 pt-2 text-[11px] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">Waiting on documents</p>
                <div className="divide-y divide-amber-200/60 dark:divide-amber-900/40">
                  {awaiting.map((r) => (
                    <Row key={r.id} onClick={() => p.onReopen(r)} glyph={<BuildingIcon className="h-4 w-4" />} title={r.supplier ?? r.title} sub={`Needs ${r.awaiting ? r.awaiting.replace(/\.$/, "").toLowerCase() : "a document"}`} right={null} meta={timeAgo(r.at)} action={r.caseFile ? "Re-run" : "Open"} />
                  ))}
                </div>
              </div>
            )}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {recent.map((r) => (
                <Row key={r.id} onClick={() => p.onReopen(r)} glyph={<ClockIcon className="h-4 w-4" />} title={r.supplier ?? r.title} sub={`${r.title} · ${r.contradictions} contradiction${r.contradictions === 1 ? "" : "s"}`} right={<span className={`chip ${VERDICT_STYLE[r.verdict].chip}`}>{r.verdict.charAt(0) + r.verdict.slice(1).toLowerCase()}</span>} meta={timeAgo(r.at)} action={r.caseFile ? "Run again" : "Open"} />
              ))}
              {recent.length === 0 && <p className="py-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Nothing yet. Every lot you investigate is kept here, with its verdict and what you decided.</p>}
            </div>
          </section>

          <section aria-labelledby="prepared-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
              <h2 id="prepared-h" className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white">
                <FileIcon className="h-3.5 w-3.5 text-slate-400" />
                Prepared lots
                <span className="font-mono text-[11px] font-normal text-slate-400">{filteredCases.length}</span>
              </h2>
              <div className="flex items-center gap-0.5">
                {(["ALL", "GENUINE", "SUSPECT", "UNVERIFIABLE"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setCategory(t)} aria-pressed={category === t} className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${category === t ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <p className="pt-2 text-[11.5px] text-slate-500 dark:text-slate-400">Real registry records, one click each. Aliased where a real company must not be cast as a counterfeiter.</p>
            <div className="relative mt-1">
              <div className="max-h-[392px] overflow-y-auto pb-7" style={{ scrollbarWidth: "thin" }}>
                {CASE_GROUPS.filter((g) => category === "ALL" || category === g.v).map((g) => {
                  const lots = p.cases.filter((c) => c.expected === g.v);
                  if (!lots.length) return null;
                  return (
                    <div key={g.v}>
                      <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-slate-50/95 py-1.5 backdrop-blur-sm dark:bg-slate-950/95">
                        <span className={`h-2 w-2 shrink-0 self-center rounded-full ${g.dot}`} aria-hidden="true" />
                        <span className="text-[12px] font-semibold text-slate-900 dark:text-white">{g.title}</span>
                        <span className="font-mono text-[11px] text-slate-400">{lots.length}</span>
                        <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{g.hint}</span>
                      </div>
                      <ul className="space-y-1 pb-3">
                        {lots.map((c) => {
                          const { lot, who } = splitTitle(c.title);
                          return (
                            <li key={c.file}>
                              <button type="button" disabled={p.busy} onClick={() => p.onInvestigate({ kind: "case", file: c.file })} className="group relative flex w-full items-start gap-3 rounded-md border border-transparent py-2 pr-2 pl-3 text-left transition-colors hover:border-slate-200 hover:bg-white disabled:opacity-60 dark:hover:border-slate-700 dark:hover:bg-slate-900">
                                <span className={`absolute top-2 bottom-2 left-0 w-0.5 rounded-full ${g.rail}`} aria-hidden="true" />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] leading-snug font-medium text-slate-900 dark:text-slate-100">{LOT_TWISTS[c.file] ?? lot}</span>
                                  <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                                    {lot} · {who.replace(/\s*\(.*\)$/, "")}
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2 pt-0.5">
                                  <span className="font-mono text-[11px] text-slate-400 group-hover:hidden">{c.documents} doc{c.documents === 1 ? "" : "s"}</span>
                                  <span className="hidden items-center gap-1 text-[12px] font-semibold text-blue-700 group-hover:inline-flex dark:text-blue-400">
                                    Run <ArrowRightIcon className="h-3 w-3" />
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-50 to-transparent dark:from-slate-950" />
            </div>
          </section>
        </m.div>

        <m.div variants={rise}>
          <BringYourOwn busy={p.busy} onInvestigate={p.onInvestigate} />
        </m.div>

      </m.div>
    </div>
  );
}

/** The prepared lots prove the pipeline runs; this proves they are not canned
 *  replays. A reviewer downloads a set of real documents, drops it into the
 *  composer above, and watches the same verdict come back from raw text. The
 *  verdict key sits here too, because UNVERIFIABLE reads as a failure to
 *  anyone who has not been told that abstaining is the designed behaviour. */
function BringYourOwn(p: { busy: boolean; onInvestigate: (i: BriefInput) => void }) {
  const [sets, setSets] = useState<SampleSet[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api.samples().then((s) => live && setSets(s)).catch(() => live && setSets([]));
    return () => { live = false; };
  }, []);

  // Load the text and run it through the same raw-text path a paste uses, so
  // what the reviewer sees is genuinely the unprepared route.
  const run = useCallback(async (s: SampleSet) => {
    setLoading(s.file);
    try {
      const text = await fetch(s.url).then((r) => r.text());
      p.onInvestigate({ kind: "raw", text });
    } finally {
      setLoading(null);
    }
  }, [p]);

  if (!sets || sets.length === 0) return null;

  return (
    <section aria-labelledby="byo-h" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        <h2 id="byo-h" className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white">
          <UploadIcon className="h-3.5 w-3.5 text-slate-400" />
          Check the work yourself
        </h2>
        <a href="/samples/README.md" className="text-[11px] font-medium text-blue-700 hover:underline dark:text-blue-400">
          What each set contains
        </a>
      </div>
      <p className="pt-2 text-[11.5px] text-slate-500 dark:text-slate-400">
        Real documents, not prepared cases. Run one as raw text, or download it and paste it into the composer above to see the same verdict reached from scratch.
      </p>

      <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {sets.map((s) => (
          <li key={s.file}>
            <div className="group flex items-center gap-3 rounded-md border border-transparent py-2 pr-2 pl-3 transition-colors hover:border-slate-200 hover:bg-white dark:hover:border-slate-700 dark:hover:bg-slate-900">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-snug font-medium text-slate-900 dark:text-slate-100">{s.label}</span>
                <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
                  should read {s.expected ? s.expected.toLowerCase() : "—"}
                </span>
              </span>
              <a href={s.url} download className="shrink-0 text-[11.5px] font-medium text-slate-500 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white">
                Download
              </a>
              <button type="button" disabled={p.busy} onClick={() => void run(s)} className="shrink-0 rounded-md px-2 py-0.5 text-[12px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950/40">
                {loading === s.file ? "Loading…" : "Run as text"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 border-t border-slate-200 pt-4 sm:grid-cols-3 dark:border-slate-800">
        {([
          ["GENUINE", "The available records support the submitted documentary claims within the checks performed."],
          ["SUSPECT", "The records contradict the documents. The verdict names which check decided it."],
          ["UNVERIFIABLE", "Not a failure: the evidence does not settle it, so the system abstains and names the one document that would."],
        ] as const).map(([v, meaning]) => (
          <div key={v}>
            <dt className={`text-[11px] font-semibold tracking-wide uppercase ${VERDICT_STYLE[v].word}`}>{v}</dt>
            <dd className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">{meaning}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** One line at a time, each stage in turn, with a rail that fills as the
 *  sequence runs. Hover pauses it; a click jumps; reduced motion shows all
 *  five lines at once instead of cycling. */
function HeroSequence() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (reduce || paused) return;
    const t = setTimeout(() => setI((x) => (x + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(t);
  }, [i, paused, reduce]);

  if (reduce) {
    return (
      <ol className="space-y-1">
        {STEPS.map((st, idx) => (
          <li key={st.key} className="font-display text-[22px] leading-tight font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
            <span className="mr-2 font-mono text-[12px] font-medium text-slate-400">0{idx + 1}</span>
            {st.line}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="space-y-4" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="min-h-[2.3em] sm:min-h-[2.4em]">
        <m.h1
          key={i}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="font-display max-w-[24ch] text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-slate-900 text-balance sm:text-[34px] dark:text-white"
          aria-live="polite"
        >
          {STEPS[i].line}
        </m.h1>
      </div>
      <ol className="flex flex-wrap gap-x-5 gap-y-2" aria-label="How a run works">
        {STEPS.map((st, idx) => {
          const state = idx < i ? "done" : idx === i ? "active" : "todo";
          return (
            <li key={st.key}>
              <button type="button" onClick={() => setI(idx)} aria-current={state === "active" ? "step" : undefined} className="group flex min-w-[112px] flex-col gap-1.5 text-left">
                <span className={`flex items-center gap-1.5 text-[11.5px] font-medium transition-colors ${state === "active" ? "text-slate-900 dark:text-white" : state === "done" ? "text-slate-500 dark:text-slate-400" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"}`}>
                  <span className="font-mono text-[10.5px]">0{idx + 1}</span>
                  {st.label}
                </span>
                <span className="block h-0.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <m.span
                    key={`${idx}-${state}-${paused}`}
                    className={`block h-full origin-left rounded-full ${state === "todo" ? "bg-transparent" : "bg-slate-900 dark:bg-white"}`}
                    initial={{ scaleX: state === "done" ? 1 : 0 }}
                    animate={{ scaleX: state === "todo" ? 0 : 1 }}
                    transition={state === "active" && !paused ? { duration: STEP_MS / 1000, ease: "linear" } : { duration: 0.25 }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Row({ glyph, title, sub, right, meta, action, onClick, disabled }: { glyph: React.ReactNode; title: string; sub: string; right: React.ReactNode; meta: string; action: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="group flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-slate-800/50">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{glyph}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-slate-900 dark:text-slate-100">{title}</span>
          <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">{sub}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {right}
        <span className="font-mono text-[11px] tabular-nums text-slate-400 group-hover:hidden">{meta}</span>
        <span className="hidden items-center gap-1 text-[12px] font-semibold text-blue-700 group-hover:inline-flex dark:text-blue-400">
          {action} <ArrowRightIcon className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

/** The supplier-lookup read: the registry record, before any run. */
function LookupPanel({ data, loading, error }: { data: PreflightData | null; loading: boolean; error: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {(data || loading || error) && (
        <m.div key="lk" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
          <div className="border-t border-slate-200 px-5 py-4 text-[13px] dark:border-slate-800">
            {loading && !data && (
              <p className="text-xs">
                <ShimmerText>Looking the supplier up…</ShimmerText>
              </p>
            )}
            {error && <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
            {data && (
              <div className="space-y-2">
                {data.registry ? (
                  <>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {titleCase(data.registry.name.toLowerCase())}
                      <span className={`ml-2 chip ${(data.registry.status ?? "").toLowerCase() === "active" ? "chip-gen" : "chip-unv"}`}>{data.registry.status ?? "status unknown"}</span>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Registered {formatDate(data.registry.registration_date)}
                      {data.registry.state_name ? ` in ${titleCase(data.registry.state_name)}` : ""}
                      {data.registry.nic_code ? ` · activity code ${data.registry.nic_code}${data.registry.nic_code.startsWith("45") ? " (parts trade, not manufacturing)" : ""}` : ""}.
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Run the identity checks for the full read: registry match, status, activity, and how much a lot from this supplier can be verified without its paperwork.</p>
                  </>
                ) : data.identifiers.gstin ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300">A GST number on its own can be checked for its checksum, state code and embedded PAN. The registry is keyed by CIN, so add the CIN for the company record.</p>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Not in the MCA registry snapshot of 22 Jul 2026. I will treat that as a gap, not proof; companies registered since then are unknown here.</p>
                )}
              </div>
            )}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
