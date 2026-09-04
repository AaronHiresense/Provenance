import type { CSSProperties, ReactNode } from "react";
import * as m from "motion/react-m";
import { stagger, type Variants } from "motion/react";
import type { AnalysisResult } from "../types";
import { SUBTYPE_LABELS, VERDICT_STYLE, formatDate, humanize, splitEvidence, titleCase, verdictSentence } from "../labels";
import { CountUp, LetterReveal, Spotlight, TextGenerate } from "./effects";

interface Props {
  result: AnalysisResult;
}

const AURORA: Record<AnalysisResult["verdict"], { a: string; b: string; spot: string }> = {
  GENUINE: { a: "rgba(16,185,129,.28)", b: "rgba(59,130,246,.18)", spot: "rgba(16,185,129,.16)" },
  SUSPECT: { a: "rgba(244,63,94,.28)", b: "rgba(249,115,22,.16)", spot: "rgba(244,63,94,.16)" },
  UNVERIFIABLE: { a: "rgba(245,158,11,.28)", b: "rgba(59,130,246,.14)", spot: "rgba(245,158,11,.16)" },
};

const list: Variants = { hidden: {}, show: { transition: { delayChildren: stagger(0.08, { startDelay: 0.5 }) } } };
const item: Variants = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } } };

function Row({ k, children, mono = false }: { k: string; children: ReactNode; mono?: boolean }) {
  return (
    <m.div variants={item} className="grid grid-cols-[110px_1fr] items-baseline gap-2.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">{k}</span>
      <span className={mono ? "font-mono text-xs text-slate-900 dark:text-slate-100" : "text-[13px] text-slate-900 dark:text-slate-100"}>{children}</span>
    </m.div>
  );
}

export function VerdictCard({ result: r }: Props) {
  const s = VERDICT_STYLE[r.verdict];
  const glow = AURORA[r.verdict];
  const { primary, weaker, suspect } = splitEvidence(r.ledger.findings);
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
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", visualDuration: 0.5, bounce: 0.18 }}
    >
      <span aria-hidden="true" className="aurora pointer-events-none absolute -inset-10 opacity-70" style={{ "--aurora-a": glow.a, "--aurora-b": glow.b } as CSSProperties} />
      <Spotlight color={glow.spot} />
      <div className={`relative flex flex-col border-l-4 md:flex-row ${s.bar}`}>
        <div className="flex flex-1 flex-col gap-2 px-6 py-6 md:px-7">
          <m.span className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            Verdict
          </m.span>
          <h2 id="verdict-word" className={`font-mono text-4xl font-bold tracking-wide ${s.word}`}>
            <LetterReveal text={r.verdict} />
          </h2>
          <p className="max-w-[56ch] text-[15px] leading-relaxed font-medium text-slate-900 text-pretty dark:text-slate-100">
            <TextGenerate text={verdictSentence(r)} />
          </p>
          <m.div className="mt-1 flex flex-wrap items-center gap-2" variants={list} initial="hidden" animate="show">
            {r.subtype && (
              <m.span variants={item} className={`chip ${s.chip}`}>
                {SUBTYPE_LABELS[r.subtype]}
              </m.span>
            )}
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
                <CountUp value={r.counts.supports_genuine} />
                &nbsp;checks support the documents
              </m.span>
            )}
            <m.span variants={item} className="text-xs text-slate-500 dark:text-slate-400">
              {r.rules_only ? "Deterministic checks only, reasoning skipped" : "All steps ran, including reasoning"}
              {r.elapsed_ms !== undefined ? ` · ${r.elapsed_ms} ms of compute` : ""}
            </m.span>
          </m.div>
        </div>
        <m.div className="flex flex-col justify-center gap-2.5 border-t border-slate-200/80 px-6 py-5 md:w-[360px] md:border-t-0 md:border-l dark:border-slate-800" variants={list} initial="hidden" animate="show">
          {row ? (
            <>
              <Row k="Supplier">{titleCase(row.name.toLowerCase())}</Row>
              <Row k="CIN" mono>
                {row.cin}
              </Row>
              <Row k="Registry">
                <span className={statusBad ? "font-semibold text-amber-700 dark:text-amber-400" : ""}>{status ?? "status unknown"}</span>
                {" · incorporated "}
                {formatDate(row.registration_date)}
                {row.state_name ? ` · ${titleCase(row.state_name)}` : ""}
              </Row>
              {nic && (
                <Row k="Registered as">
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

      {r.verdict === "UNVERIFIABLE" && (
        <m.div className="relative space-y-3 border-t border-slate-200/80 px-6 py-5 dark:border-slate-800" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.35 }}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-l-[3px] border-slate-200 border-l-amber-500 bg-white/80 p-3.5 dark:border-slate-800 dark:border-l-amber-500 dark:bg-slate-950/60">
              <span className="eyebrow block text-amber-700 dark:text-amber-400">The one document that decides it</span>
              <p className="mt-1 text-[13px] leading-relaxed">{r.missing_artefact}</p>
            </div>
            <div className="rounded-lg border border-l-[3px] border-slate-200 border-l-amber-500 bg-white/80 p-3.5 dark:border-slate-800 dark:border-l-amber-500 dark:bg-slate-950/60">
              <span className="eyebrow block text-amber-700 dark:text-amber-400">Until it arrives</span>
              <p className="mt-1 text-[13px] leading-relaxed">{r.interim_action}</p>
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
