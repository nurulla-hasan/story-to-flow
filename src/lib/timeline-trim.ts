import type { TimelineClip } from "@/types/timeline";

export const MIN_CLIP_DURATION = 0.5; // 500ms minimum clip duration

export interface TrimResult {
  startTime: number;
  duration: number;
  inPoint: number;
  outPoint: number;
}

/**
 * Calculate left-edge trimming for a clip while strictly anchoring the timeline right edge.
 *
 * For video/audio:
 *   newStartTime = originalStartTime + deltaSeconds
 *   newInPoint = originalInPoint + deltaSeconds
 *   newDuration = originalDuration - deltaSeconds
 *   rightEdge = newStartTime + newDuration = originalStartTime + originalDuration (Anchored)
 *   outPoint = originalOutPoint (Anchored)
 *
 * Clamps deltaSeconds so:
 *   - newStartTime >= 0
 *   - newInPoint >= 0
 *   - newDuration >= minDuration
 */
export function calculateLeftTrim(
  clip: TimelineClip,
  deltaSeconds: number,
  minDuration: number = MIN_CLIP_DURATION
): TrimResult {
  const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
  const originalStartTime = clip.startTime;
  const originalDuration = clip.duration;
  const originalInPoint = clip.inPoint;
  const originalOutPoint = clip.outPoint || originalInPoint + originalDuration * speed;
  const isMediaWithSource =
    (clip.type === "video" || clip.type === "audio") &&
    typeof clip.sourceDuration === "number" &&
    clip.sourceDuration > 0;

  // Maximum delta: cannot shrink clip below minDuration
  const maxDelta = originalDuration - minDuration;

  // Minimum delta:
  // 1. Cannot move startTime below 0 on the timeline
  let minDelta = -originalStartTime;

  // 2. For video/audio, cannot reduce inPoint below 0 in source media
  if (isMediaWithSource) {
    minDelta = Math.max(minDelta, -originalInPoint / speed);
  }

  // Clamp deltaSeconds within [minDelta, maxDelta]
  const clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaSeconds));

  const newStartTime = parseFloat((originalStartTime + clampedDelta).toFixed(3));
  const newDuration = parseFloat((originalDuration - clampedDelta).toFixed(3));
  const newInPoint = isMediaWithSource
    ? parseFloat((originalInPoint + clampedDelta * speed).toFixed(3))
    : 0;
  const newOutPoint = isMediaWithSource ? originalOutPoint : newDuration;

  return {
    startTime: Math.max(0, newStartTime),
    duration: Math.max(minDuration, newDuration),
    inPoint: Math.max(0, newInPoint),
    outPoint: newOutPoint,
  };
}

/**
 * Calculate right-edge trimming for a clip while strictly anchoring the timeline start time and in-point.
 */
export function calculateRightTrim(
  clip: TimelineClip,
  deltaSeconds: number,
  minDuration: number = MIN_CLIP_DURATION
): TrimResult {
  const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
  const originalDuration = clip.duration;
  const isMediaWithSource =
    (clip.type === "video" || clip.type === "audio") &&
    typeof clip.sourceDuration === "number" &&
    clip.sourceDuration > 0;

  let maxDuration = 9999;
  if (isMediaWithSource && clip.sourceDuration) {
    maxDuration = (clip.sourceDuration - clip.inPoint) / speed;
  }

  const requestedDuration = originalDuration + deltaSeconds;
  const clampedDuration = parseFloat(
    Math.max(minDuration, Math.min(maxDuration, requestedDuration)).toFixed(3)
  );

  return {
    startTime: clip.startTime,
    duration: clampedDuration,
    inPoint: clip.inPoint,
    outPoint: clip.inPoint + clampedDuration * speed,
  };
}

/**
 * Snap a timestamp to the closest target within thresholdSec
 */
export function snapTimestamp(
  rawTime: number,
  snapPoints: number[],
  thresholdSec: number,
  enabled: boolean = true
): { snappedTime: number; isSnapped: boolean; snapGuide: number | null } {
  if (!enabled) {
    return { snappedTime: rawTime, isSnapped: false, snapGuide: null };
  }

  for (const pt of snapPoints) {
    if (Math.abs(rawTime - pt) <= thresholdSec) {
      return { snappedTime: pt, isSnapped: true, snapGuide: pt };
    }
  }

  return { snappedTime: rawTime, isSnapped: false, snapGuide: null };
}

export const RIPPLE_EPSILON = 0.01; // 10ms tolerance for identifying downstream clips

/**
 * Applies ripple editing to shift downstream clips rightward when a clip's duration is extended.
 *
 * Rules:
 * - Edited clip's duration increases by durationDelta (durationDelta > 0).
 * - Downstream clips whose start times are at or after the edited clip's original end time
 *   (originalEndTime - RIPPLE_EPSILON) are shifted right by durationDelta.
 * - Clips that start strictly before originalEndTime (e.g. voiceover starting at 0s, earlier
 *   visual clips, or pre-existing cross-track overlays) remain anchored at their positions.
 * - Downstream audio/music/sound effect clips starting at or after the boundary shift with the ripple.
 * - When durationDelta <= 0 (shrinking), ripple shift is 0 (standard right-edge trim behavior).
 */
export function applyRippleExtend(
  editedClipId: string,
  newDuration: number,
  allClips: TimelineClip[]
): TimelineClip[] {
  const target = allClips.find((c) => c.id === editedClipId);
  if (!target) return allClips;

  const originalEndTime = target.startTime + target.duration;
  const durationDelta = parseFloat((newDuration - target.duration).toFixed(3));

  if (durationDelta <= 0) {
    // Shrinking or unchanged: only update the target clip duration
    const speed = target.speed && target.speed > 0 ? target.speed : 1.0;
    return allClips.map((c) =>
      c.id === editedClipId
        ? {
            ...c,
            duration: newDuration,
            outPoint: c.inPoint + newDuration * speed,
          }
        : c
    );
  }

  const speed = target.speed && target.speed > 0 ? target.speed : 1.0;

  return allClips.map((clip) => {
    if (clip.id === editedClipId) {
      return {
        ...clip,
        duration: newDuration,
        outPoint: clip.inPoint + newDuration * speed,
      };
    }

    // Downstream check: starts at or after the edited clip's original end boundary
    if (clip.startTime >= originalEndTime - RIPPLE_EPSILON) {
      const newStart = parseFloat((clip.startTime + durationDelta).toFixed(3));
      return {
        ...clip,
        startTime: newStart,
      };
    }

    // Unaffected clips (earlier clips, or clips starting before originalEndTime such as voiceovers at 0s)
    return clip;
  });
}
