/** Calculates how many seconds the timeline ruler should cover for the scrollable viewport. */
export function calculateTimelineRulerSpan(
  totalDuration: number,
  contentWidth: number,
  pixelsPerSecond: number
): number {
  return Math.max(Math.max(10, totalDuration) + 10, contentWidth / pixelsPerSecond);
}

export interface ZoomScrollAnchor {
  scrollLeft: number;
  viewportWidth: number;
  oldPixelsPerSecond: number;
  newPixelsPerSecond: number;
}

/** Keeps the timeline time at the viewport center stable when zoom changes. */
export function calculateZoomPreservingScrollLeft(anchor: ZoomScrollAnchor): number {
  const centerTime =
    (anchor.scrollLeft + anchor.viewportWidth / 2) / anchor.oldPixelsPerSecond;
  return Math.max(0, centerTime * anchor.newPixelsPerSecond - anchor.viewportWidth / 2);
}
