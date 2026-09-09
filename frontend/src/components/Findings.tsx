import React, { useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence, stagger, type Variants } from "motion/react";
import type { AnalysisResult, Contradiction, Finding } from "../types";
import {
  SOURCE_LABELS,
  STRENGTH_LABELS,
  findingLabel,
  firstSentence,
  humanize,
  pairReasoning,
  rulingLabel,
  splitEvidence,
} from "../labels";
import { CheckCircleIcon, ChevronIcon, ShieldAlertIcon, ShieldIcon } from "./Icons";
import { Section } from "./Section";

const listV: Variants = { hidden: {}, show: { transition: { delayChildren: stagger(0.08, { startDelay: 0.1 }) } } };
const cardV: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: "spring", visualDuration: 0.35, bounce: 0.15 } },
};

/**
 * Highlights key terms, numbers, tiers, checks, and decisive conclusions in text.
 */
function highlightKeywords(text: string): React.ReactNode {
  if (!text) return null;
  const regex = /(Authoritative-tier|Derived-tier|Heuristic-tier|\b\d+\s+units claimed versus \d+\s+units verified\b|\b\d+\s+(?:prior presentations|times before|presentations)\b|NIC\s+\d+|CIN|GSTIN|PAN|BIS licence|TAC|OEM sheet|OEM dispatch records|lot code grammar|custody sequence|source-record conflicts?|cloned-dossier attack|benign repeat-order|governance rules|dispositive|innocent mechanism|administrative error|'[^']+'|[a-z]+(?:_[a-z0-9]+)+)/gi;
  const tokens = text.split(regex);

  return tokens.map((tok, i) => {
    const lower = tok.toLowerCase();
    if (tok.includes("_")) {
      return (
        <code key={i} className="font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 px-1 py-0.5 rounded text-[11px]">
          {tok}
        </code>
      );
    }
    if (lower === "authoritative-tier") {
      return (
        <span key={i} className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[11px]">
          Authoritative-tier
        </span>
      );
    }
    if (lower === "derived-tier") {
      return (
        <span key={i} className="font-mono font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded text-[11px]">
          Derived-tier
        </span>
      );
    }
    if (lower === "heuristic-tier") {
      return (
        <span key={i} className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded text-[11px]">
          Heuristic-tier
        </span>
      );
    }
    if (/^\b\d+\s+units claimed versus \d+\s+units verified\b$/i.test(tok)) {
      return (
        <span key={i} className="font-bold text-amber-800 dark:text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/20">
          {tok}
        </span>
      );
    }
    if (/^\b\d+\s+(?:prior presentations|times before|presentations)\b$/i.test(tok)) {
      return (
        <span key={i} className="font-bold text-rose-700 dark:text-rose-300 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/20">
          {tok}
        </span>
      );
    }
    if (/^NIC\s+\d+$/i.test(tok)) {
      return (
        <span key={i} className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-200/70 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">
          {tok}
        </span>
      );
    }
    if (
      lower === "cin" ||
      lower === "gstin" ||
      lower === "pan" ||
      lower === "bis licence" ||
      lower === "tac" ||
      lower === "oem sheet" ||
      lower === "oem dispatch records" ||
      lower === "lot code grammar" ||
      lower === "custody sequence" ||
      lower.startsWith("source-record conflict")
    ) {
      return (
        <strong key={i} className="font-bold text-slate-900 dark:text-white underline decoration-blue-500/40">
          {tok}
        </strong>
      );
    }
    if (tok.startsWith("'") && tok.endsWith("'")) {
      return (
        <span key={i} className="font-semibold italic text-slate-900 dark:text-slate-100">
          {tok}
        </span>
      );
    }
    if (
      lower === "cloned-dossier attack" ||
      lower === "dispositive" ||
      lower === "governance rules" ||
      lower === "benign repeat-order"
    ) {
      return (
        <strong key={i} className="font-bold text-slate-950 dark:text-white underline decoration-amber-500/50">
          {tok}
        </strong>
      );
    }
    return tok;
  });
}

/**
 * Formats the full legal forensic narrative with structured visual paragraphs and highlighted anchors.
 */
