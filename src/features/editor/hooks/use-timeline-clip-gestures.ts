"use client";

import * as React from "react";
import type { TimelineClip, TimelineTrack } from "@/types/timeline";
import { isTrackLocked, isVisualTrack } from "@/types/timeline";
import { calculateLeftTrimWithOverlap, calculateRightTrim, applyRippleExtend } from "@/lib/timeline-trim";
import { reorderClipOnTrack } from "@/lib/timeline-reorder";

interface TimelineClipGestureOptions {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  playhead: number | (() => number);
  pxPerSec: number;
  snapEnabled: boolean;
  selectClip: (clipId: string | null) => void;
  setClipsTransient: (clips: TimelineClip[]) => void;
  commitClipGesture: (originalClips: TimelineClip[], finalClips: TimelineClip[]) => void;
  cancelClipGesture: (originalClips: TimelineClip[]) => void;
  setActiveSnapGuide: (time: number | null) => void;
  setDragInsertTime: (time: number | null) => void;
}

/** Fast clone that avoids JSON.parse(JSON.stringify) overhead on thousands of clips */
function cloneClips(source: readonly TimelineClip[]): TimelineClip[] {
  const len = source.length;
  const result = new Array<TimelineClip>(len);
  for (let i = 0; i < len; i++) {
    const c = source[i];
    result[i] = {
      ...c,
      zoomEffect: c.zoomEffect ? { ...c.zoomEffect } : undefined,
      transform: c.transform ? { ...c.transform } : undefined,
    };
  }
  return result;
}

/** Owns timeline pointer gestures; UI components only bind these handlers to clip surfaces. */
export function useTimelineClipGestures({
  clips, tracks, playhead, pxPerSec, snapEnabled, selectClip, setClipsTransient,
  commitClipGesture, cancelClipGesture, setActiveSnapGuide, setDragInsertTime,
}: TimelineClipGestureOptions) {
  const getPlayheadTime = React.useCallback(() => {
    return typeof playhead === "function" ? playhead() : playhead;
  }, [playhead]);

  const getSnapPoints = React.useCallback((excludeClipId: string): number[] => {
    const points = [0, getPlayheadTime()];
    for (const clip of clips) {
      if (clip.id === excludeClipId) continue;
      points.push(clip.startTime, clip.startTime + clip.duration);
    }
    return points;
  }, [clips, getPlayheadTime]);

  const startMoveDrag = React.useCallback((event: React.PointerEvent, clip: TimelineClip) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    selectClip(clip.id);
    if (isTrackLocked(clip.trackId, tracks)) return;
    const startX = event.clientX;
    const initialClips = cloneClips(clips);
    const initialStart = clip.startTime;
    const snapThresholdSec = 10 / pxPerSec;
    const snapPoints = getSnapPoints(clip.id);
    const isVisualClip = isVisualTrack(clip.trackId, tracks);
    let latestClips = initialClips;
    let pendingMoveEvent: PointerEvent | null = null;
    let rafId: number | null = null;

    const processMove = () => {
      rafId = null;
      if (!pendingMoveEvent) return;
      const moveEvent = pendingMoveEvent;
      pendingMoveEvent = null;

      const deltaX = moveEvent.clientX - startX;
      let rawStart = Math.max(0, initialStart + deltaX / pxPerSec);
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
        latestClips = initialClips.map((item) => item.id === clip.id ? { ...item, startTime: safeStart } : item);
        setDragInsertTime(safeStart);
      }
      setClipsTransient(latestClips);
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      pendingMoveEvent = moveEvent;
      if (rafId === null) {
        rafId = requestAnimationFrame(processMove);
      }
    };

    const cleanup = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingMoveEvent = null;
      setActiveSnapGuide(null);
      setDragInsertTime(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
    };

    const onPointerUp = () => {
      if (pendingMoveEvent !== null) {
        processMove();
      }
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
  }, [clips, tracks, pxPerSec, snapEnabled, selectClip, getSnapPoints, setActiveSnapGuide, setDragInsertTime, setClipsTransient, commitClipGesture, cancelClipGesture]);

  const startLeftTrimDrag = React.useCallback((event: React.PointerEvent, clip: TimelineClip) => {
    event.stopPropagation();
    selectClip(clip.id);
    if (isTrackLocked(clip.trackId, tracks)) return;
    const startX = event.clientX;
    const initialClips = cloneClips(clips);
    const initialStartTime = clip.startTime;
    const snapThresholdSec = 10 / pxPerSec;
    const snapPoints = getSnapPoints(clip.id);
    let latestClips = initialClips;
    let pendingMoveEvent: PointerEvent | null = null;
    let rafId: number | null = null;

    const processMove = () => {
      rafId = null;
      if (!pendingMoveEvent) return;
      const moveEvent = pendingMoveEvent;
      pendingMoveEvent = null;

      const deltaX = moveEvent.clientX - startX;
      let deltaSec = deltaX / pxPerSec;
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
      latestClips = initialClips.map((item) => item.id === clip.id ? {
        ...item, startTime: trimResult.startTime, duration: trimResult.duration,
        inPoint: trimResult.inPoint, outPoint: trimResult.outPoint,
      } : item);
      setClipsTransient(latestClips);
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      pendingMoveEvent = moveEvent;
      if (rafId === null) {
        rafId = requestAnimationFrame(processMove);
      }
    };

    const cleanup = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingMoveEvent = null;
      setActiveSnapGuide(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
    };

    const onPointerUp = () => {
      if (pendingMoveEvent !== null) {
        processMove();
      }
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
  }, [clips, tracks, pxPerSec, snapEnabled, selectClip, getSnapPoints, setActiveSnapGuide, setClipsTransient, commitClipGesture, cancelClipGesture]);

  const startRightTrimDrag = React.useCallback((event: React.PointerEvent, clip: TimelineClip) => {
    event.stopPropagation();
    selectClip(clip.id);
    if (isTrackLocked(clip.trackId, tracks)) return;
    const startX = event.clientX;
    const initialClips = cloneClips(clips);
    const initialEndTime = clip.startTime + clip.duration;
    const snapThresholdSec = 10 / pxPerSec;
    const snapPoints = getSnapPoints(clip.id);
    let latestClips = initialClips;
    let pendingMoveEvent: PointerEvent | null = null;
    let rafId: number | null = null;

    const processMove = () => {
      rafId = null;
      if (!pendingMoveEvent) return;
      const moveEvent = pendingMoveEvent;
      pendingMoveEvent = null;

      const deltaX = moveEvent.clientX - startX;
      let deltaSec = deltaX / pxPerSec;
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

    const onPointerMove = (moveEvent: PointerEvent) => {
      pendingMoveEvent = moveEvent;
      if (rafId === null) {
        rafId = requestAnimationFrame(processMove);
      }
    };

    const cleanup = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingMoveEvent = null;
      setActiveSnapGuide(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
    };

    const onPointerUp = () => {
      if (pendingMoveEvent !== null) {
        processMove();
      }
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
  }, [clips, tracks, pxPerSec, snapEnabled, selectClip, getSnapPoints, setActiveSnapGuide, setClipsTransient, commitClipGesture, cancelClipGesture]);

  return { startMoveDrag, startLeftTrimDrag, startRightTrimDrag };
}
