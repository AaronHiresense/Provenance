import { useCallback, useEffect, useRef, useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { api } from "./api";
import type { AnalysisResult, CaseSummary, Dossier } from "./types";
import { useTheme } from "./hooks/useTheme";
import { useAgentRun } from "./hooks/useAgentRun";
import { history, deskStore, type Desk, type LotStatus, type RunRecord } from "./history";
import { titleCase } from "./labels";
import { TopBar } from "./components/TopBar";
import { Briefing, type BriefInput } from "./components/Briefing";
import { AgentTrace } from "./components/AgentTrace";
import { VerdictCard } from "./components/VerdictCard";
import { Checkpoints } from "./components/Checkpoints";
import { Actions } from "./components/Actions";
import { WhyFindings } from "./components/Findings";
import { Notices } from "./components/Notices";
import { AllChecks } from "./components/AllChecks";
import { CouldNotCheck } from "./components/CouldNotCheck";
import { SourceDocs } from "./components/SourceDocs";

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [desk, setDeskState] = useState<Desk>(deskStore.load);
  const [runs, setRuns] = useState<RunRecord[]>(history.load);
  const [rulesOnly, setRulesOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [resultDossier, setResultDossier] = useState<Dossier | null>(null);
  const [record, setRecord] = useState<RunRecord | null>(null);
  const [runId, setRunId] = useState(0);
  const agent = useAgentRun();
  const busy = agent.running;
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .cases()
      .then(setCases)
      .catch((e: Error) => setError(`Could not load the prepared cases: ${e.message}`));
  }, []);

  const setDesk = (d: Desk) => {
    setDeskState(d);
    deskStore.save(d);
  };

  const investigate = useCallback(
    async (input: BriefInput) => {
      setError(null);
      setResult(null);
      setRecord(null);
      let body: Parameters<typeof api.analyze>[0];
      let title: string;
      let docs: Dossier | null = null;
      let caseFile: string | undefined;
      if (input.kind === "case") {
        body = { case: input.file, rules_only: rulesOnly };
        title = cases.find((c) => c.file === input.file)?.title ?? input.file;
        caseFile = input.file;
      } else if (input.kind === "raw") {
        const n = input.text.split(/^\s*-{3,}\s*$/m).filter((s) => s.trim()).length;
        body = { raw_text: input.text, case_id: `live-${Date.now().toString(36)}`, rules_only: rulesOnly };
        title = `Pasted paperwork · ${n} document${n === 1 ? "" : "s"}`;
      } else {
        body = { dossier: input.dossier, rules_only: rulesOnly };
        title = input.dossier.title ?? input.dossier.case_id ?? "Pasted dossier";
        docs = input.dossier;
      }
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      try {
        const r = await agent.start(body);
        if (caseFile) docs = await api.dossier(caseFile).catch(() => null);
        const rec: RunRecord = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          supplier: r.registry_row ? titleCase(r.registry_row.name.toLowerCase()) : null,
          verdict: r.verdict,
          subtype: r.subtype,
          at: Date.now(),
          desk,
          status: "open",
          caseFile,
          contradictions: r.counts.supports_suspect,
        };
        setRuns(history.add(rec));
        setRecord(rec);
        setResult(r);
        setResultDossier(docs);
        setRunId((n) => n + 1);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [agent, cases, desk, rulesOnly],
  );

  const setStatus = (status: LotStatus, awaiting?: string) => {
    if (!record) return;
    const patch: Partial<RunRecord> = { status, awaiting: status === "awaiting" ? awaiting : undefined };
    setRuns(history.update(record.id, patch));
    setRecord({ ...record, ...patch });
  };

  const reopen = (rec: RunRecord) => {
    if (rec.caseFile) void investigate({ kind: "case", file: rec.caseFile });
    else document.getElementById("brief")?.focus();
  };

  const startNew = () => {
    agent.reset();
    setResult(null);
    setRecord(null);
    setError(null);
  };

  const showTrace = busy || result !== null;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar theme={theme} onToggleTheme={toggleTheme} result={result} busy={busy} desk={desk} onDesk={setDesk} showNew={showTrace} onNew={startNew} />

      <main ref={topRef} className="mx-auto w-full max-w-5xl flex-1 scroll-mt-20 space-y-7 p-4 sm:p-6 lg:p-8" aria-live="polite">
        {!showTrace && <Briefing cases={cases} historyList={runs} busy={busy} rulesOnly={rulesOnly} onRulesOnly={setRulesOnly} onInvestigate={(i) => void investigate(i)} onReopen={reopen} error={error} />}

        {showTrace && <AgentTrace steps={agent.steps} running={agent.running} elapsedMs={agent.elapsedMs} />}
        {showTrace && error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </p>
        )}

        <AnimatePresence initial={false}>
          {result && (
            <m.div key={`run-${runId}`} className="space-y-7" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
              <VerdictCard result={result} />
              <Checkpoints result={result} desk={desk} record={record} onStatus={setStatus} />
              <Actions actions={result.actions} />
              <WhyFindings result={result} />
              <Notices result={result} />
              <AllChecks result={result} />
              <CouldNotCheck result={result} />
              <SourceDocs dossier={resultDossier} result={result} />
            </m.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto border-t border-slate-200 py-4 text-center font-mono text-[11px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
        PROVENANCE · offline MCA registry, snapshot 22 Jul 2026 · every verdict ships with its evidence · nothing leaves this machine
      </footer>
    </div>
  );
}
