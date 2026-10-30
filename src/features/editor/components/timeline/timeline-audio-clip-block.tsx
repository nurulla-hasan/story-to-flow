"use client";

import * as React from "react";
import { Mic, Music, Radio, Volume2, VolumeX } from "lucide-react";
import { AudioWaveformView } from "@/components/editor/audio-waveform-view";
import type { MediaAssetItem } from "@/lib/media-storage";
import type { AudioTrackRole, TimelineClip } from "@/types/timeline";
import { getClipLod } from "@/lib/timeline-lod";

interface TimelineAudioClipBlockProps {
  clip: TimelineClip;
  asset?: MediaAssetItem;
  trackRole?: AudioTrackRole;
  pixelsPerSecond: number;
  isLocked: boolean;
  isMuted: boolean;
  isSelected: boolean;
  onSelectClip: (clipId: string | null) => void;
  onMoveDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  onLeftTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  onRightTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
}

/** Audio clip surface with waveform/fade visualization, role cue, and trim handles. */
export const TimelineAudioClipBlock = React.memo(function TimelineAudioClipBlock({
  clip, asset, trackRole, pixelsPerSecond, isLocked, isMuted, isSelected,
  onSelectClip, onMoveDrag, onLeftTrimDrag, onRightTrimDrag,
}: TimelineAudioClipBlockProps) {
  const leftPos = clip.startTime * pixelsPerSecond;
  const widthPx = Math.max(4, clip.duration * pixelsPerSecond);
  const lod = getClipLod(widthPx);
  const laneTone = trackRole === "music"
    ? { border: "border-track-music/40", bg: "bg-track-music-soft" }
    : trackRole === "voiceover"
      ? { border: "border-track-voice/40", bg: "bg-track-voice-soft" }
      : { border: "border-track-sfx/40", bg: "bg-track-sfx-soft" };
  const roleIcon = trackRole === "voiceover"
    ? <Mic className="size-3 shrink-0 text-track-voice" />
    : trackRole === "music"
      ? <Music className="size-3 shrink-0 text-track-music" />
      : trackRole === "ambient"
        ? <Radio className="size-3 shrink-0 text-track-sfx" />
        : <Volume2 className="size-3 shrink-0 text-track-sfx" />;

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
        isSelected ? "z-10 border-primary bg-primary/20 ring-2 ring-primary/60 shadow-md" : `${laneTone.border} ${laneTone.bg} hover:border-primary/60`
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

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-1 opacity-50">
        <AudioWaveformView
          blob={asset?.blob || null}
          clipDuration={clip.duration}
          fadeInDuration={clip.fadeInDuration || 0}
          fadeOutDuration={clip.fadeOutDuration || 0}
        />
      </div>

      <div className="pointer-events-none z-10 flex min-w-0 items-center gap-1.5 px-1">
        {roleIcon}
        {lod.name && <span className="truncate text-3xs font-semibold text-foreground">{clip.name}</span>}
        {(clip.volume === 0 || isMuted) && (
          <span title={isMuted ? "Track is muted" : "Clip audio muted"} className="shrink-0">
            <VolumeX className="size-2.5 text-destructive" />
          </span>
        )}
      </div>

      {lod.duration && (
        <span className="pointer-events-none z-10 shrink-0 pl-1 pr-1 font-mono text-3xs tabular-nums text-muted-foreground">
          {clip.duration.toFixed(1)}s
        </span>
      )}

      {!isLocked && (
        <div
          onPointerDown={(event) => onRightTrimDrag(event, clip)}
          className="group/rightHandle absolute top-0 right-0 bottom-0 z-20 flex w-2 items-center justify-center rounded-r-lg bg-primary/25 transition-all hover:w-3 hover:bg-primary cursor-ew-resize"
          title="Drag to trim duration"
        >
          <div className="pointer-events-none h-3 w-0.5 rounded-full bg-primary/70 group-hover/rightHandle:bg-primary-foreground" />
        </div>
      )}
    </div>
  );
});
