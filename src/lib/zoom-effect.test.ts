import { describe, it, expect } from "vitest";
import {
  DEFAULT_ZOOM_EFFECT_AMOUNT,
  MAX_ZOOM_EFFECT_AMOUNT,
  MIN_ZOOM_EFFECT_AMOUNT,
  getClipZoomProgress,
  getClipMotionAtTime,
  getMotionParamsAtProgress,
  getZoomEffectScaleAtProgress,
  sanitizeZoomEffect,
} from "./zoom-effect";
import { calculateCanvasDrawParams } from "./clip-transform";

describe("Scene Zoom & Motion (Ken Burns) effects", () => {
  it("disables the effect when absent or given an unknown type", () => {
    expect(sanitizeZoomEffect(undefined)).toBeUndefined();
    expect(sanitizeZoomEffect(null)).toBeUndefined();
    expect(sanitizeZoomEffect({ type: "spin" as never })).toBeUndefined();
  });

  it("recognizes all 6 valid motion presets", () => {
    const types = [
      "zoom-in",
      "zoom-out",
      "pan-left",
      "pan-right",
      "pan-up",
      "pan-down",
    ] as const;

    for (const type of types) {
      expect(sanitizeZoomEffect({ type })?.type).toBe(type);
    }
  });

  it("defaults the strength and clamps out-of-range amounts", () => {
    expect(sanitizeZoomEffect({ type: "zoom-in" })).toEqual({
      type: "zoom-in",
      amount: DEFAULT_ZOOM_EFFECT_AMOUNT,
    });

    expect(sanitizeZoomEffect({ type: "zoom-in", amount: 999 })?.amount).toBe(
      MAX_ZOOM_EFFECT_AMOUNT
    );
    expect(sanitizeZoomEffect({ type: "zoom-out", amount: -5 })?.amount).toBe(
      MIN_ZOOM_EFFECT_AMOUNT
    );
    expect(
      sanitizeZoomEffect({ type: "zoom-out", amount: Number.NaN })?.amount
    ).toBe(DEFAULT_ZOOM_EFFECT_AMOUNT);
  });

  it("zooms in from the base scale up to base + amount", () => {
    const effect = { type: "zoom-in" as const, amount: 0.2 };
    expect(getZoomEffectScaleAtProgress(effect, 0)).toBeCloseTo(1.0, 5);
    expect(getZoomEffectScaleAtProgress(effect, 0.5)).toBeCloseTo(1.1, 5);
    expect(getZoomEffectScaleAtProgress(effect, 1)).toBeCloseTo(1.2, 5);
  });

  it("zooms out from base + amount back down to the base scale", () => {
    const effect = { type: "zoom-out" as const, amount: 0.2 };
    expect(getZoomEffectScaleAtProgress(effect, 0)).toBeCloseTo(1.2, 5);
    expect(getZoomEffectScaleAtProgress(effect, 0.5)).toBeCloseTo(1.1, 5);
    expect(getZoomEffectScaleAtProgress(effect, 1)).toBeCloseTo(1.0, 5);
  });

  it("pans horizontally from right to left for pan-left", () => {
    const effect = { type: "pan-left" as const, amount: 0.2 };
    const start = getMotionParamsAtProgress(effect, 0);
    const mid = getMotionParamsAtProgress(effect, 0.5);
    const end = getMotionParamsAtProgress(effect, 1);

    expect(start.offsetX).toBeGreaterThan(0);
    expect(mid.offsetX).toBeCloseTo(0, 5);
    expect(end.offsetX).toBeLessThan(0);
    expect(start.scale).toBeCloseTo(1.1, 5);
  });

  it("pans horizontally from left to right for pan-right", () => {
    const effect = { type: "pan-right" as const, amount: 0.2 };
    const start = getMotionParamsAtProgress(effect, 0);
    const mid = getMotionParamsAtProgress(effect, 0.5);
    const end = getMotionParamsAtProgress(effect, 1);

    expect(start.offsetX).toBeLessThan(0);
    expect(mid.offsetX).toBeCloseTo(0, 5);
    expect(end.offsetX).toBeGreaterThan(0);
  });

  it("pans vertically from bottom to top for pan-up", () => {
    const effect = { type: "pan-up" as const, amount: 0.2 };
    const start = getMotionParamsAtProgress(effect, 0);
    const mid = getMotionParamsAtProgress(effect, 0.5);
    const end = getMotionParamsAtProgress(effect, 1);

    expect(start.offsetY).toBeGreaterThan(0);
    expect(mid.offsetY).toBeCloseTo(0, 5);
    expect(end.offsetY).toBeLessThan(0);
  });

  it("pans vertically from top to bottom for pan-down", () => {
    const effect = { type: "pan-down" as const, amount: 0.2 };
    const start = getMotionParamsAtProgress(effect, 0);
    const mid = getMotionParamsAtProgress(effect, 0.5);
    const end = getMotionParamsAtProgress(effect, 1);

    expect(start.offsetY).toBeLessThan(0);
    expect(mid.offsetY).toBeCloseTo(0, 5);
    expect(end.offsetY).toBeGreaterThan(0);
  });

  it("returns a neutral multiplier and zero offsets for disabled effects", () => {
    const neutral = getMotionParamsAtProgress(undefined, 0.5);
    expect(neutral.scale).toBe(1);
    expect(neutral.offsetX).toBe(0);
    expect(neutral.offsetY).toBe(0);
  });

  it("maps timeline time to clip-local progress", () => {
    const clip = { startTime: 2, duration: 4 };
    expect(getClipZoomProgress(clip, 2)).toBe(0);
    expect(getClipZoomProgress(clip, 4)).toBeCloseTo(0.5, 5);
    expect(getClipZoomProgress(clip, 6)).toBe(1);
    expect(getClipZoomProgress(clip, 0)).toBe(0); // before clip start
    expect(getClipZoomProgress(clip, 99)).toBe(1); // after clip end
    expect(getClipZoomProgress({ startTime: 0, duration: 0 }, 5)).toBe(0);
  });

  it("composes animated motion with clip at specific timeline time", () => {
    const clip = {
      startTime: 0,
      duration: 10,
      zoomEffect: { type: "pan-left" as const, amount: 0.2 },
    };
    const at0 = getClipMotionAtTime(clip, 0);
    const at5 = getClipMotionAtTime(clip, 5);
    const at10 = getClipMotionAtTime(clip, 10);

    expect(at0.offsetX).toBeCloseTo(0.1, 5);
    expect(at5.offsetX).toBeCloseTo(0, 5);
    expect(at10.offsetX).toBeCloseTo(-0.1, 5);
  });

  it("keeps preview and export scaling and panning in parity at every keyframe", () => {
    const imgWidth = 1080;
    const imgHeight = 1920;
    const canvasWidth = 720;
    const canvasHeight = 1280;
    const baseTransformScale = 1.0;
    const coverScale = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);

    const effect = { type: "pan-right" as const, amount: 0.2 };

    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const motion = getMotionParamsAtProgress(effect, progress);
      const params = calculateCanvasDrawParams({
        imgWidth,
        imgHeight,
        canvasWidth,
        canvasHeight,
        transform: { x: 0, y: 0, scale: baseTransformScale, rotation: 0 },
        scaleMultiplier: motion.scale,
        panX: motion.offsetX,
        panY: motion.offsetY,
      });

      // Preview: CSS translation = (base.x + motion.offsetX) * 100%
      // Export: canvas center = canvasWidth * (0.5 + base.x + motion.offsetX)
      const expectedCenterX = canvasWidth * (0.5 + motion.offsetX);
      expect(params.centerX).toBeCloseTo(expectedCenterX, 1);
      expect(params.dw).toBeCloseTo(imgWidth * coverScale * baseTransformScale * motion.scale, 1);
    }
  });

  it("applies motion effect to all target image clips without touching audio", () => {
    const img1: { type: string; trackId: string; zoomEffect?: { type: string; amount: number } } = {
      type: "image",
      trackId: "visual-1",
    };
    const img2: { type: string; trackId: string; zoomEffect?: { type: string; amount: number } } = {
      type: "image",
      trackId: "visual-2",
    };
    const audio: { type: string; trackId: string; zoomEffect?: { type: string; amount: number } } = {
      type: "audio",
      trackId: "audio",
    };

    const targetEffect = { type: "pan-up" as const, amount: 0.25 };
    const allClips = [img1, img2, audio];

    const updated = allClips.map((c) =>
      c.type === "image" ? { ...c, zoomEffect: targetEffect } : c
    );

    expect(updated[0].zoomEffect?.type).toBe("pan-up");
    expect(updated[1].zoomEffect?.type).toBe("pan-up");
    expect(updated[2].zoomEffect).toBeUndefined();
  });
});
