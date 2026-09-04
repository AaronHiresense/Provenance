import type { ReactNode } from "react";

interface Props {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}

/** A heading and a rule, not another card: hierarchy comes from the verdict
 *  card being the only lifted object on the page. */
export function Section({ title, aside, children }: Props) {
  return (
    <section className="space-y-3.5">
      <div className="flex items-baseline gap-3 border-b border-slate-200 pb-2.5 dark:border-slate-800">
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">{title}</h3>
        <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">{aside}</div>
      </div>
      {children}
    </section>
  );
}
