import { describe, it, expect } from "vitest";
import {
  sanitizeClipTransform,
  calculateTransformBounds,
  calculateMoveFromPointer,
  calculateResizeFromHandle,
  calculateCanvasDrawParams,
  DEFAULT_CLIP_TRANSFORM,
  MIN_TRANSFORM_SCALE,
  MAX_TRANSFORM_SCALE,
  type ClipTransform,
} from "./clip-transform";
import type { TimelineClip } from "../types/timeline";

describe("Clip Transform Core Logic & Gizmo Calculations", () => {
  it("defaults to full-canvas cover transform for legacy clips without transform data", () => {
    const sanitized = sanitizeClipTransform(undefined);
    expect(sanitized.x).toBe(0);
    expect(sanitized.y).toBe(0);
    expect(sanitized.scale).toBe(1.0);
    expect(sanitized.rotation).toBe(0);

    const bounds = calculateTransformBounds(undefined, 360, 640);
    expect(bounds.left).toBe(0);
    expect(bounds.top).toBe(0);
    expect(bounds.width).toBe(360);
    expect(bounds.height).toBe(640);
    expect(bounds.centerX).toBe(180);
    expect(bounds.centerY).toBe(320);
  });

  it("sanitizes invalid, NaN, infinite, and out-of-bounds scale/position values", () => {
    const invalid = {
      x: NaN,
      y: Infinity,
      scale: -5,
      rotation: NaN,
    };
    const sanitized = sanitizeClipTransform(invalid);
    expect(sanitized.x).toBe(0);
    expect(sanitized.y).toBe(0);
    expect(sanitized.scale).toBe(MIN_TRANSFORM_SCALE);
    expect(sanitized.rotation).toBe(0);

    const overflow = {
      x: 999,
      y: -999,
      scale: 100,
    };
    const clamped = sanitizeClipTransform(overflow);
    expect(clamped.x).toBe(3.0);
    expect(clamped.y).toBe(-3.0);
    expect(clamped.scale).toBe(MAX_TRANSFORM_SCALE);
  });

  it("calculates exact pixel bounds for positioned and scaled overlay (PiP)", () => {
    // 50% scale overlay shifted right by 20% and up by 20% on a 360x640 preview canvas
    const transform: ClipTransform = {
      x: 0.2,
      y: -0.2,
      scale: 0.5,
      rotation: 0,
    };
    const bounds = calculateTransformBounds(transform, 360, 640);
    expect(bounds.width).toBe(180); // 360 * 0.5
    expect(bounds.height).toBe(320); // 640 * 0.5
    expect(bounds.centerX).toBe(252);
    expect(bounds.centerY).toBe(192);
    expect(bounds.left).toBe(162); // 252 - 90
    expect(bounds.top).toBe(32); // 192 - 160
  });

  it("calculates continuous position dragging from mouse pointer delta", () => {
    const initialTransform: ClipTransform = { x: 0, y: 0, scale: 1.0 };
    // Drag mouse 72px right and 128px down on 360x640 container
    const moved = calculateMoveFromPointer({
      deltaPxX: 72,
      deltaPxY: 128,
      initialTransform,
      containerWidth: 360,
      containerHeight: 640,
    });
    // 72 / 360 = 0.2 (20% right), 128 / 640 = 0.2 (20% down)
    expect(moved.x).toBe(0.2);
    expect(moved.y).toBe(0.2);
    expect(moved.scale).toBe(1.0);
  });

  it("calculates corner resizing while preserving aspect ratio around the opposing anchor", () => {
    const initialTransform: ClipTransform = { x: 0, y: 0, scale: 1.0 };
    const containerW = 360;
    const containerH = 640;
    const initialBounds = calculateTransformBounds(initialTransform, containerW, containerH);

    // Dragging Bottom-Right handle ("se") inwards so width shrinks from 360 to 180 (scale 0.5)
    // Anchor is Top-Left (0, 0)
    const resized = calculateResizeFromHandle({
      handle: "se",
      currentPointer: { x: 180, y: 320 },
      initialBounds,
      containerWidth: containerW,
      containerHeight: containerH,
    });

    expect(resized.scale).toBe(0.5);
    // New width = 180, height = 320.
    // Center is (90, 160). Normalized: (90 - 180) / 360 = -0.25, (160 - 320) / 640 = -0.25
    expect(resized.x).toBe(-0.25);
    expect(resized.y).toBe(-0.25);
  });

  it("resizes from top-left handle ('nw') keeping bottom-right corner anchored", () => {
    const initialTransform: ClipTransform = { x: 0, y: 0, scale: 1.0 };
    const containerW = 360;
    const containerH = 640;
    const initialBounds = calculateTransformBounds(initialTransform, containerW, containerH);

    // Anchor is Bottom-Right (360, 640). Drag pointer to (180, 320)
    const resized = calculateResizeFromHandle({
      handle: "nw",
      currentPointer: { x: 180, y: 320 },
      initialBounds,
      containerWidth: containerW,
      containerHeight: containerH,
    });

    expect(resized.scale).toBe(0.5);
    // Anchor at (360, 640), size is 180x320 => center is (270, 480)
    // Normalized: (270 - 180)/360 = 0.25, (480 - 320)/640 = 0.25
    expect(resized.x).toBe(0.25);
    expect(resized.y).toBe(0.25);
  });

  it("matches MP4 export 2D canvas draw parameters with preview transform", () => {
    // 720x1280 export canvas with a 50% scale overlay shifted right by 20% and down by 10%
    const transform: ClipTransform = {
      x: 0.2,
      y: 0.1,
      scale: 0.5,
    };
    const params = calculateCanvasDrawParams({
      imgWidth: 1080,
      imgHeight: 1920,
      canvasWidth: 720,
      canvasHeight: 1280,
      transform,
    });

    // baseScale = Math.max(720/1080, 1280/1920) = 0.6667
    // dw = 1080 * 0.6667 * 0.5 = 360
    // dh = 1920 * 0.6667 * 0.5 = 640
    expect(params.dw).toBe(360);
    expect(params.dh).toBe(640);
    // centerX = 720 * (0.5 + 0.2) = 504
    // centerY = 1280 * (0.5 + 0.1) = 768
    // dx = 504 - 180 = 324
    // dy = 768 - 320 = 448
    expect(params.dx).toBe(324);
    expect(params.dy).toBe(448);
  });

  it("preserves default untransformed draw parameters in export engine", () => {
    const params = calculateCanvasDrawParams({
      imgWidth: 1080,
      imgHeight: 1920,
      canvasWidth: 720,
      canvasHeight: 1280,
      transform: undefined,
    });

    expect(params.dw).toBe(720);
    expect(params.dh).toBe(1280);
    expect(params.dx).toBe(0);
    expect(params.dy).toBe(0);
  });

  it("resets clip transform safely to default full-cover state", () => {
    const clip: TimelineClip = {
      id: "clip_1",
      assetId: "asset_1",
      name: "Overlay Scene",
      type: "image",
      trackId: "visual-2",
      startTime: 0,
      duration: 5.0,
      inPoint: 0,
      outPoint: 5.0,
      transform: { x: 0.3, y: -0.4, scale: 0.4 },
    };

    // Resetting transform sets it to DEFAULT_CLIP_TRANSFORM
    const resetClip: TimelineClip = {
      ...clip,
      transform: { ...DEFAULT_CLIP_TRANSFORM },
    };

    expect(resetClip.transform?.x).toBe(0);
    expect(resetClip.transform?.y).toBe(0);
    expect(resetClip.transform?.scale).toBe(1.0);
    expect(resetClip.transform?.rotation).toBe(0);
    expect(resetClip.startTime).toBe(0);
    expect(resetClip.duration).toBe(5.0); // Timeline timing strictly preserved!
  });

  it("calculates canvas draw parameters including centerX, centerY, and rotation for export", () => {
    const transform: ClipTransform = {
      x: 0.1,
      y: -0.15,
      scale: 0.75,
      rotation: 45,
    };
    const params = calculateCanvasDrawParams({
      imgWidth: 1080,
      imgHeight: 1920,
      canvasWidth: 720,
      canvasHeight: 1280,
      transform,
      xOffset: 50,
    });

    expect(params.rotation).toBe(45);
    // centerX = 720 * (0.5 + 0.1) + 50 = 720 * 0.6 + 50 = 432 + 50 = 482
    expect(params.centerX).toBe(482);
    // centerY = 1280 * (0.5 - 0.15) = 1280 * 0.35 = 448
    expect(params.centerY).toBe(448);
  });

  it("preserves rotation during corner resize gestures", () => {
    const initialTransform: ClipTransform = {
      x: 0,
      y: 0,
      scale: 1.0,
      rotation: 90,
    };
    const containerW = 360;
    const containerH = 640;
    const initialBounds = calculateTransformBounds(initialTransform, containerW, containerH);

    const resized = calculateResizeFromHandle({
      handle: "se",
      currentPointer: { x: 180, y: 320 },
      initialBounds,
      containerWidth: containerW,
      containerHeight: containerH,
      initialTransform,
    });

    expect(resized.rotation).toBe(90);
    expect(resized.scale).toBe(0.5);
  });
});
