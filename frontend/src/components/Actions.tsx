import * as m from "motion/react-m";
import { stagger, type Variants } from "motion/react";
import type { AnalysisResult } from "../types";
import { Section } from "./Section";

const ROLES: { key: keyof AnalysisResult["actions"]; label: string; primary?: boolean }[] = [
  { key: "distributor", label: "Distributor · Goods Inward", primary: true },
  { key: "oem", label: "OEM Brand Protection" },
  { key: "service", label: "Showroom / Service Desk" },
];

const grid: Variants = { hidden: {}, show: { transition: { delayChildren: stagger(0.08, { startDelay: 0.15 }) } } };
const card: Variants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { type: "spring", visualDuration: 0.35, bounce: 0.15 } } };

export function Actions({ actions }: { actions: AnalysisResult["actions"] }) {
  return (
    <Section title="Multi-Desk Operational Directives" aside="Role-specific action guidelines">
      <m.div className="grid grid-cols-1 gap-3 md:grid-cols-3" variants={grid} initial="hidden" animate="show">
        {ROLES.map(({ key, label, primary }) => (
          <m.div
            key={key}
            variants={card}
            className={`flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${
              primary ? "border-blue-500/80 ring-1 ring-blue-500/40" : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{label}</span>
              {primary && <span className="chip chip-reg">Active Desk</span>}
            </div>
            <p className="text-xs leading-relaxed font-medium text-slate-700 dark:text-slate-300">{actions[key]}</p>
          </m.div>
        ))}
      </m.div>
    </Section>
  );
}
