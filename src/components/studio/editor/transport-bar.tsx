"use client";

import * as React from "react";
import {
  Maximize,
  Palette,
  Pause,
  Play,
  RotateCcw,
  StepBack,
  StepForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import type { StudioProject } from "../types";
import { formatSec } from "./editor-shared";

interface TransportBarProps {
  project: StudioProject;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onStop: () => void;
  currentTime: number;
  totalDuration: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  saturation: number;
  onUpdateProject: (patch: Partial<StudioProject>) => void;
}

export function TransportBar({
  project,
  isPlaying,
  onTogglePlay,
  onSeek,
  onStop,
  currentTime,
  totalDuration,
  isMuted,
  onToggleMute,
  onToggleFullscreen,
  saturation,
  onUpdateProject,
}: TransportBarProps) {
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-2.5 shadow-xs sm:px-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0 rounded-full shadow-sm"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
          </Button>

          <div className="hidden items-center gap-0.5 sm:flex">
            <button
              type="button"
              onClick={onStop}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Back to start"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSeek(currentTime - 1)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Back 1s (Shift + ← = 5s)"
            >
              <StepBack className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSeek(currentTime + 1)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Forward 1s (Shift + → = 5s)"
            >
              <StepForward className="size-3.5" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={totalDuration}
              step={0.01}
              value={Math.min(currentTime, totalDuration)}
              onChange={(event) => onSeek(parseFloat(event.target.value))}
              className="h-1.5 w-full cursor-pointer accent-primary"
              aria-label="Timeline position"
            />
            <div className="mt-1 flex items-center justify-between font-mono text-3xs">
              <span className="font-bold text-foreground">{formatSec(currentTime)}</span>
              <span className="text-muted-foreground">{formatSec(totalDuration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            {project.audioUrl || project.bgmUrl ? (
              <button
                type="button"
                onClick={onToggleMute}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={isMuted ? "Unmute (M)" : "Mute (M)"}
              >
                {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Fullscreen preview"
            >
              <Maximize className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Color grade */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Palette className="size-3.5 shrink-0 text-primary" />
          <span className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
            Color
          </span>
          <input
            type="range"
            min={0}
            max={200}
            step={5}
            value={saturation}
            onChange={(event) =>
              onUpdateProject({ saturation: parseInt(event.target.value, 10) })
            }
            className="h-1.5 min-w-16 max-w-40 flex-1 cursor-pointer accent-primary"
            title="Saturation — 0% black & white, 200% vibrant"
          />
          <span className="w-9 font-mono text-3xs font-bold text-foreground">{saturation}%</span>
        </div>

        <div className="flex items-center gap-1">
          {[
            { label: "B&W", value: 0 },
            { label: "Neutral", value: 100 },
            { label: "Vibrant", value: 135 },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onUpdateProject({ saturation: item.value })}
              className={cn(
                "rounded-md px-1.5 py-0.5 font-mono text-3xs transition-colors",
                saturation === item.value
                  ? "bg-primary font-bold text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
