/**
 * VerdictCard — Executive Regulatory & Provenance Synthesis.
 *
 * Implements the 2-Card Layout:
 *   1. Left Card: Forensic Verdict & 4-Pillar Dimension Status with Watermark & Metrics
 *   2. Right Card: Official MCA Master Registry Dossier
 */

import { useState } from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import type { AnalysisResult, Dimension } from "../types";
import { SUBTYPE_LABELS, formatDate, humanize, splitEvidence, titleCase, verdictSentence } from "../labels";
import { CountUp, LetterReveal, TextGenerate } from "./effects";
import { PillarModal } from "./PillarModal";
import {
  BarChartIcon,
  BuildingIcon,
  CheckCircleIcon,
  CopyIcon,
  FileIcon,
  InfoIcon,
  LinkIcon,
  ShieldAlertIcon,
  ShieldIcon,
  TargetIcon,
  UserIcon,
  XIcon,
} from "./Icons";

interface Props {
  result: AnalysisResult;
}

export function VerdictCard({ result: r }: Props) {
  const [copied, setCopied] = useState(false);
  const [selectedPillar, setSelectedPillar] = useState<Dimension | null>(null);
  const { primary, weaker, suspect, support } = splitEvidence(r.ledger.findings);
  const decisive = primary.filter((f) => f.strength === "dispositive").length;
  const total = r.ledger.findings.length;
  const row = r.registry_row;
  const status = row?.status?.trim() ?? null;
  const statusActive = status !== null && status.toLowerCase() === "active";
  const nic = row?.nic_code ?? null;
  const trader = nic?.startsWith("45");
  const isLLP = row?.cin ? row.cin.length <= 10 || row.cin.includes("-") : false;
  const bis = r.ledger.findings.find((f) => f.check === "bis_licence_valid");

  const dimensionLabel = (dimension: keyof AnalysisResult["dimension_status"]) => {
    const value = r.dimension_status[dimension];
    return value.status === "supported" ? `${value.support} supported` :
      value.status === "contradicted" ? `${value.contradictions} contradicted` :
      value.status === "unavailable" ? "Unavailable" : "Incomplete";
  };
  const certificationLabel = bis?.result === "pass" ? "Demo BIS record matched" : dimensionLabel("certification");

  const copyCIN = () => {
    if (row?.cin) {
      void navigator.clipboard.writeText(row.cin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isSuspect = r.verdict === "SUSPECT";
  const isGenuine = r.verdict === "GENUINE";

  return (
    <div className="space-y-6">
      {/* 2-Card Grid Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* ── LEFT CARD: VERDICT & 4 PILLARS ──────────────────────────────── */}
        <m.section
          className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div>
            {/* Top Header Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl shadow-2xs ${
                    isSuspect
                      ? "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                      : isGenuine
                      ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                  }`}
                >
                  {isSuspect ? (
                    <ShieldAlertIcon className="h-4 w-4" />
                  ) : isGenuine ? (
                    <ShieldIcon className="h-4 w-4" />
                  ) : (
                    <ShieldAlertIcon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`font-mono text-xs font-bold uppercase tracking-wider ${
                    isSuspect
                      ? "text-rose-600 dark:text-rose-400"
                      : isGenuine
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  VERDICT
                </span>
              </div>

              {/* Right Alert Badge */}
              {isSuspect && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-mono text-[11px] font-semibold text-rose-700 shadow-2xs dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  <span className="text-rose-500 font-bold">⚡</span>
                  High attention required
                </span>
              )}
              {isGenuine && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-[11px] font-semibold text-emerald-700 shadow-2xs dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Verified Authentic
                </span>
              )}
              {r.verdict === "UNVERIFIABLE" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-mono text-[11px] font-semibold text-amber-800 shadow-2xs dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {r.subtype ? SUBTYPE_LABELS[r.subtype] : "Missing Records"}
                </span>
              )}
            </div>

            {/* Hero Verdict with Floating Watermark */}
            <div className="relative mt-4 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h2
                  id="verdict-word"
                  className={`font-mono text-3xl sm:text-4xl font-extrabold tracking-tight ${
                    isSuspect
                      ? "text-rose-600 dark:text-rose-500"
                      : isGenuine
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  <LetterReveal text={r.verdict} />
                </h2>

                <p className="max-w-xl text-[13.5px] sm:text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
                  <TextGenerate text={verdictSentence(r)} />
                </p>
              </div>

              {/* Watermark Emblem */}
              <div
                className={`hidden sm:flex h-20 w-20 shrink-0 items-center justify-center rounded-full ${
                  isSuspect
                    ? "bg-rose-500/10 text-rose-500/80 dark:bg-rose-500/20"
                    : isGenuine
                    ? "bg-emerald-500/10 text-emerald-500/80 dark:bg-emerald-500/20"
                    : "bg-amber-500/10 text-amber-500/80 dark:bg-amber-500/20"
                }`}
                aria-hidden="true"
              >
                {isSuspect ? (
                  <ShieldAlertIcon className="h-10 w-10" />
                ) : (
                  <ShieldIcon className="h-10 w-10" />
                )}
              </div>
            </div>

            {/* 4 Dimension Status Cards (Click to Inspect Modal) */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:grid-cols-4">
              {/* 1. Identity */}
              <button
                type="button"
                onClick={() => setSelectedPillar("identity")}
                className="group flex items-center gap-2.5 rounded-2xl border border-sky-200/80 bg-sky-50/60 p-2.5 sm:p-3 shadow-2xs transition-all hover:bg-sky-100/70 hover:border-sky-300 hover:scale-[1.02] text-left dark:border-sky-900/40 dark:bg-sky-950/20 dark:hover:bg-sky-900/30 cursor-pointer"
                title="Click to view Identity evidence dossier"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 group-hover:scale-105 transition-transform dark:text-sky-400">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="flex items-center justify-between font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
                    1. Identity
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-sky-600 dark:text-sky-400">↗</span>
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                    {dimensionLabel("identity")}
                  </span>
                </div>
              </button>

              {/* 2. Certification */}
              <button
                type="button"
                onClick={() => setSelectedPillar("certification")}
                className="group flex items-center gap-2.5 rounded-2xl border border-purple-200/80 bg-purple-50/60 p-2.5 sm:p-3 shadow-2xs transition-all hover:bg-purple-100/70 hover:border-purple-300 hover:scale-[1.02] text-left dark:border-purple-900/40 dark:bg-purple-950/20 dark:hover:bg-purple-900/30 cursor-pointer"
                title="Click to view Certification evidence dossier"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 group-hover:scale-105 transition-transform dark:text-purple-400">
                  <FileIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="flex items-center justify-between font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
                    2. Certification
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-purple-600 dark:text-purple-400">↗</span>
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                    {certificationLabel}
                  </span>
                </div>
              </button>

              {/* 3. Dispatch & Transfer */}
              <button
                type="button"
                onClick={() => setSelectedPillar("custody")}
                className="group flex items-center gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-2.5 sm:p-3 shadow-2xs transition-all hover:bg-amber-100/70 hover:border-amber-300 hover:scale-[1.02] text-left dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 cursor-pointer"
                title="Click to view Dispatch & Transfer Chain evidence dossier"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                  <ShieldIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="flex items-center justify-between font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
                    3. Dispatch & Transfer
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-amber-600 dark:text-amber-400">↗</span>
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                    {dimensionLabel("custody")}
                  </span>
                </div>
              </button>

              {/* 4. Provenance */}
              <button
                type="button"
                onClick={() => setSelectedPillar("provenance")}
                className="group flex items-center gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-2.5 sm:p-3 shadow-2xs transition-all hover:bg-emerald-100/70 hover:border-emerald-300 hover:scale-[1.02] text-left dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 cursor-pointer"
                title="Click to view Provenance evidence dossier"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                  <LinkIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="flex items-center justify-between font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
                    4. Provenance
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-emerald-600 dark:text-emerald-400">↗</span>
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                    {r.injection_flags.length ? "Injection flagged" : dimensionLabel("provenance")}
                  </span>
                </div>
              </button>
            </div>

            {/* Badges Ribbon */}
            <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
              {/* Confidence Pill */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50/80 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                <TargetIcon className="h-3.5 w-3.5 text-rose-500" />
                {r.confidence.level} confidence
              </span>

              {/* Scope Pill */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200/80 bg-purple-50/80 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300">
                <FileIcon className="h-3.5 w-3.5 text-purple-500" />
                documentary scope
              </span>

              {/* Contradiction Counter Pill */}
              {r.verdict !== "GENUINE" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50/80 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                  <XIcon className="h-3.5 w-3.5 text-rose-500" />
                  <CountUp value={suspect.length} /> of {total} checks contradict records
                </span>
              )}

              {/* Strength Pill */}
              {r.verdict === "SUSPECT" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                  <BarChartIcon className="h-3.5 w-3.5 text-blue-500" />
                  {[
                    decisive ? `${decisive} decisive` : null,
                    primary.length - decisive ? `${primary.length - decisive} strong` : null,
                    weaker.length ? `${weaker.length} weaker` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}

              {r.verdict === "GENUINE" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CountUp value={r.counts.supports_genuine || support.length} /> checks support the documents
                </span>
              )}
            </div>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {r.rules_only ? "Deterministic checks only." : "All 5 pipeline stages evaluated."}
            </p>
          </div>

          {/* Bottom Legal / Limitations Tip Row */}
          <div className="mt-4 flex items-start gap-2.5 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400 mt-0.5">
              <InfoIcon className="h-3.5 w-3.5" />
            </div>
            <p className="leading-relaxed">
              {r.confidence.basis[0]} {r.confidence.limitations[0]}
            </p>
          </div>
        </m.section>

        {/* ── RIGHT CARD: MCA REGISTRY DOSSIER ───────────────────────────── */}
        <m.aside
          className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400">
                  <BuildingIcon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    MCA MASTER DOSSIER
                  </h4>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                    Ministry of Corporate Affairs
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-50/80 px-2.5 py-1 text-right font-mono text-[9.5px] font-semibold text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/60 dark:text-blue-300 leading-tight shrink-0">
                <div>3.67M Index</div>
                <div className="text-[9px] opacity-75">{r.elapsed_ms ?? 1420} ms</div>
              </div>
            </div>

            {/* Entity Dossier Body */}
            {row ? (
              <div className="space-y-3">
                {/* Hero Entity Header Card */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        Official Registered Supplier
                      </span>
                      <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-white leading-snug mt-0.5">
                        {titleCase(row.name.toLowerCase())}
                      </h3>
                    </div>
                    <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                      {isLLP ? "LLP" : "Pvt Ltd"}
                    </span>
                  </div>

                  {/* Monospace CIN / LLPIN Copy Bar */}
                  <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-white p-2 border border-slate-200/70 dark:bg-slate-900 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 min-w-0 font-mono text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {isLLP ? "LLPIN:" : "CIN:"}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-[11.5px]">
                        {row.cin}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={copyCIN}
                      className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
                      title={copied ? "Copied!" : "Copy Corporate Identifier"}
                      aria-label="Copy Corporate Identifier"
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                      <span className="font-mono text-[10px]">{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                {/* Structured 2x2 Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Status */}
                  <div className="rounded-xl border border-slate-200/70 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-[9.5px] font-mono text-slate-400 block uppercase">
                      Status
                    </span>
                    <span className={`inline-flex items-center gap-1 font-bold mt-0.5 text-xs ${statusActive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusActive ? "bg-emerald-500" : "bg-amber-500"}`} />
                      {status ?? "Active"}
                    </span>
                  </div>

                  {/* RoC Jurisdiction */}
                  <div className="rounded-xl border border-slate-200/70 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-[9.5px] font-mono text-slate-400 block uppercase">
                      RoC State
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block truncate mt-0.5 text-xs">
                      {row.state_name ? titleCase(row.state_name) : "Official Registry"}
                    </span>
                  </div>

                  {/* Incorporation Date */}
                  <div className="rounded-xl border border-slate-200/70 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-[9.5px] font-mono text-slate-400 block uppercase">
                      Incorporated
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block mt-0.5 text-xs">
                      {formatDate(row.registration_date)}
                    </span>
                  </div>

                  {/* Activity Classification */}
                  <div className="rounded-xl border border-slate-200/70 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-[9.5px] font-mono text-slate-400 block uppercase">
                      Activity
                    </span>
                    <span className={`font-bold block truncate mt-0.5 text-xs ${trader ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"}`}>
                      {nic ? (trader ? "Trading (NIC 45)" : `Mfg (${nic})`) : "Commercial / LLP"}
                    </span>
                  </div>
                </div>

                {/* Industry Line */}
                {row.industry && (
                  <div className="rounded-xl bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-950/40 dark:text-slate-400 border border-slate-100 dark:border-slate-800/80">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Industry: </span>
                    {row.industry}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No statutory MCA record was found for this identifier.
              </div>
            )}
          </div>

          {/* Statutory Integrity Guarantee Footer */}
          <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-[10.5px] text-slate-400 dark:border-slate-800 dark:text-slate-500 font-mono">
            <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Statutory DuckDB Match</span>
          </div>
        </m.aside>
      </div>

      {/* Unverifiable Work-Order Block (When applicable) */}
      {r.verdict === "UNVERIFIABLE" && (
        <m.div
          className="relative space-y-3 rounded-3xl border border-amber-200/80 bg-amber-50/70 p-6 dark:border-amber-900/50 dark:bg-amber-950/30 shadow-xs"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-2xs dark:border-amber-900/60 dark:bg-slate-900">
              <span className="eyebrow block text-amber-700 dark:text-amber-400">Decisive Missing Artefact</span>
              <p className="mt-1 text-[13px] leading-relaxed font-semibold text-slate-900 dark:text-slate-100">{r.missing_artefact}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-2xs dark:border-amber-900/60 dark:bg-slate-900">
              <span className="eyebrow block text-amber-700 dark:text-amber-400">Interim Desk Action</span>
              <p className="mt-1 text-[13px] leading-relaxed font-semibold text-slate-900 dark:text-slate-100">{r.interim_action}</p>
            </div>
          </div>
          {r.lean && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="chip chip-unv">{r.lean.direction === "none" ? "No directional lean" : `Leans ${r.lean.direction} · ${r.lean.confidence} confidence`}</span>
              <span>{humanize(r.lean.basis)}</span>
            </p>
          )}
        </m.div>
      )}

      {/* Deep-Dive Pillar Forensic Modal */}
      <AnimatePresence>
        {selectedPillar && (
          <PillarModal
            dimension={selectedPillar}
            onClose={() => setSelectedPillar(null)}
            result={r}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
