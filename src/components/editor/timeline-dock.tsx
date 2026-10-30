"use client";

import * as React from "react";
import {
  Scissors,
  Trash2,
  Copy,
  Mic,
  Music,
  Radio,
  ZoomIn,
  ZoomOut,
  Magnet,
  Volume2,
  VolumeX,
  Wand2,
  Layers,
  Plus,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Pencil,
  CopyCheck,
  Sparkles,
  Gauge,
  Check,
  Move,
  MousePointerClick,
  RotateCw,
  Clock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useTimelineState, useTimelinePlayhead, usePlayhead } from "@/lib/timeline-context";
import { useMediaLibrary } from "@/lib/use-media-library";
import { getAllShotsFromPlan } from "@/lib/scene-plan";
import { ImportPlanDialog } from "@/components/editor/import-plan-dialog";
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
  areClipsOnSameTrack,
} from "@/types/timeline";
import {
  TRANSITION_PRESETS,
  DEFAULT_TRANSITION_DURATION,
  getTransitionToNext,
} from "@/lib/transition-helpers";
import { CLIP_SPEED_PRESETS, buildClipSpeedUpdate } from "@/lib/clip-speed";
import {
  getPixelsPerSecond,
  generateAdaptiveRulerTicks,
  MIN_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
} from "@/lib/ruler-scale";
import { calculatePlayheadTimeFromPointer } from "@/lib/playhead-coordinates";
import { calculateTimelineRulerSpan, calculateZoomPreservingScrollLeft } from "@/features/editor/domain/timeline-geometry";
import { usePlayheadScrub } from "@/features/editor/hooks/use-playhead-scrub";
import { useTimelineWheelPan } from "@/features/editor/hooks/use-timeline-wheel-pan";
import { useTimelineClipGestures } from "@/features/editor/hooks/use-timeline-clip-gestures";
import { TimelineTrackSidebarHeader } from "@/features/editor/components/timeline/timeline-track-sidebar-header";
import { TimelineVisualTrackLane } from "@/features/editor/components/timeline/timeline-visual-track-lane";
import { TimelineAudioTrackLane } from "@/features/editor/components/timeline/timeline-audio-track-lane";
import {
  DEFAULT_ZOOM_EFFECT_AMOUNT,
  sanitizeZoomEffect,
  type ZoomEffectType,
  type ClipZoomEffect,
} from "@/lib/zoom-effect";


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


function TimelinePlayheadDisplay({ isHydrated }: { isHydrated: boolean }) {
  const playhead = usePlayhead();
  return (
    <div className="flex shrink-0 items-baseline gap-1 rounded-md bg-muted px-2 py-1 font-mono text-2xs font-semibold tabular-nums text-foreground">
      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
      {isHydrated ? playhead.toFixed(2) : "0.00"}s
    </div>
  );
}

function TimelinePlayheadNeedle({
  pxPerSec,
  totalDuration,
  onStartPlayheadDrag,
}: {
  pxPerSec: number;
  totalDuration: number;
  onStartPlayheadDrag: (event: React.PointerEvent) => void;
}) {
  const playhead = usePlayhead();
  return (
    <div
      style={{ left: `${playhead * pxPerSec}px` }}
      className="absolute top-0 bottom-0 z-40 flex flex-col items-center pointer-events-none -translate-x-1/2 select-none"
    >
      {/* Ruler-level Scrubber Grabber Handle */}
      <div
        onPointerDown={onStartPlayheadDrag}
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
        onPointerDown={onStartPlayheadDrag}
        className="w-2 flex-1 flex items-center justify-center cursor-ew-resize pointer-events-auto group/playheadLine"
        title={`Playhead: ${playhead.toFixed(2)}s (Click or drag to scrub)`}
      >
        <div className="w-0.5 h-full bg-primary shadow-xs group-hover/playheadLine:w-1 transition-all" />
      </div>
    </div>
  );
}

const IMAGE_DURATION_PRESETS = [2, 3, 4, 5, 6, 8, 10];

