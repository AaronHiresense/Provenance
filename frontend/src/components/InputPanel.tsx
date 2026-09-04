import type { CaseSummary, Dossier } from "../types";
import { FileIcon, PlayIcon, SearchIcon, SpinnerIcon, UploadIcon } from "./Icons";

export type InputMode = "library" | "live" | "json";

interface Props {
  mode: InputMode;
  onMode: (m: InputMode) => void;
  cases: CaseSummary[];
  selectedCase: string;
  onSelectCase: (file: string) => void;
  dossier: Dossier | null;
  rawText: string;
  onRawText: (t: string) => void;
  jsonText: string;
  onJsonText: (t: string) => void;
  rulesOnly: boolean;
  onRulesOnly: (v: boolean) => void;
  busy: boolean;
  error: string | null;
  onRun: () => void;
}

const MODES: { key: InputMode; label: string; Icon: typeof FileIcon }[] = [
  { key: "library", label: "Sample case", Icon: SearchIcon },
  { key: "live", label: "Paste documents", Icon: FileIcon },
  { key: "json", label: "Dossier JSON", Icon: UploadIcon },
];

export function InputPanel(p: Props) {
  return (
    <div className="panel space-y-5 p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Investigation dossier</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Pick a prepared case, or paste the documents for one lot.</p>
      </div>

      <div role="tablist" aria-label="Input source" className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-800/80">
        {MODES.map(({ key, label, Icon }) => {
          const on = p.mode === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => p.onMode(key)}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-all ${on ? "bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {p.mode === "library" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="caseSelect" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Prepared case
            </label>
            <select id="caseSelect" value={p.selectedCase} onChange={(e) => p.onSelectCase(e.target.value)} className="field">
              {p.cases.map((c) => (
                <option key={c.file} value={c.file}>
                  {c.title} ({c.documents} {c.documents === 1 ? "doc" : "docs"})
                </option>
              ))}
            </select>
          </div>
          {p.dossier?.documents && (
            <div className="space-y-1.5">
              <span className="eyebrow block">Attached documents</span>
              <div className="space-y-1">
                {p.dossier.documents.map((d) => (
                  <div key={d.doc_id} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] dark:border-slate-800/80 dark:bg-slate-900">
                    <span className="font-mono text-slate-600 dark:text-slate-300">{d.doc_id}</span>
                    <span className="text-slate-500 capitalize">{d.doc_type.replace(/_/g, " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {p.mode === "live" && (
        <div className="space-y-2">
          <label htmlFor="rawBox" className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Document text
          </label>
          <textarea
            id="rawBox"
            value={p.rawText}
            onChange={(e) => p.onRawText(e.target.value)}
            placeholder={"CERTIFICATE OF CONFORMITY\nManufacturer: ...\nCIN: ...\n---\nTAX INVOICE\nGSTIN: ...\nState: ..."}
            className="field h-40 resize-y font-mono"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Plain text is fine. Put a line containing only --- between documents.</p>
        </div>
      )}

      {p.mode === "json" && (
        <div className="space-y-2">
          <label htmlFor="jsonBox" className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Dossier JSON
          </label>
          <textarea
            id="jsonBox"
            value={p.jsonText}
            onChange={(e) => p.onJsonText(e.target.value)}
            placeholder={'{"case_id": "jury-1", "documents": [{"doc_id": "DOC-1", "doc_type": "tax_invoice", "date": "2026-08-01", "text": "..."}]}'}
            className="field h-40 resize-y font-mono"
          />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800/80">
        <label htmlFor="rulesOnly" className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Skip the reasoning step
          <span className="block text-[11px] font-normal text-slate-400">Deterministic checks only</span>
        </label>
        <button
          id="rulesOnly"
          type="button"
          role="switch"
          aria-checked={p.rulesOnly}
          onClick={() => p.onRulesOnly(!p.rulesOnly)}
          className={`relative h-5 w-9 rounded-full transition-colors ${p.rulesOnly ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${p.rulesOnly ? "translate-x-4.5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {p.error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {p.error}
        </p>
      )}

      <button type="button" onClick={p.onRun} disabled={p.busy} className="btn btn-primary w-full">
        {p.busy ? (
          <>
            <SpinnerIcon className="h-3.5 w-3.5" />
            Investigating…
          </>
        ) : (
          <>
            <PlayIcon className="h-3 w-3" />
            Run investigation
          </>
        )}
      </button>
    </div>
  );
}
