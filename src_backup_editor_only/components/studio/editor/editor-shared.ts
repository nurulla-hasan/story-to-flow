import type * as React from "react";
import { Minus, MoveLeft, MoveRight, ZoomIn, ZoomOut } from "lucide-react";
import type {
  ClipMotion,
  ClipSfxConfig,
  StudioClip,
  StudioProject,
  StudioVoiceSegment,
  TransitionType,
} from "../types";

export function isVideoMedia(url?: string | null, mediaType?: string): boolean {
  if (mediaType === "video") return true;
  if (!url) return false;
  return (
    /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url) ||
    url.startsWith("data:video/") ||
    url.startsWith("blob:")
  );
}

export function getClipMedia(clip: StudioClip): {
  type: "image" | "video";
  url: string | null;
} {
  const url = clip.videoUrl || clip.mediaUrl || clip.imageUrl || null;
  const isVid =
    clip.mediaType === "video" ||
    Boolean(clip.videoUrl) ||
    (clip.mediaType !== "image" && isVideoMedia(url));
  return {
    type: isVid ? "video" : "image",
    url,
  };
}

export function getProjectVoiceSegments(
  project: Pick<StudioProject, "voiceSegments" | "audioUrl" | "audioDuration">,
): StudioVoiceSegment[] {
  if (project.voiceSegments && project.voiceSegments.length > 0) {
    return project.voiceSegments;
  }
  if (project.audioUrl) {
    return [
      {
        id: "voice-seg-main",
        audioUrl: project.audioUrl,
        startOffset: 0,
        duration: project.audioDuration || 0,
        name: "Voiceover",
      },
    ];
  }
  return [];
}

export interface VoiceSegmentTiming {
  segment: StudioVoiceSegment;
  start: number;
  end: number;
}

export function computeVoiceSegmentTimings(
  segments: StudioVoiceSegment[],
): VoiceSegmentTiming[] {
  let cur = 0;
  const timings: VoiceSegmentTiming[] = [];
  for (const segment of segments) {
    const dur = Math.max(0.1, segment.duration || 0);
    const start = cur;
    const end = cur + dur;
    cur = end;
    timings.push({ segment, start, end });
  }
  return timings;
}

export function getClipSfxConfig(clip: StudioClip): ClipSfxConfig | null {
  if (clip.sfxConfig && clip.sfxConfig.type !== "none") {
    return clip.sfxConfig;
  }
  if (clip.sfx && clip.sfx !== "none") {
    return {
      type: clip.sfx,
      offset: 0,
      volume: 1.0,
      speed: 1.0,
    };
  }
  return null;
}

export function generateClipId(): string {
  return `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const MOTION_PRESETS: {
  value: ClipMotion;
  label: string;
  short: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "zoom-in", label: "Zoom in", short: "Zoom in", Icon: ZoomIn },
  { value: "zoom-out", label: "Zoom out", short: "Zoom out", Icon: ZoomOut },
  { value: "pan-left", label: "Pan left", short: "Pan L", Icon: MoveLeft },
  { value: "pan-right", label: "Pan right", short: "Pan R", Icon: MoveRight },
  { value: "static", label: "Static", short: "Still", Icon: Minus },
];

export const SPEED_PRESETS = [0.8, 1.0, 1.1, 1.2, 1.25, 1.5];
export const DURATION_PRESETS = [2.0, 2.5, 3.0, 4.0, 5.0, 6.0];

/** Timeline row heights stay in sync between the sticky headers and tracks. */
export const RULER_HEIGHT = 26;
export const TRACK_HEIGHT = {
  video: 88,
  voice: 56,
  sfx: 44,
  music: 40,
} as const;

export function formatSec(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export interface ClipTiming {
  clip: StudioClip;
  start: number;
  end: number;
}

export interface SfxModalState {
  clipId: string;
  config: ClipSfxConfig;
}

export interface TransitionModalState {
  clipIndex: number | null;
  type: TransitionType;
  duration: number;
}
