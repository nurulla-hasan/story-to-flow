"use client";

import * as React from "react";
import type { RulerTickMark } from "@/lib/ruler-scale";

interface TimelineRulerProps {
  rulerRef: React.RefObject<HTMLDivElement | null>;
  rulerTicks: RulerTickMark[];
  tracksContentWidth: number;
  onPointerDown: (event: React.PointerEvent) => void;
}

export function TimelineRuler({
  rulerRef,
  rulerTicks,
  tracksContentWidth,
  onPointerDown,
}: TimelineRulerProps) {
  return (
    <div
      ref={rulerRef}
      onPointerDown={onPointerDown}
      style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
      className="sticky top-0 z-30 h-7 min-w-full cursor-pointer border-b border-border bg-card/95 backdrop-blur-xs select-none hover:bg-muted/60"
    >
      {rulerTicks.map((tick) => (
        <div
          key={`ruler_${tick.time}_${tick.label}`}
          style={{ left: `${tick.leftPx}px` }}
          className="absolute bottom-0 flex flex-col items-start pointer-events-none"
        >
          <span className={`pl-1 font-mono text-3xs tabular-nums ${tick.isFrame ? "font-semibold text-primary" : "text-muted-foreground"}`}>
            {tick.label}
          </span>
          <div className="h-1.5 w-px bg-border" />
        </div>
      ))}
    </div>
  );
}
