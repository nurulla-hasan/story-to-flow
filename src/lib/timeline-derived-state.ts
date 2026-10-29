import type { TimelineClip, TimelineTransition, TimelineTrack } from "@/types/timeline";
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
