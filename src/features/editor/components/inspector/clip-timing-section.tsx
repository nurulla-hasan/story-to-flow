"use client";

import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { TimelineClip } from "@/types/timeline";

interface ClipTimingSectionProps {
  selectedClip: TimelineClip;
  isCurrentTrackLocked: boolean;
  handleSetImageDurationPreset: (duration: number) => void;
  handleSliderPointerDown: () => void;
  handleSliderPointerUp: () => void;
  handleTransientDurationChange: (value: number | readonly number[]) => void;
}

/** Displays timeline position and handles the selected clip's duration controls. */
export function ClipTimingSection({
  selectedClip,
  isCurrentTrackLocked,
  handleSetImageDurationPreset,
  handleSliderPointerDown,
  handleSliderPointerUp,
  handleTransientDurationChange,
}: ClipTimingSectionProps) {
  return (
    <>
      {/* Duration Slider & Number Editor */}
      <div className="space-y-1.5 rounded-xl border border-border bg-surface-subtle/70 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Clock className="size-3 text-muted-foreground" />
            <span>Duration</span>
          </span>
          <div className="flex items-center gap-1.5">
            {selectedClip.type === "image" && (
              <div className="flex items-center gap-1">
                <Button
                  variant={
                    Math.abs(selectedClip.duration - 4) < 0.05
                      ? "default"
                      : "outline"
                  }
                  size="xs"
                  disabled={isCurrentTrackLocked}
                  onClick={() => handleSetImageDurationPreset(4)}
                  title="Set duration to 4 seconds"
                >
                  4s
                </Button>
                <Button
                  variant={
                    Math.abs(selectedClip.duration - 5) < 0.05
                      ? "default"
                      : "outline"
                  }
                  size="xs"
                  disabled={isCurrentTrackLocked}
                  onClick={() => handleSetImageDurationPreset(5)}
                  title="Set duration to 5 seconds"
                >
                  5s
                </Button>
              </div>
            )}
            <span className="font-mono text-xs font-semibold text-primary">
              {selectedClip.duration.toFixed(2)}s
            </span>
          </div>
        </div>

        <Slider
          min={0.5}
          max={
            selectedClip.sourceDuration && selectedClip.sourceDuration > 0
              ? Math.max(
                  0.5,
                  (selectedClip.sourceDuration - selectedClip.inPoint) /
                    (selectedClip.speed || 1.0),
                )
              : 30
          }
          step={0.1}
          value={selectedClip.duration}
          disabled={isCurrentTrackLocked}
          onPointerDown={handleSliderPointerDown}
          onPointerUp={handleSliderPointerUp}
          onPointerCancel={handleSliderPointerUp}
          onKeyDown={handleSliderPointerDown}
          onKeyUp={handleSliderPointerUp}
          onValueChange={handleTransientDurationChange}
          aria-label="Clip duration"
          className="w-full"
        />

        <div className="flex items-center justify-between text-3xs text-muted-foreground font-mono">
          <span>0.5s</span>
          <span>
            Max:{" "}
            {selectedClip.sourceDuration && selectedClip.sourceDuration > 0
              ? `${(
                  (selectedClip.sourceDuration - selectedClip.inPoint) /
                  (selectedClip.speed || 1.0)
                ).toFixed(1)}s`
              : "30.0s"}
          </span>
        </div>
      </div>
    </>
  );
}
