import { useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence, stagger, type Variants } from "motion/react";
import type { AnalysisResult, Contradiction, Finding } from "../types";
import { SOURCE_LABELS, STRENGTH_LABELS, findingLabel, firstSentence, humanize, pairReasoning, rulingLabel, splitEvidence } from "../labels";
import { ChevronIcon } from "./Icons";
import { Section } from "./Section";

const listV: Variants = { hidden: {}, show: { transition: { delayChildren: stagger(0.1, { startDelay: 0.15 }) } } };
const cardV: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: "spring", visualDuration: 0.45, bounce: 0.2 } } };

interface CardProps {
  finding: Finding;
  reasoning?: Contradiction;
  defaultOpen?: boolean;
  severity: { text: string; cls: string };
}

export function FindingCard({ finding: f, reasoning: c, defaultOpen = false, severity }: CardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const ruling = c ? rulingLabel(f, c) : null;
  const contradicts = f.direction === "supports_suspect";
  // A failing finding leads with what went wrong; a passing one with the claim it confirmed.
  const headline = contradicts ? firstSentence(f.detail) : f.assertion;
  const body = contradicts ? `Claim tested: ${f.assertion}. ${f.detail.slice(firstSentence(f.detail).length).trim()}`.trim() : f.detail;
  return (
    <m.article variants={cardV} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3.5">
        <span className={`chip mt-0.5 shrink-0 ${severity.cls}`}>{severity.text}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h4 className="text-[14px] leading-snug font-semibold text-slate-900 dark:text-slate-100">{headline}</h4>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
          <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {findingLabel(f)}
            {f.source_doc ? ` · ${f.source_doc}` : ""}
            {f.result && f.result !== "pass" && f.result !== "fail" ? ` · ${f.result}` : ""}
          </p>
        </div>
        <span className="chip chip-src shrink-0">{SOURCE_LABELS[f.source_tier]}</span>
        {c && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex shrink-0 items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            Reasoning <ChevronIcon open={open} className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
      {c && open && (
        <m.div key="reasoning" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: "easeOut" }} className="overflow-hidden">
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <div>
              <span className="eyebrow block text-emerald-700 dark:text-emerald-400">Innocent reading</span>
              <p className="mt-1 text-[13px] text-slate-800 dark:text-slate-200">{c.benign}</p>
            </div>
            <div>
              <span className="eyebrow block text-rose-700 dark:text-rose-400">Forgery reading</span>
              <p className="mt-1 text-[13px] text-slate-800 dark:text-slate-200">{c.malicious}</p>
            </div>
          </div>
          {ruling && (
            <div className="mt-3 flex items-start gap-2.5 rounded-md bg-slate-50 px-3 py-2.5 dark:bg-slate-950/60">
              <span className={`chip shrink-0 ${ruling.cls}`}>{ruling.text}</span>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{humanize(c.resolution)}</p>
            </div>
          )}
        </div>
        </m.div>
      )}
      </AnimatePresence>
    </m.article>
  );
}

function severityFor(f: Finding): { text: string; cls: string } {
  if (f.direction === "supports_genuine") return { text: "Supports", cls: "chip-gen" };
  if (f.direction === "neutral") return { text: "No signal", cls: "chip-neu" };
  return { text: STRENGTH_LABELS[f.strength], cls: f.strength === "dispositive" || f.strength === "strong" ? "chip-sus" : "chip-neu" };
}

export function WhyFindings({ result: r }: { result: AnalysisResult }) {
  const { primary, weaker, support } = splitEvidence(r.ledger.findings);
  const pairs = pairReasoning(r.ledger.findings, r.reasoning);
  const [showWeaker, setShowWeaker] = useState(false);

  // Unverifiable: the contradictions the reasoner could not resolve are the story.
  const isUnv = r.verdict === "UNVERIFIABLE";
  const lead = primary.length ? primary : isUnv ? weaker : support.slice(0, 3);
  const rest = primary.length ? weaker : isUnv ? [] : [];

  const title = r.verdict === "GENUINE" && !primary.length ? "What supports it" : "Why this verdict";
  const aside = r.verdict === "GENUINE" && !primary.length ? "Strongest support first" : isUnv ? "What could not be resolved" : "Strongest evidence first";

  return (
    <Section title={title} aside={aside}>
      <m.div className="flex flex-col gap-2.5" variants={listV} initial="hidden" animate="show">
        {lead.map((f, i) => {
          const c = pairs.get(f);
          const sev = isUnv && c?.resolved_direction === "unresolved" ? { text: "Unresolved", cls: "chip-unv" } : severityFor(f);
          return <FindingCard key={`${f.check}-${i}`} finding={f} reasoning={c} defaultOpen={i === 0} severity={sev} />;
        })}
        {lead.length === 0 && <p className="text-xs text-slate-500">No directional evidence was produced for this dossier.</p>}
      </m.div>
      {rest.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5 px-1 text-xs text-slate-600 dark:text-slate-400">
            <span className="chip chip-neu">
              {rest.length} weaker signal{rest.length === 1 ? "" : "s"}
            </span>
            <span className="min-w-0 flex-1">{rest.map((f) => findingLabel(f)).join(" · ")}</span>
            <button type="button" onClick={() => setShowWeaker((v) => !v)} className="font-medium text-blue-700 hover:underline dark:text-blue-400">
              {showWeaker ? "Hide" : "Show"}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {showWeaker && (
              <m.div key="weaker" className="flex flex-col gap-2.5 overflow-hidden" variants={listV} initial="hidden" animate="show" exit={{ opacity: 0, height: 0 }}>
                {rest.map((f, i) => (
                  <FindingCard key={`${f.check}-w${i}`} finding={f} reasoning={pairs.get(f)} severity={severityFor(f)} />
                ))}
              </m.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {r.reasoning && !r.rules_only && r.reasoning.narrative && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
          <span className="mr-2 font-semibold text-slate-900 dark:text-white">{r.reasoning.engine === "llm" ? "Reasoning summary" : "Reasoning summary (deterministic fallback)"}</span>
          {r.reasoning.narrative}
        </p>
      )}
    </Section>
  );
}
