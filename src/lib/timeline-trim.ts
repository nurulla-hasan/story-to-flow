import {
  type TimelineClip,
  type TimelineTrack,
  isVisualTrack,
  isTrackLocked,
  areClipsOnSameTrack,
} from "@/types/timeline";
import { clampLeftTrimToPreventOverlap } from "./timeline-overlap";

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

  // Minimum delta:
  // 1. Cannot move startTime below 0 on the timeline
  let minDelta = -originalStartTime;

  // 2. For video/audio, cannot reduce inPoint below 0 in source media
  if (isMediaWithSource) {
    minDelta = Math.max(minDelta, -originalInPoint / speed);
  }

  // Preserve the 500ms minimum only if it can be reached without moving
  // before timeline/source start. Short source tails at timeline 0 must remain
  // short rather than being expanded beyond their anchored source out-point.
  const minimumReachableDuration = Math.max(0, originalDuration - minDelta);
  const effectiveMinDuration = Math.min(minDuration, minimumReachableDuration);
  const maxDelta = originalDuration - effectiveMinDuration;

  // Clamp deltaSeconds within the feasible interval.
  const clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaSeconds));

  const newStartTime = parseFloat((originalStartTime + clampedDelta).toFixed(3));
  const newDuration = parseFloat((originalDuration - clampedDelta).toFixed(3));
  const newInPoint = isMediaWithSource
    ? parseFloat((originalInPoint + clampedDelta * speed).toFixed(3))
    : 0;
  const newOutPoint = isMediaWithSource ? originalOutPoint : newDuration;

  return {
    startTime: Math.max(0, newStartTime),
    duration: Math.max(effectiveMinDuration, newDuration),
    inPoint: Math.max(0, newInPoint),
    outPoint: newOutPoint,
  };
}

/**
 * Calculate left-edge trimming for a clip, respecting both media source bounds
 * and adjacent track clips to prevent overlapping, while keeping source inPoint and
 * timeline duration perfectly synchronized.
 */
