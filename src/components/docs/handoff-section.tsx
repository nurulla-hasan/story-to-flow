"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Film, Mic, Repeat2 } from "lucide-react";

import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import { flowTips, sampleNarration, voiceTips } from "./docs-data";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(area);
      return copied;
    } catch {
      return false;
    }
  }
}

export function HandoffSection() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const copySample = async () => {
    const copiedToClipboard = await copyText(sampleNarration);
    setCopied(copiedToClipboard);

    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand-subtle text-primary">
            <Mic className="size-4" />
          </span>
          <div>
            <h3 className="font-heading text-sm font-semibold">Cartesia TTS</h3>
            <p className="text-3xs text-muted-foreground">Voiceover hand-off</p>
          </div>
        </div>

        <ul className="mt-3 space-y-2 text-2xs leading-relaxed text-muted-foreground">
          {voiceTips.map((tip) => (
            <li key={tip} className="flex items-start gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
              {tip}
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-xl border border-border bg-surface-subtle p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-3xs font-semibold tracking-widest text-muted-foreground uppercase">
              Sample line
            </p>
            <button
              type="button"
              onClick={copySample}
              className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-3xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  key={copied ? "copied" : "copy"}
                  initial={reduce ? false : { opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -3 }}
                  transition={{ duration: 0.16 }}
                  className="flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="size-3 text-success" />
                      copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      copy
                    </>
                  )}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>

          <p className="mt-2 font-bangla text-sm leading-relaxed text-muted-foreground">
            {sampleNarration}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-info-subtle text-info-subtle-foreground">
            <Film className="size-4" />
          </span>
          <div>
            <h3 className="font-heading text-sm font-semibold">Google Flow</h3>
            <p className="text-3xs text-muted-foreground">
              Image and video generation
            </p>
          </div>
        </div>

        <ul className="mt-3 space-y-2 text-2xs leading-relaxed text-muted-foreground">
          {flowTips.map((tip) => (
            <li key={tip} className="flex items-start gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-info" />
              {tip}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-dashed border-border p-3">
          <Repeat2 className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-2xs leading-relaxed text-muted-foreground">
            Finished a clip? Pull its last frame into the next scene as the
            reference. Continuity is a hand-off, not a re-roll.
          </p>
        </div>
      </div>
    </div>
  );
}
