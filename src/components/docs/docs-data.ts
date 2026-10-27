import {
  Clapperboard,
  Clock,
  Copy,
  Film,
  Gauge,
  Layers,
  ListChecks,
  Mic,
  Palette,
  PenLine,
  Sparkle,
  Volume2,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

export const docsLinks = [
  { id: "workflow", label: "Workflow" },
  { id: "styles", label: "Visual styles" },
  { id: "timing", label: "Timing" },
  { id: "handoff", label: "Handoff" },
  { id: "specs", label: "Specs" },
];

export interface GuideStep {
  icon: LucideIcon;
  title: string;
  body: string;
  artifact: string;
}

export const guideSteps: GuideStep[] = [
  {
    icon: PenLine,
    title: "Write or paste your story",
    body: "Enter your story in Bengali or English. Story to Flow preserves your core events, causality, and emotional twist — without inventing facts or breaking continuity.",
    artifact: "story.txt",
  },
  {
    icon: WandSparkles,
    title: "Plan the narrative and direction",
    body: "Generate the production package. The model acts as storyteller, storyboard director, and visual supervisor — producing a continuous voiceover track plus chronological scene prompts.",
    artifact: "plan.json",
  },
  {
    icon: Mic,
    title: "Generate the voiceover",
    body: "Copy the full voiceover from its dedicated card and paste it into Cartesia. Paragraph breaks are preserved so the narration breathes naturally.",
    artifact: "voiceover.txt",
  },
  {
    icon: Film,
    title: "Render visuals in Google Flow",
    body: "Copy prompts scene by scene. Static scenes render in Image mode; hero scenes render in Video mode at 4.0 seconds, then chain into the next scene.",
    artifact: "prompts.txt",
  },
];

export interface StyleOption {
  id: string;
  name: string;
  description: string;
  bestFor: string;
  gradient: string;
  tag?: string;
}

export const styleOptions: StyleOption[] = [
  {
    id: "auto",
    name: "Auto",
    description:
      "The AI reads tone, genre, and cast, then picks the visual direction that fits the story.",
    bestFor: "First drafts · mixed genres",
    gradient: "from-primary/60 via-info/40 to-info/10",
    tag: "Default",
  },
  {
    id: "3d",
    name: "3D Animated Cartoon",
    description:
      "Stylized 3D characters with warm cinematic lighting, expressive eyes, and saturated color.",
    bestFor: "Family stories · comedy",
    gradient: "from-warning/60 via-primary/40 to-primary/10",
  },
  {
    id: "cinematic",
    name: "Cinematic Realism",
    description:
      "Grounded photoreal lighting, natural skin texture, real lenses, and authentic depth.",
    bestFor: "Drama · documentary",
    gradient: "from-info/60 via-foreground/25 to-foreground/5",
  },
  {
    id: "rural",
    name: "Warm Rural Drama",
    description:
      "Atmospheric Bangladeshi realism — clay roads, lush vegetation, and warm earth tones.",
    bestFor: "Village life · period pieces",
    gradient: "from-warning/55 via-success/40 to-success/10",
  },
  {
    id: "painterly",
    name: "Painterly Storybook",
    description:
      "Textured digital brushstrokes, soft edges, fairy-tale light, and rich palettes.",
    bestFor: "Folk tales · narration",
    gradient: "from-info/55 via-primary/35 to-primary/10",
  },
  {
    id: "anime",
    name: "Anime & Manga",
    description:
      "Clean cel-shaded linework, expressive designs, and dramatic Japanese animation lighting.",
    bestFor: "Action · youth stories",
    gradient: "from-primary/55 via-destructive/30 to-destructive/10",
  },
];

export const voiceTips = [
  "Copy only from the Full Voiceover card — it is clean text with no stage directions.",
  "Keep paragraph breaks; they give the voice model natural places to breathe.",
  "Check Bengali punctuation (দাঁড়ি “।” and কমা “,”) before synthesizing.",
  "Skip SSML and pause tags entirely — Cartesia handles pacing from punctuation.",
];

export const flowTips = [
  "Static scenes: paste the prompt into Image generation mode.",
  "Hero scenes: switch to Video/Animate mode and set the duration to 4.0s.",
  "Hand the last frame of a clip to the next scene to keep the world identical.",
];

export const sampleNarration =
  "বর্ষা তিন দিন ধরে থামেনি। রিনা তবু দোকান খুলে রেখেছিল, টিফিন বাক্সগুলো গুনছিল যেন কিছুই বদলায়নি।";

export interface SpecRow {
  label: string;
  value: string;
  mono?: boolean;
  badge?: string;
}

export const specRows: SpecRow[] = [
  { label: "Voiceover language", value: "Bangladeshi Bengali" },
  { label: "Visual prompts", value: "English (Google Flow)" },
  { label: "Master prompt", value: "v1.5.7", badge: "Active" },
  { label: "Default model", value: "gemini-3.8-flash", mono: true },
  { label: "BGM / SFX", value: "Excluded by design" },
  { label: "Drafts & plans", value: "Browser local storage" },
];

export const docsMeta = [
  { icon: Layers, label: "Bengali + English input" },
  { icon: Clock, label: "4.0s hero video rule" },
  { icon: Gauge, label: "~2.4 Bengali words / second" },
  { icon: ListChecks, label: "Three export formats" },
];

export const sectionIcons = {
  workflow: Clapperboard,
  styles: Palette,
  timing: Volume2,
  handoff: Copy,
  specs: Sparkle,
} satisfies Record<string, LucideIcon>;
