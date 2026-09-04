import type { AnalysisResult } from "../types";
import { AlertIcon, InfoIcon } from "./Icons";

export function Notices({ result: r }: { result: AnalysisResult }) {
  const inj = r.injection_flags;
  const dropped = r.extraction.dropped_assertions;
  if (!inj.length && !r.aliased && !dropped && r.extraction.engine === "llm") return null;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {inj.length > 0 && (
        <div className="flex gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 md:col-span-2 dark:border-rose-900/50 dark:bg-rose-950/30">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <div className="space-y-1.5 text-xs">
            <p className="font-semibold text-rose-700 dark:text-rose-300">A document tried to instruct the reviewer</p>
            <p className="text-slate-600 dark:text-slate-300">Removed before analysis and logged as evidence of tampering:</p>
            {inj.map((f, i) => (
              <p key={i} className="rounded border border-rose-200 bg-white/70 px-2.5 py-1.5 font-mono text-[11px] text-rose-800 dark:border-rose-900/50 dark:bg-slate-950/50 dark:text-rose-200">
                {f.source_doc} › "{f.content}"
              </p>
            ))}
          </div>
        </div>
      )}
      {r.aliased && (
        <div className="flex gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-blue-800 dark:text-blue-300">Company names in this case are aliased</p>
            <p className="text-slate-600 dark:text-slate-300">Checks ran on the real registry record. CINs are real and independently verifiable; only display names are replaced.</p>
          </div>
        </div>
      )}
      {(dropped > 0 || r.extraction.engine !== "llm") && (
        <div className="flex gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-slate-800 dark:text-slate-200">How the documents were read</p>
            <p className="text-slate-600 dark:text-slate-300">
              {r.extraction.engine === "llm" ? "Claims were extracted by the language model." : "No model was available, so claims were read with the label parser."}
              {dropped > 0 ? ` ${dropped} claim${dropped === 1 ? "" : "s"} used an attribute the checks do not understand and ${dropped === 1 ? "was" : "were"} set aside.` : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
