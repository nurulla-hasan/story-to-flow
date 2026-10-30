import type { TimelineClip } from "@/types/timeline";

/** Playback speed values offered by the editor UI. */
export const CLIP_SPEED_PRESETS = [0.5, 1, 1.5, 2] as const;

/**
 * Build the clip patch for a speed change.
 *
 * Video/audio clips cannot play past the end of their source media, so the
 * duration (and matching out-point) is clamped when the faster rate would
 * exceed the remaining source footage.
 */
export function buildClipSpeedUpdate(
  clip: TimelineClip,
  speed: number
): Partial<TimelineClip> {
  if (!Number.isFinite(speed) || speed <= 0) return {};

  const updates: Partial<TimelineClip> = { speed };

  if (
    clip.sourceDuration &&
    clip.sourceDuration > 0 &&
    (clip.type === "video" || clip.type === "audio")
  ) {
    const maxDuration = Math.max(
      0,
      (clip.sourceDuration - clip.inPoint) / speed
    );

    if (clip.duration > maxDuration) {
      // Never round a source limit upward. A short tail may legitimately be
      // less than 500ms when that is all the source footage has left.
      const roundedMax = parseFloat(maxDuration.toFixed(3));
      const clampedDuration = Math.min(
        maxDuration,
        Math.max(0.5, roundedMax)
      );
      updates.duration = clampedDuration;
      updates.outPoint = Math.min(
        clip.sourceDuration,
        clip.inPoint + clampedDuration * speed
      );
    } else {
      updates.outPoint = Math.min(
        clip.sourceDuration,
        clip.inPoint + clip.duration * speed
      );
    }
  }

  return updates;
}
