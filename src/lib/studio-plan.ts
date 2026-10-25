/**
 * Shared helpers for the Shorts / Animatic planner.
 *
 * These functions keep prompt assembly deterministic: the LLM only writes the
 * shot action, and the app injects the locked character / location descriptions
 * so every image prompt stays consistent across shots. The module is
 * intentionally free of Node-only imports so it can also be used to re-sync
 * prompts in the browser after a lock is edited.
 */
import type {
  StudioCastMember,
  StudioLocationLock,
  StudioProject,
} from "@/components/studio/types";
import { styleLockForPreset, type ShortsPacing } from "./types";
import { sanitizeDetachedProps } from "./prompt-sanitizer";

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

/** Pull the raw action back out of a previously composed prompt. */
export function extractShortsActionFromPrompt(prompt: string): string {
  const marker = /\bIn this shot:\s*/i.exec(prompt);
  if (!marker || marker.index < 0) return "";
  return prompt
    .slice(marker.index + marker[0].length)
    .replace(
      /\s+(?:Vertical\s+9:16|Widescreen\s+16:9)\s+aspect ratio\.?\s*$/i,
      "",
    )
    .replace(/\.\s*$/, "")
    .trim();
}

const MATCH_STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "from",
  "this",
  "that",
  "into",
  "over",
  "under",
  "while",
  "showing",
  "shows",
  "view",
  "close",
  "wide",
  "medium",
  "angle",
  "frame",
  "visible",
  "stands",
  "standing",
  "looking",
  "toward",
  "towards",
  "shot",
  "scene",
]);

function normalizeForMatch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function matchTokens(value: string): string[] {
  return normalizeForMatch(value)
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !MATCH_STOP_WORDS.has(token));
}

function keywordAppears(haystack: string, keyword: string): boolean {
  if (!keyword) return false;

  // Bengali names are commonly inflected (রিনা → রিনার, করিম → করিমকে).
  // Substring matching handles those forms; very short Bengali tokens still
  // need a real word boundary to avoid matching a fragment of another word.
  if (/[\u0980-\u09ff]/u.test(keyword)) {
    return keyword.length >= 3
      ? haystack.includes(keyword)
      : wordBoundaryMatch(haystack, keyword);
  }

  return wordBoundaryMatch(haystack, keyword);
}

function wordBoundaryMatch(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  );
  return pattern.test(haystack);
}

function characterKeywords(member: StudioCastMember): string[] {
  const keywords = new Set<string>();
  const fullName = normalizeForMatch(member.name.trim());
  if (fullName) keywords.add(fullName);
  for (const token of matchTokens(member.name)) keywords.add(token);
  for (const token of matchTokens(member.id)) keywords.add(token);
  return [...keywords];
}

function locationKeywords(location: StudioLocationLock): string[] {
  const keywords = new Set<string>();
  const fullName = normalizeForMatch(location.name?.trim() ?? "");
  if (fullName) keywords.add(fullName);
  for (const token of matchTokens(location.name ?? "")) keywords.add(token);
  for (const token of matchTokens(location.id)) keywords.add(token);
  return [...keywords];
}

interface ResolveCharacterIdsInput {
  cast: StudioCastMember[];
  characterIds?: string[];
  action: string;
  narration?: string;
}

/**
 * Keep valid planner ids and recover any cast member whose name or id keyword
 * appears in the shot action / voiceover slice. This prevents an empty or stale
 * `character_ids` array from silently dropping the Bible locks.
 */
export function resolveShortsCharacterIds({
  cast,
  characterIds = [],
  action,
  narration = "",
}: ResolveCharacterIdsInput): string[] {
  const byId = new Set(cast.map((member) => member.id));
  const selected = new Set<string>();

  for (const id of characterIds) {
    if (byId.has(id)) selected.add(id);
  }

  const haystack = normalizeForMatch(`${action} ${narration}`);
  if (haystack.trim()) {
    for (const member of cast) {
      if (selected.has(member.id)) continue;
      if (characterKeywords(member).some((keyword) => keywordAppears(haystack, keyword))) {
        selected.add(member.id);
      }
    }
  }

  // Preserve the cast order so prompts are deterministic.
  return cast
    .filter((member) => selected.has(member.id))
    .map((member) => member.id);
}

