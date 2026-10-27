import {
  type TimelineClip,
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
  allClips: TimelineClip[]
): boolean {
  if (!isVisualTrack(candidate.trackId)) return false;

  const candidateEnd = candidate.startTime + candidate.duration;

  for (const other of allClips) {
    if (other.id === candidate.id) continue;
    if (!areClipsOnSameTrack(candidate.trackId, other.trackId)) continue;

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
  allClips: TimelineClip[]
): number {
  if (!isVisualTrack(clip.trackId)) {
    return Math.max(0, proposedStartTime);
  }

  // Find other clips on the same visual track sorted by start time
  const sameTrackClips = allClips
    .filter((c) => c.id !== clip.id && areClipsOnSameTrack(clip.trackId, c.trackId))
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
  allClips: TimelineClip[]
): { startTime: number; duration: number } {
  if (!isVisualTrack(clip.trackId)) {
    return { startTime: proposedStartTime, duration: proposedDuration };
  }

  const originalRightEdge = clip.startTime + clip.duration;
  let minAllowedStart = 0;

  // Find closest preceding clip on the same track
  const precedingClips = allClips
    .filter(
      (c) =>
        c.id !== clip.id &&
        areClipsOnSameTrack(clip.trackId, c.trackId) &&
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
  allClips: TimelineClip[]
): number {
  if (!isVisualTrack(clip.trackId)) {
    return proposedDuration;
  }

  const clipStart = clip.startTime;
  let maxAllowedDuration = 9999;

  // Find closest succeeding clip on the same track
  const succeedingClips = allClips
    .filter(
      (c) =>
        c.id !== clip.id &&
        areClipsOnSameTrack(clip.trackId, c.trackId) &&
        c.startTime >= clipStart + clip.duration - OVERLAP_EPSILON
    )
    .sort((a, b) => a.startTime - b.startTime);

  if (succeedingClips.length > 0) {
    maxAllowedDuration = Math.max(0.5, succeedingClips[0].startTime - clipStart);
  }

  return parseFloat(Math.min(maxAllowedDuration, proposedDuration).toFixed(3));
}

/**
 * Find the next non-overlapping placement start time on a visual track.
 */
export function findNextNonOverlappingStartTime(
  trackId: TrackId,
  duration: number,
  allClips: TimelineClip[],
  preferredStart?: number
): number {
  if (!isVisualTrack(trackId)) {
    return preferredStart !== undefined ? Math.max(0, preferredStart) : 0;
  }

  const laneClips = allClips
    .filter((c) => areClipsOnSameTrack(trackId, c.trackId))
    .sort((a, b) => a.startTime - b.startTime);

  if (laneClips.length === 0) {
    return preferredStart !== undefined ? Math.max(0, preferredStart) : 0;
  }

  const startCandidate = preferredStart !== undefined ? Math.max(0, preferredStart) : 0;

  // If candidate has no overlap, use it
  if (!hasVisualOverlap({ startTime: startCandidate, duration, trackId }, allClips)) {
    return startCandidate;
  }

  // Otherwise place after the latest clip on the lane
  const lastClip = laneClips[laneClips.length - 1];
  return parseFloat((lastClip.startTime + lastClip.duration).toFixed(3));
}
