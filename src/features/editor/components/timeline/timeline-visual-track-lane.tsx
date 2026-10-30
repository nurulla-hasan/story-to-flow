"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import type { MediaAssetItem } from "@/lib/media-storage";
import type { TimelineClip, TimelineTrack, TimelineTransition, TrackId } from "@/types/timeline";
import type { RulerTickMark } from "@/lib/ruler-scale";
import { findAdjacentClipPairs } from "@/lib/transition-helpers";
import { TimelineClipBlock } from "@/features/editor/components/timeline/timeline-clip-block";
import { TimelineTransitionSeam } from "@/features/editor/components/timeline/timeline-transition-seam";

interface TimelineVisualTrackLaneProps {
  track: TimelineTrack;
  trackClips: TimelineClip[];
  visibleStartTime?: number;
  visibleEndTime?: number;
  isHydrated: boolean;
  rulerTicks: RulerTickMark[];
  tracksContentWidth: number;
  assetMap: Map<string, MediaAssetItem>;
  pixelsPerSecond: number;
  transitions: TimelineTransition[];
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  onTrackDrop: (event: React.DragEvent<HTMLDivElement>, trackId: TrackId) => void;
  onSelectClip: (clipId: string | null) => void;
  onSelectTransition: (transitionId: string | null) => void;
  onAddTransition: (fromClipId: string, toClipId: string) => void;
  onMoveDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  onLeftTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  onRightTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
}

/** Renders one visual lane with horizontal viewport virtualization; timeline state and edit operations are supplied by the workspace. */
export const TimelineVisualTrackLane = React.memo(function TimelineVisualTrackLane({
  track, trackClips, visibleStartTime, visibleEndTime, isHydrated, rulerTicks, tracksContentWidth, assetMap, pixelsPerSecond, transitions,
  selectedClipId, selectedTransitionId, onTrackDrop, onSelectClip, onSelectTransition, onAddTransition,
  onMoveDrag, onLeftTrimDrag, onRightTrimDrag,
}: TimelineVisualTrackLaneProps) {
  const isLocked = track.locked;
  const isHidden = !track.visible;
  const adjacentPairs = React.useMemo(() => findAdjacentClipPairs(trackClips), [trackClips]);

  const isVirtual = typeof visibleStartTime === "number" && typeof visibleEndTime === "number";

  const visibleClips = React.useMemo(() => {
    if (!isVirtual || trackClips.length <= 15) return trackClips;
    return trackClips.filter(
      (clip) =>
        clip.id === selectedClipId ||
        (clip.startTime + clip.duration >= visibleStartTime && clip.startTime <= visibleEndTime)
    );
  }, [trackClips, selectedClipId, visibleStartTime, visibleEndTime, isVirtual]);

  const visiblePairs = React.useMemo(() => {
    if (!isVirtual || adjacentPairs.length <= 15) return adjacentPairs;
    return adjacentPairs.filter(
      ({ fromClip, toClip }) =>
        (fromClip.startTime + fromClip.duration >= visibleStartTime && fromClip.startTime <= visibleEndTime) ||
        (toClip.startTime + toClip.duration >= visibleStartTime && toClip.startTime <= visibleEndTime)
    );
  }, [adjacentPairs, visibleStartTime, visibleEndTime, isVirtual]);

  return (
    <div
      onDragOver={(event) => { if (!isLocked) event.preventDefault(); }}
      onDrop={(event) => onTrackDrop(event, track.id)}
      style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
      className={`relative flex h-full min-w-full items-center overflow-visible px-1 ${isLocked ? "bg-muted/20" : ""} ${isHidden ? "opacity-50" : ""}`}
    >
      {rulerTicks.map((tick) => (
        <div key={`grid_${tick.time}`} style={{ left: `${tick.leftPx}px` }} className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/40" />
      ))}
      {!isHydrated || trackClips.length === 0 ? (
        <div className="pointer-events-none flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/10 text-3xs text-muted-foreground">
          {isLocked ? (
            <span className="flex items-center gap-1 text-warning"><Lock className="size-3" /><span>Track is locked.</span></span>
          ) : (
            <span>{track.order === 0 ? "Drop overlay / foreground visual clips here (rendered on top)." : "Drag scene images or videos here, or click '+' in Media Library."}</span>
          )}
        </div>
      ) : (
        <>
          {visibleClips.map((clip) => (
            <TimelineClipBlock
              key={clip.id}
              clip={clip}
              asset={assetMap.get(clip.assetId)}
              pixelsPerSecond={pixelsPerSecond}
              isLocked={isLocked}
              isSelected={clip.id === selectedClipId}
              onSelectClip={onSelectClip}
              onMoveDrag={onMoveDrag}
              onLeftTrimDrag={onLeftTrimDrag}
              onRightTrimDrag={onRightTrimDrag}
            />
          ))}
          {!isLocked && visiblePairs.map(({ fromClip, toClip }) => (
            <TimelineTransitionSeam
              key={`seam_${fromClip.id}_${toClip.id}`}
              fromClip={fromClip}
              toClip={toClip}
              transitions={transitions}
              pixelsPerSecond={pixelsPerSecond}
              selectedClipId={selectedClipId}
              selectedTransitionId={selectedTransitionId}
              selectTransition={onSelectTransition}
              addTransition={onAddTransition}
            />
          ))}
        </>
      )}
    </div>
  );
});
