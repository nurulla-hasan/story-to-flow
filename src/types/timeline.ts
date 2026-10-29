import type { ClipTransform } from "@/lib/clip-transform";
import type { ClipZoomEffect } from "@/lib/zoom-effect";
export type { ClipTransform, ClipZoomEffect };

/**
 * Dynamic Track Identifiers.
 * Canonical project tracks use stable unique string identifiers (e.g. "visual-1", "visual-2", "audio", "sfx-1", "music-1").
 */
export type TrackId = string;

export type TrackType = "visual" | "audio";

export type AudioTrackRole =
  | "voiceover"
  | "music"
  | "sfx"
  | "ambient"
  | "general";

export interface TimelineTrack {
  id: TrackId;
  name: string;
  type: TrackType;
  /** Relative order within tracks of the same type (lower numbers appear higher in the track section) */
  order: number;
  /** Audio behavior role */
  role?: AudioTrackRole;
  muted: boolean;
  volume: number; // 0.0 to 1.0 (default 1.0)
  visible: boolean; // visual track visibility (default true)
  locked: boolean; // edit gesture lock (default false)
}

/**
 * Default starting tracks for a new project.
 * Preserves the familiar editing experience:
 * - Visual Layer 2: Foreground / Overlay (rendered on top of Layer 1)
 * - Visual Layer 1: Base / Main video
 * - Voiceover: Main narration audio
 */
export const DEFAULT_TIMELINE_TRACKS: TimelineTrack[] = [
  {
    id: "visual-2",
    name: "Visual Layer 2",
    type: "visual",
    order: 0,
    muted: false,
    volume: 1,
    visible: true,
    locked: false,
  },
  {
    id: "visual-1",
    name: "Visual Layer 1",
    type: "visual",
    order: 1,
    muted: false,
    volume: 1,
    visible: true,
    locked: false,
  },
  {
    id: "audio",
    name: "Voiceover",
    type: "audio",
    role: "voiceover",
    order: 0,
    muted: false,
    volume: 1,
    visible: true,
    locked: false,
  },
];

export function getTrackById(
  tracks: readonly TimelineTrack[],
  trackId: TrackId
): TimelineTrack | undefined {
  return tracks.find((t) => t.id === trackId || normalizeVisualTrackId(t.id) === normalizeVisualTrackId(trackId));
}

export function getVisualTracks(
  tracks: readonly TimelineTrack[]
): TimelineTrack[] {
  return tracks
    .filter((t) => t.type === "visual")
    .sort((a, b) => a.order - b.order);
}

export function getAudioTracks(
  tracks: readonly TimelineTrack[]
): TimelineTrack[] {
  return tracks
    .filter((t) => t.type === "audio")
    .sort((a, b) => a.order - b.order);
}

export function isVisualTrack(
  trackId: TrackId,
  tracks?: readonly TimelineTrack[]
): boolean {
  if (tracks && tracks.length > 0) {
    const track = getTrackById(tracks, trackId);
    if (track) return track.type === "visual";
  }
  // Legacy / fallback compatibility for known IDs
  return trackId === "visual" || trackId === "visual-1" || trackId === "visual-2" || trackId.startsWith("visual-");
}

export function isAudioTrack(
  trackId: TrackId,
  tracks?: readonly TimelineTrack[]
): boolean {
  if (tracks && tracks.length > 0) {
    const track = getTrackById(tracks, trackId);
    if (track) return track.type === "audio";
  }
  // Legacy / fallback compatibility for known IDs
  return trackId === "audio" || trackId === "audio-1" || trackId.startsWith("audio-") || trackId.startsWith("sfx-") || trackId.startsWith("music-") || trackId.startsWith("ambient-");
}

export function normalizeVisualTrackId(trackId: TrackId): TrackId {
  if (trackId === "visual") return "visual-1";
  return trackId;
}

export const normalizeLegacyTrackId = normalizeVisualTrackId;

export function getTrackOrder(
  tracks: readonly TimelineTrack[],
  trackId: TrackId
): number | undefined {
  return getTrackById(tracks, trackId)?.order;
}

export function areClipsOnSameTrack(
  trackA: TrackId,
  trackB: TrackId,
  tracks?: readonly TimelineTrack[]
): boolean {
  if (tracks && tracks.length > 0) {
    const tA = getTrackById(tracks, trackA);
    const tB = getTrackById(tracks, trackB);
    if (tA && tB) {
      return tA.id === tB.id;
    }
  }
  return normalizeVisualTrackId(trackA) === normalizeVisualTrackId(trackB);
}

