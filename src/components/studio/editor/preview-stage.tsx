"use client";

import * as React from "react";
import { Captions, Loader2, Maximize, Minimize } from "lucide-react";
import { cn } from "cn";
import type { StudioProject } from "../types";

interface PreviewStageProps {
  project: StudioProject;
  stageRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isFullscreen: boolean;
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
  isFullscreen,
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
        "group/stage relative flex min-h-0 flex-1 flex-col overflow-hidden bg-editor-stage",
        isFullscreen && "h-dvh w-full",
      )}
    >
      <div className="stage-grid pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 p-2 sm:p-3">
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
                  : "text-editor-on-dark-muted hover:text-editor-on-dark",
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
              "flex size-7 items-center justify-center rounded-md border border-editor-line bg-editor-screen/80 text-editor-on-dark-muted backdrop-blur-sm transition-colors hover:text-editor-on-dark",
              showSubtitles && "text-primary",
            )}
            title="Toggle captions overlay"
            aria-pressed={showSubtitles}
          >
            <Captions className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="flex size-7 items-center justify-center rounded-md border border-editor-line bg-editor-screen/80 text-editor-on-dark-muted backdrop-blur-sm transition-colors hover:text-editor-on-dark"
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

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-2 pb-2 sm:px-5 sm:pb-4">
        <canvas
          ref={canvasRef}
          className="block h-full w-full object-contain drop-shadow-2xl"
          aria-label="Video preview"
        />

        {showSubtitles ? (
          <span className="pointer-events-none absolute right-3 bottom-3 rounded-full border border-editor-line bg-editor-screen/70 px-1.5 py-0.5 font-mono text-3xs font-semibold text-editor-on-dark backdrop-blur-sm">
            CC
          </span>
        ) : null}

        {isExporting ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-editor-screen/80 backdrop-blur-sm">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="font-mono text-xs font-bold text-editor-on-dark">
              Rendering {exportProgress}%
            </p>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-editor-line">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
