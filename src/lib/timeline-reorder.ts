import {
  type TimelineClip,
  areClipsOnSameTrack,
  isVisualTrack,
} from "../types/timeline";

export const REORDER_EPSILON = 0.01; // 10ms tolerance for exact adjacency

export interface ReorderClipResult {
  clips: TimelineClip[];
  /** Timeline position where the dragged clip was inserted (used for the UI indicator). */
  insertionTime: number;
  /** Index of the inserted clip among the other clips on the same track. */
  insertionIndex: number;
}

function roundTime(time: number): number {
  return parseFloat(time.toFixed(3));
}

/**
 * Reorder a clip within its track by moving its body.
 *
 * Unlike a simple "clamp before/after the collided clip" move, this treats the
 * drop position as an insertion slot:
 *
 * 1. The gap left behind by the dragged clip is closed (downstream clips on the
 *    same track shift left by the dragged duration).
 * 2. The insertion slot is derived from the dragged clip's leading edge against
 *    the remaining clips' midpoints, so dragging from right to left works at any
 *    timeline zoom level without tiny nudges swapping neighbours.
 * 3. Clips at/after the insertion point shift right by the dragged duration to
 *    make room, and the dragged clip is placed at the insertion point.
 *
 * Audio tracks keep free positioning (they may intentionally overlap, and the
 * voiceover must keep its t=0 anchor). Other tracks are never touched.
 */
export function reorderClipOnTrack(
  clip: TimelineClip,
  proposedStartTime: number,
  allClips: TimelineClip[]
): ReorderClipResult {
  const safeProposed = Math.max(
    0,
    Number.isFinite(proposedStartTime) ? proposedStartTime : 0
  );

  if (!isVisualTrack(clip.trackId)) {
    return {
      clips: allClips.map((c) =>
        c.id === clip.id ? { ...c, startTime: roundTime(safeProposed) } : c
      ),
      insertionTime: roundTime(safeProposed),
      insertionIndex: 0,
    };
  }

  const duration = clip.duration;
  const sourceEnd = clip.startTime + duration;

  // 1. Close the gap left behind by the dragged clip on its own track.
  const withoutSourceGap = allClips.map((c) => {
    if (c.id === clip.id) return c;
    if (!areClipsOnSameTrack(c.trackId, clip.trackId)) return c;
    if (c.startTime >= sourceEnd - REORDER_EPSILON) {
      return {
        ...c,
        startTime: roundTime(Math.max(0, c.startTime - duration)),
      };
    }
    return c;
  });

  const remaining = withoutSourceGap
    .filter((c) => c.id !== clip.id && areClipsOnSameTrack(c.trackId, clip.trackId))
    .sort((a, b) => a.startTime - b.startTime);

  // 2. Pick the insertion slot from the dragged clip's leading edge. Comparing
  // against the remaining clips' midpoints keeps small rightward nudges from
  // swapping neighbours while still allowing a clear right-to-left reorder.
  let insertionIndex = remaining.filter(
    (c) => c.startTime + c.duration / 2 < safeProposed
  ).length;
  insertionIndex = Math.max(0, Math.min(remaining.length, insertionIndex));

  const previous = remaining[insertionIndex - 1];
  const next = remaining[insertionIndex];

  // 3. Preserve the drop position where possible without overlapping neighbours.
  let insertionTime = previous
    ? Math.max(previous.startTime + previous.duration, safeProposed)
    : safeProposed;
  if (next) {
    insertionTime = Math.min(insertionTime, next.startTime);
  }
  insertionTime = roundTime(Math.max(0, insertionTime));

  // 4. Make room by pushing downstream same-track clips right.
  const withInsertionGap = withoutSourceGap.map((c) => {
    if (c.id === clip.id) return c;
    if (!areClipsOnSameTrack(c.trackId, clip.trackId)) return c;
    if (c.startTime >= insertionTime - REORDER_EPSILON) {
      return { ...c, startTime: roundTime(c.startTime + duration) };
    }
    return c;
  });

  return {
    clips: withInsertionGap.map((c) =>
      c.id === clip.id ? { ...c, startTime: insertionTime } : c
    ),
    insertionTime,
    insertionIndex,
  };
}
