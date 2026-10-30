import { describe, expect, it } from "vitest";
import type { ScenePlan } from "@/lib/scene-plan";
import {
  areScenePlansEquivalent,
  getScenePlanResponseFingerprint,
} from "./scene-plan-handoff";

const plan = (assignedAssetId?: string, importedAt = 1): ScenePlan => ({
  schemaVersion: 1,
  importedAt,
  scenes: [
    {
      sceneId: "scene-01",
      sceneNumber: 1,
      title: "Opening",
      shots: [
        {
          shotId: "scene-01-shot-01",
          shotNumber: 1,
          startTime: 0,
          duration: 4,
          mediaKind: "image",
          voiceover: "Opening line",
          prompt: "A quiet village at dawn",
          motion: { type: "zoom-in", amount: 0.15 },
          assignedAssetId,
        },
      ],
    },
  ],
});

describe("scene-plan handoff helpers", () => {
  it("compares plan content while ignoring import timestamps and media assignments", () => {
    expect(areScenePlansEquivalent(plan(), plan("asset-1", 99))).toBe(true);
  });

  it("detects a different generated prompt or timing", () => {
    const changed = plan();
    changed.scenes[0].shots[0].prompt = "A busy city at noon";
    expect(areScenePlansEquivalent(plan(), changed)).toBe(false);
  });

  it("creates a stable fingerprint for a generated response", () => {
    expect(getScenePlanResponseFingerprint("response")).toBe(
      getScenePlanResponseFingerprint("response")
    );
    expect(getScenePlanResponseFingerprint("response")).not.toBe(
      getScenePlanResponseFingerprint("another response")
    );
  });
});
