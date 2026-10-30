import { describe, expect, it } from "vitest";
import type { TimelineClip, TimelineTransition } from "@/types/timeline";
import { calculateTimelineDuration, groupTimelineClipsByTrack, reconcileTransitionsForClips } from "./timeline-derived-state";

const clip = (
  id: string,
  startTime: number,
  duration: number,
  trackId = "visual-1",
): TimelineClip => ({
  id,
  assetId: `asset-${id}`,
  name: `${id}.mp4`,
  type: "video",
  trackId,
  startTime,
  duration,
  inPoint: 0,
  outPoint: duration,
  sourceDuration: duration,
});

const transition: TimelineTransition = {
  id: "transition-ab",
  type: "cross-dissolve",
  duration: 1.5,
  fromClipId: "a",
  toClipId: "b",
  trackId: "visual-1",
};

describe("calculateTimelineDuration", () => {
  it("returns zero for an empty timeline", () => {
    expect(calculateTimelineDuration([])).toBe(0);
  });

  it("uses the furthest clip end and rounds to milliseconds", () => {
    expect(calculateTimelineDuration([
      clip("a", 0, 2.12345),
      clip("b", 4, 1.23456),
    ])).toBe(5.235);
  });
});

describe("reconcileTransitionsForClips", () => {
  it("keeps only transitions whose clips still exist and remain adjacent", () => {
    const clips = [clip("a", 0, 2), clip("b", 2, 2), clip("c", 7, 2)];
    expect(reconcileTransitionsForClips(
      [transition, { ...transition, id: "missing", toClipId: "deleted" }],
      clips,
    )).toHaveLength(1);
  });

  it("clamps surviving transition duration to the connected clip lengths", () => {
    const clips = [clip("a", 0, 1), clip("b", 1, 1)];
    const result = reconcileTransitionsForClips([transition], clips);
    expect(result[0].duration).toBe(0.5);
  });

  it("does not treat clips on different tracks as adjacent", () => {
    const clips = [clip("a", 0, 2, "visual-1"), clip("b", 2, 2, "visual-2")];
    expect(reconcileTransitionsForClips([transition], clips)).toEqual([]);
  });
});

describe("groupTimelineClipsByTrack", () => {
  it("groups clips by track and maps the legacy visual alias", () => {
    const visual = { id: "visual-1", name: "Visual", type: "visual" as const, order: 0, muted: false, volume: 1, visible: true, locked: false };
    const audio = { id: "audio", name: "Audio", type: "audio" as const, order: 0, muted: false, volume: 1, visible: true, locked: false };
    const tracks = [visual, audio];
    const clips = [
      clip("a", 0, 2, "visual"),
      { ...clip("b", 0, 1, "audio"), type: "audio" as const },
    ];
    const grouped = groupTimelineClipsByTrack(tracks, clips, tracks);
    expect(grouped.get("visual-1")?.map((item) => item.id)).toEqual(["a"]);
    expect(grouped.get("audio")?.map((item) => item.id)).toEqual(["b"]);
  });

  it("preserves unknown track IDs instead of dropping clips", () => {
    const tracks = [{ id: "visual-1", name: "Visual", type: "visual" as const, order: 0, muted: false, volume: 1, visible: true, locked: false }];
    const orphan = clip("orphan", 1, 2, "custom-lane");
    expect(groupTimelineClipsByTrack(tracks, [orphan], tracks).get("custom-lane")).toEqual([orphan]);
  });
});
