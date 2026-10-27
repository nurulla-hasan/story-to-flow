"use client";

import type { TimelineClip, TrackId } from "@/types/timeline";
import { getStoredTimelineState } from "@/lib/timeline-storage";

export interface MediaAssetReferenceUsage {
  clipCount: number;
  trackIds: TrackId[];
  clipNames: string[];
  clipIds: string[];
}

type ReferencedClip = Pick<TimelineClip, "id" | "assetId" | "trackId" | "name">;

const EMPTY_USAGE: MediaAssetReferenceUsage = {
  clipCount: 0,
  trackIds: [],
  clipNames: [],
  clipIds: [],
};

let liveReferenceUsage = new Map<string, MediaAssetReferenceUsage>();

/**
 * Collect all asset references across every timeline track (visual layers and audio).
 */
export function collectMediaAssetReferences(
  clips: readonly ReferencedClip[]
): Map<string, MediaAssetReferenceUsage> {
  const references = new Map<string, MediaAssetReferenceUsage>();

  for (const clip of clips) {
    if (!clip.assetId) continue;

    const existing = references.get(clip.assetId);
    if (existing) {
      existing.clipCount += 1;
      existing.clipIds.push(clip.id);
      if (!existing.trackIds.includes(clip.trackId)) {
        existing.trackIds.push(clip.trackId);
      }
      existing.clipNames.push(clip.name);
    } else {
      references.set(clip.assetId, {
        clipCount: 1,
        trackIds: [clip.trackId],
        clipNames: [clip.name],
        clipIds: [clip.id],
      });
    }
  }

  return references;
}

function mergeUsage(
  first: MediaAssetReferenceUsage | undefined,
  second: MediaAssetReferenceUsage | undefined
): MediaAssetReferenceUsage {
  if (!first && !second) return EMPTY_USAGE;

  const clipIds = new Set<string>();
  const trackIds = new Set<TrackId>();
  const clipNamesById = new Map<string, string>();

  const addEntries = (usage: MediaAssetReferenceUsage | undefined) => {
    usage?.clipIds.forEach((clipId, index) => {
      clipIds.add(clipId);
      // Live usage (`first`) wins when the same clip was renamed since the
      // last save, avoiding duplicate names for a single clip.
      if (!clipNamesById.has(clipId)) {
        clipNamesById.set(clipId, usage.clipNames[index] ?? clipId);
      }
    });
    usage?.trackIds.forEach((trackId) => trackIds.add(trackId));
  };

  addEntries(first);
  addEntries(second);

  return {
    clipCount: clipIds.size,
    trackIds: Array.from(trackIds),
    clipNames: Array.from(clipNamesById.values()),
    clipIds: Array.from(clipIds),
  };
}

/**
 * Keep a live snapshot of asset references for the mounted timeline. This
 * avoids importing the timeline context from the media library (and the
 * circular dependency that would create).
 */
export function registerTimelineAssetReferences(clips: readonly ReferencedClip[]): void {
  liveReferenceUsage = collectMediaAssetReferences(clips);
}

export function clearRegisteredTimelineAssetReferences(): void {
  liveReferenceUsage = new Map();
}

export function getRegisteredTimelineAssetReferences(): ReadonlyMap<string, MediaAssetReferenceUsage> {
  return liveReferenceUsage;
}

/**
 * Resolve current asset usage from the live timeline plus the last saved
 * project. Both sources are checked so media cannot be deleted during
 * hydration or before the timeline provider has registered its snapshot.
 */
export function getMediaAssetUsage(assetId: string): MediaAssetReferenceUsage {
  const liveUsage = liveReferenceUsage.get(assetId);
  const savedUsage = collectMediaAssetReferences(getStoredTimelineState().clips).get(assetId);
  return mergeUsage(liveUsage, savedUsage);
}

export function isMediaAssetReferenced(assetId: string): boolean {
  return getMediaAssetUsage(assetId).clipCount > 0;
}

export type MediaAssetRemovalCheck =
  | { canRemove: true; usage: MediaAssetReferenceUsage }
  | { canRemove: false; reason: "in-use"; usage: MediaAssetReferenceUsage };

/**
 * Decide whether a media asset is safe to delete. The media library uses this
 * before touching IndexedDB so a saved clip can never lose its source.
 */
export function checkMediaAssetRemoval(assetId: string): MediaAssetRemovalCheck {
  const usage = getMediaAssetUsage(assetId);
  if (usage.clipCount > 0) {
    return { canRemove: false, reason: "in-use", usage };
  }
  return { canRemove: true, usage };
}
