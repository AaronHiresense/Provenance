/**
 * PillarModal — Deep-Dive Forensic Inspection Modal for Dimension Pillars.
 *
 * Provides a dedicated evidence dossier when clicking any of the 4 dimension cards
 * (Identity, Certification, Custody, Provenance).
 */

import { useEffect, useMemo } from "react";
import * as m from "motion/react-m";
import type { AnalysisResult, Dimension } from "../types";
import {
  GROUPS,
  SOURCE_LABELS,
  STRENGTH_LABELS,
  byConsequence,
  checkLabel,
  findingLabel,
  pairReasoning,
  resultKind,
  rulingLabel,
} from "../labels";
import {
  BadgeCheckIcon,
  BoxIcon,
  CheckIcon,
  FingerprintIcon,
  ShieldAlertIcon,
  ShieldIcon,
  XIcon,
} from "./Icons";

const PILLAR_ICONS: Record<Dimension, typeof ShieldIcon> = {
  identity: ShieldIcon,
  certification: BadgeCheckIcon,
  custody: BoxIcon,
  provenance: FingerprintIcon,
};

const PILLAR_DESCRIPTIONS: Record<Dimension, string> = {
  identity:
    "Statutory identity validation, Ministry of Corporate Affairs (MCA) registration, GSTIN checksum verification, and authorized business classification.",
  certification:
    "Conformity assessment, Bureau of Indian Standards (BIS) license validity, ARAI/ICAT Type Approval Certificates (TAC), and OEM specification fidelity.",
  custody:
    "Factory dispatch reconciliation, authorized transfer parties, e-way bill transit validity, and chronological handover integrity.",
  provenance:
    "Documentary authenticity, OEM batch grammar syntax, anti-tampering heuristics, duplicate paperwork screening, and dispatch reconciliation.",
};

interface Props {
  dimension: Dimension | null;
  onClose: () => void;
  result: AnalysisResult;
}

