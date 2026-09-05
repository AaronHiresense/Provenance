import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import type { Preflight as PreflightData } from "../types";
import { checkLabel, formatDate, titleCase } from "../labels";
import { AlertIcon, CheckIcon, ShieldIcon } from "./Icons";
import { ShimmerText } from "./effects";

interface Props {
  data: PreflightData | null;
  loading: boolean;
  error: string | null;
}

/** The agent's read of the paperwork while the user is still assembling it:
 *  what it can see, what it already knows about the company, what it will
 *  check, and which document would unlock more. */
export function PreflightPanel({ data, loading, error }: Props) {
  return (
    <AnimatePresence initial={false}>
      {(data || loading || error) && (
        <m.div key="pf" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
          <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">What I can see</span>
              {loading && (
                <span className="text-xs">
                  <ShimmerText>Reading…</ShimmerText>
                </span>
              )}
            </div>
            {error && <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
            {data && <Body d={data} />}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function Body({ d }: { d: PreflightData }) {
  const willRun = d.plan.filter((p) => p.will_run);
  const cannot = d.plan.filter((p) => !p.will_run);
  const reg = d.registry;
  const status = reg?.status?.trim() ?? null;
  const statusBad = status !== null && status.toLowerCase() !== "active";
  const ids = d.identifiers;
  const nothing = d.documents.every((x) => x.chars === 0) || (d.claims.length === 0 && !d.injections);
  return (
    <div className="mt-3 space-y-3.5 text-[13px]">
      <div className="flex flex-wrap items-center gap-1.5">
        {d.documents.map((doc) => (
          <span key={doc.doc_id} className="chip chip-neu">
            <span className="font-mono text-[10.5px] text-slate-400">{doc.doc_id}</span>
            {doc.kind}
          </span>
        ))}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {d.documents.length} document{d.documents.length === 1 ? "" : "s"} · {d.claims.length} labelled field{d.claims.length === 1 ? "" : "s"} read offline
        </span>
      </div>

      {nothing && <p className="text-xs text-slate-500 dark:text-slate-400">I do not recognise any labelled fields yet. Paste the certificate, invoice or dispatch note as plain text; lines like "CIN: …" and "GSTIN: …" are what I read.</p>}

      {(ids.company_name || ids.cin || ids.gstin || ids.lot_code) && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {ids.company_name && <Fact k="Company" v={ids.company_name} />}
          {ids.cin && (
            <Fact k="CIN" mono v={ids.cin}>
              {reg ? (
                <span className="block text-xs text-slate-600 dark:text-slate-300">
                  Registry: {titleCase(reg.name.toLowerCase())} · <span className={statusBad ? "font-semibold text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}>{status ?? "status unknown"}</span>
                  {reg.registration_date ? ` since ${formatDate(reg.registration_date)}` : ""}
                  {reg.state_name ? ` · ${titleCase(reg.state_name)}` : ""}
                </span>
              ) : (
                <span className="block text-xs text-amber-700 dark:text-amber-400">Not in the MCA registry snapshot. I will treat that as a gap, not proof.</span>
              )}
            </Fact>
          )}
          {ids.gstin && <Fact k="GST number" mono v={ids.gstin} />}
          {ids.lot_code && <Fact k="Lot code" mono v={ids.lot_code} />}
          {ids.part_number && <Fact k="Part" mono v={ids.part_number} />}
        </div>
      )}

      {d.injections > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {d.injections === 1 ? "A line in these documents tries to instruct me." : `${d.injections} lines in these documents try to instruct me.`} I will strip {d.injections === 1 ? "it" : "them"} before reading and count {d.injections === 1 ? "it" : "them"} as evidence of tampering.
          </span>
        </p>
      )}

      {!nothing && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">
              I will run {d.runnable} of {d.total} checks.
            </span>{" "}
            {cannot.length ? `${cannot.length} need fields these documents do not carry.` : "Everything the checks need is here."}
            {d.aliased ? " Company names in this prepared case are aliased; the CIN is real." : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {willRun.map((p) => (
              <span key={p.check} className="chip chip-gen" title={p.reason ?? undefined}>
                <CheckIcon className="h-3 w-3" />
                {checkLabel(p.check)}
              </span>
            ))}
            {cannot.map((p) => (
              <span key={p.check} className="chip chip-neu opacity-80" title={p.reason ?? undefined}>
                {checkLabel(p.check)}
              </span>
            ))}
          </div>
          {d.unlocks.length > 0 && (
            <div className="space-y-1 pt-1">
              {d.unlocks.map((u) => (
                <p key={u.document} className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-blue-700 dark:text-blue-400">Add {u.document}</span> to unlock {u.checks.length} more check{u.checks.length === 1 ? "" : "s"}: {u.checks.map(checkLabel).join(", ").toLowerCase()}.
                </p>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400">This is the offline read. The extraction agent may find more fields when it runs.</p>
        </div>
      )}
    </div>
  );
}

function Fact({ k, v, mono = false, children }: { k: string; v: string; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-baseline gap-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">{k}</span>
      <span>
        <span className={mono ? "font-mono text-xs text-slate-900 dark:text-slate-100" : "text-slate-900 dark:text-slate-100"}>{v}</span>
        {children}
      </span>
    </div>
  );
}
