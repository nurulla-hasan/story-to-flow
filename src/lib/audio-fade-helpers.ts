export const MAX_AUDIO_FADE_DURATION = 5.0; // 5 seconds max fade ramp

/**
 * Validate and clamp an audio fade duration against clip boundaries.
 */
export function validateFadeDuration(
  requestedFadeSec: number,
  clipDuration: number,
  otherFadeSec: number = 0
): number {
  if (isNaN(requestedFadeSec) || requestedFadeSec <= 0 || clipDuration <= 0) {
    return 0;
  }

  // Maximum allowed is the smaller of 5.0s or the remaining headroom of the clip
  const availableHeadroom = Math.max(0, clipDuration - Math.max(0, otherFadeSec));
  const maxSafeFade = Math.min(MAX_AUDIO_FADE_DURATION, availableHeadroom);

  const clamped = Math.max(0, Math.min(maxSafeFade, requestedFadeSec));
  return parseFloat(clamped.toFixed(2));
}

/**
 * Calculate the exact scalar audio gain (0.0 to baseVolume) at any given point in a clip's timeline.
 */
export function calculateAudioGain(
  clipRelativeTime: number,
  clipDuration: number,
  baseVolume: number = 1.0,
  fadeInDuration: number = 0,
  fadeOutDuration: number = 0
): number {
  if (clipDuration <= 0) return 0;
  const clampedVolume = Math.max(0, Math.min(1.0, baseVolume));

  const time = Math.max(0, Math.min(clipDuration, clipRelativeTime));
  const fadeIn = Math.max(0, Math.min(clipDuration, fadeInDuration));
  const fadeOut = Math.max(0, Math.min(clipDuration, fadeOutDuration));

  let gainMultiplier = 1.0;

  // Handle Fade-In ramp
  if (fadeIn > 0 && time < fadeIn) {
    gainMultiplier = time / fadeIn;
  }

  // Handle Fade-Out ramp
  const fadeOutStart = clipDuration - fadeOut;
  if (fadeOut > 0 && time > fadeOutStart) {
    const fadeOutProgress = (clipDuration - time) / fadeOut;
    // When fade-in and fade-out meet or overlap, take the lower gain multiplier
    gainMultiplier = Math.min(gainMultiplier, Math.max(0, fadeOutProgress));
  }

  return parseFloat((clampedVolume * Math.max(0, Math.min(1.0, gainMultiplier))).toFixed(4));
}
