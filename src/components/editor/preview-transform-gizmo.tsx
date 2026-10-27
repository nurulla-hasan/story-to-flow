"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import {
  type ResizeHandleCorner,
  calculateTransformBounds,
  calculateMoveFromPointer,
  calculateResizeFromHandle,
  sanitizeClipTransform,
  DEFAULT_CLIP_TRANSFORM,
} from "@/lib/clip-transform";
import type { TimelineClip } from "@/types/timeline";

interface PreviewTransformGizmoProps {
  clip: TimelineClip;
  containerWidth: number;
  containerHeight: number;
  getContainerRect: () => DOMRect | null;
  allClips: TimelineClip[];
  setClipsTransient: (clips: TimelineClip[]) => void;
  commitClipGesture: (originalClips: TimelineClip[], finalClips: TimelineClip[]) => void;
  cancelClipGesture: (originalClips: TimelineClip[]) => void;
  onReset: () => void;
}

export function PreviewTransformGizmo({
  clip,
  containerWidth,
  containerHeight,
  getContainerRect,
  allClips,
  setClipsTransient,
  commitClipGesture,
  cancelClipGesture,
  onReset,
}: PreviewTransformGizmoProps) {
  const transform = sanitizeClipTransform(clip.transform);
  const bounds = calculateTransformBounds(transform, containerWidth, containerHeight);

  // Active gesture cleanup ref to prevent hanging listeners on unmount
  const activeCleanupRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    return () => {
      if (activeCleanupRef.current) {
        activeCleanupRef.current();
      }
    };
  }, []);

  // DIRECT POSITION DRAGGING
  const handleMoveStart = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialClips: TimelineClip[] = JSON.parse(JSON.stringify(allClips));
    const initialTransform = sanitizeClipTransform(clip.transform);
    let latestClips = initialClips;

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaPxX = moveEvent.clientX - startX;
      const deltaPxY = moveEvent.clientY - startY;

      const newTransform = calculateMoveFromPointer({
        deltaPxX,
        deltaPxY,
        initialTransform,
        containerWidth,
        containerHeight,
      });

      latestClips = initialClips.map((c) =>
        c.id === clip.id ? { ...c, transform: newTransform } : c
      );
      setClipsTransient(latestClips);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      activeCleanupRef.current = null;
    };

    const onPointerUp = () => {
      cleanup();
      commitClipGesture(initialClips, latestClips);
    };

    const onPointerCancel = () => {
      cleanup();
      cancelClipGesture(initialClips);
    };

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") {
        cleanup();
        cancelClipGesture(initialClips);
      }
    };

    activeCleanupRef.current = cleanup;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
  };

  // CORNER RESIZING (Aspect ratio preserved)
  const handleResizeStart = (e: React.PointerEvent, handle: ResizeHandleCorner) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    (window as unknown as { _resizeCalls?: number })._resizeCalls =
      ((window as unknown as { _resizeCalls?: number })._resizeCalls || 0) + 1;

    const containerRect = getContainerRect();
    if (!containerRect) return;

    const initialClips: TimelineClip[] = JSON.parse(JSON.stringify(allClips));
    const initialBounds = calculateTransformBounds(
      sanitizeClipTransform(clip.transform),
      containerWidth,
      containerHeight
    );
    let latestClips = initialClips;

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const currentPointer = {
        x: moveEvent.clientX - containerRect.left,
        y: moveEvent.clientY - containerRect.top,
      };

      const newTransform = calculateResizeFromHandle({
        handle,
        currentPointer,
        initialBounds,
        containerWidth,
        containerHeight,
      });

      latestClips = initialClips.map((c) =>
        c.id === clip.id ? { ...c, transform: newTransform } : c
      );
      setClipsTransient(latestClips);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
      activeCleanupRef.current = null;
    };

    const onPointerUp = () => {
      cleanup();
      commitClipGesture(initialClips, latestClips);
    };

    const onPointerCancel = () => {
      cleanup();
      cancelClipGesture(initialClips);
    };

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") {
        cleanup();
        cancelClipGesture(initialClips);
      }
    };

    activeCleanupRef.current = cleanup;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
  };

  const isDefault =
    transform.x === DEFAULT_CLIP_TRANSFORM.x &&
    transform.y === DEFAULT_CLIP_TRANSFORM.y &&
    transform.scale === DEFAULT_CLIP_TRANSFORM.scale;

  return (
    <div
      style={{
        left: `${bounds.left}px`,
        top: `${bounds.top}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
      }}
      className="absolute z-30 pointer-events-auto border-2 border-primary ring-1 ring-primary/40 rounded-lg select-none group/gizmo"
      role="region"
      aria-label={`Transform gizmo for ${clip.name}`}
    >
      {/* Move Grab Area covering the interior */}
      <div
        onPointerDown={handleMoveStart}
        className="w-full h-full cursor-move bg-primary/5 hover:bg-primary/10 transition-colors flex items-center justify-center"
        title="Drag to reposition visual layer"
      >
        {/* Subtle center crosshair indicator */}
        <div className="size-2 rounded-full border border-primary/60 bg-primary/20 pointer-events-none" />
      </div>

      {/* Floating Info & Reset Badge */}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card/90 backdrop-blur border border-border px-1.5 py-0.5 rounded text-3xs font-mono text-muted-foreground whitespace-nowrap shadow-xs pointer-events-auto">
        <span>{Math.round(transform.scale * 100)}%</span>
        {!isDefault && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            title="Reset position and scale to default (100%)"
            aria-label="Reset transform"
            className="text-primary hover:text-primary/80 transition-colors cursor-pointer ml-0.5"
          >
            <RotateCcw className="size-2.5" />
          </button>
        )}
      </div>

      {/* 4 Corner Resize Handles with generous hit targets */}
      {/* Top-Left (NW) */}
      <div
        onPointerDown={(e) => handleResizeStart(e, "nw")}
        className="absolute -top-2.5 -left-2.5 size-5 flex items-center justify-center cursor-nwse-resize hover:scale-125 transition-transform z-40 pointer-events-auto"
        role="button"
        aria-label="Resize top-left corner"
        tabIndex={0}
      >
        <div className="size-2.5 rounded-xs border-2 border-primary bg-background shadow-xs pointer-events-none" />
      </div>

      {/* Top-Right (NE) */}
      <div
        onPointerDown={(e) => handleResizeStart(e, "ne")}
        className="absolute -top-2.5 -right-2.5 size-5 flex items-center justify-center cursor-nesw-resize hover:scale-125 transition-transform z-40 pointer-events-auto"
        role="button"
        aria-label="Resize top-right corner"
        tabIndex={0}
      >
        <div className="size-2.5 rounded-xs border-2 border-primary bg-background shadow-xs pointer-events-none" />
      </div>

      {/* Bottom-Left (SW) */}
      <div
        onPointerDown={(e) => handleResizeStart(e, "sw")}
        className="absolute -bottom-2.5 -left-2.5 size-5 flex items-center justify-center cursor-nesw-resize hover:scale-125 transition-transform z-40 pointer-events-auto"
        role="button"
        aria-label="Resize bottom-left corner"
        tabIndex={0}
      >
        <div className="size-2.5 rounded-xs border-2 border-primary bg-background shadow-xs pointer-events-none" />
      </div>

      {/* Bottom-Right (SE) */}
      <div
        onPointerDown={(e) => handleResizeStart(e, "se")}
        className="absolute -bottom-2.5 -right-2.5 size-5 flex items-center justify-center cursor-nwse-resize hover:scale-125 transition-transform z-40 pointer-events-auto"
        role="button"
        aria-label="Resize bottom-right corner"
        tabIndex={0}
      >
        <div className="size-2.5 rounded-xs border-2 border-primary bg-background shadow-xs pointer-events-none" />
      </div>
    </div>
  );
}
