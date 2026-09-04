import type { AnalysisResult, AnalyzeRequest, CaseSummary, Dossier } from "./types";

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
  analyze: (body: AnalyzeRequest) =>
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => json<AnalysisResult>(r)),
};
