import { describe, it, expect } from "vitest";
import {
  checkCornerCoverageAtProgress,
  checkFullAnimationPathCoverage,
  resolveSafeClipMotion,
  calculateSafeRotation90,
} from "./motion-canvas-safety";

describe("Canvas-Edge Safety & Dynamic Cover Scale Engine (Phase D)", () => {
  const canvas16x9 = { width: 1920, height: 1080 };
  const canvas9x16 = { width: 1080, height: 1920 };

  it("confirms 100% corner coverage for default zoom-in on matching aspect ratio", () => {
    const res = checkCornerCoverageAtProgress({
      transform: { x: 0, y: 0, scale: 1.0, rotation: 0 },
      motion: { type: "zoom-in", amount: 0.15 },
      progress: 0.5,
      assetWidth: 1920,
      assetHeight: 1080,
      canvasWidth: canvas16x9.width,
      canvasHeight: canvas16x9.height,
    });
    expect(res.isCovered).toBe(true);
    expect(res.maxGapPx).toBe(0);

    const res9x16 = checkCornerCoverageAtProgress({
      transform: { x: 0, y: 0, scale: 1.0, rotation: 0 },
      motion: { type: "zoom-in", amount: 0.15 },
      progress: 0.5,
      assetWidth: 1080,
      assetHeight: 1920,
      canvasWidth: canvas9x16.width,
      canvasHeight: canvas9x16.height,
    });
    expect(res9x16.isCovered).toBe(true);
    expect(res9x16.maxGapPx).toBe(0);
  });

  it("detects edge gap when panning if base scale is reduced below 1.0", () => {
    const res = checkCornerCoverageAtProgress({
      transform: { x: 0, y: 0, scale: 0.8, rotation: 0 }, // scaled down!
      motion: { type: "pan-left", amount: 0.2 },
      progress: 1.0,
      assetWidth: 1920,
      assetHeight: 1080,
      canvasWidth: canvas16x9.width,
      canvasHeight: canvas16x9.height,
    });
    expect(res.isCovered).toBe(false);
    expect(res.maxGapPx).toBeGreaterThan(0);
    expect(res.minScaleRequired).toBeGreaterThan(0.8);
  });

  it("checkFullAnimationPathCoverage detects pan gap without sufficient overscan, and resolveSafeClipMotion rescues it", () => {
    const pathCheck = checkFullAnimationPathCoverage({
      transform: { x: 0, y: 0, scale: 1.0, rotation: 0 },
      motion: { type: "pan-right", amount: 0.15 },
      assetWidth: 1920,
      assetHeight: 1080,
      canvasWidth: canvas16x9.width,
      canvasHeight: canvas16x9.height,
    });
    // At scale 1.0, panning by 7.5% shifts past the 3.75% cushion, correctly detecting gap
    expect(pathCheck.isCovered).toBe(false);
    expect(pathCheck.minScaleRequired).toBeGreaterThanOrEqual(1.05);

    // resolveSafeClipMotion recommends the overscan scale to guarantee zero black gaps
    const resolved = resolveSafeClipMotion({
      transform: { x: 0, y: 0, scale: 1.0, rotation: 0 },
      motion: { type: "pan-right", amount: 0.15 },
      assetWidth: 1920,
      assetHeight: 1080,
      canvasWidth: canvas16x9.width,
      canvasHeight: canvas16x9.height,
    });
    expect(resolved.safe).toBe(true);
    expect(resolved.recommendedTransformScale).toBeGreaterThanOrEqual(1.05);
  });

  it("resolveSafeClipMotion suggests overscan scale or safe fallback for extreme transforms", () => {
    // Large translation offset + pan
    const result = resolveSafeClipMotion({
      transform: { x: 0.4, y: 0, scale: 1.0, rotation: 0 },
      motion: { type: "pan-left", amount: 0.3 },
      assetWidth: 1920,
      assetHeight: 1080,
      canvasWidth: canvas16x9.width,
      canvasHeight: canvas16x9.height,
    });

    expect(result.safe).toBe(true);
    // Either overscan scale or safe fallback was applied
    expect(result.appliedMotion).toBeDefined();
  });

  it("calculateSafeRotation90 increases scale when 90deg rotation inverts aspect ratio", () => {
    // 16:9 asset inside 16:9 canvas rotated 90 degrees
    const initialTransform = { x: 0, y: 0, scale: 1.0, rotation: 0 };
    const rotated = calculateSafeRotation90({
      transform: initialTransform,
      assetWidth: 1920,
      assetHeight: 1080,
      canvasWidth: 1920,
      canvasHeight: 1080,
    });

    expect(rotated.rotation).toBe(90);
    expect(rotated.x).toBe(0);
    expect(rotated.y).toBe(0);
    // Rotating 16:9 by 90deg inside 16:9 canvas requires scale = (16/9)^2 ≈ 3.16 to cover corners
    expect(rotated.scale).toBeGreaterThan(1.5);

    // Verify the newly calculated scale has 100% coverage
    const coverageAfter = checkCornerCoverageAtProgress({
      transform: rotated,
      motion: null,
      progress: 0,
      assetWidth: 1920,
      assetHeight: 1080,
      canvasWidth: 1920,
      canvasHeight: 1080,
    });
    expect(coverageAfter.isCovered).toBe(true);
    expect(coverageAfter.maxGapPx).toBe(0);
  });

  it("calculateSafeRotation90 cycles correctly through 0, 90, 180, 270 degrees", () => {
    const t = { x: 0.1, y: -0.05, scale: 1.0, rotation: 270 };
    const rotated = calculateSafeRotation90({
      transform: t,
      assetWidth: 1080,
      assetHeight: 1080, // square asset
      canvasWidth: 1080,
      canvasHeight: 1080,
    });
    expect(rotated.rotation).toBe(0);
    expect(rotated.x).toBe(0.1);
    expect(rotated.y).toBe(-0.05);
  });
});
