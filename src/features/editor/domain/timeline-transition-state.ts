import type { TimelineClip, TimelineTrack, TimelineTransition } from "@/types/timeline";
import { areClipsAdjacentForTransition, validateTransitionDuration } from "@/lib/transition-helpers";

/**
 * Removes transitions whose clips are missing or no longer adjacent and clamps
 * remaining durations against the current clip pair.
 */
export function reconcileTransitionsForClips(
  candidateTransitions: TimelineTransition[],
  candidateClips: TimelineClip[],
  tracks?: readonly TimelineTrack[]
): TimelineTransition[] {
  return candidateTransitions
    .filter((transition) => {
      const from = candidateClips.find((clip) => clip.id === transition.fromClipId);
      const to = candidateClips.find((clip) => clip.id === transition.toClipId);
      if (!from || !to) return false;
      return areClipsAdjacentForTransition(from, to, tracks);
    })
    .map((transition) => {
      const from = candidateClips.find((clip) => clip.id === transition.fromClipId);
      const to = candidateClips.find((clip) => clip.id === transition.toClipId);
      return {
        ...transition,
        duration: validateTransitionDuration(transition.duration, from, to),
      };
    });
}
