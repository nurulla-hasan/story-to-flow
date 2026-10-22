import { z } from "zod";
import { getRepo } from "./db";
import { chatJSON } from "./llm";
import { reassembleAll } from "./pipeline";
import {
  cameraSchema,
  characterFieldSchema,
  chatOpsSchema,
  dialogueSchema,
  languageSchema,
  settingsSchema,
  type ChatOp,
  type ProjectData,
} from "./types";

const CHAT_SYSTEM = `You edit a production plan for an AI video. You do not write prompts; the app assembles them from locks with code. You return JSON operations only, no markdown.

Schema:
{
  "summary": "one short sentence describing the change",
  "ops": [
    { "op": "set_character_field", "character_id": "rina", "field": "visual_lock", "value": "...", "reason": "..." },
    { "op": "update_scene", "n": 12, "field": "action", "value": "...", "reason": "..." },
    { "op": "split_scene", "n": 12, "first": {...}, "second": {...}, "reason": "..." },
    { "op": "merge_scenes", "n": 12, "merged": {...}, "reason": "..." },
    { "op": "delete_scene", "n": 12, "reason": "..." },
    { "op": "add_rule", "text": "...", "reason": "..." },
    { "op": "set_setting", "key": "dialogueLanguage", "value": "bn", "reason": "..." }
  ]
}

Character fields: name, visual_lock, voice_lock, language, outfit_changes.
Scene fields: location_id, characters, action, start_state, end_state, sound, dialogue, camera, is_establishing, chain_from_previous.
Setting keys: dialogueLanguage, accentNote, totalMinutes, clipSeconds, aspectRatio, stylePreset, styleNote, maxPeople, dialogueEnabled, maxDialogueWords, ambientSound, frameChaining, negativeList, validatorStrictness, imageProvider, models.

Rules:
- Return the smallest set of operations. Do not re-plan the whole project for a small edit.
- For a lock change ("her saree should be blue from now on"), use set_character_field; every affected prompt re-assembles automatically.
- A visual_lock must stay 40-60 words of visual facts only (age, face, hair, skin, dress, accessories). A voice_lock must stay concrete (age, pitch, speed, accent, mood).
- Characters and locations must use existing ids. Never invent ids.
- For update_scene, send the FULL new value for the field, not a fragment.
- Dialogue must be in the speaker's language and native script, at most the project's max dialogue words. Use {"speaker":"id","line":"..."} or null.
- Max people per scene must be respected.
- If the user asks a conversational question, greeting (e.g. "kemon acho?", "hi"), or asks a general question about the project without requesting changes, provide a friendly and helpful response in "summary" (reply in Bangla if asked in Bangla) and return an empty array "ops": [].
- If the user requests a change, return the smallest set of structured operations in "ops" and a concise description in "summary".
- Keep scene numbering automatic: split/merge/delete renumber every following scene.`;

export async function planChat(projectId: string, message: string) {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  const result = await chatJSON({
    role: "planner",
    schema: chatOpsSchema,
    temperature: 0.1,
    models: data.project.settings.models,
    messages: [
      { role: "system", content: CHAT_SYSTEM },
      {
        role: "user",
        content: `PROJECT:
${JSON.stringify(
  {
    name: data.project.name,
    settings: data.project.settings,
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
      name: location.name,
      visual_lock: location.visual_lock,
    })),
    rules: data.rules.map((rule) => rule.text),
    scenes: data.scenes.map((scene) => ({
      n: scene.n,
      location_id: scene.location_id,
      characters: scene.characters,
      is_establishing: scene.is_establishing,
      chain_from_previous: scene.chain_from_previous,
      action: scene.action,
      camera: scene.camera,
      start_state: scene.start_state,
      end_state: scene.end_state,
      dialogue: scene.dialogue,
      sound: scene.sound,
      status: scene.status,
    })),
  },
  null,
  2,
)}

USER REQUEST:
${message}

Return the JSON.`,
      },
    ],
  });
  return { ...result, diff: describeOps(data, result.ops) };
}

export function describeOps(data: ProjectData, ops: ChatOp[]): string[] {
  const lines: string[] = [];
  for (const op of ops) {
    switch (op.op) {
      case "set_character_field": {
        const character = data.characters.find((item) => item.id === op.character_id);
        if (!character) {
          lines.push(`Unknown character "${op.character_id}" (will be skipped)`);
          break;
        }
        const old = String(character[op.field as keyof typeof character] ?? "");
        lines.push(
          `${character.name} · ${op.field}: "${truncate(old)}" → "${truncate(String(op.value))}"`,
        );
        break;
      }
      case "update_scene": {
        const scene = data.scenes.find((item) => item.n === op.n);
        if (!scene) {
          lines.push(`Unknown scene ${op.n} (will be skipped)`);
          break;
        }
        lines.push(
          `Scene ${op.n} · ${op.field}: "${truncate(fieldValue(scene, op.field))}" → "${truncate(String(op.value))}"`,
        );
        break;
      }
      case "split_scene":
        lines.push(`Split scene ${op.n} into two scenes (following scenes renumber).`);
        break;
      case "merge_scenes":
        lines.push(`Merge scenes ${op.n} and ${op.n + 1} into one.`);
        break;
      case "delete_scene":
        lines.push(`Delete scene ${op.n} (following scenes renumber).`);
        break;
      case "add_rule":
        lines.push(`Add global rule: "${truncate(op.text)}"`);
        break;
      case "set_setting":
        lines.push(
          `Setting ${op.key}: "${truncate(JSON.stringify(data.project.settings[op.key as keyof typeof data.project.settings] ?? ""))}" → "${truncate(JSON.stringify(op.value))}"`,
        );
        break;
      default:
        break;
    }
  }
  return lines;
}

