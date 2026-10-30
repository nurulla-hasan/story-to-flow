"use client";

import * as React from "react";
import type { TimelineClip, TimelineTrack } from "@/types/timeline";
import { isTrackLocked, isVisualTrack } from "@/types/timeline";
import {
  calculateLeftTrimWithOverlap,
  calculateRightTrim,
  applyRippleExtend,
} from "@/lib/timeline-trim";
import { reorderClipOnTrack } from "@/lib/timeline-reorder";

interface UseTimelineClipGesturesOptions {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  playhead: number;
  pixelsPerSecond: number;
  snapEnabled: boolean;
  selectClip: (clipId: string | null) => void;
  setClipsTransient: (clips: TimelineClip[]) => void;
  commitClipGesture: (originalClips: TimelineClip[], finalClips: TimelineClip[]) => void;
  cancelClipGesture: (originalClips: TimelineClip[]) => void;
  setActiveSnapGuide: React.Dispatch<React.SetStateAction<number | null>>;
  setDragInsertTime: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Owns pointer-gesture lifecycles for moving and trimming timeline clips.
 * TimelineDock supplies project actions and UI-only guide state; the gesture
 * hook calculates transient proposals and commits/cancels exactly once.
 */
export function useTimelineClipGestures({
  clips,
  tracks,
  playhead,
  pixelsPerSecond,
  snapEnabled,
  selectClip,
  setClipsTransient,
  commitClipGesture,
  cancelClipGesture,
  setActiveSnapGuide,
  setDragInsertTime,
}: UseTimelineClipGesturesOptions) {
  const getSnapPoints = React.useCallback(
    (excludeClipId: string): number[] => {
      const points = [0, playhead];
      clips.forEach((clip) => {
        if (clip.id !== excludeClipId) {
          points.push(clip.startTime);
          points.push(clip.startTime + clip.duration);
        }
      });
      return points;
    },
    [clips, playhead],
  );

  const startMoveDrag = React.useCallback(
    (e: React.PointerEvent, clip: TimelineClip) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      selectClip(clip.id);
      if (isTrackLocked(clip.trackId, tracks)) return;

      const startX = e.clientX;
      const initialClips: TimelineClip[] = JSON.parse(JSON.stringify(clips));
      const initialStart = clip.startTime;
      const snapThresholdSec = 10 / pixelsPerSecond;
      const snapPoints = getSnapPoints(clip.id);
      const isVisualClip = isVisualTrack(clip.trackId, tracks);
      let latestClips = initialClips;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        let rawStart = Math.max(0, initialStart + deltaX / pixelsPerSecond);
        let snapped = false;

        if (snapEnabled && !moveEvent.shiftKey) {
          const rawEnd = rawStart + clip.duration;
          for (const point of snapPoints) {
            if (Math.abs(rawStart - point) <= snapThresholdSec) {
              rawStart = point;
              setActiveSnapGuide(point);
              snapped = true;
              break;
            }
            if (Math.abs(rawEnd - point) <= snapThresholdSec) {
              rawStart = Math.max(0, point - clip.duration);
              setActiveSnapGuide(point);
              snapped = true;
              break;
            }
          }
        }

        if (!snapped) setActiveSnapGuide(null);

        if (isVisualClip) {
          const result = reorderClipOnTrack(clip, rawStart, initialClips, tracks);
          latestClips = result.clips;
          setDragInsertTime(result.insertionTime);
        } else {
          const safeStart = parseFloat(Math.max(0, rawStart).toFixed(3));
          latestClips = initialClips.map((item) =>
            item.id === clip.id ? { ...item, startTime: safeStart } : item
          );
          setDragInsertTime(safeStart);
        }

        setClipsTransient(latestClips);
      };

      const cleanup = () => {
        setActiveSnapGuide(null);
        setDragInsertTime(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        window.removeEventListener("keydown", onKeyDown);
      };

      const onPointerUp = () => {
        cleanup();
        commitClipGesture(initialClips, latestClips);
      };

      const onPointerCancel = () => {
        cleanup();
        cancelClipGesture(initialClips);
      };

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") {
          cleanup();
          cancelClipGesture(initialClips);
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("keydown", onKeyDown);
    },
    [
      clips,
      tracks,
      pixelsPerSecond,
      getSnapPoints,
      snapEnabled,
      selectClip,
      setActiveSnapGuide,
      setDragInsertTime,
      setClipsTransient,
      commitClipGesture,
      cancelClipGesture,
    ],
  );

