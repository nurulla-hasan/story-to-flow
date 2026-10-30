import { describe, expect, it } from "vitest";
import { calculateTimelineRulerSpan, calculateZoomPreservingScrollLeft } from "./timeline-geometry";

describe("timeline geometry", () => {
  it("keeps a minimum ruler span and expands when content requires it", () => {
    expect(calculateTimelineRulerSpan(2, 1200, 100)).toBe(20);
    expect(calculateTimelineRulerSpan(60, 12000, 100)).toBe(120);
  });

  it("preserves the time at the viewport center when zooming", () => {
    expect(calculateZoomPreservingScrollLeft({
      scrollLeft: 500, viewportWidth: 200, oldPixelsPerSecond: 100, newPixelsPerSecond: 200,
    })).toBe(1100);
  });

  it("never returns a negative scroll offset", () => {
    expect(calculateZoomPreservingScrollLeft({
      scrollLeft: 0, viewportWidth: 400, oldPixelsPerSecond: 100, newPixelsPerSecond: 10,
    })).toBe(0);
  });
});
