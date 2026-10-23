import { projectStyleLock } from "./assemble";
import type { ProjectData, SceneRecord } from "./types";
import { languageLabel } from "./types";

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  field?: string;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Deterministic checks. Runs before any LLM validation and is fully covered by
 * unit tests. Returns [] for a clean scene.
 */
export function deterministicChecksForScene(
  data: ProjectData,
  scene: SceneRecord,
  prompt: string,
  imagePrompt: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { project } = data;
  const settings = project.settings;
  const error = (code: string, message: string, field?: string) =>
    issues.push({ code, message, severity: "error", field });
  const warning = (code: string, message: string, field?: string) =>
    issues.push({ code, message, severity: "warning", field });

  // Empty required fields.
  const required: Array<[string, string]> = [
    ["location_id", scene.location_id],
    ["action", scene.action],
    ["camera.shot", scene.camera.shot],
    ["camera.angle", scene.camera.angle],
    ["camera.movement", scene.camera.movement],
    ["start_state", scene.start_state],
    ["end_state", scene.end_state],
  ];
  for (const [field, value] of required) {
    if (!value || !value.trim()) error("empty_field", `${field} is empty.`, field);
  }

  // Location and characters must exist in the bible.
  const location = data.locations.find((item) => item.id === scene.location_id);
  if (!location) {
    error(
      "unknown_location",
      `Location "${scene.location_id}" is not in the story bible.`,
      "location_id",
    );
  }
  const visible = scene.characters
    .map((id) => data.characters.find((character) => character.id === id))
    .filter((character): character is NonNullable<typeof character> => Boolean(character));
  if (visible.length !== scene.characters.length) {
    error(
      "unknown_character",
      "One or more characters in the scene are not in the story bible.",
      "characters",
    );
  }
  if (visible.length > settings.maxPeople) {
    error(
      "too_many_people",
      `${visible.length} characters are visible; max people per scene is ${settings.maxPeople}.`,
      "characters",
    );
  }
  if (scene.is_establishing && scene.dialogue) {
    error(
      "establishing_dialogue",
      "An establishing shot cannot contain dialogue.",
      "dialogue",
    );
  }

  // Dialogue rules.
  if (scene.dialogue && !settings.dialogueEnabled) {
    error("dialogue_disabled", "Dialogue is turned off in settings.", "dialogue");
  }
  if (scene.dialogue) {
    const isConversation =
      scene.dialogue.line.includes(":") ||
      scene.dialogue.speaker.includes(",") ||
      scene.dialogue.speaker.includes("&");
    const limit = isConversation
      ? Math.max(settings.maxDialogueWords, 45)
      : settings.maxDialogueWords;
    const words = countWords(scene.dialogue.line);
    if (words > limit) {
      error(
        "dialogue_too_long",
        `Dialogue has ${words} words; the limit is ${limit}.`,
        "dialogue",
      );
    }
    const speakers = scene.dialogue.speaker
      .split(/[,&/]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const visibleChars = scene.characters.map((c) => c.toLowerCase());
    const missingSpeakers = speakers.filter((s) => !visibleChars.includes(s));
    if (missingSpeakers.length > 0) {
      error(
        "speaker_not_visible",
        `Dialogue speaker "${missingSpeakers.join(", ")}" is not visible in this scene.`,
        "dialogue",
      );
    }
    for (const speakerId of speakers) {
      const character = data.characters.find(
        (item) => item.id.toLowerCase() === speakerId,
      );
      if (character && character.language !== settings.dialogueLanguage) {
        // Per-character override is allowed; this is informational only.
        warning(
          "language_override",
          `Speaker ${character.name} uses ${languageLabel(character.language)} rather than the project language.`,
          "dialogue",
        );
      }
    }
  }

  // Locks must be present verbatim in every prompt.
  const style = projectStyleLock(data);
  if (!style || !prompt.includes(style)) {
    error("style_lock_missing", "The style lock is missing from the prompt.");
  }
  if (location && !prompt.includes(location.visual_lock)) {
    error(
      "location_lock_missing",
      "The location visual lock is not verbatim in the prompt.",
    );
  }
  for (const character of visible) {
    if (!prompt.includes(character.visual_lock)) {
      error(
        "visual_lock_missing",
        `${character.name}'s visual lock is not verbatim in the prompt.`,
        "characters",
      );
    }
    if (!prompt.includes(character.voice_lock)) {
      error(
        "voice_lock_missing",
        `${character.name}'s voice lock is not verbatim in the prompt.`,
        "characters",
      );
    }
    if (!imagePrompt.includes(character.visual_lock)) {
      error(
        "image_visual_lock_missing",
        `${character.name}'s visual lock is missing from the keyframe prompt.`,
      );
    }
  }

  // Prompt must be plain text (copy-paste into Flow).
  if (/```/.test(prompt) || /^#{1,6}\s/m.test(prompt)) {
    error("not_plain_text", "The prompt contains markdown, but must be plain text.");
  }

  // Continuity with the previous scene.
  const previous = data.scenes.find((item) => item.n === scene.n - 1);
  if (previous) {
    if (scene.location_id !== previous.location_id && !scene.is_establishing) {
      error(
        "missing_establishing",
        "The location changes here, so this scene must be an establishing shot.",
        "is_establishing",
      );
    }
    if (
      settings.frameChaining &&
      scene.chain_from_previous &&
      normalize(scene.start_state) !== normalize(previous.end_state)
    ) {
      error(
        "chain_mismatch",
        `start_state must equal the end_state of Scene ${previous.n} when chained.`,
        "start_state",
      );
    }
    if (
      scene.location_id !== previous.location_id &&
      scene.chain_from_previous &&
      !scene.is_establishing
    ) {
      warning(
        "chain_after_location_change",
        "Frame chaining across a location change usually breaks continuity.",
      );
    }
    const pShot = (previous.camera?.shot || "").toLowerCase();
    const cShot = (scene.camera?.shot || "").toLowerCase();
    const isExtremeJump =
      (pShot.includes("wide") && cShot.includes("close")) ||
      (pShot.includes("close") && cShot.includes("wide"));
    if (
      scene.chain_from_previous &&
      isExtremeJump &&
      !/push|zoom|dolly|track|move/i.test(scene.camera?.movement || "")
    ) {
      warning(
        "shot_scale_jump",
        "Jumping between a wide shot and a close-up in a static continuous take usually breaks visual continuity.",
        "camera.shot",
      );
    }
  }
  if (
    scene.dialogue &&
    /\b(facing away|from behind|back to camera|facing back)\b/i.test(scene.camera.angle)
  ) {
    warning(
      "speaker_facing_away",
      "The dialogue speaker is facing away from the camera; lip movement may not be visible.",
      "camera.angle",
    );
  }
  if (concatenated(scene).length < 20) {
    warning("thin_scene", "The scene description is very short.");
  }
  return issues;
}

function concatenated(scene: SceneRecord): string {
  return [scene.action, scene.start_state, scene.end_state].join(" ");
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}
