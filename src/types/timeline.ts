export type TrackId = "visual" | "visual-1" | "visual-2" | "audio" | "audio-1";

export function isVisualTrack(trackId: TrackId): boolean {
  return trackId === "visual" || trackId === "visual-1" || trackId === "visual-2";
}

export function isAudioTrack(trackId: TrackId): boolean {
  return trackId === "audio" || trackId === "audio-1";
}

export function getVisualTrackLayerIndex(trackId: TrackId): number {
  if (trackId === "visual-2") return 2;
  return 1;
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
  playhead: number;
  zoom: number; // 50 to 200, default 100
  selectedClipId: string | null;
  updatedAt: number;
}
