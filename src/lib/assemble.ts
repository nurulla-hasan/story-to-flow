import { findLocation } from "./db/repo";
import type { ProjectData, SceneRecord } from "./types";
import { languageLabel } from "./types";

export interface AssembleOptions {
  reinforcements?: string[];
  extraRules?: string[];
}

export function projectStyleLock(data: ProjectData): string {
  const { project } = data;
  if (project.styleLock.trim()) return project.styleLock.trim();
  const note = project.settings.styleNote.trim();
  return `${project.settings.stylePreset}${note ? `. ${note}` : ""}`;
}

function visibleCharacters(data: ProjectData, scene: SceneRecord) {
  return scene.characters
    .map((id) => data.characters.find((character) => character.id === id))
    .filter((character): character is NonNullable<typeof character> => Boolean(character));
}

/**
 * Deterministic prompt assembly. The LLM never writes this text. Locks are
 * inserted verbatim so every scene keeps the same face, dress, voice and place.
 */
export function assemblePrompt(
  data: ProjectData,
  scene: SceneRecord,
  options: AssembleOptions = {},
): string {
  const { project, rules } = data;
  const settings = project.settings;
  const location = findLocation(data, scene.location_id);
  const characters = visibleCharacters(data, scene);
  const names = characters.map((character) => character.name);
  const lines: string[] = [];

  lines.push(projectStyleLock(data));
  lines.push("");
  lines.push(`LOCATION: ${location.visual_lock}`);
  lines.push("");
  lines.push("CHARACTERS:");
  if (characters.length === 0) {
    lines.push("- No characters visible in this establishing shot.");
  } else {
    for (const character of characters) {
      const displayName =
        character.name.toLowerCase() === character.id.toLowerCase()
          ? character.name
          : `${character.name} (${character.id})`;
      lines.push(
        `- ${displayName}: ${character.visual_lock} Voice: ${character.voice_lock}.`,
      );
    }
  }
  lines.push("");
  lines.push(
    `SHOT: ${scene.camera.shot}, ${scene.camera.angle}, ${scene.camera.movement}.`,
  );
  lines.push(`START: ${scene.start_state}`);
  lines.push(`ACTION: ${scene.action}`);
  lines.push(`END: ${scene.end_state}`);

  const speaker = scene.dialogue
    ? data.characters.find((character) => character.id === scene.dialogue?.speaker)
    : undefined;
  const speakerName = speaker?.name ?? scene.dialogue?.speaker ?? "";
  const dialogueLanguage = speaker?.language ?? settings.dialogueLanguage;
  if (settings.dialogueEnabled && scene.dialogue) {
    if (scene.dialogue.line.includes(":") || scene.dialogue.speaker.includes(",") || scene.dialogue.speaker.includes("&")) {
      const formattedLine = scene.dialogue.line.replace(/\r?\n+/g, " | ");
      lines.push(
        `DIALOGUE: Short conversation in ${languageLabel(dialogueLanguage)}: "${formattedLine}". Voices and accents match the character locks.`,
      );
    } else {
      const formattedLine = scene.dialogue.line.replace(/\r?\n+/g, " ");
      lines.push(
        `DIALOGUE: ${speakerName} says in ${languageLabel(dialogueLanguage)}, "${formattedLine}". Same voice as in every other scene.`,
      );
    }
  } else {
    lines.push("DIALOGUE: No dialogue.");
  }

  const sound = scene.sound.trim() || "Natural ambience of the location";
  lines.push(
    `AUDIO: ${sound}.${settings.ambientSound ? "" : " No background music."}`,
  );
  lines.push("");

  const must: string[] = [];
  if (characters.length > 0) {
    must.push(
      `Only these characters are visible: ${names.join(", ")}. No other people or faces.`,
    );

    const hasOutfitChanges = characters.some((c) => c.outfit_changes);
    const isTransforming = /\b(transforms?|morphs?|turns? into|becomes?|transformed)\b/i.test(scene.action);

    if (isTransforming) {
      must.push(
        "Character transformation/metamorphosis occurs smoothly during the take: the character morphs into the new form within this continuous shot.",
      );
    } else if (hasOutfitChanges) {
      must.push(
        "Keep face, skin tone, and character identity consistent. Clothing and accessories follow the scene action and state as outfit changes are permitted.",
      );
    } else {
      must.push(
        "Keep every face, hair, skin tone, dress, accessory and voice exactly as locked above for the whole clip.",
      );
    }

    if (characters.length >= 2) {
      must.push(
        "Do not swap or blend clothing, colors, faces, or accessories between different characters in the scene.",
      );
    }
  }
  if (scene.is_establishing) {
    must.push(
      "Establishing shot: show the location clearly before any action. No dialogue.",
    );
  }
  if (settings.frameChaining && scene.chain_from_previous && scene.n > 1) {
    const prevScene = data.scenes.find((s) => s.n === scene.n - 1);
    const prevExited =
      Boolean(prevScene && /\b(exits?|walks? off|leaves?|runs? off|disappears?|walks? away|out of frame)\b/i.test(prevScene.action || ""));
    const prevHadNoChars =
      prevScene && (prevScene.characters.length === 0 || prevScene.is_establishing || prevExited);
    const currentHasChars = characters.length > 0;

    if (prevHadNoChars && currentHasChars) {
      must.push(
        `Start with the location empty matching the last frame of Scene ${scene.n - 1}. Characters enter the frame during the take.`,
      );
      if (scene.startFramePath) {
        must.push(
          `The supplied start frame (last frame of Scene ${scene.n - 1}, showing the empty location) is the literal first frame of this clip.`,
        );
      }
    } else {
      must.push(
        `Continue directly from the last frame of Scene ${scene.n - 1}: same positions, facing, props and light at the first frame.`,
      );
      if (scene.startFramePath) {
        must.push(
          `The supplied start frame (last frame of Scene ${scene.n - 1}) is the literal first frame of this clip.`,
        );
      }
    }
  }
  if (settings.frameChaining && !scene.chain_from_previous && scene.n > 1) {
    must.push(
      "New shot: do not continue the previous framing; match only the style, characters and location locks.",
    );
  }
  must.push("One continuous take. One main action. No cut inside the clip.");
  if (scene.dialogue && settings.dialogueEnabled) {
    must.push(
      `Lip movement matches the spoken dialogue accurately. Maximum ${settings.maxDialogueWords} words.`,
    );
  } else {
    must.push("No speech, no lip movement.");
  }
  if (settings.accentNote.trim() && scene.dialogue && settings.dialogueEnabled) {
    must.push(`Accent: ${settings.accentNote.trim()}.`);
  }
  for (const rule of rules) must.push(rule.text);
  for (const rule of options.extraRules ?? []) must.push(rule);
  for (const line of options.reinforcements ?? []) must.push(line);

  lines.push(`MUST: ${must.map((item) => `- ${item}`).join("\n")}`);
  lines.push(`AVOID: ${settings.negativeList}`);
  return lines.join("\n");
}