export function calculateLeftTrimWithOverlap(
  clip: TimelineClip,
  deltaSeconds: number,
  allClips: TimelineClip[],
  minDuration: number = MIN_CLIP_DURATION,
  tracks?: readonly TimelineTrack[]
): TrimResult {
  // Step 1: Calculate raw bounded trim based on source limits and minDuration
  const rawTrim = calculateLeftTrim(clip, deltaSeconds, minDuration);

  // Step 2: Clamp proposed start time against any preceding clip on the same track
  const nonOverlapping = clampLeftTrimToPreventOverlap(
    clip,
    rawTrim.startTime,
    rawTrim.duration,
    allClips,
    tracks
  );

  // Step 3: Recalculate the effective delta that was actually permitted by the clamp!
  const effectiveDelta = nonOverlapping.startTime - clip.startTime;
  const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
  const isMediaWithSource =
    (clip.type === "video" || clip.type === "audio") &&
    typeof clip.sourceDuration === "number" &&
    clip.sourceDuration > 0;

  const originalInPoint = clip.inPoint;
  const originalOutPoint = clip.outPoint || originalInPoint + clip.duration * speed;

  const recalculatedInPoint = isMediaWithSource
    ? parseFloat(Math.max(0, originalInPoint + effectiveDelta * speed).toFixed(3))
    : 0;

  return {
    startTime: nonOverlapping.startTime,
    duration: nonOverlapping.duration,
    inPoint: recalculatedInPoint,
    outPoint: originalOutPoint,
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

  let maxDuration = Number.POSITIVE_INFINITY;
  if (isMediaWithSource && typeof clip.sourceDuration === "number") {
    maxDuration = Math.max(0, (clip.sourceDuration - clip.inPoint) / speed);
  }

  // Source bounds are a hard upper limit. If less than the normal 500ms
  // minimum remains, allow a shorter clip rather than reading past EOF.
  const minimumAllowed = Math.min(minDuration, maxDuration);
  const requestedDuration = originalDuration + deltaSeconds;
  const boundedDuration = Math.max(
    minimumAllowed,
    Math.min(maxDuration, requestedDuration)
  );
  const roundedDuration = parseFloat(boundedDuration.toFixed(3));
  const clampedDuration = Math.min(maxDuration, roundedDuration);

  return {
    startTime: clip.startTime,
    duration: clampedDuration,
    inPoint: clip.inPoint,
    outPoint:
      isMediaWithSource && typeof clip.sourceDuration === "number"
        ? Math.min(clip.sourceDuration, clip.inPoint + clampedDuration * speed)
        : clip.inPoint + clampedDuration * speed,
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
 * Applies ripple editing to shift downstream clips rightward when a clip's duration is extended,
 * or leftward when reduced during an ongoing interactive gesture relative to its original end boundary.
 *
 * Rules:
 * - Edited clip's duration becomes newDuration.
 * - Downstream clips whose start times are at or after the edited clip's original end time
 *   (originalEndTime - RIPPLE_EPSILON) are shifted right by durationDelta = newDuration - originalDuration.
 * - If durationDelta < 0 (shrinking relative to original snapshot): downstream clips are shifted left
 *   by durationDelta, but clamped so they never precede the edited clip's new end.
 * - Clips that start strictly before originalEndTime (e.g. voiceover starting at 0s, earlier
 *   visual clips, or pre-existing cross-track overlays) remain anchored at their positions.
 * - Downstream audio/music/sound effect clips starting at or after the boundary shift with the ripple.
 */
export function applyRippleExtend(
  editedClipId: string,
  newDuration: number,
  allClips: TimelineClip[],
  tracks?: readonly TimelineTrack[]
): TimelineClip[] {
  if (!Number.isFinite(newDuration) || newDuration <= 0) return allClips;
  const target = allClips.find((c) => c.id === editedClipId);
  if (!target) return allClips;
  if (isTrackLocked(target.trackId, tracks)) return allClips;

  const speed = target.speed && target.speed > 0 ? target.speed : 1.0;

  // Hard upper bound from source media and locked neighbors. Keep the
  // requested duration separate from this bound so short requests for images
  // still obey MIN_CLIP_DURATION when that minimum is feasible.
  let maxDuration = Number.POSITIVE_INFINITY;
  if (
    (target.type === "video" || target.type === "audio") &&
    typeof target.sourceDuration === "number" &&
    target.sourceDuration > 0
  ) {
    const maxSourceAvailable = (target.sourceDuration - target.inPoint) / speed;
    maxDuration = Math.min(maxDuration, maxSourceAvailable);
  }

  // Constraint 2: Cannot collide with downstream locked clips on the same visual track
  if (isVisualTrack(target.trackId, tracks)) {
    const lockedSucceeding = allClips
      .filter(
        (c) =>
          c.id !== target.id &&
          areClipsOnSameTrack(target.trackId, c.trackId, tracks) &&
          isTrackLocked(c.trackId, tracks) &&
          c.startTime >= target.startTime + target.duration - RIPPLE_EPSILON
      )
      .sort((a, b) => a.startTime - b.startTime);

    if (lockedSucceeding.length > 0) {
      const allowedUntilLocked = lockedSucceeding[0].startTime - target.startTime;
      maxDuration = Math.min(maxDuration, allowedUntilLocked);
    }
  }

  // Source and locked-neighbor boundaries are hard upper bounds. The usual
  // minimum duration yields to those bounds when less than 500ms is available.
  maxDuration = Math.max(0, maxDuration);
  const minimumAllowed = Math.min(MIN_CLIP_DURATION, maxDuration);
  const boundedDuration = Math.max(
    minimumAllowed,
    Math.min(maxDuration, newDuration)
  );
  const effectiveDuration = Math.min(
    maxDuration,
    parseFloat(boundedDuration.toFixed(3))
  );
  const originalEndTime = target.startTime + target.duration;
  const newEndTime = target.startTime + effectiveDuration;
  const durationDelta = parseFloat((effectiveDuration - target.duration).toFixed(3));

  return allClips.map((clip) => {
    if (clip.id === editedClipId) {
      const sourceOutPoint = clip.inPoint + effectiveDuration * speed;
      const outPoint =
        typeof clip.sourceDuration === "number" && clip.sourceDuration > 0
          ? Math.min(clip.sourceDuration, sourceOutPoint)
          : sourceOutPoint;
      return {
        ...clip,
        duration: effectiveDuration,
        outPoint,
      };
    }

    // Locked tracks are never modified by ripple operations
    if (isTrackLocked(clip.trackId, tracks)) {
      return clip;
    }

    // Downstream check: starts at or after the edited clip's original end boundary
    if (clip.startTime >= originalEndTime - RIPPLE_EPSILON) {
      // Shift downstream clip by durationDelta, clamped so it never precedes the edited clip's new end
      const proposedStart = clip.startTime + durationDelta;
      const clampedStart = Math.max(newEndTime, proposedStart);
      return {
        ...clip,
        startTime: parseFloat(clampedStart.toFixed(3)),
      };
    }

    // Unaffected clips (earlier clips, or clips starting before originalEndTime such as voiceovers at 0s)
    return clip;
  });
}

/**
 * Applies ripple deletion: closes the gap left by a deleted clip by shifting all applicable
 * downstream clips leftward by the deleted clip's duration.
 *
 * Rules:
 * - Deleted clip is removed from the timeline.
 * - Downstream clips whose start times are at or after the deleted clip's original end
 *   (deletedEndTime - RIPPLE_EPSILON) shift left by deletedClip.duration.
 * - Clips that started inside the deleted interval on secondary tracks (target.startTime < start < deletedEndTime)
 *   are clamped to target.startTime, aligning them at the new splice point without creating negative times.
 * - Clips starting at or before the deleted clip's start time (e.g. voiceover starting at 0s,
 *   earlier clips on any track, or overlays starting <= target.startTime) remain untouched.
 * - Downstream clips across all relevant tracks (visual-1, visual-2, audio-1, sfx) shift consistently,
 *   preserving relative downstream arrangement without introducing negative start times.
 */
export function applyRippleDelete(
  deletedClipId: string,
  allClips: TimelineClip[],
  tracks?: readonly TimelineTrack[]
): {
  updatedClips: TimelineClip[];
  deletedClip: TimelineClip | null;
} {
  const target = allClips.find((c) => c.id === deletedClipId);
  if (!target) {
    return { updatedClips: allClips, deletedClip: null };
  }
  if (isTrackLocked(target.trackId, tracks)) {
    return { updatedClips: allClips, deletedClip: null };
  }

  const deletedStartTime = target.startTime;
  const deletedEndTime = target.startTime + target.duration;
  const shiftAmount = target.duration;

  // Filter out the deleted clip and sort in original chronological order
  const remainingClips = allClips
    .filter((c) => c.id !== deletedClipId)
    .sort((a, b) => a.startTime - b.startTime);

  // Group by trackId while preserving chronological order within each track
  const trackGroups = new Map<string, TimelineClip[]>();
  for (const clip of remainingClips) {
    const list = trackGroups.get(clip.trackId) || [];
    list.push(JSON.parse(JSON.stringify(clip)));
    trackGroups.set(clip.trackId, list);
  }

  const finalClips: TimelineClip[] = [];

  for (const [, clipsOnTrack] of trackGroups.entries()) {
    let lastTrackEnd = 0;

    for (const clip of clipsOnTrack) {
      if (isTrackLocked(clip.trackId, tracks)) {
        finalClips.push(clip);
        lastTrackEnd = clip.startTime + clip.duration;
        continue;
      }

      const clipEnd = clip.startTime + clip.duration;

      // 1. Visual clips partially overlapping the cut from the left: trim tail at splice point
      if (
        isVisualTrack(clip.trackId, tracks) &&
        isVisualTrack(target.trackId, tracks) &&
        clip.startTime < deletedStartTime &&
        clipEnd > deletedStartTime + RIPPLE_EPSILON
      ) {
        const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
        const timelineAvailable = Math.max(0, deletedStartTime - clip.startTime);
        const sourceAvailable =
          (clip.type === "video" || clip.type === "audio") &&
          typeof clip.sourceDuration === "number" &&
          clip.sourceDuration > 0
            ? Math.max(0, (clip.sourceDuration - clip.inPoint) / speed)
            : Number.POSITIVE_INFINITY;
        const boundedDuration = Math.min(timelineAvailable, sourceAvailable);
        clip.duration = Math.min(
          boundedDuration,
          Math.max(0, parseFloat(boundedDuration.toFixed(3)))
        );
        clip.outPoint =
          typeof clip.sourceDuration === "number" && clip.sourceDuration > 0
            ? Math.min(clip.sourceDuration, clip.inPoint + clip.duration * speed)
            : clip.inPoint + clip.duration * speed;
      }

      let proposedStart: number;

      if (clip.startTime >= deletedEndTime - RIPPLE_EPSILON) {
        // 2. Downstream clips starting at or after deletedEndTime shift left by shiftAmount
        proposedStart = Math.max(0, clip.startTime - shiftAmount);
      } else if (clip.startTime >= deletedStartTime && clip.startTime < deletedEndTime) {
        // 3. Clips starting inside the deleted interval move to splice point (deletedStartTime)
        proposedStart = deletedStartTime;
      } else {
        // 4. Clips starting before deletedStartTime remain anchored
        proposedStart = clip.startTime;
      }

      // Enforce zero same-track collision: cannot start before predecessor on this track ends
      const safeStart = Math.max(proposedStart, lastTrackEnd);
      clip.startTime = parseFloat(safeStart.toFixed(3));
      lastTrackEnd = clip.startTime + clip.duration;

      finalClips.push(clip);
    }
  }

  return {
    updatedClips: finalClips,
    deletedClip: target,
  };
}
