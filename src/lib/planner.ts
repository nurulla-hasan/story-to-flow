import { chatJSON } from "./llm";
import {
  bibleSchema,
  languageSchema,
  sceneArraySchema,
  scenePlanSchema,
  sceneSchema,
  slugify,
  type Bible,
  type ProjectData,
  type Scene,
  type Settings,
} from "./types";

const BIBLE_SYSTEM = `You are a film pre-production planner for a text-to-video model. You read a story and return the visual bible that will keep every generated clip consistent.

Return JSON only. No markdown, no commentary.

Schema:
{
  "title": "short title",
  "style_lock": "one fixed line: look, lens, light, color grade, mood",
  "characters": [
    {
      "id": "lowercase-ascii-slug",
      "name": "name exactly as used in the story",
      "visual_lock": "40-60 words: age, face, hair, skin tone, DRESS, accessories. Visual facts only.",
      "voice_lock": "age, pitch, speed, accent, mood. Concrete.",
      "language": "bn" or "en",
      "outfit_changes": false
    }
  ],
  "locations": [
    { "id": "lowercase-ascii-slug", "visual_lock": "architecture, objects, time of day, light, colors" }
  ]
}

Rules:
- Visual locks contain no personality, backstory, emotions or plot. Only what a camera sees: age, face, hair, skin, clothes, accessories.
- Voice locks are concrete: age, pitch, speed, accent, mood.
- Never invent characters or locations that are not implied by the story.
- Merge a character who appears under several names (for example "Ma" and "Rina's mother") into ONE character using the story's main name.
- The story may be Bangla. Keep names in native script for "name"; use romanized lowercase ascii ids.
- Pick the simplest visual reading of ambiguous text.
- The character's outfit is a permanent lock unless outfit_changes is true.
- style_lock must reflect the requested visual style and be one fixed line.
- Write all locks in English (the video model is prompted in English), except character names.
- 3 characters in the story means 3 characters here. Do not add fixed extras.
- Locations: every distinct place where action happens. Keep the count minimal and faithful.`;

const SCENE_SYSTEM = `You are a film pre-production planner for a text-to-video model that generates ONE continuous shot per scene (8-10 seconds). You return JSON only, no markdown, no commentary.

Schema for the response:
{
  "scenes": [
    {
      "n": 7,
      "location_id": "ghat",
      "characters": ["rina","karim"],
      "is_establishing": false,
      "chain_from_previous": true,
      "action": "max 25 words, ONE action",
      "camera": { "shot": "wide/medium/close-up", "angle": "eye level/low/high", "movement": "static/slow push/handheld" },
      "start_state": "where each character is, facing, holding, light",
      "end_state": "same, at the last frame",
      "dialogue": { "speaker": "rina", "line": "..." } or null,
      "sound": "diegetic ambience"
    }
  ]
}

Planning rules, in order of importance:
1. One shot, one main action per scene. Never cut in the middle of an action; end scenes when an action finishes.
2. Group scenes of the same location together. Before every location change insert an establishing shot (is_establishing true, no dialogue) and set chain_from_previous false for it.
3. start_state of scene N must equal end_state of scene N-1 whenever chain_from_previous is true.
4. Never use pronouns or nicknames for characters in scene fields. Use the bible character ids only; the app substitutes visual and voice locks. Do not write character names in action/start/end.
5. Respect max people per scene and max dialogue words. Dialogue is written in the character's language, in native script (Bangla script for Bangla, never romanized).
6. Dress and voice never change unless the character has outfit_changes true and the scene says so explicitly.
7. Use only location ids and character ids from the bible. No new characters or locations.
8. The number of scenes requested is exact; establishing shots count toward that number. Do not add scenes beyond the requested count.
9. Dialogue is flexible based on the story. A scene can feature one character speaking, or a brief natural dialogue exchange between visible characters if the story calls for it. For longer conversations, alternate across consecutive scenes (shot-reverse-shot) to maintain cinematic rhythm and clean lip sync. Keep total dialogue words within limits.
10. For a scene after a location change, the establishing shot re-establishes the place, then the next scene may chain from it.
11. Keep camera language simple and shootable in one clip.
12. If a character is not visible in a scene, do not list them in characters.`;

