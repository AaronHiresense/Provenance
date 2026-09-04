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