export function PillarModal({ dimension, onClose, result: r }: Props) {
  const findings = r.ledger.findings;
  const reasoning = useMemo(() => pairReasoning(findings, r.reasoning), [findings, r.reasoning]);

  const pillarFindings = useMemo(() => {
    if (!dimension) return [];
    return findings.filter((f) => f.dimension === dimension).sort(byConsequence);
  }, [dimension, findings]);

  const groupMeta = useMemo(() => {
    if (!dimension) return null;
    return GROUPS.find((g) => g.key === dimension);
  }, [dimension]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!dimension || !groupMeta) return null;

  const Icon = PILLAR_ICONS[dimension];
  const dimStatus = r.dimension_status[dimension];
  const bad = pillarFindings.filter((f) => f.direction === "supports_suspect");
  const good = pillarFindings.filter((f) => f.direction === "supports_genuine");

  // Top strongest proof points
  const topEvidence = good.slice(0, 3);
  const criticalViolations = bad;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pillar-modal-title"
    >
      {/* Backdrop */}
      <m.div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Modal Dialog Container */}
      <m.div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 z-10 my-auto max-h-[90vh] flex flex-col"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5 pb-4 dark:border-slate-800 sm:p-6 sm:pb-5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-2xs ${
                bad.length > 0
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  id="pillar-modal-title"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  {groupMeta.name} Pillar Dossier
                </h3>
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full border ${
                    bad.length > 0
                      ? "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400"
                      : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400"
                  }`}
                >
                  {bad.length > 0 ? `${bad.length} Contradiction` : `${good.length} Verified`}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {PILLAR_DESCRIPTIONS[dimension]}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Close dialog"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="overflow-y-auto p-5 space-y-5 sm:p-6">
          {/* Pillar Assessment Summary Box */}
          <div
            className={`rounded-2xl border p-4 text-xs leading-relaxed ${
              bad.length > 0
                ? "border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                : "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2 font-bold font-mono text-[11px] uppercase tracking-wider mb-1">
              {bad.length > 0 ? (
                <>
                  <ShieldAlertIcon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  Pillar Compromised ({bad.length} finding contradicts statutory records)
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Pillar Integrity Verified ({good.length} checks fully corroborated)
                </>
              )}
            </div>
            <p className="text-slate-700 dark:text-slate-300">
              {dimStatus.status === "supported"
                ? `All evaluated ${groupMeta.name.toLowerCase()} assertions are consistent with authoritative master records and verified transfer records.`
                : dimStatus.status === "contradicted"
                ? `One or more checks in the ${groupMeta.name.toLowerCase()} pillar contradict independently verified registries or immutable historical records.`
                : `Insufficient verifiable artefacts to fully certify this pillar.`}
            </p>
          </div>

          {/* Critical Violations (if any) */}
          {criticalViolations.length > 0 && (
            <div className="space-y-3">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                🚨 Critical Contradictions & Violations
              </span>
              <div className="space-y-2.5">
                {criticalViolations.map((f, i) => {
                  const c = reasoning.get(f);
                  return (
                    <div
                      key={i}
                      className="rounded-2xl border border-rose-200/90 bg-white p-4 shadow-2xs dark:border-rose-900/50 dark:bg-slate-900/90"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <span className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100">
                            {findingLabel(f)}
                          </span>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {f.detail}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[10.5px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          {STRENGTH_LABELS[f.strength]}
                        </span>
                      </div>

                      {/* Forensic dual hypothesis */}
                      {c && (
                        <div className="mt-3 grid grid-cols-1 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 sm:grid-cols-2">
                          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-2.5 text-xs">
                            <span className="font-mono text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block mb-0.5">
                              Innocent Reading
                            </span>
                            <p className="text-slate-600 dark:text-slate-400">{c.benign}</p>
                          </div>
                          <div className="rounded-xl bg-rose-500/5 border border-rose-500/15 p-2.5 text-xs">
                            <span className="font-mono text-[9.5px] font-bold text-rose-700 dark:text-rose-400 uppercase block mb-0.5">
                              Forgery Reading
                            </span>
                            <p className="text-slate-600 dark:text-slate-400">{c.malicious}</p>
                          </div>
                          <div className="sm:col-span-2 mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <span className={`chip shrink-0 ${rulingLabel(f, c).cls}`}>
                              {rulingLabel(f, c).text}
                            </span>
                            <span>{c.resolution}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Strong Supporting Proof Points */}
          {topEvidence.length > 0 && (
            <div className="space-y-3">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                🛡️ Key Corroborating Proof Points
              </span>
              <div className="space-y-2">
                {topEvidence.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
                        <CheckIcon className="h-3 w-3" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                          {checkLabel(f.check)}
                        </span>
                        <span className="text-[11.5px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          {f.assertion || f.detail}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700 shrink-0">
                      {SOURCE_LABELS[f.source_tier]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete Checklist for this Pillar */}
          <div className="space-y-2 pt-1">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Complete {groupMeta.name} Ledger ({pillarFindings.length} checks)
            </span>
            <div className="rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden bg-white dark:border-slate-800 dark:divide-slate-800 dark:bg-slate-900">
              {pillarFindings.map((f, i) => {
                const kind = resultKind(f);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            kind === "contradicts"
                              ? "bg-rose-500"
                              : kind === "supports"
                              ? "bg-emerald-500"
                              : "bg-slate-400"
                          }`}
                        />
                        <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {f.direction === "supports_suspect" ? findingLabel(f) : checkLabel(f.check)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-[10.5px]">
                      <span className="text-slate-400">{SOURCE_LABELS[f.source_tier]}</span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded ${
                          kind === "contradicts"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : kind === "supports"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                        }`}
                      >
                        {kind === "contradicts" ? "FAIL" : kind === "supports" ? "PASS" : "NEUTRAL"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs dark:border-slate-800 dark:bg-slate-950/40 sm:px-6">
          <span className="font-mono text-[11px] text-slate-400">
            Source: PROVENANCE Offline MCA / Dispatch Registry
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-900 px-4 py-1.5 font-mono text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 cursor-pointer"
          >
            Close Dossier
          </button>
        </div>
      </m.div>
    </div>
  );
}
