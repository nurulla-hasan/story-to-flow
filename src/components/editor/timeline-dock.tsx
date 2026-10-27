"use client";

import * as React from "react";
import {
  Scissors,
  Trash2,
  Copy,
  Video,
  Mic,
  ZoomIn,
  ZoomOut,
  Magnet,
  Volume2,
  Eye,
  Lock,
  Wand2,
  Layers,
  Plus,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTimeline } from "@/lib/timeline-context";
import { useMediaLibrary } from "@/lib/use-media-library";
import { AudioWaveformView } from "@/components/editor/audio-waveform-view";
import {
  type TimelineClip,
  type TrackId,
  isAudioTrack,
} from "@/types/timeline";
import { findAdjacentClipPairs } from "@/lib/transition-helpers";
import { calculateLeftTrim, calculateRightTrim } from "@/lib/timeline-trim";
import {
  clampMoveToPreventOverlap,
  clampLeftTrimToPreventOverlap,
  clampRightTrimToPreventOverlap,
} from "@/lib/timeline-overlap";
import {
  getPixelsPerSecond,
  generateAdaptiveRulerTicks,
  MIN_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
} from "@/lib/ruler-scale";
import { calculatePlayheadTimeFromPointer } from "@/lib/playhead-coordinates";

export function TimelineDock() {
  const {
    isHydrated,
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
    playhead,
    seek,
    commitPlayhead,
    pause,
    zoom,
    setZoom,
    totalDuration,
    addAssetToTimeline,
    fitVisualsToVoiceover,
  } = useTimeline();

  const { assets } = useMediaLibrary();

  // Magnetic snapping state & visual guide line
  const [snapEnabled, setSnapEnabled] = React.useState<boolean>(true);
  const [activeSnapGuide, setActiveSnapGuide] = React.useState<number | null>(null);

  // Pixels per second scaled by wide zoom range (10% to 1000%)
  const pxPerSec = getPixelsPerSecond(zoom);

  // Minimum 1200px or duration-based width so ruler & tracks span full viewport
  const tracksContentWidth = Math.max(1200, (totalDuration + 10) * pxPerSec);

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
    const span = Math.max(totalDuration + 10, tracksContentWidth / pxPerSec);
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

  const playheadCleanupRef = React.useRef<(() => void) | null>(null);

  // Clean up any lingering playhead listeners if component unmounts while dragging
  React.useEffect(() => {
    return () => {
      if (playheadCleanupRef.current) {
        playheadCleanupRef.current();
      }
    };
  }, []);

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

  // Continuous pointer tracking for Playhead handle & Ruler scrubbing
  const startPlayheadDrag = React.useCallback(
    (e: React.PointerEvent) => {
      // Only handle primary button (left click / touch / stylus)
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      // Pause playback if active so it doesn't fight scrubbing
      pause();

      // Set pointer capture on target element if supported
      try {
        if (e.currentTarget && typeof e.currentTarget.setPointerCapture === "function") {
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      } catch {
        // Fallback to window listeners
      }

      // Immediate seek on pointerdown (click-to-seek responsiveness)
      const initialTime = getTimeFromClientX(e.clientX);
      seek(initialTime);
      let lastSeekTime = initialTime;

      const onPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const newTime = getTimeFromClientX(moveEvent.clientX);
        lastSeekTime = newTime;
        seek(newTime);
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        window.removeEventListener("keydown", onKeyDown);
        playheadCleanupRef.current = null;
        // Persist once at the end of the scrub, never on each pointer frame.
        commitPlayhead(lastSeekTime);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        upEvent.preventDefault();
        cleanup();
      };

      const onPointerCancel = () => {
        cleanup();
      };

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") {
          cleanup();
        }
      };

      playheadCleanupRef.current = cleanup;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("keydown", onKeyDown);
    },
    [pause, getTimeFromClientX, seek, commitPlayhead]
  );

  // Drag-and-drop from Media Library onto tracks with unified coordinate mapping
  const handleTrackDrop = (e: React.DragEvent, trackId: TrackId) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (raw) {
        const asset = JSON.parse(raw);
        if (asset && asset.id) {
          const dropTime = getTimeFromClientX(e.clientX);
          addAssetToTimeline(asset, trackId, dropTime);
        }
      }
    } catch (err) {
      console.error("Failed to drop media asset onto timeline:", err);
    }
  };

  // Compute snap points from playhead, timeline start, and other clips' boundaries
  const getSnapPoints = React.useCallback(
    (excludeClipId: string): number[] => {
      const points = [0, playhead];
      clips.forEach((c) => {
        if (c.id !== excludeClipId) {
          points.push(c.startTime);
          points.push(c.startTime + c.duration);
        }
      });
      return points;
    },
    [clips, playhead]
  );

  // Interactive Clip Move Dragging Handler with Magnetic Snapping & Overlap Prevention
  const startMoveDrag = (e: React.PointerEvent, clip: TimelineClip) => {
    e.stopPropagation();
    selectClip(clip.id);

    const startX = e.clientX;
    const initialClips: TimelineClip[] = JSON.parse(JSON.stringify(clips));
    const initialStart = clip.startTime;
    const snapThresholdSec = 10 / pxPerSec;
    const snapPoints = getSnapPoints(clip.id);
    let latestClips = initialClips;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let rawStart = Math.max(0, initialStart + deltaX / pxPerSec);
      let snapped = false;

      // Magnetic Snapping
      if (snapEnabled && !moveEvent.shiftKey) {
        const rawEnd = rawStart + clip.duration;
        for (const pt of snapPoints) {
          if (Math.abs(rawStart - pt) <= snapThresholdSec) {
            rawStart = pt;
            setActiveSnapGuide(pt);
            snapped = true;
            break;
          }
          if (Math.abs(rawEnd - pt) <= snapThresholdSec) {
            rawStart = Math.max(0, pt - clip.duration);
            setActiveSnapGuide(pt);
            snapped = true;
            break;
          }
        }
      }

      if (!snapped) {
        setActiveSnapGuide(null);
      }

      // Clamping to prevent overlapping on the same visual track
      const nonOverlappingStart = clampMoveToPreventOverlap(clip, rawStart, initialClips);

      latestClips = initialClips.map((c) =>
        c.id === clip.id ? { ...c, startTime: nonOverlappingStart } : c
      );
      setClipsTransient(latestClips);
    };

    const cleanup = () => {
      setActiveSnapGuide(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
    };

    const onPointerUp = () => {
      cleanup();
      commitClipGesture(initialClips, latestClips);
    };

    const onPointerCancel = () => {
      cleanup();
      cancelClipGesture(initialClips);
    };

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") {
        cleanup();
        cancelClipGesture(initialClips);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
  };

  // Interactive Clip LEFT-EDGE Trim Dragging (In-Point & Anchored Right Edge & Overlap Prevention)
  const startLeftTrimDrag = (e: React.PointerEvent, clip: TimelineClip) => {
    e.stopPropagation();
    selectClip(clip.id);

    const startX = e.clientX;
    const initialClips: TimelineClip[] = JSON.parse(JSON.stringify(clips));
    const initialStartTime = clip.startTime;
    const snapThresholdSec = 10 / pxPerSec;
    const snapPoints = getSnapPoints(clip.id);
    let latestClips = initialClips;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let deltaSec = deltaX / pxPerSec;
      let snapped = false;

      if (snapEnabled && !moveEvent.shiftKey) {
        const proposedStart = initialStartTime + deltaSec;
        for (const pt of snapPoints) {
          if (Math.abs(proposedStart - pt) <= snapThresholdSec) {
            deltaSec = pt - initialStartTime;
            setActiveSnapGuide(pt);
            snapped = true;
            break;
          }
        }
      }

      if (!snapped) {
        setActiveSnapGuide(null);
      }

      const trimResult = calculateLeftTrim(clip, deltaSec);
      const nonOverlapping = clampLeftTrimToPreventOverlap(
        clip,
        trimResult.startTime,
        trimResult.duration,
        initialClips
      );

      latestClips = initialClips.map((c) =>
        c.id === clip.id
          ? {
              ...c,
              startTime: nonOverlapping.startTime,
              duration: nonOverlapping.duration,
              inPoint: trimResult.inPoint,
              outPoint: trimResult.outPoint,
            }
          : c
      );
      setClipsTransient(latestClips);
    };

    const cleanup = () => {
      setActiveSnapGuide(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
    };

    const onPointerUp = () => {
      cleanup();
      commitClipGesture(initialClips, latestClips);
    };

    const onPointerCancel = () => {
      cleanup();
      cancelClipGesture(initialClips);
    };

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") {
        cleanup();
        cancelClipGesture(initialClips);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
  };

  // Interactive Clip RIGHT-EDGE Trim Dragging (Duration & Anchored Start Time & Overlap Prevention)
  const startRightTrimDrag = (e: React.PointerEvent, clip: TimelineClip) => {
    e.stopPropagation();
    selectClip(clip.id);

    const startX = e.clientX;
    const initialClips: TimelineClip[] = JSON.parse(JSON.stringify(clips));
    const initialEndTime = clip.startTime + clip.duration;
    const snapThresholdSec = 10 / pxPerSec;
    const snapPoints = getSnapPoints(clip.id);
    let latestClips = initialClips;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let deltaSec = deltaX / pxPerSec;
      let snapped = false;

      if (snapEnabled && !moveEvent.shiftKey) {
        const proposedEnd = initialEndTime + deltaSec;
        for (const pt of snapPoints) {
          if (pt > clip.startTime && Math.abs(proposedEnd - pt) <= snapThresholdSec) {
            deltaSec = pt - initialEndTime;
            setActiveSnapGuide(pt);
            snapped = true;
            break;
          }
        }
      }

      if (!snapped) {
        setActiveSnapGuide(null);
      }

      const trimResult = calculateRightTrim(clip, deltaSec);
      const nonOverlappingDuration = clampRightTrimToPreventOverlap(
        clip,
        trimResult.duration,
        initialClips
      );

      latestClips = initialClips.map((c) =>
        c.id === clip.id
          ? {
              ...c,
              startTime: trimResult.startTime,
              duration: nonOverlappingDuration,
              inPoint: trimResult.inPoint,
              outPoint: trimResult.inPoint + nonOverlappingDuration,
            }
          : c
      );
      setClipsTransient(latestClips);
    };

    const cleanup = () => {
      setActiveSnapGuide(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKeyDown);
    };

    const onPointerUp = () => {
      cleanup();
      commitClipGesture(initialClips, latestClips);
    };

    const onPointerCancel = () => {
      cleanup();
      cancelClipGesture(initialClips);
    };

    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") {
        cleanup();
        cancelClipGesture(initialClips);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
  };

  // Multi-Track Layers Separation
  const visualLayer2Clips = clips.filter((c) => c.trackId === "visual-2");
  const visualLayer1Clips = clips.filter((c) => c.trackId === "visual-1" || c.trackId === "visual");
  const audioClips = clips.filter((c) => isAudioTrack(c.trackId));

  const hasAudio = audioClips.length > 0;
  const hasVisual = visualLayer1Clips.length > 0 || visualLayer2Clips.length > 0;

  // Render a visual track lane with dual-edge trim handles, clips, and transition seam badges
  const renderVisualTrackLane = (trackId: "visual-1" | "visual-2", trackClips: TimelineClip[]) => {
    const adjacentPairs = findAdjacentClipPairs(trackClips);

    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleTrackDrop(e, trackId)}
        style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
        className="min-w-full relative h-full flex items-center px-1 overflow-visible"
      >
        {/* Full-width vertical grid lines across the track lane */}
        {rulerTicks.map((tick) => (
          <div
            key={`grid_${tick.time}`}
            style={{ left: `${tick.leftPx}px` }}
            className="absolute top-0 bottom-0 w-px bg-border/20 pointer-events-none"
          />
        ))}

        {!isHydrated || trackClips.length === 0 ? (
          <div className="w-full border border-dashed border-border/60 rounded h-7 flex items-center justify-center text-3xs text-muted-foreground gap-1.5 bg-muted/5 pointer-events-none">
            <span>
              {trackId === "visual-2"
                ? "Drop PiP or overlay visual clips here (rendered in front)."
                : "Drag scene images or videos here, or click '+' in Media Library."}
            </span>
          </div>
        ) : (
          <>
            {/* Visual Clips on Track with Dual-Edge Trim Handles */}
            {trackClips.map((clip) => {
              const isSelected = clip.id === selectedClipId;
              const leftPos = clip.startTime * pxPerSec;
              const widthPx = Math.max(4, clip.duration * pxPerSec);
              const asset = assets.find((a) => a.id === clip.assetId);

              return (
                <div
                  key={clip.id}
                  style={{
                    left: `${leftPos}px`,
                    width: `${widthPx}px`,
                  }}
                  onPointerDown={(e) => startMoveDrag(e, clip)}
                  className={`group absolute h-8 rounded-md border flex items-center justify-between px-2 overflow-hidden transition-shadow select-none cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? "border-primary bg-primary/20 ring-2 ring-primary shadow-sm z-10"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  {/* Left-edge trim handle (in-point & anchored right edge) */}
                  <div
                    onPointerDown={(e) => startLeftTrimDrag(e, clip)}
                    className="absolute left-0 top-0 bottom-0 w-2.5 hover:w-3.5 bg-primary/25 hover:bg-primary cursor-ew-resize transition-all rounded-l z-20 flex items-center justify-center group/leftHandle"
                    title="Drag to trim start (in-point)"
                  >
                    <div className="w-0.5 h-3 bg-primary/70 group-hover/leftHandle:bg-primary-foreground rounded-full pointer-events-none" />
                  </div>

                  {/* Clip info & thumbnail */}
                  <div className="flex items-center gap-1 min-w-0 pointer-events-none px-1">
                    {asset?.thumbnailUrl || asset?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.thumbnailUrl || asset.url}
                        alt={clip.name}
                        className="size-5 rounded object-cover shrink-0"
                      />
                    ) : (
                      <Video className="size-3 text-primary shrink-0" />
                    )}
                    <span className="text-3xs font-medium text-foreground truncate">
                      {clip.name}
                    </span>
                  </div>

                  <span className="text-3xs font-mono text-muted-foreground shrink-0 pl-1 pointer-events-none pr-1">
                    {clip.duration.toFixed(1)}s
                  </span>

                  {/* Right-edge trim handle (duration & anchored start time) */}
                  <div
                    onPointerDown={(e) => startRightTrimDrag(e, clip)}
                    className="absolute right-0 top-0 bottom-0 w-2.5 hover:w-3.5 bg-primary/25 hover:bg-primary cursor-ew-resize transition-all rounded-r z-20 flex items-center justify-center group/rightHandle"
                    title="Drag to trim end (duration)"
                  >
                    <div className="w-0.5 h-3 bg-primary/70 group-hover/rightHandle:bg-primary-foreground rounded-full pointer-events-none" />
                  </div>
                </div>
              );
            })}

            {/* Transition Seam Indicators Between Adjacent Clips */}
            {adjacentPairs.map(({ fromClip, toClip }) => {
              const cutPx = toClip.startTime * pxPerSec;
              const existingTrans = transitions.find(
                (t) =>
                  (t.fromClipId === fromClip.id && t.toClipId === toClip.id) ||
                  (t.fromClipId === toClip.id && t.toClipId === fromClip.id)
              );
              const isSelected = existingTrans && existingTrans.id === selectedTransitionId;

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

  return (
    <Card size="sm" className="flex flex-col w-full shrink-0">
      {/* Timeline Controls Header — 100% Icon-Only Ghost Buttons with Tooltips */}
      <CardHeader className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Icon-Only Ghost Action Buttons with Descriptive Tooltips */}
          <div className="flex items-center gap-1">
            <div className="mr-1.5 flex items-center">
              <CardTitle className="flex items-center gap-1">
                Timeline
              </CardTitle>
            </div>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
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
                    size="icon"
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
                    size="icon"
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
                    size="icon"
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
          </div>

          {/* Right: Timeline Zoom, Snap & Playhead Position */}
          <div className="flex items-center gap-2">
            <div className="font-mono text-2xs bg-muted text-foreground font-semibold px-1.5 py-0.5 rounded">
              {isHydrated ? playhead.toFixed(2) : "0.00"}s
            </div>

            {/* Magnetic Snapping Ghost Toggle with Tooltip */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
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
            <div className="flex items-center gap-1.5 p-0.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
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

              <input
                type="range"
                min={MIN_TIMELINE_ZOOM}
                max={MAX_TIMELINE_ZOOM}
                step="5"
                value={zoom}
                onInput={(e) => handleZoomChange(Number((e.target as HTMLInputElement).value))}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                aria-label="Timeline zoom scale"
                className="w-16 sm:w-24 accent-primary cursor-pointer h-1"
              />

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
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

              <Badge variant="ghost">
                {isHydrated ? zoom : 100}%
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Main Timeline Card Content: Pinned Left Track Sidebar + Horizontally Scrolling Canvas */}
      <CardContent className="p-0 flex flex-row overflow-hidden border-t border-border">
        {/* PINNED LEFT TRACK SIDEBAR (Immune to Horizontal Scrolling, Always Visible) */}
        <div className="w-36 shrink-0 border-r border-border bg-card z-30 flex flex-col select-none">
          {/* Header Row */}
          <div className="h-6 border-b border-border bg-muted/40 px-2 flex items-center text-3xs text-muted-foreground uppercase font-medium">
            Tracks
          </div>

          {/* Layer 2 Header Row */}
          <div className="h-11 border-b border-border p-2 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-1.5">
              <div className="size-5 rounded bg-primary/15 flex items-center justify-center text-primary">
                <Layers className="size-3" />
              </div>
              <div>
                <p className="text-2xs font-semibold text-foreground leading-tight">
                  Visual Layer 2
                </p>
                <p className="text-3xs text-muted-foreground">Overlay (Top)</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-muted-foreground">
              <Eye className="size-2.5" />
              <Lock className="size-2.5" />
            </div>
          </div>

          {/* Layer 1 Header Row */}
          <div className="h-11 border-b border-border p-2 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-1.5">
              <div className="size-5 rounded bg-primary/10 flex items-center justify-center text-primary">
                <Video className="size-3" />
              </div>
              <div>
                <p className="text-2xs font-semibold text-foreground leading-tight">
                  Visual Layer 1
                </p>
                <p className="text-3xs text-muted-foreground">{visualLayer1Clips.length} clips</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-muted-foreground">
              <Eye className="size-2.5" />
              <Lock className="size-2.5" />
            </div>
          </div>

          {/* Voiceover Header Row */}
          <div className="h-11 p-2 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-1.5">
              <div className="size-5 rounded bg-secondary flex items-center justify-center text-foreground">
                <Mic className="size-3" />
              </div>
              <div>
                <p className="text-2xs font-semibold text-foreground leading-tight">
                  Voiceover
                </p>
                <p className="text-3xs text-muted-foreground">{audioClips.length} tracks</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-muted-foreground">
              <Volume2 className="size-2.5" />
              <Lock className="size-2.5" />
            </div>
          </div>
        </div>

        {/* HORIZONTALLY SCROLLING TIMELINE CANVAS */}
        <div
          ref={tracksScrollRef}
          className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden select-none"
        >
          <div
            style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
            className="min-w-full flex flex-col relative"
          >
            {/* Time Ruler Section covering 100% of the canvas */}
            <div
              ref={rulerRef}
              onPointerDown={startPlayheadDrag}
              style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
              className="min-w-full relative h-6 border-b border-border bg-muted/30 cursor-pointer hover:bg-muted/50 select-none"
            >
              {rulerTicks.map((tick) => (
                <div
                  key={`ruler_${tick.time}_${tick.label}`}
                  style={{ left: `${tick.leftPx}px` }}
                  className="absolute bottom-0 flex flex-col items-start pointer-events-none"
                >
                  <span
                    className={`text-3xs font-mono pl-1 ${
                      tick.isFrame ? "text-primary/80 font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {tick.label}
                  </span>
                  <div className="w-px h-1.5 bg-border" />
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

              {/* Layer 2: Visual Track 2 (Overlay / Top Visual Layer) */}
              <div className="flex h-11 bg-card hover:bg-muted/10 transition-colors min-w-full">
                {renderVisualTrackLane("visual-2", visualLayer2Clips)}
              </div>

              {/* Layer 1: Visual Track 1 (Base / Main Visual Layer) */}
              <div className="flex h-11 bg-card hover:bg-muted/10 transition-colors min-w-full">
                {renderVisualTrackLane("visual-1", visualLayer1Clips)}
              </div>

              {/* Track 3: Voiceover Narration (Cartesia Audio) with Visual Fade Ramps */}
              <div className="flex h-11 bg-card hover:bg-muted/10 transition-colors min-w-full">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleTrackDrop(e, "audio")}
                  style={{ minWidth: "100%", width: `${tracksContentWidth}px` }}
                  className="min-w-full relative h-full flex items-center px-1 overflow-visible"
                >
                  {/* Full-width vertical grid lines across audio lane */}
                  {rulerTicks.map((tick) => (
                    <div
                      key={`audio_grid_${tick.time}`}
                      style={{ left: `${tick.leftPx}px` }}
                      className="absolute top-0 bottom-0 w-px bg-border/20 pointer-events-none"
                    />
                  ))}

                  {!isHydrated || audioClips.length === 0 ? (
                    <div className="w-full border border-dashed border-border rounded h-7 flex items-center justify-center text-3xs text-muted-foreground gap-1.5 bg-muted/10 pointer-events-none">
                      <Mic className="size-3 text-muted-foreground/60" />
                      <span>Drag voiceover audio here to align visual scene pacing.</span>
                    </div>
                  ) : (
                    audioClips.map((clip) => {
                      const isSelected = clip.id === selectedClipId;
                      const leftPos = clip.startTime * pxPerSec;
                      const widthPx = Math.max(4, clip.duration * pxPerSec);
                      const asset = assets.find((a) => a.id === clip.assetId);

                      return (
                        <div
                          key={clip.id}
                          style={{
                            left: `${leftPos}px`,
                            width: `${widthPx}px`,
                          }}
                          onPointerDown={(e) => startMoveDrag(e, clip)}
                          className={`group absolute h-8 rounded-md border flex items-center justify-between px-2 overflow-hidden transition-shadow select-none cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? "border-primary bg-primary/25 ring-2 ring-primary shadow-sm z-10"
                              : "border-border bg-card hover:border-primary/50"
                          }`}
                        >
                          {/* Left-edge trim handle */}
                          <div
                            onPointerDown={(e) => startLeftTrimDrag(e, clip)}
                            className="absolute left-0 top-0 bottom-0 w-2.5 hover:w-3.5 bg-primary/25 hover:bg-primary cursor-ew-resize transition-all rounded-l z-20 flex items-center justify-center group/leftHandle"
                            title="Drag to trim start (in-point)"
                          >
                            <div className="w-0.5 h-3 bg-primary/70 group-hover/leftHandle:bg-primary-foreground rounded-full pointer-events-none" />
                          </div>

                          {/* Audio Waveform Visualization with Fade-In / Fade-Out Ramps */}
                          <div className="absolute inset-0 flex items-center justify-center px-1 overflow-hidden pointer-events-none opacity-40">
                            <AudioWaveformView
                              blob={asset?.blob || null}
                              clipDuration={clip.duration}
                              fadeInDuration={clip.fadeInDuration || 0}
                              fadeOutDuration={clip.fadeOutDuration || 0}
                            />
                          </div>

                          <div className="flex items-center gap-1.5 min-w-0 pointer-events-none z-10 px-1">
                            <Mic className="size-3 text-primary shrink-0" />
                            <span className="text-3xs font-medium text-foreground truncate">
                              {clip.name}
                            </span>
                          </div>

                          <span className="text-3xs font-mono text-muted-foreground shrink-0 pl-1 pointer-events-none z-10 pr-1">
                            {clip.duration.toFixed(1)}s
                          </span>

                          {/* Right-edge trim handle */}
                          <div
                            onPointerDown={(e) => startRightTrimDrag(e, clip)}
                            className="absolute right-0 top-0 bottom-0 w-2.5 hover:w-3.5 bg-primary/25 hover:bg-primary cursor-ew-resize transition-all rounded-r z-20 flex items-center justify-center group/rightHandle"
                            title="Drag to trim duration"
                          >
                            <div className="w-0.5 h-3 bg-primary/70 group-hover/rightHandle:bg-primary-foreground rounded-full pointer-events-none" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
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
      </CardContent>
    </Card>
  );
}
