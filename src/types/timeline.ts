import type { ClipTransform } from "@/lib/clip-transform";
export type { ClipTransform };

export type TrackId = "visual" | "visual-1" | "visual-2" | "audio" | "audio-1";

export function isVisualTrack(trackId: TrackId): boolean {
  return trackId === "visual" || trackId === "visual-1" || trackId === "visual-2";
}

export function isAudioTrack(trackId: TrackId): boolean {
  return trackId === "audio" || trackId === "audio-1";
}

export function normalizeVisualTrackId(trackId: TrackId): "visual-1" | "visual-2" | "audio" {
  if (trackId === "visual-2") return "visual-2";
  if (trackId === "visual" || trackId === "visual-1") return "visual-1";
  return "audio";
}

export function areClipsOnSameTrack(trackA: TrackId, trackB: TrackId): boolean {
  return normalizeVisualTrackId(trackA) === normalizeVisualTrackId(trackB);
}

export function getVisualTrackLayerIndex(trackId: TrackId): number {
  if (trackId === "visual-2") return 2;
  return 1;
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
}

export interface TimelineTrack {
  id: TrackId;
  name: string;
  type: "visual" | "audio";
  muted: boolean;
  locked: boolean;
  layerIndex?: number;
}

export interface TimelineProjectState {
  version: number;
  projectTitle: string;
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  playhead: number;
  zoom: number; // 50 to 200, default 100
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  aspectRatio?: "9:16" | "16:9";
  updatedAt: number;
}
