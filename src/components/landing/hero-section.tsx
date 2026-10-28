"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { useEffect, useState } from "react";
import { motion, useSpring } from "motion/react";
import {
  ArrowRight,
  Check,
  Clapperboard,
  Lock,
  MousePointerClick,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { scenes } from "./data";
import { Reveal } from "@/components/motion/reveal";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];
const spring = { type: "spring", stiffness: 380, damping: 32 } as const;

export function HeroSection() {
  const [active, setActive] = useState(2);
  const [paused, setPaused] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const reduce = usePrefersReducedMotion();
  const scene = scenes[active];

  const rotateX = useSpring(0, { stiffness: 160, damping: 18 });
  const rotateY = useSpring(0, { stiffness: 160, damping: 18 });

  useEffect(() => {
    if (paused || reduce) return;

    const timer = window.setTimeout(() => {
      setActive((current) => (current + 1) % scenes.length);
    }, 7500);

    return () => window.clearTimeout(timer);
  }, [active, paused, reduce]);

  const selectScene = (index: number) => {
    setActive(index);
    setRunKey((key) => key + 1);
  };

  const handleTilt = (event: PointerEvent<HTMLDivElement>) => {
    if (reduce) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;

    rotateY.set(px * 7);
    rotateX.set(-py * 5);
  };

  const resetTilt = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute -top-40 inset-x-0 mx-auto h-96 w-160 rounded-full bg-primary/15 blur-3xl"
          animate={
            reduce ? undefined : { x: [0, 18, 0], y: [0, -14, 0], scale: [1, 1.06, 1] }
          }
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-40 -right-20 h-80 w-80 rounded-full bg-info/10 blur-3xl"
          animate={reduce ? undefined : { y: [0, -14, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 -left-20 h-72 w-72 rounded-full bg-warning/10 blur-3xl"
          animate={
            reduce ? undefined : { x: [0, 18, 0], y: [0, -14, 0], scale: [1, 1.06, 1] }
          }
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-subtle px-3 py-1 text-2xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              Deterministic prompt compiler
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
              </span>
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 font-heading text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              From one story to a{" "}
              <span className="bg-linear-to-r from-primary via-info to-primary bg-clip-text text-transparent">
                consistent
              </span>{" "}
              video series.
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Story to Flow builds a Story Bible that locks faces, voices, and
              locations — then compiles every Google Flow prompt in code, so
              scene 40 still looks like scene 1.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <motion.div
                whileHover={reduce ? undefined : { y: -2 }}
                whileTap={reduce ? undefined : { scale: 0.98 }}
                transition={spring}
              >
                <Button size="lg" nativeButton={false} render={<Link href="/studio" />}>
                  Start creating
                  <ArrowRight
                    data-icon="inline-end"
                    className="transition-transform duration-300 group-hover/button:translate-x-1"
                  />
                </Button>
              </motion.div>
              <motion.div
                whileHover={reduce ? undefined : { y: -2 }}
                whileTap={reduce ? undefined : { scale: 0.98 }}
                transition={spring}
              >
                <Button
                  size="lg"
                  variant="outline"
                  nativeButton={false}
                  render={<a href="#workflow" />}
                >
                  <Play data-icon="inline-start" />
                  See how it works
                </Button>
              </motion.div>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-2xs text-muted-foreground">
              {[
                "No prompt drift",
                "No re-explaining characters",
                "One-click export",
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={200} className="relative mx-auto w-full max-w-xl">
          <motion.div
            aria-hidden
            className="absolute -inset-3 rounded-4xl bg-linear-to-br from-primary/25 via-transparent to-info/25 blur-2xl"
            animate={
              reduce ? undefined : { opacity: [0.55, 0.9, 0.55], scale: [1, 1.03, 1] }
            }
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.div
            onPointerMove={handleTilt}
            onPointerLeave={resetTilt}
            onPointerCancel={resetTilt}
            style={{ rotateX, rotateY, transformPerspective: 1100 }}
            className="relative"
          >
            <div
              className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-foreground/10"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocusCapture={() => setPaused(true)}
              onBlurCapture={() => setPaused(false)}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-subtle px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 rounded-full bg-destructive/70" />
                  <span className="size-2.5 rounded-full bg-warning/70" />
                  <span className="size-2.5 rounded-full bg-success/70" />
                  <span className="ml-2 truncate font-mono text-2xs text-muted-foreground">
                    scene-{scene.number}.prompt
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-2 py-0.5 text-3xs font-medium text-primary">
                    <Lock className="size-3" />
                    {scene.locks.length} locks
                  </span>
                  <motion.button
                    type="button"
                    onClick={() => setRunKey((key) => key + 1)}
                    whileHover={reduce ? undefined : { rotate: -90 }}
                    whileTap={reduce ? undefined : { scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                    aria-label="Recompile this prompt"
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw className="size-3.5" />
                  </motion.button>
                </div>
              </div>

              <div className="grid gap-4 p-4 sm:grid-cols-5">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-3xs font-semibold tracking-widest text-muted-foreground uppercase">
                      Scene plan
                    </p>
                    <span className="flex items-center gap-1 text-3xs text-muted-foreground">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          paused ? "bg-muted-foreground" : "bg-success animate-pulse"
                        )}
                      />
                      {paused ? "paused" : "auto"}
                    </span>
                  </div>

                  <ul className="mt-3 space-y-1.5">
                    {scenes.map((item, index) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => selectScene(index)}
                          aria-pressed={active === index}
                          className={cn(
                            "relative flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-2xs transition-colors duration-200",
                            active === index
                              ? "text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {active === index ? (
                            <motion.span
                              layoutId="hero-active-scene"
                              transition={spring}
                              className="absolute inset-0 rounded-lg border border-brand-border bg-brand-subtle"
                            />
                          ) : null}
                          <span className="relative font-mono text-3xs text-muted-foreground">
                            {item.number}
                          </span>
                          <span className="relative truncate">{item.title}</span>
                          <Lock
                            className={cn(
                              "relative ml-auto size-3 shrink-0 transition-colors",
                              active === index ? "text-primary" : "text-success/80"
                            )}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-3 flex items-center gap-1.5 text-3xs text-muted-foreground">
                    <MousePointerClick className="size-3" />
                    Click a scene to recompile
                  </p>
                </div>

                <div className="sm:col-span-3">
                  <motion.div
                    key={`${scene.id}-${runKey}`}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: easeOut }}
                    className="rounded-2xl border border-border bg-surface-subtle p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-3xs font-semibold tracking-widest text-muted-foreground uppercase">
                        Compiled prompt
                      </p>
                      <span className="flex items-center gap-1 font-mono text-3xs text-success">
                        <Check className="size-3" />
                        verified
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {scene.locks.map((lock, index) => {
                        const LockIcon = lock.icon;

                        return (
                          <motion.span
                            key={`${lock.label}-${index}`}
                            initial={reduce ? false : { opacity: 0, y: 6, scale: 0.94 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                              duration: 0.4,
                              delay: reduce ? 0 : index * 0.07,
                              ease: easeOut,
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-2xs text-muted-foreground"
                          >
                            <LockIcon className="size-3 text-primary" />
                            {lock.label}
                          </motion.span>
                        );
                      })}
                    </div>

                    <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-border">
                      <motion.div
                        key={`bar-${scene.id}-${runKey}`}
                        initial={reduce ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.7, ease: easeOut }}
                        className="h-full origin-left rounded-full bg-linear-to-r from-primary to-info"
                      />
                    </div>

                    <motion.p
                      key={`prompt-${scene.id}-${runKey}`}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: reduce ? 0 : 0.12 }}
                      className="mt-3 font-mono text-2xs leading-relaxed text-muted-foreground"
                    >
                      {scene.prompt}
                    </motion.p>
                  </motion.div>

                  <motion.div
                    key={`continuity-${scene.id}`}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: easeOut }}
                    className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2"
                  >
                    <Clapperboard className="size-4 shrink-0 text-primary" />
                    <p className="truncate text-2xs text-muted-foreground">
                      {scene.continuity}
                    </p>
                    <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                  </motion.div>
                </div>
              </div>
            </div>

            <motion.div
              className="absolute -right-4 -bottom-5 hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-2xs shadow-lg shadow-foreground/10 sm:flex"
              animate={reduce ? undefined : { y: [0, -8, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            >
              <ShieldCheck className="size-4 text-success" />
              <span className="text-muted-foreground">
                Zero hallucinated locks
              </span>
            </motion.div>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}
