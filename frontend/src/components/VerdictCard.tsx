import type { CSSProperties, ReactNode } from "react";
import * as m from "motion/react-m";
import { stagger, type Variants } from "motion/react";
import type { AnalysisResult } from "../types";
import { SUBTYPE_LABELS, VERDICT_STYLE, formatDate, humanize, splitEvidence, titleCase, verdictSentence } from "../labels";
import { CountUp, LetterReveal, Spotlight, TextGenerate } from "./effects";
import { CpuIcon, FileIcon } from "./Icons";

interface Props {
  result: AnalysisResult;
}

const AURORA: Record<AnalysisResult["verdict"], { a: string; b: string; spot: string }> = {
  GENUINE: { a: "rgba(16,185,129,.22)", b: "rgba(59,130,246,.14)", spot: "rgba(16,185,129,.14)" },
  SUSPECT: { a: "rgba(244,63,94,.22)", b: "rgba(249,115,22,.14)", spot: "rgba(244,63,94,.14)" },
  UNVERIFIABLE: { a: "rgba(245,158,11,.22)", b: "rgba(59,130,246,.12)", spot: "rgba(245,158,11,.14)" },
};

const list: Variants = { hidden: {}, show: { transition: { delayChildren: stagger(0.06, { startDelay: 0.3 }) } } };
const item: Variants = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } } };

function Row({ k, children, mono = false }: { k: string; children: ReactNode; mono?: boolean }) {
  return (
    <m.div variants={item} className="grid grid-cols-[100px_1fr] items-baseline gap-2 text-xs">
      <span className="text-slate-500 dark:text-slate-400 font-medium">{k}</span>
      <span className={mono ? "font-mono font-semibold text-slate-900 dark:text-slate-100" : "font-semibold text-slate-900 dark:text-slate-100"}>{children}</span>
    </m.div>
  );
}

