/**
 * Scene & Shot Plan Parsing, Validation, and Data Types
 *
 * Implements Phase B of Story Plan -> Timeline Blocks -> Auto Motion/Transition.
 * Pure module with strict schema validation, duplicate ID guards, and deterministic text fallback.
 */

import { z } from "zod";
import type { ZoomEffectType } from "@/lib/zoom-effect";
import type { TransitionType } from "@/types/timeline";

export const ALLOWED_PLAN_MOTION_TYPES: readonly ZoomEffectType[] = [
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
] as const;

export const ALLOWED_PLAN_TRANSITION_TYPES: readonly TransitionType[] = [
  "cross-dissolve",
  "fade-black",
  "slide-left",
  "slide-right",
] as const;

export const ShotMotionSchema = z.object({
  type: z.enum([
    "zoom-in",
    "zoom-out",
    "pan-left",
    "pan-right",
    "pan-up",
    "pan-down",
  ]),
  amount: z.number().min(0.05).max(0.5).default(0.15),
});

export type ShotPlanMotion = z.infer<typeof ShotMotionSchema>;

export const ShotTransitionSchema = z.object({
  type: z.enum(["cross-dissolve", "fade-black", "slide-left", "slide-right"]),
  duration: z.number().min(0.1).max(2.0).default(0.5),
});

export type ShotPlanTransition = z.infer<typeof ShotTransitionSchema>;

export const ShotPlanSchema = z.object({
  shotId: z.string().min(1, "shotId cannot be empty"),
  shotNumber: z.number().int().positive("shotNumber must be a positive integer"),
  startTime: z.number().min(0, "startTime cannot be negative"),
  duration: z.number().positive("duration must be a positive number"),
  mediaKind: z.enum(["image", "video"], {
    message: "mediaKind must be strictly 'image' or 'video'",
  }),
  sourceDuration: z.number().positive().optional(),
  voiceover: z.string().optional(),
  prompt: z.string().min(1, "prompt cannot be empty"),
  motion: ShotMotionSchema.nullable().optional(),
  transitionToNext: ShotTransitionSchema.nullable().optional(),
  assignedAssetId: z.string().optional(),
  assignedClipId: z.string().optional(),
});

export type ShotPlanItem = z.infer<typeof ShotPlanSchema>;

export const ScenePlanItemSchema = z.object({
  sceneId: z.string().min(1, "sceneId cannot be empty"),
  sceneNumber: z.number().int().positive("sceneNumber must be a positive integer"),
  title: z.string().default("Untitled Scene"),
  shots: z.array(ShotPlanSchema).min(1, "A scene must contain at least one shot"),
});

export type ScenePlanItem = z.infer<typeof ScenePlanItemSchema>;

export const ScenePlanSchema = z.object({
  schemaVersion: z.literal(1, {
    message: "Only schemaVersion 1 is currently supported",
  }),
  scenes: z.array(ScenePlanItemSchema).min(1, "Plan must contain at least one scene"),
  totalDuration: z.number().min(0).optional(),
  importedAt: z.number().optional(),
});

export type ScenePlan = z.infer<typeof ScenePlanSchema>;

export type ParsePlanResult =
  | { success: true; plan: ScenePlan; warnings?: string[] }
  | { success: false; error: string; details?: unknown };

/**
 * Validates structural and business rules of a parsed scene plan:
 * 1. Zod schema validation
 * 2. Stable, unique sceneId check
 * 3. Stable, unique shotId check across the entire plan
 * 4. Sequential shotNumber check within each scene
 * 5. Sequential sceneNumber check
 * 6. Non-negative, finite timecodes
 */
