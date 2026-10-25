import type * as React from "react";
import { Minus, MoveLeft, MoveRight, ZoomIn, ZoomOut } from "lucide-react";
import type {
  ClipMotion,
  ClipSfxConfig,
  StudioClip,
  TransitionType,
} from "../types";

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