export function VerdictCard({ result: r }: Props) {
  const s = VERDICT_STYLE[r.verdict];
  const glow = AURORA[r.verdict];
  const { primary, weaker, suspect, support } = splitEvidence(r.ledger.findings);
  const decisive = primary.filter((f) => f.strength === "dispositive").length;
  const total = r.ledger.findings.length;
  const row = r.registry_row;
  const status = row?.status?.trim() ?? null;
  const statusBad = status !== null && status.toLowerCase() !== "active";
  const nic = row?.nic_code ?? null;
  const trader = nic?.startsWith("45");

  return (
    <m.section
      className="panel relative overflow-hidden"
      aria-labelledby="verdict-word"
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", visualDuration: 0.45, bounce: 0.15 }}
    >
      <span aria-hidden="true" className="aurora pointer-events-none absolute -inset-10 opacity-60" style={{ "--aurora-a": glow.a, "--aurora-b": glow.b } as CSSProperties} />
      <Spotlight color={glow.spot} />

      {/* Top Agentic Intelligence Telemetry Header */}
      <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-3 dark:border-slate-800 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
          <CpuIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>AGENTIC INTELLIGENCE BRIEF</span>
          <span className="rounded bg-slate-200/80 px-2 py-0.5 font-mono text-[10.5px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Case: {r.case_id}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
          <span>3.67M MCA Registry Queryed</span>
          {r.elapsed_ms !== undefined && <span className="rounded bg-slate-200/60 px-2 py-0.5 dark:bg-slate-800">{r.elapsed_ms} ms compute</span>}
        </div>
      </div>

      {/* 2-Column Split Command Center Layout */}
      <div className={`relative flex flex-col md:flex-row border-l-4 ${s.bar}`}>
        {/* Left Column: Executive Synthesis & Verification Matrix */}
        <div className="flex flex-1 flex-col justify-between gap-5 p-6 md:p-7">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Verdict Summary</span>
              {r.subtype && <span className={`chip ${s.chip}`}>{SUBTYPE_LABELS[r.subtype]}</span>}
            </div>

            <h2 id="verdict-word" className={`font-mono text-4xl font-bold tracking-tight ${s.word}`}>
              <LetterReveal text={r.verdict} />
            </h2>

            <p className="max-w-[58ch] text-[15px] leading-relaxed font-medium text-slate-900 text-pretty dark:text-slate-100">
              <TextGenerate text={verdictSentence(r)} />
            </p>
          </div>

          {/* 4-Dimension Check Matrix Summary */}
          <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 dark:border-slate-800/80 dark:bg-slate-950/40">
              <span className="block text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">1. Identity</span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                {row ? "Registry Verified" : "No Registry Record"}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 dark:border-slate-800/80 dark:bg-slate-950/40">
              <span className="block text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">2. Certification</span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                {r.verdict === "GENUINE" ? "BIS Valid" : "Audit Signals"}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 dark:border-slate-800/80 dark:bg-slate-950/40">
              <span className="block text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">3. Logistics</span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                {r.verdict === "GENUINE" ? "Route Plausible" : "Custody Checked"}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 dark:border-slate-800/80 dark:bg-slate-950/40">
              <span className="block text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">4. Tampering</span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-900 dark:text-slate-100">
                {r.injection_flags.length ? "Injection Flagged" : "Hygiene Passed"}
              </span>
            </div>
          </div>

          {/* Evidence Count Badges */}
          <m.div className="flex flex-wrap items-center gap-2 pt-1" variants={list} initial="hidden" animate="show">
            {r.verdict !== "GENUINE" && (
              <m.span variants={item} className={`chip ${suspect.length ? "chip-sus" : "chip-neu"}`}>
                <CountUp value={suspect.length} />
                &nbsp;of {total} checks contradict records
              </m.span>
            )}
            {r.verdict === "SUSPECT" && (
              <m.span variants={item} className="chip chip-neu">
                {[decisive ? `${decisive} decisive` : null, primary.length - decisive ? `${primary.length - decisive} strong` : null, weaker.length ? `${weaker.length} weaker` : null].filter(Boolean).join(" · ")}
              </m.span>
            )}
            {r.verdict === "GENUINE" && (
              <m.span variants={item} className="chip chip-gen">
                <CountUp value={r.counts.supports_genuine || support.length} />
                &nbsp;checks support the documents
              </m.span>
            )}
            <m.span variants={item} className="text-xs text-slate-500 dark:text-slate-400">
              {r.rules_only ? "Deterministic checks only" : "All 5 pipeline stages evaluated"}
            </m.span>
          </m.div>
        </div>

        {/* Right Column: MCA Registry Inspector Panel */}
        <m.div className="flex flex-col justify-center gap-3 border-t border-slate-200/80 bg-slate-50/60 p-6 md:w-[360px] md:border-t-0 md:border-l dark:border-slate-800 dark:bg-slate-950/50" variants={list} initial="hidden" animate="show">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <FileIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">MCA REGISTRY DOSSIER</span>
          </div>

          {row ? (
            <>
              <Row k="Supplier">{titleCase(row.name.toLowerCase())}</Row>
              <Row k="CIN" mono>
                {row.cin}
              </Row>
              <Row k="Registry">
                <span className={statusBad ? "font-semibold text-amber-700 dark:text-amber-400" : "font-semibold text-emerald-600 dark:text-emerald-400"}>{status ?? "status unknown"}</span>
                {" · inc. "}
                {formatDate(row.registration_date)}
                {row.state_name ? ` · ${titleCase(row.state_name)}` : ""}
              </Row>
              {nic && (
                <Row k="Activity">
                  <span className={trader ? "font-semibold text-rose-600 dark:text-rose-400" : ""}>{trader ? "Parts trader" : (row.industry ?? "Manufacturer")}</span>
                  {` (NIC ${nic})`}
                </Row>
              )}
            </>
          ) : (
            <m.p variants={item} className="text-xs text-slate-500 dark:text-slate-400">
              No registry record was found for the identifier in these documents.
            </m.p>
          )}
        </m.div>
      </div>

      {/* Unverifiable Work-Order Block */}
      {r.verdict === "UNVERIFIABLE" && (
        <m.div className="relative space-y-3 border-t border-slate-200/80 bg-amber-50/60 p-6 dark:border-slate-800 dark:bg-amber-950/30" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.35 }}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-l-[3px] border-slate-200 border-l-amber-500 bg-white/90 p-3.5 dark:border-slate-800 dark:border-l-amber-500 dark:bg-slate-950/70">
              <span className="eyebrow block text-amber-700 dark:text-amber-400">Decisive Missing Artefact</span>
              <p className="mt-1 text-[13px] leading-relaxed font-medium">{r.missing_artefact}</p>
            </div>
            <div className="rounded-lg border border-l-[3px] border-slate-200 border-l-amber-500 bg-white/90 p-3.5 dark:border-slate-800 dark:border-l-amber-500 dark:bg-slate-950/70">
              <span className="eyebrow block text-amber-700 dark:text-amber-400">Interim Desk Action</span>
              <p className="mt-1 text-[13px] leading-relaxed font-medium">{r.interim_action}</p>
            </div>
          </div>
          {r.lean && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="chip chip-unv">{r.lean.direction === "none" ? "No directional lean" : `Leans ${r.lean.direction} · ${r.lean.confidence} confidence`}</span>
              <span>{humanize(r.lean.basis)}</span>
            </p>
          )}
        </m.div>
      )}
    </m.section>
  );
}