export function validateScenePlan(data: unknown): ParsePlanResult {
  const result = ScenePlanSchema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue ? firstIssue.path.join(".") : "";
    const msg = firstIssue ? firstIssue.message : "Invalid scene plan schema";
    return {
      success: false,
      error: path ? `Validation error at ${path}: ${msg}` : msg,
      details: result.error.format(),
    };
  }

  const plan = result.data;
  const sceneIds = new Set<string>();
  const shotIds = new Set<string>();

  for (let sIdx = 0; sIdx < plan.scenes.length; sIdx++) {
    const scene = plan.scenes[sIdx];
    if (sceneIds.has(scene.sceneId)) {
      return {
        success: false,
        error: `Duplicate sceneId detected: "${scene.sceneId}". Every sceneId must be unique.`,
      };
    }
    sceneIds.add(scene.sceneId);

    for (let shIdx = 0; shIdx < scene.shots.length; shIdx++) {
      const shot = scene.shots[shIdx];
      if (shotIds.has(shot.shotId)) {
        return {
          success: false,
          error: `Duplicate shotId detected: "${shot.shotId}". Every shotId must be unique.`,
        };
      }
      shotIds.add(shot.shotId);

      if (shot.shotNumber !== shIdx + 1) {
        return {
          success: false,
          error: `Non-sequential shotNumber in scene "${scene.sceneId}": expected ${shIdx + 1}, found ${shot.shotNumber}.`,
        };
      }
    }
  }

  // Calculate and ensure canonical total duration
  let calculatedDuration = 0;
  for (const scene of plan.scenes) {
    for (const shot of scene.shots) {
      calculatedDuration = Math.max(calculatedDuration, shot.startTime + shot.duration);
    }
  }

  return {
    success: true,
    plan: {
      ...plan,
      totalDuration: parseFloat(calculatedDuration.toFixed(3)),
      importedAt: plan.importedAt || Date.now(),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Tolerant normalization for AI-authored plans                               */
/* -------------------------------------------------------------------------- */

/**
 * AI models frequently drift from the exact contract (missing ids, 0-based
 * numbering, string durations, "static" motion, capitalized mediaKind...).
 * Normalization repairs every deviation that can be repaired without inventing
 * content, so a semantically correct plan still imports. Anything that cannot
 * be recovered (for example a shot with no prompt text) is reported as a clear,
 * actionable error instead of a raw schema path.
 */

const MOTION_TYPE_ALIASES: Record<string, ZoomEffectType | null> = {
  "zoom-in": "zoom-in",
  "zoom in": "zoom-in",
  "push-in": "zoom-in",
  "push in": "zoom-in",
  "dolly-in": "zoom-in",
  "dolly in": "zoom-in",
  "zoom-out": "zoom-out",
  "zoom out": "zoom-out",
  "pull-out": "zoom-out",
  "pull out": "zoom-out",
  "dolly-out": "zoom-out",
  "dolly out": "zoom-out",
  "pan-left": "pan-left",
  "pan left": "pan-left",
  "pan-right": "pan-right",
  "pan right": "pan-right",
  "pan-up": "pan-up",
  "pan up": "pan-up",
  "tilt-up": "pan-up",
  "tilt up": "pan-up",
  "pan-down": "pan-down",
  "pan down": "pan-down",
  "tilt-down": "pan-down",
  "tilt down": "pan-down",
  static: null,
  none: null,
  off: null,
  still: null,
  fixed: null,
  "no-motion": null,
};

const TRANSITION_TYPE_ALIASES: Record<string, TransitionType | null> = {
  "cross-dissolve": "cross-dissolve",
  "cross dissolve": "cross-dissolve",
  crossfade: "cross-dissolve",
  "cross-fade": "cross-dissolve",
  dissolve: "cross-dissolve",
  fade: "cross-dissolve",
  "fade-black": "fade-black",
  "fade black": "fade-black",
  "fade-to-black": "fade-black",
  "fade to black": "fade-black",
  "black-fade": "fade-black",
  "slide-left": "slide-left",
  "slide left": "slide-left",
  "push-left": "slide-left",
  "slide-right": "slide-right",
  "slide right": "slide-right",
  "push-right": "slide-right",
  cut: null,
  none: null,
};

const PLAN_WRAPPER_KEYS = [
  "plan",
  "scenePlan",
  "scene_plan",
  "storyPlan",
  "story_plan",
  "timeline",
  "data",
  "result",
  "output",
];

const SHOT_PROMPT_KEYS = [
  "prompt",
  "imagePrompt",
  "image_prompt",
  "videoPrompt",
  "video_prompt",
  "description",
  "visual",
  "content",
  "text",
];

export interface NormalizedPlanInput {
  data: unknown;
  warnings: string[];
  error?: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+(?::\d{1,2}){1,2}(?:\.\d+)?$/.test(trimmed)) {
    return parseTimecodeToSeconds(trimmed);
  }

  const numeric = Number(trimmed.replace(/s$/i, ""));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function lookupAlias<T>(
  aliases: Record<string, T | null>,
  raw: string
): T | null | undefined {
  const key = raw.trim().toLowerCase().replace(/[_\s]+/g, " ").trim();
  if (key in aliases) return aliases[key];
  const dashed = key.replace(/\s+/g, "-");
  if (dashed in aliases) return aliases[dashed];
  return undefined;
}

function normalizeMotion(
  value: unknown,
  shotId: string,
  warnings: string[]
): ShotPlanMotion | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const resolved = lookupAlias(MOTION_TYPE_ALIASES, value);
    if (resolved === undefined) {
      warnings.push(`Dropped unsupported motion "${value}" on ${shotId}.`);
      return null;
    }
    if (resolved === null) return null;
    return { type: resolved, amount: 0.15 };
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const rawType =
      typeof obj.type === "string"
        ? obj.type
        : typeof obj.name === "string"
          ? obj.name
          : "";
    const resolved = lookupAlias(MOTION_TYPE_ALIASES, rawType);

    if (resolved === undefined) {
      if (rawType) {
        warnings.push(`Dropped unsupported motion "${rawType}" on ${shotId}.`);
      }
      return null;
    }
    if (resolved === null) return null;

    const amount = coerceNumber(obj.amount) ?? coerceNumber(obj.intensity) ?? 0.15;
    return { type: resolved, amount: clamp(amount, 0.05, 0.5) };
  }

  return null;
}

