"use client";

import * as React from "react";
import {
  Copy,
  FlipHorizontal,
  Gauge,
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

const SPEED_PRESETS = [
  { label: "0.5x", value: 0.5, desc: "Slow" },
  { label: "0.75x", value: 0.75, desc: "Slow" },
  { label: "1.0x", value: 1.0, desc: "Normal" },
  { label: "1.25x", value: 1.25, desc: "Fast" },
  { label: "1.5x", value: 1.5, desc: "Fast" },
  { label: "2.0x", value: 2.0, desc: "Fast" },
] as const;

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
  const clipSpeed = editingClip?.speed ?? 1.0;

  const handleSpeedChange = (newSpeed: number) => {
    if (!editingClip) return;
    const clampedSpeed = Math.max(0.25, Math.min(3.0, Number(newSpeed.toFixed(2))));
    const currentSpeed = editingClip.speed ?? 1.0;
    const base = editingClip.baseDuration ?? (editingClip.duration * currentSpeed);
    const newDur = Number(Math.max(0.5, Math.min(30, base / clampedSpeed)).toFixed(1));
    onUpdateClip(editingClip.id, {
      speed: clampedSpeed,
      baseDuration: Number(base.toFixed(1)),
      duration: newDur,
    });
  };

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

          {/* Speed Controller (Slow-Mo / Fast-Forward) */}
          <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/30 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Gauge className="size-3 text-primary" />
                <span>Clip speed</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-3xs font-bold text-primary">
                  {clipSpeed.toFixed(2)}x
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-3xs font-semibold text-muted-foreground">
                  {clipSpeed < 1 ? "Slow-mo" : clipSpeed > 1 ? "Fast" : "Normal"}
                </span>
              </div>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-1">
              {SPEED_PRESETS.map((preset) => {
                const isActive = Math.abs(clipSpeed - preset.value) < 0.04;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSpeedChange(preset.value)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-md border py-1 text-3xs transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                        : "border-border bg-card text-foreground hover:bg-muted",
                    )}
                    title={`Set clip speed to ${preset.label} (${preset.desc})`}
                  >
                    <span className="font-mono font-semibold">{preset.label}</span>
                    <span
                      className={cn(
                        "text-3xs opacity-80",
                        isActive ? "text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {preset.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Fine speed slider */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-3xs text-muted-foreground">
                <span>0.25x</span>
                <span className="font-mono font-semibold text-foreground">
                  {(editingClip.duration || 3).toFixed(1)}s duration
                </span>
                <span>3.0x</span>
              </div>
              <input
                type="range"
                min="0.25"
                max="3.0"
                step="0.05"
                value={clipSpeed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="h-1.5 w-full cursor-ew-resize rounded-lg bg-muted accent-primary"
                aria-label="Adjust clip playback speed"
              />
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
              title="Split the clip at playhead (S)"
            >
              <Scissors className="size-3.5 text-primary" />
              <span>Split (S)</span>
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
