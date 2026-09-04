import type { AnalysisResult } from "../types";
import type { Theme } from "../hooks/useTheme";
import * as m from "motion/react-m";
import { CpuIcon, MoonIcon, SunIcon } from "./Icons";

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
  result: AnalysisResult | null;
  busy: boolean;
}

export function TopBar({ theme, onToggleTheme, result, busy }: Props) {
  const engine = busy ? "Working" : result ? (result.llm_provider === "mock" ? "Offline" : `${result.llm_provider}${result.llm_model ? ` · ${result.llm_model}` : ""}`) : "Ready";
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md sm:px-8 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white shadow-sm dark:bg-white dark:text-slate-900">P</div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold tracking-tight text-slate-900 dark:text-white">PROVENANCE</span>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Documents &amp; records investigator</span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <div className="hidden items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-600 md:flex dark:bg-slate-800 dark:text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Registry snapshot 22 Jul 2026</span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span className="relative flex h-3.5 w-3.5 items-center justify-center">
            {busy && <m.span className="absolute inset-0 rounded-full bg-blue-500/40" animate={{ scale: [1, 1.8], opacity: [0.8, 0] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }} />}
            <CpuIcon className={`relative h-3.5 w-3.5 ${busy ? "text-blue-500" : "text-slate-400"}`} />
          </span>
          <span>Engine: {engine}</span>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title="Switch colour theme"
        >
          {theme === "dark" ? <SunIcon className="h-4 w-4 text-amber-400" /> : <MoonIcon className="h-4 w-4 text-indigo-600" />}
        </button>
      </div>
    </header>
  );
}
