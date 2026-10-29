import type {
  TimelineClip,
  TimelineTransition,
  TimelineTrack,
  TransitionType,
} from "../types/timeline";
import {
  areClipsOnSameTrack,
  isAudioTrack,
  isVisualTrack,
  normalizeVisualTrackId,
} from "../types/timeline";

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
  clipB: TimelineClip,
  tracks?: readonly TimelineTrack[]
): boolean {
  if (!areClipsOnSameTrack(clipA.trackId, clipB.trackId, tracks)) return false;
  if (isAudioTrack(clipA.trackId, tracks) || isAudioTrack(clipB.trackId, tracks)) return false;

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

/**
 * Find every eligible transition boundary across all visual tracks.
 * Clips are grouped by normalized track id so legacy "visual" clips and
 * "visual-1" clips are treated as the same lane, and audio lanes are excluded.
 */
export function findEligibleTransitionPairs(
  allClips: TimelineClip[],
  tracks?: readonly TimelineTrack[]
): Array<{ fromClip: TimelineClip; toClip: TimelineClip }> {
  const clipsByTrack = new Map<string, TimelineClip[]>();

  for (const clip of allClips) {
    if (!isVisualTrack(clip.trackId, tracks)) continue;
    const key = normalizeVisualTrackId(clip.trackId);
    const lane = clipsByTrack.get(key) ?? [];
    lane.push(clip);
    clipsByTrack.set(key, lane);
  }

  const pairs: Array<{ fromClip: TimelineClip; toClip: TimelineClip }> = [];
  for (const lane of clipsByTrack.values()) {
    pairs.push(...findAdjacentClipPairs(lane));
  }
  return pairs;
}

export interface ApplyToAllTransitionsResult {
  updatedTransitions: TimelineTransition[];
  count: number;
  clampedCount: number;
  createdCount: number;
  message: string;
}

function createTransitionId(): string {
  return `trans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Apply a source transition's type and duration to every eligible visual clip
 * boundary on the timeline.
 *
 * - Existing transitions are updated in place (IDs and clip associations are
 *   preserved) and duplicate boundary records are collapsed.
 * - Missing transitions are created for eligible adjacent pairs, so the action
 *   never silently does nothing when only one transition exists.
 * - Each duration is clamped to the connecting clips' limits; boundaries that
 *   cannot fit are skipped.
 * - Audio lanes and cross-track pairs are never touched.
 */
export function applyToAllTransitions(
  sourceTransition: TimelineTransition,
  allTransitions: TimelineTransition[],
  allClips: TimelineClip[],
  tracks?: readonly TimelineTrack[]
): ApplyToAllTransitionsResult {
  // The source transition must belong to the current timeline state.
  if (!allTransitions.some((t) => t.id === sourceTransition.id)) {
    return {
      updatedTransitions: allTransitions,
      count: 0,
      clampedCount: 0,
      createdCount: 0,
      message: "No transitions found to update.",
    };
  }

  const eligiblePairs = findEligibleTransitionPairs(allClips, tracks);
  if (eligiblePairs.length === 0) {
    return {
      updatedTransitions: allTransitions,
      count: 0,
      clampedCount: 0,
      createdCount: 0,
      message: "No eligible visual clip boundaries found.",
    };
  }

  let clampedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  const usedTransitionIds = new Set<string>();
  const updatedTransitions: TimelineTransition[] = [];

  for (const { fromClip, toClip } of eligiblePairs) {
    // Skip boundaries where even the minimum transition length cannot fit.
    const maxFittingDuration = Math.min(
      MAX_TRANSITION_DURATION,
      fromClip.duration * 0.5,
      toClip.duration * 0.5
    );
    if (maxFittingDuration < MIN_TRANSITION_DURATION) {
      continue;
    }

    const safeDuration = validateTransitionDuration(
      sourceTransition.duration,
      fromClip,
      toClip
    );
    if (safeDuration !== sourceTransition.duration) {
      clampedCount++;
    }

    // Prefer the canonical direction, but reuse a reverse record's ID so the
    // same boundary never ends up with two transition records.
    const existing =
      allTransitions.find(
        (t) => t.fromClipId === fromClip.id && t.toClipId === toClip.id
      ) ??
      allTransitions.find(
        (t) => t.fromClipId === toClip.id && t.toClipId === fromClip.id
      );

    if (existing && !usedTransitionIds.has(existing.id)) {
      usedTransitionIds.add(existing.id);
      updatedTransitions.push({
        ...existing,
        type: sourceTransition.type,
        duration: safeDuration,
        fromClipId: fromClip.id,
        toClipId: toClip.id,
        trackId: normalizeVisualTrackId(fromClip.trackId),
      });
      updatedCount++;
    } else if (!existing) {
      updatedTransitions.push({
        id: createTransitionId(),
        type: sourceTransition.type,
        duration: safeDuration,
        fromClipId: fromClip.id,
        toClipId: toClip.id,
        trackId: normalizeVisualTrackId(fromClip.trackId),
      });
      createdCount++;
    }
  }

  const count = updatedTransitions.length;
  const typeLabel = sourceTransition.type.replace("-", " ");
  let message = `Applied ${typeLabel} (${sourceTransition.duration.toFixed(2)}s) to ${updatedCount} transition${updatedCount === 1 ? "" : "s"}`;
  if (createdCount > 0) {
    message += ` and created ${createdCount} new one${createdCount === 1 ? "" : "s"}`;
  }
  message += ".";
  if (clampedCount > 0) {
    message += ` (${clampedCount} were clamped to fit shorter clips).`;
  }

  return {
    updatedTransitions,
    count,
    clampedCount,
    createdCount,
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
