"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "cn";

import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import { styleOptions } from "./docs-data";

export function StyleDirectory() {
  const [selected, setSelected] = useState(styleOptions[0].id);
  const reduce = usePrefersReducedMotion();
  const active = styleOptions.find((style) => style.id === selected) ?? styleOptions[0];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className={cn("relative h-24 bg-linear-to-br", active.gradient)}>
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-card/70 via-transparent to-transparent" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={active.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="absolute bottom-3 left-4 rounded-full border border-border bg-card/85 px-3 py-1 font-heading text-sm font-semibold shadow-xs backdrop-blur-sm"
            >
              {active.name}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card p-4">
          <div>
            <p className="text-3xs font-semibold tracking-widest text-muted-foreground uppercase">
              Selected look
            </p>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              Best for · {active.bestFor}
            </p>
          </div>
          <p className="max-w-md text-2xs leading-relaxed text-muted-foreground">
            {active.description}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {styleOptions.map((style) => {
          const isSelected = style.id === selected;

          return (
            <motion.button
              key={style.id}
              type="button"
              onClick={() => setSelected(style.id)}
              aria-pressed={isSelected}
              whileHover={reduce ? undefined : { y: -3 }}
              whileTap={reduce ? undefined : { scale: 0.99 }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-4 text-left transition-colors duration-300",
                isSelected
                  ? "border-primary/40 bg-brand-subtle"
                  : "border-border bg-card hover:border-primary/25"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "size-8 shrink-0 rounded-lg bg-linear-to-br transition-transform duration-300 group-hover:scale-105",
                    style.gradient
                  )}
                />
                <span className="font-heading text-sm font-semibold">
                  {style.name}
                </span>

                {style.tag ? (
                  <span className="rounded-full bg-card px-2 py-0.5 text-3xs text-muted-foreground">
                    {style.tag}
                  </span>
                ) : null}

                <AnimatePresence initial={false}>
                  {isSelected ? (
                    <motion.span
                      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={reduce ? undefined : { scale: 0.6, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 22 }}
                      className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Check className="size-3" />
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>

              <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
                {style.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
