import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { ArchiveStats } from "../types";

/** What this desk remembers.
 *
 *  The seen-lots archive is the only thing in the system that can catch a
 *  reused dossier — every other check looks for contradictions, and a
 *  byte-perfect copy of genuine paperwork contains none. Its size is therefore
 *  part of the system's state and belongs on screen, not in a log file.
 *
 *  Clearing is offered because desk memory changes what the next verdict says:
 *  a rehearsal that re-runs the same case would otherwise flag its own earlier
 *  run as reuse. */
export function DeskMemory({ refreshKey }: { refreshKey?: number }) {
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .archive()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  useEffect(load, [load, refreshKey]);

  if (!stats) return null;

  const clear = async () => {
    setBusy(true);
    try {
      setStats(await api.clearArchive());
      setConfirming(false);
    } catch {
      /* leave the count as it was; the archive is desk state, not the verdict */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
      <span>
        Desk memory:{" "}
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {stats.screened} dossier{stats.screened === 1 ? "" : "s"} screened
        </span>
        {stats.lots > 0 && <> across {stats.lots} lot{stats.lots === 1 ? "" : "s"}</>}
      </span>
      {stats.screened > 0 &&
        (confirming ? (
          <>
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              className="font-medium text-rose-700 hover:underline disabled:opacity-50 dark:text-rose-400"
            >
              {busy ? "forgetting…" : "confirm forget"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="hover:underline">
              cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="font-medium text-blue-700 hover:underline dark:text-blue-400"
          >
            forget
          </button>
        ))}
    </div>
  );
}
