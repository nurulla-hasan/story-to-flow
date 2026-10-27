export const MIN_TIMELINE_ZOOM = 10; // 10% (zoomed out for long projects: 4px/sec)
export const DEFAULT_TIMELINE_ZOOM = 100; // 100% (40px/sec)
export const MAX_TIMELINE_ZOOM = 500; // 500% (deep zoom for frame precision: 200px/sec)
export const TIMELINE_FPS = 30;

export interface RulerTickMark {
  time: number;
  label: string;
  isFrame: boolean;
  leftPx: number;
}

/**
 * Compute pixels per second for a given zoom percentage
 */
export function getPixelsPerSecond(zoom: number): number {
  const clampedZoom = Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, zoom));
  return (clampedZoom / 100) * 40;
}

/**
 * Generate adaptive ruler tick marks that seamlessly transition between:
 * - Frame notation (e.g. "05f", "10f", "15f") at deep zoom (>= 400%)
 * - Seconds ("00:01", "00:02") at medium zoom
 * - 10s / 30s / 1m at low zoom
 * Extends across the full visible width of the timeline canvas.
 */
export function generateAdaptiveRulerTicks(
  zoom: number,
  durationSpan: number,
  fps: number = TIMELINE_FPS
): RulerTickMark[] {
  const pxPerSec = getPixelsPerSecond(zoom);
  const minLabelSpacingPx = 50; // Minimum pixels required between text labels to prevent clutter

  // Determine step interval in seconds
  let stepSec = 2.0;
  let isFrameLevel = false;

  if (zoom >= 400) {
    // 5 frames interval (0.1667s)
    stepSec = 5 / fps;
    isFrameLevel = true;
  } else if (zoom >= 250) {
    // 10 frames interval (0.3333s)
    stepSec = 10 / fps;
    isFrameLevel = true;
  } else if (zoom >= 150) {
    stepSec = 1.0;
  } else if (zoom >= 80) {
    stepSec = 2.0;
  } else if (zoom >= 40) {
    stepSec = 5.0;
  } else if (zoom >= 20) {
    stepSec = 15.0;
  } else {
    stepSec = 30.0;
  }

  // Ensure minimum pixel spacing between marks
  while (stepSec * pxPerSec < minLabelSpacingPx) {
    stepSec *= 2;
  }

  const marks: RulerTickMark[] = [];
  const maxTime = Math.max(10, durationSpan);

  for (let t = 0; t <= maxTime + stepSec; t += stepSec) {
    const time = parseFloat(t.toFixed(4));
    const leftPx = time * pxPerSec;

    let label = "";
    if (isFrameLevel && time % 1.0 !== 0) {
      // Sub-second frame notation: e.g. "05f", "10f", "15f"
      const totalFrames = Math.round(time * fps);
      const frameOfSecond = totalFrames % fps;
      label = `${frameOfSecond.toString().padStart(2, "0")}f`;
    } else {
      // Standard timecode MM:SS
      const totalSec = Math.floor(time);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      label = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }

    marks.push({
      time,
      label,
      isFrame: isFrameLevel,
      leftPx,
    });
  }

  return marks;
}
