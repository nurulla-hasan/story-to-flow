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

export const SFX_TYPES = [
  "none",
  "whoosh",
  "cartoon-pop",
  "heavy-thud",
  "bonk",
  "cartoon-slip",
  "boing",
  "glass-shatter",
  "water-splash",
  "magic-chime",
  "vine-boom",
  "thunder",
  "door-creak",
  "door-slam",
  "coin-clink",
  "clock-tick",
  "crow-caw",
  "evil-laugh",
  "sad-trombone",
] as const;

export type SfxType = (typeof SFX_TYPES)[number];

export interface SfxPreset {
  type: SfxType;
  label: string;
  emoji: string;
  description: string;
  /** Used to group the picker by story genre / function. */
  group?: string;
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
  {
    type: "whoosh",
    label: "Whoosh / Fly",
    emoji: "💨",
    description: "Fast movement, flight, swift pan",
    group: "Action & Impact",
  },
  {
    type: "heavy-thud",
    label: "Heavy Thud",
    emoji: "💥",
    description: "Body fall, crash landing, heavy impact",
    group: "Action & Impact",
  },
  {
    type: "bonk",
    label: "Bonk / Head Hit",
    emoji: "🥥",
    description: "Head hit, coconut bonk, wooden knock",
    group: "Action & Impact",
  },
  {
    type: "glass-shatter",
    label: "Glass Shatter",
    emoji: "🫙",
    description: "Cup, bottle or window breaking",
    group: "Action & Impact",
  },
  {
    type: "water-splash",
    label: "Water Splash",
    emoji: "💦",
    description: "Splash in water, curd, pond or mud",
    group: "Action & Impact",
  },
  {
    type: "door-slam",
    label: "Door Slam",
    emoji: "🚪",
    description: "Heavy door slamming shut",
    group: "Action & Impact",
  },
  {
    type: "cartoon-pop",
    label: "Cartoon Pop",
    emoji: "🫧",
    description: "Bubble burst, pop, sudden snap",
    group: "Cartoon & Comedy",
  },
  {
    type: "cartoon-slip",
    label: "Cartoon Slip",
    emoji: "🍌",
    description: "Banana peel, mud slip, comic tumble",
    group: "Cartoon & Comedy",
  },
  {
    type: "boing",
    label: "Spring Boing",
    emoji: "🌀",
    description: "Spring jump, bounce, funny recoil",
    group: "Cartoon & Comedy",
  },
  {
    type: "vine-boom",
    label: "Vine Boom",
    emoji: "💣",
    description: "Dramatic shock, twist reveal, meme boom",
    group: "Cartoon & Comedy",
  },
  {
    type: "sad-trombone",
    label: "Sad Trombone",
    emoji: "🎺",
    description: "Comedy fail, defeat, wah-wah-wah",
    group: "Cartoon & Comedy",
  },
  {
    type: "magic-chime",
    label: "Magic Chime",
    emoji: "🪄",
    description: "Spell, sparkle, transformation, time freeze",
    group: "Magic",
  },
  {
    type: "thunder",
    label: "Thunder Clap",
    emoji: "⚡",
    description: "Lightning strike, storm rumble",
    group: "Ghost & Horror",
  },
  {
    type: "door-creak",
    label: "Door Creak",
    emoji: "🚪",
    description: "Spooky door, slow hinge, clock opening",
    group: "Ghost & Horror",
  },
  {
    type: "evil-laugh",
    label: "Evil Laugh",
    emoji: "👻",
    description: "Ghost laugh, villain chuckle, mischief",
    group: "Ghost & Horror",
  },
  {
    type: "crow-caw",
    label: "Crow Caw",
    emoji: "🐦‍⬛",
    description: "Crow or raven call in the air",
    group: "Ghost & Horror",
  },
  {
    type: "coin-clink",
    label: "Coin Clink",
    emoji: "🪙",
    description: "Coins, gold treasure, small metal jingle",
    group: "Story Detail",
  },
  {
    type: "clock-tick",
    label: "Clock Tick",
    emoji: "⏰",
    description: "Antique watch, wall clock, mechanical tick",
    group: "Story Detail",
  },
];

export interface StudioClip {
  id: string;
  index: number;
  duration: number; // in seconds (e.g. 3.0, 2.5, 4.0)
  imageUrl: string | null;
  mediaType?: "image" | "video"; // "image" by default, or "video"
  mediaUrl?: string | null; // unified media source (or imageUrl / videoUrl)
  videoUrl?: string | null; // explicit video source URL
  videoVolume?: number; // 0.0 (muted) to 1.0 (default 0.0 so voiceover is primary)
  imagePrompt: string;
  narration: string;
  /** Raw static shot action, kept so lock edits can rebuild the prompt. */
  action?: string;
  motion: ClipMotion;
  transition?: ClipTransition;
  sfx?: SfxType;
  sfxConfig?: ClipSfxConfig;
  flipped?: boolean; // CapCut horizontal mirror / flip
  characterIds?: string[]; // shorts/animatic cast members visible in this shot
  locationId?: string; // shorts/animatic locked location for this shot
  speed?: number; // per-clip playback speed: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0x (default 1.0)
  baseDuration?: number; // base duration before speed scaling (duration = baseDuration / speed)
}

export interface StudioVoiceSegment {
  id: string;
  audioUrl: string;
  startOffset: number; // in seconds from the original audio start
  duration: number; // duration of this segment in seconds
  name?: string;
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
  voiceSegments?: StudioVoiceSegment[]; // splittable multi-segment voice track
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
