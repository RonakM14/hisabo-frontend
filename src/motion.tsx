import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type { Transition, Variants } from "motion/react";

/** Shared easing for entrances: fast start, soft landing. */
export const easeOut = [0.22, 1, 0.36, 1] as const;

/** Spring used by sliding indicators (nav highlight, month underline). */
export const navSpring: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 42,
};

/** Parent that staggers its `riseIn` children. */
export const staggerGroup: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** Child entrance: fade up into place. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};

/** Small grid cell entrance (calendar days). */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: easeOut } },
};

/**
 * Counts from the previous value to the next one. On first mount it counts
 * up from zero. Renders the final value directly when the user prefers
 * reduced motion.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (n) => format(n));
  const first = useRef(true);
  useEffect(() => {
    if (reduce) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: first.current ? 1.1 : 0.7,
      ease: easeOut,
    });
    first.current = false;
    return () => controls.stop();
  }, [value, reduce, motionValue]);
  if (reduce) return <span className={className}>{format(value)}</span>;
  return <motion.span className={className}>{display}</motion.span>;
}

/** Progress fill that grows from zero on mount and eases to new widths. */
export function AnimatedBar({
  percent,
  color,
  className,
}: {
  percent: number;
  color?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const width = `${Math.max(0, Math.min(100, percent))}%`;
  return (
    <motion.span
      className={className}
      initial={reduce ? false : { width: 0 }}
      animate={{ width }}
      transition={{ duration: 0.9, ease: easeOut }}
      style={{ background: color }}
    />
  );
}
