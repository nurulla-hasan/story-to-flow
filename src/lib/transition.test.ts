import { describe, it, expect } from "vitest";
import type { TimelineClip, TimelineTransition } from "../types/timeline";
import {
  validateTransitionDuration,
  areClipsAdjacentForTransition,
  getTransitionWindow,
  getTransitionProgress,
  findAdjacentClipPairs,
  applyToAllTransitions,
  TRANSITION_PRESETS,
  MIN_TRANSITION_DURATION,
} from "./transition-helpers";

describe("Visual Transitions Validation & Math", () => {
  const clipA: TimelineClip = {
    id: "clip-a",
    assetId: "a1",
    name: "scene-1.png",
    type: "image",
    trackId: "visual-1",
    startTime: 0,
    duration: 4.0,
    inPoint: 0,
    outPoint: 4.0,
  };

  const clipB: TimelineClip = {
    id: "clip-b",
    assetId: "a2",
    name: "scene-2.png",
    type: "image",
    trackId: "visual-1",
    startTime: 4.0, // directly adjacent to clipA
    duration: 3.0,
    inPoint: 0,
    outPoint: 3.0,
  };

  it("identifies adjacent clips on the same track as eligible for transitions", () => {
    expect(areClipsAdjacentForTransition(clipA, clipB)).toBe(true);
  });

  it("rejects non-adjacent clips with intentional gaps", () => {
    const clipWithGap: TimelineClip = {
      ...clipB,
      startTime: 6.0, // 2s gap after clipA (4s)
    };
    expect(areClipsAdjacentForTransition(clipA, clipWithGap)).toBe(false);
  });

  it("rejects clips on different tracks", () => {
    const clipLayer2: TimelineClip = {
      ...clipB,
      trackId: "visual-2",
    };
    expect(areClipsAdjacentForTransition(clipA, clipLayer2)).toBe(false);
  });

  it("rejects audio clips from visual transitions", () => {
    const audioClip: TimelineClip = {
      ...clipA,
      type: "audio",
      trackId: "audio",
    };
    expect(areClipsAdjacentForTransition(audioClip, clipB)).toBe(false);
  });

  it("clamps transition duration to safe boundaries", () => {
    // Cannot exceed half of either clip (half of 3.0s is 1.5s)
    const valid = validateTransitionDuration(1.8, clipA, clipB);
    expect(valid).toBe(1.5);

    // Enforces minimum 0.2s
    const tooSmall = validateTransitionDuration(0.05, clipA, clipB);
    expect(tooSmall).toBe(MIN_TRANSITION_DURATION);

    // Standard valid duration passes through
    const normal = validateTransitionDuration(0.5, clipA, clipB);
    expect(normal).toBe(0.5);
  });

  it("calculates transition timeline window accurately around cut point", () => {
    const transition: TimelineTransition = {
      id: "t1",
      type: "cross-dissolve",
      duration: 1.0,
      fromClipId: clipA.id,
      toClipId: clipB.id,
      trackId: "visual-1",
    };

    // Cut point is clipB.startTime = 4.0s
    // 1.0s duration -> window is [3.5s, 4.5s]
    const window = getTransitionWindow(transition, clipA, clipB);
    expect(window.cutPoint).toBe(4.0);
    expect(window.startTime).toBe(3.5);
    expect(window.endTime).toBe(4.5);
    expect(window.duration).toBe(1.0);
  });

  it("computes accurate transition progress at playhead timestamps", () => {
    const transition: TimelineTransition = {
      id: "t1",
      type: "cross-dissolve",
      duration: 1.0,
      fromClipId: clipA.id,
      toClipId: clipB.id,
      trackId: "visual-1",
    };

    // Before window (< 3.5s)
    expect(getTransitionProgress(2.0, transition, clipA, clipB)).toBeNull();

    // At window start (3.5s) -> progress 0.0
    expect(getTransitionProgress(3.5, transition, clipA, clipB)).toBe(0);

    // At exact cut point (4.0s) -> progress 0.5 (midpoint)
    expect(getTransitionProgress(4.0, transition, clipA, clipB)).toBe(0.5);

    // At window end (4.5s) -> progress 1.0
    expect(getTransitionProgress(4.5, transition, clipA, clipB)).toBe(1);

    // After window (> 4.5s)
    expect(getTransitionProgress(5.0, transition, clipA, clipB)).toBeNull();
  });

  it("calculates seam cut pixel position consistently at 50%, 100%, and 200% zoom", () => {
    const cutTimestamp = 4.0; // 4.0s
    const getPxPerSec = (zoom: number) => (zoom / 100) * 40;

    // At 50% zoom (20 px/s): 4.0 * 20 = 80px
    expect(cutTimestamp * getPxPerSec(50)).toBe(80);

    // At 100% zoom (40 px/s): 4.0 * 40 = 160px
    expect(cutTimestamp * getPxPerSec(100)).toBe(160);

    // At 200% zoom (80 px/s): 4.0 * 80 = 320px
    expect(cutTimestamp * getPxPerSec(200)).toBe(320);

    // Using translate(-50%, -50%) centers a 20px button on the exact seam at all zoom levels
    const btnSize = 20;
    const centerOffset50 = cutTimestamp * getPxPerSec(50) - btnSize / 2;
    const centerOffset100 = cutTimestamp * getPxPerSec(100) - btnSize / 2;
    const centerOffset200 = cutTimestamp * getPxPerSec(200) - btnSize / 2;

    expect(centerOffset50).toBe(70);
    expect(centerOffset100).toBe(150);
    expect(centerOffset200).toBe(310);
  });

  it("finds all adjacent pairs on a track", () => {
    const clipC: TimelineClip = {
      ...clipA,
      id: "clip-c",
      startTime: 7.0, // adjacent to clipB (ends at 7.0)
    };
    const clips = [clipA, clipB, clipC];

    const pairs = findAdjacentClipPairs(clips);
    expect(pairs.length).toBe(2);
    expect(pairs[0].fromClip.id).toBe("clip-a");
    expect(pairs[0].toClip.id).toBe("clip-b");
    expect(pairs[1].fromClip.id).toBe("clip-b");
    expect(pairs[1].toClip.id).toBe("clip-c");
  });

  it("recognizes legacy 'visual' track clips as adjacent to 'visual-1' clips", () => {
    const legacyClip: TimelineClip = {
      ...clipA,
      id: "legacy-1",
      trackId: "visual", // legacy
      startTime: 0,
      duration: 4.0,
    };
    const newClip: TimelineClip = {
      ...clipB,
      id: "new-1",
      trackId: "visual-1", // new layer 1
      startTime: 4.0,
      duration: 3.0,
    };

    expect(areClipsAdjacentForTransition(legacyClip, newClip)).toBe(true);

    const pairs = findAdjacentClipPairs([legacyClip, newClip]);
    expect(pairs.length).toBe(1);
    expect(pairs[0].fromClip.id).toBe("legacy-1");
    expect(pairs[0].toClip.id).toBe("new-1");
  });

  it("provides valid presets for all 4 initial transition types", () => {
    const types = TRANSITION_PRESETS.map((p) => p.type);
    expect(types).toContain("cross-dissolve");
    expect(types).toContain("fade-black");
    expect(types).toContain("slide-left");
    expect(types).toContain("slide-right");
  });
});

