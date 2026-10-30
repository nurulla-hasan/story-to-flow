"use client";

import * as React from "react";
import type { TimelineClip, TimelineTransition } from "@/types/timeline";
import { Plus } from "lucide-react";
import { isTightSeam } from "@/lib/timeline-lod";

interface TimelineTransitionSeamProps {
  fromClip: TimelineClip;
  toClip: TimelineClip;
  transitions: TimelineTransition[];
  pixelsPerSecond: number;
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  selectTransition: (transitionId: string | null) => void;
  addTransition: (fromClipId: string, toClipId: string) => void;
}

/** Renders the transition affordance for a single adjacent visual clip pair. */
export const TimelineTransitionSeam = React.memo(function TimelineTransitionSeam({
  fromClip, toClip, transitions, pixelsPerSecond, selectedClipId, selectedTransitionId,
  selectTransition, addTransition,
}: TimelineTransitionSeamProps) {
  const cutPx = toClip.startTime * pixelsPerSecond;
  const existingTrans = transitions.find(
    (transition) =>
      (transition.fromClipId === fromClip.id && transition.toClipId === toClip.id) ||
      (transition.fromClipId === toClip.id && transition.toClipId === fromClip.id)
  );
  const isSelected = existingTrans?.id === selectedTransitionId;
  const isAdjacentSelected = fromClip.id === selectedClipId || toClip.id === selectedClipId;
  const tightSeam = isTightSeam(fromClip.duration * pixelsPerSecond, toClip.duration * pixelsPerSecond);

  if (tightSeam) {
    if (!existingTrans && !isAdjacentSelected) return null;
    return (
      <div
        style={{ left: `${cutPx}px`, top: "50%", transform: "translate(-50%, -50%)" }}
        className="absolute z-30 flex items-center justify-center"
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (existingTrans) selectTransition(existingTrans.id);
            else addTransition(fromClip.id, toClip.id);
          }}
          className={`flex cursor-pointer items-center justify-center rounded-full transition-all hover:scale-125 ${
            existingTrans ? "size-2.5 bg-primary shadow-xs ring-2 ring-background" : "size-3.5 border border-primary/50 bg-card text-primary shadow-xs"
          }`}
          title={existingTrans
            ? `Transition: ${existingTrans.type} (${existingTrans.duration.toFixed(2)}s) — Click to edit or remove`
            : `Add visual transition between "${fromClip.name}" and "${toClip.name}"`}
          aria-label={existingTrans ? `Transition: ${existingTrans.type}` : "Add transition"}
        >
          {!existingTrans && <Plus className="size-2" />}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ left: `${cutPx}px`, top: "50%", transform: "translate(-50%, -50%)" }}
      className="absolute z-30 flex items-center justify-center pointer-events-auto"
    >
      {existingTrans ? (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); selectTransition(existingTrans.id); }}
          className={`size-5 rounded-md flex items-center justify-center transition-all duration-150 cursor-pointer shadow-xs ${
            isSelected ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background scale-110" : "bg-primary/90 text-primary-foreground border border-primary hover:bg-primary hover:scale-110"
          }`}
          title={`Transition: ${existingTrans.type} (${existingTrans.duration.toFixed(2)}s) — Click to edit or remove`}
          aria-label={`Transition: ${existingTrans.type}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 5.3c0-1.37 1.66-2.06 2.63-1.09l4.95 4.95-1.41 1.42L5 6.41v11.17L10.59 12l1.41-1.41 6.37-6.37c.97-.97 2.63-.29 2.63 1.09v13.39c0 1.37-1.66 2.06-2.63 1.09l-4.95-4.95 1.41-1.42L19 17.59V6.41L13.41 12l-1.41 1.41-6.37 6.37c-.97.97-2.63.29-2.63-1.09V5.3Z" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); addTransition(fromClip.id, toClip.id); }}
          className="group/seam size-5 rounded-md bg-card border border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center opacity-90 hover:opacity-100 hover:scale-110 transition-all duration-150 cursor-pointer shadow-xs"
          title={`Add visual transition between "${fromClip.name}" and "${toClip.name}"`}
          aria-label="Add transition"
        >
          <Plus className="size-3 group-hover/seam:scale-110 transition-transform" />
        </button>
      )}
    </div>
  );
});