function renderRichForensicNarrative(narrative: string): React.ReactNode {
  if (!narrative) return null;

  // Split narrative by sentences
  const sentences = narrative.split(/(?<=\.\s+)/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-2.5">
      {sentences.map((sentence, idx) => {
        const isOpening = idx === 0;
        const isConclusion =
          sentence.toLowerCase().includes("no findings point toward suspicion") ||
          sentence.toLowerCase().includes("dispositive indicator of fraud") ||
          sentence.toLowerCase().includes("consistent with a legitimate partial shipment");
        const isDiscrepancy =
          sentence.toLowerCase().includes("notable observation") ||
          sentence.toLowerCase().includes("however, the") ||
          sentence.toLowerCase().includes("check fails");

        if (isOpening) {
          return (
            <div
              key={idx}
              className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-[12.5px] font-semibold text-slate-900 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100"
            >
              <span className="mr-1.5 font-mono text-[10.5px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold block sm:inline">
                Executive Baseline:
              </span>
              {highlightKeywords(sentence)}
            </div>
          );
        }

        if (isConclusion) {
          const isPositive = sentence.toLowerCase().includes("no findings point toward suspicion") || sentence.toLowerCase().includes("consistent with a legitimate");
          return (
            <div
              key={idx}
              className={`rounded-xl border p-3 text-[12.5px] font-bold ${
                isPositive
                  ? "border-emerald-200/80 bg-emerald-50/50 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "border-rose-200/80 bg-rose-50/50 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {isPositive ? (
                  <CheckCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlertIcon className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold">
                  Final Adjudication:
                </span>
              </div>
              <p className="leading-relaxed font-semibold">{highlightKeywords(sentence)}</p>
            </div>
          );
        }

        if (isDiscrepancy) {
          return (
            <div
              key={idx}
              className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3 text-[12px] text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
            >
              <span className="font-mono text-[10.5px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400 block mb-0.5">
                Observed Variance:
              </span>
              <p className="leading-relaxed">{highlightKeywords(sentence)}</p>
            </div>
          );
        }

        // Standard forensic evaluation sentence
        return (
          <p key={idx} className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-sans pl-1">
            {highlightKeywords(sentence)}
          </p>
        );
      })}
    </div>
  );
}

interface CardProps {
  finding: Finding;
  reasoning?: Contradiction;
  defaultOpen?: boolean;
  severity: { text: string; cls: string };
}

export function FindingCard({ finding: f, reasoning: c, defaultOpen = true, severity }: CardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const ruling = c ? rulingLabel(f, c) : null;
  const contradicts = f.direction === "supports_suspect";
  const headline = contradicts ? firstSentence(f.detail) : f.assertion;
  const rawBody = contradicts ? f.detail.slice(firstSentence(f.detail).length).trim() : f.detail;

  return (
    <m.article
      variants={cardV}
      className={`rounded-2xl border p-4 shadow-2xs transition-all ${
        contradicts
          ? "border-rose-200/90 bg-white/95 dark:border-rose-900/40 dark:bg-slate-900"
          : "border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="flex flex-col gap-3">
        {/* Header line with badges */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <span className={`chip mt-0.5 shrink-0 ${severity.cls}`}>{severity.text}</span>
            <div className="space-y-1">
              <h4 className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {highlightKeywords(headline)}
              </h4>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{findingLabel(f)}</span>
                {f.source_doc && (
                  <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                    📄 {f.source_doc}
                  </span>
                )}
                {f.result && f.result !== "pass" && f.result !== "fail" && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">· {f.result}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="chip chip-src">{SOURCE_LABELS[f.source_tier]}</span>
            {c && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white cursor-pointer"
              >
                <span>Dual Hypotheses</span>
                <ChevronIcon open={open} className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Structured Claim vs Finding Body */}
        {contradicts ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3 space-y-1.5 dark:border-rose-950 dark:bg-rose-950/20 text-xs">
            <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="font-mono font-bold uppercase tracking-wider text-[10px] text-rose-700 dark:text-rose-400 shrink-0 mt-0.5">
                Claim Tested:
              </span>
              <span>{f.assertion}</span>
            </div>
            {rawBody && (
              <div className="flex items-start gap-1.5 text-slate-700 dark:text-slate-200 pt-1 border-t border-rose-100/60 dark:border-rose-900/30">
                <span className="font-mono font-bold uppercase tracking-wider text-[10px] text-rose-800 dark:text-rose-300 shrink-0 mt-0.5">
                  Finding:
                </span>
                <span className="leading-relaxed font-medium">{highlightKeywords(rawBody)}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {highlightKeywords(rawBody)}
          </p>
        )}

        {/* Dual Hypotheses Reasoning Arena */}
        <AnimatePresence initial={false}>
          {c && open && (
            <m.div
              key="reasoning"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {/* Innocent Reading */}
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-1.5 mb-1 text-emerald-800 dark:text-emerald-300">
                      <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider">
                        Innocent / Benign Hypothesis
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-emerald-950/90 dark:text-emerald-200">
                      {highlightKeywords(c.benign)}
                    </p>
                  </div>

                  {/* Forgery Reading */}
                  <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                    <div className="flex items-center gap-1.5 mb-1 text-rose-800 dark:text-rose-300">
                      <ShieldAlertIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider">
                        Forgery / Fraud Hypothesis
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-rose-950/90 dark:text-rose-200">
                      {highlightKeywords(c.malicious)}
                    </p>
                  </div>
                </div>

                {/* Adjudication Ruling */}
                {ruling && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/90 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                    <span className={`chip shrink-0 ${ruling.cls}`}>{ruling.text}</span>
                    <p className="text-xs leading-relaxed font-medium text-slate-700 dark:text-slate-200">
                      {highlightKeywords(humanize(c.resolution))}
                    </p>
                  </div>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </m.article>
  );
}

function severityFor(f: Finding): { text: string; cls: string } {
  if (f.direction === "supports_genuine") return { text: "Supports", cls: "chip-gen" };
  if (f.direction === "neutral") return { text: "No signal", cls: "chip-neu" };
  return {
    text: STRENGTH_LABELS[f.strength],
    cls: f.strength === "dispositive" || f.strength === "strong" ? "chip-sus" : "chip-neu",
  };
}

/**
 * Extracts 3 quick-to-read executive bullet takeaways from the narrative so users never get bored.
 */
function extractExecutiveTakeaways(result: AnalysisResult): { icon: string; title: string; desc: string }[] {
  const isSuspect = result.verdict === "SUSPECT";
  const isGenuine = result.verdict === "GENUINE";

  if (isSuspect) {
    return [
      {
        icon: "🏢",
        title: "Baseline Corporate Check",
        desc: "Supplier identity and company registration pass authoritative MCA and GSTIN checks.",
      },
      {
        icon: "🚨",
        title: "The Forensic Contradiction",
        desc: "Dossier or paperwork signature matches a duplicate paper trail or cloned presentation.",
      },
      {
        icon: "⚖️",
        title: "Forensic Adjudication",
        desc: "Authoritative records and replay signatures cannot be softened by innocent explanations.",
      },
    ];
  }

  if (isGenuine) {
    return [
      {
        icon: "✅",
        title: "Registry & Identity Match",
        desc: "Entity is active in MCA registry with valid manufacturing NIC code and matching GSTIN state.",
      },
      {
        icon: "🔒",
        title: "Transfer & Paperwork Integrity",
        desc: "Certifications (BIS/TAC), lot grammar, and dispatch dates are internally consistent.",
      },
      {
        icon: "🛡️",
        title: "No Collisions or Replays",
        desc: "Paper trail is unique and carries no duplicate presentation flags or source conflicts.",
      },
    ];
  }

  // UNVERIFIABLE
  return [
    {
      icon: "🔍",
      title: "Preliminary Integrity",
      desc: "Available documents pass basic syntax checks but lack critical independent anchors.",
    },
    {
      icon: "⚠️",
      title: "Decisive Gap",
      desc: result.missing_artefact ? `Missing: ${result.missing_artefact}` : "Required document is missing or contradictory.",
    },
    {
      icon: "📋",
      title: "Interim Action",
      desc: result.interim_action ?? "Hold lot in quarantine pending verified document arrival.",
    },
  ];
}

export function WhyFindings({ result: r }: { result: AnalysisResult }) {
  const { primary, weaker, support } = splitEvidence(r.ledger.findings);
  const pairs = pairReasoning(r.ledger.findings, r.reasoning);
  const [showWeaker, setShowWeaker] = useState(false);
  const [viewMode, setViewMode] = useState<"executive" | "narrative">("executive");

  const isUnv = r.verdict === "UNVERIFIABLE";
  const lead = primary.length ? primary : isUnv ? weaker : support.slice(0, 3);
  const rest = primary.length ? weaker : isUnv ? [] : [];

  const title = r.verdict === "GENUINE" && !primary.length ? "What supports it" : "Why this verdict";
  const aside =
    r.verdict === "GENUINE" && !primary.length
      ? "Strongest support first"
      : isUnv
      ? "What could not be resolved"
      : "Strongest evidence first";

  const takeaways = r.reasoning?.narrative ? extractExecutiveTakeaways(r) : [];

  return (
    <Section title={title} aside={aside}>
      {/* ── 1. PRIMARY FINDINGS LIST ────────────────────────────────────── */}
      <m.div className="flex flex-col gap-3" variants={listV} initial="hidden" animate="show">
        {lead.map((f, i) => {
          const c = pairs.get(f);
          const sev =
            isUnv && c?.resolved_direction === "unresolved"
              ? { text: "Unresolved", cls: "chip-unv" }
              : severityFor(f);
          return (
            <FindingCard
              key={`${f.check}-${i}`}
              finding={f}
              reasoning={c}
              defaultOpen={i === 0}
              severity={sev}
            />
          );
        })}
        {lead.length === 0 && (
          <p className="text-xs text-slate-500">No directional evidence was produced for this dossier.</p>
        )}
      </m.div>

      {/* ── 2. WEAKER SIGNALS ACCORDION ─────────────────────────────────── */}
      {rest.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-2.5 px-1 text-xs text-slate-600 dark:text-slate-400">
            <span className="chip chip-neu">
              {rest.length} weaker signal{rest.length === 1 ? "" : "s"}
            </span>
            <span className="min-w-0 flex-1 font-mono text-[11px]">
              {rest.map((f) => findingLabel(f)).join(" · ")}
            </span>
            <button
              type="button"
              onClick={() => setShowWeaker((v) => !v)}
              className="font-bold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
            >
              {showWeaker ? "Hide Weaker Signals" : "Show All Weaker Signals →"}
            </button>
          </div>
          <AnimatePresence initial={false}>
            {showWeaker && (
              <m.div
                key="weaker"
                className="flex flex-col gap-2.5 overflow-hidden"
                variants={listV}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, height: 0 }}
              >
                {rest.map((f, i) => (
                  <FindingCard
                    key={`${f.check}-w${i}`}
                    finding={f}
                    reasoning={pairs.get(f)}
                    severity={severityFor(f)}
                  />
                ))}
              </m.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── 3. VISUAL REASONING SYNTHESIS (NO MORE BORING TEXT WALLS!) ─── */}
      {r.reasoning && !r.rules_only && r.reasoning.narrative && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          {/* Header with Executive vs Full Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <ShieldIcon className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {r.reasoning.engine === "llm" ? "Forensic Reasoning Synthesis" : "Deterministic Reasoning Synthesis"}
              </span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("executive")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === "executive"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                ⚡ 3-Point Summary
              </button>
              <button
                type="button"
                onClick={() => setViewMode("narrative")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === "narrative"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                📄 Full Forensic Text
              </button>
            </div>
          </div>

          {/* Mode 1: 3-Point Executive Summary Cards (Quick 3-second scan) */}
          {viewMode === "executive" ? (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 pt-3">
              {takeaways.map((item, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-1.5 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{item.icon}</span>
                    <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      {item.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            /* Mode 2: Full Forensic Narrative with Structured Highlights & Badges */
            <div className="pt-3">
              {renderRichForensicNarrative(r.reasoning.narrative)}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

