"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import { DocsPipeline } from "./docs-pipeline";
import { docsMeta } from "./docs-data";

export function DocsHero() {
  const reduce = usePrefersReducedMotion();

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute -top-32 inset-x-0 mx-auto h-80 w-160 rounded-full bg-primary/15 blur-3xl"
          animate={
            reduce ? undefined : { x: [0, 16, 0], y: [0, -12, 0], scale: [1, 1.05, 1] }
          }
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-24 top-20 h-72 w-72 rounded-full bg-info/10 blur-3xl"
          animate={reduce ? undefined : { y: [0, -14, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center justify-between gap-12 px-6 py-16 lg:grid-cols-2 lg:py-20">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-subtle px-3 py-1 text-2xs font-medium text-primary">
              <BookOpen className="size-3.5" />
              Documentation
              <span className="h-3 w-px bg-brand-border" />
              <span className="font-mono">Master Prompt v1.5.8</span>
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 max-w-xl font-heading text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              Everything you need to ship a{" "}
              <span className="bg-linear-to-r from-primary via-info to-primary bg-clip-text text-transparent">
                consistent
              </span>{" "}
              series.
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Workflow guides, visual direction notes, Cartesia voiceover tips,
              and the Google Flow hand-off rules — in the order you actually use
              them.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" nativeButton={false} render={<Link href="/studio" />}>
                Open studio
                <ArrowRight
                  data-icon="inline-end"
                  className="transition-transform duration-300 group-hover/button:translate-x-1"
                />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="/" />}
              >
                <Sparkles data-icon="inline-start" />
                Back to overview
              </Button>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200} className="relative mx-auto w-full max-w-md">
          <motion.div
            aria-hidden
            className="absolute -inset-3 rounded-4xl bg-linear-to-br from-primary/20 via-transparent to-info/20 blur-2xl"
            animate={
              reduce ? undefined : { opacity: [0.5, 0.85, 0.5], scale: [1, 1.03, 1] }
            }
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative">
            <DocsPipeline />
          </div>
        </Reveal>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 pb-10">
        <Reveal delay={280}>
          <ul className="grid gap-3 border-t border-border pt-6 text-2xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            {docsMeta.map((item) => {
              const Icon = item.icon;

              return (
                <li key={item.label} className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-primary" />
                  {item.label}
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
