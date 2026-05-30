"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function AnimatedSizePresence({
  children,
  className,
  id,
  marginTop = 0,
  visible,
}: {
  children: ReactNode;
  className?: string;
  id: string;
  marginTop?: number;
  visible: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const sizeTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: "easeInOut" as const };
  const fadeTransition = { duration: shouldReduceMotion ? 0 : 0.12 };

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          className={["animatedSizeSlot", className].filter(Boolean).join(" ")}
          key={id}
          initial={shouldReduceMotion ? false : { height: 0, marginTop: 0, opacity: 0 }}
          animate={{ height: "auto", marginTop, opacity: 1 }}
          exit={{ height: 0, marginTop: 0, opacity: 0 }}
          transition={{
            height: sizeTransition,
            marginTop: sizeTransition,
            opacity: fadeTransition,
          }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
