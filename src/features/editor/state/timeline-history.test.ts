import { describe, expect, it } from "vitest";
import type { TimelineClip, TimelineTrack, TimelineTransition } from "@/types/timeline";
import { cloneTimelineHistorySnapshot, TimelineHistory } from "./timeline-history";

const tracks: TimelineTrack[] = [{
  id: "visual-1", name: "Visual 1", type: "visual", order: 0, muted: false, volume: 1, visible: true, locked: false,
}];
const clip = (duration: number): TimelineClip => ({
  id: "clip", assetId: "asset", name: "clip", type: "image", trackId: "visual-1",
  startTime: 0, duration, inPoint: 0, outPoint: duration,
});
const snapshot = (duration: number) => cloneTimelineHistorySnapshot(tracks, [clip(duration)], [] as TimelineTransition[]);

describe("TimelineHistory", () => {
  it("tracks undo and redo availability and clears redo on new edits", () => {
    const history = new TimelineHistory(3);
    expect(history.canUndo).toBe(false);
    expect(history.takeUndo(snapshot(2))).toBeNull();
    history.pushUndo(snapshot(1));
    expect(history.canUndo).toBe(true);
    expect(history.takeUndo(snapshot(2))?.clips[0].duration).toBe(1);
    expect(history.canRedo).toBe(true);
    history.pushUndo(snapshot(3));
    expect(history.canRedo).toBe(false);
  });

  it("bounds undo history and restores the next snapshot in each direction", () => {
    const history = new TimelineHistory(2);
    history.pushUndo(snapshot(1));
    history.pushUndo(snapshot(2));
    history.pushUndo(snapshot(3));
    expect(history.takeUndo(snapshot(4))?.clips[0].duration).toBe(3);
    expect(history.takeUndo(snapshot(3))?.clips[0].duration).toBe(2);
    expect(history.takeUndo(snapshot(2))).toBeNull();
    expect(history.takeRedo(snapshot(1))?.clips[0].duration).toBe(3);
  });

  it("deep-clones project data before storing a snapshot", () => {
    const original = clip(1);
    const copied = cloneTimelineHistorySnapshot(tracks, [original], []);
    original.duration = 9;
    expect(copied.clips[0].duration).toBe(1);
  });

  it("atomically snapshots, clones and restores scenePlan with shot assignments", () => {
    const mockPlan = {
      schemaVersion: 1 as const,
      scenes: [
        {
          sceneId: "s1",
          sceneNumber: 1,
          title: "S1",
          shots: [
            {
              shotId: "sh1",
              shotNumber: 1,
              startTime: 0,
              duration: 4,
              mediaKind: "image" as const,
              prompt: "prompt",
              assignedAssetId: "a1",
              assignedClipId: "clip1",
            },
          ],
        },
      ],
      totalDuration: 4,
    };

    const copied = cloneTimelineHistorySnapshot(tracks, [clip(4)], [], mockPlan);
    expect(copied.scenePlan).toBeDefined();
    expect(copied.scenePlan?.scenes[0].shots[0].assignedClipId).toBe("clip1");

    // Mutating original does not mutate snapshot
    mockPlan.scenes[0].shots[0].assignedClipId = "mutated";
    expect(copied.scenePlan?.scenes[0].shots[0].assignedClipId).toBe("clip1");

    const history = new TimelineHistory(5);
    history.pushUndo(copied);
    expect(history.canUndo).toBe(true);

    const currentSnapshot = cloneTimelineHistorySnapshot(tracks, [clip(4)], [], null);
    const restored = history.takeUndo(currentSnapshot);
    expect(restored?.scenePlan?.scenes[0].shots[0].assignedClipId).toBe("clip1");
  });
});
