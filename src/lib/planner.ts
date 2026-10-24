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
- Dynamic Props Rule: Handheld props that change hands, are picked up, dropped, handed over, stolen, or revealed during the story (e.g., umbrella, stolen gold watch, lantern, bag, chicken inside umbrella) MUST NOT be included as permanent accessories in a character's visual_lock. They belong dynamically in the scene's action and props. Only permanent worn clothing/accessories (e.g., beanie, sandals, glasses, nose pin, uniform) belong in visual_lock.
- Animals and Talking Entities: Every character or animal that speaks, acts, or interacts in the story (e.g., chicken/মুরগি, pet dog, ghost/disguise) MUST be included in the story bible characters with a full visual_lock and voice_lock.
- Transformations & Metamorphosis Rule: When a character or animal undergoes a supernatural transformation into a distinctly different creature or form (e.g., cat -> giant black tiger, magician -> tiny green frog, person -> beast):
  1. Create a SEPARATE character entry in the story bible for the transformed creature/form (e.g. id: 'black-tiger', name: 'কালো বাঘ', with its own visual_lock and voice_lock; id: 'frog', name: 'সবুজ ব্যাঙ').
  2. The original character (e.g. 'mew') must have its OWN authentic initial voice lock (e.g. 'gentle domestic cat meows and purrs', NOT the tiger's booming voice!) and visual lock.
  3. In the scene where the transformation happens, include BOTH characters in "characters" and describe the morph in "action". In subsequent scenes, use the new form's character ID.
- Outfit Changes & Stripping Rule: When a character removes an outer garment (e.g. magician takes off blue robe and tall hat to reveal an undershirt and trousers beneath), set "outfit_changes": true. In the visual_lock, describe both the complete initial outfit AND what is worn underneath so subsequent scenes can accurately show them without the outer layer.
- Weather & Environment in Locations: Location visual_locks must only describe permanent architecture, natural landscape, and standard time of day. DO NOT put dynamic mid-story weather events into the location lock (e.g., do not say 'rainy night with puddles and falling rain' if rain only starts halfway through the story). Dynamic weather changes (like rain starting) belong strictly in the scene's action and lighting.
- Clothing disambiguation: Assign clearly distinct, contrasting clothing colors and silhouettes to each character (e.g. if one character wears dark blue, give other characters contrasting colors like green, yellow, or white) so video models never swap outfits.
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
      "dialogue": { "speaker": "rina", "line": "..." } or { "speaker": "rina, karim", "line": "রিনা: ...\\nকরিম: ..." } or null,
      "sound": "diegetic ambience"
    }
  ]
}