interface ResolveLocationIdInput {
  locations: StudioLocationLock[];
  locationId?: string;
  action: string;
  narration?: string;
}

/**
 * Prefer the planner's location id, then match the location name in the shot,
 * then fall back to the first locked location so a location lock is never
 * silently omitted.
 */
export function resolveShortsLocationId({
  locations,
  locationId,
  action,
  narration = "",
}: ResolveLocationIdInput): string | undefined {
  if (locationId && locations.some((location) => location.id === locationId)) {
    return locationId;
  }

  const haystack = normalizeForMatch(`${action} ${narration}`);
  if (haystack.trim()) {
    for (const location of locations) {
      if (
        locationKeywords(location).some((keyword) =>
          keywordAppears(haystack, keyword),
        )
      ) {
        return location.id;
      }
    }
  }

  return locations[0]?.id;
}

export interface ComposeShortsPromptInput {
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

export interface ComposeShortsShotResult {
  imagePrompt: string;
  characterIds: string[];
  locationId?: string;
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
  const resolvedCharacterIds = resolveShortsCharacterIds({
    cast,
    characterIds,
    action,
    narration,
  });
  const resolvedLocationId = resolveShortsLocationId({
    locations,
    locationId,
    action,
    narration,
  });

  const byId = new Map(cast.map((member) => [member.id, member]));
  const castLocks = resolvedCharacterIds
    .map((id) => byId.get(id)?.visualLock?.trim())
    .filter((lock): lock is string => Boolean(lock));

  const location =
    locations.find((entry) => entry.id === resolvedLocationId) ?? locations[0];

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

/** Compose a prompt and return the resolved ids that were actually injected. */
export function composeShortsShot(input: ComposeShortsPromptInput): ComposeShortsShotResult {
  const characterIds = resolveShortsCharacterIds({
    cast: input.cast,
    characterIds: input.characterIds,
    action: input.action,
    narration: input.narration,
  });
  const locationId = resolveShortsLocationId({
    locations: input.locations,
    locationId: input.locationId,
    action: input.action,
    narration: input.narration,
  });

  return {
    characterIds,
    locationId,
    imagePrompt: composeShortsImagePrompt({
      ...input,
      characterIds,
      locationId,
    }),
  };
}

export interface ReassembleShortsProjectInput {
  project: StudioProject;
  cast: StudioCastMember[];
  locations: StudioLocationLock[];
  styleLock?: string;
  stylePreset?: string;
  aspectRatio?: "9:16" | "16:9";
  /** Map a deleted/merged character id to its replacement id. */
  characterIdMap?: Record<string, string>;
}

export interface ReassembleShortsProjectResult {
  project: StudioProject;
  changedClips: number;
}

function sameIds(a: string[] | undefined, b: string[]): boolean {
  const left = a ?? [];
  if (left.length !== b.length) return false;
  return left.every((id, index) => id === b[index]);
}

function sameCast(a: StudioCastMember[], b: StudioCastMember[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (member, index) =>
        member.id === b[index].id &&
        member.name === b[index].name &&
        member.visualLock === b[index].visualLock,
    )
  );
}

function sameLocations(
  a: StudioLocationLock[],
  b: StudioLocationLock[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (location, index) =>
        location.id === b[index].id &&
        location.name === b[index].name &&
        location.visualLock === b[index].visualLock,
    )
  );
}

/**
 * A short, stable prefix of a lock is enough to detect whether it was injected.
 * Using the whole lock would false-positive when sanitizeDetachedProps rewrites
 * a detached prop inside the character description.
 */
function lockNeedle(lock: string): string {
  const trimmed = lock.trim().replace(/\.\s*$/, "");
  return trimmed.length > 60 ? trimmed.slice(0, 60) : trimmed;
}

/**
 * True when the saved project no longer matches the current Bible locks, or
 * when an existing prompt silently dropped one of those locks. Used on first
 * load to repair older Shorts plans without touching prompts that are already
 * in sync.
 */
