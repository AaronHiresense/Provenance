import { useCallback, useRef, useState } from "react";
import { api } from "../api";
import type { AnalysisResult, AnalyzeRequest, Stage, StreamEvent } from "../types";

export type StepStatus = "pending" | "running" | "done" | "skipped";

export interface StepState {
  stage: Stage;
  status: StepStatus;
  detail: string;
  /** Milliseconds since the run started, as measured by the backend. */
  startedMs?: number;
  endedMs?: number;
}

export const STAGE_ORDER: Stage[] = ["extract", "validate", "ledger", "reason", "verdict"];

const fresh = (): StepState[] => STAGE_ORDER.map((stage) => ({ stage, status: "pending", detail: "" }));

/** Minimum time a step stays visibly "running". The backend finishes the
 *  offline pipeline in tens of milliseconds; the events are real, this only
 *  keeps them readable. The per-step timings shown are the backend's own. */
const MIN_DWELL_MS = 420;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Drives one analysis: streams stage events from the API, applies them in
 *  order with a minimum dwell, and resolves with the result once the trace
 *  has finished playing. */
export function useAgentRun() {
  const [steps, setSteps] = useState<StepState[]>(fresh);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSteps(fresh());
    setElapsedMs(null);
    setRunning(false);
  }, []);

  const start = useCallback(async (body: AnalyzeRequest): Promise<AnalysisResult> => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSteps(fresh());
    setElapsedMs(null);
    setRunning(true);

    const queue: StreamEvent[] = [];
    let streamDone = false;
    let streamError: Error | null = null;
    let wake: (() => void) | null = null;
    const notify = () => {
      wake?.();
      wake = null;
    };

    const streaming = api
      .analyzeStream(body, (e) => {
        queue.push(e);
        notify();
      }, ctrl.signal)
      .then(() => {
        streamDone = true;
        notify();
      })
      .catch((e: Error) => {
        streamError = e;
        streamDone = true;
        notify();
      });

    let shownAt = 0;
    let result: AnalysisResult | null = null;
    try {
      for (;;) {
        if (ctrl.signal.aborted) throw new Error("Cancelled.");
        const e = queue.shift();
        if (!e) {
          if (streamDone) break;
          await new Promise<void>((r) => {
            wake = r;
          });
          continue;
        }
        if (e.type === "result") {
          result = e.result;
          continue;
        }
        if (e.status !== "running") {
          const wait = MIN_DWELL_MS - (performance.now() - shownAt);
          if (wait > 0) await sleep(wait);
        }
        if (e.status === "running") shownAt = performance.now();
        setSteps((prev) =>
          prev.map((s) =>
            s.stage !== e.stage
              ? s
              : e.status === "running"
                ? { ...s, status: "running", detail: e.detail, startedMs: e.ms }
                : { ...s, status: e.status, detail: e.detail, endedMs: e.ms, startedMs: s.startedMs ?? e.ms },
          ),
        );
      }
      await streaming;
      if (streamError) throw streamError;
      if (!result) throw new Error("The analysis ended without a result.");
      setElapsedMs(result.elapsed_ms ?? null);
      return result;
    } finally {
      if (abortRef.current === ctrl) setRunning(false);
    }
  }, []);

  return { steps, running, elapsedMs, start, reset };
}
