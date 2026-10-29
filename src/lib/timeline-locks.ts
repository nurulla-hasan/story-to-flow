import {
  type TimelineClip,
  type TimelineTrack,
  isTrackLocked,
} from "../types/timeline";

function stableSerialize(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    return String(JSON.stringify(value));
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

function clipsAreEqual(a: TimelineClip, b: TimelineClip): boolean {
  return stableSerialize(a) === stableSerialize(b);
}

/**
 * Returns true if a completed gesture changed or removed a clip on a locked
 * track, or introduced/reassigned a clip onto a locked track.
 *
 * Compare complete clip records so non-timing edits (e.g. transform, zoom,
 * volume and fades) receive the same protection as trim/move operations.
 */
export function hasLockedTrackGestureViolation(
  originalClips: TimelineClip[],
  finalClips: TimelineClip[],
  tracks: readonly TimelineTrack[]
): boolean {
  const originalById = new Map(originalClips.map((clip) => [clip.id, clip]));

  for (const finalClip of finalClips) {
    const original = originalById.get(finalClip.id);

    if (
      original &&
      isTrackLocked(original.trackId, tracks) &&
      !clipsAreEqual(original, finalClip)
    ) {
      return true;
    }

    if (
      isTrackLocked(finalClip.trackId, tracks) &&
      (!original || original.trackId !== finalClip.trackId)
    ) {
      return true;
    }
  }

  const finalIds = new Set(finalClips.map((clip) => clip.id));
  return originalClips.some(
    (clip) => isTrackLocked(clip.trackId, tracks) && !finalIds.has(clip.id)
  );
}
