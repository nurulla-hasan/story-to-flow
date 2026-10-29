import { describe, expect, it } from "vitest";
import {
  CLIP_DURATION_MIN_PX,
  CLIP_NAME_MIN_PX,
  CLIP_THUMBNAIL_MIN_PX,
  SEAM_BADGE_MIN_CLIP_PX,
  getClipLod,
  isTightSeam,
} from "./timeline-lod";

describe("timeline level-of-detail", () => {
  it("hides every label on a hairline clip", () => {
    expect(getClipLod(4)).toEqual({ thumbnail: false, name: false, duration: false });
  });

  it("reveals the name before the thumbnail", () => {
    const lod = getClipLod(CLIP_NAME_MIN_PX);
    expect(lod.name).toBe(true);
    expect(lod.thumbnail).toBe(false);
    expect(lod.duration).toBe(false);
  });

  it("reveals the thumbnail once the clip is wide enough", () => {
    expect(getClipLod(CLIP_THUMBNAIL_MIN_PX)).toEqual({
      thumbnail: true,
      name: true,
      duration: false,
    });
  });

  it("only shows duration on wide clips", () => {
    expect(getClipLod(CLIP_DURATION_MIN_PX).duration).toBe(true);
  });

  it("treats invalid widths as zero instead of throwing", () => {
    expect(getClipLod(Number.NaN)).toEqual({
      thumbnail: false,
      name: false,
      duration: false,
    });
  });

  it("marks seams tight when either neighbour is narrow", () => {
    expect(isTightSeam(SEAM_BADGE_MIN_CLIP_PX - 1, 400)).toBe(true);
    expect(isTightSeam(400, SEAM_BADGE_MIN_CLIP_PX - 1)).toBe(true);
    expect(isTightSeam(SEAM_BADGE_MIN_CLIP_PX, SEAM_BADGE_MIN_CLIP_PX)).toBe(false);
  });
});
