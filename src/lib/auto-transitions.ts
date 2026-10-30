/**
 * Auto Transition Resolver from Scene Plan Suggestions
 *
 * Implements Phase D2 of Story Plan -> Timeline Blocks -> Auto Motion/Transition.
 * Pure module that reconciles transitionToNext plan suggestions into real TimelineTransitions.
 */

import type { ScenePlan } from "@/lib/scene-plan";
import { getAllShotsFromPlan } from "@/lib/scene-plan";
import type { TimelineClip, TimelineTrack, TimelineTransition, TransitionType } from "@/types/timeline";
import { isTrackLocked } from "@/types/timeline";
import {
  areClipsAdjacentForTransition,
  validateTransitionDuration,
  MIN_TRANSITION_DURATION,
} from "@/lib/transition-helpers";

export interface AutoTransitionOptions {
  /** If true, overwrite existing manual transitions. Defaults to false. */
  replaceExisting?: boolean;
}

export interface AutoTransitionResult {
  transitions: TimelineTransition[];
  appliedCount: number;
  skippedCount: number;
  skippedReasons: string[];
}

export const VALID_PLAN_TRANSITIONS: ReadonlySet<TransitionType> = new Set([
  "cross-dissolve",
  "fade-black",
  "slide-left",
  "slide-right",
]);

/**
 * Applies transitionToNext suggestions from a ScenePlan between adjacent assigned visual clips.
 */
export function applyPlanTransitions(
  plan: ScenePlan,
  clips: readonly TimelineClip[],
  tracks: readonly TimelineTrack[],
  existingTransitions: readonly TimelineTransition[],
  options: AutoTransitionOptions = {}
): AutoTransitionResult {
  const allShots = getAllShotsFromPlan(plan);
  const clipMap = new Map(clips.map((c) => [c.id, c]));
  const resultTransitions: TimelineTransition[] = [...existingTransitions];
  let appliedCount = 0;
  let skippedCount = 0;
  const skippedReasons: string[] = [];

  for (let i = 0; i < allShots.length - 1; i++) {
    const fromShot = allShots[i];
    const toShot = allShots[i + 1];

    if (!fromShot.transitionToNext) continue;

    const transSuggestion = fromShot.transitionToNext;
    if (!VALID_PLAN_TRANSITIONS.has(transSuggestion.type)) {
      skippedCount++;
      skippedReasons.push(
        `Shot "${fromShot.shotId}": unsupported transition type "${transSuggestion.type}".`
      );
      continue;
    }

    // Both shots must have assigned clips
    if (!fromShot.assignedClipId || !toShot.assignedClipId) {
      skippedCount++;
      skippedReasons.push(
        `Boundary between "${fromShot.shotId}" and "${toShot.shotId}": media not yet assigned to both shots.`
      );
      continue;
    }

    const fromClip = clipMap.get(fromShot.assignedClipId);
    const toClip = clipMap.get(toShot.assignedClipId);
    if (!fromClip || !toClip) {
      skippedCount++;
      skippedReasons.push(
        `Boundary between "${fromShot.shotId}" and "${toShot.shotId}": assigned timeline clip not found.`
      );
      continue;
    }

    // Track lock check
    if (isTrackLocked(fromClip.trackId, tracks) || isTrackLocked(toClip.trackId, tracks)) {
      skippedCount++;
      skippedReasons.push(
        `Boundary between "${fromClip.name}" and "${toClip.name}": track is locked.`
      );
      continue;
    }

    // Adjacency check
    if (!areClipsAdjacentForTransition(fromClip, toClip, tracks)) {
      skippedCount++;
      skippedReasons.push(
        `Clips "${fromClip.name}" and "${toClip.name}" are not adjacent on the same visual track.`
      );
      continue;
    }

    // Clip duration check
    const maxPossibleDur = Math.min(fromClip.duration * 0.5, toClip.duration * 0.5);
    if (maxPossibleDur < MIN_TRANSITION_DURATION) {
      skippedCount++;
      skippedReasons.push(
        `Clips "${fromClip.name}" or "${toClip.name}" are too short for a transition (minimum ${MIN_TRANSITION_DURATION}s).`
      );
      continue;
    }

    const safeDuration = validateTransitionDuration(
      transSuggestion.duration || 0.5,
      fromClip,
      toClip
    );

    // Existing transition between this exact clip pair
    const existingIndex = resultTransitions.findIndex(
      (t) => t.fromClipId === fromClip.id && t.toClipId === toClip.id
    );

    if (existingIndex !== -1) {
      if (!options.replaceExisting) {
        skippedReasons.push(
          `Preserved existing manual transition between "${fromClip.name}" and "${toClip.name}".`
        );
        continue;
      }
      // Replace existing
      resultTransitions[existingIndex] = {
        ...resultTransitions[existingIndex],
        type: transSuggestion.type,
        duration: safeDuration,
      };
      appliedCount++;
    } else {
      // Add new transition
      const newTransition: TimelineTransition = {
        id: `trans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: transSuggestion.type,
        duration: safeDuration,
        fromClipId: fromClip.id,
        toClipId: toClip.id,
        trackId: fromClip.trackId,
      };
      resultTransitions.push(newTransition);
      appliedCount++;
    }
  }

  return {
    transitions: resultTransitions,
    appliedCount,
    skippedCount,
    skippedReasons,
  };
}
