"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  CopyCheck,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { TimelineClip, TimelineTrack } from "@/types/timeline";
import { isTrackLocked, isVisualTrack } from "@/types/timeline";
import {
  DEFAULT_ZOOM_EFFECT_AMOUNT,
  MAX_ZOOM_EFFECT_AMOUNT,
  MIN_ZOOM_EFFECT_AMOUNT,
  sanitizeZoomEffect,
  type ClipZoomEffect,
  type ZoomEffectType,
} from "@/lib/zoom-effect";

interface ClipMotionSectionProps {
  clip: TimelineClip;
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  applyMotionToAllClips: (effect?: Partial<ClipZoomEffect> | null) => {
    success: boolean;
    message: string;
    count: number;
  };
  handleSliderPointerDown: () => void;
  handleSliderPointerUp: () => void;
  handleTransientZoomAmountChange: (value: number | readonly number[]) => void;
}

export function ClipMotionSection({
  clip,
  clips,
  tracks,
  onUpdateClip,
  applyMotionToAllClips,
  handleSliderPointerDown,
  handleSliderPointerUp,
  handleTransientZoomAmountChange,
}: ClipMotionSectionProps) {
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const imageClipsCount = React.useMemo(
    () => clips.filter((item) =>
      isVisualTrack(item.trackId, tracks) &&
      item.type === "image" &&
      !isTrackLocked(item.trackId, tracks)
    ).length,
    [clips, tracks],
  );

  const handleSetZoomEffect = (type: "off" | ZoomEffectType) => {
    if (isTrackLocked(clip.trackId, tracks)) return;
    if (type === "off") {
      onUpdateClip(clip.id, { zoomEffect: undefined });
      return;
    }

    const current = sanitizeZoomEffect(clip.zoomEffect);
    onUpdateClip(clip.id, {
      zoomEffect: {
        type,
        amount: current?.amount ?? DEFAULT_ZOOM_EFFECT_AMOUNT,
      },
    });
  };

  const handleApplyMotionToAll = () => {
    if (isTrackLocked(clip.trackId, tracks)) return;
    const effect = sanitizeZoomEffect(clip.zoomEffect);
    if (!effect) return;

    const result = applyMotionToAllClips(effect);
    setFeedback(result.message);
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <>
            {/* Scene Motion & Zoom (Ken Burns) — image scenes only */}
            {clip.type === "image" && (() => {
              const effect = sanitizeZoomEffect(clip.zoomEffect);
              const amountPct = Math.round(
                (effect?.amount ?? DEFAULT_ZOOM_EFFECT_AMOUNT) * 100
              );
              const zoomOptions: Array<{
                value: "off" | "zoom-in" | "zoom-out";
                label: string;
              }> = [
                { value: "off", label: "Off" },
                { value: "zoom-in", label: "Zoom In" },
                { value: "zoom-out", label: "Zoom Out" },
              ];
              const panOptions: Array<{
                value: ZoomEffectType;
                label: string;
                title: string;
              }> = [
                { value: "pan-left", label: "Left", title: "Pan Left" },
                { value: "pan-right", label: "Right", title: "Pan Right" },
                { value: "pan-up", label: "Up", title: "Pan Up" },
                { value: "pan-down", label: "Down", title: "Pan Down" },
              ];

              const getMotionDescription = () => {
                if (!effect) return "";
                switch (effect.type) {
                  case "zoom-in":
                    return `Zooms in ${amountPct}% across ${clip.duration.toFixed(1)}s`;
                  case "zoom-out":
                    return `Zooms out ${amountPct}% across ${clip.duration.toFixed(1)}s`;
                  case "pan-left":
                    return `Pans left ${amountPct}% across ${clip.duration.toFixed(1)}s`;
                  case "pan-right":
                    return `Pans right ${amountPct}% across ${clip.duration.toFixed(1)}s`;
                  case "pan-up":
                    return `Pans up ${amountPct}% across ${clip.duration.toFixed(1)}s`;
                  case "pan-down":
                    return `Pans down ${amountPct}% across ${clip.duration.toFixed(1)}s`;
                }
              };

              return (
                <div className="space-y-2 rounded-xl border border-border bg-surface-subtle/70 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <ZoomIn className="size-3 text-primary" />
                      <span>Scene Motion</span>
                    </span>
                    {effect && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          onUpdateClip(clip.id, { zoomEffect: undefined })
                        }
                        title="Remove motion effect from this scene"
                      >
                        <RotateCcw className="size-2.5" />
                        <span>Remove</span>
                      </Button>
                    )}
                  </div>

                  {/* Zoom Options */}
                  <div className="grid grid-cols-3 gap-1">
                    {zoomOptions.map((option) => {
                      const isActive =
                        option.value === "off"
                          ? !effect
                          : effect?.type === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSetZoomEffect(option.value)}
                          className={`py-1 text-2xs rounded-md border transition-colors cursor-pointer ${
                            isActive
                              ? "border-primary bg-primary/10 text-primary font-bold"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {option.value === "zoom-in" ? (
                            <span className="flex items-center justify-center gap-1">
                              <ZoomIn className="size-3" />
                              {option.label}
                            </span>
                          ) : option.value === "zoom-out" ? (
                            <span className="flex items-center justify-center gap-1">
                              <ZoomOut className="size-3" />
                              {option.label}
                            </span>
                          ) : (
                            option.label
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Pan & Drift Options */}
                  <div className="space-y-1">
                    <span className="text-3xs text-muted-foreground font-medium">Pan &amp; Drift</span>
                    <div className="grid grid-cols-4 gap-1">
                      {panOptions.map((option) => {
                        const isActive = effect?.type === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSetZoomEffect(option.value)}
                            title={option.title}
                            className={`py-1 text-2xs rounded-md border transition-colors cursor-pointer ${
                              isActive
                                ? "border-primary bg-primary/10 text-primary font-bold"
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <span className="flex items-center justify-center gap-1">
                              {option.value === "pan-left" ? (
                                <ArrowLeft className="size-3" />
                              ) : option.value === "pan-right" ? (
                                <ArrowRight className="size-3" />
                              ) : option.value === "pan-up" ? (
                                <ArrowUp className="size-3" />
                              ) : (
                                <ArrowDown className="size-3" />
                              )}
                              <span>{option.label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {effect && (
                    <div className="space-y-1.5 pt-1">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-3xs">
                          <span className="text-muted-foreground">Strength</span>
                          <span className="font-mono font-semibold text-primary">
                            {amountPct}%
                          </span>
                        </div>
                        <Slider
                          min={MIN_ZOOM_EFFECT_AMOUNT * 100}
                          max={MAX_ZOOM_EFFECT_AMOUNT * 100}
                          step={1}
                          value={amountPct}
                          onPointerDown={handleSliderPointerDown}
                          onPointerUp={handleSliderPointerUp}
                          onPointerCancel={handleSliderPointerUp}
                          onKeyDown={handleSliderPointerDown}
                          onKeyUp={handleSliderPointerUp}
                          onValueChange={handleTransientZoomAmountChange}
                          aria-label="Scene motion strength"
                          className="w-full"
                        />
                        <p className="text-3xs text-muted-foreground">
                          {getMotionDescription()}
                        </p>
                      </div>

                      {/* Apply to All Clips Button */}
                      <div className="space-y-1.5 pt-1">
                        <Button
                          variant="outline"
                          size="default"
                          onClick={handleApplyMotionToAll}
                          disabled={imageClipsCount <= 1}
                          className="w-full"
                          title={
                            imageClipsCount <= 1
                              ? "Only 1 image scene on timeline"
                              : `Apply this motion (${amountPct}%) to all ${imageClipsCount} image scenes`
                          }
                        >
                          <CopyCheck className="size-3.5" />
                          <span>Apply to All Scenes ({imageClipsCount})</span>
                        </Button>

                        {feedback && (
                          <div className="flex items-start gap-1.5 rounded-lg border border-primary/20 bg-primary/10 p-2 text-3xs font-medium leading-relaxed text-primary animate-in fade-in">
                            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                            <span>{feedback}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
    </>
  );
}
