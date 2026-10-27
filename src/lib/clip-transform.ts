/**
 * Shared clip transform calculations for preview canvas gizmo and MP4 export engine.
 * Uses a normalized composition coordinate system where:
 * - x = 0, y = 0 represents composition center
 * - x = +0.5 is shifted right by 50% of composition width
 * - y = +0.5 is shifted down by 50% of composition height
 * - scale = 1.0 is default full cover scale
 */

export interface ClipTransform {
  x: number; // normalized horizontal offset from center (-3.0 to 3.0, default 0)
  y: number; // normalized vertical offset from center (-3.0 to 3.0, default 0)
  scale: number; // scale multiplier (0.1 to 5.0, default 1.0)
  rotation?: number; // degrees (-360 to 360, default 0)
}

export const DEFAULT_CLIP_TRANSFORM: Readonly<ClipTransform> = Object.freeze({
  x: 0,
  y: 0,
  scale: 1.0,
  rotation: 0,
});

export const MIN_TRANSFORM_SCALE = 0.1;
export const MAX_TRANSFORM_SCALE = 5.0;
export const MIN_TRANSFORM_OFFSET = -3.0;
export const MAX_TRANSFORM_OFFSET = 3.0;

/**
 * Validates and sanitizes a clip transform, preventing NaN, Infinity, and out-of-bounds values.
 */
export function sanitizeClipTransform(
  transform?: Partial<ClipTransform> | null
): ClipTransform {
  if (!transform) {
    return { ...DEFAULT_CLIP_TRANSFORM };
  }

  const rawX =
    typeof transform.x === "number" && Number.isFinite(transform.x)
      ? transform.x
      : 0;
  const rawY =
    typeof transform.y === "number" && Number.isFinite(transform.y)
      ? transform.y
      : 0;
  const rawScale =
    typeof transform.scale === "number" && Number.isFinite(transform.scale)
      ? transform.scale
      : 1.0;
  const rawRotation =
    typeof transform.rotation === "number" && Number.isFinite(transform.rotation)
      ? transform.rotation
      : 0;

  return {
    x: parseFloat(
      Math.max(MIN_TRANSFORM_OFFSET, Math.min(MAX_TRANSFORM_OFFSET, rawX)).toFixed(4)
    ),
    y: parseFloat(
      Math.max(MIN_TRANSFORM_OFFSET, Math.min(MAX_TRANSFORM_OFFSET, rawY)).toFixed(4)
    ),
    scale: parseFloat(
      Math.max(MIN_TRANSFORM_SCALE, Math.min(MAX_TRANSFORM_SCALE, rawScale)).toFixed(4)
    ),
    rotation: parseFloat((rawRotation % 360).toFixed(1)),
  };
}

export interface TransformBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Calculates pixel-space bounding rectangle for a transformed clip inside a container.
 */
export function calculateTransformBounds(
  transform: ClipTransform | undefined,
  containerWidth: number,
  containerHeight: number
): TransformBounds {
  const t = sanitizeClipTransform(transform);
  const width = containerWidth * t.scale;
  const height = containerHeight * t.scale;
  const centerX = containerWidth * (0.5 + t.x);
  const centerY = containerHeight * (0.5 + t.y);
  const left = centerX - width / 2;
  const top = centerY - height / 2;

  return {
    left: parseFloat(left.toFixed(2)),
    top: parseFloat(top.toFixed(2)),
    width: parseFloat(width.toFixed(2)),
    height: parseFloat(height.toFixed(2)),
    centerX: parseFloat(centerX.toFixed(2)),
    centerY: parseFloat(centerY.toFixed(2)),
  };
}

/**
 * Calculates updated transform when dragging inside the transform gizmo.
 */
export function calculateMoveFromPointer({
  deltaPxX,
  deltaPxY,
  initialTransform,
  containerWidth,
  containerHeight,
}: {
  deltaPxX: number;
  deltaPxY: number;
  initialTransform: ClipTransform;
  containerWidth: number;
  containerHeight: number;
}): ClipTransform {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return sanitizeClipTransform(initialTransform);
  }

  const deltaNormX = deltaPxX / containerWidth;
  const deltaNormY = deltaPxY / containerHeight;

  return sanitizeClipTransform({
    ...initialTransform,
    x: initialTransform.x + deltaNormX,
    y: initialTransform.y + deltaNormY,
  });
}

export type ResizeHandleCorner = "nw" | "ne" | "sw" | "se";

/**
 * Calculates updated transform when dragging a corner handle, preserving aspect ratio
 * around the opposite anchor corner.
 */
