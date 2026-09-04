import type { AnalysisResult } from "../types";
import { SUBTYPE_LABELS, VERDICT_STYLE, formatDate, humanize, splitEvidence, titleCase, verdictSentence } from "../labels";

interface Props {
  result: AnalysisResult;
}

function Row({ k, children, mono = false }: { k: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-2.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">{k}</span>
      <span className={mono ? "font-mono text-xs text-slate-900 dark:text-slate-100" : "text-[13px] text-slate-900 dark:text-slate-100"}>{children}</span>
    </div>
  );
}

export function VerdictCard({ result: r }: Props) {
  const s = VERDICT_STYLE[r.verdict];
  const { primary, weaker, suspect } = splitEvidence(r.ledger.findings);
  const decisive = primary.filter((f) => f.strength === "dispositive").length;
  const total = r.ledger.findings.length;
  const row = r.registry_row;
  const status = row?.status?.trim() ?? null;
  const statusBad = status !== null && status.toLowerCase() !== "active";
  const nic = row?.nic_code ?? null;
  const trader = nic?.startsWith("45");

  return (
    <section className="panel overflow-hidden" aria-labelledby="verdict-word">
      <div className={`flex flex-col border-l-4 bg-gradient-to-r to-transparent to-55% md:flex-row ${s.bar} ${s.tint}`}>
        <div className="flex flex-1 flex-col gap-2 px-6 py-6 md:px-7">
          <span className="eyebrow">Verdict</span>
          <h2 id="verdict-word" className={`font-mono text-4xl font-bold tracking-wide ${s.word}`}>
            {r.verdict}
          </h2>
          <p className="max-w-[56ch] text-[15px] leading-relaxed font-medium text-slate-900 text-pretty dark:text-slate-100">{verdictSentence(r)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {r.subtype && <span className={`chip ${s.chip}`}>{SUBTYPE_LABELS[r.subtype]}</span>}
            {r.verdict !== "GENUINE" && (
              <span className={`chip ${suspect.length ? "chip-sus" : "chip-neu"}`}>
                {suspect.length} of {total} checks contradict records
              </span>
            )}
            {r.verdict === "SUSPECT" && (
              <span className="chip chip-neu">
                {[decisive ? `${decisive} decisive` : null, primary.length - decisive ? `${primary.length - decisive} strong` : null, weaker.length ? `${weaker.length} weaker` : null].filter(Boolean).join(" · ")}
              </span>
            )}
            {r.verdict === "GENUINE" && <span className="chip chip-gen">{r.counts.supports_genuine} checks support the documents</span>}
            <span className="text-xs text-slate-500 dark:text-slate-400">{r.rules_only ? "Deterministic checks only, reasoning skipped" : "All steps ran, including reasoning"}</span>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-2.5 border-t border-slate-200 px-6 py-5 md:w-[360px] md:border-t-0 md:border-l dark:border-slate-800">
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
            <p className="text-xs text-slate-500 dark:text-slate-400">No registry record was found for the identifier in these documents.</p>
          )}
        </div>
      </div>

      {r.verdict === "UNVERIFIABLE" && (
        <div className="space-y-3 border-t border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-l-[3px] border-slate-200 border-l-amber-500 bg-slate-50 p-3.5 dark:border-slate-800 dark:border-l-amber-500 dark:bg-slate-950/60">
              <span className="eyebrow block text-amber-700 dark:text-amber-400">The one document that decides it</span>
              <p className="mt-1 text-[13px] leading-relaxed">{r.missing_artefact}</p>
            </div>
            <div className="rounded-lg border border-l-[3px] border-slate-200 border-l-amber-500 bg-slate-50 p-3.5 dark:border-slate-800 dark:border-l-amber-500 dark:bg-slate-950/60">
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
        </div>
      )}
    </section>
  );
}
