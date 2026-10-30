import type { TimelineClip, TimelineTransition, TimelineTrack } from "@/types/timeline";
import { areClipsOnSameTrack } from "@/types/timeline";
import { areClipsAdjacentForTransition, validateTransitionDuration } from "@/lib/transition-helpers";

/** Pure timeline duration selector, rounded to millisecond precision. */
export function calculateTimelineDuration(clips: readonly TimelineClip[]): number {
  if (clips.length === 0) return 0;
  const maxEnd = Math.max(...clips.map((clip) => clip.startTime + clip.duration));
  return Number(maxEnd.toFixed(3));
}

/** Drop invalid transitions and clamp each surviving transition to its clip bounds. */
export function reconcileTransitionsForClips(
  candidateTransitions: readonly TimelineTransition[],
  candidateClips: readonly TimelineClip[],
  tracks?: readonly TimelineTrack[],
): TimelineTransition[] {
  const clipsById = new Map(candidateClips.map((clip) => [clip.id, clip] as const));

  return candidateTransitions
    .filter((transition) => {
      const from = clipsById.get(transition.fromClipId);
      const to = clipsById.get(transition.toClipId);
      return Boolean(from && to && areClipsAdjacentForTransition(from, to, tracks));
    })
    .map((transition) => {
      const from = clipsById.get(transition.fromClipId);
      const to = clipsById.get(transition.toClipId);
      return {
        ...transition,
        duration: validateTransitionDuration(transition.duration, from, to),
      };
    });
}

/**
 * Group timeline clips by canonical track ID, preserving input order.
 * Legacy track aliases resolve to their matching current track where possible.
 */
export function groupTimelineClipsByTrack(
  orderedTracks: readonly TimelineTrack[],
  clips: readonly TimelineClip[],
  allTracks: readonly TimelineTrack[],
): Map<string, TimelineClip[]> {
  const grouped = new Map<string, TimelineClip[]>();
  for (const track of orderedTracks) grouped.set(track.id, []);

  for (const clip of clips) {
    const matchingTrack = orderedTracks.find((track) =>
      areClipsOnSameTrack(track.id, clip.trackId, allTracks)
    );
    const targetId = matchingTrack ? matchingTrack.id : clip.trackId;
    const lane = grouped.get(targetId);
    if (lane) lane.push(clip);
    else grouped.set(targetId, [clip]);
  }

  return grouped;
}
