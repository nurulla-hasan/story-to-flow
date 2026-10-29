import {
  type TimelineClip,
  type TimelineTransition,
  type TimelineTrack,
  isVisualTrack,
  isAudioTrack,
  normalizeVisualTrackId,
  isTrackLocked,
} from "../types/timeline";
import { areClipsAdjacentForTransition, validateTransitionDuration } from "./transition-helpers";

export interface FitVisualsResult {
  success: boolean;
  message: string;
  updatedClips: TimelineClip[];
  updatedTransitions: TimelineTransition[];
}

const MIN_CLIP_DURATION = 0.5; // 500ms minimum clip duration

/**
 * Fit visual scene clips on each visual track independently to match the voiceover duration.
 * 
 * DYNAMIC TRACK-AWARE PROCESSING:
 * - Each visual track's clips are fitted as their own independent sequential timeline.
 * - Cross-track overlaps are preserved; tracks are never flattened or interleaved.
 * - The target duration is determined specifically by the Voiceover audio track
 *   (or fallback to default audio if no explicit Voiceover role exists).
 * - Background music, SFX, and ambient sound clips do NOT inflate the narration duration.
 */
export function calculateFitVisualsToVoiceover(
  clips: TimelineClip[],
  transitions: TimelineTransition[],
  tracks?: readonly TimelineTrack[]
): FitVisualsResult {
  const visualClips = clips.filter((c) => isVisualTrack(c.trackId, tracks));

  // Determine voiceover audio clips:
  // 1. If tracks metadata is available, prefer track with role === "voiceover"
  // 2. Otherwise fallback to trackId === "audio", or all audio clips
  let voiceoverClips: TimelineClip[] = [];
  if (tracks && tracks.length > 0) {
    const voiceoverTrackIds = new Set(
      tracks.filter((t) => t.type === "audio" && t.role === "voiceover").map((t) => t.id)
    );
    voiceoverClips = clips.filter((c) => voiceoverTrackIds.has(c.trackId));
  }

  if (voiceoverClips.length === 0) {
    voiceoverClips = clips.filter((c) => c.trackId === "audio");
  }
  if (voiceoverClips.length === 0) {
    voiceoverClips = clips.filter((c) => isAudioTrack(c.trackId, tracks));
  }

  if (voiceoverClips.length === 0) {
    return {
      success: false,
      message: "No voiceover audio found on the timeline. Add an audio clip first.",
      updatedClips: clips,
      updatedTransitions: transitions,
    };
  }

  if (visualClips.length === 0) {
    return {
      success: false,
      message: "No visual scene clips found on the timeline. Add scenes to fit.",
      updatedClips: clips,
      updatedTransitions: transitions,
    };
  }

  // Voiceover end timestamp (target visual duration)
  const voiceoverEnd = Math.max(...voiceoverClips.map((c) => c.startTime + c.duration));
  if (voiceoverEnd <= MIN_CLIP_DURATION) {
    return {
      success: false,
      message: "Voiceover duration is too short to fit visuals.",
      updatedClips: clips,
      updatedTransitions: transitions,
    };
  }

  // Separate visual clips by normalized track ID to process each visual track independently
  const visualClipsByTrack = new Map<string, TimelineClip[]>();
  for (const clip of visualClips) {
    const key = normalizeVisualTrackId(clip.trackId);
    const list = visualClipsByTrack.get(key) || [];
    list.push(clip);
    visualClipsByTrack.set(key, list);
  }

  const fittedClips: TimelineClip[] = [];
  let fittedCount = 0;
  let unlockedTrackCount = 0;

  for (const [key, layerClips] of visualClipsByTrack.entries()) {
    if (layerClips.length > 0) {
      if (isTrackLocked(key, tracks)) {
        // Locked visual tracks must be kept untouched
        fittedClips.push(...layerClips);
        continue;
      }
      unlockedTrackCount++;
      const fitted = fitVisualLayer(layerClips, voiceoverEnd);
      if (!fitted) {
        return {
          success: false,
          message:
            "These visual clips cannot fit the voiceover duration without exceeding source media or minimum clip durations. Adjust the voiceover or scene durations and try again.",
          updatedClips: clips,
          updatedTransitions: transitions,
        };
      }
      fittedClips.push(...fitted);
      fittedCount += fitted.length;
    }
  }

  if (unlockedTrackCount === 0 && visualClips.length > 0) {
    return {
      success: false,
      message: "All visual tracks containing scenes are locked. Unlock a track to fit visuals.",
      updatedClips: clips,
      updatedTransitions: transitions,
    };
  }

  // Combine fitted visuals with untouched audio clips
  const untouchedAudioClips = clips.filter((c) => !isVisualTrack(c.trackId, tracks));
  const finalClips = [...fittedClips, ...untouchedAudioClips];

  // Reconcile transitions: keep only those whose clips remain adjacent after fitting
  const reconciledTransitions = reconcileTransitionsAfterFitting(
    transitions,
    finalClips,
    tracks
  );

  const droppedCount = transitions.length - reconciledTransitions.length;
  let message = `Fitted ${fittedCount} visual clips across ${unlockedTrackCount} visual track(s) to ${voiceoverEnd.toFixed(1)}s voiceover.`;
  if (droppedCount > 0) {
    message += ` Removed ${droppedCount} stale transition${droppedCount === 1 ? "" : "s"}.`;
  }

  return {
    success: true,
    message,
    updatedClips: finalClips,
    updatedTransitions: reconciledTransitions,
  };
}

