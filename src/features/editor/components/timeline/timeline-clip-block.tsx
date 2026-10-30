"use client";

import * as React from "react";
import { Video, VolumeX } from "lucide-react";
import type { MediaAssetItem } from "@/lib/media-storage";
import type { TimelineClip } from "@/types/timeline";
import { getClipLod } from "@/lib/timeline-lod";

interface TimelineClipBlockProps {
  clip: TimelineClip;
  asset?: MediaAssetItem;
  pixelsPerSecond: number;
  isLocked: boolean;
  isSelected: boolean;
  onSelectClip: (clipId: string | null) => void;
  onMoveDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  onLeftTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  onRightTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
}

/** A visual clip's compact timeline surface, thumbnail, and trim handles. */
export const TimelineClipBlock = React.memo(function TimelineClipBlock({
  clip, asset, pixelsPerSecond, isLocked, isSelected, onSelectClip,
  onMoveDrag, onLeftTrimDrag, onRightTrimDrag,
}: TimelineClipBlockProps) {
  const leftPos = clip.startTime * pixelsPerSecond;
  const widthPx = Math.max(4, clip.duration * pixelsPerSecond);
  const lod = getClipLod(widthPx);

  return (
    <div
      data-clip-id={clip.id}
      data-testid="timeline-clip"
      style={{ left: `${leftPos}px`, width: `${widthPx}px` }}
      onPointerDown={(event) => {
        if (!isLocked) onMoveDrag(event, clip);
        else onSelectClip(clip.id);
      }}
      className={`group absolute flex h-9 items-center justify-between overflow-hidden rounded-lg border px-2 shadow-xs transition-[box-shadow,background-color,border-color] select-none ${
        isLocked ? "cursor-not-allowed opacity-90" : "cursor-grab active:cursor-grabbing"
      } ${
        isSelected
          ? "z-10 border-primary bg-primary/15 ring-2 ring-primary/60 shadow-md"
          : "border-track-video/40 bg-track-video-soft hover:border-track-video"
      }`}
    >
      {!isLocked && (
        <div
          onPointerDown={(event) => onLeftTrimDrag(event, clip)}
          className="group/leftHandle absolute top-0 bottom-0 left-0 z-20 flex w-2 items-center justify-center rounded-l-lg bg-primary/25 transition-all hover:w-3 hover:bg-primary cursor-ew-resize"
          title="Drag to trim start (in-point)"
        >
          <div className="pointer-events-none h-3 w-0.5 rounded-full bg-primary/70 group-hover/leftHandle:bg-primary-foreground" />
        </div>
      )}

      <div className="pointer-events-none flex min-w-0 items-center gap-1.5 px-1">
        {lod.thumbnail &&
          (asset?.thumbnailUrl || asset?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.thumbnailUrl || asset.url}
              alt={clip.name}
              className="size-6 shrink-0 rounded object-cover ring-1 ring-border"
            />
          ) : (
            <Video className="size-3 shrink-0 text-track-video" />
          ))}
        {lod.name && <span className="truncate text-3xs font-semibold text-foreground">{clip.name}</span>}
        {clip.volume === 0 && (
          <span title="Scene audio muted" className="shrink-0">
            <VolumeX className="size-2.5 text-destructive" />
          </span>
        )}
      </div>

      {lod.duration && (
        <span className="pointer-events-none shrink-0 pl-1 pr-1 font-mono text-3xs tabular-nums text-muted-foreground">
          {clip.duration.toFixed(1)}s
        </span>
      )}

      {!isLocked && (
        <div
          onPointerDown={(event) => onRightTrimDrag(event, clip)}
          className="group/rightHandle absolute top-0 right-0 bottom-0 z-20 flex w-2 items-center justify-center rounded-r-lg bg-primary/25 transition-all hover:w-3 hover:bg-primary cursor-ew-resize"
          title="Drag to trim end (duration)"
        >
          <div className="pointer-events-none h-3 w-0.5 rounded-full bg-primary/70 group-hover/rightHandle:bg-primary-foreground" />
        </div>
      )}
    </div>
  );
});
