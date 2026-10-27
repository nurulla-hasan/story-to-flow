import {
  AudioLines,
  CloudRain,
  Download,
  Lock,
  MapPin,
  MessageSquareText,
  Mic,
  Repeat2,
  ScanFace,
  ShieldCheck,
  Store,
  SunMedium,
  type LucideIcon,
} from "lucide-react";

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  wide?: boolean;
}

export const features: Feature[] = [
  {
    icon: ScanFace,
    title: "Story Bible with visual & voice locks",
    description:
      "Characters and locations are detected once and stored as exact facts — wardrobe, face, voice, time of day — then reused verbatim in every scene.",
    wide: true,
  },
  {
    icon: Lock,
    title: "Code-assembled prompts",
    description:
      "The model plans; the code writes the prompt. Locks are inserted deterministically, so nothing gets hallucinated or paraphrased.",
  },
  {
    icon: Repeat2,
    title: "Consistency chaining",
    description:
      "Pull the last frame of a generated clip and hand it to the next scene as its starting reference. Continuity without re-rolling.",
  },
  {
    icon: MessageSquareText,
    title: "Chat editing",
    description:
      "Say “change Rina’s saree to green from now on” and every affected scene, prompt, and export updates together.",
  },
  {
    icon: Download,
    title: "Flexible export",
    description:
      "Download formatted .txt prompts, the full plan as .json, or a .zip with prompts and media assets bundled.",
  },
];

export interface LockRow {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
}

export const lockRows: LockRow[] = [
  { id: "face", icon: ScanFace, label: "Rina", value: "teal saree · silver anklet" },
  { id: "voice", icon: Mic, label: "Voice", value: "warm · low · Bengali" },
  { id: "place", icon: MapPin, label: "Ghat", value: "dusk · monsoon light" },
];

export interface Scene {
  id: string;
  number: string;
  title: string;
  prompt: string;
  continuity: string;
  locks: { icon: LucideIcon; label: string }[];
}

export const scenes: Scene[] = [
  {
    id: "ghat",
    number: "01",
    title: "The ghat at dawn",
    prompt:
      "Extreme wide, first light. Rina — teal saree, silver anklet, hair in a low bun — walks the empty ghat steps. Mist over the river, birds lifting, 35mm, slow lateral drift.",
    continuity: "Opens the series · 00:00.0",
    locks: [
      { icon: ScanFace, label: "Rina" },
      { icon: MapPin, label: "Ghat" },
      { icon: SunMedium, label: "First light" },
    ],
  },
  {
    id: "shop",
    number: "02",
    title: "Rina’s small shop",
    prompt:
      "Interior, warm tungsten. Rina — teal saree, silver anklet — arranges steel tiffin boxes on a wooden shelf. Dust in the light, handheld, shallow focus, 50mm.",
    continuity: "Matches scene 01 wardrobe · 00:18.2",
    locks: [
      { icon: ScanFace, label: "Rina" },
      { icon: Store, label: "Shop" },
      { icon: SunMedium, label: "Tungsten" },
    ],
  },
  {
    id: "letter",
    number: "03",
    title: "The unopened letter",
    prompt:
      "Wide shot, monsoon dusk. Rina — teal saree, silver anklet, hair in a low bun — waits at the ghat with the unopened letter. Warm rim light, slow push in, 35mm.",
    continuity: "Last frame → scene 04 · 00:36.8",
    locks: [
      { icon: ScanFace, label: "Rina" },
      { icon: AudioLines, label: "Voice" },
      { icon: MapPin, label: "Ghat" },
    ],
  },
  {
    id: "bus",
    number: "04",
    title: "Monsoon bus stop",
    prompt:
      "Exterior, heavy monsoon. Rina — teal saree, silver anklet, cloth bag — waits under the bus-stop awning, letter sealed. Rain streaks, neon reflections, 50mm, static frame.",
    continuity: "Continues from scene 03 · 00:52.0",
    locks: [
      { icon: ScanFace, label: "Rina" },
      { icon: CloudRain, label: "Monsoon" },
      { icon: Store, label: "Bus stop" },
    ],
  },
];

export interface WorkflowStep {
  icon: LucideIcon;
  title: string;
  description: string;
  preview: "story" | "locks" | "export";
  meta: string;
}

export const workflowSteps: WorkflowStep[] = [
  {
    icon: ScanFace,
    title: "Drop in your story",
    description:
      "Paste a synopsis or a full script in Bengali or English, then set tone, cast, and production notes.",
    preview: "story",
    meta: "Bengali or English",
  },
  {
    icon: Lock,
    title: "Review the Story Bible",
    description:
      "Check the detected characters, locations, and voices. Lock the details that must never change.",
    preview: "locks",
    meta: "3 locks detected",
  },
  {
    icon: Download,
    title: "Export to Google Flow",
    description:
      "Copy prompts scene by scene, or download the whole plan and chain frames as you generate.",
    preview: "export",
    meta: "3 formats",
  },
];

export interface ChainFrame {
  id: string;
  label: string;
  caption: string;
  timecode: string;
  gradient: string;
}

export const chainFrames: ChainFrame[] = [
  {
    id: "end",
    label: "Scene 12",
    caption: "Last frame captured",
    timecode: "00:12.4",
    gradient: "from-info/40 via-primary/25 to-transparent",
  },
  {
    id: "handoff",
    label: "Continuity hand-off",
    caption: "Frame passed as reference",
    timecode: "ref · 002",
    gradient: "from-primary/30 via-warning/25 to-transparent",
  },
  {
    id: "start",
    label: "Scene 13",
    caption: "First frame matches",
    timecode: "00:00.0",
    gradient: "from-success/30 via-info/25 to-transparent",
  },
];

export const trustItems = [
  { icon: ScanFace, label: "Visual & voice locks" },
  { icon: Lock, label: "Deterministic assembly" },
  { icon: Repeat2, label: "Frame-to-frame chaining" },
  { icon: ShieldCheck, label: "Local-first storage" },
];

export const faqs = [
  {
    question: "Does an AI model write the prompts?",
    answer:
      "It plans them. The story model proposes structure and shot intent, while the final prompt string is assembled by code from your locked facts — so the wording you approve is the wording Flow receives.",
  },
  {
    question: "How does character consistency actually work?",
    answer:
      "Every character and location gets a visual and voice lock. Those facts are inserted verbatim into each affected prompt, and the last frame of a clip can seed the next scene as its reference.",
  },
  {
    question: "What can I export?",
    answer:
      "Formatted .txt prompt sheets, the complete production plan as .json, or a .zip containing prompts and media assets ready for hand-off.",
  },
  {
    question: "Where is my story stored?",
    answer:
      "Drafts, settings, and production plans are kept in your browser’s local storage. Nothing leaves your machine until you choose to generate.",
  },
  {
    question: "Does it work in Bengali?",
    answer:
      "Yes. The studio accepts Bengali and English stories and is set in a typeface that renders both scripts cleanly.",
  },
];

export const benefits = [
  "Visual locks travel with every prompt, verbatim.",
  "Last frame in, first frame out — no manual matching.",
  "Edit a lock once and every downstream scene updates.",
];
