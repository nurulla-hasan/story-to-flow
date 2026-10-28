"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
} from "motion/react";
import {
  Check,
  Download,
  FileArchive,
  FileBraces,
  FileText,
  Lock,
  PackageCheck,
  ScanFace,
} from "lucide-react";
import { cn } from "cn";

import { lockRows, workflowSteps } from "./data";
import { Reveal } from "@/components/motion/reveal";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];
const spring = { type: "spring", stiffness: 380, damping: 32 } as const;

const exportFiles = [
  {
    icon: FileText,
    name: "prompts.txt",
    detail: "42 scene prompts · 18 KB",
  },
  {
    icon: FileBraces,
    name: "plan.json",
    detail: "Story Bible + shot list · 64 KB",
  },
  {
    icon: FileArchive,
    name: "assets.zip",
    detail: "Prompts and references · 3.2 MB",
  },
];

export function WorkflowSection() {
  const reduce = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useMotionValue(0);
  const progressRef = useRef(0);
  const active = workflowSteps[index];

  const goTo = (next: number) => {
    progressRef.current = 0;
    progress.set(0);
    setIndex(next);
  };

  useAnimationFrame((_, delta) => {
    if (paused || reduce) return;

    const next = progressRef.current + delta / 6000;

    if (next >= 1) {
      goTo((index + 1) % workflowSteps.length);
      return;
    }

    progressRef.current = next;
    progress.set(next);
  });

  return (
    <section
      id="workflow"
      className="scroll-mt-24 border-y border-border bg-surface-subtle"
    >
      <div className="mx-auto w-full max-w-7xl px-6 py-20 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-2xs font-semibold tracking-widest text-info uppercase">
            Three moves
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Story in. Plan out.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            No prompt engineering marathon. Lock the world once, then let the
            compiler do the repetitive part.
          </p>
        </Reveal>

        <Reveal
          delay={100}
          className="mt-12 grid gap-4 lg:grid-cols-5 lg:items-start"
        >
          <div
            className="space-y-3 lg:col-span-2"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            {workflowSteps.map((step, stepIndex) => {
              const Icon = step.icon;
              const isActive = stepIndex === index;

              return (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => goTo(stepIndex)}
                  aria-pressed={isActive}
                  className={cn(
                    "group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-colors duration-300",
                    isActive
                      ? "border-transparent"
                      : "border-border bg-card/60 hover:bg-card"
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="workflow-active-step"
                      transition={spring}
                      className="absolute inset-0 rounded-2xl border border-primary/40 bg-card shadow-lg shadow-primary/5"
                    />
                  ) : null}

                  <div className="relative flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-info-subtle text-info-subtle-foreground"
                      )}
                    >
                      <Icon className="size-4.5" />
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-3xs text-muted-foreground">
                          0{stepIndex + 1}
                        </span>
                        <h3 className="font-heading text-sm font-semibold">
                          {step.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {isActive ? (
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-border">
                      <motion.div
                        style={{ scaleX: progress }}
                        className="h-full origin-left bg-linear-to-r from-primary to-info"
                      />
                    </div>
                  ) : null}
                </button>
              );
            })}

            <p className="flex items-center gap-1.5 px-1 text-3xs text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  paused ? "bg-muted-foreground" : "bg-success animate-pulse"
                )}
              />
              {paused ? "Paused — pick a step" : "Auto-advancing · hover to pause"}
            </p>
          </div>

          <div
            className="lg:col-span-3"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-subtle px-4 py-3">
                <span className="flex items-center gap-2 text-2xs font-medium">
                  <span className="size-1.5 rounded-full bg-success animate-pulse" />
                  Live preview
                </span>
                <span className="font-mono text-3xs text-muted-foreground">
                  step {index + 1}/3 · {active.meta}
                </span>
              </div>

              <div className="min-h-80 overflow-hidden p-4">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={active.preview}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: reduce ? 0 : 0.28, ease: easeOut }}
                  >
                    {active.preview === "story" ? <StoryPreview /> : null}
                    {active.preview === "locks" ? <LocksPreview /> : null}
                    {active.preview === "export" ? <ExportPreview /> : null}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StoryPreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-2xs font-medium">
          <FileText className="size-4 text-primary" />
          story.txt
        </span>
        <span className="rounded-full bg-info-subtle px-2 py-0.5 text-3xs text-info-subtle-foreground">
          1,204 words
        </span>
      </div>

      <div className="rounded-xl border border-border bg-surface-subtle p-4">
        <p className="font-bangla text-sm leading-relaxed text-muted-foreground">
          বর্ষা তিন দিন ধরে থামেনি। রিনা তবু দোকান খুলে রেখেছিল, টিফিন বাক্সগুলো
          গুনছিল যেন কিছুই বদলায়নি।
        </p>
        <p className="mt-3 font-mono text-2xs leading-relaxed text-muted-foreground">
          The monsoon had not stopped for three days. Rina kept the shop open
          anyway, counting tiffin boxes as if nothing had changed.
          <span className="ml-1 inline-block h-3 w-1.5 animate-pulse rounded-xs bg-primary align-middle" />
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 text-3xs">
        {["Bengali + English", "12 scenes", "4 characters", "6 locations"].map(
          (chip) => (
            <span
              key={chip}
              className="rounded-full border border-border bg-surface-subtle px-2 py-1 text-muted-foreground"
            >
              {chip}
            </span>
          )
        )}
      </div>

      <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-2xs text-muted-foreground">
        <ScanFace className="size-4 text-primary" />
        Detecting cast, wardrobe, and voice tone…
      </p>
    </div>
  );
}

function LocksPreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-2xs font-medium">
          <Lock className="size-4 text-primary" />
          story-bible.lock
        </span>
        <span className="rounded-full bg-success-subtle px-2 py-0.5 text-3xs text-success">
          3 verified
        </span>
      </div>

      <ul className="space-y-2">
        {lockRows.map((row, index) => {
          const Icon = row.icon;

          return (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-2.5 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-primary">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-medium">{row.label}</p>
                <p className="truncate text-3xs text-muted-foreground">
                  {row.value}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-3xs text-success">
                <Check className="size-3" />
                locked
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-3xs leading-relaxed text-muted-foreground">
        Every downstream prompt now references these exact facts, inserted
        verbatim by the compiler.
      </p>
    </div>
  );
}

function ExportPreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-2xs font-medium">
          <Download className="size-4 text-primary" />
          production-package
        </span>
        <span className="rounded-full bg-brand-subtle px-2 py-0.5 text-3xs text-primary">
          ready
        </span>
      </div>

      <ul className="space-y-2">
        {exportFiles.map((file, index) => {
          const Icon = file.icon;

          return (
            <li
              key={file.name}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface-subtle px-3 py-2.5 transition-colors duration-300 hover:border-primary/30 hover:bg-card animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-info-subtle text-info-subtle-foreground">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-medium">{file.name}</p>
                <p className="truncate text-3xs text-muted-foreground">
                  {file.detail}
                </p>
              </div>
              <Download className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-y-0.5" />
            </li>
          );
        })}
      </ul>

      <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-2xs text-muted-foreground">
        <PackageCheck className="size-4 text-success" />
        All three formats generated · 42 prompts
      </p>
    </div>
  );
}
