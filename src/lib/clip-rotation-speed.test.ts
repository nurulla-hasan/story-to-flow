import { describe, it, expect } from "vitest";
import type { TimelineClip } from "@/types/timeline";
import {
  calculateCanvasDrawParams,
  sanitizeClipTransform,
  calculateResizeFromHandle,
  calculateTransformBounds,
} from "./clip-transform";
import { calculateLeftTrim, calculateRightTrim } from "./timeline-trim";

describe("Clip Rotation and Playback Speed Consistency", () => {
  const baseClip: TimelineClip = {
    id: "clip-test-1",
    assetId: "asset-test-1",
    name: "scene.mp4",
    type: "video",
    trackId: "visual-1",
    startTime: 2.0,
    duration: 4.0,
    inPoint: 1.0,
    outPoint: 5.0,
    sourceDuration: 10.0,
    speed: 1.0,
    transform: { x: 0, y: 0, scale: 1.0, rotation: 0 },
  };

  describe("Rotation in Export Canvas Draw Parameters", () => {
    it("returns rotation and center coordinates for 2D canvas transformation", () => {
      const transform = { x: 0.25, y: -0.25, scale: 0.8, rotation: 45 };
      const params = calculateCanvasDrawParams({
        imgWidth: 1080,
        imgHeight: 1920,
        canvasWidth: 720,
        canvasHeight: 1280,
        transform,
      });

      expect(params.rotation).toBe(45);
      expect(params.centerX).toBe(720 * (0.5 + 0.25)); // 540
      expect(params.centerY).toBe(1280 * (0.5 - 0.25)); // 320
      expect(params.dw).toBeGreaterThan(0);
      expect(params.dh).toBeGreaterThan(0);
    });

    it("sanitizes rotation angle within modulo 360 degrees", () => {
      const sanitized = sanitizeClipTransform({ rotation: 450 });
      expect(sanitized.rotation).toBe(90);

      const negative = sanitizeClipTransform({ rotation: -90 });
      expect(negative.rotation).toBe(-90);
    });

    it("preserves rotation across handle resize gestures", () => {
      const initialTransform = { x: 0, y: 0, scale: 1.0, rotation: 180 };
      const bounds = calculateTransformBounds(initialTransform, 360, 640);
      const resized = calculateResizeFromHandle({
        handle: "se",
        currentPointer: { x: 180, y: 320 },
        initialBounds: bounds,
        containerWidth: 360,
        containerHeight: 640,
        initialTransform,
      });

      expect(resized.rotation).toBe(180);
      expect(resized.scale).toBe(0.5);
    });
  });

  describe("Speed Multiplier in Media Timing & Trimming", () => {
    it("calculates video seek time advancing proportional to playback speed", () => {
      const calculateVideoTime = (currentTime: number, clip: TimelineClip) => {
        const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
        return (currentTime - clip.startTime) * speed + clip.inPoint;
      };

      // At normal speed (1.0x): 1s into clip advances source by 1s
      expect(calculateVideoTime(3.0, baseClip)).toBe(2.0); // (3 - 2) * 1 + 1 = 2

      // At 2.0x speed: 1s into clip advances source by 2s
      const fastClip = { ...baseClip, speed: 2.0 };
      expect(calculateVideoTime(3.0, fastClip)).toBe(3.0); // (3 - 2) * 2 + 1 = 3

      // At 0.5x speed: 1s into clip advances source by 0.5s
      const slowClip = { ...baseClip, speed: 0.5 };
      expect(calculateVideoTime(3.0, slowClip)).toBe(1.5); // (3 - 2) * 0.5 + 1 = 1.5
    });

    it("clamps maximum duration on timeline based on speed and remaining source", () => {
      // sourceDuration: 10, inPoint: 2 -> remaining source is 8s
      // At 2x speed: remaining source 8s corresponds to max 4s on timeline!
      const clip: TimelineClip = {
        ...baseClip,
        inPoint: 2.0,
        sourceDuration: 10.0,
        speed: 2.0,
      };

      const trimResult = calculateRightTrim(clip, 10.0);
      expect(trimResult.duration).toBe(4.0); // 8s source / 2x speed = 4s max
      expect(trimResult.outPoint).toBe(10.0); // inPoint (2) + duration (4) * speed (2) = 10
    });

    it("allows longer timeline duration at slow motion (0.5x speed)", () => {
      // sourceDuration: 10, inPoint: 2 -> remaining source is 8s
      // At 0.5x speed: remaining source 8s corresponds to max 16s on timeline!
      const clip: TimelineClip = {
        ...baseClip,
        inPoint: 2.0,
        sourceDuration: 10.0,
        speed: 0.5,
      };

      const trimResult = calculateRightTrim(clip, 10.0);
      expect(trimResult.duration).toBe(14.0); // 4.0 original + 10.0 delta = 14.0 <= 16.0
      expect(trimResult.outPoint).toBe(9.0); // inPoint (2) + duration (14) * 0.5 = 9.0
    });

    it("scales inPoint and limits left trim by source bounds divided by speed", () => {
      const clip: TimelineClip = {
        ...baseClip,
        inPoint: 4.0,
        sourceDuration: 10.0,
        speed: 2.0,
      };

      // Moving left handle leftward (negative delta) by 1s on timeline expands inPoint by 2s in source
      const result = calculateLeftTrim(clip, -1.0);
      expect(result.inPoint).toBe(2.0); // 4.0 - 1.0 * 2.0
      expect(result.duration).toBe(5.0); // 4.0 + 1.0
      expect(result.startTime).toBe(1.0); // 2.0 - 1.0
    });
  });

  describe("Undo and Redo Semantics for Speed and Rotation", () => {
    it("preserves exact speed and rotation values across simulated history snapshots", () => {
      interface HistoryItem {
        clips: TimelineClip[];
      }
      const undoStack: HistoryItem[] = [];
      const redoStack: HistoryItem[] = [];

      let currentClips: TimelineClip[] = [
        {
          ...baseClip,
          speed: 1.5,
          transform: { x: 0.2, y: -0.1, scale: 0.9, rotation: 45 },
        },
      ];

      // Mutation 1: Change speed from 1.5 to 2.0
      undoStack.push({ clips: JSON.parse(JSON.stringify(currentClips)) });
      currentClips = currentClips.map((c) => ({ ...c, speed: 2.0 }));

      expect(currentClips[0].speed).toBe(2.0);
      expect(currentClips[0].transform?.rotation).toBe(45);

      // Undo Mutation 1: Should revert to 1.5x
      const prev1 = undoStack.pop()!;
      redoStack.push({ clips: JSON.parse(JSON.stringify(currentClips)) });
      currentClips = prev1.clips;

      expect(currentClips[0].speed).toBe(1.5);
      expect(currentClips[0].transform?.rotation).toBe(45);
      expect(currentClips[0].transform?.scale).toBe(0.9);

      // Redo Mutation 1: Should reapply 2.0x
      const next1 = redoStack.pop()!;
      undoStack.push({ clips: JSON.parse(JSON.stringify(currentClips)) });
      currentClips = next1.clips;

      expect(currentClips[0].speed).toBe(2.0);
      expect(currentClips[0].transform?.rotation).toBe(45);

      // Mutation 2: Change rotation from 45 to 135
      undoStack.push({ clips: JSON.parse(JSON.stringify(currentClips)) });
      currentClips = currentClips.map((c) => ({
        ...c,
        transform: { ...c.transform!, rotation: 135 },
      }));

      expect(currentClips[0].speed).toBe(2.0);
      expect(currentClips[0].transform?.rotation).toBe(135);

      // Undo Mutation 2: Should revert to 45 degrees, speed remains 2.0x
      const prev2 = undoStack.pop()!;
      redoStack.push({ clips: JSON.parse(JSON.stringify(currentClips)) });
      currentClips = prev2.clips;

      expect(currentClips[0].speed).toBe(2.0);
      expect(currentClips[0].transform?.rotation).toBe(45);

      // Redo Mutation 2: Should reapply 135 degrees
      const next2 = redoStack.pop()!;
      undoStack.push({ clips: JSON.parse(JSON.stringify(currentClips)) });
      currentClips = next2.clips;

      expect(currentClips[0].speed).toBe(2.0);
      expect(currentClips[0].transform?.rotation).toBe(135);
    });
  });
});
