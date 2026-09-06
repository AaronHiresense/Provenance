import type { AnalysisResult, AnalyzeRequest, CaseSummary, Dossier, Preflight, SampleSet, StreamEvent } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  cases: () => fetch("/api/cases").then((r) => json<CaseSummary[]>(r)),
  dossier: (file: string) => fetch(`/api/cases/${encodeURIComponent(file)}`).then((r) => json<Dossier>(r)),
  samples: () => fetch("/api/samples").then((r) => json<SampleSet[]>(r)),
  analyze: (body: AnalyzeRequest) =>
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<AnalysisResult>(r)),

  preflight: (body: AnalyzeRequest, signal?: AbortSignal) =>
    fetch("/api/preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }).then((r) => json<Preflight>(r)),

  /** Streams stage events as the pipeline runs; resolves with the final
   *  result. Falls back to the plain endpoint if streaming is unavailable. */
  async analyzeStream(body: AnalyzeRequest, onEvent: (e: StreamEvent) => void, signal?: AbortSignal): Promise<AnalysisResult> {
    const res = await fetch("/api/analyze/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (res.status === 404) return api.analyze(body);
    if (!res.ok || !res.body) {
      let detail = res.statusText;
      try {
        detail = ((await res.json()) as { detail?: string }).detail ?? detail;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(detail);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: AnalysisResult | null = null;
    const handle = (line: string) => {
      if (!line.trim()) return;
      const e = JSON.parse(line) as StreamEvent;
      onEvent(e);
      if (e.type === "result") result = e.result;
    };
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
      }
      if (done) break;
    }
    handle(buffer);
    if (!result) throw new Error("The analysis stream ended without a result.");
    return result;
  },
};
