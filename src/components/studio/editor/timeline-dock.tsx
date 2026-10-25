"use client";

import * as React from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Clock,
  Copy,
  Film,
  FlipHorizontal,
  Headphones,
  ImagePlus,
  Loader2,
  Maximize2,
  Music,
  Plus,
  Scissors,
  Sliders,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { SFX_PRESETS, type StudioClip, type StudioProject } from "../types";
import {
  DURATION_PRESETS,
  formatSec,
  getClipSfxConfig,
  RULER_HEIGHT,
  TRACK_HEIGHT,
  type ClipTiming,
  type TransitionModalState,
} from "./editor-shared";

interface TimelineDockProps {
  project: StudioProject;
  onUpdateProject: (patch: Partial<StudioProject>) => void;
  editingClip: StudioClip | null;
  clipTimings: ClipTiming[];
  totalDuration: number;
  effectiveAudioDuration: number;
  durationDeficit: number;
  clipsNeeded: number;
  isGeneratingMore: boolean;
  currentTime: number;
  activeClipIndex: number;
  selectedClipId: string | null;
  sfxCount: number;
  bgmLabel: string;
  bgmVolume: number;
  isMuted: boolean;
  pxPerSec: number;
  tickStep: number;
  labelStep: number;
  timelineWidth: number;
  voiceoverWidth: number;
  customDuration: string;
  resizingClip: { id: string; duration: number } | null;
  timelineScrollRef: React.RefObject<HTMLDivElement | null>;
  waveformCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  audioInputRef: React.RefObject<HTMLInputElement | null>;
  bgmInputRef: React.RefObject<HTMLInputElement | null>;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedClipId: React.Dispatch<React.SetStateAction<string | null>>;
  setPxPerSec: React.Dispatch<React.SetStateAction<number>>;
  setCustomDuration: React.Dispatch<React.SetStateAction<string>>;
  setActiveTransitionModal: React.Dispatch<React.SetStateAction<TransitionModalState | null>>;
  seekTo: (time: number) => void;
  beginScrub: (event: React.PointerEvent<HTMLDivElement>) => void;
  startResizing: (event: React.MouseEvent, clipId: string, edge: "left" | "right") => void;
  isAllSameDuration: (duration: number) => boolean;
  handleGenerateMoreScenes: () => void;
  handleAutoFillClips: () => void;
  handleAutoSyncAudio: () => void;
  handleSetAllClipsDuration: (duration: number) => void;
  handleFitTimeline: () => void;
  handleSplitAtPlayhead: () => void;
  handleDuplicateActiveClip: () => void;
  handleDeleteActiveClip: () => void;
  handleToggleFlip: (clip: StudioClip) => void;
  handleAddNewEmptyClip: () => void;
  handleOpenSfxModal: (clip: StudioClip) => void;
}

