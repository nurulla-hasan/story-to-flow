export const TIMELINE_FPS = 30;

/**
 * Step playhead by an exact integer number of frames at the given FPS.
 * Uses integer frame arithmetic to prevent cumulative floating-point drift over repeated steps.
 */
export function stepFrame(
  currentPlayhead: number,
  frameDelta: number,
  totalDuration: number,
  fps: number = TIMELINE_FPS
): number {
  if (totalDuration <= 0) return 0;

  // Round to nearest integer frame index to avoid fractional drift
  const currentFrame = Math.round(currentPlayhead * fps);
  const targetFrame = currentFrame + frameDelta;
  const maxFrame = Math.round(totalDuration * fps);

  // Clamp within [0, maxFrame]
  const clampedFrame = Math.max(0, Math.min(maxFrame, targetFrame));

  // Return exact timestamp corresponding to the clamped frame
  return clampedFrame / fps;
}

/**
 * Format a timestamp into MM:SS:FF timecode where FF is the 0-based frame index (00 to FPS-1).
 */
export function formatFrameTimecode(seconds: number, fps: number = TIMELINE_FPS): string {
  if (isNaN(seconds) || seconds < 0) return "00:00:00";

  const totalFrames = Math.round(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}
