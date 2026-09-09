import * as m from "motion/react-m";
import { stagger, type Variants } from "motion/react";
import type { AnalysisResult } from "../types";
import type { Desk } from "../history";
import { Section } from "./Section";
import { BuildingIcon, CheckIcon, TruckIcon, UserIcon } from "./Icons";

const ROLES: {
  key: Desk;
  label: string;
  subtitle: string;
  icon: typeof TruckIcon;
  tint: string;
  activeRing: string;
}[] = [
  {
    key: "distributor",
    label: "Distributor Desk",
    subtitle: "Goods Inward & Quarantine",
    icon: TruckIcon,
    tint: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    activeRing: "border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20",
  },
  {
    key: "oem",
    label: "OEM Brand Protection",
    subtitle: "Statutory Enforcement & Legal",
    icon: BuildingIcon,
    tint: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    activeRing: "border-purple-500 ring-2 ring-purple-500/30 bg-purple-50/40 dark:bg-purple-950/20",
  },
  {
    key: "service",
    label: "Showroom & Service",
    subtitle: "Warranty & Workshop Safety",
    icon: UserIcon,
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    activeRing: "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20",
  },
];

const grid: Variants = { hidden: {}, show: { transition: { delayChildren: stagger(0.08, { startDelay: 0.15 }) } } };
const card: Variants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { type: "spring", visualDuration: 0.35, bounce: 0.15 } } };

interface Props {
  actions: AnalysisResult["actions"];
  desk: Desk;
  onDesk: (d: Desk) => void;
}

export function Actions({ actions, desk, onDesk }: Props) {
  return (
    <Section
      title="Multi-Desk Operational Directives"
      aside={
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          Click any role to switch active desk perspective
        </span>
      }
    >
      <m.div className="grid grid-cols-1 gap-3 md:grid-cols-3" variants={grid} initial="hidden" animate="show">
        {ROLES.map(({ key, label, subtitle, icon: Icon, tint, activeRing }) => {
          const isActive = desk === key;
          return (
            <m.button
              key={key}
              type="button"
              onClick={() => onDesk(key)}
              variants={card}
              className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 text-left shadow-2xs transition-all cursor-pointer ${
                isActive
                  ? `${activeRing} shadow-md`
                  : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/40"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${tint}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                        {label}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                        {subtitle}
                      </span>
                    </div>
                  </div>

                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white shadow-2xs dark:bg-white dark:text-slate-900 shrink-0">
                      <CheckIcon className="h-3 w-3" /> Focus
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed font-medium text-slate-700 dark:text-slate-300 pt-1">
                  {actions[key]}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 font-mono text-[10.5px]">
                {isActive ? (
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    ● Active Playbook Selected
                  </span>
                ) : (
                  <span className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    Click to switch to this desk →
                  </span>
                )}
              </div>
            </m.button>
          );
        })}
      </m.div>
    </Section>
  );
}
