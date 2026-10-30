import type { TimelineClip, TimelineTrack, TimelineTransition } from "@/types/timeline";
import {
  getVisualTracks,
  isTrackVisible,
  normalizeVisualTrackId,
} from "@/types/timeline";
import { getTransitionProgress } from "@/lib/transition-helpers";

export interface ActiveTransitionData {
  transition: TimelineTransition;
  fromClip: TimelineClip;
  toClip: TimelineClip;
  progress: number;
}

/** Returns visible visual clips active at the playhead, ordered from lower to upper layer. */
export function getActiveVisualClips(
  clips: readonly TimelineClip[],
  tracks: readonly TimelineTrack[],
  playhead: number
): TimelineClip[] {
  if (clips.length === 0) return [];

  const visibleVisualTrackMap = new Map<string, number>();
  if (tracks && tracks.length > 0) {
    const visualTracks = getVisualTracks(tracks);
    const count = visualTracks.length;
    for (let i = 0; i < count; i++) {
      const t = visualTracks[i];
      if (t.visible) {
        const layerIndex = count - i;
        visibleVisualTrackMap.set(t.id, layerIndex);
        visibleVisualTrackMap.set(normalizeVisualTrackId(t.id), layerIndex);
      }
    }
  } else {
    visibleVisualTrackMap.set("visual-2", 2);
    visibleVisualTrackMap.set("visual-1", 1);
    visibleVisualTrackMap.set("visual", 1);
  }

  const active: TimelineClip[] = [];
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    if (playhead >= clip.startTime && playhead < clip.startTime + clip.duration) {
      if (visibleVisualTrackMap.has(clip.trackId)) {
        active.push(clip);
      }
    }
  }

  if (active.length <= 1) return active;
  return active.sort(
    (a, b) =>
      (visibleVisualTrackMap.get(a.trackId) ?? 0) -
      (visibleVisualTrackMap.get(b.trackId) ?? 0)
  );
}

/** Finds each visible visual track's transition that is active at the playhead. */
export function getActiveTransitionsByTrack(
  transitions: readonly TimelineTransition[],
  clips: readonly TimelineClip[] | ReadonlyMap<string, TimelineClip>,
  tracks: readonly TimelineTrack[],
  playhead: number
): Map<string, ActiveTransitionData> {
  if (transitions.length === 0) return new Map();

  const clipMap =
    clips instanceof Map
      ? (clips as ReadonlyMap<string, TimelineClip>)
      : new Map((clips as readonly TimelineClip[]).map((clip) => [clip.id, clip]));

  const visibleTracks = new Set<string>();
  if (tracks && tracks.length > 0) {
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (t.visible) {
        visibleTracks.add(t.id);
        visibleTracks.add(normalizeVisualTrackId(t.id));
      }
    }
  }

  const active = new Map<string, ActiveTransitionData>();
  for (let i = 0; i < transitions.length; i++) {
    const transition = transitions[i];
    const fromClip = clipMap.get(transition.fromClipId);
    const toClip = clipMap.get(transition.toClipId);
    if (!fromClip || !toClip) continue;

    const isVisible =
      tracks && tracks.length > 0
        ? visibleTracks.has(fromClip.trackId)
        : isTrackVisible(fromClip.trackId, tracks);
    if (!isVisible) continue;

    const progress = getTransitionProgress(playhead, transition, fromClip, toClip);
    if (progress === null) continue;
    const key = normalizeVisualTrackId(fromClip.trackId);
    if (!active.has(key)) active.set(key, { transition, fromClip, toClip, progress });
  }
  return active;
}
