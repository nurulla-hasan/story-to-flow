"use client";

import * as React from "react";

interface TimelinePlayheadProps {
  playhead: number;
  pixelsPerSecond: number;
  totalDuration: number;
  onPointerDown: (event: React.PointerEvent) => void;
}

/** Playhead cap and needle; the dock owns the scrollable track canvas. */
export function TimelinePlayhead({
  playhead,
  pixelsPerSecond,
  totalDuration,
  onPointerDown,
}: TimelinePlayheadProps) {
  return (
    <div
      style={{ left: `${playhead * pixelsPerSecond}px` }}
      className="absolute top-0 bottom-0 z-40 flex flex-col items-center pointer-events-none -translate-x-1/2 select-none"
    >
      <div
        onPointerDown={onPointerDown}
        className="h-6 w-5 flex flex-col items-center justify-start cursor-ew-resize pointer-events-auto group/playhead select-none"
        title={`Playhead: ${playhead.toFixed(2)}s (Click or drag to scrub)`}
        role="slider"
        aria-label="Timeline playhead"
        aria-valuenow={playhead}
        aria-valuemin={0}
        aria-valuemax={totalDuration}
      >
        <div className="w-3.5 h-3 bg-primary rounded-t-xs shadow-sm flex items-center justify-center group-hover/playhead:brightness-110 group-active/playhead:scale-110 transition-transform">
          <div className="w-1.5 h-0.5 bg-primary-foreground rounded-full" />
        </div>
        <svg width="14" height="6" viewBox="0 0 14 6" className="fill-primary -mt-px group-hover/playhead:brightness-110 drop-shadow-xs">
          <polygon points="0,0 14,0 7,6" />
        </svg>
      </div>

      <div
        onPointerDown={onPointerDown}
        className="w-2 flex-1 flex items-center justify-center cursor-ew-resize pointer-events-auto group/playheadLine"
        title={`Playhead: ${playhead.toFixed(2)}s (Click or drag to scrub)`}
      >
        <div className="w-0.5 h-full bg-primary shadow-xs group-hover/playheadLine:w-1 transition-all" />
      </div>
    </div>
  );
}
