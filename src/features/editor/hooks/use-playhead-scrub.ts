"use client";

import * as React from "react";

interface PlayheadScrubOptions {
  pause: () => void;
  getTimeFromClientX: (clientX: number) => number;
  seek: (time: number) => void;
  commitPlayhead: (time?: number) => void;
}

/** Owns global pointer listeners for playhead scrubbing and commits only once when the gesture ends. */
export function usePlayheadScrub({ pause, getTimeFromClientX, seek, commitPlayhead }: PlayheadScrubOptions) {
  const cleanupRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => () => cleanupRef.current?.(), []);

  return React.useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    pause();

    try {
      if (event.currentTarget && typeof event.currentTarget.setPointerCapture === "function") {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } catch {
      // Window listeners below are the fallback if pointer capture is unavailable.
    }

    const initialTime = getTimeFromClientX(event.clientX);
    seek(initialTime);
    let lastSeekTime = initialTime;

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const nextTime = getTimeFromClientX(moveEvent.clientX);
      lastSeekTime = nextTime;
      seek(nextTime);
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
    const onPointerCancel = () => cleanup();
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") cleanup();
    };

    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
  }, [pause, getTimeFromClientX, seek, commitPlayhead]);
}
