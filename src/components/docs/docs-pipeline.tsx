"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, Clapperboard, FileText, ListChecks } from "lucide-react";
import { cn } from "cn";

import { useAutoRotate } from "@/components/motion/use-auto-rotate";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

const artifacts = [
  {
    icon: FileText,
    name: "story.txt",
    meta: "1,204 words · Bengali + English",
    status: "input",
  },
  {
    icon: ListChecks,
    name: "plan.json",
    meta: "12 scenes · 4 characters · 6 locations",
    status: "compiled",
  },
  {
    icon: Clapperboard,
    name: "prompts.txt",
    meta: "42 prompts · 4.0s hero clips",
    status: "ready",
  },
];

const spring = { type: "spring", stiffness: 380, damping: 32 } as const;

export function DocsPipeline() {
  const reduce = usePrefersReducedMotion();
  const [hovered, setHovered] = useState(false);
  const { index, setIndex } = useAutoRotate(artifacts.length, 2800, !reduce && !hovered);
  const active = artifacts[index];

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
      className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-foreground/10"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-subtle px-4 py-3">
        <span className="flex items-center gap-2 text-2xs font-medium text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              hovered ? "bg-muted-foreground" : "bg-success animate-pulse"
            )}
          />
          Pipeline preview
        </span>
        <span className="font-mono text-3xs text-muted-foreground">
          step {index + 1}/3
        </span>
      </div>

      <ul className="space-y-1 p-3">
        {artifacts.map((item, itemIndex) => {
          const Icon = item.icon;
          const isActive = itemIndex === index;

          return (
            <li key={item.name}>
              <button
                type="button"
                onClick={() => setIndex(itemIndex)}
                aria-pressed={isActive}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="docs-pipeline-active"
                    transition={spring}
                    className="absolute inset-0 rounded-xl border border-brand-border bg-brand-subtle"
                  />
                ) : null}

                <span
                  className={cn(
                    "relative flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </span>

                <span className="relative min-w-0 flex-1">
                  <span className="block truncate font-mono text-2xs text-foreground">
                    {item.name}
                  </span>
                  <span className="block truncate text-3xs text-muted-foreground">
                    {item.meta}
                  </span>
                </span>

                <AnimatePresence initial={false}>
                  {isActive ? (
                    <motion.span
                      key="status"
                      initial={reduce ? false : { opacity: 0, x: 4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reduce ? undefined : { opacity: 0, x: 4 }}
                      transition={{ duration: 0.2 }}
                      className="relative shrink-0 rounded-full bg-card px-2 py-0.5 text-3xs text-success"
                    >
                      {item.status}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2 border-t border-border bg-surface-subtle px-4 py-3">
        <CircleCheck className="size-3.5 shrink-0 text-success" />
        <p className="text-3xs text-muted-foreground">
          The same locked facts appear in all three files.
        </p>
      </div>

      <span className="sr-only" aria-live="polite">
        {active.name} selected
      </span>
    </div>
  );
}
