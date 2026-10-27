"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

const spring = { type: "spring", stiffness: 320, damping: 18 } as const;

export function CtaSection() {
  const reduce = usePrefersReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const spotX = useSpring(pointerX, { stiffness: 140, damping: 22 });
  const spotY = useSpring(pointerY, { stiffness: 140, damping: 22 });
  const spotlight = useMotionTemplate`radial-gradient(30rem circle at ${spotX}px ${spotY}px, color-mix(in oklab, var(--primary) 24%, transparent), transparent 70%)`;

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduce) return;

    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(event.clientX - rect.left);
    pointerY.set(event.clientY - rect.top);
  };

  return (
    <section className="px-6 pb-20 lg:pb-28">
      <Reveal className="relative mx-auto max-w-5xl">
        <div
          onPointerMove={handleMove}
          className="group relative overflow-hidden rounded-4xl border border-brand-border bg-linear-to-br from-primary/15 via-card to-info/15 px-6 py-16 text-center sm:px-12"
        >
          <motion.div
            aria-hidden
            style={{ background: spotlight }}
            className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-100"
          />

          <div aria-hidden className="pointer-events-none absolute inset-0">
            <motion.div
              className="absolute -top-24 inset-x-0 mx-auto h-64 w-96 rounded-full bg-primary/20 blur-3xl"
              animate={
                reduce ? undefined : { x: [0, 18, 0], y: [0, -14, 0], scale: [1, 1.06, 1] }
              }
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -right-16 -bottom-24 h-64 w-64 rounded-full bg-info/20 blur-3xl"
              animate={reduce ? undefined : { y: [0, -12, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.span
              className="absolute top-10 left-10"
              animate={reduce ? undefined : { y: [0, -10, 0], rotate: [0, 12, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="size-6 text-primary/30" />
            </motion.span>
            <motion.span
              className="absolute right-16 bottom-12"
              animate={reduce ? undefined : { y: [0, -8, 0], rotate: [0, -10, 0] }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.4,
              }}
            >
              <Sparkles className="size-4 text-info/40" />
            </motion.span>
          </div>

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-card/70 px-3 py-1 text-2xs font-medium text-primary backdrop-blur-sm">
              <Sparkles className="size-3.5" />
              One story is all it takes
            </span>

            <h2 className="mt-5 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Your next series starts with one story.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Paste it in, lock the world, and export scene-by-scene prompts in
              minutes instead of weekends.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
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
                  render={<Link href="/docs" />}
                >
                  Read the docs
                </Button>
              </motion.div>
            </div>

            <p className="mt-6 text-2xs text-muted-foreground">
              No account needed · Your drafts stay local · Bring your own model
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
