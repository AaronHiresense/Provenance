import { useState } from "react";
import type { AnalysisResult } from "../types";
import { checkLabel } from "../labels";
import { Section } from "./Section";

/** The backend ships seven standing limits with every verdict plus the
 *  case-specific ones. The standing ones read as boilerplate on every run, so
 *  they live behind a disclosure; the case-specific lines stay inline. */
export function CouldNotCheck({ result: r }: { result: AnalysisResult }) {
  const [showAll, setShowAll] = useState(false);
  const caseLines = r.ledger.findings.filter((f) => /abstain|unavailable/.test(f.result.toLowerCase()));
  const standing = r.cannot_determine.filter((x) => !x.startsWith("In this case"));
  const unchecked = r.unchecked_claims ?? [];
  return (
    <Section title="What this run could not check" aside={caseLines.length ? `${caseLines.length} check${caseLines.length === 1 ? "" : "s"} produced no signal` : "Every check produced a signal"}>
      <div className="space-y-2 text-[13px]">
        {caseLines.map((f, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="chip chip-neu shrink-0">No signal</span>
            <p className="text-slate-800 dark:text-slate-200">
              <span className="font-medium">{checkLabel(f.check)}.</span> {f.detail}
            </p>
          </div>
        ))}
        {unchecked.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="font-medium text-slate-900 dark:text-white">
              {unchecked.length} claim{unchecked.length === 1 ? "" : "s"} read but not verified against an outside record
            </p>
            <ul className="mt-2 space-y-1 text-slate-700 dark:text-slate-300">
              {unchecked.map((c, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{c.attribute.replace(/_/g, " ")}:</span>
                  <span className="font-mono text-[12px]">{c.value}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">from {c.source_doc}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              No validator checks these against a record outside the dossier. They are still compared for consistency across
              documents wherever they appear more than once. Listed so that an unrecognised claim reads as unverified rather
              than as approved.
            </p>
          </div>
        )}
        <div className="pt-1 text-xs text-slate-500 dark:text-slate-400">
          Standing limits of every run (physical inspection, doctored scans, cloned genuine paperwork, GST cancellation status):{" "}
          <button type="button" onClick={() => setShowAll((v) => !v)} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
            {showAll ? "hide" : `show ${standing.length}`}
          </button>
        </div>
        {showAll && (
          <ol className="list-decimal space-y-1.5 pl-5 text-xs text-slate-600 dark:text-slate-400">
            {standing.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
        )}
      </div>
    </Section>
  );
}
