import type {
  TimelineClip,
  TimelineTransition,
  TransitionType,
} from "../types/timeline";
import { areClipsOnSameTrack, isAudioTrack } from "../types/timeline";

export const MIN_TRANSITION_DURATION = 0.2; // 200ms
export const DEFAULT_TRANSITION_DURATION = 0.5; // 500ms
export const MAX_TRANSITION_DURATION = 2.0; // 2 seconds max

/**
 * Validate and clamp transition duration based on clip boundaries.
 * A transition duration must not exceed half the length of either connecting clip.
 */
export function validateTransitionDuration(
  duration: number,
  fromClip?: TimelineClip | null,
  toClip?: TimelineClip | null
): number {
  let maxDuration = MAX_TRANSITION_DURATION;

  if (fromClip && toClip) {
    const halfFrom = fromClip.duration * 0.5;
    const halfTo = toClip.duration * 0.5;
    maxDuration = Math.min(MAX_TRANSITION_DURATION, halfFrom, halfTo);
  }

  const safeMax = Math.max(MIN_TRANSITION_DURATION, maxDuration);
  return Math.max(MIN_TRANSITION_DURATION, Math.min(safeMax, duration));
}

/**
 * Check if two visual clips on the same track are adjacent and eligible for a transition.
 * Supports backward-compatible trackId mappings ("visual" vs "visual-1").
 * Tolerates up to 0.2s dragging/floating-point gap.
 */
export function areClipsAdjacentForTransition(
  clipA: TimelineClip,
  clipB: TimelineClip
): boolean {
  if (!areClipsOnSameTrack(clipA.trackId, clipB.trackId)) return false;
  if (isAudioTrack(clipA.trackId) || isAudioTrack(clipB.trackId)) return false;

  const clipAEnd = clipA.startTime + clipA.duration;
  const gap = Math.abs(clipB.startTime - clipAEnd);
  return gap <= 0.2;
}

export interface TransitionWindow {
  startTime: number;
  endTime: number;
  cutPoint: number;
  duration: number;
}

/**
 * Calculate the timeline start and end timestamps where the transition takes effect.
 */
export function getTransitionWindow(
  transition: TimelineTransition,
  fromClip: TimelineClip,
  toClip: TimelineClip
): TransitionWindow {
  const cutPoint = toClip.startTime;
  const validDuration = validateTransitionDuration(transition.duration, fromClip, toClip);
  const half = validDuration / 2;

  return {
    startTime: cutPoint - half,
    endTime: cutPoint + half,
    cutPoint,
    duration: validDuration,
  };
}

/**
 * Get the transition progress (0.0 to 1.0) at the current timeline playhead timestamp.
 * Returns null if the playhead is outside the transition window.
 */
export function getTransitionProgress(
  playhead: number,
  transition: TimelineTransition,
  fromClip: TimelineClip,
  toClip: TimelineClip
): number | null {
  const window = getTransitionWindow(transition, fromClip, toClip);
  if (playhead < window.startTime || playhead > window.endTime) {
    return null;
  }

  const progress = (playhead - window.startTime) / window.duration;
  return Math.max(0, Math.min(1, progress));
}

/**
 * Find adjacent clip pairs on a specific track that can connect with transitions.
 * Directly inspects the clips already assigned to the track lane.
 */
export function findAdjacentClipPairs(
  trackClips: TimelineClip[]
): Array<{ fromClip: TimelineClip; toClip: TimelineClip }> {
  const sorted = [...trackClips].sort((a, b) => a.startTime - b.startTime);
  const pairs: Array<{ fromClip: TimelineClip; toClip: TimelineClip }> = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const fromClip = sorted[i];
    const toClip = sorted[i + 1];
    if (areClipsAdjacentForTransition(fromClip, toClip)) {
      pairs.push({ fromClip, toClip });
    }
  }

  return pairs;
}

export interface ApplyToAllTransitionsResult {
  updatedTransitions: TimelineTransition[];
  count: number;
  clampedCount: number;
  message: string;
}

/**
 * Apply a source transition's type and duration to all eligible existing transitions.
 * - Preserves transition IDs and clip associations.
 * - Validates each duration against the specific connecting clips' boundaries.
 * - Returns updated transitions and a user-facing summary message.
 */
export function applyToAllTransitions(
  sourceTransition: TimelineTransition,
  allTransitions: TimelineTransition[],
  allClips: TimelineClip[]
): ApplyToAllTransitionsResult {
  if (allTransitions.length === 0) {
    return {
      updatedTransitions: allTransitions,
      count: 0,
      clampedCount: 0,
      message: "No transitions found to update.",
    };
  }

  let clampedCount = 0;
  const updatedTransitions = allTransitions.map((t) => {
    // If it's the source transition itself, keep its current validated parameters
    if (t.id === sourceTransition.id) {
      return { ...t, type: sourceTransition.type, duration: sourceTransition.duration };
    }

    const fromClip = allClips.find((c) => c.id === t.fromClipId);
    const toClip = allClips.find((c) => c.id === t.toClipId);

    const safeDuration = validateTransitionDuration(sourceTransition.duration, fromClip, toClip);
    if (safeDuration !== sourceTransition.duration) {
      clampedCount++;
    }

    return {
      ...t,
      type: sourceTransition.type,
      duration: safeDuration,
    };
  });

  const count = updatedTransitions.length;
  const typeLabel = sourceTransition.type.replace("-", " ");
  let message = `Applied ${typeLabel} (${sourceTransition.duration.toFixed(2)}s) to all ${count} transitions.`;
  if (clampedCount > 0) {
    message += ` (${clampedCount} were clamped to fit shorter clips).`;
  }

  return {
    updatedTransitions,
    count,
    clampedCount,
    message,
  };
}

export const TRANSITION_PRESETS: Array<{
  type: TransitionType;
  label: string;
  description: string;
}> = [
  {
    type: "cross-dissolve",
    label: "Cross Dissolve",
    description: "Smooth blend between outgoing and incoming scene",
  },
  {
    type: "fade-black",
    label: "Fade Through Black",
    description: "Cinematic dip to black before revealing next scene",
  },
  {
    type: "slide-left",
    label: "Slide Left",
    description: "Incoming scene slides from right to left",
  },
  {
    type: "slide-right",
    label: "Slide Right",
    description: "Incoming scene slides from left to right",
  },
];
