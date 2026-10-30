import type { ScenePlan } from "@/lib/scene-plan";

export const CONSUMED_SCENE_PLAN_HANDOFF_KEY =
  "story_forge_consumed_scene_plan_handoff_v2";

export function getScenePlanResponseFingerprint(response: string): string {
  let hash = 2166136261;
  for (let index = 0; index < response.length; index += 1) {
    hash ^= response.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return response.length.toString(36) + "-" + (hash >>> 0).toString(36);
}

export function areScenePlansEquivalent(
  left: ScenePlan,
  right: ScenePlan
): boolean {
  const normalize = (plan: ScenePlan) =>
    plan.scenes.map((scene) => ({
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      title: scene.title,
      shots: scene.shots.map((shot) => ({
        shotId: shot.shotId,
        shotNumber: shot.shotNumber,
        startTime: shot.startTime,
        duration: shot.duration,
        sourceDuration: shot.sourceDuration,
        mediaKind: shot.mediaKind,
        voiceover: shot.voiceover,
        prompt: shot.prompt,
        motion: shot.motion,
        transitionToNext: shot.transitionToNext,
      })),
    }));

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

export function isScenePlanHandoffConsumed(fingerprint: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CONSUMED_SCENE_PLAN_HANDOFF_KEY) === fingerprint;
  } catch {
    return false;
  }
}

export function markScenePlanHandoffConsumed(fingerprint: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSUMED_SCENE_PLAN_HANDOFF_KEY, fingerprint);
  } catch {
    // The timeline plan is still saved by the editor; this marker only prevents re-import.
  }
}
