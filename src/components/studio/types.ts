export type ClipMotion =
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "static";

export type TransitionType =
  | "none"
  | "dissolve"
  | "white-flash"
  | "slide-left"
  | "slide-right"
  | "zoom-push"
  | "black-dip";

export interface ClipTransition {
  type: TransitionType;
  duration: number; // in seconds, e.g. 0.4
}

export type SfxType =
  | "none"
  | "cartoon-pop"
  | "heavy-thud"
  | "whoosh"
  | "magic-chime"
  | "glass-shatter"
  | "boing"
  | "crow-caw"
  | "clock-tick";

export interface SfxPreset {
  type: SfxType;
  label: string;
  emoji: string;
  description: string;
}

export interface ClipSfxConfig {
  type: SfxType | "custom";
  customUrl?: string | null;
  customName?: string | null;
  offset: number; // in seconds from clip start
  volume: number; // 0 to 2.0 (default 1.0)
  speed: number; // 0.5 to 2.0 (default 1.0)
}

export const SFX_PRESETS: SfxPreset[] = [
  { type: "none", label: "None", emoji: "🚫", description: "No sound effect" },
  { type: "whoosh", label: "Whoosh / Fly", emoji: "💨", description: "Fast movement, flight, swift pan" },
  { type: "cartoon-pop", label: "Bubble Pop", emoji: "🎈", description: "Pop, bubble burst, sudden snap" },
  { type: "heavy-thud", label: "Heavy Thud", emoji: "💥", description: "Falling down on mattress/ground, impact" },
  { type: "glass-shatter", label: "Glass Shatter", emoji: "🔨", description: "Cup falling, shattering glass or splash" },
  { type: "magic-chime", label: "Magic Chime", emoji: "🪄", description: "Time freeze, magical sparkle, lever pull" },
  { type: "boing", label: "Cartoon Boing", emoji: "🌀", description: "Spring bounce, funny recoil" },
  { type: "crow-caw", label: "Crow / Bird Caw", emoji: "🦅", description: "Crow cawing in the air" },
  { type: "clock-tick", label: "Clock Tick", emoji: "⏰", description: "Antique mechanical watch ticking" },
];

export interface StudioClip {
  id: string;
  index: number;
  duration: number; // in seconds (e.g. 3.0, 2.5, 4.0)
  imageUrl: string | null;
  imagePrompt: string;
  narration: string;
  motion: ClipMotion;
  transition?: ClipTransition;
  sfx?: SfxType;
  sfxConfig?: ClipSfxConfig;
  flipped?: boolean; // CapCut horizontal mirror / flip
  characterIds?: string[]; // shorts/animatic cast members visible in this shot
  locationId?: string; // shorts/animatic locked location for this shot
}

export type BgmMood =
  | "suspense-mystery"
  | "emotional-piano"
  | "lofi-chill"
  | "dark-thriller"
  | "inspirational-epic"
  | "custom";

export interface StudioCastMember {
  id: string;
  name: string;
  visualLock: string;
  voiceLock?: string;
  refImageUrl?: string | null;
}

export interface StudioLocationLock {
  id: string;
  name?: string;
  visualLock: string;
}

export interface StudioProject {
  id: string;
  title: string;
  story: string;
  workflowMode?: "video-clips" | "shorts-animatic";
  cast?: StudioCastMember[];
  locations?: StudioLocationLock[];
  styleLock?: string;
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
  enableAudioDucking?: boolean; // duck BGM to 15% during voiceover, ramp up to 35% on pause
  clips: StudioClip[];
}

export const STUDIO_STYLE_PRESETS = [
  "Cinematic realism",
  "3D Pixar Animation",
  "Minimalist Stickman Cartoon",
  "Anime & Manga Style",
  "Vintage Comic Book",
  "Hand-Drawn Sketch",
  "Painterly storybook",
  "Warm rural drama",
  "Moody noir",
  "Documentary natural",
] as const;

export interface TransitionPreset {
  type: TransitionType;
  label: string;
  emoji: string;
  description: string;
}

export const TRANSITION_PRESETS: TransitionPreset[] = [
  {
    type: "none",
    label: "None",
    emoji: "🚫",
    description: "Instant cut without transition",
  },
  {
    type: "dissolve",
    label: "Cross Dissolve",
    emoji: "🌫️",
    description: "Smooth cinematic opacity crossfade",
  },
  {
    type: "white-flash",
    label: "White Flash",
    emoji: "⚡",
    description: "Viral bright flash cut (CapCut classic)",
  },
  {
    type: "slide-left",
    label: "Slide Left",
    emoji: "⏩",
    description: "Next clip pushes in smoothly from right",
  },
  {
    type: "slide-right",
    label: "Slide Right",
    emoji: "⏪",
    description: "Next clip pushes in smoothly from left",
  },
  {
    type: "zoom-push",
    label: "Zoom Push",
    emoji: "🔍",
    description: "Dynamic zoom-in warp transition",
  },
  {
    type: "black-dip",
    label: "Dip to Black",
    emoji: "🎬",
    description: "Smooth fade through black",
  },
];
