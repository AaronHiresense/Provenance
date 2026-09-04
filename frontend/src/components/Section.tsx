import type { ReactNode } from "react";
import * as m from "motion/react-m";

interface Props {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}

/** A heading and a rule, not another card: hierarchy comes from the verdict
 *  card being the only lifted object on the page. Fades up as it scrolls
 *  into view. */
export function Section({ title, aside, children }: Props) {
  return (
    <m.section className="space-y-3.5" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.4, ease: "easeOut" }}>
      <div className="flex items-baseline gap-3 border-b border-slate-200 pb-2.5 dark:border-slate-800">
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">{title}</h3>
        <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">{aside}</div>
      </div>
      {children}
    </m.section>
  );
}