function truncate(text: string, max = 140): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function fieldValue(scene: object, field: string): string {
  const value = (scene as Record<string, unknown>)[field];
  return typeof value === "string" ? value : JSON.stringify(value);
}

function invalid(message: string): never {
  throw new Error(message);
}

export function applyChatOps(projectId: string, ops: ChatOp[]) {
  const repo = getRepo();
  let structural = 0;
  let edits = 0;

  for (const op of ops) {
    switch (op.op) {
      case "set_character_field": {
        const character = repo
          .getCharacters(projectId)
          .find((item) => item.id === op.character_id);
        if (!character) invalid(`Character "${op.character_id}" not found.`);
        const field = characterFieldSchema.safeParse(op.field);
        if (!field.success) invalid(`Unknown character field "${op.field}".`);
        let value: unknown = op.value;
        if (op.field === "name") {
          value = z.string().trim().min(1).max(120).parse(op.value);
        } else if (op.field === "visual_lock") {
          value = z.string().trim().min(20).max(1200).parse(op.value);
        } else if (op.field === "voice_lock") {
          value = z.string().trim().min(10).max(600).parse(op.value);
        } else if (op.field === "language") {
          value = languageSchema.parse(op.value);
        } else if (op.field === "outfit_changes") {
          value = z.boolean().parse(op.value);
        }
        repo.updateCharacter(projectId, op.character_id, { [op.field]: value });
        edits += 1;
        break;
      }
      case "update_scene": {
        const scene = repo.getScene(projectId, op.n);
        if (!scene) invalid(`Scene ${op.n} not found.`);
        const patch: Record<string, unknown> = {};
        switch (op.field) {
          case "location_id": {
            const value = z.string().min(1).parse(op.value);
            if (!repo.getProjectData(projectId).locations.some((loc) => loc.id === value)) {
              invalid(`Location "${value}" not found.`);
            }
            patch.location_id = value;
            break;
          }
          case "characters": {
            const list = z.array(z.string()).parse(op.value);
            const known = new Set(
              repo.getCharacters(projectId).map((character) => character.id),
            );
            const filtered = [...new Set(list.filter((id) => known.has(id)))].slice(
              0,
              repo.getProject(projectId).settings.maxPeople,
            );
            patch.characters = filtered;
            break;
          }
          case "action":
          case "start_state":
          case "end_state":
          case "sound":
            patch[op.field] = z.string().min(0).max(2000).parse(op.value);
            break;
          case "dialogue":
            patch.dialogue = dialogueSchema.nullable().parse(op.value);
            break;
          case "camera":
            patch.camera = cameraSchema.parse(op.value);
            break;
          case "is_establishing":
          case "chain_from_previous":
            patch[op.field] = z.boolean().parse(op.value);
            break;
        }
        repo.updateScene(projectId, op.n, patch);
        edits += 1;
        break;
      }
      case "split_scene": {
        const existing = repo.getScene(projectId, op.n);
        if (!existing) invalid(`Scene ${op.n} not found.`);
        repo.splitScene(projectId, op.n, op.first, op.second);
        structural += 1;
        break;
      }
      case "merge_scenes": {
        const first = repo.getScene(projectId, op.n);
        if (!first) invalid(`Scene ${op.n} not found.`);
        repo.mergeScenes(projectId, op.n, op.merged);
        structural += 1;
        break;
      }
      case "delete_scene": {
        const existing = repo.getScene(projectId, op.n);
        if (!existing) invalid(`Scene ${op.n} not found.`);
        repo.deleteScene(projectId, op.n);
        structural += 1;
        break;
      }
      case "add_rule": {
        const text = z.string().trim().min(1).max(400).parse(op.text);
        repo.addRule(projectId, text);
        edits += 1;
        break;
      }
      case "set_setting": {
        const shape = settingsSchema.shape as Record<string, z.ZodType>;
        const fieldSchema = shape[op.key];
        if (!fieldSchema) invalid(`Unknown setting "${op.key}".`);
        if (op.key === "models") {
          const value = z
            .object({
              planner: z.string().optional(),
              validator: z.string().optional(),
              image: z.string().optional(),
            })
            .parse(op.value);
          repo.updateProject(projectId, { settings: { models: value as never } });
        } else {
          const value = fieldSchema.parse(op.value);
          repo.updateProject(projectId, {
            settings: { [op.key]: value } as never,
          });
        }
        edits += 1;
        break;
      }
      default:
        break;
    }
  }

  const changedPrompts = reassembleAll(projectId);
  return {
    edits,
    structural,
    changedPrompts,
    scenes: repo.getScenes(projectId).length,
  };
}
