"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Clapperboard, Images, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioPromptCardsList } from "@/components/studio/studio-prompt-cards-list";
import { StudioVoiceoverCard } from "@/components/studio/studio-voiceover-card";
import { copyText } from "@/lib/apiClient";
import type { StudioClip, StudioProject } from "@/components/studio/types";
import type { ShortsPacing } from "@/lib/types";

interface ShortsPlanPanelProps {
  project: StudioProject;
  pacing: ShortsPacing;
  isPlanning: boolean;
  onPlan: () => void;
  onUpdateClip: (clipId: string, patch: Partial<StudioClip>) => void;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}

function downloadVoiceover(text: string, title: string) {
  const safeTitle =
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "shorts";
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeTitle}-voiceover.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ShortsPlanPanel({
  project,
  pacing,
  isPlanning,
  onPlan,
  onUpdateClip,
  notify,
}: ShortsPlanPanelProps) {
  const [openClipId, setOpenClipId] = React.useState<string | null>(null);
  const [copiedVoiceover, setCopiedVoiceover] = React.useState(false);

  const clips = project.clips;
  const totalDuration = clips.reduce(
    (total, clip) => total + (clip.duration || project.defaultClipDuration || 3),
    0,
  );
  const attachedCount = clips.filter((clip) => clip.imageUrl).length;

  const handleCopyVoiceover = async () => {
    if (!project.continuousVoiceover) return;
    try {
      await copyText(project.continuousVoiceover);
      setCopiedVoiceover(true);
      window.setTimeout(() => setCopiedVoiceover(false), 2000);
      notify("Voiceover script copied. Paste it into CapCut TTS or ElevenLabs.", "success");
    } catch {
      notify("Could not access clipboard.", "error");
    }
  };

  if (clips.length === 0) {
    return (
      <section className="flex min-h-96 min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-xs">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Images className="size-6" aria-hidden />
        </span>
        <h2 className="mt-3 text-base font-bold text-foreground">
          Shorts / Voiceover mode is on
        </h2>
        <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
          Generate a continuous, clean Bangla voiceover and a sequence of 2.5–5 second
          image prompts. Every shot uses the locked Characters, Locations and Custom
          Rules from the right panel — then opens directly in the Video Studio.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            onClick={onPlan}
            disabled={isPlanning}
            className="h-10 gap-2 px-5 text-sm font-semibold"
          >
            {isPlanning ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="size-4" aria-hidden />
            )}
            {isPlanning ? "Writing prompts & voiceover…" : "Generate Shorts Plan"}
          </Button>
          <Link
            href="/studio"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-xs transition-colors hover:bg-muted"
          >
            <Clapperboard className="size-4" aria-hidden />
            Video Studio
          </Link>
        </div>

        <p className="mt-3 text-2xs text-muted-foreground">
          Tip: create or update the Story Bible first so character &amp; location locks
          are available.
        </p>
      </section>
    );
  }

  return (
    <section className="min-w-0 flex-1 space-y-4">
      {/* Top CTA + plan summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-border bg-card p-4 shadow-xs">
        <div className="min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Shorts / Voiceover plan
          </p>
          <h2 className="mt-0.5 text-sm font-bold text-foreground">
            {clips.length} sequential images · ~{Math.round(totalDuration)}s
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {attachedCount}/{clips.length} images attached · character locks injected per shot
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPlan}
            disabled={isPlanning}
            className="h-9 gap-1.5 text-xs"
          >
            {isPlanning ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="size-3.5" aria-hidden />
            )}
            {isPlanning ? "Regenerating…" : "Regenerate"}
          </Button>

          <Link
            href="/studio"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Open in Video Studio
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      {project.continuousVoiceover ? (
        <StudioVoiceoverCard
          voiceover={project.continuousVoiceover}
          totalDuration={totalDuration}
          clipCount={clips.length}
          pacing={pacing}
          copiedVoiceover={copiedVoiceover}
          onCopyVoiceover={handleCopyVoiceover}
          onDownloadVoiceover={() =>
            downloadVoiceover(project.continuousVoiceover, project.title)
          }
        />
      ) : null}

      <StudioPromptCardsList
        clips={clips}
        defaultClipDuration={project.defaultClipDuration}
        aspectRatio={project.aspectRatio}
        openClipId={openClipId}
        onToggleClip={(clipId) =>
          setOpenClipId(openClipId === clipId ? null : clipId)
        }
        onUpdateClip={onUpdateClip}
        notify={notify}
        cast={project.cast}
        title="Sequential Image Prompts"
        projectTitle={project.title}
        stylePreset={project.stylePreset}
      />
    </section>
  );
}