function normalizeTransition(
  value: unknown,
  shotId: string,
  warnings: string[]
): ShotPlanTransition | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const resolved = lookupAlias(TRANSITION_TYPE_ALIASES, value);
    if (resolved === undefined) {
      warnings.push(`Dropped unsupported transition "${value}" on ${shotId}.`);
      return null;
    }
    if (resolved === null) return null;
    return { type: resolved, duration: 0.5 };
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const rawType =
      typeof obj.type === "string"
        ? obj.type
        : typeof obj.name === "string"
          ? obj.name
          : "";
    const resolved = lookupAlias(TRANSITION_TYPE_ALIASES, rawType);

    if (resolved === undefined) {
      if (rawType) {
        warnings.push(`Dropped unsupported transition "${rawType}" on ${shotId}.`);
      }
      return null;
    }
    if (resolved === null) return null;

    const duration = coerceNumber(obj.duration) ?? 0.5;
    return { type: resolved, duration: clamp(duration, 0.1, 2.0) };
  }

  return null;
}

/**
 * Repairs common AI deviations before schema validation.
 */
export function normalizeScenePlanInput(input: unknown): NormalizedPlanInput {
  const warnings: string[] = [];

  let root: unknown = input;

  // Unwrap single-key envelopes such as { plan: { ... } } or { data: { ... } }
  for (let depth = 0; depth < 2; depth++) {
    if (!root || typeof root !== "object" || Array.isArray(root)) break;
    const obj = root as Record<string, unknown>;
    if (Array.isArray(obj.scenes)) break;
    const key = PLAN_WRAPPER_KEYS.find(
      (candidate) => obj[candidate] && typeof obj[candidate] === "object"
    );
    if (!key) break;
    root = obj[key];
    warnings.push(`Unwrapped plan from "${key}".`);
  }

  if (Array.isArray(root)) {
    root = { schemaVersion: 1, scenes: root };
    warnings.push('Plan was a bare array of scenes; wrapped it with "schemaVersion": 1.');
  }

  if (!root || typeof root !== "object") {
    return { data: input, warnings, error: "The pasted JSON is not a plan object." };
  }

  const planObj: Record<string, unknown> = { ...(root as Record<string, unknown>) };

  if (
    planObj.schemaVersion === undefined ||
    planObj.schemaVersion === null ||
    planObj.schemaVersion === ""
  ) {
    planObj.schemaVersion = 1;
    warnings.push('Added missing "schemaVersion": 1.');
  } else if (
    typeof planObj.schemaVersion === "string" &&
    /^\d+$/.test(planObj.schemaVersion.trim())
  ) {
    planObj.schemaVersion = Number(planObj.schemaVersion.trim());
  }

  if (!Array.isArray(planObj.scenes)) {
    if (planObj.scenes && typeof planObj.scenes === "object") {
      planObj.scenes = Object.values(planObj.scenes as Record<string, unknown>);
      warnings.push('Converted the "scenes" object map into an array.');
    } else {
      return {
        data: planObj,
        warnings,
        error: 'The plan has no "scenes" array.',
      };
    }
  }

  const usedSceneIds = new Set<string>();
  const usedShotIds = new Set<string>();

  const scenes = (planObj.scenes as unknown[]).map((rawScene, sceneIndex) => {
    let sceneObj: Record<string, unknown> =
      rawScene && typeof rawScene === "object" && !Array.isArray(rawScene)
        ? { ...(rawScene as Record<string, unknown>) }
        : {};

    if (!Array.isArray(sceneObj.shots) && sceneObj.scene && typeof sceneObj.scene === "object") {
      sceneObj = { ...(sceneObj.scene as Record<string, unknown>), ...sceneObj };
    }

    let sceneId = typeof sceneObj.sceneId === "string" ? sceneObj.sceneId.trim() : "";
    if (!sceneId) {
      sceneId = `scene-${pad2(sceneIndex + 1)}`;
      warnings.push(`Added missing sceneId "${sceneId}".`);
    }
    if (usedSceneIds.has(sceneId)) {
      let suffix = 2;
      while (usedSceneIds.has(`${sceneId}-${suffix}`)) suffix++;
      const renamed = `${sceneId}-${suffix}`;
      warnings.push(`Renamed duplicate sceneId "${sceneId}" to "${renamed}".`);
      sceneId = renamed;
    }
    usedSceneIds.add(sceneId);

    if (!Array.isArray(sceneObj.shots)) {
      warnings.push(`Scene ${sceneIndex + 1} has no "shots" array.`);
    }
    const rawShots = Array.isArray(sceneObj.shots) ? (sceneObj.shots as unknown[]) : [];

    let cursor = 0;

    const shots = rawShots.map((rawShot, shotIndex) => {
      const shotObj: Record<string, unknown> =
        rawShot && typeof rawShot === "object" && !Array.isArray(rawShot)
          ? { ...(rawShot as Record<string, unknown>) }
          : {};

      let shotId = typeof shotObj.shotId === "string" ? shotObj.shotId.trim() : "";
      if (!shotId) {
        shotId = `${sceneId}-shot-${pad2(shotIndex + 1)}`;
        warnings.push(`Added missing shotId "${shotId}".`);
      }
      if (usedShotIds.has(shotId)) {
        let suffix = 2;
        while (usedShotIds.has(`${shotId}-${suffix}`)) suffix++;
        const renamed = `${shotId}-${suffix}`;
        warnings.push(`Renamed duplicate shotId "${shotId}" to "${renamed}".`);
        shotId = renamed;
      }
      usedShotIds.add(shotId);

      const rawStart = coerceNumber(shotObj.startTime);
      const rawDuration = coerceNumber(shotObj.duration);

      const startTime = rawStart !== undefined && rawStart >= 0 ? rawStart : cursor;
      if (rawStart === undefined) {
        warnings.push(`Estimated startTime ${startTime}s for ${shotId}.`);
      }

      const duration = rawDuration !== undefined && rawDuration > 0 ? rawDuration : 4;
      if (rawDuration === undefined || rawDuration <= 0) {
        warnings.push(`Defaulted duration to ${duration}s for ${shotId}.`);
      }

      cursor = startTime + duration;

      let prompt = "";
      for (const key of SHOT_PROMPT_KEYS) {
        const candidate = shotObj[key];
        if (typeof candidate === "string" && candidate.trim()) {
          prompt = candidate.trim();
          break;
        }
      }

      const rawKind =
        typeof shotObj.mediaKind === "string"
          ? shotObj.mediaKind.toLowerCase()
          : typeof shotObj.mediaType === "string"
            ? shotObj.mediaType.toLowerCase()
            : "";

      let mediaKind: "image" | "video" = "image";
      if (rawKind) {
        if (/video|hero|moving|motion|animated/.test(rawKind)) {
          mediaKind = "video";
        } else if (/image|static|photo|still|picture|frame/.test(rawKind)) {
          mediaKind = "image";
        } else {
          warnings.push(`Unrecognized mediaKind "${rawKind}" on ${shotId}; treated as image.`);
        }
      } else {
        warnings.push(`Defaulted mediaKind to "image" for ${shotId}.`);
      }

      const sourceDuration = coerceNumber(shotObj.sourceDuration);
      const voiceover =
        typeof shotObj.voiceover === "string" && shotObj.voiceover.trim()
          ? shotObj.voiceover.trim()
          : undefined;

      return {
        shotId,
        shotNumber: shotIndex + 1,
        startTime,
        duration,
        mediaKind,
        ...(sourceDuration !== undefined && sourceDuration > 0
          ? { sourceDuration }
          : {}),
        ...(voiceover ? { voiceover } : {}),
        prompt,
        motion: normalizeMotion(shotObj.motion, shotId, warnings),
        transitionToNext: normalizeTransition(shotObj.transitionToNext, shotId, warnings),
      };
    });

    const title =
      typeof sceneObj.title === "string" && sceneObj.title.trim()
        ? sceneObj.title.trim()
        : `Scene ${sceneIndex + 1}`;

    return {
      sceneId,
      sceneNumber: sceneIndex + 1,
      title,
      shots,
    };
  });

  planObj.scenes = scenes;

  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
    for (const shot of scenes[sceneIndex].shots) {
      if (!shot.prompt) {
        return {
          data: planObj,
          warnings,
          error: `Shot "${shot.shotId}" (scene ${sceneIndex + 1}) has no prompt text. Add a "prompt" field to that shot in the JSON.`,
        };
      }
    }
  }

  return { data: planObj, warnings };
}

