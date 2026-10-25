"use client";

import * as React from "react";
import {
  Maximize,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  StepBack,
  StepForward,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSec } from "./editor-shared";

interface TransportBarProps {
  project: { audioUrl: string | null; bgmUrl?: string | null };
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onStop: () => void;
  currentTime: number;
  totalDuration: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
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
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: TransportBarProps) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-1.5 border-t border-border bg-editor-chrome px-2 sm:gap-2 sm:px-3">
      <Button
        type="button"
        size="icon"
        className="size-8 shrink-0 rounded-full shadow-sm"
        onClick={onTogglePlay}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      >
        {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
      </Button>

      {/* Undo & Redo (Ctrl+Z / Ctrl+Y) */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
        >
          <Redo2 className="size-3.5" />
        </button>
      </div>

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

      <span className="w-10 shrink-0 text-right font-mono text-3xs font-bold text-foreground sm:w-11">
        {formatSec(currentTime)}
      </span>

      <input
        type="range"
        min={0}
        max={totalDuration}
        step={0.01}
        value={Math.min(currentTime, totalDuration)}
        onChange={(event) => onSeek(parseFloat(event.target.value))}
        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
        aria-label="Timeline position"
      />

      <span className="w-10 shrink-0 font-mono text-3xs text-muted-foreground sm:w-11">
        {formatSec(totalDuration)}
      </span>

      <div className="flex shrink-0 items-center gap-0.5">
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
  );
}
