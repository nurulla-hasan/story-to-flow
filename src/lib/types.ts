import { z } from "zod";

/* ----------------------------- settings ----------------------------- */

export const languageSchema = z.enum(["bn", "en"]);
export type Language = z.infer<typeof languageSchema>;

export const aspectRatioSchema = z.enum(["16:9", "9:16"]);
export const strictnessSchema = z.enum(["off", "light", "strict"]);
export const imageProviderSchema = z.enum(["omniroute", "manual"]);
export const sceneStatusSchema = z.enum([
  "draft",
  "ready",
  "done",
  "needs_attention",
]);
export type SceneStatus = z.infer<typeof sceneStatusSchema>;

export const modelsSchema = z.object({
  planner: z.string().max(200).default(""),
  validator: z.string().max(200).default(""),
  image: z.string().max(200).default(""),
});

export const settingsSchema = z.object({
  dialogueLanguage: languageSchema.default("bn"),
  accentNote: z.string().max(400).default(""),
  totalMinutes: z.coerce.number().min(0.2).max(120).default(1),
  clipSeconds: z.union([z.literal(8), z.literal(10)]).default(10),
  aspectRatio: aspectRatioSchema.default("16:9"),
  stylePreset: z.string().max(120).default("Cinematic realism"),
  styleNote: z.string().max(600).default(""),
  maxPeople: z.coerce.number().int().min(1).max(8).default(2),
  dialogueEnabled: z.boolean().default(true),
  maxDialogueWords: z.coerce.number().int().min(1).max(80).default(15),
  ambientSound: z.boolean().default(true),
  frameChaining: z.boolean().default(true),
  negativeList: z
    .string()
    .max(2000)
    .default(
      "no text, no captions, no subtitles, no watermark, no logo, no extra people, no extra faces, no deformed hands, no split screen, no scene cut inside the clip",
    ),
  validatorStrictness: strictnessSchema.default("light"),
  imageProvider: imageProviderSchema.default("manual"),
  models: modelsSchema
    .default({ planner: "", validator: "", image: "" }),
});

export type Settings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});
export const settingsPatchSchema = settingsSchema.partial().extend({
  models: modelsSchema.partial().optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const STYLE_PRESETS = [
  "Cinematic realism",
  "Warm rural drama",
  "Moody noir",
  "Documentary natural",
  "Painterly storybook",
] as const;

export function sceneCount(settings: Settings): number {
  return Math.max(
    1,
    Math.ceil((settings.totalMinutes * 60) / settings.clipSeconds),
  );
}

export function languageLabel(language: Language): string {
  return language === "bn" ? "Bangla" : "English";
}

/* ------------------------------ bible ------------------------------- */

export const bibleCharacterSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  visual_lock: z.string().min(20).max(1200),
  voice_lock: z.string().min(10).max(600),
  language: languageSchema,
  outfit_changes: z.boolean(),
});
export type BibleCharacter = z.infer<typeof bibleCharacterSchema>;

export const bibleLocationSchema = z.object({
  id: z.string().min(1).max(60),
  visual_lock: z.string().min(20).max(1200),
});
export type BibleLocation = z.infer<typeof bibleLocationSchema>;

export const bibleSchema = z.object({
  title: z.string().min(1).max(200),
  style_lock: z.string().min(20).max(1000),
  characters: z.array(bibleCharacterSchema).min(1).max(30),
  locations: z.array(bibleLocationSchema).min(1).max(30),
});
export type Bible = z.infer<typeof bibleSchema>;

/* ------------------------------ scenes ------------------------------ */

export const cameraSchema = z.object({
  shot: z.string().min(1).max(200),
  angle: z.string().min(1).max(200),
  movement: z.string().min(1).max(200),
});
export type Camera = z.infer<typeof cameraSchema>;

export const dialogueSchema = z.object({
  speaker: z.string().min(1).max(60),
  line: z.string().min(1).max(500),
});
export type Dialogue = z.infer<typeof dialogueSchema>;

export const sceneSchema = z.object({
  n: z.coerce.number().int().min(1),
  location_id: z.string().min(1).max(60),
  characters: z.array(z.string().min(1)).max(8),
  is_establishing: z.boolean().default(false),
  chain_from_previous: z.boolean().default(true),
  action: z.string().min(1).max(600),
  camera: cameraSchema,
  start_state: z.string().min(1).max(1000),
  end_state: z.string().min(1).max(1000),
  dialogue: dialogueSchema.nullable().default(null),
  sound: z.string().max(400).default(""),
});
export type Scene = z.infer<typeof sceneSchema>;

