"use client";

import * as React from "react";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, copyText } from "@/lib/apiClient";
import { isFlowExtensionInstalled, sendToFlow } from "@/lib/flowBridge";
import { cn } from "cn";
import type { StudioCastMember, StudioClip } from "./types";

interface CleanPromptCardProps {
  clip: StudioClip;
  totalClips: number;
  open: boolean;
  onToggle: () => void;
  aspectRatio: "9:16" | "16:9";
  startTime: number;
  endTime: number;
  onUpdateClip: (patch: Partial<StudioClip>) => void;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
  cast?: StudioCastMember[];
}

export function CleanPromptCard({
  clip,
  open,
  onToggle,
  aspectRatio,
  startTime,
  endTime,
  onUpdateClip,
  notify,
  cast,
}: CleanPromptCardProps) {
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [sendingFlow, setSendingFlow] = React.useState(false);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const visibleCast = (clip.characterIds ?? [])
    .map((id) => cast?.find((member) => member.id === id))
    .filter((member): member is StudioCastMember => Boolean(member));

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

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const localUrl = URL.createObjectURL(file);
    onUpdateClip({ imageUrl: localUrl });

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api<{ success: boolean; files: { url: string }[] }>("/api/studio/upload", {
        method: "POST",
        body: formData,
      });
      if (res.files?.[0]?.url) {
        onUpdateClip({ imageUrl: res.files[0].url });
      }
      notify(`Saved image attached to #${clip.index}!`, "success");
    } catch {
      notify(`Image attached locally for #${clip.index}.`, "info");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-shadow",
        open
          ? "border-brand-border shadow-md"
          : "border-border shadow-xs hover:border-muted-foreground/30",
      )}
    >
      {/* Header Bar */}
      <div className="flex w-full items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted font-mono text-xs font-semibold tabular-nums text-foreground">
            {clip.imageUrl ? (
              <Image src={clip.imageUrl} alt="" fill unoptimized className="object-cover" />
            ) : (
              `#${String(clip.index).padStart(2, "0")}`
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground font-bangla">
                {clip.narration || clip.imagePrompt.slice(0, 60)}
              </span>
              {clip.imageUrl ? (
                <span className="hidden shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-3xs font-semibold text-primary sm:inline">
                  Image attached
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono">
                {formatTime(startTime)} - {formatTime(endTime)} ({clip.duration.toFixed(1)}s)
              </span>
              <span aria-hidden>·</span>
              <span className="capitalize">{clip.motion || "zoom-in"}</span>
            </span>
            {visibleCast.length > 0 ? (
              <span className="mt-1 flex flex-wrap items-center gap-1">
                {visibleCast.map((member) => (
                  <span
                    key={member.id}
                    className="rounded bg-secondary px-1.5 py-0.5 text-3xs font-semibold text-secondary-foreground"
                  >
                    {member.name}
                  </span>
                ))}
              </span>
            ) : null}
          </span>
        </button>

        {/* Quick Send to Flow & Chevron Toggle */}
        <div className="flex shrink-0 items-center gap-2">
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
            <span className="hidden sm:inline">{sendingFlow ? "Sending…" : "🚀 Send to Flow"}</span>
          </Button>

          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? "Collapse clip details" : "Expand clip details"}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* Expanded Details Body */}
      {open ? (
        <div className="border-t border-border px-4 pb-4 pt-4">
          <div className="flex flex-col gap-4 md:flex-row">
            {/* Left: Image Container (9:16 or 16:9) */}
            <div className="w-full md:w-48 md:shrink-0">
              <div
                className={cn(
                  "relative overflow-hidden rounded-lg border border-border bg-muted flex items-center justify-center",
                  aspectRatio === "9:16"
                    ? "mx-auto aspect-9/16 w-full max-w-44"
                    : "aspect-video w-full",
                )}
              >
                {clip.imageUrl ? (
                  <Image src={clip.imageUrl} alt="" fill unoptimized className="object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
                    <ImagePlus className="size-6 text-muted-foreground/60" />
                    <p className="text-2xs font-medium text-muted-foreground leading-4">
                      No image yet
                    </p>
                    <p className="text-3xs text-muted-foreground/80">
                      Generate in Flow or attach here
                    </p>
                  </div>
                )}
              </div>

              {/* Upload & Download below image */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploadingImage}
                  className="h-8 flex-1 gap-1 text-2xs"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach image downloaded from Flow"
                >
                  {uploadingImage ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Upload className="size-3" />
                  )}
                  {uploadingImage
                    ? "Saving…"
                    : clip.imageUrl
                      ? "Replace"
                      : "Attach Image"}
                </Button>

                {clip.imageUrl ? (
                  <a
                    href={clip.imageUrl}
                    download={`image-${clip.index}.png`}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-2xs font-medium text-foreground hover:bg-muted"
                    title="Download attached image"
                  >
                    <Download className="size-3" />
                    Save
                  </a>
                ) : null}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleImageFile}
              />
            </div>

            {/* Right: Voiceover line & Flow Image Prompt */}
            <div className="min-w-0 flex-1 space-y-3">
              {/* Voiceover Line */}
              <div className="rounded-lg border border-brand-border bg-brand-subtle p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
                  Voiceover at this moment:
                </p>
                <p className="mt-1 text-sm leading-6 text-secondary-foreground font-bangla whitespace-pre-line">
                  {clip.narration}
                </p>
              </div>

              {/* Flow Image Prompt Box */}
              <div>
                <div className="flex items-center justify-between pb-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Google Flow Image Prompt ({aspectRatio})
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyPrompt}
                    className="h-6 gap-1 px-1.5 text-2xs text-primary hover:text-foreground"
                  >
                    {copiedPrompt ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                    <span>{copiedPrompt ? "Copied!" : "Copy"}</span>
                  </Button>
                </div>

                <div className="rounded-lg border border-border bg-surface-subtle p-3 font-mono text-xs leading-relaxed text-foreground select-all">
                  {clip.imagePrompt}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendToFlow}
                  disabled={sendingFlow}
                  className="h-9 gap-1.5 text-xs font-semibold"
                >
                  {sendingFlow ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {sendingFlow ? "Sending to Flow…" : "🚀 Send to Flow"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyPrompt}
                  className="h-9 gap-1.5 text-xs"
                >
                  {copiedPrompt ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  {copiedPrompt ? "Prompt Copied!" : "Copy Prompt"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
