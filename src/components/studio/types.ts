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

export interface StudioProject {
  id: string;
  title: string;
  story: string;
  stylePreset: string;
  aspectRatio: "9:16" | "16:9";
  defaultClipDuration: number; // default 3 seconds
  continuousVoiceover: string;
  audioUrl: string | null;
  audioDuration: number;
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
