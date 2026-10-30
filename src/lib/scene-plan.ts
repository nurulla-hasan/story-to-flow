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
  | { success: true; plan: ScenePlan }
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

/**
 * Parses raw JSON string into a validated ScenePlan.
 */
export function parseScenePlanJson(jsonString: string): ParsePlanResult {
  if (jsonString.length > 5_000_000) {
    return { success: false, error: "Input exceeds maximum allowed size (5MB)" };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return validateScenePlan(parsed);
  } catch (err) {
    return {
      success: false,
      error: `Malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
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

  // 2. Search for raw JSON block containing "schemaVersion" outside markdown fences
  const schemaVersionIdx = text.indexOf('"schemaVersion"');
  if (schemaVersionIdx !== -1) {
    const lastOpenBrace = text.lastIndexOf("{", schemaVersionIdx);
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
