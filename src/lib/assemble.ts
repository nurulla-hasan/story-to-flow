import { findLocation } from "./db/repo";
import type { CharacterRecord, ProjectData, SceneRecord } from "./types";
import { languageLabel, styleLockForPreset } from "./types";

export interface AssembleOptions {
  reinforcements?: string[];
  extraRules?: string[];
}

export function projectStyleLock(data: ProjectData): string {
  const { project } = data;
  if (project.styleLock.trim()) return project.styleLock.trim();
  const presetLock = styleLockForPreset(
    project.settings.stylePreset,
    project.settings.styleNote,
  );
  if (presetLock) return presetLock;
  const note = project.settings.styleNote.trim();
  return `${project.settings.stylePreset}${note ? `. ${note}` : ""}`;
}

export function getActiveVisualLock(
  character: CharacterRecord,
  scene: SceneRecord,
  allScenes: SceneRecord[] = [],
): string {
  if (!character.outfit_changes) {
    return character.visual_lock;
  }

  // Check if an outfit removal or change occurred up to this scene
  const relevantScenes = allScenes.filter((s) => s.n <= scene.n);
  const context = [
    ...relevantScenes.map((s) => `${s.action} ${s.start_state} ${s.end_state}`),
    scene.start_state,
    scene.action,
  ].join(" ");

  const strippedRegex =
    /\b(removes?|takes? off|drops?|sheds?|strips?|unbuttons?)\s+([a-zA-Z\s,]+)?\b(robe|hat|cloak|coat|jacket|outerwear)\b/i;
  const noRobeRegex =
    /\b(no\s+(hat|robe|coat|jacket|cloak)|without\s+(hat|robe|coat|jacket|cloak)|in\s+(white\s+)?(undershirt|shirt|t-shirt|pants|trousers))\b/i;

  const hasStripped = strippedRegex.test(context) || noRobeRegex.test(scene.start_state + " " + scene.action);
  if (!hasStripped) {
    return character.visual_lock;
  }

  const lock = character.visual_lock;
  const outerMatch = lock.match(
    /\b(dressed in|wears a|wearing a)\s+([a-zA-Z\s,.-]+?\b(robe|hat|cloak|coat|jacket))/i,
  );
  const baseMatch = lock.match(
    /\b(layered over|over|underneath|under which|beneath|revealing)\s+([a-zA-Z\s,.-]+?\b(undershirt|shirt|t-shirt|trousers|pants|shoes|dhoti|kurta)[a-zA-Z\s,.-]*)/i,
  );

  if (baseMatch) {
    const physical = outerMatch ? lock.slice(0, outerMatch.index).trim() : lock.split(".")[0] + ".";
    const baseLayer = baseMatch[2].replace(/\.$/, "").trim();
    return `${physical} Current outfit for this scene: wearing ${baseLayer} (outer hat, robe, and cloak removed).`;
  }

  return character.visual_lock;
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
      const activeLock = getActiveVisualLock(character, scene, data.scenes);
      const displayName =
        character.name.toLowerCase() === character.id.toLowerCase()
          ? character.name
          : `${character.name} (${character.id})`;
      lines.push(
        `- ${displayName}: ${activeLock} Voice: ${character.voice_lock}.`,
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
      for (const character of characters) {
        if (character.outfit_changes) {
          const activeLock = getActiveVisualLock(character, scene, data.scenes);
          if (activeLock !== character.visual_lock) {
            must.push(
              `${character.name} is dressed in their current scene outfit (outer hat, robe, or coat removed). Do not draw them in the original outer robe or hat.`,
            );
          }
        }
      }
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

    const hasDynamicVisualState =
      /\b(eyes?\s+(turn|glow|light\s+up|flashing)\s+[a-z]+|covered\s+in\s+mud|mud-splattered|splattered\s+with\s+mud|muddy)\b/i.test(
        `${scene.action} ${scene.start_state} ${scene.end_state}`,
      );
    if (hasDynamicVisualState) {
      must.push(
        "Depict any dynamic visual state changes described in the action (such as eye LED colors or mud splatters) clearly and accurately in this take.",
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isStartingFrameEmpty(scene: SceneRecord, data?: ProjectData): boolean {
  if (scene.is_establishing || scene.characters.length === 0) return true;

  const startState = (scene.start_state || "").trim();
  const startStateLower = startState.toLowerCase();

  // If any visible character is explicitly mentioned as present in start_state, the frame is NOT empty!
  const hasCharInStart = scene.characters.some((id) =>
    new RegExp(`(?<![-_\\w])${escapeRegex(id)}(?![-_\\w])`, "i").test(startState),
  );
  if (hasCharInStart) {
    return false;
  }

  // Explicit empty setting phrases (NOT standalone "clearing" which matches "sky clearing" or "smoke clearing")
  const explicitEmptyPhrase =
    /\b(empty\s+(location|setting|courtyard|room|bridge|area|clearing|scene|banyan|street|forest|ground)|location\s+(is\s+|starts\s+)?empty|nobody\s+(is\s+|in\s+)?visible|no\s+characters?\s+(visible|in\s+frame)|completely\s+empty)\b/i;

  if (explicitEmptyPhrase.test(startStateLower)) {
    return true;
  }

  // Chaining from an empty previous scene where characters enter during the take
  if (data && scene.chain_from_previous && scene.n > 1) {
    const prevScene = data.scenes.find((s) => s.n === scene.n - 1);
    const prevHadNoChars =
      prevScene && (prevScene.characters.length === 0 || prevScene.is_establishing);
    const currentEnters = /\b(enters?|walks?|steps?|runs?|comes?)\s+(into|in|onto|the\s+frame)\b/i.test(
      scene.action || "",
    );
    if (prevHadNoChars && currentEnters) {
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
      const activeLock = getActiveVisualLock(character, scene, data.scenes);
      lines.push(`- ${character.name}: ${activeLock}`);
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
