"use client";

import * as React from "react";
import { Lock, Mic, Music, Radio, Volume2 } from "lucide-react";
import type { MediaAssetItem } from "@/lib/media-storage";
import type { AudioTrackRole, TimelineClip, TimelineTrack, TrackId } from "@/types/timeline";
import type { RulerTickMark } from "@/lib/ruler-scale";
import { TimelineAudioClipBlock } from "@/features/editor/components/timeline/timeline-audio-clip-block";

interface TimelineAudioTrackLaneProps {
  track: TimelineTrack;
  trackClips: TimelineClip[];
  visibleStartTime?: number;
  visibleEndTime?: number;
  isHydrated: boolean;
  rulerTicks: RulerTickMark[];
  tracksContentWidth: number;
  assetMap: Map<string, MediaAssetItem>;
  pixelsPerSecond: number;
  selectedClipId: string | null;
  onTrackDrop: (event: React.DragEvent<HTMLDivElement>, trackId: TrackId) => void;
  onSelectClip: (clipId: string | null) => void;
  onMoveDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  onLeftTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
  onRightTrimDrag: (event: React.PointerEvent, clip: TimelineClip) => void;
}

/** Audio lane layout with horizontal viewport virtualization; audio clip rendering is delegated to TimelineAudioClipBlock. */
export const TimelineAudioTrackLane = React.memo(function TimelineAudioTrackLane({
  track, trackClips, visibleStartTime, visibleEndTime, isHydrated, rulerTicks, tracksContentWidth, assetMap, pixelsPerSecond, selectedClipId,
  onTrackDrop, onSelectClip, onMoveDrag, onLeftTrimDrag, onRightTrimDrag,
}: TimelineAudioTrackLaneProps) {
  const isLocked = track.locked;
  const isMuted = track.muted;
  const laneTone = track.role === "music"
    ? { border: "border-track-music/40", bg: "bg-track-music-soft", text: "text-track-music" }
    : track.role === "voiceover"
      ? { border: "border-track-voice/40", bg: "bg-track-voice-soft", text: "text-track-voice" }
      : { border: "border-track-sfx/40", bg: "bg-track-sfx-soft", text: "text-track-sfx" };

  const isVirtual = typeof visibleStartTime === "number" && typeof visibleEndTime === "number";

  const visibleClips = React.useMemo(() => {
    if (!isVirtual || trackClips.length <= 15) return trackClips;
    return trackClips.filter(
      (clip) =>
        clip.id === selectedClipId ||
        (clip.startTime + clip.duration >= visibleStartTime && clip.startTime <= visibleEndTime)
    );
  }, [trackClips, selectedClipId, visibleStartTime, visibleEndTime, isVirtual]);

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
      onDragOver={(event) => { if (!isLocked) event.preventDefault(); }}
      onDrop={(event) => onTrackDrop(event, track.id)}
      style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
      className={`relative flex h-full min-w-full items-center overflow-visible px-1 ${isLocked ? "bg-muted/20" : ""} ${isMuted ? "opacity-70" : ""}`}
    >
      {rulerTicks.map((tick) => (
        <div key={`audio_grid_${tick.time}`} style={{ left: `${tick.leftPx}px` }} className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/40" />
      ))}
      {!isHydrated || trackClips.length === 0 ? (
        <div className="pointer-events-none flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/10 text-3xs text-muted-foreground">
          {isLocked ? (
            <span className="flex items-center gap-1 text-warning"><Lock className="size-3" /><span>Track is locked.</span></span>
          ) : (
            <span className="flex items-center gap-1">{getAudioRoleIcon(track.role)}<span>{getAudioRolePlaceholder(track.role)}</span></span>
          )}
        </div>
      ) : (
        visibleClips.map((clip) => (
          <TimelineAudioClipBlock
            key={clip.id}
            clip={clip}
            asset={assetMap.get(clip.assetId)}
            trackRole={track.role}
            pixelsPerSecond={pixelsPerSecond}
            isLocked={isLocked}
            isMuted={isMuted}
            isSelected={clip.id === selectedClipId}
            onSelectClip={onSelectClip}
            onMoveDrag={onMoveDrag}
            onLeftTrimDrag={onLeftTrimDrag}
            onRightTrimDrag={onRightTrimDrag}
          />
        ))
      )}
    </div>
  );
});
