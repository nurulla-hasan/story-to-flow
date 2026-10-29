"use client";

import * as React from "react";
import {
  Trash2,
  Video,
  Mic,
  Music,
  Radio,
  Volume2,
  VolumeX,
  Layers,
  Plus,
  Sparkles,
  Gauge,
  Check,
  Move,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useTimeline } from "@/lib/timeline-context";
import { useMediaLibrary } from "@/lib/use-media-library";
import { TimelineVisualTrackLane } from "@/components/editor/timeline-visual-track-lane";
import { TimelineAudioTrackLane } from "@/components/editor/timeline-audio-track-lane";
import { TimelineRuler } from "@/components/editor/timeline-ruler";
import { TimelinePlayhead } from "@/components/editor/timeline-playhead";
import { TimelineTrackSidebarHeader } from "@/components/editor/timeline-track-sidebar-header";
import { TimelineMotionToolbar } from "@/components/editor/timeline-motion-toolbar";
import { TimelineActionsToolbar } from "@/components/editor/timeline-actions-toolbar";
import {
  type TimelineClip,
  type TimelineTrack,
  type TrackId,
  isAudioTrack,
  isVisualTrack,
  getVisualTracks,
  getAudioTracks,
  getTrackById,
  isTrackLocked,
} from "@/types/timeline";
import {
  TRANSITION_PRESETS,
  DEFAULT_TRANSITION_DURATION,
  getTransitionToNext,
} from "@/lib/transition-helpers";
import { CLIP_SPEED_PRESETS, buildClipSpeedUpdate } from "@/lib/clip-speed";
import { useTimelineCanvasViewport } from "@/lib/use-timeline-canvas-viewport";
import { useTimelineClipGestures } from "@/lib/use-timeline-clip-gestures";
import { groupTimelineClipsByTrack } from "@/lib/timeline-derived-state";


