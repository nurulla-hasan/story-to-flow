"use client";

import * as React from "react";
import { Lock, Plus, Video, VolumeX } from "lucide-react";
import type { TimelineClip, TimelineTrack, TrackId, TimelineTransition, TransitionType } from "@/types/timeline";
import type { MediaAssetItem } from "@/lib/media-storage";
import type { RulerTickMark } from "@/lib/ruler-scale";
import { findAdjacentClipPairs } from "@/lib/transition-helpers";
import { getClipLod, isTightSeam } from "@/lib/timeline-lod";

interface TimelineVisualTrackLaneProps {
  track: TimelineTrack;
  trackClips: TimelineClip[];
  tracksContentWidth: number;
  isHydrated: boolean;
  rulerTicks: RulerTickMark[];
  pxPerSec: number;
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  transitions: TimelineTransition[];
  assetMap: ReadonlyMap<string, MediaAssetItem>;
  handleTrackDrop: (event: React.DragEvent, trackId: TrackId) => void;
  selectClip: (clipId: string | null) => void;
  selectTransition: (transitionId: string | null) => void;
  addTransition: (fromClipId: string, toClipId: string, type?: TransitionType, duration?: number) => void;
  startMoveDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  startLeftTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  startRightTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
}

export function TimelineVisualTrackLane({
  track,
  trackClips,
  tracksContentWidth,
  isHydrated,
  rulerTicks,
  pxPerSec,
  selectedClipId,
  selectedTransitionId,
  transitions,
  assetMap,
  handleTrackDrop,
  selectClip,
  selectTransition,
  addTransition,
  startMoveDrag,
  startLeftTrimDrag,
  startRightTrimDrag,
}: TimelineVisualTrackLaneProps) {
    const adjacentPairs = findAdjacentClipPairs(trackClips);
    const isLocked = track.locked;
    const isHidden = !track.visible;

    return (
      <div
        onDragOver={(e) => {
          if (!isLocked) e.preventDefault();
        }}
        onDrop={(e) => handleTrackDrop(e, track.id)}
        style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
        className={`relative flex h-full min-w-full items-center overflow-visible px-1 ${
          isLocked ? "bg-muted/20" : ""
        } ${isHidden ? "opacity-50" : ""}`}
      >
        {/* Full-width vertical grid lines across the track lane */}
        {rulerTicks.map((tick) => (
          <div
            key={`grid_${tick.time}`}
            style={{ left: `${tick.leftPx}px` }}
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/40"
          />
        ))}

        {!isHydrated || trackClips.length === 0 ? (
          <div className="pointer-events-none flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/10 text-3xs text-muted-foreground">
            {isLocked ? (
              <span className="flex items-center gap-1 text-warning">
                <Lock className="size-3" />
                <span>Track is locked.</span>
              </span>
            ) : (
              <span>
                {track.order === 0
                  ? "Drop overlay / foreground visual clips here (rendered on top)."
                  : "Drag scene images or videos here, or click '+' in Media Library."}
              </span>
            )}
          </div>
        ) : (
          <>
            {/* Visual Clips on Track with Dual-Edge Trim Handles */}
            {trackClips.map((clip) => {
              const isSelected = clip.id === selectedClipId;
              const leftPos = clip.startTime * pxPerSec;
              const widthPx = Math.max(4, clip.duration * pxPerSec);
              const asset = assetMap.get(clip.assetId);
              const lod = getClipLod(widthPx);

              return (
                <div
                  key={clip.id}
                  data-clip-id={clip.id}
                  data-testid="timeline-clip"
                  style={{
                    left: `${leftPos}px`,
                    width: `${widthPx}px`,
                  }}
                  onPointerDown={(e) => {
                    if (!isLocked) startMoveDrag(e, clip);
                    else selectClip(clip.id);
                  }}
                  className={`group absolute flex h-9 items-center justify-between overflow-hidden rounded-lg border px-2 shadow-xs transition-[box-shadow,background-color,border-color] select-none ${
                    isLocked ? "cursor-not-allowed opacity-90" : "cursor-grab active:cursor-grabbing"
                  } ${
                    isSelected
                      ? "z-10 border-primary bg-primary/15 ring-2 ring-primary/60 shadow-md"
                      : "border-track-video/40 bg-track-video-soft hover:border-track-video"
                  }`}
                >
                  {/* Left-edge trim handle (in-point & anchored right edge) */}
                  {!isLocked && (
                    <div
                      onPointerDown={(e) => startLeftTrimDrag(e, clip)}
                      className="group/leftHandle absolute top-0 bottom-0 left-0 z-20 flex w-2 items-center justify-center rounded-l-lg bg-primary/25 transition-all hover:w-3 hover:bg-primary cursor-ew-resize"
                      title="Drag to trim start (in-point)"
                    >
                      <div className="pointer-events-none h-3 w-0.5 rounded-full bg-primary/70 group-hover/leftHandle:bg-primary-foreground" />
                    </div>
                  )}

                  {/* Clip info & thumbnail */}
                  <div className="pointer-events-none flex min-w-0 items-center gap-1.5 px-1">
                    {lod.thumbnail &&
                      (asset?.thumbnailUrl || asset?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.thumbnailUrl || asset.url}
                          alt={clip.name}
                          className="size-6 shrink-0 rounded object-cover ring-1 ring-border"
                        />
                      ) : (
                        <Video className="size-3 shrink-0 text-track-video" />
                      ))}
                    {lod.name && (
                      <span className="truncate text-3xs font-semibold text-foreground">
                        {clip.name}
                      </span>
                    )}
                    {clip.volume === 0 && (
                      <span title="Scene audio muted" className="shrink-0">
                        <VolumeX className="size-2.5 text-destructive" />
                      </span>
                    )}
                  </div>

                  {lod.duration && (
                    <span className="pointer-events-none shrink-0 pl-1 pr-1 font-mono text-3xs tabular-nums text-muted-foreground">
                      {clip.duration.toFixed(1)}s
                    </span>
                  )}

                  {/* Right-edge trim handle (duration & anchored start time) */}
                  {!isLocked && (
                    <div
                      onPointerDown={(e) => startRightTrimDrag(e, clip)}
                      className="group/rightHandle absolute top-0 right-0 bottom-0 z-20 flex w-2 items-center justify-center rounded-r-lg bg-primary/25 transition-all hover:w-3 hover:bg-primary cursor-ew-resize"
                      title="Drag to trim end (duration)"
                    >
                      <div className="pointer-events-none h-3 w-0.5 rounded-full bg-primary/70 group-hover/rightHandle:bg-primary-foreground" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Transition Seam Indicators Between Adjacent Clips */}
            {!isLocked && adjacentPairs.map(({ fromClip, toClip }) => {
              const cutPx = toClip.startTime * pxPerSec;
              const existingTrans = transitions.find(
                (t) =>
                  (t.fromClipId === fromClip.id && t.toClipId === toClip.id) ||
                  (t.fromClipId === toClip.id && t.toClipId === fromClip.id)
              );
              const isSelected = existingTrans && existingTrans.id === selectedTransitionId;
              const isAdjacentSelected =
                fromClip.id === selectedClipId || toClip.id === selectedClipId;
              const tightSeam = isTightSeam(
                fromClip.duration * pxPerSec,
                toClip.duration * pxPerSec
              );

              // At low zoom a 20px badge covers several clips at once. Keep only a
              // hairline marker for existing transitions, and hide "add" affordances
              // unless one of the neighbouring clips is selected.
              if (tightSeam) {
                if (!existingTrans && !isAdjacentSelected) return null;
                return (
                  <div
                    key={`seam_${fromClip.id}_${toClip.id}`}
                    style={{
                      left: `${cutPx}px`,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                    }}
                    className="absolute z-30 flex items-center justify-center"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (existingTrans) selectTransition(existingTrans.id);
                        else addTransition(fromClip.id, toClip.id);
                      }}
                      className={`flex cursor-pointer items-center justify-center rounded-full transition-all hover:scale-125 ${
                        existingTrans
                          ? "size-2.5 bg-primary shadow-xs ring-2 ring-background"
                          : "size-3.5 border border-primary/50 bg-card text-primary shadow-xs"
                      }`}
                      title={
                        existingTrans
                          ? `Transition: ${existingTrans.type} (${existingTrans.duration.toFixed(2)}s) — Click to edit or remove`
                          : `Add visual transition between "${fromClip.name}" and "${toClip.name}"`
                      }
                      aria-label={
                        existingTrans
                          ? `Transition: ${existingTrans.type}`
                          : "Add transition"
                      }
                    >
                      {!existingTrans && <Plus className="size-2" />}
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={`seam_${fromClip.id}_${toClip.id}`}
                  style={{
                    left: `${cutPx}px`,
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                  className="absolute z-30 flex items-center justify-center pointer-events-auto"
                >
                  {existingTrans ? (
                    /* Active Transition Indicator Button (CapCut style 20x20) */
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectTransition(existingTrans.id);
                      }}
                      className={`size-5 rounded-md flex items-center justify-center transition-all duration-150 cursor-pointer shadow-xs ${
                        isSelected
                          ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background scale-110"
                          : "bg-primary/90 text-primary-foreground border border-primary hover:bg-primary hover:scale-110"
                      }`}
                      title={`Transition: ${existingTrans.type} (${existingTrans.duration.toFixed(2)}s) — Click to edit or remove`}
                      aria-label={`Transition: ${existingTrans.type}`}
                    >
                      {/* Bowtie / Hourglass Transition Icon matching CapCut Web */}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 5.3c0-1.37 1.66-2.06 2.63-1.09l4.95 4.95-1.41 1.42L5 6.41v11.17L10.59 12l1.41-1.41 6.37-6.37c.97-.97 2.63-.29 2.63 1.09v13.39c0 1.37-1.66 2.06-2.63 1.09l-4.95-4.95 1.41-1.42L19 17.59V6.41L13.41 12l-1.41 1.41-6.37 6.37c-.97.97-2.63.29-2.63-1.09V5.3Z" />
                      </svg>
                    </button>
                  ) : (
                    /* Add Transition Seam Button (CapCut style 20x20) */
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addTransition(fromClip.id, toClip.id);
                      }}
                      className="group/seam size-5 rounded-md bg-card border border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center opacity-90 hover:opacity-100 hover:scale-110 transition-all duration-150 cursor-pointer shadow-xs"
                      title={`Add visual transition between "${fromClip.name}" and "${toClip.name}"`}
                      aria-label="Add transition"
                    >
                      <Plus className="size-3 group-hover/seam:scale-110 transition-transform" />
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
}
