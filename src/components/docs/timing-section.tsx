"use client";

import { useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useTransform,
} from "motion/react";
import { Check, Pause, Play } from "lucide-react";

import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

const NARRATION_MS = 6400;

export function TimingSection() {
  const [playing, setPlaying] = useState(true);
  const reduce = usePrefersReducedMotion();
  const playhead = useMotionValue(0);
  const position = useTransform(playhead, (value) => `${value * 100}%`);
  const holdOpacity = useTransform(playhead, [0.62, 0.63], [0.4, 1]);

  useAnimationFrame((_, delta) => {
    if (!playing || reduce) return;

    const next = playhead.get() + delta / NARRATION_MS;
    playhead.set(next >= 1 ? 0 : next);
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface-subtle p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-3xs font-semibold tracking-widest text-muted-foreground uppercase">
            Timeline preview
          </p>
          <motion.button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            whileHover={reduce ? undefined : { scale: 1.06 }}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            transition={{ type: "spring", stiffness: 340, damping: 20 }}
            aria-label={
              playing ? "Pause timeline preview" : "Play timeline preview"
            }
            className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
          </motion.button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between font-mono text-3xs text-muted-foreground">
              <span>Voiceover · 6.4s</span>
              <span>0:00 → 0:06.4</span>
            </div>
            <div className="relative mt-1.5 h-6 overflow-hidden rounded-lg bg-card">
              <div className="h-full w-full bg-linear-to-r from-primary/70 to-info/70" />
              {!reduce ? (
                <motion.span
                  aria-hidden
                  style={{ left: position }}
                  className="absolute inset-y-0 w-px bg-background/80"
                />
              ) : null}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between font-mono text-3xs text-muted-foreground">
              <span>Flow output</span>
              <span>4.0s clip + hold</span>
            </div>
            <div className="relative mt-1.5 grid h-6 grid-cols-8 gap-px overflow-hidden rounded-lg bg-border">
              <div className="col-span-5 flex items-center justify-center bg-info-subtle text-3xs font-medium text-info-subtle-foreground">
                video
              </div>
              <motion.div
                style={{ opacity: reduce ? 1 : holdOpacity }}
                className="col-span-3 flex items-center justify-center bg-warning-subtle text-3xs font-medium text-warning-foreground"
              >
                freeze frame
              </motion.div>
              {!reduce ? (
                <motion.span
                  aria-hidden
                  style={{ left: position }}
                  className="absolute inset-y-0 w-px bg-background/80"
                />
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-3 text-3xs leading-relaxed text-muted-foreground">
          When the narration runs longer than the clip, the plan holds the final
          frame to fill the gap — the voiceover is never cut or rushed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-3xs font-semibold tracking-widest text-muted-foreground uppercase">
            Calibration rate
          </p>
          <p className="mt-2 font-heading text-lg font-semibold">
            ~2.4 words / second
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
            Roughly 140–145 spoken Bengali words per minute, used to derive
            continuous, non-overlapping timecodes starting at 0:00.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-3xs font-semibold tracking-widest text-muted-foreground uppercase">
            The 4.0-second rule
          </p>
          <ul className="mt-2 space-y-2 text-2xs leading-relaxed text-muted-foreground">
            {[
              "Every Flow hero clip is exactly 4.0 seconds.",
              "Longer narration adds a freeze or a complementary still.",
              "Timing is planned before generation, not fixed after.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 size-3 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
