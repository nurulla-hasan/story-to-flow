/**
 * Unified timeline playhead and pointer coordinate mapping helper.
 * Converts pointer clientX to accurate timeline seconds, accounting for:
 * - Scroll container viewport offset (containerLeft)
 * - Horizontal scroll position (scrollLeft)
 * - Dynamic zoom scale (pixelsPerSecond)
 * - Timeline total duration bounds clamping
 */
export interface PlayheadCoordinateParams {
  clientX: number;
  containerLeft: number;
  scrollLeft: number;
  pixelsPerSecond: number;
  totalDuration: number;
}

export function calculatePlayheadTimeFromPointer({
  clientX,
  containerLeft,
  scrollLeft,
  pixelsPerSecond,
  totalDuration,
}: PlayheadCoordinateParams): number {
  if (pixelsPerSecond <= 0) return 0;
  
  const contentX = (clientX - containerLeft) + scrollLeft;
  const rawTime = contentX / pixelsPerSecond;
  
  if (Number.isNaN(rawTime) || !Number.isFinite(rawTime)) {
    return 0;
  }

  const clamped = Math.max(0, Math.min(totalDuration, rawTime));
  return parseFloat(clamped.toFixed(4));
}
