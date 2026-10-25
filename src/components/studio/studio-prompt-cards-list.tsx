"use client";

import * as React from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/apiClient";
import { isFlowExtensionInstalled, sendToFlow } from "@/lib/flowBridge";
import { evaluateHeroShot } from "@/lib/hero-shot";
import { cn } from "cn";
import {
  downloadTextFile,
  formatAllPrompts,
  formatPromptsExport,
} from "./prompt-utils";
import type { StudioCastMember, StudioClip } from "./types";

interface StudioPromptCardsListProps {
  clips: StudioClip[];
  defaultClipDuration: number;
  aspectRatio: "9:16" | "16:9";
  openClipId?: string | null;
  onToggleClip?: (clipId: string) => void;
  onUpdateClip?: (clipId: string, patch: Partial<StudioClip>) => void;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
  cast?: StudioCastMember[];
  title?: string;
  projectTitle?: string;
  stylePreset?: string;
}

function slugifyTitle(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "story"
  );
}

export function StudioPromptCardsList({
  clips,
  defaultClipDuration,
  aspectRatio,
  notify,
  title = "Sequential Image Prompts",
  projectTitle = "story",
  stylePreset = "",
}: StudioPromptCardsListProps) {
  const [copiedAllPrompts, setCopiedAllPrompts] = React.useState(false);
  const [sendingAllFlow, setSendingAllFlow] = React.useState(false);
  const [filterMode, setFilterMode] = React.useState<"all" | "video" | "image">("all");

  const heroClips = React.useMemo(() => {
    return clips.filter(
      (c) =>
        (c.recommendedMediaType || evaluateHeroShot(c).recommendedMediaType) ===
        "video",
    );
  }, [clips]);

  const staticClips = React.useMemo(() => {
    return clips.filter(
      (c) =>
        (c.recommendedMediaType || evaluateHeroShot(c).recommendedMediaType) !==
        "video",
    );
  }, [clips]);

  const heroCount = heroClips.length;
  const staticCount = staticClips.length;
  const estFlowCost = heroCount * 3 + staticCount * 1;

  const displayClips = React.useMemo(() => {
    if (filterMode === "video") return heroClips;
    if (filterMode === "image") return staticClips;
    return clips;
  }, [filterMode, heroClips, staticClips, clips]);

  const timedClips = React.useMemo(() => {
    let accumulated = 0;
    const items: { clip: StudioClip; startTime: number; endTime: number }[] = [];
    for (const clip of clips) {
      const dur = clip.duration || defaultClipDuration || 3.0;
      const startTime = accumulated;
      const endTime = accumulated + dur;
      accumulated = endTime;
      items.push({ clip, startTime, endTime });
    }
    return items;
  }, [clips, defaultClipDuration]);

  const totalDuration =
    timedClips.length > 0 ? timedClips[timedClips.length - 1].endTime : 0;

  const allPromptsFormatted = React.useMemo(
    () => formatAllPrompts(displayClips, defaultClipDuration),
    [displayClips, defaultClipDuration],
  );

  const handleCopyAllPrompts = async () => {
    if (!allPromptsFormatted) return;
    try {
      await copyText(allPromptsFormatted);
      setCopiedAllPrompts(true);
      window.setTimeout(() => setCopiedAllPrompts(false), 2000);
      notify(
        filterMode === "all"
          ? "All Google Flow prompts copied to clipboard!"
          : `Copied ${displayClips.length} filtered prompts to clipboard!`,
        "success",
      );
    } catch {
      notify("Could not access clipboard.", "error");
    }
  };

  const handleDownloadPrompts = () => {
    if (!clips.length) return;
    const content = formatPromptsExport(
      {
        title: projectTitle,
        clips: displayClips,
        aspectRatio,
        defaultClipDuration,
        stylePreset,
      },
      totalDuration,
    );
    downloadTextFile(
      content,
      `${slugifyTitle(projectTitle)}-${filterMode}-prompts.txt`,
    );
    notify("Downloaded prompts .txt file!", "success");
  };

  const handleAnimateHeroShots = async () => {
    if (!heroClips.length) return;
    setSendingAllFlow(true);
    notify(`Placing ${heroClips.length} Hero Video animation prompts into Google Flow…`, "info");

    const heroFormatted = formatAllPrompts(heroClips, defaultClipDuration);

    try {
      await copyText(heroFormatted);

      if (!isFlowExtensionInstalled()) {
        window.open("https://flow.google.com", "_blank");
        notify(
          `${heroClips.length} Hero Video prompts copied to clipboard! Paste directly into Google Flow.`,
          "info",
        );
        return;
      }

      const res = await sendToFlow({
        prompt: heroFormatted,
        mediaType: "video",
        duration: 4.0,
        autoRun: false,
      });

      if (res.success) {
        notify(`Placed ${heroClips.length} Hero Video prompts into Google Flow!`, "success");
      } else {
        notify(res.error || "Hero prompts copied. Opened Google Flow tab.", "info");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSendingAllFlow(false);
    }
  };

  const handleSendAllToFlow = async () => {
    if (!clips.length || !allPromptsFormatted) return;
    setSendingAllFlow(true);
    notify("Placing all prompts into Google Flow input…", "info");

    try {
      // 1. Copy all prompts as a safety backup
      await copyText(allPromptsFormatted);

      // 2. Check if extension is installed
      if (!isFlowExtensionInstalled()) {
        window.open("https://flow.google.com", "_blank");
        notify(
          "All prompts copied to clipboard! Paste directly into Google Flow's prompt input.",
          "info",
        );
        return;
      }

      // 3. Inject all prompts together into Flow's input without auto-generating (autoRun: false)
      const res = await sendToFlow({
        prompt: allPromptsFormatted,
        mediaType: "image",
        autoRun: false,
      });

      if (res.success) {
        notify("All prompts placed into Google Flow's input!", "success");
      } else {
        notify(
          res.error || "All prompts copied. Opened Google Flow tab.",
          "info",
        );
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSendingAllFlow(false);
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileText className="size-3.5" />
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {title}
            </h3>
          </div>
          <p className="mt-1 text-2xs text-muted-foreground">
            {clips.length} shots planned: {heroCount} Hero Videos • {staticCount} Static Images | Est. Flow Cost: ~{estFlowCost} Credits
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {heroCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAnimateHeroShots}
              disabled={sendingAllFlow}
              className="h-8 gap-1.5 border-purple-500/40 bg-purple-500/10 px-3 text-xs font-semibold text-purple-400 hover:bg-purple-500/20"
              title="Place only the hero action video prompts into Google Flow"
            >
              <Wand2 className="size-3.5" aria-hidden />
              <span>Animate {heroCount} Hero Shots in Flow</span>
            </Button>
          ) : null}

          <Button
            type="button"
            size="sm"
            onClick={handleSendAllToFlow}
            disabled={sendingAllFlow || clips.length === 0}
            className="h-8 gap-1.5 px-3 text-xs font-semibold"
            title="Place all prompts together into Google Flow input (without auto-generating)"
          >
            {sendingAllFlow ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {sendingAllFlow ? "Placing in Flow…" : "Send All Images to Flow"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopyAllPrompts}
            disabled={clips.length === 0}
            className="h-8 gap-1.5 px-3 text-xs font-semibold"
          >
            {copiedAllPrompts ? (
              <Check className="size-3.5 text-success" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
            {copiedAllPrompts ? "Copied All!" : "Copy All Prompts"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownloadPrompts}
            disabled={clips.length === 0}
            className="h-8 gap-1.5 px-2.5 text-xs font-semibold"
            title="Download all prompts as .txt"
          >
            <Download className="size-3.5" aria-hidden />
            .txt
          </Button>
        </div>
      </div>

      {/* Filter Pills & Text Export Box */}
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-3xs font-semibold transition-colors",
                filterMode === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              All ({clips.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("video")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 font-mono text-3xs font-semibold transition-colors",
                filterMode === "video"
                  ? "border border-purple-500/40 bg-purple-500/20 text-purple-300 font-bold shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-purple-300",
              )}
            >
              <Film className="size-3 text-purple-400" />
              <span>4s Video Clips ({heroCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("image")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 font-mono text-3xs font-semibold transition-colors",
                filterMode === "image"
                  ? "bg-secondary text-secondary-foreground font-bold shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <ImageIcon className="size-3 text-muted-foreground" />
              <span>Static Images ({staticCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-3xs text-muted-foreground md:inline">
              Est. Flow Cost: ~{estFlowCost} Credits
            </span>
            <button
              type="button"
              onClick={handleCopyAllPrompts}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-3xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Copy prompt text"
            >
              {copiedAllPrompts ? (
                <Check className="size-3 text-success" />
              ) : (
                <Copy className="size-3" />
              )}
              <span>{copiedAllPrompts ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        <div className="p-4">
          <pre className="max-h-160 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground select-all">
            {allPromptsFormatted || "No prompts generated yet."}
          </pre>
        </div>
      </div>
    </div>
  );
}
