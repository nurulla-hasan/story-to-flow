"use client";

import * as React from "react";
import Image from "next/image";
import {
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/apiClient";
import { isFlowExtensionInstalled, sendToFlow } from "@/lib/flowBridge";
import { cn } from "cn";
import type { StudioClip } from "./types";

interface CleanPromptCardProps {
  clip: StudioClip;
  totalClips: number;
  aspectRatio: "9:16" | "16:9";
  startTime: number;
  endTime: number;
  onUpdateClip: (patch: Partial<StudioClip>) => void;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}

export function CleanPromptCard({
  clip,
  aspectRatio,
  startTime,
  endTime,
  onUpdateClip,
  notify,
}: CleanPromptCardProps) {
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [sendingFlow, setSendingFlow] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(0);
    return `${m}:${s.padStart(2, "0")}`;
  };

  const handleCopyPrompt = async () => {
    if (!clip.imagePrompt) return;
    try {
      await copyText(clip.imagePrompt);
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 2000);
      notify(`Image #${clip.index} prompt copied!`, "success");
    } catch {
      notify("Could not access clipboard.", "error");
    }
  };

  const handleSendToFlow = async () => {
    if (!clip.imagePrompt) return;
    setSendingFlow(true);
    notify(`Sending Image #${clip.index} prompt to Google Flow…`, "info");

    try {
      const isInstalled = isFlowExtensionInstalled();
      if (!isInstalled) {
        await copyText(clip.imagePrompt);
        window.open("https://flow.google.com", "_blank");
        notify(
          "Prompt copied! Load the extension from the 'extension' folder for 1-click injection in Flow.",
          "info",
        );
        return;
      }

      const res = await sendToFlow({
        prompt: clip.imagePrompt,
        imageUrl: clip.imageUrl,
        imageName: `image-${clip.index}.png`,
        autoRun: !clip.imageUrl,
      });

      if (res.success) {
        notify(res.message || `Image #${clip.index} sent to Google Flow!`, "success");
      } else {
        notify(res.error || "Failed to send to Google Flow.", "error");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setSendingFlow(false);
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onUpdateClip({ imageUrl: url });
    notify(`Saved image attached to #${clip.index}!`, "success");
  };

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:border-muted-foreground/30 hover:shadow-xs">
      <div className="flex flex-col gap-3">
        {/* Card Header Row: Badge, Timestamp, and Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary font-mono text-xs font-bold text-primary-foreground shadow-xs">
              #{String(clip.index).padStart(2, "0")}
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
              {formatTime(startTime)} - {formatTime(endTime)} ({clip.duration.toFixed(1)}s)
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
              {clip.motion || "zoom-in"}
            </span>
          </div>

          {/* Quick Action Buttons: Send to Flow (Primary) & Copy Prompt */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={handleSendToFlow}
              disabled={sendingFlow}
              className="h-8 gap-1.5 px-3 text-xs font-semibold"
              title="Auto-place this prompt into Google Flow"
            >
              {sendingFlow ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {sendingFlow ? "Sending…" : "🚀 Send to Flow"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyPrompt}
              className="h-8 gap-1.5 px-2.5 text-xs font-medium"
              title="Copy prompt for Flow / Midjourney / Flux"
            >
              {copiedPrompt ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              {copiedPrompt ? "Copied" : "Copy Prompt"}
            </Button>
          </div>
        </div>

        {/* Middle: Voiceover Line for this exact moment */}
        <div className="rounded-lg border border-primary/20 bg-brand-subtle px-3 py-2">
          <p className="text-2xs font-bold uppercase tracking-wider text-secondary-foreground/70">
            Voiceover at this moment:
          </p>
          <p className="mt-0.5 text-sm font-medium leading-relaxed text-secondary-foreground font-bangla">
            {clip.narration}
          </p>
        </div>

        {/* Bottom: Flow Image Prompt Box & Optional Image Preview */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {/* Flow Image Prompt Text Box */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between pb-1">
              <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Google Flow Image Prompt ({aspectRatio})
              </label>
              <span className="font-mono text-3xs text-muted-foreground">
                {clip.imagePrompt.length} chars
              </span>
            </div>
            <div className="rounded-lg border border-border bg-surface-subtle p-3 font-mono text-xs leading-relaxed text-foreground select-all">
              {clip.imagePrompt}
            </div>
          </div>

          {/* Optional: User-attached image or dropzone (from Flow download) */}
          <div className="w-full sm:w-36 shrink-0 flex flex-col items-center">
            {clip.imageUrl ? (
              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border border-border bg-black shadow-xs",
                  aspectRatio === "9:16" ? "h-36 aspect-9/16" : "w-36 aspect-video",
                )}
              >
                <Image src={clip.imageUrl} alt="" fill unoptimized className="object-cover" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-3xs text-white hover:bg-black"
                  title="Replace with downloaded image from Flow"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary hover:text-primary",
                  aspectRatio === "9:16" ? "h-36 w-24" : "w-36 h-24",
                )}
                title="Attach image downloaded from Flow (optional preview)"
              >
                <ImagePlus className="size-5 mb-1" />
                <span className="text-3xs font-medium text-center px-1">
                  Attach Image from Flow
                </span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleImageFile}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
