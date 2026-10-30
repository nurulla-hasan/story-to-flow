import { describe, it, expect } from "vitest";
import { cloneTimelineHistorySnapshot, TimelineHistory } from "./timeline-history";
import type { TimelineClip, TimelineTrack, TimelineTransition } from "@/types/timeline";
import type { ScenePlan } from "@/lib/scene-plan";

describe("Timeline Plan & History Undo/Redo Integration Tests (Phase B & C)", () => {
  const tracks: TimelineTrack[] = [
    {
      id: "visual-1",
      name: "Visual 1",
      type: "visual",
      order: 0,
      visible: true,
      locked: false,
      muted: false,
      volume: 1,
    },
  ];

  const planA: ScenePlan = {
    schemaVersion: 1,
    scenes: [
      {
        sceneId: "scene-01",
        sceneNumber: 1,
        title: "Morning",
        shots: [
          {
            shotId: "shot-01",
            shotNumber: 1,
            startTime: 0,
            duration: 4,
            mediaKind: "image",
            prompt: "Sunrise",
          },
          {
            shotId: "shot-02",
            shotNumber: 2,
            startTime: 4,
            duration: 5,
            mediaKind: "image",
            prompt: "Farmer",
          },
        ],
      },
    ],
    totalDuration: 9,
  };

  const planB: ScenePlan = {
    schemaVersion: 1,
    scenes: [
      {
        sceneId: "scene-02",
        sceneNumber: 1,
        title: "Night",
        shots: [
          {
            shotId: "shot-night-01",
            shotNumber: 1,
            startTime: 0,
            duration: 6,
            mediaKind: "image",
            prompt: "Moonlight",
          },
        ],
      },
    ],
    totalDuration: 6,
  };

  it("plan import -> assign asset -> undo -> redo restores both clip and plan assignment", () => {
    const history = new TimelineHistory(10);

    // Initial state: empty timeline, no plan
    let currentClips: TimelineClip[] = [];
    const currentTransitions: TimelineTransition[] = [];
    let currentPlan: ScenePlan | null = null;

    // Step 1: Import Plan A (push snapshot of empty state)
    history.pushUndo(cloneTimelineHistorySnapshot(tracks, currentClips, currentTransitions, currentPlan));
    currentPlan = JSON.parse(JSON.stringify(planA));

    expect(currentPlan?.scenes[0].shots[0].assignedClipId).toBeUndefined();

    // Step 2: Assign asset to shot-01 (push snapshot before assignment)
    history.pushUndo(cloneTimelineHistorySnapshot(tracks, currentClips, currentTransitions, currentPlan));

    const newClip: TimelineClip = {
      id: "clip-shot-01",
      assetId: "asset-img-1",
      name: "Sunrise.png",
      type: "image",
      trackId: "visual-1",
      startTime: 0,
      duration: 4,
      inPoint: 0,
      outPoint: 4,
    };
    currentClips = [newClip];
    currentPlan = {
      ...currentPlan!,
      scenes: [
        {
          ...currentPlan!.scenes[0],
          shots: [
            {
              ...currentPlan!.scenes[0].shots[0],
              assignedAssetId: "asset-img-1",
              assignedClipId: "clip-shot-01",
            },
            currentPlan!.scenes[0].shots[1],
          ],
        },
      ],
    };

    expect(currentClips).toHaveLength(1);
    expect(currentPlan.scenes[0].shots[0].assignedClipId).toBe("clip-shot-01");

    // Step 3: Undo assignment
    const snapshotBeforeAssignment = history.takeUndo(
      cloneTimelineHistorySnapshot(tracks, currentClips, currentTransitions, currentPlan)
    );
    expect(snapshotBeforeAssignment).not.toBeNull();
    currentClips = snapshotBeforeAssignment!.clips;
    currentPlan = snapshotBeforeAssignment!.scenePlan ?? null;

    // Verify clips and plan are both reverted
    expect(currentClips).toHaveLength(0);
    expect(currentPlan?.scenes[0].shots[0].assignedClipId).toBeUndefined();
    expect(currentPlan?.scenes[0].shots[0].assignedAssetId).toBeUndefined();

    // Step 4: Redo assignment
    const snapshotAfterAssignment = history.takeRedo(
      cloneTimelineHistorySnapshot(tracks, currentClips, currentTransitions, currentPlan)
    );
    expect(snapshotAfterAssignment).not.toBeNull();
    currentClips = snapshotAfterAssignment!.clips;
    currentPlan = snapshotAfterAssignment!.scenePlan ?? null;

    // Verify clips and plan are both restored together
    expect(currentClips).toHaveLength(1);
    expect(currentClips[0].id).toBe("clip-shot-01");
    expect(currentPlan?.scenes[0].shots[0].assignedClipId).toBe("clip-shot-01");
    expect(currentPlan?.scenes[0].shots[0].assignedAssetId).toBe("asset-img-1");
  });

  it("plan replace -> undo restores original plan", () => {
    const history = new TimelineHistory(10);
    const clips: TimelineClip[] = [];
    const transitions: TimelineTransition[] = [];
    let plan = JSON.parse(JSON.stringify(planA)) as ScenePlan;

    // Push snapshot with Plan A
    history.pushUndo(cloneTimelineHistorySnapshot(tracks, clips, transitions, plan));

    // Replace with Plan B
    plan = JSON.parse(JSON.stringify(planB)) as ScenePlan;
    expect(plan.scenes[0].sceneId).toBe("scene-02");

    // Undo replace
    const restored = history.takeUndo(cloneTimelineHistorySnapshot(tracks, clips, transitions, plan));
    expect(restored).not.toBeNull();
    plan = restored!.scenePlan as ScenePlan;

    expect(plan.scenes[0].sceneId).toBe("scene-01");
    expect(plan.scenes[0].shots).toHaveLength(2);
  });

  it("assigned clip delete -> undo restores clip and clears/restores plan reference", () => {
    const history = new TimelineHistory(10);

    const clip1: TimelineClip = {
      id: "clip-1",
      assetId: "a1",
      name: "scene1.png",
      type: "image",
      trackId: "visual-1",
      startTime: 0,
      duration: 4,
      inPoint: 0,
      outPoint: 4,
    };
    let clips = [clip1];
    const transitions: TimelineTransition[] = [];
    let plan: ScenePlan = {
      ...planA,
      scenes: [
        {
          ...planA.scenes[0],
          shots: [
            {
              ...planA.scenes[0].shots[0],
              assignedAssetId: "a1",
              assignedClipId: "clip-1",
            },
            planA.scenes[0].shots[1],
          ],
        },
      ],
    };

    // Push snapshot before deletion
    history.pushUndo(cloneTimelineHistorySnapshot(tracks, clips, transitions, plan));

    // Delete clip-1
    clips = [];
    plan = {
      ...plan,
      scenes: [
        {
          ...plan.scenes[0],
          shots: [
            {
              ...plan.scenes[0].shots[0],
              assignedAssetId: undefined,
              assignedClipId: undefined,
            },
            plan.scenes[0].shots[1],
          ],
        },
      ],
    };

    expect(clips).toHaveLength(0);
    expect(plan.scenes[0].shots[0].assignedClipId).toBeUndefined();

    // Undo deletion
    const restored = history.takeUndo(cloneTimelineHistorySnapshot(tracks, clips, transitions, plan));
    expect(restored).not.toBeNull();
    clips = restored!.clips;
    plan = restored!.scenePlan as ScenePlan;

    expect(clips).toHaveLength(1);
    expect(clips[0].id).toBe("clip-1");
    expect(plan.scenes[0].shots[0].assignedClipId).toBe("clip-1");
    expect(plan.scenes[0].shots[0].assignedAssetId).toBe("a1");
  });

  it("atomic batch assignment of multiple assets creates clips and reverts in single undo step", () => {
    const history = new TimelineHistory(10);
    let clips: TimelineClip[] = [];
    const transitions: TimelineTransition[] = [];
    let plan = JSON.parse(JSON.stringify(planA)) as ScenePlan;

    // Push snapshot before batch assignment
    history.pushUndo(cloneTimelineHistorySnapshot(tracks, clips, transitions, plan));

    // Batch assign 2 shots simultaneously
    const clip1: TimelineClip = {
      id: "c-1",
      assetId: "a1",
      name: "asset1.png",
      type: "image",
      trackId: "visual-1",
      startTime: 0,
      duration: 4,
      inPoint: 0,
      outPoint: 4,
    };
    const clip2: TimelineClip = {
      id: "c-2",
      assetId: "a2",
      name: "asset2.png",
      type: "image",
      trackId: "visual-1",
      startTime: 4,
      duration: 5,
      inPoint: 0,
      outPoint: 5,
    };

    clips = [clip1, clip2];
    plan = {
      ...plan,
      scenes: [
        {
          ...plan.scenes[0],
          shots: [
            { ...plan.scenes[0].shots[0], assignedAssetId: "a1", assignedClipId: "c-1" },
            { ...plan.scenes[0].shots[1], assignedAssetId: "a2", assignedClipId: "c-2" },
          ],
        },
      ],
    };

    expect(clips).toHaveLength(2);
    expect(plan.scenes[0].shots[0].assignedClipId).toBe("c-1");
    expect(plan.scenes[0].shots[1].assignedClipId).toBe("c-2");

    // Undo batch assignment in ONE single step
    const reverted = history.takeUndo(cloneTimelineHistorySnapshot(tracks, clips, transitions, plan));
    expect(reverted).not.toBeNull();
    clips = reverted!.clips;
    plan = reverted!.scenePlan as ScenePlan;

    expect(clips).toHaveLength(0);
    expect(plan.scenes[0].shots[0].assignedClipId).toBeUndefined();
    expect(plan.scenes[0].shots[1].assignedClipId).toBeUndefined();

    // Redo batch assignment in ONE single step
    const redone = history.takeRedo(cloneTimelineHistorySnapshot(tracks, clips, transitions, plan));
    expect(redone).not.toBeNull();
    clips = redone!.clips;
    plan = redone!.scenePlan as ScenePlan;

    expect(clips).toHaveLength(2);
    expect(plan.scenes[0].shots[0].assignedClipId).toBe("c-1");
    expect(plan.scenes[0].shots[1].assignedClipId).toBe("c-2");
  });
});
