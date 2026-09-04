import * as m from "motion/react-m";
import { stagger, type Variants } from "motion/react";
import type { CaseSummary, Verdict } from "../types";
import { VERDICT_STYLE } from "../labels";

const gridV: Variants = { hidden: {}, show: { transition: { delayChildren: stagger(0.04) } } };
const cardV: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } } };

interface Props {
  cases: CaseSummary[];
  selected: string;
  onPick: (file: string) => void;
  onRun: (file: string) => void;
  busy: boolean;
}

function splitTitle(title: string): { lot: string; who: string } {
  const [lot, ...rest] = title.split(" — ");
  return { lot, who: rest.join(" — ") };
}

export function CaseGrid({ cases, selected, onPick, onRun, busy }: Props) {
  return (
    <div className="panel space-y-5 p-6">
      <div className="max-w-2xl space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Check a parts dossier against the official records</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Every claim in a certificate, invoice or dispatch note is checked against India's MCA company registry and the GST numbering rules. You get one verdict with the evidence behind it: genuine, suspect, or unverifiable with the one document that would settle it.
        </p>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {cases.length} prepared cases, each anchored to a real company record. The expected verdict is shown so you can see how each situation is handled. Double-click a case to run it.
      </p>
      <m.div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3" variants={gridV} initial="hidden" animate="show">
        {cases.map((c) => {
          const { lot, who } = splitTitle(c.title);
          const on = c.file === selected;
          const v = c.expected as Verdict | undefined;
          return (
            <m.button
              key={c.file}
              type="button"
              disabled={busy}
              variants={cardV}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => onPick(c.file)}
              onDoubleClick={() => onRun(c.file)}
              className="relative flex min-h-24 flex-col gap-1.5 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
              style={{ borderRadius: 8 }}
            >
              {on && <m.span layoutId="case-ring" aria-hidden="true" className="pointer-events-none absolute -inset-px border-2 border-blue-500" style={{ borderRadius: 8 }} transition={{ type: "spring", visualDuration: 0.3, bounce: 0.2 }} />}
              <span className="text-[13px] leading-snug font-semibold text-slate-900 dark:text-slate-100">{lot}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{who}</span>
              <span className="mt-auto flex items-center gap-2 pt-1">
                {v && <span className={`chip ${VERDICT_STYLE[v].chip}`}>{v.charAt(0) + v.slice(1).toLowerCase()}</span>}
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {c.documents} {c.documents === 1 ? "document" : "documents"}
                </span>
              </span>
            </m.button>
          );
        })}
      </m.div>
    </div>
  );
}
