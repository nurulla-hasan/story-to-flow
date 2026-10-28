import { describe, it, expect } from "vitest";
import type { TimelineClip } from "@/types/timeline";
import {
  calculateLeftTrim,
  calculateLeftTrimWithOverlap,
  calculateRightTrim,
  snapTimestamp,
  MIN_CLIP_DURATION,
} from "./timeline-trim";

describe("Left-Edge Trim Math & Anchoring", () => {
  const sampleVideoClip: TimelineClip = {
    id: "clip-video",
    assetId: "v1",
    name: "action.mp4",
    type: "video",
    trackId: "visual-1",
    startTime: 3.0,
    duration: 5.0,
    inPoint: 2.0,
    outPoint: 7.0,
    sourceDuration: 10.0,
  };

  const sampleImageClip: TimelineClip = {
    id: "clip-image",
    assetId: "i1",
    name: "still.png",
    type: "image",
    trackId: "visual-1",
    startTime: 4.0,
    duration: 4.0,
    inPoint: 0,
    outPoint: 4.0,
  };

  it("trims left edge rightward (positive delta) and anchors timeline right edge", () => {
    // Original: start 3.0, duration 5.0 -> right edge is 8.0, inPoint is 2.0
    // Move left handle +1.5s
    const result = calculateLeftTrim(sampleVideoClip, 1.5);

    expect(result.startTime).toBe(4.5);
    expect(result.duration).toBe(3.5);
    expect(result.inPoint).toBe(3.5);
    expect(result.outPoint).toBe(7.0); // Source out-point anchored!
    expect(result.startTime + result.duration).toBe(8.0); // Timeline right edge anchored!
  });

  it("trims left edge leftward (negative delta) extending media when source allows", () => {
    // inPoint is 2.0, so can extend leftward by up to -2.0s
    const result = calculateLeftTrim(sampleVideoClip, -1.0);

    expect(result.startTime).toBe(2.0);
    expect(result.duration).toBe(6.0);
    expect(result.inPoint).toBe(1.0);
    expect(result.outPoint).toBe(7.0);
    expect(result.startTime + result.duration).toBe(8.0); // Right edge anchored!
  });

  it("clamps leftward trim at source media inPoint 0", () => {
    // Attempting -4.0s delta when inPoint is 2.0 should clamp to -2.0s
    const result = calculateLeftTrim(sampleVideoClip, -4.0);

    expect(result.inPoint).toBe(0);
    expect(result.startTime).toBe(1.0); // 3.0 - 2.0 = 1.0
    expect(result.duration).toBe(7.0); // 5.0 + 2.0 = 7.0
    expect(result.startTime + result.duration).toBe(8.0);
  });

  it("clamps leftward trim at timeline start 0 when startTime < inPoint", () => {
    const nearStartClip: TimelineClip = {
      ...sampleVideoClip,
      startTime: 1.0,
      inPoint: 5.0,
    };

    // Even though inPoint has 5.0s headroom, timeline start is only 1.0s, so max leftward is -1.0s
    const result = calculateLeftTrim(nearStartClip, -3.0);

    expect(result.startTime).toBe(0);
    expect(result.inPoint).toBe(4.0); // 5.0 - 1.0 = 4.0
    expect(result.duration).toBe(6.0); // 5.0 + 1.0 = 6.0
    expect(result.startTime + result.duration).toBe(6.0); // Right edge (1.0 + 5.0) anchored!
  });

  it("enforces minimum clip duration on left trim", () => {
    // Attempting to shrink a 5.0s clip by +4.8s should clamp at duration = MIN_CLIP_DURATION (0.5s)
    const result = calculateLeftTrim(sampleVideoClip, 4.8);

    expect(result.duration).toBe(MIN_CLIP_DURATION);
    expect(result.startTime).toBe(7.5); // 8.0 - 0.5 = 7.5
    expect(result.startTime + result.duration).toBe(8.0);
  });

  it("correctly trims still image left edge while anchoring right edge and keeping inPoint at 0", () => {
    // Image: start 4.0, duration 4.0 -> right edge is 8.0
    const result = calculateLeftTrim(sampleImageClip, 2.0);

    expect(result.startTime).toBe(6.0);
    expect(result.duration).toBe(2.0);
    expect(result.inPoint).toBe(0);
    expect(result.outPoint).toBe(2.0);
    expect(result.startTime + result.duration).toBe(8.0);
  });

  it("clamps still image leftward expansion at timeline start 0", () => {
    const result = calculateLeftTrim(sampleImageClip, -10.0);

    expect(result.startTime).toBe(0);
    expect(result.duration).toBe(8.0); // 4.0 + 4.0
    expect(result.startTime + result.duration).toBe(8.0);
  });
});