export function isStartingFrameEmpty(scene: SceneRecord, data?: ProjectData): boolean {
  if (scene.is_establishing || scene.characters.length === 0) return true;

  const startStateLower = (scene.start_state || "").toLowerCase();
  const startsEmptyWords = /\b(empty|nobody|no characters?|unoccupied|clearing)\b/i;

  if (startsEmptyWords.test(startStateLower)) {
    return true;
  }

  if (data && scene.chain_from_previous && scene.n > 1) {
    const prevScene = data.scenes.find((s) => s.n === scene.n - 1);
    const prevHadNoChars = prevScene && (prevScene.characters.length === 0 || prevScene.is_establishing);
    if (prevHadNoChars) {
      return true;
    }
  }

  return false;
}

/**
 * Image prompt for the keyframe at the start of a scene. Code-built, same as
 * the master prompt; no LLM involvement.
 */
export function assembleImagePrompt(data: ProjectData, scene: SceneRecord): string {
  const { project } = data;
  const settings = project.settings;
  const location = findLocation(data, scene.location_id);
  const characters = visibleCharacters(data, scene);
  const startingEmpty = isStartingFrameEmpty(scene, data);
  const lines: string[] = [];
  lines.push(projectStyleLock(data));
  lines.push("");
  lines.push("Keyframe image, the first frame of the scene. No text, no captions.");
  lines.push("");
  lines.push(`LOCATION: ${location.visual_lock}`);
  lines.push("");
  if (startingEmpty) {
    lines.push("CHARACTERS:");
    lines.push(
      "- No characters visible in this starting frame; the location starts empty before characters enter.",
    );
    lines.push("");
  } else if (characters.length) {
    lines.push("CHARACTERS:");
    for (const character of characters) {
      lines.push(`- ${character.name}: ${character.visual_lock}`);
    }
    lines.push("");
  }
  lines.push(`MOMENT: ${scene.start_state}`);
  lines.push(
    `CAMERA: ${scene.camera.shot}, ${scene.camera.angle}, ${scene.camera.movement}.`,
  );
  lines.push(
    `ASPECT RATIO: ${settings.aspectRatio}. Style preset: ${settings.stylePreset}.`,
  );
  if (settings.styleNote.trim()) lines.push(`STYLE NOTE: ${settings.styleNote.trim()}`);
  if (startingEmpty) {
    lines.push(
      "Match the location reference exactly with the setting completely empty and pristine, ready for action.",
    );
  } else {
    lines.push(
      "Match the character reference images and location reference exactly. Keep the same face, dress and light as every other keyframe.",
    );
  }
  return lines.join("\n");
}

export function assembleScene(
  data: ProjectData,
  scene: SceneRecord,
  options: AssembleOptions = {},
): { prompt: string; imagePrompt: string } {
  return {
    prompt: assemblePrompt(data, scene, options),
    imagePrompt: assembleImagePrompt(data, scene),
  };
}
