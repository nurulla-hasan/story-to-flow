"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, LockKeyholeOpen } from "lucide-react";
import { cn } from "cn";

import { features, lockRows } from "./data";
import { Reveal } from "@/components/motion/reveal";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

const spring = { type: "spring", stiffness: 360, damping: 30 } as const;

export function FeaturesSection() {
  const [locked, setLocked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(lockRows.map((row) => [row.id, true]))
  );
  const reduce = usePrefersReducedMotion();

  const held = lockRows.filter((row) => locked[row.id]).length;

  const toggleLock = (id: string) => {
    setLocked((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <section id="features" className="scroll-mt-24">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-2xs font-semibold tracking-widest text-primary uppercase">
            Built for continuity
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything that keeps a series from drifting
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            A production plan is only useful if scene 40 still matches scene 1.
            Here is what holds the world together.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, featureIndex) => {
            const Icon = feature.icon;

            return (
              <Reveal
                key={feature.title}
                delay={featureIndex * 70}
                className={feature.wide ? "sm:col-span-2" : undefined}
              >
                <motion.article
                  whileHover={reduce ? undefined : { y: -6 }}
                  transition={spring}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-[border-color,box-shadow] duration-300 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  />

                  <motion.div
                    className="relative flex size-10 items-center justify-center rounded-xl bg-brand-subtle text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground"
                    whileHover={
                      reduce ? undefined : { rotate: -8, scale: 1.08 }
                    }
                    transition={{ type: "spring", stiffness: 300, damping: 16 }}
                  >
                    <Icon className="size-5" />
                  </motion.div>

                  {feature.wide ? (
                    <div className="relative mt-5 grid gap-6 sm:grid-cols-2 sm:items-start">
                      <div>
                        <h3 className="font-heading text-base font-semibold">
                          {feature.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>

                      <div className="rounded-xl border border-border bg-surface-subtle p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-3xs font-semibold tracking-widest text-muted-foreground uppercase">
                            Locked facts
                          </p>
                          <span
                            className={cn(
                              "font-mono text-3xs",
                              held === lockRows.length
                                ? "text-success"
                                : "text-warning"
                            )}
                          >
                            {held}/{lockRows.length} held
                          </span>
                        </div>

                        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-border">
                          <motion.div
                            initial={false}
                            animate={{ scaleX: held / lockRows.length }}
                            transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }}
                            className="h-full origin-left rounded-full bg-success"
                          />
                        </div>

                        <ul className="mt-2 divide-y divide-border">
                          {lockRows.map((row) => {
                            const RowIcon = row.icon;
                            const isLocked = locked[row.id];

                            return (
                              <li key={row.id}>
                                <button
                                  type="button"
                                  onClick={() => toggleLock(row.id)}
                                  aria-pressed={isLocked}
                                  className={cn(
                                    "flex w-full items-center gap-2.5 py-2 text-left transition-opacity duration-300",
                                    isLocked ? "opacity-100" : "opacity-60"
                                  )}
                                >
                                  <RowIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                  <span className="text-2xs font-medium">
                                    {row.label}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
                                    {row.value}
                                  </span>
                                  <span
                                    className={cn(
                                      "flex shrink-0 items-center gap-1 text-3xs",
                                      isLocked ? "text-success" : "text-warning"
                                    )}
                                  >
                                    <AnimatePresence
                                      initial={false}
                                      mode="wait"
                                    >
                                      <motion.span
                                        key={isLocked ? "held" : "open"}
                                        initial={
                                          reduce ? false : { opacity: 0, y: 4 }
                                        }
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={
                                          reduce ? undefined : { opacity: 0, y: -4 }
                                        }
                                        transition={{ duration: 0.16 }}
                                        className="flex items-center gap-1"
                                      >
                                        {isLocked ? "held" : "open"}
                                        {isLocked ? (
                                          <Lock className="size-3" />
                                        ) : (
                                          <LockKeyholeOpen className="size-3" />
                                        )}
                                      </motion.span>
                                    </AnimatePresence>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>

                        <p className="mt-1 text-3xs text-muted-foreground">
                          Tap a fact to release its lock.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="relative mt-5 font-heading text-base font-semibold">
                        {feature.title}
                      </h3>
                      <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
                        {feature.description}
                      </p>
                    </>
                  )}
                </motion.article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