describe("Right-Edge Trim Math", () => {
  const sampleVideoClip: TimelineClip = {
    id: "clip-video",
    assetId: "v1",
    name: "action.mp4",
    type: "video",
    trackId: "visual-1",
    startTime: 2.0,
    duration: 4.0,
    inPoint: 2.0,
    outPoint: 6.0,
    sourceDuration: 8.0,
  };

  it("trims right edge positive and anchors start time", () => {
    const result = calculateRightTrim(sampleVideoClip, 1.5);
    expect(result.startTime).toBe(2.0);
    expect(result.duration).toBe(5.5);
    expect(result.inPoint).toBe(2.0);
    expect(result.outPoint).toBe(7.5);
  });

  it("clamps right edge at source media limit", () => {
    // inPoint is 2.0, sourceDuration is 8.0, so max duration is 6.0
    const result = calculateRightTrim(sampleVideoClip, 10.0);
    expect(result.duration).toBe(6.0);
    expect(result.outPoint).toBe(8.0);
  });

  it("clamps right edge at MIN_CLIP_DURATION when shrinking", () => {
    const result = calculateRightTrim(sampleVideoClip, -3.9);
    expect(result.duration).toBe(MIN_CLIP_DURATION);
  });

  it("scales max right-trim duration and calculates outPoint according to clip speed", () => {
    // 2x speed: 8.0 sourceDuration, 2.0 inPoint -> 6.0 remaining source.
    // At 2x speed, remaining timeline duration is 6.0 / 2.0 = 3.0s!
    const fastClip: TimelineClip = {
      ...sampleVideoClip,
      duration: 2.0,
      speed: 2.0,
    };
    const result = calculateRightTrim(fastClip, 5.0);
    expect(result.duration).toBe(3.0);
    // outPoint = inPoint + duration * speed = 2.0 + 3.0 * 2.0 = 8.0
    expect(result.outPoint).toBe(8.0);
  });

  it("scales left-trim delta and inPoint according to clip speed", () => {
    // 2x speed: 8.0 sourceDuration, 2.0 inPoint, 2.0 duration.
    // Extending leftward: inPoint is 2.0, so at 2x speed max left extension is 2.0 / 2.0 = 1.0s.
    const fastClip: TimelineClip = {
      ...sampleVideoClip,
      duration: 2.0,
      speed: 2.0,
    };
    const result = calculateLeftTrim(fastClip, -5.0);
    expect(result.inPoint).toBe(0);
    expect(result.startTime).toBe(1.0); // 2.0 - 1.0
    expect(result.duration).toBe(3.0); // 2.0 + 1.0
  });
});

describe("Snap Timestamp Helper", () => {
  it("snaps within threshold and returns snap guide point", () => {
    const snapPoints = [0, 4.0, 8.0];
    const res = snapTimestamp(4.08, snapPoints, 0.15, true);

    expect(res.isSnapped).toBe(true);
    expect(res.snappedTime).toBe(4.0);
    expect(res.snapGuide).toBe(4.0);
  });

  it("does not snap when beyond threshold", () => {
    const snapPoints = [0, 4.0, 8.0];
    const res = snapTimestamp(4.25, snapPoints, 0.15, true);

    expect(res.isSnapped).toBe(false);
    expect(res.snappedTime).toBe(4.25);
    expect(res.snapGuide).toBeNull();
  });

  it("bypasses snapping completely when disabled", () => {
    const snapPoints = [0, 4.0, 8.0];
    const res = snapTimestamp(4.05, snapPoints, 0.15, false);

    expect(res.isSnapped).toBe(false);
    expect(res.snappedTime).toBe(4.05);
    expect(res.snapGuide).toBeNull();
  });
});