export function calculateResizeFromHandle({
  handle,
  currentPointer,
  initialBounds,
  containerWidth,
  containerHeight,
  initialTransform,
}: {
  handle: ResizeHandleCorner;
  currentPointer: { x: number; y: number };
  initialBounds: TransformBounds;
  containerWidth: number;
  containerHeight: number;
  initialTransform?: ClipTransform;
}): ClipTransform {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { ...DEFAULT_CLIP_TRANSFORM };
  }

  // Anchor is the opposite corner in container pixel space
  let anchorX = 0;
  let anchorY = 0;

  switch (handle) {
    case "se": // drag bottom-right -> anchor top-left
      anchorX = initialBounds.left;
      anchorY = initialBounds.top;
      break;
    case "nw": // drag top-left -> anchor bottom-right
      anchorX = initialBounds.left + initialBounds.width;
      anchorY = initialBounds.top + initialBounds.height;
      break;
    case "ne": // drag top-right -> anchor bottom-left
      anchorX = initialBounds.left;
      anchorY = initialBounds.top + initialBounds.height;
      break;
    case "sw": // drag bottom-left -> anchor top-right
      anchorX = initialBounds.left + initialBounds.width;
      anchorY = initialBounds.top;
      break;
  }

  // Determine requested width & height relative to anchor
  let requestedW = 0;
  let requestedH = 0;

  switch (handle) {
    case "se":
      requestedW = currentPointer.x - anchorX;
      requestedH = currentPointer.y - anchorY;
      break;
    case "nw":
      requestedW = anchorX - currentPointer.x;
      requestedH = anchorY - currentPointer.y;
      break;
    case "ne":
      requestedW = currentPointer.x - anchorX;
      requestedH = anchorY - currentPointer.y;
      break;
    case "sw":
      requestedW = anchorX - currentPointer.x;
      requestedH = currentPointer.y - anchorY;
      break;
  }

  // Uniform aspect-ratio scale
  const scaleFromW = requestedW / containerWidth;
  const scaleFromH = requestedH / containerHeight;
  const uniformScaleCandidate = (scaleFromW + scaleFromH) / 2;

  const clampedScale = Math.max(
    MIN_TRANSFORM_SCALE,
    Math.min(MAX_TRANSFORM_SCALE, uniformScaleCandidate)
  );

  const newW = containerWidth * clampedScale;
  const newH = containerHeight * clampedScale;

  // New center derived from anchor
  let newCenterX = 0;
  let newCenterY = 0;

  switch (handle) {
    case "se":
      newCenterX = anchorX + newW / 2;
      newCenterY = anchorY + newH / 2;
      break;
    case "nw":
      newCenterX = anchorX - newW / 2;
      newCenterY = anchorY - newH / 2;
      break;
    case "ne":
      newCenterX = anchorX + newW / 2;
      newCenterY = anchorY - newH / 2;
      break;
    case "sw":
      newCenterX = anchorX - newW / 2;
      newCenterY = anchorY + newH / 2;
      break;
  }

  const newNormX = (newCenterX - containerWidth / 2) / containerWidth;
  const newNormY = (newCenterY - containerHeight / 2) / containerHeight;

  return sanitizeClipTransform({
    x: newNormX,
    y: newNormY,
    scale: clampedScale,
    rotation: initialTransform?.rotation,
  });
}

export interface CanvasDrawParams {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  centerX: number;
  centerY: number;
  rotation: number;
}

/**
 * Shared canvas draw parameters for HTML5 Canvas 2D frame rendering in MP4 export.
 * Exactly matches CSS object-cover centering and user normalized transform.
 */
export function calculateCanvasDrawParams({
  imgWidth,
  imgHeight,
  canvasWidth,
  canvasHeight,
  transform,
  xOffset = 0,
}: {
  imgWidth: number;
  imgHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  transform?: ClipTransform;
  xOffset?: number;
}): CanvasDrawParams {
  const t = sanitizeClipTransform(transform);

  // Default object-cover scale
  const baseScale = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);
  const dw = imgWidth * baseScale * t.scale;
  const dh = imgHeight * baseScale * t.scale;

  const centerX = canvasWidth * (0.5 + t.x) + xOffset;
  const centerY = canvasHeight * (0.5 + t.y);

  const dx = centerX - dw / 2;
  const dy = centerY - dh / 2;

  return {
    dx: parseFloat(dx.toFixed(2)),
    dy: parseFloat(dy.toFixed(2)),
    dw: parseFloat(dw.toFixed(2)),
    dh: parseFloat(dh.toFixed(2)),
    centerX: parseFloat(centerX.toFixed(2)),
    centerY: parseFloat(centerY.toFixed(2)),
    rotation: t.rotation ?? 0,
  };
}
