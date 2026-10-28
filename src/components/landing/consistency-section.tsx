"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CirclePlay,
  Pause,
  Play,
  Repeat2,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { benefits, chainFrames } from "./data";
import { Reveal } from "@/components/motion/reveal";
import { useAutoRotate } from "@/components/motion/use-auto-rotate";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];
const spring = { type: "spring", stiffness: 380, damping: 32 } as const;

export function ConsistencySection() {
  const [playing, setPlaying] = useState(true);
  const reduce = usePrefersReducedMotion();
  const { index, setIndex } = useAutoRotate(
    chainFrames.length,
    2800,
    playing && !reduce
  );

  return (
    <section id="consistency" className="scroll-mt-24">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <Reveal>
          <p className="text-2xs font-semibold tracking-widest text-success uppercase">
            Chained by design
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Scene 12 ends exactly where scene 13 begins.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Instead of guessing at continuity, the plan hands the last frame of
            one clip to the next scene as its starting reference — the same
            wardrobe, the same light, the same world.
          </p>

          <ul className="mt-6 space-y-3">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success-subtle">
                  <Check className="size-3 text-success" />
                </span>
                <span className="text-sm text-muted-foreground">{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Button variant="outline" nativeButton={false} render={<Link href="/studio" />}>
              Try a chained plan
              <ArrowRight
                data-icon="inline-end"
                className="transition-transform duration-300 group-hover/button:translate-x-1"
              />
            </Button>
          </div>
        </Reveal>

        <Reveal delay={120} className="relative">
          <motion.div
            aria-hidden
            className="absolute -inset-3 rounded-4xl bg-linear-to-br from-success/15 via-transparent to-info/20 blur-2xl"
            animate={
              reduce ? undefined : { opacity: [0.5, 0.85, 0.5], scale: [1, 1.03, 1] }
            }
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative">
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
              <span className="flex items-center gap-2 text-2xs font-medium text-muted-foreground">
                <Repeat2
                  className={cn("size-4", playing ? "text-success" : "text-muted-foreground")}
                />
                Continuity chain
              </span>
              <span className="flex items-center gap-1.5 text-3xs text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    playing ? "bg-success animate-pulse" : "bg-muted-foreground"
                  )}
                />
                {playing ? "chaining" : "paused"}
              </span>
            </div>

            <div className="space-y-1">
              {chainFrames.map((frame, frameIndex) => {
                const isActive = frameIndex === index;

                return (
                  <div key={frame.id}>
                    <button
                      type="button"
                      onClick={() => setIndex(frameIndex)}
                      aria-pressed={isActive}
                      className={cn(
                        "relative flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition-colors duration-300",
                        isActive
                          ? "border-transparent"
                          : "border-border bg-card/80 hover:border-primary/30 hover:bg-card"
                      )}
                    >
                      {isActive ? (
                        <motion.span
                          layoutId="chain-active-frame"
                          transition={spring}
                          className="absolute inset-0 rounded-2xl border border-primary/50 bg-card shadow-lg shadow-primary/10"
                        />
                      ) : null}

                      <div
                        className={cn(
                          "relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl border border-border bg-linear-to-br",
                          frame.gradient
                        )}
                      >
                        <span className="absolute inset-0 flex items-center justify-center">
                          <motion.span
                            animate={
                              isActive && !reduce ? { scale: [1, 1.12, 1] } : { scale: 1 }
                            }
                            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                            className="flex size-7 items-center justify-center rounded-full bg-card/80 text-foreground backdrop-blur-sm"
                          >
                            {isActive ? (
                              <CirclePlay className="size-3.5 text-primary" />
                            ) : (
                              <Play className="size-3" />
                            )}
                          </motion.span>
                        </span>

                        <span className="absolute top-1.5 left-1.5 rounded bg-card/80 px-1 py-0.5 font-mono text-3xs text-muted-foreground">
                          {frame.timecode}
                        </span>

                        {isActive && !reduce ? (
                          <motion.span
                            aria-hidden
                            className="absolute inset-x-0 h-px bg-primary/80"
                            animate={{
                              top: ["12%", "88%", "12%"],
                              opacity: [0, 1, 1, 0],
                            }}
                            transition={{
                              duration: 2.4,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        ) : null}
                      </div>

                      <div className="relative min-w-0">
                        <p className="text-2xs font-semibold tracking-widest text-muted-foreground uppercase">
                          {frame.label}
                        </p>
                        <p className="mt-1 truncate text-sm">{frame.caption}</p>
                        <AnimatePresence initial={false}>
                          {isActive ? (
                            <motion.span
                              key="continuity-lock"
                              initial={reduce ? false : { opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={reduce ? undefined : { opacity: 0, y: -4 }}
                              transition={{ duration: 0.22, ease: easeOut }}
                              className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-subtle px-2 py-0.5 text-3xs font-medium text-primary"
                            >
                              <Repeat2 className="size-3" />
                              continuity lock
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </div>

                      <AnimatePresence initial={false}>
                        {isActive ? (
                          <motion.span
                            key="active-arrow"
                            initial={reduce ? false : { opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={reduce ? undefined : { opacity: 0, x: -4 }}
                            transition={{ duration: 0.2 }}
                            className="relative ml-auto hidden shrink-0 sm:block"
                          >
                            <ArrowRight className="size-4 text-muted-foreground" />
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </button>

                    {frameIndex < chainFrames.length - 1 ? (
                      <div className="flex justify-center py-0.5">
                        <ArrowDown
                          className={cn(
                            "size-3.5 transition-colors duration-300",
                            index > frameIndex ? "text-primary" : "text-muted-foreground/40"
                          )}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <motion.button
                type="button"
                onClick={() => setPlaying((value) => !value)}
                whileHover={reduce ? undefined : { scale: 1.08 }}
                whileTap={reduce ? undefined : { scale: 0.92 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                aria-label={playing ? "Pause chain preview" : "Play chain preview"}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </motion.button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between font-mono text-3xs text-muted-foreground">
                  <span>{chainFrames[index].timecode}</span>
                  <span>frame chain</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border">
                  <motion.div
                    initial={false}
                    animate={{ scaleX: (index + 1) / chainFrames.length }}
                    transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }}
                    className="h-full origin-left rounded-full bg-linear-to-r from-primary via-info to-success"
                  />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