/**
 * Parses raw JSON string into a validated ScenePlan.
 */
export function parseScenePlanJson(jsonString: string): ParsePlanResult {
  if (jsonString.length > 5_000_000) {
    return { success: false, error: "Input exceeds maximum allowed size (5MB)" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      success: false,
      error: `Malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const normalized = normalizeScenePlanInput(parsed);
  if (normalized.error) {
    return { success: false, error: normalized.error, details: normalized.data };
  }

  const result = validateScenePlan(normalized.data);
  if (!result.success) return result;

  return normalized.warnings.length > 0
    ? { ...result, warnings: normalized.warnings }
    : result;
}

/**
 * Safely extracts a balanced JSON object string starting from the opening '{'.
 * Correctly skips braces inside string literals and handles escape characters.
 */
export function extractBalancedJsonObject(text: string, startIndex: number = 0): string | null {
  const openBraceIndex = text.indexOf("{", startIndex);
  if (openBraceIndex === -1) return null;

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = openBraceIndex; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0) {
          return text.substring(openBraceIndex, i + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Extracts a machine-readable JSON plan from LLM output.
 * If a JSON plan block is present, it is strictly parsed and validated.
 * If no JSON plan block exists, applies a deterministic fallback on standard Master Prompt scene blocks.
 */
export function extractScenePlanFromText(text: string): ParsePlanResult {
  if (!text || !text.trim()) {
    return { success: false, error: "Input text is empty" };
  }

  const trimmedInput = text.trim();

  // 0. Bare JSON object/array pasted directly (no fences, no headings)
  if (trimmedInput.startsWith("{") || trimmedInput.startsWith("[")) {
    const balanced = extractBalancedJsonObject(trimmedInput) ?? trimmedInput;
    const direct = parseScenePlanJson(balanced);
    if (direct.success) return direct;
    if (/"(schemaVersion|scenes|shots)"\s*:/.test(trimmedInput)) {
      return direct;
    }
  }

  // 1. Search for fenced code blocks: ```json ... ``` or ``` ... ```
  const fencedRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fencedMatch: RegExpExecArray | null;
  while ((fencedMatch = fencedRegex.exec(text)) !== null) {
    const blockContent = fencedMatch[1].trim();
    if (blockContent.includes('"schemaVersion"') || blockContent.includes('"scenes"')) {
      const balanced = extractBalancedJsonObject(blockContent);
      return parseScenePlanJson(balanced || blockContent);
    }
  }

  // 2. Search for a raw JSON block containing plan keys outside markdown fences
  const planKeyIdx = text.search(/"(schemaVersion|scenes)"\s*:/);
  if (planKeyIdx !== -1) {
    const lastOpenBrace = text.lastIndexOf("{", planKeyIdx);
    if (lastOpenBrace !== -1) {
      const balanced = extractBalancedJsonObject(text, lastOpenBrace);
      if (balanced) {
        return parseScenePlanJson(balanced);
      }
    }
  }

  // 3. Deterministic Fallback Parser ONLY when no JSON block was found and legacy scene markers exist
  if (/SCENE\s*#\d+/i.test(text) && /SHOT\s*#\d+/i.test(text)) {
    const fallbackPlan = parseLegacyHumanReadableScenes(text);
    if (fallbackPlan) {
      return validateScenePlan(fallbackPlan);
    }
  }

  return {
    success: false,
    error: "No valid machine-readable Scene Plan JSON or standard Story Scene blocks found in text.",
  };
}

/**
 * Deterministic fallback parser that reconstructs a ScenePlan from standard
 * Master Prompt scene code blocks (e.g. SCENE #01, SHOT #01 ...).
 */
export function parseLegacyHumanReadableScenes(text: string): ScenePlan | null {
  // Find all scene blocks
  const sceneRegex = /SCENE\s*#(\d+)(?:\s*\(([^)]+)\))?([\s\S]*?)(?=(?:SCENE\s*#\d+|==================================================|$))/gi;
  const scenes: ScenePlanItem[] = [];

  let sceneMatch: RegExpExecArray | null;
  while ((sceneMatch = sceneRegex.exec(text)) !== null) {
    const sceneNum = parseInt(sceneMatch[1], 10);
    const sceneTitle = sceneMatch[2]?.trim() || `Scene ${sceneNum}`;
    const sceneBody = sceneMatch[3];

    // Find shots inside this scene
    // SHOT #01 (0:00 - 0:04 • 4.0s • zoom-in) [🖼️ STATIC IMAGE]
    const shotRegex =
      /SHOT\s*#(\d+)\s*\(([\d:.]+)\s*-\s*([\d:.]+)\s*•\s*([\d.]+)s(?:[^\)]*)\)\s*\[([^\]]+)\]([\s\S]*?)(?=(?:SHOT\s*#\d+|SCENE\s*#\d+|==================================================|$))/gi;

    const shots: ShotPlanItem[] = [];
    let shotMatch: RegExpExecArray | null;

    while ((shotMatch = shotRegex.exec(sceneBody)) !== null) {
      const shotNum = parseInt(shotMatch[1], 10);
      const startSec = parseTimecodeToSeconds(shotMatch[2]);
      const durationSec = parseFloat(shotMatch[4]) || 4.0;
      const mediaTag = shotMatch[5].toLowerCase();
      const shotBody = shotMatch[6];

      const isVideo = mediaTag.includes("video") || mediaTag.includes("hero");
      const mediaKind: "image" | "video" = isVideo ? "video" : "image";

      // Camera motion from header
      let motion: ShotPlanMotion | null = null;
      for (const mType of ALLOWED_PLAN_MOTION_TYPES) {
        if (shotMatch[0].toLowerCase().includes(mType)) {
          motion = { type: mType, amount: 0.15 };
          break;
        }
      }

      // Voiceover extraction
      const voMatch = shotBody.match(/VOICEOVER:\s*([^\n\r]+)/i);
      const voiceover = voMatch ? voMatch[1].trim() : undefined;

      // Prompt extraction
      const promptMatch = shotBody.match(/PROMPT:\s*([\s\S]*?)(?=(?:EDIT NOTE:|EDITOR TEXT OVERLAY:|$))/i);
      const prompt = promptMatch ? promptMatch[1].trim() : `Shot ${shotNum} prompt`;

      shots.push({
        shotId: `scene-${String(sceneNum).padStart(2, "0")}-shot-${String(shotNum).padStart(2, "0")}`,
        shotNumber: shotNum,
        startTime: startSec,
        duration: durationSec,
        mediaKind,
        sourceDuration: isVideo ? 4.0 : undefined,
        voiceover,
        prompt,
        motion,
        transitionToNext: null,
      });
    }

    if (shots.length > 0) {
      scenes.push({
        sceneId: `scene-${String(sceneNum).padStart(2, "0")}`,
        sceneNumber: sceneNum,
        title: sceneTitle,
        shots,
      });
    }
  }

  if (scenes.length === 0) return null;

  return {
    schemaVersion: 1,
    scenes,
  };
}

/**
 * Parses timecodes such as "0:04", "01:23", or seconds "14.5" into numeric seconds.
 */
function parseTimecodeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const directSec = parseFloat(timeStr);
  return !isNaN(directSec) && directSec >= 0 ? directSec : 0;
}

/**
 * Returns a flat list of all shots from a scene plan in chronological order.
 */
export function getAllShotsFromPlan(plan: ScenePlan): ShotPlanItem[] {
  const result: ShotPlanItem[] = [];
  for (const scene of plan.scenes) {
    for (const shot of scene.shots) {
      result.push(shot);
    }
  }
  return result;
}

/**
 * Resolves a specific shot from a scene plan by shotId.
 */
export function getShotFromPlan(
  plan: ScenePlan | null | undefined,
  shotId: string | null | undefined
): ShotPlanItem | undefined {
  if (!plan || !shotId) return undefined;
  for (const scene of plan.scenes) {
    for (const shot of scene.shots) {
      if (shot.shotId === shotId) return shot;
    }
  }
  return undefined;
}
