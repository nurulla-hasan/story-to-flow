"use client";

import * as React from "react";

interface ScrollContainerRef {
  current: HTMLDivElement | null;
}

/** Converts ordinary mouse-wheel and trackpad vertical movement into timeline horizontal panning. */
export function useTimelineWheelPan(scrollRef: ScrollContainerRef): void {
  React.useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleWheel = (event: WheelEvent) => {
      // Keep browser zoom and pinch gestures native.
      if (event.ctrlKey || event.metaKey) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;
      const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
      if (maxScrollLeft <= 0) return;
      const canScrollLeft = delta < 0 && scrollElement.scrollLeft > 0;
      const canScrollRight = delta > 0 && scrollElement.scrollLeft < maxScrollLeft;
      if (canScrollLeft || canScrollRight) {
        event.preventDefault();
        scrollElement.scrollLeft += delta;
      }
    };

    scrollElement.addEventListener("wheel", handleWheel, { passive: false });
    return () => scrollElement.removeEventListener("wheel", handleWheel);
  }, [scrollRef]);
}