export async function generateBible(
  data: ProjectData,
  models?: { planner?: string; validator?: string; image?: string },
  signal?: AbortSignal,
): Promise<Bible> {
  const settings = data.project.settings;
  const user = `STORY:
${data.project.story}

PROJECT SETTINGS:
- Dialogue language: ${settings.dialogueLanguage}
- Visual style preset: ${settings.stylePreset}
- Style notes: ${settings.styleNote || "(none)"}
- Aspect ratio: ${settings.aspectRatio}
- Planned length: ${settings.totalMinutes} minutes, ${settings.clipSeconds}s clips

Return the story bible JSON.`;
  const raw = await chatJSON({
    role: "planner",
    schema: bibleSchema,
    temperature: 0.7,
    models,
    signal,
    messages: [
      { role: "system", content: BIBLE_SYSTEM },
      { role: "user", content: user },
    ],
  });
  return normalizeBible(raw, settings);
}

export function normalizeBible(bible: Bible, settings: Settings): Bible {
  const used = new Set<string>();
  const characters = bible.characters.map((character, index) => {
    let id = slugify(character.id || character.name) || `character-${index + 1}`;
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return {
      ...character,
      id,
      name: character.name.trim(),
      visual_lock: character.visual_lock.trim(),
      voice_lock: character.voice_lock.trim(),
      language: languageSchema.parse(character.language ?? settings.dialogueLanguage),
      outfit_changes: Boolean(character.outfit_changes),
    };
  });
  const usedLocations = new Set<string>();
  const locations = bible.locations.map((location, index) => {
    let id = slugify(location.id) || `location-${index + 1}`;
    while (usedLocations.has(id)) id = `${id}-${index + 1}`;
    usedLocations.add(id);
    return { ...location, id, visual_lock: location.visual_lock.trim() };
  });
  return {
    title: bible.title.trim() || "Untitled story",
    style_lock: bible.style_lock.trim(),
    characters,
    locations,
  };
}

const sceneResponseSchema = scenePlanSchema.or(sceneArraySchema);

export async function planSceneBatch(opts: {
  data: ProjectData;
  startN: number;
  count?: number;
  isAuto?: boolean;
  previousScenes: Scene[];
  models?: { planner?: string; validator?: string; image?: string };
  signal?: AbortSignal;
}): Promise<Scene[]> {
  const { data, startN, count = 5, isAuto = false, previousScenes, models, signal } = opts;
  const settings = data.project.settings;
  const bible = {
    title: data.project.name,
    style_lock: data.project.styleLock,
    characters: data.characters.map((character) => ({
      id: character.id,
      name: character.name,
      visual_lock: character.visual_lock,
      voice_lock: character.voice_lock,
      language: character.language,
      outfit_changes: character.outfit_changes,
    })),
    locations: data.locations.map((location) => ({
      id: location.id,
      visual_lock: location.visual_lock,
    })),
  };
  const user = `STORY:
${data.project.story}

STORY BIBLE:
${JSON.stringify(bible, null, 2)}

PROJECT SETTINGS:
- Mode: ${isAuto ? "Auto (Story-driven scene count)" : `Custom target (${count} scenes in this batch)`}
- Clip length: ${settings.clipSeconds} seconds per scene
- Max people per scene: ${settings.maxPeople}
- Dialogue enabled: ${settings.dialogueEnabled}
- Max dialogue words per scene: ${settings.maxDialogueWords}
- Default dialogue language: ${settings.dialogueLanguage}
- Ambient sound enabled: ${settings.ambientSound}
- Frame chaining: ${settings.frameChaining}
- Aspect ratio: ${settings.aspectRatio}
- These characters have outfit_changes: ${data.characters
    .filter((character) => character.outfit_changes)
    .map((character) => character.id)
    .join(", ") || "(none)"}

PREVIOUS SCENES (the last two already planned, for continuity):
${previousScenes.length ? JSON.stringify(previousScenes, null, 2) : "(none — this is the first batch)"}

${
  isAuto
    ? `TASK:
Analyze the complete story text and divide it into a natural, complete sequence of continuous 8-10 second shots from beginning to end. Create as many scenes as needed to tell the complete narrative faithfully without rushing or unnecessary filler. Number scenes sequentially starting at ${startN}. Include establishing shots before location changes. Return {"scenes":[...]} only.`
    : `TASK:
Write scenes ${startN} through ${startN + count - 1} (exactly ${count} scenes). Set n sequentially. Continue the location grouping and chaining from the previous scenes. Include establishing shots before location changes (they count toward the ${count}). Return {"scenes":[...]} only.`
}`;

  const raw = await chatJSON({
    role: "planner",
    schema: sceneResponseSchema,
    temperature: 0.2,
    models,
    signal,
    messages: [
      { role: "system", content: SCENE_SYSTEM },
      { role: "user", content: user },
    ],
  });
  const scenes = Array.isArray(raw) ? raw : raw.scenes;
  return scenes.map((scene) => sceneSchema.parse(scene));
}
