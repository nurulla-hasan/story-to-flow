"use client";

import * as React from "react";
import { Lock, Mic, Music, Radio, Volume2, VolumeX } from "lucide-react";
import type { TimelineClip, TimelineTrack, TrackId, AudioTrackRole } from "@/types/timeline";
import type { MediaAssetItem } from "@/lib/media-storage";
import type { RulerTickMark } from "@/lib/ruler-scale";
import { getClipLod } from "@/lib/timeline-lod";
import { AudioWaveformView } from "@/components/editor/audio-waveform-view";

interface TimelineAudioTrackLaneProps {
  track: TimelineTrack;
  trackClips: TimelineClip[];
  tracksContentWidth: number;
  isHydrated: boolean;
  rulerTicks: RulerTickMark[];
  pxPerSec: number;
  selectedClipId: string | null;
  assetMap: ReadonlyMap<string, MediaAssetItem>;
  handleTrackDrop: (event: React.DragEvent, trackId: TrackId) => void;
  selectClip: (clipId: string | null) => void;
  startMoveDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  startLeftTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  startRightTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
}

export function TimelineAudioTrackLane({
  track,
  trackClips,
  tracksContentWidth,
  isHydrated,
  rulerTicks,
  pxPerSec,
  selectedClipId,
  assetMap,
  handleTrackDrop,
  selectClip,
  startMoveDrag,
  startLeftTrimDrag,
  startRightTrimDrag,
}: TimelineAudioTrackLaneProps) {
    const isLocked = track.locked;
    const isMuted = track.muted;

    const laneTone =
      track.role === "music"
        ? { border: "border-track-music/40", bg: "bg-track-music-soft", text: "text-track-music" }
        : track.role === "voiceover"
          ? { border: "border-track-voice/40", bg: "bg-track-voice-soft", text: "text-track-voice" }
          : { border: "border-track-sfx/40", bg: "bg-track-sfx-soft", text: "text-track-sfx" };

    const getAudioRoleIcon = (role?: AudioTrackRole) => {
      if (role === "voiceover") return <Mic className={`size-3 shrink-0 ${laneTone.text}`} />;
      if (role === "music") return <Music className={`size-3 shrink-0 ${laneTone.text}`} />;
      if (role === "ambient") return <Radio className={`size-3 shrink-0 ${laneTone.text}`} />;
      return <Volume2 className={`size-3 shrink-0 ${laneTone.text}`} />;
    };

    const getAudioRolePlaceholder = (role?: AudioTrackRole) => {
      if (role === "voiceover") return "Drag narration or voiceover audio here to align visual scene pacing.";
      if (role === "music") return "Drop background music tracks here.";
      if (role === "sfx") return "Drop sound effects and audio clips here.";
      if (role === "ambient") return "Drop ambient environment sounds here.";
      return "Drop audio clips here.";
    };

    return (
      <div
        onDragOver={(e) => {
          if (!isLocked) e.preventDefault();
        }}
        onDrop={(e) => handleTrackDrop(e, track.id)}
        style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
        className={`relative flex h-full min-w-full items-center overflow-visible px-1 ${
          isLocked ? "bg-muted/20" : ""
        } ${isMuted ? "opacity-70" : ""}`}
      >
        {/* Full-width vertical grid lines across audio lane */}
        {rulerTicks.map((tick) => (
          <div
            key={`audio_grid_${tick.time}`}
            style={{ left: `${tick.leftPx}px` }}
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/40"
          />
        ))}

        {!isHydrated || trackClips.length === 0 ? (
          <div className="pointer-events-none flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/10 text-3xs text-muted-foreground">
            {isLocked ? (
              <span className="flex items-center gap-1 text-warning">
                <Lock className="size-3" />
                <span>Track is locked.</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                {getAudioRoleIcon(track.role)}
                <span>{getAudioRolePlaceholder(track.role)}</span>
              </span>
            )}
          </div>
        ) : (
          trackClips.map((clip) => {
            const isSelected = clip.id === selectedClipId;
            const leftPos = clip.startTime * pxPerSec;
            const widthPx = Math.max(4, clip.duration * pxPerSec);
            const asset = assetMap.get(clip.assetId);
            const lod = getClipLod(widthPx);

            return (
              <div
                key={clip.id}
                data-clip-id={clip.id}
                data-testid="timeline-clip"
                style={{
                  left: `${leftPos}px`,
                  width: `${widthPx}px`,
                }}
                onPointerDown={(e) => {
                  if (!isLocked) startMoveDrag(e, clip);
                  else selectClip(clip.id);
                }}
                className={`group absolute flex h-9 items-center justify-between overflow-hidden rounded-lg border px-2 shadow-xs transition-[box-shadow,background-color,border-color] select-none ${
                  isLocked ? "cursor-not-allowed opacity-90" : "cursor-grab active:cursor-grabbing"
                } ${
                  isSelected
                    ? "z-10 border-primary bg-primary/20 ring-2 ring-primary/60 shadow-md"
                    : `${laneTone.border} ${laneTone.bg} hover:border-primary/60`
                }`}
              >
                {/* Left-edge trim handle */}
                {!isLocked && (
                  <div
                    onPointerDown={(e) => startLeftTrimDrag(e, clip)}
                    className="group/leftHandle absolute top-0 bottom-0 left-0 z-20 flex w-2 items-center justify-center rounded-l-lg bg-primary/25 transition-all hover:w-3 hover:bg-primary cursor-ew-resize"
                    title="Drag to trim start (in-point)"
                  >
                    <div className="pointer-events-none h-3 w-0.5 rounded-full bg-primary/70 group-hover/leftHandle:bg-primary-foreground" />
                  </div>
                )}

                {/* Audio Waveform Visualization with Fade-In / Fade-Out Ramps */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-1 opacity-50">
                  <AudioWaveformView
                    blob={asset?.blob || null}
                    clipDuration={clip.duration}
                    fadeInDuration={clip.fadeInDuration || 0}
                    fadeOutDuration={clip.fadeOutDuration || 0}
                  />
                </div>

                <div className="pointer-events-none z-10 flex min-w-0 items-center gap-1.5 px-1">
                  {getAudioRoleIcon(track.role)}
                  {lod.name && (
                    <span className="truncate text-3xs font-semibold text-foreground">
                      {clip.name}
                    </span>
                  )}
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

                {/* Right-edge trim handle */}
                {!isLocked && (
                  <div
                    onPointerDown={(e) => startRightTrimDrag(e, clip)}
                    className="group/rightHandle absolute top-0 right-0 bottom-0 z-20 flex w-2 items-center justify-center rounded-r-lg bg-primary/25 transition-all hover:w-3 hover:bg-primary cursor-ew-resize"
                    title="Drag to trim duration"
                  >
                    <div className="pointer-events-none h-3 w-0.5 rounded-full bg-primary/70 group-hover/rightHandle:bg-primary-foreground" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
}
