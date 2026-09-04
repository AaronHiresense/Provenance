import type { AnalysisResult } from "../types";
import { Section } from "./Section";

const ROLES: { key: keyof AnalysisResult["actions"]; label: string; primary?: boolean }[] = [
  { key: "distributor", label: "Distributor · goods inward", primary: true },
  { key: "oem", label: "OEM brand protection" },
  { key: "service", label: "Showroom / service" },
];

export function Actions({ actions }: { actions: AnalysisResult["actions"] }) {
  return (
    <Section title="What to do now" aside="Actions differ by desk">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ROLES.map(({ key, label, primary }) => (
          <div key={key} className={`flex flex-col gap-1.5 rounded-lg border bg-white p-3.5 dark:bg-slate-900 ${primary ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 dark:border-slate-800"}`}>
            <div className="flex items-center gap-2">
              <span className="eyebrow text-blue-700 dark:text-blue-400">{label}</span>
              {primary && <span className="chip chip-reg ml-auto">Your desk</span>}
            </div>
            <p className="text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">{actions[key]}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
