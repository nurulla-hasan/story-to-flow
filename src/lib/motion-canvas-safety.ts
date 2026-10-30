/**
 * Canvas-Edge Safety & Dynamic Cover Scale Calculations
 *
 * Implements Phase D of Story Plan -> Timeline Blocks -> Auto Motion/Transition.
 * Guarantees zero black borders or corner gaps during animated Ken Burns motion
 * and 90-degree clip rotation across all aspect ratios (16:9, 9:16).
 */

import type { ClipTransform } from "@/lib/clip-transform";
import { sanitizeClipTransform, MAX_TRANSFORM_SCALE } from "@/lib/clip-transform";
import type { ClipZoomEffect } from "@/lib/zoom-effect";
import { sanitizeZoomEffect, getMotionParamsAtProgress } from "@/lib/zoom-effect";

export interface CanvasCoverageCheckResult {
  isCovered: boolean;
  minScaleRequired: number;
  maxGapPx: number;
}

/**
 * Checks whether the transformed media completely covers the canvas at a given motion progress.
 * Tests all 4 corners of the composition transformed into the local media coordinate system.
 */
export function checkCornerCoverageAtProgress({
  transform,
  motion,
  progress,
  assetWidth,
  assetHeight,
  canvasWidth,
  canvasHeight,
}: {
  transform?: ClipTransform;
  motion?: Partial<ClipZoomEffect> | null;
  progress: number;
  assetWidth: number;
  assetHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}): CanvasCoverageCheckResult {
  const t = sanitizeClipTransform(transform);
  const m = getMotionParamsAtProgress(motion, progress);

  const safeAssetW = Math.max(1, assetWidth);
  const safeAssetH = Math.max(1, assetHeight);
  const safeCanvasW = Math.max(1, canvasWidth);
  const safeCanvasH = Math.max(1, canvasHeight);

  // Default CSS object-cover base scale
  const baseScale = Math.max(safeCanvasW / safeAssetW, safeCanvasH / safeAssetH);
  const netScale = t.scale * m.scale;

  const mediaW = safeAssetW * baseScale * netScale;
  const mediaH = safeAssetH * baseScale * netScale;
  const halfW = mediaW / 2;
  const halfH = mediaH / 2;

  // Media center in canvas coordinates
  const netCenterX = safeCanvasW * (0.5 + t.x + m.offsetX);
  const netCenterY = safeCanvasH * (0.5 + t.y + m.offsetY);

  // Rotation in radians (invert to transform canvas points into unrotated media space)
  const rotRad = -((t.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);

  // 4 corners of the canvas
  const canvasCorners = [
    { x: 0, y: 0 },
    { x: safeCanvasW, y: 0 },
    { x: safeCanvasW, y: safeCanvasH },
    { x: 0, y: safeCanvasH },
  ];

  let isCovered = true;
  let maxRequiredScale = t.scale;
  let maxGapPx = 0;
  const epsilon = 0.5; // half-pixel tolerance for sub-pixel anti-aliasing

  for (const corner of canvasCorners) {
    const dx = corner.x - netCenterX;
    const dy = corner.y - netCenterY;

    // Local coordinates inside unrotated media rectangle
    const u = Math.abs(dx * cos - dy * sin);
    const v = Math.abs(dx * sin + dy * cos);

    if (u > halfW + epsilon || v > halfH + epsilon) {
      isCovered = false;
      const gapU = Math.max(0, u - halfW);
      const gapV = Math.max(0, v - halfH);
      maxGapPx = Math.max(maxGapPx, gapU, gapV);

      // Scale required to cover this corner
      const reqScaleForU = (u * 2) / (safeAssetW * baseScale * m.scale);
      const reqScaleForV = (v * 2) / (safeAssetH * baseScale * m.scale);
      maxRequiredScale = Math.max(maxRequiredScale, reqScaleForU, reqScaleForV);
    }
  }

  return {
    isCovered,
    minScaleRequired: parseFloat(maxRequiredScale.toFixed(4)),
    maxGapPx: parseFloat(maxGapPx.toFixed(2)),
  };
}

/**
 * Validates coverage across the full animation path of an auto-motion effect (samples at p = 0, 0.25, 0.5, 0.75, 1.0).
 */
export function checkFullAnimationPathCoverage({
  transform,
  motion,
  assetWidth,
  assetHeight,
  canvasWidth,
  canvasHeight,
}: {
  transform?: ClipTransform;
  motion?: Partial<ClipZoomEffect> | null;
  assetWidth: number;
  assetHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}): CanvasCoverageCheckResult {
  const samplePoints = [0.0, 0.25, 0.5, 0.75, 1.0];
  let isCovered = true;
  let maxScaleRequired = 1.0;
  let maxGap = 0;

  for (const p of samplePoints) {
    const res = checkCornerCoverageAtProgress({
      transform,
      motion,
      progress: p,
      assetWidth,
      assetHeight,
      canvasWidth,
      canvasHeight,
    });

    if (!res.isCovered) {
      isCovered = false;
      maxScaleRequired = Math.max(maxScaleRequired, res.minScaleRequired);
      maxGap = Math.max(maxGap, res.maxGapPx);
    }
  }

  return {
    isCovered,
    minScaleRequired: parseFloat(maxScaleRequired.toFixed(4)),
    maxGapPx: parseFloat(maxGap.toFixed(2)),
  };
}

export interface ResolveSafeMotionResult {
  safe: boolean;
  appliedMotion?: ClipZoomEffect;
  recommendedTransformScale?: number;
  fallbackReason?: string;
}

/**
 * Evaluates a suggested scene motion and returns a guaranteed edge-safe motion.
 * - If current motion covers canvas: applies as-is.
 * - If overscan scale (up to 2.0x) makes it safe: suggests overscan scale.
 * - If pan requires excessive zoom: falls back deterministically to safe zoom-in.
 * - If even zoom is unsafe (base scale < 1.0): turns motion off with clear reason.
 */
export function resolveSafeClipMotion({
  transform,
  motion,
  assetWidth,
  assetHeight,
  canvasWidth,
  canvasHeight,
}: {
  transform?: ClipTransform;
  motion?: Partial<ClipZoomEffect> | null;
  assetWidth: number;
  assetHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}): ResolveSafeMotionResult {
  const safeMotion = sanitizeZoomEffect(motion);
  if (!safeMotion) {
    return { safe: true, appliedMotion: undefined };
  }

  const t = sanitizeClipTransform(transform);

  // 1. Check full animation path coverage with existing transform
  const coverage = checkFullAnimationPathCoverage({
    transform: t,
    motion: safeMotion,
    assetWidth,
    assetHeight,
    canvasWidth,
    canvasHeight,
  });

  if (coverage.isCovered) {
    return { safe: true, appliedMotion: safeMotion };
  }

  // 2. Can a modest overscan scale (<= 2.0x) rescue the pan/zoom without black edges?
  if (coverage.minScaleRequired <= 2.0) {
    return {
      safe: true,
      appliedMotion: safeMotion,
      recommendedTransformScale: coverage.minScaleRequired,
    };
  }

  // 3. Fallback: try safe zoom-in (zooming inward from center never leaves edges)
  const zoomInFallback: ClipZoomEffect = {
    type: "zoom-in",
    amount: Math.min(0.15, safeMotion.amount),
  };

  const zoomInCoverage = checkFullAnimationPathCoverage({
    transform: { ...t, scale: Math.max(1.0, t.scale) },
    motion: zoomInFallback,
    assetWidth,
    assetHeight,
    canvasWidth,
    canvasHeight,
  });

  if (zoomInCoverage.isCovered) {
    return {
      safe: true,
      appliedMotion: zoomInFallback,
      recommendedTransformScale: Math.max(1.0, t.scale),
      fallbackReason: `Motion "${safeMotion.type}" caused canvas edge gaps; fell back to safe center zoom-in.`,
    };
  }

  // 4. Safe motion impossible without extreme zoom
  return {
    safe: false,
    appliedMotion: undefined,
    fallbackReason: `Motion disabled: base transform scale is too small to cover canvas without black borders.`,
  };
}

/**
 * Calculates updated transform for +90° rotation while guaranteeing full canvas coverage.
 * - Rotates by +90 degrees: (rotation + 90) % 360
 * - Preserves existing normalized x and y offsets
 * - Computes minimal required scale so rotated media completely covers canvas corners
 */
export function calculateSafeRotation90({
  transform,
  assetWidth,
  assetHeight,
  canvasWidth,
  canvasHeight,
}: {
  transform?: ClipTransform;
  assetWidth: number;
  assetHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}): ClipTransform {
  const t = sanitizeClipTransform(transform);
  const nextRotation = ((t.rotation || 0) + 90) % 360;

  // Check corner coverage at new rotation with current scale
  const testTransform = { ...t, rotation: nextRotation };
  const coverage = checkCornerCoverageAtProgress({
    transform: testTransform,
    motion: null,
    progress: 0,
    assetWidth,
    assetHeight,
    canvasWidth,
    canvasHeight,
  });

  const nextScale = coverage.isCovered
    ? t.scale
    : Math.min(MAX_TRANSFORM_SCALE, Math.max(t.scale, coverage.minScaleRequired));

  return sanitizeClipTransform({
    x: t.x,
    y: t.y,
    scale: nextScale,
    rotation: nextRotation,
  });
}
