"use client";

import { Gauge } from "lucide-react";
import type { TimelineClip } from "@/types/timeline";
import { CLIP_SPEED_PRESETS, buildClipSpeedUpdate } from "@/lib/clip-speed";
import { isAudioTrack, isVisualTrack, type TimelineTrack } from "@/types/timeline";

interface ClipSpeedSectionProps {
  selectedClip: TimelineClip;
  tracks?: TimelineTrack[];
  isCurrentTrackLocked: boolean;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
}

/** Exposes the shared, source-bounded playback speed control for visual and audio clips. */
export function ClipSpeedSection({ selectedClip, isCurrentTrackLocked, updateClip, tracks = [] }: ClipSpeedSectionProps) {
  const isAudioClip = isAudioTrack(selectedClip.trackId, tracks);

  return (
    <>
      {(isVisualTrack(selectedClip.trackId, tracks) || isAudioClip) && (
        <div className="space-y-1.5 rounded-xl border border-border bg-surface-subtle/70 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Gauge className="size-3 text-muted-foreground" />
              <span>{isAudioClip ? "Audio Playback Speed" : "Speed"}</span>
            </span>
            <span className="font-mono text-2xs text-muted-foreground">
              {(selectedClip.speed || 1).toFixed(1)}x
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 text-center">
            {CLIP_SPEED_PRESETS.map((speed) => {
              const isCurrent = (selectedClip.speed || 1) === speed;
              return (
                <button
                  key={speed}
                  type="button"
                  disabled={isCurrentTrackLocked || isCurrent}
                  onClick={() =>
                    updateClip(selectedClip.id, buildClipSpeedUpdate(selectedClip, speed))
                  }
                  className={`cursor-pointer rounded-lg border py-1 font-mono text-3xs font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                    isCurrent
                      ? "border-primary/60 bg-primary/10 text-primary ring-1 ring-primary/40"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {speed.toFixed(1)}x
                </button>
              );
            })}
          </div>

          {isAudioClip && (
            <p className="text-3xs leading-relaxed text-muted-foreground">
              Faster or slower playback also changes how much of the source audio fits in this clip.
            </p>
          )}
        </div>
      )}
    </>
  );
}
