import { describe, it, expect } from "vitest";
import { applyPlanTransitions } from "./auto-transitions";
import type { ScenePlan } from "./scene-plan";
import type { TimelineClip, TimelineTrack } from "@/types/timeline";

describe("Auto Transition Engine (Phase D2)", () => {
  const mockTracks: TimelineTrack[] = [
    { id: "visual-1", name: "Main Visual", type: "visual", order: 0, visible: true, locked: false, muted: false, volume: 1 },
  ];

  const mockClips: TimelineClip[] = [
    {
      id: "clip-1", assetId: "a1", name: "scene1.png", type: "image",
      trackId: "visual-1", startTime: 0, duration: 4, inPoint: 0, outPoint: 4,
    },
    {
      id: "clip-2", assetId: "a2", name: "scene2.png", type: "image",
      trackId: "visual-1", startTime: 4, duration: 4, inPoint: 0, outPoint: 4,
    },
    {
      id: "clip-3", assetId: "a3", name: "scene3.png", type: "image",
      trackId: "visual-1", startTime: 8, duration: 4, inPoint: 0, outPoint: 4,
    },
  ];

  const mockPlan: ScenePlan = {
    schemaVersion: 1,
    scenes: [
      {
        sceneId: "s1",
        sceneNumber: 1,
        title: "Scene 1",
        shots: [
          {
            shotId: "sh1", shotNumber: 1, startTime: 0, duration: 4, mediaKind: "image", prompt: "p1",
            assignedClipId: "clip-1",
            transitionToNext: { type: "cross-dissolve", duration: 0.6 },
          },
          {
            shotId: "sh2", shotNumber: 2, startTime: 4, duration: 4, mediaKind: "image", prompt: "p2",
            assignedClipId: "clip-2",
            transitionToNext: { type: "fade-black", duration: 0.8 },
          },
          {
            shotId: "sh3", shotNumber: 3, startTime: 8, duration: 4, mediaKind: "image", prompt: "p3",
            assignedClipId: "clip-3",
          },
        ],
      },
    ],
  };

  it("applies valid transitionToNext suggestions between adjacent assigned clips", () => {
    const res = applyPlanTransitions(mockPlan, mockClips, mockTracks, []);
    expect(res.appliedCount).toBe(2);
    expect(res.transitions).toHaveLength(2);
    expect(res.transitions[0].type).toBe("cross-dissolve");
    expect(res.transitions[0].fromClipId).toBe("clip-1");
    expect(res.transitions[0].toClipId).toBe("clip-2");
    expect(res.transitions[1].type).toBe("fade-black");
    expect(res.transitions[1].fromClipId).toBe("clip-2");
    expect(res.transitions[1].toClipId).toBe("clip-3");
  });

  it("is idempotent when re-run without duplicate creation", () => {
    const firstRun = applyPlanTransitions(mockPlan, mockClips, mockTracks, []);
    const secondRun = applyPlanTransitions(mockPlan, mockClips, mockTracks, firstRun.transitions);
    expect(secondRun.transitions).toHaveLength(2);
    expect(secondRun.appliedCount).toBe(0); // already exists
  });

  it("skips transitions when neighbor shot has no assigned clip", () => {
    const planUnassigned: ScenePlan = {
      ...mockPlan,
      scenes: [
        {
          ...mockPlan.scenes[0],
          shots: [
            mockPlan.scenes[0].shots[0],
            { ...mockPlan.scenes[0].shots[1], assignedClipId: undefined }, // unassigned!
            mockPlan.scenes[0].shots[2],
          ],
        },
      ],
    };

    const res = applyPlanTransitions(planUnassigned, mockClips, mockTracks, []);
    expect(res.appliedCount).toBe(0);
    expect(res.skippedCount).toBeGreaterThan(0);
    expect(res.skippedReasons[0]).toContain("not yet assigned");
  });

  it("skips transition when track is locked", () => {
    const lockedTracks: TimelineTrack[] = [
      { ...mockTracks[0], locked: true },
    ];
    const res = applyPlanTransitions(mockPlan, mockClips, lockedTracks, []);
    expect(res.appliedCount).toBe(0);
    expect(res.skippedCount).toBe(2);
    expect(res.skippedReasons[0]).toContain("locked");
  });
});
