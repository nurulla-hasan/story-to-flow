/**
 * Level-of-detail rules for timeline clips.
 *
 * Dense projects (tens of scenes) collapse into noise if every clip keeps its
 * thumbnail, name and duration. Each element only appears once the clip is
 * wide enough to show it without clipping.
 */
export interface ClipLod {
  thumbnail: boolean;
  name: boolean;
  duration: boolean;
}

export const CLIP_THUMBNAIL_MIN_PX = 56;
export const CLIP_NAME_MIN_PX = 40;
export const CLIP_DURATION_MIN_PX = 104;

/** Seams narrower than this cannot host a readable 20px badge. */
export const SEAM_BADGE_MIN_CLIP_PX = 48;

export function getClipLod(widthPx: number): ClipLod {
  const width = Number.isFinite(widthPx) ? Math.max(0, widthPx) : 0;
  return {
    thumbnail: width >= CLIP_THUMBNAIL_MIN_PX,
    name: width >= CLIP_NAME_MIN_PX,
    duration: width >= CLIP_DURATION_MIN_PX,
  };
}

/**
 * A seam is tight when either neighbouring clip is too narrow to share the
 * space with a full-size transition badge.
 */
export function isTightSeam(fromWidthPx: number, toWidthPx: number): boolean {
  return Math.min(fromWidthPx, toWidthPx) < SEAM_BADGE_MIN_CLIP_PX;
}
