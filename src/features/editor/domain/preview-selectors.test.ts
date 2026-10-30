import { describe, expect, it } from "vitest";
import type { TimelineClip, TimelineTrack, TimelineTransition } from "@/types/timeline";
import { getActiveTransitionsByTrack, getActiveVisualClips } from "./preview-selectors";

const track = (id: string, order: number, visible = true): TimelineTrack => ({
  id, name: id, type: "visual", order, muted: false, volume: 1, visible, locked: false,
});

const clip = (id: string, trackId: string, startTime: number, duration = 2): TimelineClip => ({
  id, assetId: id, name: id, type: "image", trackId, startTime, duration, inPoint: 0, outPoint: duration,
});

describe("preview selectors", () => {
  it("returns only active clips from visible visual tracks in layer order", () => {
    const tracks = [track("visual-2", 0), track("visual-1", 1), track("visual-3", 2, false)];
    const clips = [
      clip("upper", "visual-2", 0),
      clip("lower", "visual-1", 0),
      clip("hidden", "visual-3", 0),
      clip("inactive", "visual-1", 5),
    ];
    expect(getActiveVisualClips(clips, tracks, 1).map((item) => item.id)).toEqual(["lower", "upper"]);
  });

  it("indexes active transitions by normalized track and ignores inactive or missing clips", () => {
    const tracks = [track("visual-1", 0)];
    const from = clip("from", "visual-1", 0);
    const to = clip("to", "visual-1", 2);
    const transition: TimelineTransition = {
      id: "transition", type: "cross-dissolve", duration: 1,
      fromClipId: "from", toClipId: "to", trackId: "visual-1",
    };
    expect(getActiveTransitionsByTrack([transition], [from, to], tracks, 2).get("visual-1")?.transition.id).toBe("transition");
    expect(getActiveTransitionsByTrack([transition], [from, to], tracks, 10).size).toBe(0);
    expect(getActiveTransitionsByTrack([transition], [from], tracks, 2).size).toBe(0);
  });
});
