import { describe, expect, it } from "vitest";
import type { TimelineClip, TimelineTrack, TimelineTransition } from "@/types/timeline";
import {
  getActiveTransitionsByTrack,
  getActiveVisualClips,
  getRenderableVisualClips,
  getVisibleVisualTracksInPaintOrder,
} from "./preview-composition";

const track = (
  id: string,
  order: number,
  options: Partial<TimelineTrack> = {},
): TimelineTrack => ({
  id,
  name: id,
  type: "visual",
  order,
  muted: false,
  volume: 1,
  visible: true,
  locked: false,
  ...options,
});

const clip = (
  id: string,
  trackId: string,
  startTime: number,
  duration: number,
  type: TimelineClip["type"] = "video",
): TimelineClip => ({
  id,
  assetId: `asset-${id}`,
  name: `${id}.mp4`,
  type,
  trackId,
  startTime,
  duration,
  inPoint: 0,
  outPoint: duration,
  sourceDuration: duration,
});

const transition: TimelineTransition = {
  id: "transition-a-b",
  type: "cross-dissolve",
  duration: 1,
  fromClipId: "a",
  toClipId: "b",
  trackId: "visual-1",
};

describe("preview composition selectors", () => {
  it("returns no active transitions before hydration", () => {
    const clips = [clip("a", "visual-1", 0, 2), clip("b", "visual-1", 2, 2)];
    const map = new Map(clips.map((item) => [item.id, item]));
    expect(getActiveTransitionsByTrack(false, [transition], map, 2, [track("visual-1", 0)])).toEqual(new Map());
  });

  it("selects transition progress by normalized visual track and skips hidden tracks", () => {
    const clips = [
      clip("a", "visual", 0, 2),
      clip("b", "visual-1", 2, 2),
      clip("c", "visual-2", 0, 2),
      clip("d", "visual-2", 2, 2),
    ];
    const transitions = [
      transition,
      { ...transition, id: "hidden", fromClipId: "c", toClipId: "d", trackId: "visual-2" },
    ];
    const tracks = [
      track("visual-1", 0),
      track("visual-2", 1, { visible: false }),
    ];
    const map = new Map(clips.map((item) => [item.id, item]));
    const active = getActiveTransitionsByTrack(true, transitions, map, 2, tracks);
    expect(active.size).toBe(1);
    expect(active.get("visual-1")?.progress).toBe(0.5);
  });

  it("filters hidden and nonvisual clips before playhead composition", () => {
    const clips = [
      clip("base", "visual-1", 0, 4),
      clip("hidden", "visual-2", 0, 4),
      clip("audio", "audio", 0, 4, "audio"),
      clip("outside", "visual-1", 4, 2),
    ];
    const tracks = [
      track("visual-1", 1),
      track("visual-2", 0, { visible: false }),
      track("audio", 0, { type: "audio" }),
    ];
    expect(getRenderableVisualClips(clips, tracks).map((item) => item.id)).toEqual(["base", "outside"]);
    expect(getActiveVisualClips(clips, tracks, 1, true).map((item) => item.id)).toEqual(["base"]);
  });

  it("sorts active visual clips base-first for correct paint order", () => {
    const clips = [
      clip("overlay", "visual-2", 0, 3),
      clip("base", "visual-1", 0, 3),
    ];
    const tracks = [track("visual-2", 0), track("visual-1", 1)];
    expect(getActiveVisualClips(clips, tracks, 1, true).map((item) => item.id)).toEqual(["base", "overlay"]);
  });

  it("returns visible layers in base-to-foreground paint order", () => {
    const tracks = [
      track("visual-2", 0),
      track("visual-1", 1),
      track("visual-3", 2, { visible: false }),
    ];
    expect(getVisibleVisualTracksInPaintOrder(tracks).map((item) => item.id)).toEqual(["visual-1", "visual-2"]);
  });
});
