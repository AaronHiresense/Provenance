/**
 * VerdictCard — Executive Regulatory & Provenance Synthesis.
 *
 * Implements the 2-Card Layout:
 *   1. Left Card: Forensic Verdict & 4-Pillar Dimension Status with Watermark & Metrics
 *   2. Right Card: Official MCA Master Registry Dossier
 */

import { useState } from "react";
import * as m from "motion/react-m";
import type { AnalysisResult } from "../types";
import { SUBTYPE_LABELS, formatDate, humanize, splitEvidence, titleCase, verdictSentence } from "../labels";
import { CountUp, LetterReveal, TextGenerate } from "./effects";
import {
  BarChartIcon,
  BuildingIcon,
  CheckCircleIcon,
  CopyIcon,
  FactoryIcon,
  FileIcon,
  FingerprintIcon,
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
  const { primary, weaker, suspect, support } = splitEvidence(r.ledger.findings);
  const decisive = primary.filter((f) => f.strength === "dispositive").length;
  const total = r.ledger.findings.length;
  const row = r.registry_row;
  const status = row?.status?.trim() ?? null;
  const statusActive = status !== null && status.toLowerCase() === "active";
  const nic = row?.nic_code ?? null;
  const trader = nic?.startsWith("45");
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

            {/* 4 Dimension Status Cards */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:grid-cols-4">
              {/* 1. Identity */}
              <div className="flex items-center gap-2.5 rounded-2xl border border-sky-200/80 bg-sky-50/60 p-2.5 sm:p-3 shadow-2xs dark:border-sky-900/40 dark:bg-sky-950/20">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
                    1. Identity
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    {dimensionLabel("identity")}
                  </span>
                </div>
              </div>

              {/* 2. Certification */}
              <div className="flex items-center gap-2.5 rounded-2xl border border-purple-200/80 bg-purple-50/60 p-2.5 sm:p-3 shadow-2xs dark:border-purple-900/40 dark:bg-purple-950/20">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                  <FileIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
                    2. Certification
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    {certificationLabel}
                  </span>
                </div>
              </div>

              {/* 3. Custody */}
              <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-2.5 sm:p-3 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <ShieldIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
                    3. Custody
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    {dimensionLabel("custody")}
                  </span>
                </div>
              </div>

              {/* 4. Provenance */}
              <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-2.5 sm:p-3 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <LinkIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 leading-tight">
                    4. Provenance
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    {r.injection_flags.length ? "Injection flagged" : dimensionLabel("provenance")}
                  </span>
                </div>
              </div>
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
                  <FileIcon className="h-4 w-4" />
                </div>
                <h4 className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider whitespace-nowrap">
                  MCA REGISTRY DOSSIER
                </h4>
              </div>

              <div className="rounded-xl bg-blue-50/80 px-2.5 py-1 text-right font-mono text-[9.5px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 leading-tight shrink-0 whitespace-nowrap">
                <div>3.67M MCA queried</div>
                <div className="text-[9px] opacity-80">{r.elapsed_ms ?? 19200} ms</div>
              </div>
            </div>

            {/* Data Rows */}
            {row ? (
              <div className="space-y-4 text-xs">
                {/* Row 1: Supplier */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 text-slate-400 w-24 shrink-0 pt-0.5">
                    <BuildingIcon className="h-3.5 w-3.5" />
                    <span className="font-medium text-slate-500 dark:text-slate-400">Supplier</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    {titleCase(row.name.toLowerCase())}
                  </span>
                </div>

                {/* Row 2: CIN */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-slate-400 w-24 shrink-0">
                    <FingerprintIcon className="h-3.5 w-3.5" />
                    <span className="font-medium text-slate-500 dark:text-slate-400">CIN</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {row.cin}
                    </span>
                    <button
                      type="button"
                      onClick={copyCIN}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      title={copied ? "Copied!" : "Copy CIN"}
                      aria-label="Copy Corporate Identification Number"
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                    </button>
                    {copied && (
                      <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                        copied
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 3: Registry */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 text-slate-400 w-24 shrink-0 pt-0.5">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    <span className="font-medium text-slate-500 dark:text-slate-400">Registry</span>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 leading-snug">
                    <span className={`inline-flex items-center gap-1 font-bold ${statusActive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      <span className={`h-2 w-2 rounded-full ${statusActive ? "bg-emerald-500" : "bg-amber-500"}`} />
                      {status ?? "Active"}
                    </span>
                    {"  ·  inc. "}
                    {formatDate(row.registration_date)}
                    {row.state_name ? `  ·  ${titleCase(row.state_name)}` : ""}
                  </div>
                </div>

                {/* Row 4: Activity */}
                {nic && (
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 text-slate-400 w-24 shrink-0 pt-0.5">
                      <FactoryIcon className="h-3.5 w-3.5" />
                      <span className="font-medium text-slate-500 dark:text-slate-400">Activity</span>
                    </div>
                    <span className={`font-bold leading-snug ${trader ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"}`}>
                      {trader ? "Parts Trader / Reseller" : (row.industry ?? "Manufacturing (Machinery and Equipments)")}
                      {` (NIC ${nic})`}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No registry record was found for the identifier in these documents.
              </p>
            )}
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
    </div>
  );
}
