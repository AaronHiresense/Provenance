import { useState } from "react";
import type { AnalysisResult, Dossier } from "../types";
import { ChevronIcon } from "./Icons";
import { Section } from "./Section";

interface Props {
  dossier: Dossier | null;
  result: AnalysisResult;
}

/** The documents as handed in, plus the typed claims read out of them. Closed
 *  by default: this is the audit trail's raw material, not the answer. */
export function SourceDocs({ dossier, result: r }: Props) {
  const [open, setOpen] = useState(false);
  const docs = dossier?.documents ?? [];
  return (
    <Section
      title="Source documents and extracted claims"
      aside={
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline dark:text-blue-400">
          {open ? "Hide" : "Show"} <ChevronIcon open={open} className="h-3.5 w-3.5" />
        </button>
      }
    >
      {open && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {docs.length === 0 && <p className="text-xs text-slate-500">Documents were pasted directly; the text is not stored with the result.</p>}
            {docs.map((d) => (
              <div key={d.doc_id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {d.doc_id} · {d.doc_type.replace(/_/g, " ")}
                  </span>
                  <span>{d.date ?? "undated"}</span>
                </div>
                <pre className="mt-2 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{d.text}</pre>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60">
                <tr>
                  {["Claim", "Value", "About", "From"].map((h) => (
                    <th key={h} className="eyebrow px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {r.assertions.map((a, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{a.attribute.replace(/_/g, " ")}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-slate-900 dark:text-slate-100">{a.value}</td>
                    <td className="px-3 py-1.5 text-slate-500">{a.entity}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500">{a.source_doc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}