Planning rules, in order of importance:
1. One shot, one main action per scene. Never cut in the middle of an action; end scenes when an action finishes.
2. Group scenes of the same location together. Before every location change insert an establishing shot (is_establishing true, no dialogue) and set chain_from_previous false for it. Exception: When the total scene count is short (3 or fewer scenes) or when the story starts directly with characters engaged in action or dialogue at the starting location, do NOT insert an empty establishing shot; start scene 1 directly with the characters in action/dialogue so valuable screen time and story momentum are not wasted.
3. Complete Story & Dialogue Coverage: You MUST cover and pace the complete narrative arc of the story from beginning to end across the planned scenes, including all key dialogue exchanges, actions, climax, and resolution/punchline. Never truncate the story or stop after only the first line of dialogue.
4. start_state of scene N must equal end_state of scene N-1 whenever chain_from_previous is true.
5. Never use pronouns or nicknames for characters in scene fields. Use the bible character ids only; the app substitutes visual and voice locks. Do not write character names in action/start/end.
6. Respect max people per scene and max dialogue words. Dialogue is written in the character's language, in native script (Bangla script for Bangla, never romanized).
7. Dress and voice never change unless the character has outfit_changes true and the scene says so explicitly.
8. Use only location ids and character ids from the bible. No new characters or locations.
9. The number of scenes requested is exact; establishing shots (if any) count toward that number. Do not add scenes beyond the requested count.
10. Dialogue: A scene can feature one character speaking, or a natural dialogue exchange between visible characters if the story contains banter or conversation. Include character dialogue from the story faithfully in native script. For dialogue exchanges between characters in the same scene, list their IDs comma-separated in "speaker" (e.g. "banor, kumir") and include each line in "line" (e.g. "বানর: কুমির ভাই, তোমার মুখ এত বড় কেন?\\nকুমির: যাতে তোমার মতো বকবক করা প্রাণীকে এক কামড়ে খেতে পারি!"). All speakers listed in dialogue must be in the scene's "characters" list.
11. For a scene after a location change, the establishing shot re-establishes the place, then the next scene may chain from it. When scene N chains from an empty establishing shot (or a scene with no characters), ALL characters appearing in scene N must explicitly enter or emerge into the frame during the action (e.g. "poltu runs into frame; bhoot steps out from behind the trunk"), NEVER described as already sitting, standing, or posed in place at the start frame.
12. Keep camera language simple and shootable in one clip.
13. Complete Characters List: If ANY character, animal, or entity appears, acts, emerges, is revealed (e.g. chicken popping out of umbrella), or speaks in a scene, they MUST be listed in that scene's "characters" array. Never omit a character that acts or appears in the action.
14. Character Drop / Subset Paradox: If scene N contains characters that are omitted or dropped in scene N+1 (e.g. scene N has 3 people, but scene N+1 focuses on only 1 or 2 people without the others having walked out of frame), scene N+1 MUST NOT be chained (set "chain_from_previous": false). A continuous shot cannot magically vaporize people who were in the previous frame.
15. Shot-scale continuity: Do not jump directly between a wide shot and a close-up while chain_from_previous is true unless camera movement is rapid push/zoom. A static camera jump between wide and close-up is a cut (set chain_from_previous false).
16. Prop continuity & Dynamic Handoff: If a character was empty-handed in the previous scene, do not start with them holding a new prop in a chained take; have them pick up or take out the prop during the action. When a prop changes hands (e.g., umbrella given from ghost to thief), describe the handoff in action, and ensure the original owner does not continue holding a duplicate prop in subsequent scenes.
17. Dialogue-Action Chronology: Dialogue in scene N must strictly match the action of scene N. Do not speak dialogue anticipating future events or reacting to actions before they occur (e.g. an explanation of why an umbrella is needed must be spoken before opening the umbrella, not after something else pops out).
18. Dialogue camera angle: When a scene contains dialogue, the speaking character's face must be visible to the camera (front view, 3/4 angle, or profile), never facing directly away from camera.
19. Outfit Change & Stripping Continuity: In the scene where a character with outfit_changes: true removes or strips their robe, hat, coat, or jacket, that action MUST be explicitly depicted in "action". Subsequent scenes MUST specify their new current appearance in start_state and action (e.g., 'wearing only his white undershirt and brown trousers, without hat or robe').
20. Transformation & Metamorphosis Continuity: In the scene where a character transforms (e.g. cat into tiger, or magician into frog), include both IDs in "characters" (e.g. ["nilu", "mew", "black-tiger"]). The scene action must show the metamorphosis (e.g. 'mew is enveloped in blue smoke and morphs into a giant black-tiger'). In all subsequent scenes where the transformed creature appears, use the new form's ID ('black-tiger' or 'frog'), so keyframe images, video prompts, and voices match the transformed creature perfectly.
21. Dynamic Feature Shifts & Surface States (Eye LEDs, laser glows, mud splatters): When the story explicitly describes a dynamic change to a character's visual features or surface state (e.g. robot dog's eyes turning from cyan-blue to glowing angry red LED before firing laser beams; character getting covered/splattered in wet brown mud from a fall), you MUST explicitly include this visual state change in the scene's "action" and "end_state". Do not omit dynamic light or surface changes that depict story action.`;

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
  totalScenes?: number;
  isAuto?: boolean;
  previousScenes: Scene[];
  models?: { planner?: string; validator?: string; image?: string };
  signal?: AbortSignal;
}): Promise<Scene[]> {
  const { data, startN, count = 5, totalScenes, isAuto = false, previousScenes, models, signal } = opts;
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
Analyze the complete story text and divide it into a natural, complete sequence of continuous 8-10 second shots from beginning to end. Cover the full story arc including all dialogues and the conclusion. Create as many scenes as needed to tell the complete narrative faithfully without rushing or unnecessary filler. Number scenes sequentially starting at ${startN}. Include establishing shots before location changes. Return {"scenes":[...]} only.`
    : `TASK:
Write scenes ${startN} through ${startN + count - 1} (exactly ${count} scenes).
${
  totalScenes && totalScenes === count && startN === 1
    ? `IMPORTANT: This is the ENTIRE video production (${totalScenes} scenes total). You MUST pace and tell the COMPLETE story from start to finish within these ${totalScenes} scenes, including all key dialogues, the main interaction/conflict, and the final climax/punchline! Do NOT leave out the later parts of the story. Do NOT waste scene 1 on an empty establishing shot—bring the characters into the action immediately so every scene advances the story.`
    : totalScenes
      ? `This is scenes ${startN} to ${startN + count - 1} of ${totalScenes} total planned scenes. Pace the story so the complete narrative arc fits across all ${totalScenes} scenes.`
      : ""
}
Set n sequentially. Continue the location grouping and chaining from the previous scenes. Return {"scenes":[...]} only.`
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
