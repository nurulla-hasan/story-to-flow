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
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Wand2,
  Layers,
  Plus,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  Pencil,
  CopyCheck,
  Sparkles,
  MousePointerClick,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
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
import { AudioWaveformView } from "@/components/editor/audio-waveform-view";
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
  areClipsOnSameTrack,
} from "@/types/timeline";
import { findAdjacentClipPairs } from "@/lib/transition-helpers";
import { calculateLeftTrimWithOverlap, calculateRightTrim, applyRippleExtend } from "@/lib/timeline-trim";
import { reorderClipOnTrack } from "@/lib/timeline-reorder";
import {
  getPixelsPerSecond,
  generateAdaptiveRulerTicks,
  MIN_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
} from "@/lib/ruler-scale";
import { calculatePlayheadTimeFromPointer } from "@/lib/playhead-coordinates";
import {
  DEFAULT_ZOOM_EFFECT_AMOUNT,
  MAX_ZOOM_EFFECT_AMOUNT,
  MIN_ZOOM_EFFECT_AMOUNT,
  sanitizeZoomEffect,
  type ZoomEffectType,
  type ClipZoomEffect,
} from "@/lib/zoom-effect";

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
  const motionAmountPct = Math.round(
    (activeMotionEffect?.amount ?? DEFAULT_ZOOM_EFFECT_AMOUNT) * 100
  );

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

  const handleTimelineMotionAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) / 100;
    const safeAmount = Math.max(MIN_ZOOM_EFFECT_AMOUNT, Math.min(MAX_ZOOM_EFFECT_AMOUNT, val));

    if (selectedImageClip && selectedImageClip.zoomEffect) {
      const updated = sanitizeZoomEffect({ ...selectedImageClip.zoomEffect, amount: safeAmount });
      updateClip(selectedImageClip.id, { zoomEffect: updated });
    } else {
      setUnselectedPreset((prev) => ({ ...prev, amount: safeAmount }));
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

  // Interactive Clip Move Dragging Handler with Magnetic Snapping & Track Reordering
  const startMoveDrag = (e: React.PointerEvent, clip: TimelineClip) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    selectClip(clip.id);
    if (isTrackLocked(clip.trackId, tracks)) return;

    const startX = e.clientX;
    const initialClips: TimelineClip[] = JSON.parse(JSON.stringify(clips));
    const initialStart = clip.startTime;
    const snapThresholdSec = 10 / pxPerSec;
    const snapPoints = getSnapPoints(clip.id);
    const isVisualClip = isVisualTrack(clip.trackId, tracks);
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

      if (isVisualClip) {
        // Reorder within the lane: closes the source gap and opens an insertion
        // gap at the drop position instead of clamping against occupied clips.
        const result = reorderClipOnTrack(clip, rawStart, initialClips, tracks);
        latestClips = result.clips;
        setDragInsertTime(result.insertionTime);
      } else {
        // Audio clips keep free positioning so voiceovers can overlap music.
        const safeStart = parseFloat(Math.max(0, rawStart).toFixed(3));
        latestClips = initialClips.map((c) =>
          c.id === clip.id ? { ...c, startTime: safeStart } : c
        );
        setDragInsertTime(safeStart);
      }

      setClipsTransient(latestClips);
    };

    const cleanup = () => {
      setActiveSnapGuide(null);
      setDragInsertTime(null);
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
    if (isTrackLocked(clip.trackId, tracks)) return;

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

      const trimResult = calculateLeftTrimWithOverlap(clip, deltaSec, initialClips, 0.5, tracks);

      latestClips = initialClips.map((c) =>
        c.id === clip.id
          ? {
              ...c,
              startTime: trimResult.startTime,
              duration: trimResult.duration,
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
    if (isTrackLocked(clip.trackId, tracks)) return;

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
      latestClips = applyRippleExtend(clip.id, trimResult.duration, initialClips, tracks);
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

  // Render a track header row in the pinned left sidebar
  const renderTrackSidebarHeader = (track: TimelineTrack) => {
    const trackClips = clipsByTrack.get(track.id) || [];
    const isVisual = track.type === "visual";
    const visualIndex = orderedVisualTracks.findIndex((t) => t.id === track.id);
    const isFirstVisual = visualIndex === 0;
    const isLastVisual = visualIndex === orderedVisualTracks.length - 1;

    const audioIndex = orderedAudioTracks.findIndex((t) => t.id === track.id);
    const isFirstAudio = audioIndex === 0;
    const isLastAudio = audioIndex === orderedAudioTracks.length - 1;

    const isFirst = isVisual ? isFirstVisual : isFirstAudio;
    const isLast = isVisual ? isLastVisual : isLastAudio;

    return (
      <div
        key={`sidebar_header_${track.id}`}
        className={`h-11 border-b border-border p-2 flex items-center justify-between gap-1 transition-colors ${
          track.locked ? "bg-muted/30" : "bg-muted/15 hover:bg-muted/25"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div
            className={`size-5 rounded flex items-center justify-center shrink-0 ${
              isVisual
                ? "bg-primary/15 text-primary"
                : track.role === "voiceover"
                ? "bg-secondary text-foreground"
                : "bg-primary/10 text-primary"
            }`}
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
                  className="text-2xs font-semibold text-foreground leading-tight truncate max-w-20 cursor-pointer"
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
              <Lock className="size-3 text-amber-500" />
            ) : (
              <Unlock className="size-3 text-muted-foreground/40 hover:text-foreground" />
            )}
          </button>

          <button
            type="button"
            disabled={isFirst}
            onClick={() => reorderTrack(track.id, "up")}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Move track up"
            aria-label="Move track up"
          >
            <ChevronUp className="size-3" />
          </button>

          <button
            type="button"
            disabled={isLast}
            onClick={() => reorderTrack(track.id, "down")}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Move track down"
            aria-label="Move track down"
          >
            <ChevronDown className="size-3" />
          </button>

          <button
            type="button"
            disabled={track.locked}
            onClick={() => handleDeleteClick(track)}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title={track.locked ? "Cannot delete locked track" : "Delete track"}
            aria-label="Delete track"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
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
        className={`min-w-full relative h-full flex items-center px-1 overflow-visible ${
          isLocked ? "bg-muted/15" : ""
        } ${isHidden ? "opacity-60" : ""}`}
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
            {isLocked ? (
              <span className="flex items-center gap-1 text-amber-500/80">
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
                  className={`group absolute h-8 rounded-md border flex items-center justify-between px-2 overflow-hidden transition-shadow select-none ${
                    isLocked ? "cursor-not-allowed opacity-90" : "cursor-grab active:cursor-grabbing"
                  } ${
                    isSelected
                      ? "border-primary bg-primary/20 ring-2 ring-primary shadow-sm z-10"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  {/* Left-edge trim handle (in-point & anchored right edge) */}
                  {!isLocked && (
                    <div
                      onPointerDown={(e) => startLeftTrimDrag(e, clip)}
                      className="absolute left-0 top-0 bottom-0 w-2.5 hover:w-3.5 bg-primary/25 hover:bg-primary cursor-ew-resize transition-all rounded-l z-20 flex items-center justify-center group/leftHandle"
                      title="Drag to trim start (in-point)"
                    >
                      <div className="w-0.5 h-3 bg-primary/70 group-hover/leftHandle:bg-primary-foreground rounded-full pointer-events-none" />
                    </div>
                  )}

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
                    {clip.volume === 0 && (
                      <span title="Scene audio muted" className="shrink-0">
                        <VolumeX className="size-2.5 text-destructive" />
                      </span>
                    )}
                  </div>

                  <span className="text-3xs font-mono text-muted-foreground shrink-0 pl-1 pointer-events-none pr-1">
                    {clip.duration.toFixed(1)}s
                  </span>

                  {/* Right-edge trim handle (duration & anchored start time) */}
                  {!isLocked && (
                    <div
                      onPointerDown={(e) => startRightTrimDrag(e, clip)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 hover:w-3.5 bg-primary/25 hover:bg-primary cursor-ew-resize transition-all rounded-r z-20 flex items-center justify-center group/rightHandle"
                      title="Drag to trim end (duration)"
                    >
                      <div className="w-0.5 h-3 bg-primary/70 group-hover/rightHandle:bg-primary-foreground rounded-full pointer-events-none" />
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

    const getAudioRoleIcon = (role?: AudioTrackRole) => {
      if (role === "voiceover") return <Mic className="size-3 text-primary shrink-0" />;
      if (role === "music") return <Music className="size-3 text-primary shrink-0" />;
      if (role === "ambient") return <Radio className="size-3 text-primary shrink-0" />;
      return <Volume2 className="size-3 text-primary shrink-0" />;
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
        className={`min-w-full relative h-full flex items-center px-1 overflow-visible ${
          isLocked ? "bg-muted/15" : ""
        } ${isMuted ? "opacity-75" : ""}`}
      >
        {/* Full-width vertical grid lines across audio lane */}
        {rulerTicks.map((tick) => (
          <div
            key={`audio_grid_${tick.time}`}
            style={{ left: `${tick.leftPx}px` }}
            className="absolute top-0 bottom-0 w-px bg-border/20 pointer-events-none"
          />
        ))}

        {!isHydrated || trackClips.length === 0 ? (
          <div className="w-full border border-dashed border-border rounded h-7 flex items-center justify-center text-3xs text-muted-foreground gap-1.5 bg-muted/10 pointer-events-none">
            {isLocked ? (
              <span className="flex items-center gap-1 text-amber-500/80">
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
                className={`group absolute h-8 rounded-md border flex items-center justify-between px-2 overflow-hidden transition-shadow select-none ${
                  isLocked ? "cursor-not-allowed opacity-90" : "cursor-grab active:cursor-grabbing"
                } ${
                  isSelected
                    ? "border-primary bg-primary/25 ring-2 ring-primary shadow-sm z-10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {/* Left-edge trim handle */}
                {!isLocked && (
                  <div
                    onPointerDown={(e) => startLeftTrimDrag(e, clip)}
                    className="absolute left-0 top-0 bottom-0 w-2.5 hover:w-3.5 bg-primary/25 hover:bg-primary cursor-ew-resize transition-all rounded-l z-20 flex items-center justify-center group/leftHandle"
                    title="Drag to trim start (in-point)"
                  >
                    <div className="w-0.5 h-3 bg-primary/70 group-hover/leftHandle:bg-primary-foreground rounded-full pointer-events-none" />
                  </div>
                )}

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
                  {getAudioRoleIcon(track.role)}
                  <span className="text-3xs font-medium text-foreground truncate">
                    {clip.name}
                  </span>
                  {(clip.volume === 0 || isMuted) && (
                    <span title={isMuted ? "Track is muted" : "Clip audio muted"} className="shrink-0">
                      <VolumeX className="size-2.5 text-destructive" />
                    </span>
                  )}
                </div>

                <span className="text-3xs font-mono text-muted-foreground shrink-0 pl-1 pointer-events-none z-10 pr-1">
                  {clip.duration.toFixed(1)}s
                </span>

                {/* Right-edge trim handle */}
                {!isLocked && (
                  <div
                    onPointerDown={(e) => startRightTrimDrag(e, clip)}
                    className="absolute right-0 top-0 bottom-0 w-2.5 hover:w-3.5 bg-primary/25 hover:bg-primary cursor-ew-resize transition-all rounded-r z-20 flex items-center justify-center group/rightHandle"
                    title="Drag to trim duration"
                  >
                    <div className="w-0.5 h-3 bg-primary/70 group-hover/rightHandle:bg-primary-foreground rounded-full pointer-events-none" />
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
    <Card size="sm" className="flex flex-col w-full shrink-0">
      {/* Timeline Controls Header — 100% Icon-Only Ghost Buttons with Tooltips */}
      <CardHeader className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2 w-full min-w-0">
          {/* Left: Icon-Only Ghost Action Buttons + Playhead/Zoom/Snap */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="mr-1 flex items-center gap-2">
              <CardTitle className="flex items-center gap-1">
                Timeline
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-6 px-1.5 gap-1 text-2xs font-medium text-foreground hover:bg-muted cursor-pointer"
                      title="Create a new timeline track"
                    >
                      <Plus className="size-3 text-primary" />
                      <span className="hidden sm:inline">Add Track</span>
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

            <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

            {/* Playhead Time Display */}
            <div className="font-mono text-2xs bg-muted text-foreground font-semibold px-1.5 py-0.5 rounded shrink-0">
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
            <div className="flex items-center gap-1 p-0.5 shrink-0">
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
                className="w-16 sm:w-20 accent-primary cursor-pointer h-1"
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

              <span className="font-mono text-2xs text-muted-foreground tabular-nums w-8 shrink-0">
                {isHydrated ? zoom : 100}%
              </span>
            </div>
          </div>

          {/* Right: THE MARKED AREA — Contextual Selected Clip & Scene Controls */}
          <div className="flex items-center gap-1 min-w-0 justify-end flex-1 overflow-x-auto py-0.5">
            {selectedClip ? (
              <div className="flex items-center gap-1 shrink-0 min-w-0">
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

                {/* Scene Motion (Images only) */}
                {selectedClip.type === "image" && (
                  <>
                    {/* Motion Off */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant={!selectedClip.zoomEffect ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => handleTimelineSetMotion("off")}
                            aria-label="Scene Motion: Off"
                          >
                            <Sparkles className={`size-4 ${!selectedClip.zoomEffect ? "text-muted-foreground" : "opacity-40"}`} />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <span>Scene Motion: Off</span>
                      </TooltipContent>
                    </Tooltip>

                    {/* Zoom In */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant={selectedClip.zoomEffect?.type === "zoom-in" ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => handleTimelineSetMotion("zoom-in")}
                            aria-label="Motion: Zoom In"
                          >
                            <ZoomIn className={`size-4 ${selectedClip.zoomEffect?.type === "zoom-in" ? "text-primary" : ""}`} />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <span>Motion: Zoom In</span>
                      </TooltipContent>
                    </Tooltip>

                    {/* Zoom Out */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant={selectedClip.zoomEffect?.type === "zoom-out" ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => handleTimelineSetMotion("zoom-out")}
                            aria-label="Motion: Zoom Out"
                          >
                            <ZoomOut className={`size-4 ${selectedClip.zoomEffect?.type === "zoom-out" ? "text-primary" : ""}`} />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <span>Motion: Zoom Out</span>
                      </TooltipContent>
                    </Tooltip>

                    {/* Pan Left */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant={selectedClip.zoomEffect?.type === "pan-left" ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => handleTimelineSetMotion("pan-left")}
                            aria-label="Motion: Pan Left"
                          >
                            <ArrowLeft className={`size-4 ${selectedClip.zoomEffect?.type === "pan-left" ? "text-primary" : ""}`} />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <span>Motion: Pan Left</span>
                      </TooltipContent>
                    </Tooltip>

                    {/* Pan Right */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant={selectedClip.zoomEffect?.type === "pan-right" ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => handleTimelineSetMotion("pan-right")}
                            aria-label="Motion: Pan Right"
                          >
                            <ArrowRight className={`size-4 ${selectedClip.zoomEffect?.type === "pan-right" ? "text-primary" : ""}`} />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <span>Motion: Pan Right</span>
                      </TooltipContent>
                    </Tooltip>

                    {/* Pan Up */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant={selectedClip.zoomEffect?.type === "pan-up" ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => handleTimelineSetMotion("pan-up")}
                            aria-label="Motion: Pan Up"
                          >
                            <ArrowUp className={`size-4 ${selectedClip.zoomEffect?.type === "pan-up" ? "text-primary" : ""}`} />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <span>Motion: Pan Up</span>
                      </TooltipContent>
                    </Tooltip>

                    {/* Pan Down */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant={selectedClip.zoomEffect?.type === "pan-down" ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => handleTimelineSetMotion("pan-down")}
                            aria-label="Motion: Pan Down"
                          >
                            <ArrowDown className={`size-4 ${selectedClip.zoomEffect?.type === "pan-down" ? "text-primary" : ""}`} />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <span>Motion: Pan Down</span>
                      </TooltipContent>
                    </Tooltip>

                    {/* Strength Slider */}
                    {selectedClip.zoomEffect && (
                      <div className="flex items-center gap-1.5 p-0.5 shrink-0">
                        <input
                          type="range"
                          min={MIN_ZOOM_EFFECT_AMOUNT * 100}
                          max={MAX_ZOOM_EFFECT_AMOUNT * 100}
                          step="1"
                          value={motionAmountPct}
                          onChange={handleTimelineMotionAmountChange}
                          aria-label="Scene motion strength"
                          className="w-16 sm:w-20 accent-primary cursor-pointer h-1"
                        />
                        <span className="font-mono text-2xs text-muted-foreground tabular-nums w-8 shrink-0">
                          {motionAmountPct}%
                        </span>
                      </div>
                    )}

                    {/* Apply to All Scenes Button */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={imageClipsCount <= 1 || !selectedClip.zoomEffect}
                            onClick={handleTimelineApplyMotionToAll}
                            aria-label="Apply motion to all scenes"
                          >
                            <CopyCheck className="size-4" />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <span>
                          {!selectedClip.zoomEffect
                            ? "Select a motion to apply to all scenes"
                            : imageClipsCount <= 1
                            ? "Only 1 image scene on timeline"
                            : `Apply ${selectedClip.zoomEffect.type} (${motionAmountPct}%) to all ${imageClipsCount} scenes`}
                        </span>
                      </TooltipContent>
                    </Tooltip>

                    {motionFeedback && (
                      <span className="font-mono text-2xs text-primary font-semibold animate-in fade-in pl-1">
                        {motionFeedback}
                      </span>
                    )}

                    <div className="h-4 w-px bg-border mx-0.5 shrink-0" />
                  </>
                )}

                {/* Volume & Mute for Audio & Video clips */}
                {(isAudioTrack(selectedClip.trackId, tracks) || selectedClip.type === "video") && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant={(selectedClip.volume ?? 1.0) === 0 ? "secondary" : "ghost"}
                          size="icon"
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
              <div className="flex items-center gap-1.5 text-2xs text-muted-foreground select-none pr-1">
                <MousePointerClick className="size-3.5 text-muted-foreground/70" />
                <span>Select a scene to edit motion &amp; layers</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Main Timeline Card Content: Pinned Left Track Sidebar + Horizontally Scrolling Canvas */}
      <CardContent className="p-0 flex flex-row overflow-hidden border-t border-border max-h-96 md:max-h-120">
        {/* PINNED LEFT TRACK SIDEBAR (Immune to Horizontal Scrolling, Always Visible) */}
        <div
          ref={sidebarScrollRef}
          onWheel={handleSidebarWheel}
          className="w-52 shrink-0 border-r border-border bg-card z-30 flex flex-col select-none overflow-y-auto no-scrollbar"
        >
          {/* Header Row (Sticky on top of sidebar) */}
          <div className="h-6 border-b border-border bg-muted/40 px-2 flex items-center justify-between text-3xs text-muted-foreground uppercase font-medium sticky top-0 z-40">
            <span>Tracks ({orderedTracks.length})</span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-4 px-1 gap-0.5 text-3xs hover:text-foreground cursor-pointer"
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
              className="min-w-full sticky top-0 z-30 h-6 border-b border-border bg-muted/90 backdrop-blur-xs cursor-pointer hover:bg-muted select-none"
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
                    className="flex h-11 bg-card hover:bg-muted/10 transition-colors min-w-full"
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
      </CardContent>

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
    </Card>
  );
}
