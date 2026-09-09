import React, { useState, useEffect, useRef } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import type { AnalysisResult } from "../types";
import { checkLabel } from "../labels";
import { AlertIcon, ChevronIcon, CpuIcon, ShieldIcon } from "./Icons";

/**
 * Highlights key forensic terms, check IDs, quoted phrases, and concluding sentences
 * so that presenters and evaluators can instantly spot the decisive arguments.
 */
function renderForensicHighlights(text: string): React.ReactNode {
  if (!text) return null;

  // Split by sentences or significant delimiters
  const parts = text.split(/(Therefore,[\s\S]*?$|The draft survives because[\s\S]*?$|The draft fails because[\s\S]*?$|The draft's conclusion hinges entirely on[\s\S]*?(?:,|\.)|The draft's conclusion rests entirely on[\s\S]*?(?:,|\.))/g);

  return parts.map((part, idx) => {
    // If it's a decisive conclusion or core premise sentence
    if (
      part.startsWith("Therefore,") ||
      part.startsWith("The draft survives because") ||
      part.startsWith("The draft fails because")
    ) {
      return (
        <span key={idx} className="block mt-2 font-bold text-slate-950 dark:text-white bg-amber-500/10 dark:bg-amber-400/10 px-2 py-1 rounded-lg border-l-2 border-amber-500">
          {formatSubTokens(part)}
        </span>
      );
    }

    if (
      part.startsWith("The draft's conclusion hinges entirely on") ||
      part.startsWith("The draft's conclusion rests entirely on")
    ) {
      return (
        <strong key={idx} className="font-bold text-slate-950 dark:text-white">
          {formatSubTokens(part)}
        </strong>
      );
    }

    return <React.Fragment key={idx}>{formatSubTokens(part)}</React.Fragment>;
  });
}

