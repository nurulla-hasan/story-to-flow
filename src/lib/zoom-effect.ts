/**
 * Ken Burns–style scene animation and motion effects for visual clips.
 *
 * Supported motions:
 * - zoom-in:  Scale 1.0 -> 1.0 + amount
 * - zoom-out: Scale 1.0 + amount -> 1.0
 * - pan-left: Pan horizontal right -> left
 * - pan-right: Pan horizontal left -> right
 * - pan-up: Pan vertical bottom -> top
 * - pan-down: Pan vertical top -> bottom
 *
 * Animated scale and translation offsets are computed identically for both
 * the preview canvas and the MP4 export engine so both surfaces stay in parity.
 */

export type ZoomEffectType =
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "pan-up"
  | "pan-down";

export interface ClipZoomEffect {
  type: ZoomEffectType;
  /**
   * Extra scale or movement amount applied across the clip.
   * Default 0.15 (15%).
   */
  amount: number;
}

export const MIN_ZOOM_EFFECT_AMOUNT = 0.05; // 5%
export const MAX_ZOOM_EFFECT_AMOUNT = 0.5; // 50%
export const DEFAULT_ZOOM_EFFECT_AMOUNT = 0.15; // 15%

export const VALID_ZOOM_EFFECT_TYPES: ReadonlySet<ZoomEffectType> = new Set([
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
]);

/**
 * Validate and clamp a stored scene motion effect.
 * Returns undefined when the effect is disabled or has an unknown type.
 */
export function sanitizeZoomEffect(
  effect?: Partial<ClipZoomEffect> | null
): ClipZoomEffect | undefined {
  if (!effect || !effect.type) return undefined;
  if (!VALID_ZOOM_EFFECT_TYPES.has(effect.type as ZoomEffectType)) return undefined;

  const rawAmount =
    typeof effect.amount === "number" && Number.isFinite(effect.amount)
      ? effect.amount
      : DEFAULT_ZOOM_EFFECT_AMOUNT;

  return {
    type: effect.type as ZoomEffectType,
    amount: parseFloat(
      Math.max(
        MIN_ZOOM_EFFECT_AMOUNT,
        Math.min(MAX_ZOOM_EFFECT_AMOUNT, rawAmount)
      ).toFixed(3)
    ),
  };
}

export interface AnimatedMotionParams {
  /** Multiplier on top of clip's base transform scale */
  scale: number;
  /** Normalized X offset delta (-0.5 to 0.5) added to clip's transform.x */
  offsetX: number;
  /** Normalized Y offset delta (-0.5 to 0.5) added to clip's transform.y */
  offsetY: number;
}

/**
 * Compute the animated motion transform delta (scale, offsetX, offsetY) at a given progress (0.0 to 1.0).
 */
export function getMotionParamsAtProgress(
  effect: Partial<ClipZoomEffect> | null | undefined,
  progress: number
): AnimatedMotionParams {
  const safe = sanitizeZoomEffect(effect);
  if (!safe) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }

  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const amount = safe.amount;

  switch (safe.type) {
    case "zoom-in":
      return {
        scale: 1 + amount * p,
        offsetX: 0,
        offsetY: 0,
      };
    case "zoom-out":
      return {
        scale: 1 + amount * (1 - p),
        offsetX: 0,
        offsetY: 0,
      };
    case "pan-left":
      // Slight scale cushion so edges don't reveal black background when panning
      return {
        scale: 1 + amount * 0.5,
        offsetX: (amount * 0.5) * (1 - 2 * p), // from +halfAmount to -halfAmount
        offsetY: 0,
      };
    case "pan-right":
      return {
        scale: 1 + amount * 0.5,
        offsetX: (amount * 0.5) * (2 * p - 1), // from -halfAmount to +halfAmount
        offsetY: 0,
      };
    case "pan-up":
      return {
        scale: 1 + amount * 0.5,
        offsetX: 0,
        offsetY: (amount * 0.5) * (1 - 2 * p), // from +halfAmount to -halfAmount
      };
    case "pan-down":
      return {
        scale: 1 + amount * 0.5,
        offsetX: 0,
        offsetY: (amount * 0.5) * (2 * p - 1), // from -halfAmount to +halfAmount
      };
    default:
      return { scale: 1, offsetX: 0, offsetY: 0 };
  }
}

/**
 * Scale multiplier (1.0 = no additional zoom) at a normalized clip progress.
 * Kept for backward compatibility with existing tests and call sites.
 */
export function getZoomEffectScaleAtProgress(
  effect: Partial<ClipZoomEffect> | null | undefined,
  progress: number
): number {
  return getMotionParamsAtProgress(effect, progress).scale;
}

/**
 * Normalized 0 -> 1 progress of a clip at a timeline timestamp.
 */
export function getClipZoomProgress(
  clip: { startTime: number; duration: number },
  time: number
): number {
  if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0) return 0;
  const p = (time - clip.startTime) / clip.duration;
  return Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0;
}

/**
 * Animated scale multiplier for a clip at a timeline timestamp.
 */
export function getClipZoomScaleAtTime(
  clip: {
    startTime: number;
    duration: number;
    zoomEffect?: Partial<ClipZoomEffect> | null;
  },
  time: number
): number {
  return getZoomEffectScaleAtProgress(
    clip.zoomEffect,
    getClipZoomProgress(clip, time)
  );
}

/**
 * Animated motion parameters (scale, offsetX, offsetY) for a clip at a timeline timestamp.
 */
export function getClipMotionAtTime(
  clip: {
    startTime: number;
    duration: number;
    zoomEffect?: Partial<ClipZoomEffect> | null;
  },
  time: number
): AnimatedMotionParams {
  return getMotionParamsAtProgress(
    clip.zoomEffect,
    getClipZoomProgress(clip, time)
  );
}
