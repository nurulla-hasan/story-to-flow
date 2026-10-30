import { describe, expect, it } from "vitest";
import type { TimelineClip, TimelineTransition } from "@/types/timeline";
import { reconcileTransitionsForClips } from "./timeline-transition-state";

const clip = (id: string, startTime: number, duration = 2): TimelineClip => ({
  id, assetId: id, name: id, type: "image", trackId: "visual-1",
  startTime, duration, inPoint: 0, outPoint: duration,
});

const transition = (fromClipId: string, toClipId: string, duration = 1): TimelineTransition => ({
  id: `${fromClipId}-${toClipId}`, type: "cross-dissolve", duration, fromClipId, toClipId, trackId: "visual-1",
});

describe("reconcileTransitionsForClips", () => {
  it("drops transitions for missing or no-longer-adjacent clips", () => {
    const clips = [clip("a", 0), clip("b", 2), clip("c", 8)];
    const result = reconcileTransitionsForClips([transition("a", "b"), transition("a", "c"), transition("b", "missing")], clips);
    expect(result.map((item) => item.id)).toEqual(["a-b"]);
  });

  it("keeps valid transitions within the duration limits of their clips", () => {
    const result = reconcileTransitionsForClips([transition("a", "b", 99)], [clip("a", 0), clip("b", 2)]);
    expect(result).toHaveLength(1);
    expect(result[0].duration).toBeLessThanOrEqual(2);
    expect(result[0].duration).toBeGreaterThan(0);
  });
});
