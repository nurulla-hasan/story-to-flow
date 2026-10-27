"use client";

import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import { guideSteps } from "./docs-data";

export function WorkflowGuide() {
  const reduce = usePrefersReducedMotion();

  return (
    <ol className="space-y-1">
      {guideSteps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === guideSteps.length - 1;

        return (
          <li key={step.title} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-subtle font-mono text-2xs font-semibold text-primary">
                0{index + 1}
              </span>
              {!isLast ? (
                <motion.span
                  aria-hidden
                  initial={reduce ? false : { scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                  className="my-1 w-px flex-1 origin-top bg-linear-to-b from-brand-border to-border"
                />
              ) : null}
            </div>

            <motion.div
              whileHover={reduce ? undefined : { x: 3 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className={isLast ? "flex-1 pb-0" : "flex-1 pb-4"}
            >
              <div className="rounded-2xl border border-border bg-surface-subtle p-4 transition-colors duration-300 hover:border-primary/30 hover:bg-card sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-xs">
                    <Icon className="size-4.5" />
                  </span>

                  <div className="min-w-0">
                    <h3 className="font-heading text-sm font-semibold sm:text-base">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {step.body}
                    </p>

                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-3xs text-muted-foreground">
                      you get
                      <ArrowRight className="size-3 text-primary" />
                      <span className="text-foreground">{step.artifact}</span>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </li>
        );
      })}
    </ol>
  );
}