export function TimelineDock() {
  const {
    isHydrated,
    tracks,
    clips,
    transitions,
    selectedClipId,
    selectedTransitionId,
    selectClip,
    selectTransition,
    setClipsTransient,
    commitClipGesture,
    cancelClipGesture,
    splitClipAtPlayhead,
    deleteClip,
    duplicateClip,
    addTransition,
    deleteTransition,
    updateTransition,
    playhead,
    seek,
    commitPlayhead,
    pause,
    zoom,
    setZoom,
    totalDuration,
    addAssetToTimeline,
    fitVisualsToVoiceover,
    updateClip,
    applyMotionToAllClips,
    addTrack,
    renameTrack,
    deleteTrack,
    reorderTrack,
    toggleTrackMute,
    toggleTrackLock,
    toggleTrackVisibility,
  } = useTimeline();

  const { assets } = useMediaLibrary();

  // Magnetic snapping state & visual guide line
  const [snapEnabled, setSnapEnabled] = React.useState<boolean>(true);
  const [activeSnapGuide, setActiveSnapGuide] = React.useState<number | null>(null);
  // Insertion point shown while dragging a clip body (reorder preview)
  const [dragInsertTime, setDragInsertTime] = React.useState<number | null>(null);

  // Selected clip resolution for timeline toolbar actions
  const selectedClip = React.useMemo(() => {
    if (!selectedClipId) return null;
    return clips.find((c) => c.id === selectedClipId) || null;
  }, [clips, selectedClipId]);

  const isSelectedClipLocked = selectedClip
    ? isTrackLocked(selectedClip.trackId, tracks)
    : false;

  // Adjacent clip that can hold a transition after the selected scene
  const transitionToNext = React.useMemo(
    () => getTransitionToNext(selectedClip, clips, transitions, tracks),
    [selectedClip, clips, transitions, tracks]
  );
  const imageClips = React.useMemo(
    () => clips.filter((c) => isVisualTrack(c.trackId, tracks) && c.type === "image"),
    [clips, tracks]
  );
  const imageClipsCount = imageClips.length;

  const {
    pxPerSec,
    tracksContentWidth,
    rulerRef,
    tracksScrollRef,
    rulerTicks,
    handleZoomChange,
    getTimeFromClientX,
    startPlayheadDrag,
  } = useTimelineCanvasViewport({
    zoom,
    totalDuration,
    setZoom,
    pause,
    seek,
    commitPlayhead,
  });

  // Drag-and-drop from Media Library onto tracks with unified coordinate mapping
  const handleTrackDrop = (e: React.DragEvent, trackId: TrackId) => {
    e.preventDefault();
    const targetTrack = getTrackById(tracks, trackId);
    if (targetTrack?.locked) {
      return;
    }

    try {
      const raw = e.dataTransfer.getData("application/json");
      if (raw) {
        const asset = JSON.parse(raw);
        if (asset && asset.id) {
          // Reject mismatched categories
          if (targetTrack?.type === "visual" && asset.category === "audio") {
            return;
          }
          if (targetTrack?.type === "audio" && (asset.category === "image" || asset.category === "video")) {
            return;
          }

          const dropTime = getTimeFromClientX(e.clientX);
          addAssetToTimeline(asset, trackId, dropTime);
        }
      }
    } catch (err) {
      console.error("Failed to drop media asset onto timeline:", err);
    }
  };

  // Clip move/trim interactions own their pointer lifecycle in a dedicated hook.
  const { startMoveDrag, startLeftTrimDrag, startRightTrimDrag } = useTimelineClipGestures({
    clips,
    tracks,
    playhead,
    pixelsPerSecond: pxPerSec,
    snapEnabled,
    selectClip,
    setClipsTransient,
    commitClipGesture,
    cancelClipGesture,
    setActiveSnapGuide,
    setDragInsertTime,
  });

  // Dynamic Ordered Tracks
  const orderedVisualTracks = React.useMemo(() => getVisualTracks(tracks), [tracks]);
  const orderedAudioTracks = React.useMemo(() => getAudioTracks(tracks), [tracks]);
  const orderedTracks = React.useMemo(
    () => [...orderedVisualTracks, ...orderedAudioTracks],
    [orderedVisualTracks, orderedAudioTracks]
  );

  // Grouping logic is pure and tested outside the UI component.
  const clipsByTrack = React.useMemo(
    () => groupTimelineClipsByTrack(orderedTracks, clips, tracks),
    [orderedTracks, clips, tracks]
  );

  const assetMap = React.useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const hasAudio = React.useMemo(() => clips.some((c) => isAudioTrack(c.trackId, tracks)), [clips, tracks]);
  const hasVisual = React.useMemo(() => clips.some((c) => isVisualTrack(c.trackId, tracks)), [clips, tracks]);

  // Track Inline Rename & Delete Confirmation State
  const [editingTrackId, setEditingTrackId] = React.useState<string | null>(null);
  const [editingTrackName, setEditingTrackName] = React.useState<string>("");
  const [trackToDelete, setTrackToDelete] = React.useState<TimelineTrack | null>(null);

  const sidebarScrollRef = React.useRef<HTMLDivElement>(null);

  const handleTracksScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (sidebarScrollRef.current && sidebarScrollRef.current.scrollTop !== target.scrollTop) {
      sidebarScrollRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  const handleSidebarWheel = React.useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (tracksScrollRef.current) {
      tracksScrollRef.current.scrollTop += e.deltaY;
    }
  }, []);

  const startRename = React.useCallback((track: TimelineTrack) => {
    if (track.locked) return;
    setEditingTrackId(track.id);
    setEditingTrackName(track.name);
  }, []);

  const finishRename = React.useCallback((trackId: TrackId) => {
    const trimmed = editingTrackName.trim();
    if (trimmed) {
      renameTrack(trackId, trimmed);
    }
    setEditingTrackId(null);
  }, [editingTrackName, renameTrack]);

  const handleDeleteClick = React.useCallback((track: TimelineTrack) => {
    if (track.locked) return;
    const trackClips = clipsByTrack.get(track.id) || [];
    if (trackClips.length > 0) {
      setTrackToDelete(track);
    } else {
      deleteTrack(track.id);
    }
  }, [clipsByTrack, deleteTrack]);

  // Sidebar headers own their visuals; the dock provides track state and commands.
  const renderTrackSidebarHeader = (track: TimelineTrack) => {
    const trackClips = clipsByTrack.get(track.id) || [];
    const isVisual = track.type === "visual";
    const visualIndex = orderedVisualTracks.findIndex((item) => item.id === track.id);
    const audioIndex = orderedAudioTracks.findIndex((item) => item.id === track.id);
    const isFirst = isVisual ? visualIndex === 0 : audioIndex === 0;
    const isLast = isVisual
      ? visualIndex === orderedVisualTracks.length - 1
      : audioIndex === orderedAudioTracks.length - 1;

    return (
      <TimelineTrackSidebarHeader
        key={`sidebar_header_${track.id}`}
        track={track}
        clipCount={trackClips.length}
        isFirst={isFirst}
        isLast={isLast}
        editingTrackId={editingTrackId}
        editingTrackName={editingTrackName}
        onEditingTrackNameChange={setEditingTrackName}
        onFinishRename={finishRename}
        onCancelRename={() => setEditingTrackId(null)}
        onStartRename={startRename}
        onToggleVisibility={toggleTrackVisibility}
        onToggleMute={toggleTrackMute}
        onToggleLock={toggleTrackLock}
        onReorderTrack={reorderTrack}
        onDeleteTrack={handleDeleteClick}
      />
    );
  };

  return (
    <div className="flex w-full flex-col">
      {/* Timeline toolbar — tools on the left, contextual scene controls on the right */}
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
        <TimelineActionsToolbar
          isHydrated={isHydrated}
          playhead={playhead}
          zoom={zoom}
          snapEnabled={snapEnabled}
          setSnapEnabled={setSnapEnabled}
          selectedClipId={selectedClipId}
          selectedTransitionId={selectedTransitionId}
          hasAudio={hasAudio}
          hasVisual={hasVisual}
          addTrack={addTrack}
          splitClipAtPlayhead={splitClipAtPlayhead}
          deleteClip={deleteClip}
          deleteTransition={deleteTransition}
          duplicateClip={duplicateClip}
          fitVisualsToVoiceover={fitVisualsToVoiceover}
          handleZoomChange={handleZoomChange}
        />

          {/* Right: THE MARKED AREA — Contextual Selected Clip & Scene Controls */}
          <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto py-0.5">
            {selectedClip ? (
              <div className="ml-auto flex items-center gap-1 shrink-0 min-w-0">
                {/* Quick clip settings, surfaced from the inspector */}
                <div className="flex items-center gap-1 shrink-0">
                  {isVisualTrack(selectedClip.trackId, tracks) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSelectedClipLocked}
                            title="Playback speed"
                          >
                            <Gauge className="size-3.5 text-primary" />
                            <span className="font-mono tabular-nums">
                              {(selectedClip.speed || 1).toFixed(1)}×
                            </span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Playback speed</DropdownMenuLabel>
                          {CLIP_SPEED_PRESETS.map((speed) => {
                            const isCurrent = (selectedClip.speed || 1) === speed;
                            return (
                              <DropdownMenuItem
                                key={speed}
                                disabled={isCurrent}
                                onClick={() =>
                                  updateClip(selectedClip.id, buildClipSpeedUpdate(selectedClip, speed))
                                }
                              >
                                <Check
                                  className={`size-3.5 ${isCurrent ? "text-primary" : "opacity-0"}`}
                                />
                                <span className="font-mono">{speed.toFixed(1)}×</span>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {transitionToNext && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant={transitionToNext.existing ? "outline" : "ghost"}
                            size="sm"
                            disabled={isSelectedClipLocked}
                            title="Transition to next scene"
                          >
                            <Sparkles className="size-3.5 text-primary" />
                            <span className="max-w-24 truncate">
                              {transitionToNext.existing
                                ? TRANSITION_PRESETS.find(
                                    (preset) => preset.type === transitionToNext.existing?.type
                                  )?.label
                                : "Transition"}
                            </span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Transition to next scene</DropdownMenuLabel>
                          {TRANSITION_PRESETS.map((preset) => {
                            const isCurrent = transitionToNext.existing?.type === preset.type;
                            return (
                              <DropdownMenuItem
                                key={preset.type}
                                disabled={isCurrent}
                                onClick={() => {
                                  if (transitionToNext.existing) {
                                    updateTransition(transitionToNext.existing.id, {
                                      type: preset.type,
                                    });
                                  } else {
                                    addTransition(
                                      selectedClip.id,
                                      transitionToNext.nextClip.id,
                                      preset.type,
                                      DEFAULT_TRANSITION_DURATION
                                    );
                                  }
                                }}
                              >
                                <Check
                                  className={`size-3.5 ${isCurrent ? "text-primary" : "opacity-0"}`}
                                />
                                <div className="flex min-w-0 flex-col">
                                  <span>{preset.label}</span>
                                  <span className="truncate text-3xs text-muted-foreground">
                                    {preset.description}
                                  </span>
                                </div>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuGroup>
                        {transitionToNext.existing && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => deleteTransition(transitionToNext.existing!.id)}
                            >
                              <Trash2 className="size-3.5" />
                              <span>Remove transition</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {selectedClip.type === "image" && (
                    <TimelineMotionToolbar
                      clip={selectedClip}
                      imageClipsCount={imageClipsCount}
                      isLocked={isSelectedClipLocked}
                      updateClip={updateClip}
                      applyMotionToAllClips={applyMotionToAllClips}
                    />
                  )}
                </div>

                <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

                {/* Dynamic Visual Track Layer Switcher */}
                {isVisualTrack(selectedClip.trackId, tracks) && orderedVisualTracks.length > 1 && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {orderedVisualTracks.map((tr) => {
                      const isCurrent =
                        tr.id === selectedClip.trackId ||
                        (tr.id === "visual-1" && selectedClip.trackId === "visual");
                      return (
                        <Tooltip key={tr.id}>
                          <TooltipTrigger
                            render={
                              <Button
                                variant={isCurrent ? "secondary" : "ghost"}
                                size="xs"
                                disabled={isCurrent || tr.locked}
                                onClick={() => updateClip(selectedClip.id, { trackId: tr.id })}
                                aria-label={`Move clip to ${tr.name}`}
                                className="px-1.5 h-6 text-3xs font-medium gap-1 cursor-pointer"
                              >
                                <Layers className={`size-3 ${isCurrent ? "text-primary" : ""}`} />
                                <span className="hidden xl:inline">{tr.name}</span>
                              </Button>
                            }
                          />
                          <TooltipContent>
                            <span>Move to {tr.name}</span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    <div className="h-4 w-px bg-border mx-0.5 shrink-0" />
                  </div>
                )}

                {/* Dynamic Audio Track Switcher */}
                {isAudioTrack(selectedClip.trackId, tracks) && orderedAudioTracks.length > 1 && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {orderedAudioTracks.map((tr) => {
                      const isCurrent = tr.id === selectedClip.trackId;
                      return (
                        <Tooltip key={tr.id}>
                          <TooltipTrigger
                            render={
                              <Button
                                variant={isCurrent ? "secondary" : "ghost"}
                                size="xs"
                                disabled={isCurrent || tr.locked}
                                onClick={() => updateClip(selectedClip.id, { trackId: tr.id })}
                                aria-label={`Move clip to ${tr.name}`}
                                className="px-1.5 h-6 text-3xs font-medium gap-1 cursor-pointer"
                              >
                                <Volume2 className={`size-3 ${isCurrent ? "text-primary" : ""}`} />
                                <span className="hidden xl:inline">{tr.name}</span>
                              </Button>
                            }
                          />
                          <TooltipContent>
                            <span>Move to {tr.name}</span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    <div className="h-4 w-px bg-border mx-0.5 shrink-0" />
                  </div>
                )}

                {/* Volume & Mute for Audio & Video clips */}
                {(isAudioTrack(selectedClip.trackId, tracks) || selectedClip.type === "video") && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant={(selectedClip.volume ?? 1.0) === 0 ? "secondary" : "ghost"}
                          size="icon-sm"
                          onClick={() => {
                            const isMuted = (selectedClip.volume ?? 1.0) === 0;
                            updateClip(selectedClip.id, { volume: isMuted ? 1.0 : 0 });
                          }}
                          aria-label={(selectedClip.volume ?? 1.0) === 0 ? "Unmute scene" : "Mute scene"}
                        >
                          {(selectedClip.volume ?? 1.0) === 0 ? (
                            <VolumeX className="size-4 text-destructive" />
                          ) : (
                            <Volume2 className="size-4" />
                          )}
                        </Button>
                      }
                    />
                    <TooltipContent>
                      <span>
                        {(selectedClip.volume ?? 1.0) === 0 ? "Unmute scene audio" : "Mute scene audio"}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-1.5 text-2xs text-muted-foreground select-none pr-1">
                <MousePointerClick className="size-3.5 text-muted-foreground/70" />
                <span>Select a scene to edit motion &amp; layers</span>
              </div>
            )}
          </div>
        </div>

      {/* Main timeline body: pinned track sidebar + horizontally scrolling canvas */}
      <div className="flex max-h-72 flex-row overflow-hidden border-t border-border md:max-h-80">
        {/* PINNED LEFT TRACK SIDEBAR (Immune to Horizontal Scrolling, Always Visible) */}
        <div
          ref={sidebarScrollRef}
          onWheel={handleSidebarWheel}
          className="no-scrollbar z-30 flex w-60 shrink-0 select-none flex-col overflow-y-auto border-r border-border bg-surface-subtle/60"
        >
          {/* Header Row (Sticky on top of sidebar) */}
          <div className="sticky top-0 z-40 flex h-7 items-center justify-between border-b border-border bg-card px-2.5 text-3xs font-medium uppercase tracking-wider text-muted-foreground">
            <span>Tracks ({orderedTracks.length})</span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="xs"
                    title="Add track"
                  >
                    <Plus className="size-3 text-primary" />
                    <span>Add</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-3xs text-muted-foreground uppercase font-semibold">
                    Add Track
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => addTrack("visual")}>
                    <Layers className="size-3.5 mr-2 text-primary" />
                    <span>Visual Track</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => addTrack("audio", "voiceover")}>
                    <Mic className="size-3.5 mr-2 text-primary" />
                    <span>Voiceover Track</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addTrack("audio", "music")}>
                    <Music className="size-3.5 mr-2 text-primary" />
                    <span>Music Track</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addTrack("audio", "sfx")}>
                    <Volume2 className="size-3.5 mr-2 text-primary" />
                    <span>SFX Track</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addTrack("audio", "ambient")}>
                    <Radio className="size-3.5 mr-2 text-primary" />
                    <span>Ambient Track</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addTrack("audio", "general")}>
                    <Volume2 className="size-3.5 mr-2 text-primary" />
                    <span>Audio Track</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Dynamic Track Sidebar Headers */}
          {orderedTracks.map((track) => renderTrackSidebarHeader(track))}
        </div>

        {/* HORIZONTALLY SCROLLING TIMELINE CANVAS */}
        <div
          ref={tracksScrollRef}
          onScroll={handleTracksScroll}
          className="flex-1 min-w-0 overflow-auto select-none"
        >
          <div
            style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
            className="min-w-full flex flex-col relative"
          >
            <TimelineRuler
              rulerRef={rulerRef}
              rulerTicks={rulerTicks}
              tracksContentWidth={tracksContentWidth}
              onPointerDown={startPlayheadDrag}
            />

            {/* Tracks Container */}
            <div className="relative flex flex-col divide-y divide-border min-w-full">
              {/* Active Snap Guide Line */}
              {activeSnapGuide !== null && (
                <div
                  style={{ left: `${activeSnapGuide * pxPerSec}px` }}
                  className="absolute top-0 bottom-0 z-50 w-px bg-info pointer-events-none shadow-sm"
                />
              )}

              {/* Clip Reorder Insertion Indicator */}
              {dragInsertTime !== null && (
                <div
                  style={{ left: `${dragInsertTime * pxPerSec}px` }}
                  className="absolute top-0 bottom-0 z-50 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                >
                  <div className="w-2 h-2 rounded-full bg-primary shadow-sm" />
                  <div className="w-0.5 flex-1 bg-primary rounded-full shadow-sm" />
                </div>
              )}

              {/* Dynamic Track Lanes */}
              {orderedTracks.map((track) => {
                const trackClips = clipsByTrack.get(track.id) || [];
                return (
                  <div
                    key={track.id}
                    data-testid={`track-lane-${track.id}`}
                    className="flex h-11 min-w-full bg-card transition-colors hover:bg-muted/10"
                  >
                    {track.type === "visual" ? (
                      <TimelineVisualTrackLane
                        track={track}
                        trackClips={trackClips}
                        tracksContentWidth={tracksContentWidth}
                        isHydrated={isHydrated}
                        rulerTicks={rulerTicks}
                        pxPerSec={pxPerSec}
                        selectedClipId={selectedClipId}
                        selectedTransitionId={selectedTransitionId}
                        transitions={transitions}
                        assetMap={assetMap}
                        handleTrackDrop={handleTrackDrop}
                        selectClip={selectClip}
                        selectTransition={selectTransition}
                        addTransition={addTransition}
                        startMoveDrag={startMoveDrag}
                        startLeftTrimDrag={startLeftTrimDrag}
                        startRightTrimDrag={startRightTrimDrag}
                      />
                    ) : (
                      <TimelineAudioTrackLane
                        track={track}
                        trackClips={trackClips}
                        tracksContentWidth={tracksContentWidth}
                        isHydrated={isHydrated}
                        rulerTicks={rulerTicks}
                        pxPerSec={pxPerSec}
                        selectedClipId={selectedClipId}
                        assetMap={assetMap}
                        handleTrackDrop={handleTrackDrop}
                        selectClip={selectClip}
                        startMoveDrag={startMoveDrag}
                        startLeftTrimDrag={startLeftTrimDrag}
                        startRightTrimDrag={startRightTrimDrag}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <TimelinePlayhead
              playhead={playhead}
              pixelsPerSecond={pxPerSec}
              totalDuration={totalDuration}
              onPointerDown={startPlayheadDrag}
            />
          </div>
        </div>
      </div>

      {/* Track Deletion Safe Confirmation Dialog */}
      {trackToDelete && (
        <AlertDialog
          open={trackToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setTrackToDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Track &quot;{trackToDelete.name}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                This track contains {clipsByTrack.get(trackToDelete.id)?.length || 0} clip(s).
                Deleting the track will remove the track and all clips on it.
                You can undo this action with Ctrl+Z.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  deleteTrack(trackToDelete.id);
                  setTrackToDelete(null);
                }}
              >
                Delete Track
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