  const startLeftTrimDrag = React.useCallback(
    (e: React.PointerEvent, clip: TimelineClip) => {
      e.stopPropagation();
      selectClip(clip.id);
      if (isTrackLocked(clip.trackId, tracks)) return;

      const startX = e.clientX;
      const initialClips: TimelineClip[] = JSON.parse(JSON.stringify(clips));
      const initialStartTime = clip.startTime;
      const snapThresholdSec = 10 / pixelsPerSecond;
      const snapPoints = getSnapPoints(clip.id);
      let latestClips = initialClips;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        let deltaSec = deltaX / pixelsPerSecond;
        let snapped = false;

        if (snapEnabled && !moveEvent.shiftKey) {
          const proposedStart = initialStartTime + deltaSec;
          for (const point of snapPoints) {
            if (Math.abs(proposedStart - point) <= snapThresholdSec) {
              deltaSec = point - initialStartTime;
              setActiveSnapGuide(point);
              snapped = true;
              break;
            }
          }
        }

        if (!snapped) setActiveSnapGuide(null);

        const trimResult = calculateLeftTrimWithOverlap(clip, deltaSec, initialClips, 0.5, tracks);
        latestClips = initialClips.map((item) =>
          item.id === clip.id
            ? {
                ...item,
                startTime: trimResult.startTime,
                duration: trimResult.duration,
                inPoint: trimResult.inPoint,
                outPoint: trimResult.outPoint,
              }
            : item
        );
        setClipsTransient(latestClips);
      };

      const cleanup = () => {
        setActiveSnapGuide(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        window.removeEventListener("keydown", onKeyDown);
      };

      const onPointerUp = () => {
        cleanup();
        commitClipGesture(initialClips, latestClips);
      };

      const onPointerCancel = () => {
        cleanup();
        cancelClipGesture(initialClips);
      };

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") {
          cleanup();
          cancelClipGesture(initialClips);
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("keydown", onKeyDown);
    },
    [
      clips,
      tracks,
      pixelsPerSecond,
      getSnapPoints,
      snapEnabled,
      selectClip,
      setActiveSnapGuide,
      setClipsTransient,
      commitClipGesture,
      cancelClipGesture,
    ],
  );

  const startRightTrimDrag = React.useCallback(
    (e: React.PointerEvent, clip: TimelineClip) => {
      e.stopPropagation();
      selectClip(clip.id);
      if (isTrackLocked(clip.trackId, tracks)) return;

      const startX = e.clientX;
      const initialClips: TimelineClip[] = JSON.parse(JSON.stringify(clips));
      const initialEndTime = clip.startTime + clip.duration;
      const snapThresholdSec = 10 / pixelsPerSecond;
      const snapPoints = getSnapPoints(clip.id);
      let latestClips = initialClips;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        let deltaSec = deltaX / pixelsPerSecond;
        let snapped = false;

        if (snapEnabled && !moveEvent.shiftKey) {
          const proposedEnd = initialEndTime + deltaSec;
          for (const point of snapPoints) {
            if (point > clip.startTime && Math.abs(proposedEnd - point) <= snapThresholdSec) {
              deltaSec = point - initialEndTime;
              setActiveSnapGuide(point);
              snapped = true;
              break;
            }
          }
        }

        if (!snapped) setActiveSnapGuide(null);

        const trimResult = calculateRightTrim(clip, deltaSec);
        latestClips = applyRippleExtend(clip.id, trimResult.duration, initialClips, tracks);
        setClipsTransient(latestClips);
      };

      const cleanup = () => {
        setActiveSnapGuide(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        window.removeEventListener("keydown", onKeyDown);
      };

      const onPointerUp = () => {
        cleanup();
        commitClipGesture(initialClips, latestClips);
      };

      const onPointerCancel = () => {
        cleanup();
        cancelClipGesture(initialClips);
      };

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") {
          cleanup();
          cancelClipGesture(initialClips);
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("keydown", onKeyDown);
    },
    [
      clips,
      tracks,
      pixelsPerSecond,
      getSnapPoints,
      snapEnabled,
      selectClip,
      setActiveSnapGuide,
      setClipsTransient,
      commitClipGesture,
      cancelClipGesture,
    ],
  );

  return { startMoveDrag, startLeftTrimDrag, startRightTrimDrag };
}
