"use client";

import * as React from "react";
import { Captions, Crop, Loader2, Maximize, Minimize } from "lucide-react";
import { cn } from "cn";
import type { StudioProject } from "../types";

interface PreviewStageProps {
  project: StudioProject;
  stageRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  aspectLabel: string;
  isFullscreen: boolean;
  isPlaying: boolean;
  isExporting: boolean;
  exportProgress: number;
  showSubtitles: boolean;
  onToggleSubtitles: () => void;
  onToggleFullscreen: () => void;
  onUpdateProject: (patch: Partial<StudioProject>) => void;
}

export function PreviewStage({
  project,
  stageRef,
  canvasRef,
  aspectLabel,
  isFullscreen,
  isPlaying,
  isExporting,
  exportProgress,
  showSubtitles,
  onToggleSubtitles,
  onToggleFullscreen,
  onUpdateProject,
}: PreviewStageProps) {
  return (
    <div
      ref={stageRef}
      className={cn(
        "group/stage relative overflow-hidden rounded-xl border border-border bg-editor-stage shadow-inner xl:flex xl:flex-1 xl:flex-col",
        isFullscreen && "flex size-full items-center justify-center border-0",
      )}
    >
      <div className="stage-grid pointer-events-none absolute inset-0 opacity-25" />

      {/* Floating stage controls */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 p-2">
        <div className="flex items-center rounded-lg border border-editor-line bg-editor-screen/80 p-0.5 backdrop-blur-sm">
          {(["9:16", "16:9"] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => onUpdateProject({ aspectRatio: ratio })}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-3xs font-semibold transition-colors",
                project.aspectRatio === ratio
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={
                ratio === "9:16"
                  ? "Vertical 9:16 for Shorts, Reels and TikTok"
                  : "Widescreen 16:9 for YouTube"
              }
            >
              {ratio}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleSubtitles}
            className={cn(
              "flex size-7 items-center justify-center rounded-md border border-editor-line bg-editor-screen/80 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground",
              showSubtitles && "text-primary",
            )}
            title="Toggle captions overlay"
          >
            <Captions className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="flex size-7 items-center justify-center rounded-md border border-editor-line bg-editor-screen/80 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
            title={isFullscreen ? "Exit fullscreen preview" : "Fullscreen preview"}
          >
            {isFullscreen ? (
              <Minimize className="size-3.5" />
            ) : (
              <Maximize className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center justify-center",
          isFullscreen ? "size-full p-4" : "px-3 pt-11 pb-2 sm:px-5 sm:pt-12 sm:pb-3 xl:flex-1",
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-lg bg-editor-screen shadow-2xl ring-1 ring-editor-line",
            isFullscreen
              ? "h-full w-auto max-h-full max-w-full"
              : project.aspectRatio === "9:16"
                ? "aspect-9/16 h-72 w-auto max-w-full sm:h-80 xl:h-96"
                : "aspect-video w-full max-w-3xl",
          )}
        >
          <canvas ref={canvasRef} className="size-full object-contain" />

          {showSubtitles ? (
            <span className="pointer-events-none absolute top-2 right-2 rounded-full border border-editor-line bg-editor-screen/75 px-1.5 py-0.5 font-mono text-3xs font-semibold text-muted-foreground">
              CC
            </span>
          ) : null}

          {isExporting ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-editor-screen/80 backdrop-blur-sm">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="font-mono text-xs font-bold text-foreground">
                Rendering {exportProgress}%
              </p>
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!isFullscreen ? (
        <div className="flex items-center justify-between gap-2 px-3 pb-2 text-3xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Crop className="size-2.5" />
            Safe preview · {aspectLabel}
          </span>
          <span className="inline-flex items-center gap-1 font-mono">
            <span
              className={cn(
                "size-1.5 rounded-full",
                isPlaying ? "bg-success" : "bg-muted-foreground/50",
              )}
            />
            {isPlaying ? "playing" : "paused"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
