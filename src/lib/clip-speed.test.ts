import { describe, expect, it } from "vitest";
import type { TimelineClip } from "@/types/timeline";
import { buildClipSpeedUpdate } from "./clip-speed";

const baseClip: TimelineClip = {
  id: "video",
  assetId: "asset-video",
  name: "short-tail.mp4",
  type: "video",
  trackId: "visual-1",
  startTime: 0,
  duration: 1,
  inPoint: 4.8,
  outPoint: 5.8,
  sourceDuration: 5,
  speed: 1,
};

describe("buildClipSpeedUpdate source bounds", () => {
  it("never rounds the allowed source duration upward", () => {
    const update = buildClipSpeedUpdate(baseClip, 2);
    expect(update.duration).toBeCloseTo(0.1, 3);
    expect(baseClip.inPoint + update.duration! * 2).toBeLessThanOrEqual(5);
    expect(update.outPoint).toBeLessThanOrEqual(5);
  });

  it("allows a sub-500ms duration when only a short source tail remains", () => {
    const update = buildClipSpeedUpdate(baseClip, 1);
    expect(update.duration).toBeCloseTo(0.2, 3);
    expect(update.outPoint).toBe(5);
  });

  it("does not extend the source out-point when the speed change fits already", () => {
    const clip = {
      ...baseClip,
      duration: 0.05,
      inPoint: 4.8,
      outPoint: 4.85,
      speed: 1,
    };
    const update = buildClipSpeedUpdate(clip, 2);
    expect(update.duration).toBeUndefined();
    expect(update.outPoint).toBeLessThanOrEqual(5);
  });
});
