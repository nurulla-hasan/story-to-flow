"use client";

import * as React from "react";
import {
  AudioLines,
  Captions,
  Clapperboard,
  Download,
  Film,
  ImagePlus,
  Loader2,
  Music,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudioProject } from "../types";
import { formatSec } from "./editor-shared";

interface CommandBarProps {
  project: StudioProject;
  aspectLabel: string;
  totalDuration: number;
  effectiveAudioDuration: number;
  showSubtitles: boolean;
  onToggleSubtitles: () => void;
  onImportImagesClick: () => void;
  onReplaceVoice: () => void;
  onAutoSync: () => void;
  uploadingAudio: boolean;
  isExporting: boolean;
  exportProgress: number;
  onExport: () => void;
}

export function CommandBar({
  project,
  aspectLabel,
  totalDuration,
  effectiveAudioDuration,
  showSubtitles,
  onToggleSubtitles,
  onImportImagesClick,
  onReplaceVoice,
  onAutoSync,
  uploadingAudio,
  isExporting,
  exportProgress,
  onExport,
}: CommandBarProps) {
  return (
    <header className="@container border-b border-border bg-surface-subtle">
      <div className="flex flex-col gap-2.5 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:flex-1">
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:size-10">
            <Film className="size-4 sm:size-5" />
            <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-card text-primary ring-1 ring-border">
              <Clapperboard className="size-2.5" />
            </span>
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-sm font-bold tracking-tight text-foreground sm:text-base">
                Video Studio
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-3xs font-semibold whitespace-nowrap text-primary">
                <Clapperboard className="size-2.5 shrink-0" />
                CapCut style
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-3xs whitespace-nowrap text-muted-foreground">
              <span className="font-mono">{aspectLabel}</span>
              <span className="text-border">•</span>
              <span>
                {project.clips.length} clip{project.clips.length === 1 ? "" : "s"}
              </span>
              <span className="hidden text-border @3xl:inline">•</span>
              <span className="hidden font-mono @3xl:inline">
                {formatSec(totalDuration)} runtime
              </span>
              {project.audioUrl ? (
                <>
                  <span className="text-border">•</span>
                  <span className="inline-flex items-center gap-1 text-track-voice">
                    <AudioLines className="size-2.5" />
                    voice {formatSec(effectiveAudioDuration)}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex w-full items-center gap-1.5 sm:w-auto sm:flex-wrap">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-xs">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onImportImagesClick}
              className="h-7 gap-1.5 px-2 text-2xs font-semibold"
              title="Import all clip images"
            >
              <ImagePlus className="size-3.5 text-primary" />
              <span className="hidden @3xl:inline">Images</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={uploadingAudio}
              onClick={onReplaceVoice}
              className="h-7 gap-1.5 px-2 text-2xs font-semibold"
              title="Upload CapCut TTS or recorded voiceover (MP3 / WAV)"
            >
              {uploadingAudio ? (
                <Loader2 className="size-3.5 animate-spin text-track-voice" />
              ) : (
                <Music className="size-3.5 text-track-voice" />
              )}
              <span className="hidden @3xl:inline">
                {project.audioUrl ? "Replace voice" : "Voiceover"}
              </span>
            </Button>

            {project.audioDuration > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onAutoSync}
                className="h-7 gap-1.5 px-2 text-2xs font-semibold"
                title="Stretch every clip so the timeline matches the voiceover"
              >
                <Wand2 className="size-3.5 text-primary" />
                <span className="hidden @4xl:inline">Auto-sync</span>
              </Button>
            ) : null}
          </div>

          <Button
            type="button"
            size="sm"
            variant={showSubtitles ? "secondary" : "outline"}
            onClick={onToggleSubtitles}
            className="h-8 gap-1.5 px-2.5 text-2xs font-semibold"
            title="Toggle the burned-in Bangla captions"
          >
            <Captions className="size-3.5" />
            <span className="hidden @2xl:inline">{showSubtitles ? "CC on" : "CC off"}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isExporting || project.clips.length === 0}
            onClick={onExport}
            className="ml-auto h-8 gap-1.5 px-3 text-2xs font-bold shadow-sm sm:ml-0"
            title="Render the timeline and download the video"
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            <span>{isExporting ? `${exportProgress}%` : "Export"}</span>
            <span className="hidden @2xl:inline">video</span>
          </Button>
        </div>
      </div>

      {isExporting ? (
        <div className="h-1 w-full bg-muted" aria-hidden="true">
          <div
            className="h-full bg-primary transition-all duration-150"
            style={{ width: `${exportProgress}%` }}
          />
        </div>
      ) : null}
    </header>
  );
}
