/**
 * Media Matching & Bulk Assignment Engine
 *
 * Implements Phase C of Story Plan -> Timeline Blocks -> Auto Motion/Transition.
 * Pure module for matching Media Library assets to Shot Plan slots.
 */

import type { MediaAssetItem } from "@/lib/media-storage";
import type { ScenePlan } from "@/lib/scene-plan";
import { getAllShotsFromPlan } from "@/lib/scene-plan";
import type { TimelineTrack } from "@/types/timeline";
import { getTrackById } from "@/types/timeline";

export type MatchQuality = "exact" | "suggested" | "none" | "type-mismatch" | "locked-track";

export interface ShotAssetMatch {
  shotId: string;
  sceneNumber: number;
  shotNumber: number;
  mediaKind: "image" | "video";
  targetTrackId: string;
  matchedAsset: MediaAssetItem | null;
  matchQuality: MatchQuality;
  confidence: number; // 0.0 to 1.0
  reason: string;
  isExistingAssignment: boolean;
}

export interface MatchOptions {
  /** If true, overwrite existing assignedAssetId. Defaults to false. */
  replaceExisting?: boolean;
  /** Allow assigning the same asset to multiple shots. Defaults to false. */
  allowDuplicates?: boolean;
}

/**
 * Normalized parse of scene & shot numbers from filenames or titles.
 * Examples:
 * - "scene_01_shot_02.png" -> { scene: 1, shot: 2 }
 * - "scene-01-02.jpg"      -> { scene: 1, shot: 2 }
 * - "s02_sh01.mp4"         -> { scene: 2, shot: 1 }
 * - "Scene_03.png"         -> { scene: 3, shot: undefined }
 * - "shot_04.png"          -> { scene: undefined, shot: 4 }
 */
export function extractSceneAndShotNumber(filename: string): {
  scene?: number;
  shot?: number;
} {
  const clean = filename.toLowerCase().replace(/\.[^/.]+$/, "");

  // Pattern 1: scene-X-shot-Y or sX_shY
  const sceneShotMatch = clean.match(/(?:scene|s)[\s_-]*0*(\d+)[\s_-]+(?:shot|sh)[\s_-]*0*(\d+)/i);
  if (sceneShotMatch) {
    return {
      scene: parseInt(sceneShotMatch[1], 10),
      shot: parseInt(sceneShotMatch[2], 10),
    };
  }

  // Pattern 2: scene_01_02 or scene-1-2
  const sceneNumShotNumMatch = clean.match(/(?:scene|s)[\s_-]*0*(\d+)[\s_-]+0*(\d+)\b/i);
  if (sceneNumShotNumMatch) {
    return {
      scene: parseInt(sceneNumShotNumMatch[1], 10),
      shot: parseInt(sceneNumShotNumMatch[2], 10),
    };
  }

  // Pattern 3: scene-X only
  const sceneOnlyMatch = clean.match(/(?:scene|s)[\s_-]*0*(\d+)\b/i);
  const scene = sceneOnlyMatch ? parseInt(sceneOnlyMatch[1], 10) : undefined;

  // Pattern 4: shot-Y only
  const shotOnlyMatch = clean.match(/(?:shot|sh)[\s_-]*0*(\d+)\b/i);
  const shot = shotOnlyMatch ? parseInt(shotOnlyMatch[1], 10) : undefined;

  return { scene, shot };
}

/**
 * Computes token similarity between filename and prompt/title.
 */
