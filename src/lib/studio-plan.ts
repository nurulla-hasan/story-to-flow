/**
 * Server-only helpers for the Shorts / Animatic planner.
 *
 * These functions keep prompt assembly deterministic: the LLM only writes the
 * shot action, and the server injects the locked character / location
 * descriptions so every image prompt stays consistent across shots.
 */
import type {
  StudioCastMember,
  StudioLocationLock,
} from "@/components/studio/types";
import type { ShortsPacing } from "@/lib/types";
import { sanitizeDetachedProps } from "./studio";

export const SHORTS_MOTION_CYCLE = [
  "zoom-in",
  "pan-left",
  "zoom-out",
  "pan-right",
  "static",
] as const;

export function clampShortsDuration(value: number): number {
  const safe = Number.isFinite(value) ? value : 3;
  const clamped = Math.min(5, Math.max(2.5, safe));
  // Keep half-second precision so the timeline stays readable.
  return Math.round(clamped * 2) / 2;
}

/** Natural TTS narration: no phonetic stretching, gasps or SFX tags. */
export function cleanNarration(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\((?:sfx|sound|music|whoosh|pop|thud|crash|bang)[^)]*\)/gi, " ")
    .replace(/—/g, " ")
    .replace(/!{2,}/g, "!")
    .replace(/\s+([,.!?।])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Image prompts must stay static; camera motion lives in the clip metadata. */
export function stripCameraMotion(text: string): string {
  return text
    .replace(
      /\b(?:camera\s+)?(?:slowly\s+)?(?:smooth(?:ly)?\s+)?(?:cinematic\s+)?(?:zoom(?:ing)?\s+(?:in|out)|pan(?:ning)?\s+(?:left|right)|slid(?:e|ing)\s+(?:left|right)|push[-\s]?in|pull[-\s]?back|dolly(?:\s+(?:in|out))?|tracking shot|tilt(?:ing)?\s+(?:up|down))\b(?:\s+(?:on|towards?|into))?/gi,
      " ",
    )
    .replace(/\b(?:steady\s+)?static\s+camera(?:\s+framing)?\b/gi, " ")
    .replace(/\s*,\s*([,.;])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;]+|[\s,.;]+$/g, "")
    .trim();
}

export function estimateShortsClipCount(
  story: string,
  pacing: ShortsPacing,
  targetDuration?: number,
): number {
  const words = story.trim().split(/\s+/).filter(Boolean).length;
  // Bangla narration runs at ~2.2 spoken words per second.
  const naturalSeconds = Math.max(10, Math.round(words / 2.2));
  const target = Math.max(10, Math.min(600, targetDuration ?? naturalSeconds));
  const averageClip = pacing === "auto" ? 3.5 : Number(pacing);
  return Math.max(3, Math.min(120, Math.round(target / averageClip)));
}

/**
 * Auto pacing derives each shot duration from its own narration slice so the
 * image does not change before the voiceover line finishes.
 */
export function estimateNarrationDuration(narration: string): number {
  const words = narration.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 3;
  // ~2.2 Bangla words/second plus a small breath at the sentence end.
  return clampShortsDuration(words / 2.2 + 0.4);
}

interface ComposeShortsPromptInput {
  styleLock?: string;
  stylePreset: string;
  cast: StudioCastMember[];
  locations: StudioLocationLock[];
  action: string;
  characterIds: string[];
  locationId?: string;
  narration: string;
  aspectRatio: "9:16" | "16:9";
}

export function composeShortsImagePrompt({
  styleLock,
  stylePreset,
  cast,
  locations,
  action,
  characterIds,
  locationId,
  narration,
  aspectRatio,
}: ComposeShortsPromptInput): string {
  const byId = new Map(cast.map((member) => [member.id, member]));
  const castLocks = [...new Set(characterIds)]
    .map((id) => byId.get(id)?.visualLock?.trim())
    .filter((lock): lock is string => Boolean(lock));

  const location =
    locations.find((entry) => entry.id === locationId) ?? locations[0];

  const style = (styleLock?.trim() || stylePreset.trim()).replace(/\.\s*$/, "");
  const actionText = stripCameraMotion(action);

  const parts = [
    style,
    ...castLocks.map((lock) => lock.replace(/\.\s*$/, "")),
    location?.visualLock?.trim().replace(/\.\s*$/, ""),
    actionText ? `In this shot: ${actionText}` : "",
  ].filter(Boolean);

  let prompt = parts
    .join(". ")
    .replace(/\.\s*\./g, ".")
    .replace(/\s+/g, " ")
    .trim();

  if (prompt && !prompt.endsWith(".")) prompt += ".";

  if (!/aspect\s*ratio|9:16|16:9/i.test(prompt)) {
    prompt +=
      aspectRatio === "9:16"
        ? " Vertical 9:16 aspect ratio."
        : " Widescreen 16:9 aspect ratio.";
  }

  return sanitizeDetachedProps(prompt, narration);
}
