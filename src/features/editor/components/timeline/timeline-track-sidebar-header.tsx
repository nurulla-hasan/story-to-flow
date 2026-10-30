"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Layers, Lock, Mic, Music, Pencil, Radio, Trash2, Unlock, Volume2, VolumeX } from "lucide-react";
import type { TimelineClip, TimelineTrack, TrackId } from "@/types/timeline";

interface TimelineTrackSidebarHeaderProps {
  track: TimelineTrack;
  trackClips: TimelineClip[];
  editingTrackId: string | null;
  editingTrackName: string;
  setEditingTrackId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingTrackName: React.Dispatch<React.SetStateAction<string>>;
  orderedVisualTracks: TimelineTrack[];
  orderedAudioTracks: TimelineTrack[];
  startRename: (track: TimelineTrack) => void;
  finishRename: (trackId: TrackId) => void;
  toggleTrackVisibility: (trackId: TrackId) => void;
  toggleTrackMute: (trackId: TrackId) => void;
  toggleTrackLock: (trackId: TrackId) => void;
  reorderTrack: (trackId: TrackId, direction: "up" | "down") => void;
  handleDeleteClick: (track: TimelineTrack) => void;
}

/** Sidebar controls for renaming, locking, ordering, muting, visibility, and deleting one track. */
export function TimelineTrackSidebarHeader({
  track, trackClips, editingTrackId, editingTrackName, setEditingTrackId, setEditingTrackName,
  orderedVisualTracks, orderedAudioTracks, startRename, finishRename, toggleTrackVisibility,
  toggleTrackMute, toggleTrackLock, reorderTrack, handleDeleteClick,
}: TimelineTrackSidebarHeaderProps) {
  const isVisual = track.type === "visual";
  const visualIndex = orderedVisualTracks.findIndex((item) => item.id === track.id);
  const isFirstVisual = visualIndex === 0;
  const isLastVisual = visualIndex === orderedVisualTracks.length - 1;
  const audioIndex = orderedAudioTracks.findIndex((item) => item.id === track.id);
  const isFirstAudio = audioIndex === 0;
  const isLastAudio = audioIndex === orderedAudioTracks.length - 1;
  const isFirst = isVisual ? isFirstVisual : isFirstAudio;
  const isLast = isVisual ? isLastVisual : isLastAudio;

  const roleTone = isVisual
    ? { rail: "border-l-track-video", tile: "bg-track-video-soft text-track-video" }
    : track.role === "voiceover"
      ? { rail: "border-l-track-voice", tile: "bg-track-voice-soft text-track-voice" }
      : track.role === "music"
        ? { rail: "border-l-track-music", tile: "bg-track-music-soft text-track-music" }
        : { rail: "border-l-track-sfx", tile: "bg-track-sfx-soft text-track-sfx" };

  return (
          <div
                    className={`group/trackhead flex h-11 items-center justify-between gap-1 border-b border-l-2 border-border px-2 transition-colors ${roleTone.rail} ${
              track.locked ? "bg-muted/40" : "bg-card hover:bg-muted/30"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <div
                className={`flex size-6 shrink-0 items-center justify-center rounded-md ${roleTone.tile}`}
              >
                {isVisual ? (
                  <Layers className="size-3" />
                ) : track.role === "voiceover" ? (
                  <Mic className="size-3" />
                ) : track.role === "music" ? (
                  <Music className="size-3" />
                ) : track.role === "ambient" ? (
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
                    onChange={(e) => setEditingTrackName(e.target.value)}
                    onBlur={() => finishRename(track.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finishRename(track.id);
                      if (e.key === "Escape") setEditingTrackId(null);
                    }}
                    autoFocus
                    className="h-5 w-24 text-2xs font-semibold px-1 rounded border border-primary bg-background text-foreground outline-hidden"
                  />
                ) : (
                  <div className="flex items-center gap-1 group/name">
                    <p
                      onDoubleClick={() => startRename(track)}
                      className="max-w-32 cursor-pointer truncate text-2xs font-semibold leading-tight text-foreground"
                      title="Double-click to rename"
                    >
                      {track.name}
                    </p>
                    {!track.locked && (
                      <button
                        type="button"
                        onClick={() => startRename(track)}
                        className="opacity-0 group-hover/name:opacity-100 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-opacity"
                        title="Rename track"
                      >
                        <Pencil className="size-2.5" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-3xs text-muted-foreground truncate">
                  {isVisual
                    ? track.order === 0
                      ? "Overlay"
                      : "Base"
                    : track.role || "Audio"}{" "}
                  • {trackClips.length} clips
                </p>
              </div>
            </div>
    
            {/* Per-track controls */}
            <div className="flex items-center gap-0.5 shrink-0">
              {isVisual ? (
                <button
                  type="button"
                  onClick={() => toggleTrackVisibility(track.id)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                  title={track.visible ? "Hide visual track" : "Show visual track"}
                  aria-label={track.visible ? "Hide visual track" : "Show visual track"}
                >
                  {track.visible ? <Eye className="size-3" /> : <EyeOff className="size-3 text-destructive" />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleTrackMute(track.id)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                  title={track.muted ? "Unmute audio track" : "Mute audio track"}
                  aria-label={track.muted ? "Unmute audio track" : "Mute audio track"}
                >
                  {track.muted ? <VolumeX className="size-3 text-destructive" /> : <Volume2 className="size-3" />}
                </button>
              )}
    
              <button
                type="button"
                onClick={() => toggleTrackLock(track.id)}
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
                  onClick={() => reorderTrack(track.id, "up")}
                  className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                  title="Move track up"
                  aria-label="Move track up"
                >
                  <ChevronUp className="size-3" />
                </button>
    
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => reorderTrack(track.id, "down")}
                  className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                  title="Move track down"
                  aria-label="Move track down"
                >
                  <ChevronDown className="size-3" />
                </button>
    
                <button
                  type="button"
                  disabled={track.locked}
                  onClick={() => handleDeleteClick(track)}
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
