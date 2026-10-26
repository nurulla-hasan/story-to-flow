export type TrackId = "visual" | "audio";

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