function computeTextSimilarity(textA: string, textB: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Matches available Media Library assets to Shot Plan slots.
 */
export function matchAssetsToPlan(
  plan: ScenePlan,
  assets: readonly MediaAssetItem[],
  tracks: readonly TimelineTrack[] = [],
  options: MatchOptions = {}
): ShotAssetMatch[] {
  const allShots = getAllShotsFromPlan(plan);
  const matches: ShotAssetMatch[] = [];
  const assignedAssetIds = new Set<string>();

  // Map of asset ID to asset item for O(1) resolution
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  // Visual track lock check helper
  const targetTrackId = "visual-1"; // default primary visual track
  const track = getTrackById(tracks, targetTrackId);
  const isTrackLocked = track?.locked === true;

  // Track shot numbers per scene
  const sceneShotCounts = new Map<number, number>();
  for (const s of plan.scenes) {
    sceneShotCounts.set(s.sceneNumber, s.shots.length);
  }

  for (const shot of allShots) {
    // 0. Check track lock
    if (isTrackLocked) {
      matches.push({
        shotId: shot.shotId,
        sceneNumber: getSceneNumberFromShotId(shot.shotId),
        shotNumber: shot.shotNumber,
        mediaKind: shot.mediaKind,
        targetTrackId,
        matchedAsset: null,
        matchQuality: "locked-track",
        confidence: 0,
        reason: `Target track "${track?.name || targetTrackId}" is locked. Unlock track to assign media.`,
        isExistingAssignment: Boolean(shot.assignedAssetId),
      });
      continue;
    }

    // 1. Check existing manual assignment
    if (shot.assignedAssetId && !options.replaceExisting) {
      const existingAsset = assetMap.get(shot.assignedAssetId);
      if (existingAsset) {
        if (!options.allowDuplicates) assignedAssetIds.add(existingAsset.id);
        matches.push({
          shotId: shot.shotId,
          sceneNumber: getSceneNumberFromShotId(shot.shotId),
          shotNumber: shot.shotNumber,
          mediaKind: shot.mediaKind,
          targetTrackId,
          matchedAsset: existingAsset,
          matchQuality: "exact",
          confidence: 1.0,
          reason: "Existing manual assignment preserved",
          isExistingAssignment: true,
        });
        continue;
      }
    }

    const sceneNum = getSceneNumberFromShotId(shot.shotId);
    let bestAsset: MediaAssetItem | null = null;
    let bestQuality: MatchQuality = "none";
    let bestConfidence = 0;
    let matchReason = "No matching media found";

    // Tier 1 & 2: Search for exact filename/ID matches
    for (const asset of assets) {
      if (!options.allowDuplicates && assignedAssetIds.has(asset.id)) continue;

      // Category filter: Never assign video to image slot or image to video slot
      if (asset.category !== shot.mediaKind) continue;

      const parsed = extractSceneAndShotNumber(asset.name);

      // Exact scene + shot match (e.g. scene_01_shot_02 matching scene 1 shot 2)
      if (parsed.scene === sceneNum && parsed.shot === shot.shotNumber) {
        bestAsset = asset;
        bestQuality = "exact";
        bestConfidence = 1.0;
        matchReason = `Exact match on scene ${sceneNum}, shot ${shot.shotNumber} (${asset.name})`;
        break;
      }

      // Single-shot scene match (e.g. "scene_01.png" when scene 1 has only 1 shot)
      const totalShotsInScene = sceneShotCounts.get(sceneNum) || 1;
      if (
        totalShotsInScene === 1 &&
        parsed.scene === sceneNum &&
        (parsed.shot === 1 || parsed.shot === undefined)
      ) {
        bestAsset = asset;
        bestQuality = "exact";
        bestConfidence = 0.95;
        matchReason = `Matched single-shot scene ${sceneNum} (${asset.name})`;
        break;
      }
    }

    // Tier 3: Heuristic text similarity if no exact match found
    if (!bestAsset) {
      let highestSimilarity = 0;
      let candidateAsset: MediaAssetItem | null = null;

      for (const asset of assets) {
        if (!options.allowDuplicates && assignedAssetIds.has(asset.id)) continue;
        if (asset.category !== shot.mediaKind) continue;

        const sim = computeTextSimilarity(asset.name, shot.prompt);
        if (sim > highestSimilarity && sim >= 0.35) {
          highestSimilarity = sim;
          candidateAsset = asset;
        }
      }

      if (candidateAsset) {
        bestAsset = candidateAsset;
        bestQuality = "suggested";
        bestConfidence = parseFloat(highestSimilarity.toFixed(2));
        matchReason = `Suggested match based on prompt keywords (${Math.round(highestSimilarity * 100)}% similarity)`;
      }
    }

    if (bestAsset && !options.allowDuplicates) {
      assignedAssetIds.add(bestAsset.id);
    }

    matches.push({
      shotId: shot.shotId,
      sceneNumber: sceneNum,
      shotNumber: shot.shotNumber,
      mediaKind: shot.mediaKind,
      targetTrackId,
      matchedAsset: bestAsset,
      matchQuality: bestQuality,
      confidence: bestConfidence,
      reason: matchReason,
      isExistingAssignment: false,
    });
  }

  return matches;
}

function getSceneNumberFromShotId(shotId: string): number {
  const match = shotId.match(/scene-0*(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
}
