import {
  type TimelineClip,
  type TimelineTransition,
  type TimelineTrack,
  isVisualTrack,
  isAudioTrack,
  normalizeVisualTrackId,
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

  for (const layerClips of visualClipsByTrack.values()) {
    if (layerClips.length > 0) {
      const fitted = fitVisualLayer(layerClips, voiceoverEnd);
      fittedClips.push(...fitted);
      fittedCount += fitted.length;
    }
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
  let message = `Fitted ${fittedCount} visual clips across ${visualClipsByTrack.size} visual track(s) to ${voiceoverEnd.toFixed(1)}s voiceover.`;
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

/**
 * Fit a single visual layer's clips sequentially to the target duration.
 * Preserves layer identity and processes clips in their original timeline order.
 */
function fitVisualLayer(layerClips: TimelineClip[], targetDuration: number): TimelineClip[] {
  if (layerClips.length === 0) return [];

  // Sort clips in their original timeline order
  const sortedClips = [...layerClips].sort((a, b) => a.startTime - b.startTime);

  // Separate images and videos
  const imageClips = sortedClips.filter((c) => c.type === "image");
  const videoClips = sortedClips.filter((c) => c.type === "video");

  let fitted: TimelineClip[] = [];

  if (imageClips.length > 0 && videoClips.length > 0) {
    // Mixed: Keep videos at their durations, scale images to fill the gap
    const totalVideoDuration = videoClips.reduce((sum, v) => sum + v.duration, 0);
    const availableForImages = targetDuration - totalVideoDuration;

    if (availableForImages >= imageClips.length * MIN_CLIP_DURATION) {
      // Scale images proportionally to fill remaining duration
      const currentImageTotal = imageClips.reduce((sum, img) => sum + img.duration, 0);
      const scale =
        currentImageTotal > 0
          ? availableForImages / currentImageTotal
          : availableForImages / imageClips.length;

      let currentTime = 0;
      fitted = sortedClips.map((clip) => {
        let dur = clip.duration;
        if (clip.type === "image") {
          dur = Math.max(MIN_CLIP_DURATION, clip.duration * scale);
        }
        const updated: TimelineClip = {
          ...clip,
          startTime: currentTime,
          duration: dur,
          outPoint: clip.inPoint + dur,
        };
        currentTime += dur;
        return updated;
      });
    } else {
      // Not enough room: scale all clips proportionally
      const currentTotal = sortedClips.reduce((sum, c) => sum + c.duration, 0);
      const scale = currentTotal > 0 ? targetDuration / currentTotal : 1;

      let currentTime = 0;
      fitted = sortedClips.map((clip) => {
        const dur = Math.max(MIN_CLIP_DURATION, clip.duration * scale);
        const updated: TimelineClip = {
          ...clip,
          startTime: currentTime,
          duration: dur,
          outPoint: clip.inPoint + dur,
        };
        currentTime += dur;
        return updated;
      });
    }
  } else if (imageClips.length > 0) {
    // All images: scale proportionally to match target duration exactly
    const currentTotal = imageClips.reduce((sum, img) => sum + img.duration, 0);
    const scale =
      currentTotal > 0 ? targetDuration / currentTotal : targetDuration / imageClips.length;

    let currentTime = 0;
    fitted = imageClips.map((clip, index) => {
      // Last clip absorbs rounding discrepancy
      let dur: number;
      if (index === imageClips.length - 1) {
        dur = Math.max(MIN_CLIP_DURATION, targetDuration - currentTime);
      } else {
        dur = Math.max(MIN_CLIP_DURATION, parseFloat((clip.duration * scale).toFixed(2)));
      }

      const updated: TimelineClip = {
        ...clip,
        startTime: currentTime,
        duration: dur,
        outPoint: clip.inPoint + dur,
      };
      currentTime += dur;
      return updated;
    });
  } else {
    // All videos: scale within source limits
    const currentTotal = videoClips.reduce((sum, v) => sum + v.duration, 0);
    const scale = currentTotal > 0 ? targetDuration / currentTotal : 1;

    let currentTime = 0;
    fitted = videoClips.map((clip) => {
      let dur = Math.max(MIN_CLIP_DURATION, clip.duration * scale);
      if (clip.sourceDuration && clip.sourceDuration > 0) {
        dur = Math.min(dur, clip.sourceDuration - clip.inPoint);
      }
      const updated: TimelineClip = {
        ...clip,
        startTime: currentTime,
        duration: dur,
        outPoint: clip.inPoint + dur,
      };
      currentTime += dur;
      return updated;
    });
  }

  return fitted;
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
