import { describe, it, expect } from "vitest";
import type { TimelineClip } from "@/types/timeline";
import {
  validateFadeDuration,
  calculateAudioGain,
} from "./audio-fade-helpers";
import {
  hasVisualOverlap,
  clampMoveToPreventOverlap,
  clampLeftTrimToPreventOverlap,
  clampRightTrimToPreventOverlap,
  findNextNonOverlappingStartTime,
  findTrackEndTime,
} from "./timeline-overlap";
import {
  getPixelsPerSecond,
  generateAdaptiveRulerTicks,
  MIN_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
} from "./ruler-scale";

describe("Audio Fade-In & Fade-Out Envelope Helpers", () => {
  it("preserves legacy zero fade behavior by default", () => {
    // Missing/zero fades -> volume remains unchanged across entire clip
    expect(calculateAudioGain(0, 10.0, 0.8, 0, 0)).toBe(0.8);
    expect(calculateAudioGain(5.0, 10.0, 0.8, 0, 0)).toBe(0.8);
    expect(calculateAudioGain(10.0, 10.0, 0.8, 0, 0)).toBe(0.8);
  });

  it("ramps up from silence to full configured volume during fade-in", () => {
    const duration = 10.0;
    const baseVolume = 0.8;
    const fadeIn = 2.0;

    // Time 0 -> silence (0)
    expect(calculateAudioGain(0, duration, baseVolume, fadeIn, 0)).toBe(0);

    // Time 1.0s (midpoint of 2.0s fade) -> half volume (0.4)
    expect(calculateAudioGain(1.0, duration, baseVolume, fadeIn, 0)).toBe(0.4);

    // Time 2.0s (end of fade) -> full volume (0.8)
    expect(calculateAudioGain(2.0, duration, baseVolume, fadeIn, 0)).toBe(0.8);

    // Time 5.0s (after fade) -> full volume (0.8)
    expect(calculateAudioGain(5.0, duration, baseVolume, fadeIn, 0)).toBe(0.8);
  });

  it("ramps down from full configured volume to silence during fade-out", () => {
    const duration = 10.0;
    const baseVolume = 0.8;
    const fadeOut = 2.0; // starts at 8.0s, ends at 10.0s

    // Time 7.0s (before fade out) -> full volume (0.8)
    expect(calculateAudioGain(7.0, duration, baseVolume, 0, fadeOut)).toBe(0.8);

    // Time 8.0s (fade out starts) -> full volume (0.8)
    expect(calculateAudioGain(8.0, duration, baseVolume, 0, fadeOut)).toBe(0.8);

    // Time 9.0s (midpoint of fade out) -> half volume (0.4)
    expect(calculateAudioGain(9.0, duration, baseVolume, 0, fadeOut)).toBe(0.4);

    // Time 10.0s (end of clip) -> silence (0)
    expect(calculateAudioGain(10.0, duration, baseVolume, 0, fadeOut)).toBe(0);
  });

  it("validates and clamps fade duration to prevent exceeding available clip duration", () => {
    // 4.0s clip: requested 5.0s fade should be clamped to 4.0s
    expect(validateFadeDuration(5.0, 4.0, 0)).toBe(4.0);

    // When other fade takes 2.5s, max available for second fade is 1.5s
    expect(validateFadeDuration(3.0, 4.0, 2.5)).toBe(1.5);

    // Negative fade clamps to 0
    expect(validateFadeDuration(-1.0, 4.0, 0)).toBe(0);
  });
});

