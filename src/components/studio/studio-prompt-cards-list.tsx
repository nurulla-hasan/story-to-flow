"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  Copy,
  Download,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/apiClient";
import { isFlowExtensionInstalled, sendToFlow } from "@/lib/flowBridge";
import { CleanPromptCard } from "./clean-prompt-card";
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
  openClipId: string | null;
  onToggleClip: (clipId: string) => void;
  onUpdateClip: (clipId: string, patch: Partial<StudioClip>) => void;
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
  openClipId,
  onToggleClip,
  onUpdateClip,
  notify,
  cast,
  title = "Individual Clip Prompt Cards",
  projectTitle = "story",
  stylePreset = "",
}: StudioPromptCardsListProps) {
  const [showTextView, setShowTextView] = React.useState(false);
  const [copiedAllPrompts, setCopiedAllPrompts] = React.useState(false);
  const [sendingAllFlow, setSendingAllFlow] = React.useState(false);

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
    () => formatAllPrompts(clips, defaultClipDuration),
    [clips, defaultClipDuration],
  );

  const handleCopyAllPrompts = async () => {
    if (!allPromptsFormatted) return;
    try {
      await copyText(allPromptsFormatted);
      setCopiedAllPrompts(true);
      window.setTimeout(() => setCopiedAllPrompts(false), 2000);
      notify("All Google Flow prompts copied to clipboard!", "success");
    } catch {
      notify("Could not access clipboard.", "error");
    }
  };

  const handleDownloadPrompts = () => {
    if (!clips.length) return;
    const content = formatPromptsExport(
      {
        title: projectTitle,
        clips,
        aspectRatio,
        defaultClipDuration,
        stylePreset,
      },
      totalDuration,
    );
    downloadTextFile(content, `${slugifyTitle(projectTitle)}-flow-prompts.txt`);
    notify("Downloaded all Flow prompts!", "success");
  };

  const handleSendAllToFlow = async () => {
    if (!clips.length) return;
    setSendingAllFlow(true);
    notify("Preparing all prompts for Google Flow…", "info");

    try {
      await copyText(allPromptsFormatted);

      if (!isFlowExtensionInstalled()) {
        window.open("https://flow.google.com", "_blank");
        notify(
          "All prompts copied to clipboard! Load the extension from the 'extension' folder to automate injection.",
          "info",
        );
        return;
      }

      const first = clips[0];
      const res = await sendToFlow({
        prompt: first.imagePrompt,
        imageUrl: first.imageUrl,
        imageName: "image-1.png",
        autoRun: true,
      });

      if (res.success) {
        notify(
          "All prompts copied and the first prompt was placed in Google Flow!",
          "success",
        );
      } else {
        notify(res.error || "All prompts copied. Opened Google Flow tab.", "info");
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {clips.length} prompts · ~{Math.round(totalDuration)}s · {aspectRatio}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSendAllToFlow}
            disabled={sendingAllFlow || clips.length === 0}
            className="h-8 gap-1.5 px-3 text-xs font-semibold"
            title="Copy every prompt and place the first one in Google Flow"
          >
            {sendingAllFlow ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {sendingAllFlow ? "Sending…" : "Send All to Flow"}
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
            className="h-8 gap-1.5 px-2.5 text-xs"
            title="Download all prompts as .txt"
          >
            <Download className="size-3.5" aria-hidden />
            .txt
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowTextView((value) => !value)}
            className="h-8 gap-1.5 px-2.5 text-2xs text-muted-foreground"
            aria-pressed={showTextView}
          >
            <ChevronsUpDown className="size-3.5" aria-hidden />
            {showTextView ? "Cards View" : "Text View"}
          </Button>
        </div>
      </div>

      {showTextView ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <pre className="max-h-128 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground select-all">
            {allPromptsFormatted}
          </pre>
        </div>
      ) : (
        <div className="space-y-3">
          {timedClips.map(({ clip, startTime, endTime }) => (
            <CleanPromptCard
              key={clip.id}
              clip={clip}
              totalClips={clips.length}
              open={openClipId === clip.id}
              onToggle={() => onToggleClip(clip.id)}
              aspectRatio={aspectRatio}
              startTime={startTime}
              endTime={endTime}
              onUpdateClip={(patch) => onUpdateClip(clip.id, patch)}
              notify={notify}
              cast={cast}
            />
          ))}
        </div>
      )}
    </div>
  );
}
