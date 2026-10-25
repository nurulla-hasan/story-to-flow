"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clapperboard, Clock, Film, Headphones } from "lucide-react";
import type { StudioProject } from "./types";

interface StudioEditorCtaProps {
  project: StudioProject;
  totalDuration: number;
}

export function StudioEditorCta({ project, totalDuration }: StudioEditorCtaProps) {
  const previews = React.useMemo(
    () => project.clips.filter((clip) => Boolean(clip.imageUrl)).slice(0, 4),
    [project.clips],
  );

  return (
    <Link
      href="/studio/editor"
      className="group flex flex-col gap-3 rounded-xl border border-primary/30 bg-linear-to-r from-primary/10 via-card to-card p-4 shadow-xs transition-colors hover:border-primary/60 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        {previews.length > 0 ? (
          <div className="flex shrink-0 -space-x-3">
            {previews.map((clip) => (
              <span
                key={clip.id}
                className="relative size-11 overflow-hidden rounded-lg border border-border bg-muted shadow-sm"
              >
                <Image
                  src={clip.imageUrl as string}
                  alt={`Clip ${clip.index}`}
                  fill
                  unoptimized
                  sizes="44px"
                  className="object-cover"
                />
              </span>
            ))}
          </div>
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clapperboard className="size-5" />
          </span>
        )}

        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Film className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">Open the full-screen editor</span>
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-3xs text-muted-foreground">
            <span>
              {project.clips.length} clip{project.clips.length === 1 ? "" : "s"}
            </span>
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Clock className="size-2.5" />
              {Math.floor(totalDuration / 60)}:
              {String(Math.floor(totalDuration % 60)).padStart(2, "0")}
            </span>
            <span className="text-border">•</span>
            <span className="font-mono">{project.aspectRatio}</span>
            {project.audioUrl ? (
              <>
                <span className="text-border">•</span>
                <span className="inline-flex items-center gap-1 text-track-voice">
                  <Headphones className="size-2.5" />
                  voiceover
                </span>
              </>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-1 text-2xs text-muted-foreground">
            Timeline, captions, motion, transitions, SFX, music and export — on a dedicated
            full-width stage.
          </p>
        </div>
      </div>

      <span className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-stretch rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground shadow-sm transition-transform group-hover:translate-x-0.5 sm:self-auto">
        Go to Editor
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}
