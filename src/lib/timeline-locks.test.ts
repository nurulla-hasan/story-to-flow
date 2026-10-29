import { describe, expect, it } from "vitest";
import type { TimelineClip, TimelineTrack } from "@/types/timeline";
import { hasLockedTrackGestureViolation } from "./timeline-locks";

const tracks: TimelineTrack[] = [
  {
    id: "visual-1",
    name: "Locked visual",
    type: "visual",
    order: 0,
    muted: false,
    volume: 1,
    visible: true,
    locked: true,
  },
  {
    id: "visual-2",
    name: "Unlocked visual",
    type: "visual",
    order: 1,
    muted: false,
    volume: 1,
    visible: true,
    locked: false,
  },
];

const clip: TimelineClip = {
  id: "clip-1",
  assetId: "asset-1",
  name: "scene.png",
  type: "image",
  trackId: "visual-1",
  startTime: 0,
  duration: 3,
  inPoint: 0,
  outPoint: 3,
  volume: 1,
  transform: { x: 0, y: 0, scale: 1, rotation: 0 },
};

describe("locked track gesture validation", () => {
  it("allows an unchanged locked clip", () => {
    expect(hasLockedTrackGestureViolation([clip], [{ ...clip }], tracks)).toBe(false);
  });

  it("blocks transform-only changes on a locked track", () => {
    const edited = {
      ...clip,
      transform: { ...clip.transform!, rotation: 15 },
    };
    expect(hasLockedTrackGestureViolation([clip], [edited], tracks)).toBe(true);
  });

  it("ignores optional properties that are explicitly undefined", () => {
    const gestureSnapshot = { ...clip, zoomEffect: undefined };
    expect(hasLockedTrackGestureViolation([clip], [gestureSnapshot], tracks)).toBe(false);
  });

  it("blocks volume, fade, and zoom-effect changes on a locked track", () => {
    expect(
      hasLockedTrackGestureViolation([clip], [{ ...clip, volume: 0.5 }], tracks)
    ).toBe(true);
    expect(
      hasLockedTrackGestureViolation([clip], [{ ...clip, fadeInDuration: 0.4 }], tracks)
    ).toBe(true);
    expect(
      hasLockedTrackGestureViolation(
        [clip],
        [{ ...clip, zoomEffect: { type: "zoom-in", amount: 0.2 } as TimelineClip["zoomEffect"] }],
        tracks
      )
    ).toBe(true);
  });

  it("blocks removing a locked clip or moving it to an unlocked track", () => {
    expect(hasLockedTrackGestureViolation([clip], [], tracks)).toBe(true);
    expect(
      hasLockedTrackGestureViolation(
        [clip],
        [{ ...clip, trackId: "visual-2" }],
        tracks
      )
    ).toBe(true);
  });

  it("blocks adding a new clip to a locked track", () => {
    expect(
      hasLockedTrackGestureViolation([], [clip], tracks)
    ).toBe(true);
  });
});
