import type { TimelineClip, TimelineTrack, TimelineTransition } from "@/types/timeline";
import {
  getVisualTrackLayerIndex,
  getVisualTracks,
  isTrackVisible,
  isVisualTrack,
  normalizeVisualTrackId,
} from "@/types/timeline";
import { getTransitionProgress } from "@/lib/transition-helpers";

export interface ActiveTransitionData {
  transition: TimelineTransition;
  fromClip: TimelineClip;
  toClip: TimelineClip;
  progress: number;
}

/** Pure active-transition selector used by the preview renderer. */
export function getActiveTransitionsByTrack(
  isHydrated: boolean,
  transitions: readonly TimelineTransition[],
  clipMap: ReadonlyMap<string, TimelineClip>,
  playhead: number,
  tracks: readonly TimelineTrack[],
): Map<string, ActiveTransitionData> {
  const active = new Map<string, ActiveTransitionData>();
  if (!isHydrated || transitions.length === 0) return active;

  for (const transition of transitions) {
    const fromClip = clipMap.get(transition.fromClipId);
    const toClip = clipMap.get(transition.toClipId);
    if (!fromClip || !toClip) continue;
    if (!isTrackVisible(fromClip.trackId, tracks)) continue;

    const progress = getTransitionProgress(playhead, transition, fromClip, toClip);
    if (progress === null) continue;

    const trackKey = normalizeVisualTrackId(fromClip.trackId);
    if (!active.has(trackKey)) {
      active.set(trackKey, { transition, fromClip, toClip, progress });
    }
  }
  return active;
}

/** Visible visual clips before playhead filtering, with hidden tracks excluded. */
export function getRenderableVisualClips(
  clips: readonly TimelineClip[],
  tracks: readonly TimelineTrack[],
): TimelineClip[] {
  return clips.filter(
    (clip) => isVisualTrack(clip.trackId, tracks) && isTrackVisible(clip.trackId, tracks),
  );
}

/** Active visuals sorted bottom-to-top so later entries render above earlier ones. */
export function getActiveVisualClips(
  clips: readonly TimelineClip[],
  tracks: readonly TimelineTrack[],
  playhead: number,
  isHydrated: boolean,
): TimelineClip[] {
  if (!isHydrated) return [];
  return getRenderableVisualClips(clips, tracks)
    .filter((clip) => playhead >= clip.startTime && playhead < clip.startTime + clip.duration)
    .sort(
      (a, b) =>
        getVisualTrackLayerIndex(a.trackId, tracks) -
        getVisualTrackLayerIndex(b.trackId, tracks),
    );
}

/** Preview track layers in paint order (base first, foreground last). */
export function getVisibleVisualTracksInPaintOrder(
  tracks: readonly TimelineTrack[],
): TimelineTrack[] {
  return [...getVisualTracks(tracks).filter((track) => track.visible)].reverse();
}