/**
 * Visual Track Layer Z-Index (Compositing order: background to foreground).
 * Higher z-index is rendered in front (on top).
 *
 * For the default tracks:
 * - visual-1 (Base / Main Layer) -> z-index 1 (background / rendered first)
 * - visual-2 (Overlay Layer)     -> z-index 2 (foreground / rendered on top of visual-1)
 *
 * For arbitrary dynamic visual tracks:
 * Visual tracks are displayed in the timeline UI from top to bottom (order 0 is topmost row).
 * In editing conventions (like CapCut/Premiere), higher tracks in the timeline are overlays in front.
 * Therefore, topmost track in the visual tracks list has the highest z-index.
 */
export function getVisualTrackLayerIndex(
  trackId: TrackId,
  tracks?: readonly TimelineTrack[]
): number {
  if (tracks && tracks.length > 0) {
    const visualTracks = getVisualTracks(tracks);
    const index = visualTracks.findIndex((t) => t.id === trackId || normalizeVisualTrackId(t.id) === normalizeVisualTrackId(trackId));
    if (index !== -1) {
      // visualTracks[0] is top overlay -> z-index = visualTracks.length
      // visualTracks[last] is base -> z-index = 1
      return visualTracks.length - index;
    }
  }

  // Legacy fallback when tracks collection is not passed
  if (trackId === "visual-2") return 2;
  return 1;
}

export function isTrackLocked(
  trackId: TrackId,
  tracks?: readonly TimelineTrack[]
): boolean {
  if (!tracks) return false;
  return getTrackById(tracks, trackId)?.locked === true;
}

export function isTrackMuted(
  trackId: TrackId,
  tracks?: readonly TimelineTrack[]
): boolean {
  if (!tracks) return false;
  return getTrackById(tracks, trackId)?.muted === true;
}

export function isTrackVisible(
  trackId: TrackId,
  tracks?: readonly TimelineTrack[]
): boolean {
  if (!tracks) return true;
  return getTrackById(tracks, trackId)?.visible !== false;
}

export function getTrackVolume(
  trackId: TrackId,
  tracks?: readonly TimelineTrack[]
): number {
  if (!tracks) return 1.0;
  const vol = getTrackById(tracks, trackId)?.volume;
  return typeof vol === "number" && !isNaN(vol) ? Math.max(0, Math.min(1, vol)) : 1.0;
}

/**
 * Combine clip-level playback rate with global timeline playback speed.
 * Clamps to a positive safe finite multiplier.
 */
export function calculateEffectivePlaybackRate(
  clipSpeed?: number | null,
  globalPlaybackSpeed: number = 1.0
): number {
  const safeClipSpeed =
    typeof clipSpeed === "number" && Number.isFinite(clipSpeed) && clipSpeed > 0
      ? clipSpeed
      : 1.0;
  const safeGlobal =
    typeof globalPlaybackSpeed === "number" &&
    Number.isFinite(globalPlaybackSpeed) &&
    globalPlaybackSpeed > 0
      ? globalPlaybackSpeed
      : 1.0;
  return parseFloat((safeClipSpeed * safeGlobal).toFixed(4));
}

export type TransitionType = "cross-dissolve" | "fade-black" | "slide-left" | "slide-right";

export interface TimelineTransition {
  id: string;
  type: TransitionType;
  duration: number; // in seconds (e.g. 0.5s)
  fromClipId: string;
  toClipId: string;
  trackId: TrackId;
}

export interface TimelineClip {
  id: string;
  assetId: string;
  name: string;
  type: "image" | "video" | "audio";
  trackId: TrackId;
  startTime: number; // in seconds on timeline
  duration: number; // in seconds on timeline
  inPoint: number; // in seconds from source media start
  outPoint: number; // inPoint + duration
  sourceDuration?: number | null; // total duration of source media (for video/audio)
  speed?: number; // default 1.0
  volume?: number; // default 1.0
  fadeInDuration?: number; // audio fade-in duration in seconds (default 0)
  fadeOutDuration?: number; // audio fade-out duration in seconds (default 0)
  transform?: ClipTransform;
  zoomEffect?: ClipZoomEffect; // animated Ken Burns zoom across the clip (images)
}

export interface TimelineProjectState {
  version: number;
  projectTitle: string;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  playhead: number;
  zoom: number; // 50 to 200, default 100
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  aspectRatio?: "9:16" | "16:9";
  updatedAt: number;
}
