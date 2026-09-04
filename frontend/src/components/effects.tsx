// Motion primitives modelled on the open component registries, reimplemented
// on motion/react + Tailwind so everything bundles locally (no CDN):
//   ShimmerText   - 21st.dev agent-elements TextShimmer (MIT), pure CSS
//   BorderBeam    - Magic UI BorderBeam (MIT), offset-path along the card edge
//   CountUp       - Magic UI NumberTicker (MIT), motion value -> text
//   TextGenerate  - Aceternity text-generate-effect pattern (stagger + blur)
//   Spotlight     - motion-primitives Spotlight (MIT), pointer-following glow
//   StatusDot     - interior.dev TaskSteps (MIT) + Vercel AI Elements rail
// Keyframes they rely on live in index.css.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as m from "motion/react-m";
import { animate, stagger, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type Variants } from "motion/react";

/** A highlight that sweeps across the text while something is in progress. */
export function ShimmerText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`shimmer-text ${className}`} aria-live="polite">
      {children}
    </span>
  );
}

/** A light travelling around a card's edge. Parent must be `relative` with
 *  `overflow-hidden`; pass the parent's border radius so the path matches. */
export function BorderBeam({ radius = 12, color = "#3b82f6", duration = 6, size = 120 }: { radius?: number; color?: string; duration?: number; size?: number }) {
  const style = {
    "--beam-size": `${size}px`,
    "--beam-radius": `${radius}px`,
    "--beam-color": color,
    "--beam-duration": `${duration}s`,
  } as CSSProperties;
  return (
    <span aria-hidden="true" className="border-beam pointer-events-none absolute inset-0 rounded-[inherit]" style={style}>
      <span className="border-beam-light" />
    </span>
  );
}

/** Counts up from 0 to `value` once, with tabular digits so the width holds. */
export function CountUp({ value, duration = 0.9, className = "" }: { value: number; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const rounded = useTransform(() => Math.round(mv.get()));
  const [shown, setShown] = useState(() => Math.round(mv.get()));
  useMotionValueEvent(rounded, "change", (v) => setShown(v));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const ctrl = animate(mv, value, { duration, ease: "easeOut" });
    return () => ctrl.stop();
  }, [mv, value, duration, reduce]);
  return <span className={`tabular-nums ${className}`}>{shown}</span>;
}

const wordContainer: Variants = {
  hidden: {},
  show: { transition: { delayChildren: stagger(0.045, { startDelay: 0.15 }) } },
};
const word: Variants = {
  hidden: { opacity: 0, y: 6, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.35, ease: "easeOut" } },
};

/** Reveals a sentence word by word, like an answer being written. */
export function TextGenerate({ text, className = "" }: { text: string; className?: string }) {
  return (
    <m.span className={className} variants={wordContainer} initial="hidden" animate="show" aria-label={text}>
      {text.split(" ").map((w, i) => (
        <m.span key={`${w}-${i}`} variants={word} className="inline-block whitespace-pre" aria-hidden="true">
          {w}{" "}
        </m.span>
      ))}
    </m.span>
  );
}

const letters: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", visualDuration: 0.45, bounce: 0.35 } },
};

/** The verdict word landing letter by letter. */
export function LetterReveal({ text, className = "" }: { text: string; className?: string }) {
  return (
    <m.span className={`inline-flex ${className}`} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { delayChildren: stagger(0.05) } } }} aria-label={text}>
      {text.split("").map((ch, i) => (
        <m.span key={i} variants={letters} className="inline-block" aria-hidden="true">
          {ch}
        </m.span>
      ))}
    </m.span>
  );
}

/** A soft radial glow that follows the pointer over a card. Renders as a
 *  static glow when the pointer is not over it or motion is reduced. */
export function Spotlight({ color, className = "" }: { color: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    const parent = el.parentElement;
    if (!parent) return;
    const move = (ev: PointerEvent) => {
      const r = parent.getBoundingClientRect();
      el.style.setProperty("--spot-x", `${ev.clientX - r.left}px`);
      el.style.setProperty("--spot-y", `${ev.clientY - r.top}px`);
      el.style.setProperty("--spot-opacity", "1");
    };
    const leave = () => el.style.setProperty("--spot-opacity", "0.55");
    parent.addEventListener("pointermove", move);
    parent.addEventListener("pointerleave", leave);
    return () => {
      parent.removeEventListener("pointermove", move);
      parent.removeEventListener("pointerleave", leave);
    };
  }, [reduce]);
  return <span ref={ref} aria-hidden="true" className={`spotlight pointer-events-none absolute inset-0 ${className}`} style={{ "--spot-color": color } as CSSProperties} />;
}

/** Status node for a trace step: hollow, pulsing ring, check, or dashed. */
export function StatusDot({ status }: { status: "pending" | "running" | "done" | "skipped" }) {
  return (
    <span className="relative flex h-6 w-6 items-center justify-center">
      {status === "running" && <m.span className="absolute inset-0 rounded-full bg-blue-500/30" animate={{ scale: [1, 1.9, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />}
      <m.span
        layout
        className={`relative flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${
          status === "done"
            ? "border-emerald-500 bg-emerald-500"
            : status === "running"
              ? "border-blue-500 bg-blue-500"
              : status === "skipped"
                ? "border-dashed border-slate-400 bg-transparent"
                : "border-slate-300 bg-transparent dark:border-slate-600"
        }`}
        animate={status === "done" ? { scale: [1, 1.35, 1] } : { scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        {status === "done" && (
          <m.svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
            <m.path d="M5 12l5 5L20 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: "easeOut" }} />
          </m.svg>
        )}
      </m.span>
    </span>
  );
}