export const scenePlanSchema = z.object({ scenes: z.array(sceneSchema) });
export const sceneArraySchema = z.array(sceneSchema);

export const promptReinforcementsSchema = z.object({
  reinforcements: z.array(z.string().min(1).max(400)).min(1).max(3),
  custom_rule: z.string().min(1).max(400).nullable().default(null),
});
export type PromptReinforcements = z.infer<typeof promptReinforcementsSchema>;

export const validatorResultSchema = z.object({
  ok: z.boolean(),
  issues: z.array(z.string().max(400)).max(12).default([]),
  edits: z
    .array(
      z.object({
        field: z.string().min(1).max(80),
        value: z.unknown(),
        reason: z.string().max(300).default(""),
      }),
    )
    .max(12)
    .default([]),
});
export type ValidatorResult = z.infer<typeof validatorResultSchema>;

/* ------------------------------- chat ------------------------------- */

export const characterFieldSchema = z.enum([
  "name",
  "visual_lock",
  "voice_lock",
  "language",
  "outfit_changes",
]);

export const sceneFieldSchema = z.enum([
  "location_id",
  "characters",
  "action",
  "start_state",
  "end_state",
  "sound",
  "dialogue",
  "camera",
  "is_establishing",
  "chain_from_previous",
]);

export const chatOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set_character_field"),
    character_id: z.string(),
    field: characterFieldSchema,
    value: z.unknown(),
    reason: z.string().max(300).default(""),
  }),
  z.object({
    op: z.literal("update_scene"),
    n: z.coerce.number().int().min(1),
    field: sceneFieldSchema,
    value: z.unknown(),
    reason: z.string().max(300).default(""),
  }),
  z.object({
    op: z.literal("split_scene"),
    n: z.coerce.number().int().min(1),
    reason: z.string().max(300).default(""),
    first: sceneSchema.partial().optional(),
    second: sceneSchema.partial().optional(),
  }),
  z.object({
    op: z.literal("merge_scenes"),
    n: z.coerce.number().int().min(1),
    reason: z.string().max(300).default(""),
    merged: sceneSchema.partial().optional(),
  }),
  z.object({
    op: z.literal("delete_scene"),
    n: z.coerce.number().int().min(1),
    reason: z.string().max(300).default(""),
  }),
  z.object({
    op: z.literal("add_rule"),
    text: z.string().min(1).max(400),
    reason: z.string().max(300).default(""),
  }),
  z.object({
    op: z.literal("set_setting"),
    key: z.string().min(1).max(80),
    value: z.unknown(),
    reason: z.string().max(300).default(""),
  }),
]);
export type ChatOp = z.infer<typeof chatOpSchema>;
export const chatOpsSchema = z.object({
  summary: z.string().max(1000).default(""),
  ops: z.array(chatOpSchema).min(1).max(30),
});

/* ------------------------------ records ----------------------------- */

export interface CharacterRecord extends BibleCharacter {
  refImage: string | null;
}

export interface LocationRecord extends BibleLocation {
  refImage: string | null;
  name: string;
}

export interface PromptVersion {
  version: number;
  text: string;
  imagePrompt: string;
  reinforcements: string[];
  createdAt: string;
}

export interface SceneRecord extends Scene {
  status: SceneStatus;
  reasons: string[];
  keyframePath: string | null;
  clipPath: string | null;
  lastFramePath: string | null;
  startFramePath: string | null;
  chainedFrom: number | null;
  prompt: PromptVersion | null;
  updatedAt: string;
}

export interface RuleRecord {
  id: number;
  text: string;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  story: string;
  styleLock: string;
  settings: Settings;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectData {
  project: ProjectRecord;
  characters: CharacterRecord[];
  locations: LocationRecord[];
  scenes: SceneRecord[];
  rules: RuleRecord[];
}

export interface JobRecord {
  id: string;
  projectId: string;
  type: string;
  status: "running" | "done" | "error";
  progress: number;
  message: string;
  error: string | null;
  result: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface FileAsset {
  buffer: Buffer;
  mime: string;
  ext: string;
}


export function canonicalScene(scene: Scene): Scene {
  return {
    n: scene.n,
    location_id: scene.location_id,
    characters: [...scene.characters],
    is_establishing: Boolean(scene.is_establishing),
    chain_from_previous: Boolean(scene.chain_from_previous),
    action: scene.action,
    camera: { ...scene.camera },
    start_state: scene.start_state,
    end_state: scene.end_state,
    dialogue: scene.dialogue ? { ...scene.dialogue } : null,
    sound: scene.sound,
  };
}

export function newId(): string {
  return (
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugify(input: string): string {
  const ascii = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "id-" + Math.random().toString(36).slice(2, 7);
}