function getClipDurationBounds(
  clip: TimelineClip
): { min: number; max: number } {
  let max = Number.POSITIVE_INFINITY;
  if (
    clip.type === "video" &&
    typeof clip.sourceDuration === "number" &&
    clip.sourceDuration > 0
  ) {
    const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
    max = Math.max(0, (clip.sourceDuration - clip.inPoint) / speed);
  }

  return { min: Math.min(MIN_CLIP_DURATION, max), max };
}

function computeClipOutPoint(clip: TimelineClip, dur: number): number {
  if (clip.type === "video" || clip.type === "audio") {
    const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
    const outPoint = clip.inPoint + dur * speed;
    if (
      typeof clip.sourceDuration === "number" &&
      clip.sourceDuration > 0
    ) {
      return parseFloat(Math.min(clip.sourceDuration, outPoint).toFixed(3));
    }
    return parseFloat(outPoint.toFixed(3));
  }
  return parseFloat((clip.inPoint + dur).toFixed(3));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Allocate a precise target duration while respecting each clip's minimum
 * and maximum. Shrinking scales the flexible portion above each minimum;
 * growing scales preferred durations until clips hit their source limits.
 */
function allocateDurations(
  targetDuration: number,
  preferredDurations: number[],
  minimums: number[],
  maximums: number[]
): number[] | null {
  if (
    preferredDurations.length === 0 ||
    preferredDurations.length !== minimums.length ||
    preferredDurations.length !== maximums.length
  ) {
    return null;
  }

  const target = parseFloat(targetDuration.toFixed(3));
  const minimumTotal = sum(minimums);
  const maximumTotal = sum(maximums);

  if (
    target < minimumTotal - 0.000001 ||
    target > maximumTotal + 0.000001
  ) {
    return null;
  }

  const preferred = preferredDurations.map((duration, index) =>
    Math.min(maximums[index], Math.max(minimums[index], duration))
  );
  const preferredTotal = sum(preferred);
  let allocated: number[];

  if (Math.abs(preferredTotal - target) <= 0.000001) {
    allocated = preferred;
  } else if (target < preferredTotal) {
    const flexibleTotal = preferredTotal - minimumTotal;
    if (flexibleTotal <= 0) {
      allocated = [...minimums];
    } else {
      const factor = Math.max(0, Math.min(1, (target - minimumTotal) / flexibleTotal));
      allocated = preferred.map(
        (duration, index) =>
          minimums[index] + (duration - minimums[index]) * factor
      );
    }
  } else {
    // Bounded proportional growth. Exponential search guarantees a suitable
    // upper factor when the target is feasible, then bisection finds it.
    const durationAtFactor = (factor: number) =>
      preferred.map((duration, index) =>
        Math.min(maximums[index], Math.max(minimums[index], duration * factor))
      );
    let low = 1;
    let high = 2;
    for (let attempt = 0; attempt < 80 && sum(durationAtFactor(high)) < target; attempt++) {
      high *= 2;
    }
    if (sum(durationAtFactor(high)) < target - 0.001) return null;

    for (let attempt = 0; attempt < 80; attempt++) {
      const middle = (low + high) / 2;
      if (sum(durationAtFactor(middle)) < target) low = middle;
      else high = middle;
    }
    allocated = durationAtFactor(high);
  }

  // Round regular values to millisecond precision without rounding beyond a
  // source cap. Any small rounding remainder is absorbed by available headroom.
  allocated = allocated.map((duration, index) =>
    Math.min(maximums[index], Math.max(minimums[index], parseFloat(duration.toFixed(3))))
  );
  let remainder = parseFloat((target - sum(allocated)).toFixed(3));
  for (let index = allocated.length - 1; index >= 0 && Math.abs(remainder) >= 0.001; index--) {
    const capacity = remainder > 0
      ? maximums[index] - allocated[index]
      : allocated[index] - minimums[index];
    const adjustment = Math.sign(remainder) * Math.min(Math.abs(remainder), Math.max(0, capacity));
    allocated[index] = Math.min(
      maximums[index],
      Math.max(minimums[index], parseFloat((allocated[index] + adjustment).toFixed(3)))
    );
    remainder = parseFloat((target - sum(allocated)).toFixed(3));
  }

  if (Math.abs(sum(allocated) - target) > 0.0005) return null;
  return allocated;
}

/**
 * Fit a single visual layer's clips sequentially to the target duration.
 * Video source limits are hard bounds. Images absorb remaining duration when
 * possible; otherwise all clips are adjusted within their valid bounds.
 */
function fitVisualLayer(
  layerClips: TimelineClip[],
  targetDuration: number
): TimelineClip[] | null {
  if (layerClips.length === 0) return [];

  const sortedClips = [...layerClips].sort((a, b) => a.startTime - b.startTime);
  const imageIndexes = sortedClips
    .map((clip, index) => (clip.type === "image" ? index : -1))
    .filter((index) => index >= 0);
  const videoIndexes = sortedClips
    .map((clip, index) => (clip.type === "video" ? index : -1))
    .filter((index) => index >= 0);
  const bounds = sortedClips.map(getClipDurationBounds);
  const preferred = sortedClips.map((clip) => clip.duration);
  let durations: number[] | null = null;

  if (imageIndexes.length > 0 && videoIndexes.length > 0) {
    const videoPreferred = videoIndexes.map((index) =>
      Math.min(bounds[index].max, Math.max(bounds[index].min, preferred[index]))
    );
    const videoTotal = sum(videoPreferred);
    const imageMinimumTotal = sum(imageIndexes.map((index) => bounds[index].min));
    const availableForImages = parseFloat((targetDuration - videoTotal).toFixed(3));

    // Preserve video durations whenever the images can absorb the remaining
    // duration without dropping below their minimums.
    if (availableForImages >= imageMinimumTotal - 0.001) {
      const imageDurations = allocateDurations(
        availableForImages,
        imageIndexes.map((index) => preferred[index]),
        imageIndexes.map((index) => bounds[index].min),
        imageIndexes.map((index) => bounds[index].max)
      );
      if (imageDurations) {
        durations = [...videoPreferred];
        // Place the per-type durations back in their original clip order.
        const byIndex = new Map<number, number>();
        videoIndexes.forEach((index, i) => byIndex.set(index, videoPreferred[i]));
        imageIndexes.forEach((index, i) => byIndex.set(index, imageDurations[i]));
        durations = sortedClips.map((_, index) => byIndex.get(index) ?? preferred[index]);
      }
    }

    // The original video duration plus minimum image durations does not fit:
    // shrink all flexible portions proportionally if the target is still feasible.
    if (!durations) {
      durations = allocateDurations(
        targetDuration,
        preferred,
        bounds.map((bound) => bound.min),
        bounds.map((bound) => bound.max)
      );
    }
  } else {
    durations = allocateDurations(
      targetDuration,
      preferred,
      bounds.map((bound) => bound.min),
      bounds.map((bound) => bound.max)
    );
  }

  if (!durations) return null;

  let currentTime = 0;
  return sortedClips.map((clip, index) => {
    const duration = durations![index];
    const updated: TimelineClip = {
      ...clip,
      startTime: parseFloat(currentTime.toFixed(3)),
      duration,
      outPoint: computeClipOutPoint(clip, duration),
    };
    currentTime += duration;
    return updated;
  });
}

/**
 * Reconcile existing transitions after clip timing changes.
 * 
 * - Keep transitions whose clips still exist and are adjacent on the same track.
 * - Revalidate transition durations against the updated clip durations.
 * - Drop transitions whose clips are no longer adjacent or were removed.
 */
function reconcileTransitionsAfterFitting(
  oldTransitions: TimelineTransition[],
  updatedClips: TimelineClip[],
  tracks?: readonly TimelineTrack[]
): TimelineTransition[] {
  const clipMap = new Map(updatedClips.map((c) => [c.id, c]));

  return oldTransitions
    .map((transition) => {
      const fromClip = clipMap.get(transition.fromClipId);
      const toClip = clipMap.get(transition.toClipId);

      // Drop transition if either clip is missing
      if (!fromClip || !toClip) {
        return null;
      }

      // Drop transition if clips are no longer adjacent
      if (!areClipsAdjacentForTransition(fromClip, toClip, tracks)) {
        return null;
      }

      // Revalidate duration against the updated clip durations
      const validatedDuration = validateTransitionDuration(
        transition.duration,
        fromClip,
        toClip
      );

      return {
        ...transition,
        duration: validatedDuration,
      };
    })
    .filter((t): t is TimelineTransition => t !== null);
}
