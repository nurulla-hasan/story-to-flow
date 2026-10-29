import {
  type TimelineClip,
  type TimelineTrack,
  type TrackId,
  isVisualTrack,
  areClipsOnSameTrack,
} from "../types/timeline";

export const OVERLAP_EPSILON = 0.01; // 10ms tolerance for exact adjacency

/**
 * Check if a candidate clip placement overlaps any existing clip on the same visual track.
 */
export function hasVisualOverlap(
  candidate: { id?: string; startTime: number; duration: number; trackId: TrackId },
  allClips: TimelineClip[],
  tracks?: readonly TimelineTrack[]
): boolean {
  if (!isVisualTrack(candidate.trackId, tracks)) return false;

  const candidateEnd = candidate.startTime + candidate.duration;

  for (const other of allClips) {
    if (other.id === candidate.id) continue;
    if (!areClipsOnSameTrack(candidate.trackId, other.trackId, tracks)) continue;

    const otherEnd = other.startTime + other.duration;

    // Check interval intersection: A.start < B.end AND A.end > B.start
    if (
      candidate.startTime < otherEnd - OVERLAP_EPSILON &&
      candidateEnd > other.startTime + OVERLAP_EPSILON
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Clamp a proposed start time during clip movement to prevent overlapping adjacent clips on the same visual lane.
 */
export function clampMoveToPreventOverlap(
  clip: TimelineClip,
  proposedStartTime: number,
  allClips: TimelineClip[],
  tracks?: readonly TimelineTrack[]
): number {
  if (!isVisualTrack(clip.trackId, tracks)) {
    return Math.max(0, proposedStartTime);
  }

  // Find other clips on the same visual track sorted by start time
  const sameTrackClips = allClips
    .filter((c) => c.id !== clip.id && areClipsOnSameTrack(clip.trackId, c.trackId, tracks))
    .sort((a, b) => a.startTime - b.startTime);

  let clampedStart = Math.max(0, proposedStartTime);
  const clipDuration = clip.duration;

  // Find immediate predecessor (ends before proposedStart) and successor (starts after proposedStart)
  for (const other of sameTrackClips) {
    const otherEnd = other.startTime + other.duration;

    // If proposed placement collides with this clip:
    if (
      clampedStart < otherEnd - OVERLAP_EPSILON &&
      clampedStart + clipDuration > other.startTime + OVERLAP_EPSILON
    ) {
      // If moving rightward into 'other', stop before 'other.startTime'
      if (clip.startTime <= other.startTime) {
        clampedStart = Math.max(0, other.startTime - clipDuration);
      } else {
        // If moving leftward into 'other', stop after 'otherEnd'
        clampedStart = otherEnd;
      }
    }
  }

  return parseFloat(clampedStart.toFixed(3));
}

/**
 * Clamp left-edge trimming so it cannot expand leftward into the preceding clip on the same lane.
 */
export function clampLeftTrimToPreventOverlap(
  clip: TimelineClip,
  proposedStartTime: number,
  proposedDuration: number,
  allClips: TimelineClip[],
  tracks?: readonly TimelineTrack[]
): { startTime: number; duration: number } {
  if (!isVisualTrack(clip.trackId, tracks)) {
    return { startTime: proposedStartTime, duration: proposedDuration };
  }

  const originalRightEdge = clip.startTime + clip.duration;
  let minAllowedStart = 0;

  // Find closest preceding clip on the same track
  const precedingClips = allClips
    .filter(
      (c) =>
        c.id !== clip.id &&
        areClipsOnSameTrack(clip.trackId, c.trackId, tracks) &&
        c.startTime + c.duration <= clip.startTime + OVERLAP_EPSILON
    )
    .sort((a, b) => b.startTime + b.duration - (a.startTime + a.duration));

  if (precedingClips.length > 0) {
    minAllowedStart = precedingClips[0].startTime + precedingClips[0].duration;
  }

  const clampedStart = Math.max(minAllowedStart, proposedStartTime);
  const clampedDuration = Math.max(0.5, originalRightEdge - clampedStart);

  return {
    startTime: parseFloat(clampedStart.toFixed(3)),
    duration: parseFloat(clampedDuration.toFixed(3)),
  };
}

/**
 * Clamp right-edge trimming so it cannot expand rightward into the succeeding clip on the same lane.
 */
export function clampRightTrimToPreventOverlap(
  clip: TimelineClip,
  proposedDuration: number,
  allClips: TimelineClip[],
  tracks?: readonly TimelineTrack[]
): number {
  if (!isVisualTrack(clip.trackId, tracks)) {
    return proposedDuration;
  }

  const clipStart = clip.startTime;
  let maxAllowedDuration = 9999;

  // Find closest succeeding clip on the same track
  const succeedingClips = allClips
    .filter(
      (c) =>
        c.id !== clip.id &&
        areClipsOnSameTrack(clip.trackId, c.trackId, tracks) &&
        c.startTime >= clip.startTime + clip.duration - OVERLAP_EPSILON
    )
    .sort((a, b) => a.startTime - b.startTime);

  if (succeedingClips.length > 0) {
    maxAllowedDuration = Math.max(0.5, succeedingClips[0].startTime - clipStart);
  }

  const clampedDuration = Math.max(0.5, Math.min(maxAllowedDuration, proposedDuration));
  return parseFloat(clampedDuration.toFixed(3));
}

/**
 * Find the next available non-overlapping start time on a visual track.
 * Used when duplicating or inserting clips to ensure they never collide with existing clips.
 */
export function findNextAvailableStartTime(
  trackId: TrackId,
  duration: number,
  allClips: TimelineClip[],
  preferredStartTime: number = 0,
  tracks?: readonly TimelineTrack[]
): number {
  if (!isVisualTrack(trackId, tracks)) {
    return preferredStartTime;
  }

  // Get and sort all clips on this track chronologically
  const sameTrackClips = allClips
    .filter((c) => areClipsOnSameTrack(trackId, c.trackId, tracks))
    .sort((a, b) => a.startTime - b.startTime);

  let candidateStart = Math.max(0, preferredStartTime);

  // Check collisions sequentially and bump past each conflicting clip
  for (const clip of sameTrackClips) {
    const clipEnd = clip.startTime + clip.duration;
    const candidateEnd = candidateStart + duration;

    // If candidate interval overlaps with current clip:
    if (
      candidateStart < clipEnd - OVERLAP_EPSILON &&
      candidateEnd > clip.startTime + OVERLAP_EPSILON
    ) {
      candidateStart = clipEnd;
    }
  }

  return parseFloat(candidateStart.toFixed(3));
}

export const findNextNonOverlappingStartTime = findNextAvailableStartTime;
