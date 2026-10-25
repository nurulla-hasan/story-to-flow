"use client";

import * as React from "react";
import {
  Copy,
  FlipHorizontal,
  ImagePlus,
  Layers,
  Minus,
  Plus,
  Scissors,
  Sliders,
  StepBack,
  StepForward,
  Trash2,
} from "lucide-react";
import { cn } from "cn";
import { SFX_PRESETS, type StudioClip } from "../types";
import {
  formatSec,
  getClipSfxConfig,
  MOTION_PRESETS,
  type ClipTiming,
} from "./editor-shared";

interface ClipInspectorProps {
  editingClip: StudioClip | null;
  editingTiming: ClipTiming | null;
  isEditingSelected: boolean;
  onStepClip: (direction: -1 | 1) => void;
  onAdjustDuration: (clip: StudioClip, delta: number) => void;
  onUpdateClip: (clipId: string, patch: Partial<StudioClip>) => void;
  targetClipForImageRef: React.RefObject<string | null>;
  singleImageInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleFlip: (clip: StudioClip) => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenSfx: (clip: StudioClip) => void;
}

export function ClipInspector({
  editingClip,
  editingTiming,
  isEditingSelected,
  onStepClip,
  onAdjustDuration,
  onUpdateClip,
  targetClipForImageRef,
  singleImageInputRef,
  onToggleFlip,
  onSplit,
  onDuplicate,
  onDelete,
  onOpenSfx,
}: ClipInspectorProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Layers className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">Clip inspector</p>
            <p className="truncate font-mono text-3xs text-muted-foreground">
              {editingTiming
                ? `#${String(editingClip?.index ?? 0).padStart(2, "0")} · ${formatSec(editingTiming.start)}–${formatSec(editingTiming.end)}`
                : "Nothing selected"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onStepClip(-1)}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Previous clip"
          >
            <StepBack className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => onStepClip(1)}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Next clip"
          >
            <StepForward className="size-3" />
          </button>
        </div>
      </div>

      {editingClip ? (
        <div className="space-y-3 p-3">
          <p className="font-bangla line-clamp-4 rounded-lg border border-border/60 bg-muted/40 p-2 text-xs leading-5 text-foreground">
            {editingClip.narration || "No narration yet — add it from the prompt cards."}
          </p>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
                Duration
              </span>
              <span className="truncate font-mono text-3xs text-muted-foreground">
                {isEditingSelected ? "selected clip" : "at playhead"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onAdjustDuration(editingClip, -0.5)}
                className="flex size-7 items-center justify-center rounded-md border border-border bg-muted text-foreground transition-colors hover:bg-border"
                title="Shorten clip by 0.5s"
              >
                <Minus className="size-3" />
              </button>
              <div className="flex h-7 flex-1 items-center justify-center rounded-md border border-border bg-surface-subtle font-mono text-xs font-bold text-foreground">
                {(editingClip.duration || 3).toFixed(1)}s
              </div>
              <button
                type="button"
                onClick={() => onAdjustDuration(editingClip, 0.5)}
                className="flex size-7 items-center justify-center rounded-md border border-border bg-muted text-foreground transition-colors hover:bg-border"
                title="Lengthen clip by 0.5s"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>

          <div>
            <span className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
              Camera motion
            </span>
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              {MOTION_PRESETS.map(({ value, label, short, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onUpdateClip(editingClip.id, { motion: value })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-3xs font-medium transition-colors",
                    (editingClip.motion || "zoom-in") === value
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  title={label}
                >
                  <Icon className="size-3.5" />
                  <span className="truncate">{short}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                targetClipForImageRef.current = editingClip.id;
                singleImageInputRef.current?.click();
              }}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-2xs font-semibold text-foreground transition-colors hover:bg-muted"
              title="Attach or replace the image for this clip"
            >
              <ImagePlus className="size-3.5 text-primary" />
              <span>{editingClip.imageUrl ? "Replace image" : "Attach image"}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleFlip(editingClip)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-2xs font-semibold transition-colors",
                editingClip.flipped
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
              title="Mirror the image horizontally"
            >
              <FlipHorizontal className="size-3.5" />
              <span>Flip</span>
            </button>

            <button
              type="button"
              onClick={onSplit}
              className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-2xs font-semibold text-foreground transition-colors hover:bg-muted"
              title="Split the clip under the playhead"
            >
              <Scissors className="size-3.5 text-primary" />
              <span>Split</span>
            </button>

            <button
              type="button"
              onClick={onDuplicate}
              className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-2xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Duplicate this clip right after itself"
            >
              <Copy className="size-3.5" />
              <span>Duplicate</span>
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-2xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Delete this clip"
            >
              <Trash2 className="size-3.5" />
              <span>Delete</span>
            </button>

            {(() => {
              const cfg = getClipSfxConfig(editingClip);
              const preset =
                cfg && cfg.type !== "custom"
                  ? SFX_PRESETS.find((item) => item.type === cfg.type)
                  : null;
              const label =
                !cfg || cfg.type === "none"
                  ? "Add sound effect"
                  : cfg.type === "custom"
                    ? cfg.customName || "Custom SFX"
                    : `${preset?.emoji ?? "🔊"} ${preset?.label ?? "SFX"}`;

              return (
                <button
                  type="button"
                  onClick={() => onOpenSfx(editingClip)}
                  className={cn(
                    "col-span-2 flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-2xs font-semibold transition-colors",
                    cfg
                      ? "border-track-sfx/40 bg-track-sfx-soft text-track-sfx"
                      : "border-dashed border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                  title="Open the SFX transform studio (source, offset, volume, pitch)"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="text-sm leading-none">
                      {cfg && cfg.type !== "custom" ? preset?.emoji : "🔊"}
                    </span>
                    <span className="truncate">{label}</span>
                  </span>
                  <Sliders className="size-3 shrink-0" />
                </button>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 p-4 text-center">
          <Layers className="size-5 text-muted-foreground/60" />
          <p className="text-2xs font-semibold text-foreground">No clip selected</p>
          <p className="text-3xs text-muted-foreground">
            Click a clip in the timeline to edit it.
          </p>
        </div>
      )}
    </div>
  );
}
