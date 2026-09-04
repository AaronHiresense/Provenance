import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { AnalysisResult, CaseSummary, Dossier } from "./types";
import { useTheme } from "./hooks/useTheme";
import { TopBar } from "./components/TopBar";
import { InputPanel, type InputMode } from "./components/InputPanel";
import { CaseGrid } from "./components/CaseGrid";
import { VerdictCard } from "./components/VerdictCard";
import { Actions } from "./components/Actions";
import { WhyFindings } from "./components/Findings";
import { Notices } from "./components/Notices";
import { AllChecks } from "./components/AllChecks";
import { CouldNotCheck } from "./components/CouldNotCheck";
import { SourceDocs } from "./components/SourceDocs";
import { SpinnerIcon } from "./components/Icons";

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCase, setSelectedCase] = useState("");
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [mode, setMode] = useState<InputMode>("library");
  const [rawText, setRawText] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [rulesOnly, setRulesOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [resultDossier, setResultDossier] = useState<Dossier | null>(null);
  // Bumped per analysis so every result section mounts fresh (no open/closed
  // state leaking from the previous run).
  const [runId, setRunId] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .cases()
      .then((list) => {
        setCases(list);
        if (list.length && !selectedCase) setSelectedCase(list[0].file);
      })
      .catch((e: Error) => setError(`Could not load the case list: ${e.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCase) return;
    let live = true;
    api
      .dossier(selectedCase)
      .then((d) => live && setDossier(d))
      .catch(() => live && setDossier(null));
    return () => {
      live = false;
    };
  }, [selectedCase]);

  const run = useCallback(
    async (override?: { file?: string }) => {
      setError(null);
      let body: Parameters<typeof api.analyze>[0];
      let docsForResult: Dossier | null = null;
      const file = override?.file ?? selectedCase;
      if (override?.file || mode === "library") {
        if (!file) {
          setError("Pick a case first.");
          return;
        }
        body = { case: file, rules_only: rulesOnly };
        docsForResult = file === selectedCase ? dossier : null;
      } else if (mode === "live") {
        const text = rawText.trim();
        if (!text) {
          setError("Paste some document text first.");
          return;
        }
        body = { raw_text: text, case_id: `live-${Date.now().toString(36)}`, rules_only: rulesOnly };
      } else {
        let parsed: Dossier;
        try {
          parsed = JSON.parse(jsonText) as Dossier;
        } catch (e) {
          setError(`Invalid JSON: ${(e as Error).message}`);
          return;
        }
        if (!Array.isArray(parsed.documents)) {
          setError('The dossier needs a "documents" list.');
          return;
        }
        body = { dossier: parsed, rules_only: rulesOnly };
        docsForResult = parsed;
      }
      setBusy(true);
      try {
        const r = await api.analyze(body);
        if (override?.file && override.file !== selectedCase) {
          docsForResult = await api.dossier(override.file).catch(() => null);
          setSelectedCase(override.file);
        }
        setResult(r);
        setResultDossier(docsForResult);
        setRunId((n) => n + 1);
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [mode, selectedCase, dossier, rawText, jsonText, rulesOnly],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar theme={theme} onToggleTheme={toggleTheme} result={result} />

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start gap-6 p-4 sm:p-6 lg:grid-cols-12 lg:gap-8 lg:p-8">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:col-span-4">
          <InputPanel
            mode={mode}
            onMode={setMode}
            cases={cases}
            selectedCase={selectedCase}
            onSelectCase={setSelectedCase}
            dossier={dossier}
            rawText={rawText}
            onRawText={setRawText}
            jsonText={jsonText}
            onJsonText={setJsonText}
            rulesOnly={rulesOnly}
            onRulesOnly={setRulesOnly}
            busy={busy}
            error={error}
            onRun={() => run()}
          />
        </aside>

        <section className="space-y-7 lg:col-span-8" ref={resultRef} aria-live="polite">
          {busy && (
            <div className="panel flex items-center gap-3 px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
              <SpinnerIcon className="h-4 w-4" />
              Checking every claim against the registry{rulesOnly ? "" : ", then reasoning over the contradictions"}…
            </div>
          )}

          {!result && !busy && <CaseGrid cases={cases} selected={selectedCase} onPick={(f) => setSelectedCase(f)} onRun={(f) => run({ file: f })} busy={busy} />}

          {result && (
            <div key={runId} className="space-y-7">
              <VerdictCard result={result} />
              <Actions actions={result.actions} />
              <WhyFindings result={result} />
              <Notices result={result} />
              <AllChecks result={result} />
              <CouldNotCheck result={result} />
              <SourceDocs dossier={resultDossier} result={result} />
            </div>
          )}
        </section>
      </main>

      <footer className="mt-auto border-t border-slate-200 py-4 text-center font-mono text-[11px] text-slate-400 dark:border-slate-800/80">
        PROVENANCE · offline MCA registry, snapshot 22 Jul 2026 · every verdict ships with its evidence
      </footer>
    </div>
  );
}
