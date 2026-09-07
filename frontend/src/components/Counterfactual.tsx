import type { AnalysisResult } from "../types";
import { checkLabel } from "../labels";
import { Section } from "./Section";

/** What would have to be different for the answer to be different.
 *
 *  Computed by re-running stage 5 with one finding struck out at a time, so
 *  it is produced by the same governance rules that produced the verdict and
 *  can never disagree with it. When no single row moves the answer, that is
 *  the honest result and it is shown as prominently as a decisive row. */
export function Counterfactual({ result: r }: { result: AnalysisResult }) {
  const cf = r.counterfactual;
  if (!cf) return null;
  const decisive = cf.decisive;

  return (
    <Section
      title="What would change this verdict"
      aside={decisive.length ? `${decisive.length} load-bearing finding${decisive.length === 1 ? "" : "s"}` : `${cf.considered} findings, none decisive alone`}
    >
      <div className="space-y-3 text-[13px]">
        {decisive.length > 0 ? (
          <>
            <p className="text-slate-600 dark:text-slate-400">{cf.note}</p>
            <ul className="space-y-2">
              {decisive.map((d, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium text-slate-900 dark:text-white">{checkLabel(d.check)}</span>
                    <span className="chip chip-src">{d.source_tier} · {d.strength}</span>
                  </div>
                  <p className="mt-1.5 text-slate-700 dark:text-slate-300">
                    Remove this one finding and the verdict becomes{" "}
                    <span className="font-semibold text-slate-900 dark:text-white">{d.becomes}</span>.
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
            {cf.note}
          </p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">{cf.method}</p>
      </div>
    </Section>
  );
}
