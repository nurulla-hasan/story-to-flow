import {
  cameraSchema,
  canonicalScene,
  dialogueSchema,
  sceneSchema,
  type ProjectData,
  type Scene,
} from "./types";

/**
 * Validator output is structured field edits, never a free-form prompt.
 * Only whitelisted fields are applied, then the whole scene is re-validated.
 */
export function applySceneFieldEdits(
  data: ProjectData,
  scene: Scene,
  edits: Array<{ field: string; value: unknown }>,
): Partial<Scene> {
  const next = canonicalScene(scene);
  for (const edit of edits) {
    const value = edit.value;
    switch (edit.field) {
      case "action":
      case "start_state":
      case "end_state":
      case "sound":
        if (typeof value === "string") {
          next[edit.field] = value.slice(0, 2000).trim();
        }
        break;
      case "location_id":
        if (
          typeof value === "string" &&
          data.locations.some((location) => location.id === value)
        ) {
          next.location_id = value;
        }
        break;
      case "characters":
        if (Array.isArray(value)) {
          const known = new Set(data.characters.map((character) => character.id));
          next.characters = [
            ...new Set(value.filter((id): id is string => typeof id === "string" && known.has(id))),
          ].slice(0, data.project.settings.maxPeople);
        }
        break;
      case "dialogue":
        if (value === null) {
          next.dialogue = null;
        } else {
          const parsed = dialogueSchema.safeParse(value);
          if (parsed.success) next.dialogue = parsed.data;
        }
        break;
      case "camera": {
        const parsed = cameraSchema.safeParse(value);
        if (parsed.success) next.camera = parsed.data;
        break;
      }
      case "camera.shot":
      case "camera.angle":
      case "camera.movement":
        if (typeof value === "string") {
          const key = edit.field.split(".")[1] as "shot" | "angle" | "movement";
          next.camera[key] = value.slice(0, 200);
        }
        break;
      case "is_establishing":
        if (typeof value === "boolean") next.is_establishing = value;
        break;
      case "chain_from_previous":
        if (typeof value === "boolean") next.chain_from_previous = value;
        break;
      default:
        break;
    }
  }

  if (next.is_establishing) next.dialogue = null;
  if (next.dialogue && !next.characters.includes(next.dialogue.speaker)) {
    next.dialogue = null;
  }
  const parsed = sceneSchema.safeParse({ ...next, n: scene.n });
  if (!parsed.success) return {};

  const patch: Partial<Scene> = {};
  for (const key of [
    "location_id",
    "characters",
    "is_establishing",
    "chain_from_previous",
    "action",
    "camera",
    "start_state",
    "end_state",
    "dialogue",
    "sound",
  ] as const) {
    if (JSON.stringify(next[key]) !== JSON.stringify(scene[key])) {
      (patch as Record<string, unknown>)[key] = next[key];
    }
  }
  return patch;
}
