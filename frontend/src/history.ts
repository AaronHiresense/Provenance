// Persistent context: what the investigator has already looked at on this
// machine, and which lots are waiting on a document. Local-only; nothing
// leaves the browser.

import type { Subtype, Verdict } from "./types";

export type Desk = "distributor" | "oem" | "service";
export const DESKS: { key: Desk; label: string; short: string }[] = [
  { key: "distributor", label: "Distributor · goods inward", short: "Distributor" },
  { key: "oem", label: "OEM brand protection", short: "OEM" },
  { key: "service", label: "Showroom / service", short: "Service" },
];

export type LotStatus = "open" | "quarantined" | "released" | "awaiting" | "referred";

export interface RunRecord {
  id: string;
  title: string;
  supplier: string | null;
  verdict: Verdict;
  subtype: Subtype;
  at: number;
  desk: Desk;
  status: LotStatus;
  awaiting?: string;
  caseFile?: string;
  contradictions: number;
}

const KEY = "provenance-history";
const DESK_KEY = "provenance-desk";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export const history = {
  load: (): RunRecord[] => read<RunRecord[]>(KEY, []),
  add(rec: RunRecord): RunRecord[] {
    const list = [rec, ...history.load()].slice(0, 40);
    write(KEY, list);
    return list;
  },
  update(id: string, patch: Partial<RunRecord>): RunRecord[] {
    const list = history.load().map((r) => (r.id === id ? { ...r, ...patch } : r));
    write(KEY, list);
    return list;
  },
  clear(): RunRecord[] {
    write(KEY, []);
    return [];
  },
};

export const deskStore = {
  load: (): Desk => {
    const d = read<string>(DESK_KEY, "distributor");
    return DESKS.some((x) => x.key === d) ? (d as Desk) : "distributor";
  },
  save: (d: Desk) => write(DESK_KEY, d),
};

export function timeAgo(t: number): string {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const mi = Math.round(s / 60);
  if (mi < 60) return `${mi} min ago`;
  const h = Math.round(mi / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
