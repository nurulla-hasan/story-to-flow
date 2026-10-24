export type ClipMotion =
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "static";

export interface StudioClip {
  id: string;
  index: number;
  duration: number; // in seconds (e.g. 3.0, 2.5, 4.0)
  imageUrl: string | null;
  imagePrompt: string;
  narration: string;
  motion: ClipMotion;
}

export type BgmMood =
  | "suspense-mystery"
  | "emotional-piano"
  | "lofi-chill"
  | "dark-thriller"
  | "inspirational-epic"
  | "custom";

export interface StudioProject {
  id: string;
  title: string;
  story: string;
  characterVisualLock?: string;
  environmentVisualLock?: string;
  stylePreset: string;
  aspectRatio: "9:16" | "16:9";
  defaultClipDuration: number; // default 3 seconds
  continuousVoiceover: string;
  audioUrl: string | null;
  audioDuration: number;
  audioSpeed?: number; // e.g. 0.8, 1.0, 1.1, 1.2, 1.5
  voiceVolume?: number; // 0 to 1, default 1.0
  bgmUrl?: string | null;
  bgmMood?: BgmMood | null;
  bgmVolume?: number; // 0 to 1, default 0.20
  recommendedBgmMood?: BgmMood;
  saturation?: number; // 0 to 200, default 100
  clips: StudioClip[];
}

export const STUDIO_STYLE_PRESETS = [
  "3D Pixar Animation",
  "Minimalist Stickman Cartoon",
  "Anime & Manga Style",
  "Cinematic Realistic",
  "Vintage Comic Book",
  "Hand-Drawn Sketch",
] as const;