describe("P1 — Left Trim Overlap Clamping & Source Synchronization", () => {
  const clip1: TimelineClip = {
    id: "clip-1",
    assetId: "a1",
    name: "first.mp4",
    type: "video",
    trackId: "visual-1",
    startTime: 0,
    duration: 4.0, // Ends at 4.0s
    inPoint: 0,
    outPoint: 4.0,
    sourceDuration: 10.0,
  };

  const clip2: TimelineClip = {
    id: "clip-2",
    assetId: "a2",
    name: "second.mp4",
    type: "video",
    trackId: "visual-1",
    startTime: 6.0, // Gap of 2.0s between clip1 and clip2
    duration: 4.0, // Ends at 10.0s (anchored)
    inPoint: 3.0,
    outPoint: 7.0,
    sourceDuration: 10.0,
  };

  const allClips = [clip1, clip2];

  it("recalculates inPoint accurately when left trim is clamped by preceding clip", () => {
    // User tries to drag left handle leftward by -5.0s (would reach 1.0s, deep inside clip1 which ends at 4.0s)
    const result = calculateLeftTrimWithOverlap(clip2, -5.0, allClips);

    // Overlap prevention must clamp startTime to clip1's right edge (4.0s)
    expect(result.startTime).toBe(4.0);

    // The effective delta applied to timeline start is 4.0 - 6.0 = -2.0s
    // The duration expanded by 2.0s (from 4.0s to 6.0s), ending at 10.0s (anchored)
    expect(result.duration).toBe(6.0);

    // CRITICAL: inPoint must be recalculated from the CLAMPED effective delta (-2.0s), NOT the unclamped -5.0s!
    // Original inPoint: 3.0, effectiveDelta: -2.0 -> new inPoint must be 1.0 (not 0 or negative)!
    expect(result.inPoint).toBe(1.0);

    // Anchored outPoint
    expect(result.outPoint).toBe(7.0);

    // Ensure mathematical synchronization: outPoint - inPoint === duration
    expect(result.outPoint - result.inPoint).toBeCloseTo(result.duration, 3);
  });

  it("recalculates inPoint accurately with speed multiplier during clamped trim", () => {
    const fastClip2: TimelineClip = {
      ...clip2,
      speed: 2.0, // 2x speed
      inPoint: 4.0,
      outPoint: 12.0, // 4.0 + 4.0 * 2 = 12.0
    };

    // Try to drag left by -4.0s (blocked by clip1 ending at 4.0s, allowed delta is -2.0s)
    const result = calculateLeftTrimWithOverlap(fastClip2, -4.0, [clip1, fastClip2]);

    expect(result.startTime).toBe(4.0);
    expect(result.duration).toBe(6.0);

    // Effective delta is -2.0s. At 2x speed, inPoint decreases by 2.0 * 2 = 4.0s
    // New inPoint: 4.0 - 4.0 = 0.0
    expect(result.inPoint).toBe(0.0);
    expect(result.outPoint).toBe(12.0);

    // Math check: (outPoint - inPoint) / speed === duration -> (12.0 - 0.0) / 2 === 6.0
    expect((result.outPoint - result.inPoint) / fastClip2.speed!).toBeCloseTo(result.duration, 3);
  });

  it("respects minimum clip duration when shrinking rightward", () => {
    // User tries to drag left handle rightward by +3.8s (would leave duration at 0.2s, below 0.5s min)
    const result = calculateLeftTrimWithOverlap(clip2, 3.8, allClips, MIN_CLIP_DURATION);

    expect(result.duration).toBe(MIN_CLIP_DURATION);
    expect(result.startTime).toBe(10.0 - MIN_CLIP_DURATION); // Anchored at 10.0s
    expect(result.outPoint - result.inPoint).toBeCloseTo(MIN_CLIP_DURATION, 3);
  });
});
