import type { ComponentType, ReactNode } from "react";
import * as m from "motion/react-m";

interface Props {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: ComponentType<{ className?: string }>;
  tint?: "blue" | "amber" | "purple" | "emerald" | "rose" | "slate";
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

const TINT_STYLES: Record<
  string,
  {
    container: string;
    headerBorder: string;
    badge: string;
    icon: string;
    glow: string;
  }
> = {
  blue: {
    container: "border-blue-500/25 bg-blue-50/20 dark:bg-blue-950/10 dark:border-blue-500/25",
    headerBorder: "border-blue-500/20 dark:border-blue-500/20",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    icon: "text-blue-600 dark:text-blue-400 bg-blue-500/15",
    glow: "shadow-[0_4px_24px_rgba(59,130,246,0.03)]",
  },
  amber: {
    container: "border-amber-500/25 bg-amber-50/20 dark:bg-amber-950/10 dark:border-amber-500/25",
    headerBorder: "border-amber-500/20 dark:border-amber-500/20",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icon: "text-amber-600 dark:text-amber-400 bg-amber-500/15",
    glow: "shadow-[0_4px_24px_rgba(245,158,11,0.03)]",
  },
  purple: {
    container: "border-purple-500/25 bg-purple-50/20 dark:bg-purple-950/10 dark:border-purple-500/25",
    headerBorder: "border-purple-500/20 dark:border-purple-500/20",
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
    icon: "text-purple-600 dark:text-purple-400 bg-purple-500/15",
    glow: "shadow-[0_4px_24px_rgba(168,85,247,0.03)]",
  },
  emerald: {
    container: "border-emerald-500/25 bg-emerald-50/20 dark:bg-emerald-950/10 dark:border-emerald-500/25",
    headerBorder: "border-emerald-500/20 dark:border-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    icon: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15",
    glow: "shadow-[0_4px_24px_rgba(16,185,129,0.03)]",
  },
  rose: {
    container: "border-rose-500/25 bg-rose-50/20 dark:bg-rose-950/10 dark:border-rose-500/25",
    headerBorder: "border-rose-500/20 dark:border-rose-500/20",
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
    icon: "text-rose-600 dark:text-rose-400 bg-rose-500/15",
    glow: "shadow-[0_4px_24px_rgba(244,63,94,0.03)]",
  },
  slate: {
    container: "border-slate-200/90 bg-slate-50/40 dark:bg-slate-900/30 dark:border-slate-800",
    headerBorder: "border-slate-200/80 dark:border-slate-800",
    badge: "bg-slate-200/60 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    icon: "text-slate-600 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800",
    glow: "shadow-2xs",
  },
};

/**
 * Presentation-Grade Section Component:
 * Borderized card container with soft dim colorization, module sequence badge, and icon.
 */
export function Section({
  title,
  subtitle,
  badge,
  icon: Icon,
  tint = "slate",
  aside,
  children,
  className = "",
}: Props) {
  const styles = TINT_STYLES[tint] || TINT_STYLES.slate;

  return (
    <m.section
      className={`overflow-hidden rounded-3xl border p-5 sm:p-6 transition-all ${styles.container} ${styles.glow} ${className}`}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* ── Visual Section Header Bar ───────────────────────────────── */}
      <div
        className={`flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-4 border-b ${styles.headerBorder}`}
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
              <Icon className="h-4 w-4" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {badge && (
                <span
                  className={`font-mono text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-2xs ${styles.badge}`}
                >
                  {badge}
                </span>
              )}
              <h3 className="text-[15.5px] font-bold text-slate-900 dark:text-white tracking-tight">
                {title}
              </h3>
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {aside && <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{aside}</div>}
      </div>

      {/* ── Section Content ─────────────────────────────────────────── */}
      <div className="pt-4">{children}</div>
    </m.section>
  );
}


