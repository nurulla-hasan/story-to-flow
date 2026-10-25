"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Captions,
  Check,
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
  saveStatus: "idle" | "saving" | "saved" | "error";
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
  saveStatus,
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
    <header className="relative z-30 shrink-0 border-b border-border bg-editor-chrome">
      <div className="flex h-14 items-center gap-1.5 overflow-hidden px-2 sm:gap-2 sm:px-3">
        <Link
          href="/"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-xs transition-colors hover:bg-muted sm:size-9"
          aria-label="Back to the story planner"
          title="Back to the story planner"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm sm:flex">
          <Film className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 truncate text-xs font-bold tracking-tight text-foreground sm:text-sm">
              {project.title || "Video editor"}
            </h2>
            <span className="hidden shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-3xs font-semibold text-primary md:inline-flex">
              <Film className="size-2.5" />
              Video editor
            </span>
          </div>

          <div className="mt-0.5 hidden min-w-0 items-center gap-1.5 overflow-hidden text-3xs whitespace-nowrap text-muted-foreground sm:flex">
            <span className="font-mono">{aspectLabel}</span>
            <span className="text-border">•</span>
            <span>
              {project.clips.length} clip{project.clips.length === 1 ? "" : "s"}
            </span>
            <span className="text-border">•</span>
            <span className="font-mono">{formatSec(totalDuration)}</span>
            {project.audioUrl ? (
              <>
                <span className="text-border">•</span>
                <span className="inline-flex items-center gap-1 text-track-voice">
                  <AudioLines className="size-2.5" />
                  {formatSec(effectiveAudioDuration)}
                </span>
              </>
            ) : null}
            <span className="inline-flex items-center gap-1" role="status">
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="size-2.5 animate-spin" />
                  <span>Saving</span>
                </>
              ) : saveStatus === "error" ? (
                <>
                  <AlertTriangle className="size-2.5 text-warning" />
                  <span>Not saved</span>
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <Check className="size-2.5 text-success" />
                  <span>Saved</span>
                </>
              ) : null}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-xs xl:flex">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onImportImagesClick}
            className="h-7 gap-1.5 px-2 text-2xs font-semibold"
            title="Import all clip images"
          >
            <ImagePlus className="size-3.5 text-primary" />
            <span>Images</span>
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
            <span>{project.audioUrl ? "Replace voice" : "Voiceover"}</span>
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
              <span>Auto-sync</span>
            </Button>
          ) : null}
        </div>

        <Button
          type="button"
          size="sm"
          variant={showSubtitles ? "secondary" : "outline"}
          onClick={onToggleSubtitles}
          className="hidden h-8 shrink-0 gap-1.5 px-2 text-2xs font-semibold sm:inline-flex sm:px-2.5"
          title="Toggle the burned-in Bangla captions"
        >
          <Captions className="size-3.5" />
          <span className="hidden sm:inline">{showSubtitles ? "CC on" : "CC off"}</span>
        </Button>

        <Button
          type="button"
          size="sm"
          disabled={isExporting || project.clips.length === 0}
          onClick={onExport}
          className="h-8 shrink-0 gap-1.5 px-2 text-2xs font-bold shadow-sm sm:px-3"
          title="Render the timeline and download the video"
        >
          {isExporting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          <span>{isExporting ? `${exportProgress}%` : "Export"}</span>
        </Button>
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