function formatSubTokens(str: string): React.ReactNode {
  // Regex matches check_names_with_underscores, quoted phrases '...', or numbers with prior presentations
  const regex = /([a-z]+(?:_[a-z0-9]+)+|\b\d+\s+(?:prior presentations|times before|presentations)\b|'[^']+'|cloned-dossier attack|benign repeat-order|governance rules|dispositive)/gi;
  const tokens = str.split(regex);

  return tokens.map((tok, i) => {
    if (tok.includes("_")) {
      // Check code like dossier_reuse or source_record_conflict
      return (
        <code
          key={i}
          className="font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 px-1 py-0.5 rounded text-[12px]"
        >
          {tok}
        </code>
      );
    }
    if (/^\b\d+\s+(?:prior presentations|times before|presentations)\b$/i.test(tok)) {
      return (
        <span
          key={i}
          className="font-bold text-rose-700 dark:text-rose-300 bg-rose-500/10 px-1 py-0.5 rounded"
        >
          {tok}
        </span>
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
      tok.toLowerCase() === "cloned-dossier attack" ||
      tok.toLowerCase() === "benign repeat-order" ||
      tok.toLowerCase() === "governance rules" ||
      tok.toLowerCase() === "dispositive"
    ) {
      return (
        <strong key={i} className="font-bold text-slate-900 dark:text-white underline decoration-amber-500/50">
          {tok}
        </strong>
      );
    }
    return tok;
  });
}

/** The agent's attack on its own draft.
 *
 *  Closed by default with a high-density summary chip. When opened, it reveals
 *  the full reasoning and adversarial attack progressively like Claude/ChatGPT
 *  thinking traces with bolded presentation highlights.
 */
export function Challenge({ result: r }: { result: AnalysisResult }) {
  const ch = r.reasoning?.challenge;
  if (!ch || ch.engine === "skipped") return null;

  const [open, setOpen] = useState(false);
  const [streamProgress, setStreamProgress] = useState(0); // number of characters revealed
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStreamed, setHasStreamed] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Full attack text to progressively type out
  const fullAttackText = ch.attack || "";
  const totalLength = fullAttackText.length;

  useEffect(() => {
    // Reset state if case result changes
    setOpen(false);
    setStreamProgress(0);
    setIsStreaming(false);
    setHasStreamed(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [r.case_id]);

  const startStreaming = () => {
    if (hasStreamed || totalLength === 0) {
      setStreamProgress(totalLength);
      return;
    }

    setIsStreaming(true);
    setStreamProgress(0);

    const step = 9; // characters per tick
    const intervalMs = 16; // smooth high-speed streaming

    timerRef.current = window.setInterval(() => {
      setStreamProgress((prev) => {
        const next = prev + step;
        if (next >= totalLength) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsStreaming(false);
          setHasStreamed(true);
          return totalLength;
        }
        return next;
      });
    }, intervalMs);
  };

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && !hasStreamed && !isStreaming) {
      startStreaming();
    }
  };

  const skipStreaming = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStreamProgress(totalLength);
    setIsStreaming(false);
    setHasStreamed(true);
  };

  const visibleAttack = hasStreamed ? fullAttackText : fullAttackText.slice(0, streamProgress);
  const showSecondary = !isStreaming || streamProgress > totalLength * 0.75;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/80 shadow-2xs transition-all dark:border-slate-800 dark:bg-slate-900/60">
      {/* ── Summary Header Bar (Always Visible) ─────────────────────────── */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-3 p-3.5 sm:px-4 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer"
        aria-expanded={open}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <CpuIcon className="h-4 w-4" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-slate-900 dark:text-slate-100">
              Self-Critique & Adversarial Defense
            </span>
            <span className="hidden text-xs text-slate-400 dark:text-slate-500 sm:inline">·</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              Argued against its own draft
            </span>
          </div>

          {/* Status Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {ch.outcome === "upheld" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
                Attack won · revised from {ch.from}
              </span>
            )}
            {ch.outcome === "overridden" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-rose-700 dark:text-rose-300">
                <ShieldIcon className="h-3 w-3" /> Overruled by governance rules
              </span>
            )}
            {ch.outcome === "blocked" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/70 dark:bg-slate-800 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-700 dark:text-slate-300">
                Recorded · cannot move verdict
              </span>
            )}
            {(!ch.outcome || ch.outcome === "held") && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">
                Answer held
              </span>
            )}
            {ch.engine === "deterministic_fallback" && (
              <span className="chip chip-src text-[10px]">offline reasoner</span>
            )}
          </div>
        </div>

        {/* Right Toggle Indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden font-mono text-[11px] text-slate-400 sm:inline group-hover:text-slate-600 dark:group-hover:text-slate-300">
            {open ? "Collapse reasoning" : "Expand audit trace"}
          </span>
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <ChevronIcon open={open} className="h-3.5 w-3.5" />
          </div>
        </div>
      </button>

      {/* ── Collapsible Progressive Streaming Body ──────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="overflow-hidden border-t border-slate-100 bg-slate-50/40 dark:border-slate-800/80 dark:bg-slate-950/20"
          >
            <div className="p-4 sm:p-5 space-y-4">
              {/* Header Bar with Key Points Tag & Skip Streaming button */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {isStreaming ? (
                    <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                      Streaming Adversarial Defense Trace...
                    </span>
                  ) : (
                    <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                      <span>Adversarial Attack & Governance Audit</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        Key terms bolded for demo
                      </span>
                    </span>
                  )}
                </div>

                {isStreaming && (
                  <button
                    type="button"
                    onClick={skipStreaming}
                    className="font-mono text-[10.5px] font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer"
                  >
                    ⚡ Fast Forward
                  </button>
                )}
              </div>

              {/* 1. The Attack Text (Progressively Streamed with Highlights) */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <AlertIcon className="h-4 w-4 text-amber-500" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                      The Adversarial Attack
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                    Self-Challenger Hypothesis
                  </span>
                </div>

                <div className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 font-sans">
                  {renderForensicHighlights(visibleAttack)}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-amber-500 animate-pulse align-middle" />
                  )}
                </div>
              </div>

              {/* 2. Secondary Sections (Revealed smoothly) */}
              {showSecondary && (
                <m.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  {/* Why attack landed / Why answer held */}
                  {ch.why && (
                    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                      <span className="font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        {ch.revised ? "Why the attack landed" : "Why the answer held"}
                      </span>
                      <div className="text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {renderForensicHighlights(ch.why)}
                      </div>
                    </div>
                  )}

                  {/* Governance Overrule / Invariant Protection */}
                  {ch.outcome === "overridden" && ch.override_reason && (
                    <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 p-3.5 dark:border-rose-900/60 dark:bg-rose-950/20">
                      <div className="flex items-center gap-1.5 mb-1 text-rose-800 dark:text-rose-300">
                        <ShieldIcon className="h-4 w-4 shrink-0" />
                        <span className="font-mono text-[11.5px] font-bold">
                          Governance Rule Enforcement (Overruled Attack)
                        </span>
                      </div>
                      <div className="text-[12.5px] leading-relaxed text-rose-900/90 dark:text-rose-200">
                        {renderForensicHighlights(ch.override_reason)}
                      </div>
                    </div>
                  )}

                  {/* Why it changed nothing (if blocked) */}
                  {ch.outcome === "blocked" && ch.blocked_reason && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                      <span className="font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Why it changed nothing
                      </span>
                      <div className="text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {renderForensicHighlights(ch.blocked_reason)}
                      </div>
                    </div>
                  )}

                  {/* Bottom Meta Bounds */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {ch.weakest_link && (
                        <span>
                          Leans most on:{" "}
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {checkLabel(ch.weakest_link)}
                          </span>
                        </span>
                      )}
                      {ch.decisive_artefact && (
                        <span>
                          Settled by:{" "}
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {ch.decisive_artefact}
                          </span>
                        </span>
                      )}
                    </div>

                    <p className="font-mono text-[10.5px] text-slate-400 dark:text-slate-500 italic max-w-xl">
                      * Invariant: A successful challenge may only move a verdict toward caution — never from suspicion to approval.
                    </p>
                  </div>
                </m.div>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}


