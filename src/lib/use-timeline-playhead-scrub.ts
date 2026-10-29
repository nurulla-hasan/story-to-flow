"use client";

import * as React from "react";
import { calculatePlayheadTimeFromPointer } from "@/lib/playhead-coordinates";

interface UseTimelinePlayheadScrubOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  pixelsPerSecond: number;
  totalDuration: number;
  pause: () => void;
  seek: (time: number) => void;
  commitPlayhead: (time?: number) => void;
}

/**
 * Owns ruler/playhead pointer scrubbing and its temporary window listeners.
 * Coordinate mapping is shared with track drop handlers through the returned
 * getTimeFromClientX function.
 */
export function useTimelinePlayheadScrub({
  containerRef,
  pixelsPerSecond,
  totalDuration,
  pause,
  seek,
  commitPlayhead,
}: UseTimelinePlayheadScrubOptions) {
  const cleanupRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const getTimeFromClientX = React.useCallback(
    (clientX: number): number => {
      const container = containerRef.current;
      if (!container) return 0;

      const containerRect = container.getBoundingClientRect();
      return calculatePlayheadTimeFromPointer({
        clientX,
        containerLeft: containerRect.left,
        scrollLeft: container.scrollLeft,
        pixelsPerSecond,
        totalDuration,
      });
    },
    [containerRef, pixelsPerSecond, totalDuration],
  );

  const startPlayheadDrag = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      pause();

      try {
        if (e.currentTarget && typeof e.currentTarget.setPointerCapture === "function") {
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      } catch {
        // Window-level listeners below are the fallback if pointer capture fails.
      }

      const initialTime = getTimeFromClientX(e.clientX);
      seek(initialTime);
      let lastSeekTime = initialTime;

      const onPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const newTime = getTimeFromClientX(moveEvent.clientX);
        lastSeekTime = newTime;
        seek(newTime);
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        window.removeEventListener("keydown", onKeyDown);
        cleanupRef.current = null;
        commitPlayhead(lastSeekTime);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        upEvent.preventDefault();
        cleanup();
      };

      const onPointerCancel = () => {
        cleanup();
      };

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") cleanup();
      };

      cleanupRef.current = cleanup;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("keydown", onKeyDown);
    },
    [pause, getTimeFromClientX, seek, commitPlayhead],
  );

  return { getTimeFromClientX, startPlayheadDrag };
}