describe("Apply to All Transitions Engine", () => {
  const c1: TimelineClip = { id: "c1", assetId: "a1", name: "1.png", type: "image", trackId: "visual-1", startTime: 0, duration: 4.0, inPoint: 0, outPoint: 4.0 };
  const c2: TimelineClip = { id: "c2", assetId: "a2", name: "2.png", type: "image", trackId: "visual-1", startTime: 4.0, duration: 4.0, inPoint: 0, outPoint: 4.0 };
  const c3: TimelineClip = { id: "c3", assetId: "a3", name: "3.png", type: "image", trackId: "visual-1", startTime: 8.0, duration: 1.0, inPoint: 0, outPoint: 1.0 }; // Short clip! (1.0s -> max transition 0.5s)
  const allClips = [c1, c2, c3];

  const t1: TimelineTransition = { id: "t1", type: "cross-dissolve", duration: 0.5, fromClipId: "c1", toClipId: "c2", trackId: "visual-1" };
  const t2: TimelineTransition = { id: "t2", type: "fade-black", duration: 0.3, fromClipId: "c2", toClipId: "c3", trackId: "visual-1" };
  const initialTransitions = [t1, t2];

  it("applies source transition type and duration to all existing transitions", () => {
    const source: TimelineTransition = { ...t1, type: "slide-left", duration: 0.4 };
    const res = applyToAllTransitions(source, initialTransitions, allClips);

    expect(res.count).toBe(2);
    expect(res.clampedCount).toBe(0);
    expect(res.updatedTransitions[0].type).toBe("slide-left");
    expect(res.updatedTransitions[0].duration).toBe(0.4);
    expect(res.updatedTransitions[1].type).toBe("slide-left");
    expect(res.updatedTransitions[1].duration).toBe(0.4);
    expect(res.updatedTransitions[0].id).toBe("t1"); // Preserves ID!
    expect(res.updatedTransitions[1].id).toBe("t2"); // Preserves ID!
  });

  it("clamps duration for transitions connecting shorter clips and reports clamped count", () => {
    // Attempt to apply 1.2s transition:
    // For t2 (c2: 4.0s, c3: 1.0s), max allowed duration is 0.5s (half of c3)
    const source: TimelineTransition = { ...t1, type: "fade-black", duration: 1.2 };
    const res = applyToAllTransitions(source, initialTransitions, allClips);

    expect(res.count).toBe(2);
    expect(res.clampedCount).toBe(1); // t2 was clamped
    expect(res.updatedTransitions[0].duration).toBe(1.2);
    expect(res.updatedTransitions[1].duration).toBe(0.5); // Clamped at 0.5s!
    expect(res.message).toContain("1 were clamped");
  });

  it("handles empty transition list gracefully", () => {
    const source: TimelineTransition = t1;
    const res = applyToAllTransitions(source, [], allClips);
    expect(res.count).toBe(0);
    expect(res.updatedTransitions.length).toBe(0);
  });
});