export function shortsProjectNeedsLockSync({
  project,
  cast,
  locations,
  styleLock,
  stylePreset,
  aspectRatio,
}: ReassembleShortsProjectInput): boolean {
  const nextStylePreset = stylePreset ?? project.stylePreset;
  const nextAspectRatio = aspectRatio ?? project.aspectRatio;
  const nextStyleLock = (
    styleLock?.trim() ||
    project.styleLock?.trim() ||
    styleLockForPreset(nextStylePreset)
  ).trim();

  if (
    project.stylePreset !== nextStylePreset ||
    project.aspectRatio !== nextAspectRatio ||
    (project.styleLock ?? "").trim() !== nextStyleLock
  ) {
    return true;
  }
  if (
    !sameCast(project.cast ?? [], cast) ||
    !sameLocations(project.locations ?? [], locations)
  ) {
    return true;
  }

  const styleNeedle = nextStyleLock.replace(/\.\s*$/, "");
  for (const clip of project.clips) {
    if (styleNeedle && !clip.imagePrompt.includes(styleNeedle)) return true;

    const action =
      clip.action?.trim() ||
      extractShortsActionFromPrompt(clip.imagePrompt) ||
      clip.narration.trim();
    const resolved = composeShortsShot({
      styleLock: nextStyleLock,
      stylePreset: nextStylePreset,
      cast,
      locations,
      action,
      characterIds: clip.characterIds ?? [],
      locationId: clip.locationId,
      narration: clip.narration,
      aspectRatio: nextAspectRatio,
    });

    if (
      !sameIds(clip.characterIds, resolved.characterIds) ||
      clip.locationId !== resolved.locationId
    ) {
      return true;
    }

    for (const id of resolved.characterIds) {
      const lock = cast.find((member) => member.id === id)?.visualLock;
      const needle = lock ? lockNeedle(lock) : "";
      if (needle && !clip.imagePrompt.includes(needle)) return true;
    }

    const locationLock = locations
      .find((location) => location.id === resolved.locationId)
      ?.visualLock.trim()
      .replace(/\.\s*$/, "");
    if (locationLock && !clip.imagePrompt.includes(locationLock)) return true;
  }

  return false;
}

/**
 * Rebuild every Shorts prompt from the current Bible locks. The raw shot action
 * is preserved (or recovered from older prompts) so lock edits never require a
 * re-plan.
 */
export function reassembleShortsProject({
  project,
  cast,
  locations,
  styleLock,
  stylePreset,
  aspectRatio,
  characterIdMap = {},
}: ReassembleShortsProjectInput): ReassembleShortsProjectResult {
  const nextStylePreset = stylePreset ?? project.stylePreset;
  const nextAspectRatio = aspectRatio ?? project.aspectRatio;
  const nextStyleLock = (
    styleLock?.trim() ||
    project.styleLock?.trim() ||
    styleLockForPreset(nextStylePreset)
  ).trim();

  let changedClips = 0;

  const clips = project.clips.map((clip) => {
    const action =
      clip.action?.trim() ||
      extractShortsActionFromPrompt(clip.imagePrompt) ||
      clip.narration.trim();

    const mappedIds = (clip.characterIds ?? []).map(
      (id) => characterIdMap[id] ?? id,
    );

    const resolved = composeShortsShot({
      styleLock: nextStyleLock,
      stylePreset: nextStylePreset,
      cast,
      locations,
      action,
      characterIds: mappedIds,
      locationId: clip.locationId,
      narration: clip.narration,
      aspectRatio: nextAspectRatio,
    });

    if (
      resolved.imagePrompt !== clip.imagePrompt ||
      !sameIds(clip.characterIds, resolved.characterIds) ||
      resolved.locationId !== clip.locationId ||
      clip.action !== action
    ) {
      changedClips += 1;
    }

    return {
      ...clip,
      action,
      characterIds: resolved.characterIds,
      locationId: resolved.locationId,
      imagePrompt: resolved.imagePrompt,
    };
  });

  return {
    changedClips,
    project: {
      ...project,
      cast,
      locations,
      styleLock: nextStyleLock,
      stylePreset: nextStylePreset,
      aspectRatio: nextAspectRatio,
      characterVisualLock: cast[0]?.visualLock ?? "",
      environmentVisualLock: locations[0]?.visualLock ?? "",
      clips,
    },
  };
}
