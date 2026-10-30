"use client";

import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers,
  Lock,
  Mic,
  Music,
  Pencil,
  Radio,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { AudioTrackRole, TrackId, TimelineTrack } from "@/types/timeline";

interface TimelineTrackSidebarHeaderProps {
  track: TimelineTrack;
  clipCount: number;
  isFirst: boolean;
  isLast: boolean;
  editingTrackId: string | null;
  editingTrackName: string;
  onEditingTrackNameChange: (name: string) => void;
  onFinishRename: (trackId: TrackId) => void;
  onCancelRename: () => void;
  onStartRename: (track: TimelineTrack) => void;
  onToggleVisibility: (trackId: TrackId) => void;
  onToggleMute: (trackId: TrackId) => void;
  onToggleLock: (trackId: TrackId) => void;
  onReorderTrack: (trackId: TrackId, direction: "up" | "down") => void;
  onDeleteTrack: (track: TimelineTrack) => void;
}

export function TimelineTrackSidebarHeader({
  track,
  clipCount,
  isFirst,
  isLast,
  editingTrackId,
  editingTrackName,
  onEditingTrackNameChange,
  onFinishRename,
  onCancelRename,
  onStartRename,
  onToggleVisibility,
  onToggleMute,
  onToggleLock,
  onReorderTrack,
  onDeleteTrack,
}: TimelineTrackSidebarHeaderProps) {
  const isVisual = track.type === "visual";
  const roleTone = isVisual
    ? { rail: "border-l-track-video", tile: "bg-track-video-soft text-track-video" }
    : track.role === "voiceover"
      ? { rail: "border-l-track-voice", tile: "bg-track-voice-soft text-track-voice" }
      : track.role === "music"
        ? { rail: "border-l-track-music", tile: "bg-track-music-soft text-track-music" }
        : { rail: "border-l-track-sfx", tile: "bg-track-sfx-soft text-track-sfx" };

  const trackIconRole: AudioTrackRole | undefined = track.role;

  return (
    <div
      className={`group/trackhead flex h-11 items-center justify-between gap-1 border-b border-l-2 border-border px-2 transition-colors ${roleTone.rail} ${
        track.locked ? "bg-muted/40" : "bg-card hover:bg-muted/30"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div className={`flex size-6 shrink-0 items-center justify-center rounded-md ${roleTone.tile}`}>
          {isVisual ? (
            <Layers className="size-3" />
          ) : trackIconRole === "voiceover" ? (
            <Mic className="size-3" />
          ) : trackIconRole === "music" ? (
            <Music className="size-3" />
          ) : trackIconRole === "ambient" ? (
            <Radio className="size-3" />
          ) : (
            <Volume2 className="size-3" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {editingTrackId === track.id ? (
            <input
              type="text"
              value={editingTrackName}
              onChange={(e) => onEditingTrackNameChange(e.target.value)}
              onBlur={() => onFinishRename(track.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onFinishRename(track.id);
                if (e.key === "Escape") onCancelRename();
              }}
              autoFocus
              className="h-5 w-24 text-2xs font-semibold px-1 rounded border border-primary bg-background text-foreground outline-hidden"
            />
          ) : (
            <div className="flex items-center gap-1 group/name">
              <p
                onDoubleClick={() => onStartRename(track)}
                className="max-w-32 cursor-pointer truncate text-2xs font-semibold leading-tight text-foreground"
                title="Double-click to rename"
              >
                {track.name}
              </p>
              {!track.locked && (
                <button
                  type="button"
                  onClick={() => onStartRename(track)}
                  className="opacity-0 group-hover/name:opacity-100 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-opacity"
                  title="Rename track"
                >
                  <Pencil className="size-2.5" />
                </button>
              )}
            </div>
          )}
          <p className="text-3xs text-muted-foreground truncate">
            {isVisual ? (track.order === 0 ? "Overlay" : "Base") : track.role || "Audio"}{" "}
            • {clipCount} clips
          </p>
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {isVisual ? (
          <button
            type="button"
            onClick={() => onToggleVisibility(track.id)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
            title={track.visible ? "Hide visual track" : "Show visual track"}
            aria-label={track.visible ? "Hide visual track" : "Show visual track"}
          >
            {track.visible ? <Eye className="size-3" /> : <EyeOff className="size-3 text-destructive" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggleMute(track.id)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
            title={track.muted ? "Unmute audio track" : "Mute audio track"}
            aria-label={track.muted ? "Unmute audio track" : "Mute audio track"}
          >
            {track.muted ? <VolumeX className="size-3 text-destructive" /> : <Volume2 className="size-3" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => onToggleLock(track.id)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
          title={track.locked ? "Unlock track" : "Lock track"}
          aria-label={track.locked ? "Unlock track" : "Lock track"}
        >
          {track.locked ? (
            <Lock className="size-3 text-warning" />
          ) : (
            <Unlock className="size-3 text-muted-foreground/40 hover:text-foreground" />
          )}
        </button>

        <div className="flex max-w-0 items-center gap-0.5 overflow-hidden opacity-0 transition-all duration-150 group-focus-within/trackhead:max-w-24 group-focus-within/trackhead:opacity-100 group-hover/trackhead:max-w-24 group-hover/trackhead:opacity-100">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onReorderTrack(track.id, "up")}
            className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
            title="Move track up"
            aria-label="Move track up"
          >
            <ChevronUp className="size-3" />
          </button>

          <button
            type="button"
            disabled={isLast}
            onClick={() => onReorderTrack(track.id, "down")}
            className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
            title="Move track down"
            aria-label="Move track down"
          >
            <ChevronDown className="size-3" />
          </button>

          <button
            type="button"
            disabled={track.locked}
            onClick={() => onDeleteTrack(track)}
            className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-20"
            title={track.locked ? "Cannot delete locked track" : "Delete track"}
            aria-label="Delete track"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
