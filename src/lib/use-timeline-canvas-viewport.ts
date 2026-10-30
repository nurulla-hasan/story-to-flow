"use client";

import * as React from "react";
import {
  generateAdaptiveRulerTicks,
  getPixelsPerSecond,
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
} from "@/lib/ruler-scale";
import { useTimelinePlayheadScrub } from "@/lib/use-timeline-playhead-scrub";

interface UseTimelineCanvasViewportOptions {
  zoom: number;
  totalDuration: number;
  setZoom: (zoom: number) => void;
  pause: () => void;
  seek: (time: number) => void;
  commitPlayhead: (time?: number) => void;
}

/** Owns horizontal timeline scrolling, zoom anchoring, and ruler scale calculations. */
export function useTimelineCanvasViewport({
  zoom,
  totalDuration,
  setZoom,
  pause,
  seek,
  commitPlayhead,
}: UseTimelineCanvasViewportOptions) {
  const pxPerSec = getPixelsPerSecond(zoom);
  const tracksContentWidth = Math.max(1200, (Math.max(10, totalDuration) + 10) * pxPerSec);
  const rulerRef = React.useRef<HTMLDivElement>(null);
  const tracksScrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const scrollEl = tracksScrollRef.current;
    if (!scrollEl) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;

      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
      if (delta === 0) return;

      const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
      if (maxScrollLeft <= 0) return;

      const canScrollLeft = delta < 0 && scrollEl.scrollLeft > 0;
      const canScrollRight = delta > 0 && scrollEl.scrollLeft < maxScrollLeft;
      if (canScrollLeft || canScrollRight) {
        event.preventDefault();
        scrollEl.scrollLeft += delta;
      }
    };

    scrollEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => scrollEl.removeEventListener("wheel", handleWheel);
  }, []);

  const rulerTicks = React.useMemo(() => {
    const span = Math.max(Math.max(10, totalDuration) + 10, tracksContentWidth / pxPerSec);
    return generateAdaptiveRulerTicks(zoom, span, 30);
  }, [zoom, totalDuration, tracksContentWidth, pxPerSec]);

  const handleZoomChange = React.useCallback((newZoom: number) => {
    const clamped = Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, newZoom));
    const scrollEl = tracksScrollRef.current;
    if (!scrollEl) {
      setZoom(clamped);
      return;
    }

    const viewportWidth = scrollEl.clientWidth;
    const oldPxPerSec = getPixelsPerSecond(zoom);
    const centerTime = (scrollEl.scrollLeft + viewportWidth / 2) / oldPxPerSec;
    setZoom(clamped);

    requestAnimationFrame(() => {
      const nextPxPerSec = getPixelsPerSecond(clamped);
      const targetScrollLeft = centerTime * nextPxPerSec - viewportWidth / 2;
      scrollEl.scrollLeft = Math.max(0, targetScrollLeft);
    });
  }, [zoom, setZoom]);

  const { getTimeFromClientX, startPlayheadDrag } = useTimelinePlayheadScrub({
    containerRef: tracksScrollRef,
    pixelsPerSecond: pxPerSec,
    totalDuration,
    pause,
    seek,
    commitPlayhead,
  });

  return {
    pxPerSec,
    tracksContentWidth,
    rulerRef,
    tracksScrollRef,
    rulerTicks,
    handleZoomChange,
    getTimeFromClientX,
    startPlayheadDrag,
  };
}