export function TimelineDock() {
  const { playheadStore, seek, commitPlayhead, pause } = useTimelinePlayhead();
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
    scenePlan,
    setScenePlan,
    selectedPlanShotId,
    selectPlanShot,
    setImageClipDuration,
    rotateClip90,
    applyPlanAutoMotions,
    applyPlanAutoTransitions,
  } = useTimelineState();

  const [isImportPlanOpen, setIsImportPlanOpen] = React.useState<boolean>(false);
  const [isPlanJsonOpen, setIsPlanJsonOpen] = React.useState(false);
  const [planJsonCopyStatus, setPlanJsonCopyStatus] = React.useState<"idle" | "copied" | "failed">("idle");

  const formattedPlanJson = React.useMemo(
    () => (scenePlan ? JSON.stringify(scenePlan, null, 2) : "{}"),
    [scenePlan],
  );

  const handleCopyPlanJson = React.useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(formattedPlanJson);
      setPlanJsonCopyStatus("copied");
    } catch {
      setPlanJsonCopyStatus("failed");
    }
  }, [formattedPlanJson]);

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

  // Custom duration draft state
  const [customDurationDraft, setCustomDurationDraft] = React.useState<string | null>(null);
  const [planFeedback, setPlanFeedback] = React.useState<string | null>(null);

  const durationInputValue =
    customDurationDraft ?? (selectedClip?.type === "image" ? selectedClip.duration.toFixed(1) : "");

  const handleCustomDurationCommit = React.useCallback(() => {
    if (!selectedClip || selectedClip.type !== "image") return;
    const val = parseFloat(durationInputValue);
    if (!isNaN(val) && val >= 0.5 && val <= 60) {
      setImageClipDuration(selectedClip.id, val);
    }
    setCustomDurationDraft(null);
  }, [selectedClip, durationInputValue, setImageClipDuration]);

  const handleAutoPlanMotion = React.useCallback(() => {
    if (!scenePlan) return;
    const res = applyPlanAutoMotions(scenePlan, 1920, 1080);
    const msg =
      res.appliedCount > 0
        ? `Applied safe auto-motion to ${res.appliedCount} image scene(s).`
        : "No eligible image shots with motion suggestions found.";
    setPlanFeedback(msg);
    setTimeout(() => setPlanFeedback(null), 4000);
  }, [scenePlan, applyPlanAutoMotions]);

  const handleAutoPlanTransitions = React.useCallback(() => {
    if (!scenePlan) return;
    const res = applyPlanAutoTransitions(scenePlan);
    const msg =
      res.appliedCount > 0
        ? `Applied ${res.appliedCount} transition(s) from plan.`
        : "No eligible adjacent clip pairs found for transitions.";
    setPlanFeedback(msg);
    setTimeout(() => setPlanFeedback(null), 4000);
  }, [scenePlan, applyPlanAutoTransitions]);

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

  useTimelineWheelPan(tracksScrollRef);

  // Adaptive ruler ticks: frame notation at deep zoom (>=500%), seconds at medium zoom, wider at low zoom
  const rulerTicks = React.useMemo(() => {
    const span = calculateTimelineRulerSpan(totalDuration, tracksContentWidth, pxPerSec);
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
    const targetScrollLeft = calculateZoomPreservingScrollLeft({
      scrollLeft: scrollEl.scrollLeft,
      viewportWidth,
      oldPixelsPerSecond: getPixelsPerSecond(zoom),
      newPixelsPerSecond: getPixelsPerSecond(clamped),
    });

    setZoom(clamped);
    requestAnimationFrame(() => {
      scrollEl.scrollLeft = targetScrollLeft;
    });
  };

  // Convert pointer clientX to timeline seconds with full scroll & zoom accuracy
  const getTimeFromClientX = React.useCallback(
    (clientX: number): number => {
      if (!tracksScrollRef.current) return 0;
      const containerRect = tracksScrollRef.current.getBoundingClientRect();
      return calculatePlayheadTimeFromPointer({
        clientX,
        containerLeft: containerRect.left,
        scrollLeft: tracksScrollRef.current.scrollLeft,
        pixelsPerSecond: pxPerSec,
        totalDuration,
      });
    },
    [pxPerSec, totalDuration]
  );

  const startPlayheadDrag = usePlayheadScrub({
    pause,
    getTimeFromClientX,
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

  const { startMoveDrag, startLeftTrimDrag, startRightTrimDrag } = useTimelineClipGestures({
    clips,
    tracks,
    playhead: playheadStore.getPlayhead,
    pxPerSec,
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

  // Group clips by dynamic trackId (handling any legacy aliases safely)
  const clipsByTrack = React.useMemo(() => {
    const map = new Map<string, TimelineClip[]>();
    for (const track of orderedTracks) {
      map.set(track.id, []);
    }
    for (const clip of clips) {
      const matchingTrack = orderedTracks.find((t) => areClipsOnSameTrack(t.id, clip.trackId, tracks));
      const targetId = matchingTrack ? matchingTrack.id : clip.trackId;
      const list = map.get(targetId);
      if (list) {
        list.push(clip);
      } else {
        map.set(targetId, [clip]);
      }
    }
    return map;
  }, [orderedTracks, clips, tracks]);

  const assetMap = React.useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const hasAudio = React.useMemo(() => clips.some((c) => isAudioTrack(c.trackId, tracks)), [clips, tracks]);
  const hasVisual = React.useMemo(() => clips.some((c) => isVisualTrack(c.trackId, tracks)), [clips, tracks]);

  // Track Inline Rename & Delete Confirmation State
  const [editingTrackId, setEditingTrackId] = React.useState<string | null>(null);
  const [editingTrackName, setEditingTrackName] = React.useState<string>("");
  const [trackToDelete, setTrackToDelete] = React.useState<TimelineTrack | null>(null);

  const sidebarScrollRef = React.useRef<HTMLDivElement>(null);

  // Horizontal viewport windowing for ruler and tracks
  const [scrollState, setScrollState] = React.useState({ scrollLeft: 0, viewportWidth: 1200 });

  const handleTracksScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (sidebarScrollRef.current && sidebarScrollRef.current.scrollTop !== target.scrollTop) {
      sidebarScrollRef.current.scrollTop = target.scrollTop;
    }
    const sLeft = target.scrollLeft;
    const vWidth = target.clientWidth || 1200;
    setScrollState((prev) => {
      if (Math.abs(prev.scrollLeft - sLeft) < 16 && prev.viewportWidth === vWidth) return prev;
      return { scrollLeft: sLeft, viewportWidth: vWidth };
    });
  }, []);

  React.useEffect(() => {
    const el = tracksScrollRef.current;
    if (!el) return;
    setScrollState({ scrollLeft: el.scrollLeft, viewportWidth: el.clientWidth || 1200 });
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScrollState((prev) => ({ ...prev, viewportWidth: entry.contentRect.width || 1200 }));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const overscanPx = Math.max(800, scrollState.viewportWidth);
  const visibleStartPx = Math.max(0, scrollState.scrollLeft - overscanPx);
  const visibleEndPx = scrollState.scrollLeft + scrollState.viewportWidth + overscanPx;
  const visibleStartTime = visibleStartPx / pxPerSec;
  const visibleEndTime = visibleEndPx / pxPerSec;

  const visibleRulerTicks = React.useMemo(() => {
    return rulerTicks.filter(
      (tick) => tick.leftPx >= visibleStartPx && tick.leftPx <= visibleEndPx
    );
  }, [rulerTicks, visibleStartPx, visibleEndPx]);

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

  const renderTrackSidebarHeader = (track: TimelineTrack) => (
    <TimelineTrackSidebarHeader
      key={`sidebar_header_${track.id}`}
      track={track}
      trackClips={clipsByTrack.get(track.id) || []}
      editingTrackId={editingTrackId}
      editingTrackName={editingTrackName}
      setEditingTrackId={setEditingTrackId}
      setEditingTrackName={setEditingTrackName}
      orderedVisualTracks={orderedVisualTracks}
      orderedAudioTracks={orderedAudioTracks}
      startRename={startRename}
      finishRename={finishRename}
      toggleTrackVisibility={toggleTrackVisibility}
      toggleTrackMute={toggleTrackMute}
      toggleTrackLock={toggleTrackLock}
      reorderTrack={reorderTrack}
      handleDeleteClick={handleDeleteClick}
    />
  );
  const renderVisualTrackLane = (track: TimelineTrack, trackClips: TimelineClip[]) => (
    <TimelineVisualTrackLane
      key={`visual-lane_${track.id}`}
      track={track}
      trackClips={trackClips}
      visibleStartTime={visibleStartTime}
      visibleEndTime={visibleEndTime}
      isHydrated={isHydrated}
      rulerTicks={visibleRulerTicks}
      tracksContentWidth={tracksContentWidth}
      assetMap={assetMap}
      pixelsPerSecond={pxPerSec}
      transitions={transitions}
      selectedClipId={selectedClipId}
      selectedTransitionId={selectedTransitionId}
      onTrackDrop={handleTrackDrop}
      onSelectClip={selectClip}
      onSelectTransition={selectTransition}
      onAddTransition={addTransition}
      onMoveDrag={startMoveDrag}
      onLeftTrimDrag={startLeftTrimDrag}
      onRightTrimDrag={startRightTrimDrag}
    />
  );
  const renderAudioTrackLane = (track: TimelineTrack, trackClips: TimelineClip[]) => (
    <TimelineAudioTrackLane
      key={`audio-lane_${track.id}`}
      track={track}
      trackClips={trackClips}
      visibleStartTime={visibleStartTime}
      visibleEndTime={visibleEndTime}
      isHydrated={isHydrated}
      rulerTicks={visibleRulerTicks}
      tracksContentWidth={tracksContentWidth}
      assetMap={assetMap}
      pixelsPerSecond={pxPerSec}
      selectedClipId={selectedClipId}
      onTrackDrop={handleTrackDrop}
      onSelectClip={selectClip}
      onMoveDrag={startMoveDrag}
      onLeftTrimDrag={startLeftTrimDrag}
      onRightTrimDrag={startRightTrimDrag}
    />
  );
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
            <TimelinePlayheadDisplay isHydrated={isHydrated} />

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

                  {/* Image Duration Presets & Custom Duration Control */}
                  {selectedClip.type === "image" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSelectedClipLocked}
                            title="Image duration presets and custom length"
                            aria-label="Image duration presets"
                          >
                            <Clock className="size-3.5 text-primary" />
                            <span className="font-mono tabular-nums">
                              {selectedClip.duration.toFixed(1)}s
                            </span>
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Image Duration</DropdownMenuLabel>
                          {IMAGE_DURATION_PRESETS.map((dur) => {
                            const isCurrent = Math.abs(selectedClip.duration - dur) < 0.05;
                            return (
                              <DropdownMenuItem
                                key={dur}
                                disabled={isCurrent}
                                onClick={() => setImageClipDuration(selectedClip.id, dur)}
                              >
                                <Check
                                  className={`size-3.5 ${isCurrent ? "text-primary" : "opacity-0"}`}
                                />
                                <span className="font-mono">{dur}.0 seconds</span>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <div className="flex items-center gap-1.5 p-2">
                          <Input
                            type="number"
                            min={0.5}
                            max={60}
                            step={0.5}
                            value={durationInputValue}
                            onChange={(e) => setCustomDurationDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCustomDurationCommit();
                            }}
                            onBlur={handleCustomDurationCommit}
                            className="h-7 w-20 font-mono text-xs"
                            aria-label="Custom image duration in seconds"
                          />
                          <span className="text-3xs text-muted-foreground font-mono">sec</span>
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={handleCustomDurationCommit}
                          >
                            Set
                          </Button>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Rotate +90° Quick Button (Canvas-Edge Safe) */}
                  {isVisualTrack(selectedClip.trackId, tracks) && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={isSelectedClipLocked}
                            onClick={() => rotateClip90(selectedClip.id, 1920, 1080)}
                            aria-label="Rotate clip +90 degrees"
                            title={`Rotate clip +90° (current: ${selectedClip.transform?.rotation || 0}°)`}
                          >
                            <RotateCw className="size-3.5 text-primary" />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <span>Rotate +90° (Canvas-edge safe)</span>
                      </TooltipContent>
                    </Tooltip>
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
              <div className="ml-auto flex items-center gap-2 text-2xs text-muted-foreground select-none pr-1">
                {scenePlan ? (
                  <div className="flex items-center gap-1 shrink-0 mr-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setPlanJsonCopyStatus("idle");
                        setIsPlanJsonOpen(true);
                      }}
                      title="View the active Story Plan JSON"
                      className="gap-1 text-primary hover:bg-primary/10"
                    >
                      <FileText className="size-3" />
                      <span>View JSON</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setIsImportPlanOpen(true)}
                      title="Edit or replace active Story Plan"
                      className="gap-1 text-primary hover:bg-primary/10"
                    >
                      <FileText className="size-3" />
                      <span>Edit Plan</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleAutoPlanMotion}
                      title="Apply safe Ken Burns motion from plan"
                    >
                      <Move className="size-3 text-primary" />
                      <span>Auto-Motion</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={handleAutoPlanTransitions}
                      title="Apply transition boundaries from plan"
                    >
                      <Layers className="size-3 text-primary" />
                      <span>Auto-Transitions</span>
                    </Button>
                    {planFeedback && (
                      <span className="font-mono text-3xs text-primary font-semibold animate-in fade-in">
                        {planFeedback}
                      </span>
                    )}
                    <div className="h-4 w-px bg-border mx-0.5 shrink-0" />
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setIsImportPlanOpen(true)}
                    title="Import AI Story and Shot Plan"
                    className="gap-1 mr-1 text-primary hover:bg-primary/10"
                  >
                    <FileText className="size-3" />
                    <span>Import Plan</span>
                  </Button>
                )}
                <div className="flex items-center gap-1.5">
                  <MousePointerClick className="size-3.5 text-muted-foreground/70" />
                  <span>Select a scene clip or plan shot to edit motion, duration &amp; layers</span>
                </div>
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

          {/* Plan Shelf Sidebar Header */}
          <div className="flex h-7 shrink-0 items-center justify-between border-b border-border bg-card/80 px-2.5 text-3xs font-medium text-foreground">
            <span className="flex items-center gap-1.5">
              <FileText className="size-3 text-primary" />
              <span>Story Plan</span>
            </span>
            {scenePlan && scenePlan.scenes.length > 0 ? (
              <div className="flex items-center gap-1">
                <span className="font-mono text-3xs text-muted-foreground">
                  {getAllShotsFromPlan(scenePlan).length} shots
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setIsImportPlanOpen(true)}
                  title="Edit or replace Story Plan"
                  className="size-5"
                >
                  <Pencil className="size-2.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsImportPlanOpen(true)}
                title="Import AI Story Plan"
                className="h-5 px-1.5 text-3xs gap-1"
              >
                <Plus className="size-2.5 text-primary" />
                <span>Import</span>
              </Button>
            )}
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
              {visibleRulerTicks.map((tick) => (
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

            {/* Story Shot Plan Shelf / Visual Blocks */}
            {scenePlan && scenePlan.scenes.length > 0 && (
              <div
                style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
                className="relative flex h-7 min-w-full shrink-0 items-center border-b border-border bg-surface-subtle/50 px-1 overflow-visible select-none"
              >
                {getAllShotsFromPlan(scenePlan).map((shot) => {
                  const leftPos = shot.startTime * pxPerSec;
                  const widthPx = Math.max(28, shot.duration * pxPerSec);
                  const isAssigned = Boolean(shot.assignedClipId || shot.assignedAssetId);
                  const isSelected = selectedPlanShotId === shot.shotId;

                  return (
                    <div
                      key={shot.shotId}
                      onClick={() => selectPlanShot(shot.shotId)}
                      style={{ left: `${leftPos}px`, width: `${widthPx}px` }}
                      title={`Shot: ${shot.shotId}\n${shot.prompt}\nVO: ${shot.voiceover || "N/A"}`}
                      className={`group absolute flex h-5 items-center justify-between overflow-hidden rounded px-1.5 text-3xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "ring-2 ring-primary bg-primary/20 text-foreground z-20 border border-primary shadow-xs"
                          : isAssigned
                            ? "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/15"
                            : "border border-dashed border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <span className="truncate flex items-center gap-1">
                        <span>{shot.mediaKind === "video" ? "🎥" : "🖼️"}</span>
                        <span>{shot.shotId}</span>
                      </span>
                      <span className="font-mono tabular-nums opacity-70 ml-1 shrink-0">
                        {shot.duration.toFixed(1)}s
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

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
            <TimelinePlayheadNeedle
              pxPerSec={pxPerSec}
              totalDuration={totalDuration}
              onStartPlayheadDrag={startPlayheadDrag}
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

      {/* Import Story Plan Dialog */}
      <ImportPlanDialog
        open={isImportPlanOpen}
        onOpenChange={setIsImportPlanOpen}
        existingPlan={scenePlan}
        onApplyPlan={(plan) => setScenePlan(plan)}
      />

      <Dialog
        open={isPlanJsonOpen}
        onOpenChange={(open) => {
          setIsPlanJsonOpen(open);
          if (open) setPlanJsonCopyStatus("idle");
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Active Story Plan JSON</DialogTitle>
            <DialogDescription>
              Read the current imported plan, including each shot duration, start time, prompt, motion, and transition.
            </DialogDescription>
          </DialogHeader>
          <pre
            aria-label="Active Story Plan JSON"
            className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-3 font-mono text-2xs text-foreground"
          >
            {formattedPlanJson}
          </pre>
          <DialogFooter>
            {planJsonCopyStatus === "failed" && (
              <span className="self-center text-2xs text-destructive" role="status">
                Copy failed. Select the JSON above and copy it manually.
              </span>
            )}
            {planJsonCopyStatus === "copied" && (
              <span className="self-center text-2xs text-primary" role="status">
                JSON copied.
              </span>
            )}
            <Button variant="outline" onClick={handleCopyPlanJson}>
              <Copy className="size-3.5" />
              <span>Copy JSON</span>
            </Button>
            <Button variant="secondary" onClick={() => setIsPlanJsonOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
