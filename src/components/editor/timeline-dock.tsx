"use client";

import * as React from "react";
import {
  Scissors,
  Trash2,
  Copy,
  Video,
  Mic,
  Music,
  Radio,
  ZoomIn,
  ZoomOut,
  Magnet,
  Volume2,
  VolumeX,
  Lock,
  Wand2,
  Layers,
  Plus,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CopyCheck,
  Sparkles,
  Gauge,
  Check,
  Move,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
import { AudioWaveformView } from "@/components/editor/audio-waveform-view";
import { TimelineTrackSidebarHeader } from "@/components/editor/timeline-track-sidebar-header";
import {
  type TimelineClip,
  type TimelineTrack,
  type TrackId,
  type AudioTrackRole,
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
  findAdjacentClipPairs,
  getTransitionToNext,
} from "@/lib/transition-helpers";
import { CLIP_SPEED_PRESETS, buildClipSpeedUpdate } from "@/lib/clip-speed";
import {
  getPixelsPerSecond,
  generateAdaptiveRulerTicks,
  MIN_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
} from "@/lib/ruler-scale";
import { useTimelinePlayheadScrub } from "@/lib/use-timeline-playhead-scrub";
import { useTimelineClipGestures } from "@/lib/use-timeline-clip-gestures";
import { groupTimelineClipsByTrack } from "@/lib/timeline-derived-state";
import {
  DEFAULT_ZOOM_EFFECT_AMOUNT,
  sanitizeZoomEffect,
  type ZoomEffectType,
  type ClipZoomEffect,
} from "@/lib/zoom-effect";
import { getClipLod, isTightSeam } from "@/lib/timeline-lod";

type MotionOption = {
  type: "off" | ZoomEffectType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MOTION_OPTIONS: MotionOption[] = [
  { type: "off", label: "Off", icon: Sparkles },
  { type: "zoom-in", label: "Zoom In", icon: ZoomIn },
  { type: "zoom-out", label: "Zoom Out", icon: ZoomOut },
  { type: "pan-left", label: "Pan Left", icon: ArrowLeft },
  { type: "pan-right", label: "Pan Right", icon: ArrowRight },
  { type: "pan-up", label: "Pan Up", icon: ArrowUp },
  { type: "pan-down", label: "Pan Down", icon: ArrowDown },
];


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

  const selectedImageClip = selectedClip?.type === "image" ? selectedClip : null;

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

  const [motionFeedback, setMotionFeedback] = React.useState<string | null>(null);
  const [unselectedPreset, setUnselectedPreset] = React.useState<ClipZoomEffect>({
    type: "zoom-in",
    amount: DEFAULT_ZOOM_EFFECT_AMOUNT,
  });

  const activeMotionEffect = selectedImageClip
    ? sanitizeZoomEffect(selectedImageClip.zoomEffect)
    : unselectedPreset;

  const motionLabel =
    MOTION_OPTIONS.find(
      (option) => option.type === (selectedImageClip?.zoomEffect?.type ?? "off")
    )?.label ?? "Off";

  const handleTimelineSetMotion = (type: "off" | ZoomEffectType) => {
    if (type === "off") {
      if (selectedImageClip) {
        updateClip(selectedImageClip.id, { zoomEffect: undefined });
      }
      return;
    }

    const currentAmount = activeMotionEffect?.amount ?? DEFAULT_ZOOM_EFFECT_AMOUNT;
    const newEffect: ClipZoomEffect = {
      type,
      amount: currentAmount,
    };

    if (selectedImageClip) {
      updateClip(selectedImageClip.id, { zoomEffect: newEffect });
    } else {
      setUnselectedPreset(newEffect);
    }
  };

  const handleTimelineApplyMotionToAll = () => {
    const effectToApply = selectedImageClip
      ? sanitizeZoomEffect(selectedImageClip.zoomEffect)
      : unselectedPreset;

    if (!effectToApply) return;
    const res = applyMotionToAllClips(effectToApply);
    setMotionFeedback(res.message);
    setTimeout(() => setMotionFeedback(null), 4000);
  };

  // Pixels per second scaled by wide zoom range (10% to 1000%)
  const pxPerSec = getPixelsPerSecond(zoom);

  // Minimum 1200px or duration-based width so ruler & tracks span full viewport
  const tracksContentWidth = Math.max(1200, (Math.max(10, totalDuration) + 10) * pxPerSec);

  const rulerRef = React.useRef<HTMLDivElement>(null);
  const tracksScrollRef = React.useRef<HTMLDivElement>(null);

  // CapCut-style horizontal mouse wheel and trackpad panning over timeline container
  React.useEffect(() => {
    const scrollEl = tracksScrollRef.current;
    if (!scrollEl) return;

    const handleWheel = (e: WheelEvent) => {
      // Do not hijack browser zoom or pinch-to-zoom (Ctrl/Cmd)
      if (e.ctrlKey || e.metaKey) return;

      // Detect horizontal delta (trackpad / Shift+wheel) or convert standard mouse-wheel deltaY to horizontal pan
      let delta = 0;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        delta = e.deltaX;
      } else {
        delta = e.deltaY;
      }

      if (delta === 0) return;

      const maxScrollLeft = scrollEl.scrollWidth - scrollEl.clientWidth;
      if (maxScrollLeft <= 0) return;

      const currentScroll = scrollEl.scrollLeft;
      const canScrollLeft = delta < 0 && currentScroll > 0;
      const canScrollRight = delta > 0 && currentScroll < maxScrollLeft;

      if (canScrollLeft || canScrollRight) {
        e.preventDefault();
        scrollEl.scrollLeft += delta;
      }
    };

    scrollEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      scrollEl.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Adaptive ruler ticks: frame notation at deep zoom (>=500%), seconds at medium zoom, wider at low zoom
  const rulerTicks = React.useMemo(() => {
    const span = Math.max(Math.max(10, totalDuration) + 10, tracksContentWidth / pxPerSec);
    return generateAdaptiveRulerTicks(zoom, span, 30);
  }, [zoom, totalDuration, tracksContentWidth, pxPerSec]);

  // Center-anchored zoom update so clips and playhead remain in view when zooming
  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, newZoom));
    const scrollEl = tracksScrollRef.current;
    if (!scrollEl) {
      setZoom(clamped);
      return;
    }

    const viewportWidth = scrollEl.clientWidth;
    const oldPxPerSec = getPixelsPerSecond(zoom);
    const centerTime = (scrollEl.scrollLeft + viewportWidth / 2) / oldPxPerSec;

    setZoom(clamped);

    requestAnimationFrame(() => {
      const newPxPerSec = getPixelsPerSecond(clamped);
      const targetScrollLeft = centerTime * newPxPerSec - viewportWidth / 2;
      scrollEl.scrollLeft = Math.max(0, targetScrollLeft);
    });
  };

  const { getTimeFromClientX, startPlayheadDrag } = useTimelinePlayheadScrub({
    containerRef: tracksScrollRef,
    pixelsPerSecond: pxPerSec,
    totalDuration,
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

  // Render a visual track lane with dual-edge trim handles, clips, and transition seam badges
  const renderVisualTrackLane = (track: TimelineTrack, trackClips: TimelineClip[]) => {
    const adjacentPairs = findAdjacentClipPairs(trackClips);
    const isLocked = track.locked;
    const isHidden = !track.visible;

    return (
      <div
        onDragOver={(e) => {
          if (!isLocked) e.preventDefault();
        }}
        onDrop={(e) => handleTrackDrop(e, track.id)}
        style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
        className={`relative flex h-full min-w-full items-center overflow-visible px-1 ${
          isLocked ? "bg-muted/20" : ""
        } ${isHidden ? "opacity-50" : ""}`}
      >
        {/* Full-width vertical grid lines across the track lane */}
        {rulerTicks.map((tick) => (
          <div
            key={`grid_${tick.time}`}
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
              <span>
                {track.order === 0
                  ? "Drop overlay / foreground visual clips here (rendered on top)."
                  : "Drag scene images or videos here, or click '+' in Media Library."}
              </span>
            )}
          </div>
        ) : (
          <>
            {/* Visual Clips on Track with Dual-Edge Trim Handles */}
            {trackClips.map((clip) => {
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
                      ? "z-10 border-primary bg-primary/15 ring-2 ring-primary/60 shadow-md"
                      : "border-track-video/40 bg-track-video-soft hover:border-track-video"
                  }`}
                >
                  {/* Left-edge trim handle (in-point & anchored right edge) */}
                  {!isLocked && (
                    <div
                      onPointerDown={(e) => startLeftTrimDrag(e, clip)}
                      className="group/leftHandle absolute top-0 bottom-0 left-0 z-20 flex w-2 items-center justify-center rounded-l-lg bg-primary/25 transition-all hover:w-3 hover:bg-primary cursor-ew-resize"
                      title="Drag to trim start (in-point)"
                    >
                      <div className="pointer-events-none h-3 w-0.5 rounded-full bg-primary/70 group-hover/leftHandle:bg-primary-foreground" />
                    </div>
                  )}

                  {/* Clip info & thumbnail */}
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
                    {lod.name && (
                      <span className="truncate text-3xs font-semibold text-foreground">
                        {clip.name}
                      </span>
                    )}
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

                  {/* Right-edge trim handle (duration & anchored start time) */}
                  {!isLocked && (
                    <div
                      onPointerDown={(e) => startRightTrimDrag(e, clip)}
                      className="group/rightHandle absolute top-0 right-0 bottom-0 z-20 flex w-2 items-center justify-center rounded-r-lg bg-primary/25 transition-all hover:w-3 hover:bg-primary cursor-ew-resize"
                      title="Drag to trim end (duration)"
                    >
                      <div className="pointer-events-none h-3 w-0.5 rounded-full bg-primary/70 group-hover/rightHandle:bg-primary-foreground" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Transition Seam Indicators Between Adjacent Clips */}
            {!isLocked && adjacentPairs.map(({ fromClip, toClip }) => {
              const cutPx = toClip.startTime * pxPerSec;
              const existingTrans = transitions.find(
                (t) =>
                  (t.fromClipId === fromClip.id && t.toClipId === toClip.id) ||
                  (t.fromClipId === toClip.id && t.toClipId === fromClip.id)
              );
              const isSelected = existingTrans && existingTrans.id === selectedTransitionId;
              const isAdjacentSelected =
                fromClip.id === selectedClipId || toClip.id === selectedClipId;
              const tightSeam = isTightSeam(
                fromClip.duration * pxPerSec,
                toClip.duration * pxPerSec
              );

              // At low zoom a 20px badge covers several clips at once. Keep only a
              // hairline marker for existing transitions, and hide "add" affordances
              // unless one of the neighbouring clips is selected.
              if (tightSeam) {
                if (!existingTrans && !isAdjacentSelected) return null;
                return (
                  <div
                    key={`seam_${fromClip.id}_${toClip.id}`}
                    style={{
                      left: `${cutPx}px`,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                    }}
                    className="absolute z-30 flex items-center justify-center"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (existingTrans) selectTransition(existingTrans.id);
                        else addTransition(fromClip.id, toClip.id);
                      }}
                      className={`flex cursor-pointer items-center justify-center rounded-full transition-all hover:scale-125 ${
                        existingTrans
                          ? "size-2.5 bg-primary shadow-xs ring-2 ring-background"
                          : "size-3.5 border border-primary/50 bg-card text-primary shadow-xs"
                      }`}
                      title={
                        existingTrans
                          ? `Transition: ${existingTrans.type} (${existingTrans.duration.toFixed(2)}s) — Click to edit or remove`
                          : `Add visual transition between "${fromClip.name}" and "${toClip.name}"`
                      }
                      aria-label={
                        existingTrans
                          ? `Transition: ${existingTrans.type}`
                          : "Add transition"
                      }
                    >
                      {!existingTrans && <Plus className="size-2" />}
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={`seam_${fromClip.id}_${toClip.id}`}
                  style={{
                    left: `${cutPx}px`,
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                  className="absolute z-30 flex items-center justify-center pointer-events-auto"
                >
                  {existingTrans ? (
                    /* Active Transition Indicator Button (CapCut style 20x20) */
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectTransition(existingTrans.id);
                      }}
                      className={`size-5 rounded-md flex items-center justify-center transition-all duration-150 cursor-pointer shadow-xs ${
                        isSelected
                          ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 ring-offset-background scale-110"
                          : "bg-primary/90 text-primary-foreground border border-primary hover:bg-primary hover:scale-110"
                      }`}
                      title={`Transition: ${existingTrans.type} (${existingTrans.duration.toFixed(2)}s) — Click to edit or remove`}
                      aria-label={`Transition: ${existingTrans.type}`}
                    >
                      {/* Bowtie / Hourglass Transition Icon matching CapCut Web */}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 5.3c0-1.37 1.66-2.06 2.63-1.09l4.95 4.95-1.41 1.42L5 6.41v11.17L10.59 12l1.41-1.41 6.37-6.37c.97-.97 2.63-.29 2.63 1.09v13.39c0 1.37-1.66 2.06-2.63 1.09l-4.95-4.95 1.41-1.42L19 17.59V6.41L13.41 12l-1.41 1.41-6.37 6.37c-.97.97-2.63.29-2.63-1.09V5.3Z" />
                      </svg>
                    </button>
                  ) : (
                    /* Add Transition Seam Button (CapCut style 20x20) */
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addTransition(fromClip.id, toClip.id);
                      }}
                      className="group/seam size-5 rounded-md bg-card border border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center opacity-90 hover:opacity-100 hover:scale-110 transition-all duration-150 cursor-pointer shadow-xs"
                      title={`Add visual transition between "${fromClip.name}" and "${toClip.name}"`}
                      aria-label="Add transition"
                    >
                      <Plus className="size-3 group-hover/seam:scale-110 transition-transform" />
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  // Render an audio track lane with waveform visualization, volume/fade ramps, and trim handles
  const renderAudioTrackLane = (track: TimelineTrack, trackClips: TimelineClip[]) => {
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
  };

  return (
    <div className="flex w-full flex-col">
      {/* Timeline toolbar — tools on the left, contextual scene controls on the right */}
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
        {/* Left: Icon-Only Ghost Action Buttons + Playhead/Zoom/Snap */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="mr-1 flex items-center gap-2">
            <span className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
              Timeline
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="xs"
                    title="Create a new timeline track"
                  >
                    <Plus className="size-3 text-primary" />
                    <span className="hidden sm:inline">Add track</span>
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

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!selectedClipId}
                    onClick={() => splitClipAtPlayhead()}
                    aria-label="Split clip at playhead (Ctrl+B)"
                  >
                    <Scissors className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>
                <span>Split clip at playhead (Ctrl+B)</span>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!selectedClipId && !selectedTransitionId}
                    onClick={() => {
                      if (selectedClipId) deleteClip(selectedClipId);
                      else if (selectedTransitionId) deleteTransition(selectedTransitionId);
                    }}
                    aria-label="Delete selected clip or transition (Del / Backspace)"
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>
                <span>Delete selected clip or transition (Del / Backspace)</span>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!selectedClipId}
                    onClick={() => selectedClipId && duplicateClip(selectedClipId)}
                    aria-label="Duplicate clip (Ctrl+D)"
                  >
                    <Copy className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>
                <span>Duplicate selected clip (Ctrl+D)</span>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!hasAudio || !hasVisual}
                    onClick={() => fitVisualsToVoiceover()}
                    aria-label="Fit visual scenes to voiceover"
                  >
                    <Wand2 className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>
                <span>Auto-fit visual scenes to voiceover duration</span>
              </TooltipContent>
            </Tooltip>

            <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

            {/* Playhead Time Display */}
            <div className="flex shrink-0 items-baseline gap-1 rounded-md bg-muted px-2 py-1 font-mono text-2xs font-semibold tabular-nums text-foreground">
              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
              {isHydrated ? playhead.toFixed(2) : "0.00"}s
            </div>

            {/* Magnetic Snapping Ghost Toggle with Tooltip */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSnapEnabled(!snapEnabled)}
                    aria-label="Toggle magnetic snapping"
                  >
                    <Magnet
                      className={`size-4 ${
                        snapEnabled
                          ? "text-primary bg-primary/10 rounded-md"
                          : "text-muted-foreground"
                      }`}
                    />
                  </Button>
                }
              />
              <TooltipContent>
                <span>{snapEnabled ? "Snapping ON (Hold Shift while dragging to disable)" : "Snapping OFF"}</span>
              </TooltipContent>
            </Tooltip>

            {/* Expanded Zoom Controls (10% to 500%) with Ghost Styling */}
            <div className="flex items-center gap-1 p-0.5 shrink-0">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleZoomChange(zoom - 25)}
                      disabled={zoom <= MIN_TIMELINE_ZOOM}
                      aria-label="Zoom out timeline"
                    >
                      <ZoomOut className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>
                  <span>Zoom out timeline</span>
                </TooltipContent>
              </Tooltip>

              <Slider
                min={MIN_TIMELINE_ZOOM}
                max={MAX_TIMELINE_ZOOM}
                step={5}
                value={zoom}
                onValueChange={(val) => {
                  const num = Array.isArray(val) ? val[0] : val;
                  handleZoomChange(num);
                }}
                aria-label="Timeline zoom scale"
                className="w-20"
              />

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleZoomChange(zoom + 25)}
                      disabled={zoom >= MAX_TIMELINE_ZOOM}
                      aria-label="Zoom in timeline"
                    >
                      <ZoomIn className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent>
                  <span>Zoom in timeline</span>
                </TooltipContent>
              </Tooltip>

              <span className="font-mono text-2xs text-muted-foreground tabular-nums w-8 shrink-0">
                {isHydrated ? zoom : 100}%
              </span>
            </div>
          </div>

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
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant={selectedClip.zoomEffect ? "outline" : "ghost"}
                            size="sm"
                            disabled={isSelectedClipLocked}
                            title="Scene motion"
                          >
                            <Move className="size-3.5 text-primary" />
                            <span>{motionLabel}</span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Scene motion</DropdownMenuLabel>
                          {MOTION_OPTIONS.map((option) => {
                            const isCurrent = (selectedClip.zoomEffect?.type ?? "off") === option.type;
                            const Icon = option.icon;
                            return (
                              <DropdownMenuItem
                                key={option.type}
                                disabled={isCurrent}
                                onClick={() => handleTimelineSetMotion(option.type)}
                              >
                                <Check
                                  className={`size-3.5 ${isCurrent ? "text-primary" : "opacity-0"}`}
                                />
                                <Icon className="size-3.5 text-muted-foreground" />
                                <span>{option.label}</span>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={imageClipsCount <= 1 || !selectedClip.zoomEffect}
                          onClick={handleTimelineApplyMotionToAll}
                        >
                          <CopyCheck className="size-3.5" />
                          <span>
                            {selectedClip.zoomEffect
                              ? `Apply to all ${imageClipsCount} scenes`
                              : "Apply motion to all scenes"}
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {motionFeedback && (
                    <span className="animate-in fade-in shrink-0 font-mono text-2xs font-semibold text-primary">
                      {motionFeedback}
                    </span>
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
            {/* Time Ruler Section (Sticky on top of vertical scroll) */}
            <div
              ref={rulerRef}
              onPointerDown={startPlayheadDrag}
              style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
              className="sticky top-0 z-30 h-7 min-w-full cursor-pointer border-b border-border bg-card/95 backdrop-blur-xs select-none hover:bg-muted/60"
            >
              {rulerTicks.map((tick) => (
                <div
                  key={`ruler_${tick.time}_${tick.label}`}
                  style={{ left: `${tick.leftPx}px` }}
                  className="absolute bottom-0 flex flex-col items-start pointer-events-none"
                >
                  <span
                    className={`pl-1 font-mono text-3xs tabular-nums ${
                      tick.isFrame ? "font-semibold text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {tick.label}
                  </span>
                  <div className="h-1.5 w-px bg-border" />
                </div>
              ))}
            </div>

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
                    {track.type === "visual"
                      ? renderVisualTrackLane(track, trackClips)
                      : renderAudioTrackLane(track, trackClips)}
                  </div>
                );
              })}
            </div>

            {/* Dynamic Playhead Scrubber Line & Grabber Handle (Spans full height of ruler + tracks) */}
            <div
              style={{ left: `${playhead * pxPerSec}px` }}
              className="absolute top-0 bottom-0 z-40 flex flex-col items-center pointer-events-none -translate-x-1/2 select-none"
            >
              {/* Ruler-level Scrubber Grabber Handle */}
              <div
                onPointerDown={startPlayheadDrag}
                className="h-6 w-5 flex flex-col items-center justify-start cursor-ew-resize pointer-events-auto group/playhead select-none"
                title={`Playhead: ${playhead.toFixed(2)}s (Click or drag to scrub)`}
                role="slider"
                aria-label="Timeline playhead"
                aria-valuenow={playhead}
                aria-valuemin={0}
                aria-valuemax={totalDuration}
              >
                {/* CapCut-style top badge & downward pointer arrow */}
                <div className="w-3.5 h-3 bg-primary rounded-t-xs shadow-sm flex items-center justify-center group-hover/playhead:brightness-110 group-active/playhead:scale-110 transition-transform">
                  <div className="w-1.5 h-0.5 bg-primary-foreground rounded-full" />
                </div>
                <svg
                  width="14"
                  height="6"
                  viewBox="0 0 14 6"
                  className="fill-primary -mt-px group-hover/playhead:brightness-110 drop-shadow-xs"
                >
                  <polygon points="0,0 14,0 7,6" />
                </svg>
              </div>

              {/* Vertical Playhead Needle across all tracks */}
              <div
                onPointerDown={startPlayheadDrag}
                className="w-2 flex-1 flex items-center justify-center cursor-ew-resize pointer-events-auto group/playheadLine"
                title={`Playhead: ${playhead.toFixed(2)}s (Click or drag to scrub)`}
              >
                <div className="w-0.5 h-full bg-primary shadow-xs group-hover/playheadLine:w-1 transition-all" />
              </div>
            </div>
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