describe("Visual Track Same-Layer Overlap Prevention", () => {
  const clip1: TimelineClip = {
    id: "v1",
    assetId: "a1",
    name: "scene-1.png",
    type: "image",
    trackId: "visual-1",
    startTime: 2.0,
    duration: 4.0, // ends at 6.0
    inPoint: 0,
    outPoint: 4.0,
  };

  const clip2: TimelineClip = {
    id: "v2",
    assetId: "a2",
    name: "scene-2.png",
    type: "image",
    trackId: "visual-1",
    startTime: 8.0,
    duration: 4.0, // ends at 12.0
    inPoint: 0,
    outPoint: 4.0,
  };

  const allClips = [clip1, clip2];

  it("detects overlap when moving into an occupied interval on the same visual track", () => {
    // Attempting to place a 3s clip at 3.0s on visual-1 (collides with clip1 which is 2.0-6.0s)
    const candidate = { id: "new-c", startTime: 3.0, duration: 3.0, trackId: "visual-1" as const };
    expect(hasVisualOverlap(candidate, allClips)).toBe(true);
  });

  it("allows exact adjacency between two clips on the same visual track", () => {
    // Placing right at clip1.end (6.0s) with 2.0s duration (ends at 8.0s, exactly touching clip2)
    const candidate = { id: "new-c", startTime: 6.0, duration: 2.0, trackId: "visual-1" as const };
    expect(hasVisualOverlap(candidate, allClips)).toBe(false);
  });

  it("allows overlapping clips on different visual tracks (multi-layer PiP/overlay)", () => {
    // Placing at 3.0s on visual-2 while visual-1 has a clip at 2.0-6.0s
    const candidate = { id: "new-c", startTime: 3.0, duration: 3.0, trackId: "visual-2" as const };
    expect(hasVisualOverlap(candidate, allClips)).toBe(false);
  });

  it("clamps clip movement before colliding with an existing clip on the same lane", () => {
    // Moving clip2 leftward from 8.0s: if user drags to 4.5s, it should stop at clip1.end = 6.0s
    const clamped = clampMoveToPreventOverlap(clip2, 4.5, allClips);
    expect(clamped).toBe(6.0);
  });

  it("clamps left-edge trimming so it cannot expand into the preceding clip on the lane", () => {
    // clip2 is at 8.0-12.0s. Preceding clip1 ends at 6.0s. Max left expansion is 6.0s.
    // If left trim requests startTime = 4.0s (which would collide with clip1):
    const res = clampLeftTrimToPreventOverlap(clip2, 4.0, 8.0, allClips);
    expect(res.startTime).toBe(6.0); // clamped at 6.0s!
    expect(res.duration).toBe(6.0); // 12.0 - 6.0 = 6.0s
  });

  it("clamps right-edge trimming so it cannot expand into the succeeding clip on the lane", () => {
    // clip1 is at 2.0-6.0s. Succeeding clip2 starts at 8.0s.
    // Max duration before colliding with clip2 is 8.0 - 2.0 = 6.0s.
    // If right trim requests duration = 9.0s:
    const clampedDuration = clampRightTrimToPreventOverlap(clip1, 9.0, allClips);
    expect(clampedDuration).toBe(6.0); // clamped at 6.0s!
  });

  it("finds the end of the track rather than an earlier gap for append actions", () => {
    expect(findTrackEndTime("visual-1", allClips)).toBe(12);
    expect(findTrackEndTime("audio", allClips)).toBe(0);
  });

  it("finds next valid non-overlapping placement for added or duplicated clips", () => {
    // Attempting to place a 3s clip at 2.0s (occupied by clip1):
    // Should place in the gap at 6.0s or at end of lane
    const nextStart = findNextNonOverlappingStartTime("visual-1", 1.5, allClips, 6.0);
    expect(nextStart).toBe(6.0); // fits in the 6.0-8.0s gap!

    // If clip is 3s (larger than the 2s gap between 6.0 and 8.0):
    const nextStartLarge = findNextNonOverlappingStartTime("visual-1", 3.0, allClips, 2.0);
    expect(nextStartLarge).toBe(12.0); // placed at end of lane (after clip2)!
  });
});

describe("Expanded Zoom Range & Adaptive Ruler", () => {
  it("supports wide zoom range from 10% to 500%", () => {
    expect(MIN_TIMELINE_ZOOM).toBe(10);
    expect(MAX_TIMELINE_ZOOM).toBe(500);

    expect(getPixelsPerSecond(10)).toBe(4); // 4 px/s for long timeline overview
    expect(getPixelsPerSecond(100)).toBe(40); // 40 px/s standard
    expect(getPixelsPerSecond(500)).toBe(200); // 200 px/s deep frame inspection
  });

  it("generates frame-level notation at deep zoom (>=400%)", () => {
    // At 400% zoom, tick marks should include frame numbers (e.g. 05f, 10f)
    const ticks = generateAdaptiveRulerTicks(400, 2.0, 30);
    const frameTicks = ticks.filter((t) => t.isFrame && t.label.endsWith("f"));
    expect(frameTicks.length).toBeGreaterThan(0);
    expect(frameTicks.some((t) => t.label === "05f" || t.label === "10f")).toBe(true);
  });

  it("generates standard seconds marks at medium zoom (100%)", () => {
    const ticks = generateAdaptiveRulerTicks(100, 10.0, 30);
    expect(ticks.some((t) => t.label === "00:02")).toBe(true);
    expect(ticks.some((t) => t.label === "00:04")).toBe(true);
    expect(ticks.every((t) => !t.isFrame)).toBe(true);
  });

  it("generates wide interval marks at low zoom (20%)", () => {
    const ticks = generateAdaptiveRulerTicks(20, 120.0, 30);
    // At 20% zoom over 120s, steps should be at least 30s to prevent clutter
    expect(ticks.length).toBeLessThan(15);
  });
});