export function TimelineDock({
  project,
  onUpdateProject,
  editingClip,
  clipTimings,
  totalDuration,
  effectiveAudioDuration,
  durationDeficit,
  clipsNeeded,
  isGeneratingMore,
  currentTime,
  activeClipIndex,
  selectedClipId,
  sfxCount,
  bgmLabel,
  bgmVolume,
  isMuted,
  pxPerSec,
  tickStep,
  labelStep,
  timelineWidth,
  voiceoverWidth,
  customDuration,
  resizingClip,
  timelineScrollRef,
  waveformCanvasRef,
  audioInputRef,
  bgmInputRef,
  setIsMuted,
  setSelectedClipId,
  setPxPerSec,
  setCustomDuration,
  setActiveTransitionModal,
  seekTo,
  beginScrub,
  startResizing,
  isAllSameDuration,
  handleGenerateMoreScenes,
  handleAutoFillClips,
  handleAutoSyncAudio,
  handleSetAllClipsDuration,
  handleFitTimeline,
  handleSplitAtPlayhead,
  handleDuplicateActiveClip,
  handleDeleteActiveClip,
  handleToggleFlip,
  handleAddNewEmptyClip,
  handleOpenSfxModal,
}: TimelineDockProps) {
  return (
    <div className="shrink-0 border-t border-border bg-editor-chrome">
      {durationDeficit >= 2.5 ? (
        <div className="m-3 mb-0 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning-subtle p-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning">
              <AlertTriangle className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-2xs font-bold text-foreground">
                Voiceover is longer than the images ({formatSec(effectiveAudioDuration)} vs{" "}
                {formatSec(totalDuration)})
              </p>
              <p className="text-3xs text-muted-foreground">
                Images end {durationDeficit.toFixed(0)}s early. Add ~{clipsNeeded} more scenes or
                auto-fill to match.
              </p>
            </div>
          </div>
    
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              disabled={isGeneratingMore}
              onClick={handleGenerateMoreScenes}
              className="h-7 gap-1.5 text-2xs font-semibold"
            >
              {isGeneratingMore ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>Generate {clipsNeeded} more</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAutoFillClips}
              className="h-7 gap-1 text-2xs"
              title="Duplicate existing frames with varied camera motion"
            >
              <span>Auto-fill</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleAutoSyncAudio}
              className="h-7 gap-1 text-2xs text-muted-foreground"
            >
              <span>Adjust pacing</span>
            </Button>
          </div>
        </div>
      ) : null}
    
      {/* Timeline toolbar */}
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          <div className="hidden shrink-0 items-center gap-1 sm:flex">
            <span className="flex items-center gap-1 text-3xs font-bold tracking-wider text-muted-foreground uppercase">
              <Clock className="size-3 text-primary" />
              Length
            </span>
            {DURATION_PRESETS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => handleSetAllClipsDuration(seconds)}
                className={cn(
                  "rounded-md px-1.5 py-1 font-mono text-3xs transition-colors",
                  isAllSameDuration(seconds)
                    ? "bg-primary font-bold text-primary-foreground shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground",
                )}
                title={`Set every clip to ${seconds}s`}
              >
                {seconds.toFixed(1)}s
              </button>
            ))}

            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0.5}
                max={30}
                step={0.5}
                value={customDuration}
                onChange={(event) => setCustomDuration(event.target.value)}
                className="h-7 w-14 rounded-md border border-border bg-background px-1.5 text-center font-mono text-3xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                aria-label="Custom duration for every clip"
              />
              <button
                type="button"
                onClick={() => handleSetAllClipsDuration(parseFloat(customDuration) || 5.0)}
                className="h-7 rounded-md border border-border bg-card px-2 text-3xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="mx-0.5 hidden h-5 w-px shrink-0 bg-border lg:block" />

          <div className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5">
            <button
              type="button"
              onClick={() => setPxPerSec((zoom) => Math.max(20, zoom - 5))}
              className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Zoom out timeline"
            >
              <ZoomOut className="size-3" />
            </button>
            <input
              type="range"
              min={20}
              max={120}
              step={5}
              value={pxPerSec}
              onChange={(event) => setPxPerSec(parseInt(event.target.value, 10))}
              className="h-1.5 w-20 cursor-pointer accent-primary"
              aria-label="Timeline zoom"
            />
            <button
              type="button"
              onClick={() => setPxPerSec((zoom) => Math.min(120, zoom + 5))}
              className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Zoom in timeline"
            >
              <ZoomIn className="size-3" />
            </button>
            <span className="hidden font-mono text-3xs text-muted-foreground md:inline">
              {pxPerSec}px/s
            </span>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleFitTimeline}
            className="hidden h-7 shrink-0 gap-1 px-2 text-2xs sm:flex"
            title="Fit the whole timeline on screen"
          >
            <Maximize2 className="size-3 text-primary" />
            <span className="hidden lg:inline">Fit</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setActiveTransitionModal({
                clipIndex: null,
                type: "white-flash",
                duration: 0.4,
              })
            }
            className="hidden h-7 shrink-0 gap-1 px-2 text-2xs font-semibold sm:flex"
            title="Apply a transition across every split"
          >
            <Zap className="size-3 text-primary" />
            <span className="hidden lg:inline">Transitions</span>
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleSplitAtPlayhead}
            className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Split the clip under the playhead"
          >
            <Scissors className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDuplicateActiveClip}
            className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Duplicate the selected clip"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDeleteActiveClip}
            className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Delete the selected clip"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    
      {/* Tracks */}
      <div className="flex items-stretch overflow-hidden border-t border-border bg-editor-chrome">
        {/* Sticky track headers */}
        <div className="w-20 shrink-0 border-r border-border bg-surface-subtle select-none sm:w-26">
          <div
            className="flex items-center justify-between gap-1 border-b border-border/60 px-2"
            style={{ height: RULER_HEIGHT }}
          >
            <span className="text-3xs font-bold tracking-wider text-muted-foreground uppercase">
              Tracks
            </span>
          </div>
    
          <div
            className="flex flex-col justify-center gap-1 border-b border-border/60 bg-track-video-soft px-2"
            style={{ height: TRACK_HEIGHT.video }}
          >
            <span className="flex min-w-0 items-center gap-1 text-3xs font-semibold text-track-video">
              <Film className="size-3 shrink-0" />
              <span className="truncate">Video</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => editingClip && handleToggleFlip(editingClip)}
                className="flex size-5 items-center justify-center rounded text-track-video/80 transition-colors hover:bg-card/60 hover:text-track-video"
                title="Flip the selected clip"
              >
                <FlipHorizontal className="size-2.5" />
              </button>
              <button
                type="button"
                onClick={handleAddNewEmptyClip}
                className="flex size-5 items-center justify-center rounded text-track-video/80 transition-colors hover:bg-card/60 hover:text-track-video"
                title="Add an empty image clip"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>
    
          <div
            className="flex flex-col justify-center gap-1 border-b border-border/60 bg-track-voice-soft px-2"
            style={{ height: TRACK_HEIGHT.voice }}
          >
            <span className="flex min-w-0 items-center gap-1 text-3xs font-semibold text-track-voice">
              <Music className="size-3 shrink-0" />
              <span className="truncate">Voice</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMuted((muted) => !muted)}
                className="flex size-5 items-center justify-center rounded text-track-voice/80 transition-colors hover:bg-card/60 hover:text-track-voice"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="size-2.5" /> : <Volume2 className="size-2.5" />}
              </button>
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="flex size-5 items-center justify-center rounded text-track-voice/80 transition-colors hover:bg-card/60 hover:text-track-voice"
                title="Import voiceover audio"
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>
    
          <div
            className="hidden items-center justify-between gap-1 border-b border-border/60 bg-track-sfx-soft px-2 sm:flex"
            style={{ height: TRACK_HEIGHT.sfx }}
          >
            <span className="flex min-w-0 items-center gap-1 text-3xs font-semibold text-track-sfx">
              <Sparkles className="size-3 shrink-0" />
              <span className="truncate">SFX</span>
              {sfxCount > 0 ? (
                <span className="rounded-full bg-card/70 px-1 font-mono text-3xs">
                  {sfxCount}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => editingClip && handleOpenSfxModal(editingClip)}
              className="flex size-5 items-center justify-center rounded text-track-sfx/80 transition-colors hover:bg-card/60 hover:text-track-sfx"
              title="Add a sound effect to the selected clip"
            >
              <Plus className="size-3" />
            </button>
          </div>
    
          <div
            className="hidden items-center justify-between gap-1 border-b border-border/60 bg-track-music-soft px-2 sm:flex"
            style={{ height: TRACK_HEIGHT.music }}
          >
            <span className="flex min-w-0 items-center gap-1 text-3xs font-semibold text-track-music">
              <Headphones className="size-3 shrink-0" />
              <span className="truncate">Music</span>
            </span>
            <button
              type="button"
              onClick={() =>
                project.bgmUrl
                  ? onUpdateProject({ bgmVolume: bgmVolume > 0 ? 0 : 0.2 })
                  : bgmInputRef.current?.click()
              }
              className="flex size-5 items-center justify-center rounded text-track-music/80 transition-colors hover:bg-card/60 hover:text-track-music"
              title={project.bgmUrl ? "Toggle music volume" : "Upload background music"}
            >
              {project.bgmUrl ? <Volume2 className="size-2.5" /> : <Plus className="size-3" />}
            </button>
          </div>
        </div>
    
        {/* Scrollable tracks */}
        <div
          ref={timelineScrollRef}
          className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div className="relative min-w-full" style={{ width: `${timelineWidth}px` }}>
            {/* Ruler */}
            <div
              className="relative cursor-pointer border-b border-border/60 bg-surface-muted/50"
              style={{ height: RULER_HEIGHT }}
              onPointerDown={beginScrub}
              title="Click or drag to scrub"
            >
              {Array.from(
                { length: Math.ceil(totalDuration / tickStep) + 2 },
                (_, index) => {
                  const seconds = index * tickStep;
                  const isMajor = seconds % labelStep === 0;
                  return (
                    <div
                      key={seconds}
                      className="absolute top-0 bottom-0"
                      style={{ left: `${seconds * pxPerSec}px` }}
                    >
                      <div
                        className={cn(
                          "w-px",
                          isMajor ? "h-2.5 bg-muted-foreground/50" : "h-1.5 bg-border",
                        )}
                      />
                      {isMajor ? (
                        <span className="absolute top-0 left-1 font-mono text-3xs whitespace-nowrap text-muted-foreground">
                          {formatSec(seconds)}
                        </span>
                      ) : null}
                    </div>
                  );
                },
              )}
            </div>
    
            {/* Video track */}
            <div
              className="relative overflow-hidden border-b border-border/60"
              style={{ height: TRACK_HEIGHT.video }}
              onPointerDown={beginScrub}
            >
              <div className="flex h-full items-stretch">
                {clipTimings.map(({ clip, start }, index) => {
                  const clipDuration = clip.duration || 3;
                  const clipWidth = Math.max(44, clipDuration * pxPerSec);
                  const isSelected = clip.id === selectedClipId;
                  const isActive = index === activeClipIndex;
                  const sfx = getClipSfxConfig(clip);
                  const hasTransition = Boolean(
                    clip.transition && clip.transition.type !== "none",
                  );
                  const progress = Math.min(
                    1,
                    Math.max(0, (currentTime - start) / Math.max(0.1, clipDuration)),
                  );
    
                  return (
                    <React.Fragment key={clip.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedClipId(clip.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            setSelectedClipId(clip.id);
                            seekTo(start);
                          }
                        }}
                        style={{ width: `${clipWidth}px` }}
                        className={cn(
                          "group/clip relative h-full shrink-0 cursor-pointer overflow-hidden border-y border-r border-border/70 bg-card transition-shadow first:border-l",
                          isSelected
                            ? "z-20 ring-2 ring-primary"
                            : isActive
                              ? "ring-1 ring-primary/40"
                              : "hover:brightness-105",
                        )}
                        title={`Clip #${clip.index} · ${clipDuration.toFixed(1)}s · ${clip.motion || "zoom-in"}`}
                      >
                        {clip.imageUrl ? (
                          <Image
                            src={clip.imageUrl}
                            alt={`Clip ${clip.index}`}
                            fill
                            unoptimized
                            sizes="220px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground/70">
                            <ImagePlus className="size-4" />
                            <span className="text-3xs">No image</span>
                          </div>
                        )}
    
                        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-editor-screen/55 via-transparent to-editor-screen/35" />
    
                        <div className="pointer-events-none absolute inset-x-1 top-1 flex items-start justify-between gap-1">
                          <span className="rounded border border-border/60 bg-card/90 px-1 py-0.5 font-mono text-3xs font-bold text-foreground shadow-xs backdrop-blur-sm">
                            {clipDuration.toFixed(1)}s
                          </span>
                          {sfx ? (
                            <span className="rounded border border-track-sfx/40 bg-card/90 px-1 py-0.5 text-3xs shadow-xs backdrop-blur-sm">
                              {sfx.type === "custom"
                                ? "📁"
                                : (SFX_PRESETS.find((p) => p.type === sfx.type)?.emoji ?? "🔊")}
                            </span>
                          ) : null}
                        </div>
    
                        <div className="pointer-events-none absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
                          <span className="rounded border border-border/60 bg-card/90 px-1 py-0.5 font-mono text-3xs font-semibold text-foreground shadow-xs backdrop-blur-sm">
                            #{clip.index}
                          </span>
                          <span className="hidden truncate rounded border border-border/60 bg-card/80 px-1 py-0.5 text-3xs font-medium text-muted-foreground sm:block">
                            {clip.motion || "zoom-in"}
                          </span>
                        </div>
    
                        {isActive ? (
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-primary/25">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${progress * 100}%` }}
                            />
                          </div>
                        ) : null}
    
                        {resizingClip?.id === clip.id ? (
                          <span className="absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded bg-primary px-1.5 py-0.5 font-mono text-3xs font-bold text-primary-foreground shadow-md">
                            {clipDuration.toFixed(1)}s
                          </span>
                        ) : null}
    
                        {isSelected ? (
                          <>
                            <div
                              onPointerDown={(event) => event.stopPropagation()}
                              onMouseDown={(event) => startResizing(event, clip.id, "left")}
                              className="absolute inset-y-0 left-0 z-20 flex w-2.5 cursor-ew-resize items-center justify-center bg-primary/25 transition-colors hover:bg-primary/50"
                              title="Drag to trim the start"
                            >
                              <div className="h-6 w-0.5 rounded-full bg-primary" />
                            </div>
                            <div
                              onPointerDown={(event) => event.stopPropagation()}
                              onMouseDown={(event) => startResizing(event, clip.id, "right")}
                              className="absolute inset-y-0 right-0 z-20 flex w-2.5 cursor-ew-resize items-center justify-center bg-primary/25 transition-colors hover:bg-primary/50"
                              title="Drag to stretch or shrink this image"
                            >
                              <div className="h-6 w-0.5 rounded-full bg-primary" />
                            </div>
                          </>
                        ) : null}
                      </div>
    
                      {index < clipTimings.length - 1 ? (
                        <div className="relative z-30 w-0 shrink-0">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveTransitionModal({
                                clipIndex: index,
                                type: clip.transition?.type || "none",
                                duration: clip.transition?.duration || 0.4,
                              });
                            }}
                            onPointerDown={(event) => event.stopPropagation()}
                            className={cn(
                              "absolute top-1/2 left-0 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-transform hover:scale-110",
                              hasTransition
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-muted-foreground hover:text-foreground",
                            )}
                            title={
                              hasTransition
                                ? `Transition: ${clip.transition?.type} (${clip.transition?.duration}s)`
                                : "Add a transition at this split"
                            }
                          >
                            {hasTransition ? (
                              <Zap className="size-2.5" />
                            ) : (
                              <Plus className="size-2.5" />
                            )}
                          </button>
                        </div>
                      ) : null}
                    </React.Fragment>
                  );
                })}
    
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAddNewEmptyClip();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="ml-1 flex h-full w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-r-md border-y border-r border-dashed border-border bg-card/40 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  title="Add an empty image clip"
                >
                  <Plus className="size-4" />
                  <span className="text-3xs font-semibold">Add</span>
                </button>
              </div>
            </div>
    
            {/* Voice track */}
            <div
              className="relative overflow-hidden border-b border-border/60 bg-track-voice-soft/40"
              style={{ height: TRACK_HEIGHT.voice }}
              onPointerDown={beginScrub}
            >
              {project.audioUrl ? (
                <div
                  className="absolute inset-y-1 left-0 overflow-hidden rounded-md border border-track-voice/30 bg-card/70"
                  style={{ width: `${voiceoverWidth}px` }}
                >
                  <canvas
                    ref={waveformCanvasRef}
                    className="absolute inset-0 size-full"
                  />
                  <span className="absolute top-1 left-1 rounded bg-card/85 px-1 py-0.5 font-mono text-3xs font-semibold text-track-voice shadow-xs">
                    Voiceover · {formatSec(effectiveAudioDuration)}
                  </span>
                </div>
              ) : (
                <div className="flex h-full items-center px-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      audioInputRef.current?.click();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-track-voice/40 px-2 py-1 text-3xs font-medium text-muted-foreground transition-colors hover:text-track-voice"
                  >
                    <Music className="size-3" />
                    Import voiceover to see the waveform
                  </button>
                </div>
              )}
            </div>
    
            {/* SFX track */}
            <div
              className="relative hidden border-b border-border/60 bg-track-sfx-soft/40 sm:block"
              style={{ height: TRACK_HEIGHT.sfx }}
              onPointerDown={beginScrub}
            >
              {sfxCount === 0 ? (
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-3xs text-muted-foreground">
                  No sound effects yet — select a clip to add one
                </span>
              ) : null}
    
              {clipTimings.map(({ clip, start }) => {
                const cfg = getClipSfxConfig(clip);
                if (!cfg || cfg.type === "none") return null;
    
                const offset = cfg.offset || 0;
                const preset = SFX_PRESETS.find((item) => item.type === cfg.type);
                const label =
                  cfg.type === "custom"
                    ? cfg.customName || "Custom"
                    : `${preset?.emoji ?? "🔊"} ${preset?.label.split(" ")[0] ?? "SFX"}`;
    
                return (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenSfxModal(clip);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    style={{ left: `${Math.max(4, (start + offset) * pxPerSec)}px` }}
                    className="absolute top-1/2 flex max-w-40 -translate-y-1/2 items-center gap-1 rounded border border-track-sfx/40 bg-card/90 px-1.5 py-0.5 font-mono text-3xs font-semibold text-track-sfx shadow-xs transition-colors hover:bg-card"
                    title={`Clip #${clip.index} · ${label} · offset +${offset.toFixed(2)}s · vol ${Math.round(cfg.volume * 100)}% · ${cfg.speed.toFixed(2)}x`}
                  >
                    <span className="truncate">{label}</span>
                    <span className="text-muted-foreground">+{offset.toFixed(1)}s</span>
                    <Sliders className="size-2.5 shrink-0 opacity-70" />
                  </button>
                );
              })}
            </div>
    
            {/* Music track */}
            <div
              className="relative hidden border-b border-border/60 bg-track-music-soft/40 sm:block"
              style={{ height: TRACK_HEIGHT.music }}
              onPointerDown={beginScrub}
            >
              {project.bgmUrl ? (
                <div className="absolute inset-y-1 right-1 left-0 flex items-center gap-1.5 overflow-hidden rounded-md border border-track-music/30 bg-card/70 px-2">
                  <Headphones className="size-3 shrink-0 text-track-music" />
                  <span className="truncate text-3xs font-semibold text-track-music">
                    {bgmLabel}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-3xs text-muted-foreground">
                    {Math.round(bgmVolume * 100)}%
                  </span>
                </div>
              ) : (
                <div className="flex h-full items-center px-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      bgmInputRef.current?.click();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-track-music/40 px-2 py-1 text-3xs font-medium text-muted-foreground transition-colors hover:text-track-music"
                  >
                    <Headphones className="size-3" />
                    Add background music
                  </button>
                </div>
              )}
            </div>
    
            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-40 w-px bg-primary"
              style={{ left: `${currentTime * pxPerSec}px` }}
            >
              <span
                className="absolute top-0 left-0 rounded-b-md bg-primary px-1 py-0.5 font-mono text-3xs font-bold text-primary-foreground shadow-sm"
                style={{
                  transform: currentTime < 1 ? "translateX(0)" : "translateX(-50%)",
                }}
              >
                {formatSec(currentTime)}
              </span>
              <span className="absolute top-0 left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
