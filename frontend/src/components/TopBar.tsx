/**
 * TopBar — Main Application Navigation & Context Switcher.
 *
 * Features:
 *   - Custom Operational Desk Persona Selector with rich roles & descriptions
 *   - Live Statutory Registry connection status
 *   - Theme switcher (Light/Dark)
 *   - New Investigation launcher
 */

import { useState, useRef, useEffect } from "react";
import type { Theme } from "../hooks/useTheme";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { DESKS, type Desk } from "../history";
import {
  BuildingIcon,
  CheckIcon,
  ChevronIcon,
  MoonIcon,
  SunIcon,
  TruckIcon,
  UserIcon,
} from "./Icons";

import logoUrl from "../assets/logo.jpg";

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
  busy: boolean;
  desk: Desk;
  onDesk: (d: Desk) => void;
  showNew: boolean;
  onNew: () => void;
}

const DESK_CONFIG: Record<
  Desk,
  { label: string; short: string; sub: string; icon: typeof TruckIcon; tint: string }
> = {
  distributor: {
    label: "Distributor Desk",
    short: "Distributor",
    sub: "Goods inward, inventory quarantine & debit notes",
    icon: TruckIcon,
    tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  oem: {
    label: "OEM Brand Protection",
    short: "OEM Desk",
    sub: "Counterfeit interception & statutory legal referral",
    icon: BuildingIcon,
    tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  service: {
    label: "Showroom & Service",
    short: "Service Desk",
    sub: "Warranty validation, workshop & technician safety",
    icon: UserIcon,
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
};

export function TopBar({ theme, onToggleTheme, busy, desk, onDesk, showNew, onNew }: Props) {
  const [deskMenuOpen, setDeskMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeDesk = DESK_CONFIG[desk];
  const ActiveIcon = activeDesk.icon;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setDeskMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md sm:px-8 dark:border-slate-800 dark:bg-slate-900/90">
      {/* Brand & Left Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onNew}
          className="group flex items-center gap-2.5 text-left cursor-pointer"
          aria-label="Provenance Home"
        >
          <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-slate-700/50 bg-[#0c0e12] shadow-xs transition-all group-hover:scale-105 group-hover:border-amber-500/60 group-hover:shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <img src={logoUrl} alt="Provenance Logo" className="h-full w-full object-cover scale-125" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              PROVENANCE
            </span>
            <span className="font-mono text-[9px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider mt-0.5">
              FORENSIC INTEL
            </span>
          </div>
        </button>

        {showNew && (
          <m.button
            type="button"
            onClick={onNew}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-[11px] font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            <span>+</span> New Investigation
          </m.button>
        )}
      </div>

      {/* Right Actions: Operational Desk Switcher, System Status, Theme Toggle */}
      <div className="flex items-center gap-3 text-xs">
        {/* Operational Desk Persona Selector */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setDeskMenuOpen((v) => !v)}
            aria-expanded={deskMenuOpen}
            aria-haspopup="true"
            className="flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs transition-all hover:bg-slate-100 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <div className={`flex h-4 w-4 items-center justify-center rounded ${activeDesk.tint}`}>
              <ActiveIcon className="h-3 w-3" />
            </div>
            <span className="font-medium text-slate-500 dark:text-slate-400 text-[11px]">Desk:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{activeDesk.short}</span>
            <ChevronIcon open={deskMenuOpen} className="h-3 w-3 text-slate-400 transition-transform" />
          </button>

          {/* Desk Persona Dropdown Menu */}
          <AnimatePresence>
            {deskMenuOpen && (
              <m.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-slate-200/90 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50"
              >
                <div className="px-2.5 py-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-mono text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                    OPERATIONAL DESK PERSONA
                  </span>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Tailors recommended hold, release & referral playbooks
                  </p>
                </div>

                <div className="mt-1 space-y-1">
                  {DESKS.map((d) => {
                    const cfg = DESK_CONFIG[d.key];
                    const Icon = cfg.icon;
                    const isSelected = desk === d.key;

                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => {
                          onDesk(d.key);
                          setDeskMenuOpen(false);
                        }}
                        className={`flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-slate-100/90 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-semibold"
                            : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg mt-0.5 ${cfg.tint}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {cfg.label}
                            </span>
                            {isSelected && <CheckIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                          </div>
                          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block leading-tight mt-0.5">
                            {cfg.sub}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live System Telemetry Badge */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/60 px-3 py-1 font-mono text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          <span className="relative flex h-2 w-2">
            {busy ? (
              <m.span
                className="absolute inset-0 rounded-full bg-blue-500"
                animate={{ scale: [1, 2], opacity: [0.8, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
              />
            ) : (
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </span>
          <span className="font-semibold">{busy ? "Analyzing Pipeline" : "3.67M MCA Online"}</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="rounded-full border border-slate-200/80 p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title="Switch colour theme"
        >
          {theme === "dark" ? (
            <SunIcon className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <MoonIcon className="h-3.5 w-3.5 text-indigo-600" />
          )}
        </button>
      </div>
    </header>
  );
}
