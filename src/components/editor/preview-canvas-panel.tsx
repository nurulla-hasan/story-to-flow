"use client";

import * as React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  Maximize2,
  Minimize2,
  Grid3X3,
  Eye,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Film,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTimeline } from "@/lib/timeline-context";
import { useMediaLibrary } from "@/lib/use-media-library";
import { isVisualTrack, getVisualTrackLayerIndex } from "@/types/timeline";
import { getTransitionProgress } from "@/lib/transition-helpers";
import { formatFrameTimecode } from "@/lib/frame-navigation";
import { sanitizeClipTransform } from "@/lib/clip-transform";
import { getClipMotionAtTime } from "@/lib/zoom-effect";
import { PreviewTransformGizmo } from "@/components/editor/preview-transform-gizmo";

function formatTimecode(seconds: number): string {
  return formatFrameTimecode(seconds, 30);
}

export function PreviewCanvasPanel() {
  const {
    isHydrated,
    clips,
    transitions,
    selectedClipId,
    selectClip,
    updateClip,
    setClipsTransient,
    commitClipGesture,
    cancelClipGesture,
    playhead,
    isPlaying,
    togglePlay,
    seek,
    commitPlayhead,
    totalDuration,
    aspectRatio,
    playbackSpeed,
    masterVolume,
    setMasterVolume,
    isMuted,
    setIsMuted,
  } = useTimeline();

  const { assets } = useMediaLibrary();
  const videoRefs = React.useRef<Map<string, HTMLVideoElement>>(new Map());

  // Viewport Zoom & Pan Navigation State (strictly visual viewport - never affects export or clip transforms)
  const [viewportZoom, setViewportZoom] = React.useState<number>(100); // 25% to 400%, default 100%
  const [viewportPan, setViewportPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = React.useState<boolean>(false);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState<boolean>(false);
  const [isPanning, setIsPanning] = React.useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
  const [showGrid, setShowGrid] = React.useState<boolean>(false);
  const [showVolumeSlider, setShowVolumeSlider] = React.useState<boolean>(false);
  const isHoveringCanvasRef = React.useRef<boolean>(false);
  const canvasOuterStageRef = React.useRef<HTMLDivElement>(null);
  const volumeDropdownRef = React.useRef<HTMLDivElement>(null);
  const panStartRef = React.useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const handleZoomIn = () => setViewportZoom((prev) => Math.min(400, prev + 25));
  const handleZoomOut = () => setViewportZoom((prev) => Math.max(25, prev - 25));
  const handleResetView = () => {
    setViewportZoom(100);
    setViewportPan({ x: 0, y: 0 });
  };

  // Sync video volume with master volume & mute
  React.useEffect(() => {
    const vol = isMuted ? 0 : Math.max(0, Math.min(1.0, masterVolume));
    for (const vid of videoRefs.current.values()) {
      vid.volume = vol;
    }
  }, [isMuted, masterVolume]);

  // Close the master-volume dropdown on outside click or Escape
  React.useEffect(() => {
    if (!showVolumeSlider) return;

    const onPointerDown = (event: PointerEvent) => {
      if (
        volumeDropdownRef.current &&
        !volumeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowVolumeSlider(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowVolumeSlider(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showVolumeSlider]);

  // Synchronize fullscreen state with document events
  React.useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleToggleFullscreen = async () => {
    const stageEl = canvasOuterStageRef.current;
    if (!stageEl) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stageEl.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen toggle warning:", err);
    }
  };

  const handleToggleMute = React.useCallback(() => {
    setIsMuted((prev) => !prev);
  }, [setIsMuted]);

  // Modifier keys detection for Pan and Zoom
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.getAttribute("contenteditable") === "true";
      if (isInput) return;

      if (e.key === "Control" || e.key === "Meta") {
        setIsCtrlPressed(true);
      }
      if (e.code === "Space" || e.key === " ") {
        setIsSpacePressed(true);
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === "m") {
          e.preventDefault();
          handleToggleMute();
        } else if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          handleToggleFullscreen();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        setIsCtrlPressed(false);
      }
      if (e.code === "Space" || e.key === " ") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handleToggleMute]);

  // CapCut-style Canvas Zoom & Pan with Mouse Wheel
  // CRITICAL: Must use native `{ passive: false }` listener with `e.preventDefault()`
  // to prevent Chromium from triggering native browser window zoom (page scale)!
  React.useEffect(() => {
    const stageEl = canvasOuterStageRef.current;
    if (!stageEl) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // When Ctrl or Meta is held: zoom the canvas and PREVENT browser zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        const zoomDelta = e.deltaY < 0 ? 15 : -15;
        setViewportZoom((prev) => Math.max(25, Math.min(400, prev + zoomDelta)));
      } else {
        // Normal wheel (without Ctrl): smoothly pan the canvas (CapCut UX)
        e.preventDefault();
        const dx = e.shiftKey ? -e.deltaY : -e.deltaX;
        const dy = e.shiftKey ? 0 : -e.deltaY;
        setViewportPan((prev) => ({
          x: Math.round(prev.x + dx),
          y: Math.round(prev.y + dy),
        }));
      }
    };

    stageEl.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      stageEl.removeEventListener("wheel", handleNativeWheel);
    };
  }, []);

  // Window-level guard: unconditionally block browser zoom if mouse is over canvas
  React.useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (isHoveringCanvasRef.current && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
      }
    };
    window.addEventListener("wheel", preventBrowserZoom, { passive: false });
    return () => {
      window.removeEventListener("wheel", preventBrowserZoom);
    };
  }, []);

  const handleViewportPointerDown = (e: React.PointerEvent) => {
    // Pan trigger: middle click (button 1) OR left click with Space held OR left click with Ctrl held
    const isPanTrigger = e.button === 1 || (e.button === 0 && isSpacePressed) || (e.button === 0 && e.ctrlKey);
    if (!isPanTrigger) return;

    e.preventDefault();
    e.stopPropagation();
    if (isPlaying) {
      togglePlay();
    }
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: viewportPan.x,
      panY: viewportPan.y,
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - panStartRef.current.x;
      const dy = moveEvent.clientY - panStartRef.current.y;
      setViewportPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
    };

    const onPointerUp = () => {
      setIsPanning(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  // Measure stage dimensions dynamically with ResizeObserver for gizmo coordinate mapping
  const stageContainerRef = React.useRef<HTMLDivElement>(null);
  const [stageDimensions, setStageDimensions] = React.useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  React.useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;

    const updateDimensions = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setStageDimensions({ width, height });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Find currently selected visual clip
  const selectedClip = React.useMemo(() => {
    if (!selectedClipId) return null;
    return clips.find((c) => c.id === selectedClipId && isVisualTrack(c.trackId)) || null;
  }, [clips, selectedClipId]);

  const clipMap = React.useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips]);
  const assetMap = React.useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  // Check if an active transition is currently taking effect at playhead
  let activeTransitionData: {
    transition: typeof transitions[0];
    fromClip: typeof clips[0];
    toClip: typeof clips[0];
    progress: number;
  } | null = null;

  if (isHydrated && transitions.length > 0) {
    for (const trans of transitions) {
      const fromClip = clipMap.get(trans.fromClipId);
      const toClip = clipMap.get(trans.toClipId);
      if (!fromClip || !toClip) continue;

      const progress = getTransitionProgress(playhead, trans, fromClip, toClip);
      if (progress !== null) {
        activeTransitionData = { transition: trans, fromClip, toClip, progress };
        break;
      }
    }
  }

  // Find all active visual clips under current playhead sorted by z-order
  const visualClips = React.useMemo(() => clips.filter((c) => isVisualTrack(c.trackId)), [clips]);
  const activeVisuals = React.useMemo(() => {
    if (!isHydrated) return [];
    return visualClips
      .filter((c) => playhead >= c.startTime && playhead < c.startTime + c.duration)
      .sort((a, b) => getVisualTrackLayerIndex(a.trackId) - getVisualTrackLayerIndex(b.trackId));
  }, [isHydrated, visualClips, playhead]);

  // Synchronize video element playback time with timeline playhead
  React.useEffect(() => {
    // If transition is active, sync both connecting clips if they are videos
    if (activeTransitionData) {
      const { fromClip, toClip } = activeTransitionData;
      [fromClip, toClip].forEach((clip) => {
        const vid = videoRefs.current.get(clip.id);
        if (vid) {
          const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
          const targetTime = (playhead - clip.startTime) * speed + clip.inPoint;
          if (Math.abs(vid.currentTime - targetTime) > 0.15) {
            vid.currentTime = Math.max(0, targetTime);
          }
          if (vid.playbackRate !== speed) {
            vid.playbackRate = speed;
          }
          if (isPlaying) {
            vid.play().catch(() => {});
          } else {
            vid.pause();
          }
        }
      });
      return;
    }

    activeVisuals.forEach((clip) => {
      const vid = videoRefs.current.get(clip.id);
      if (vid) {
        const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
        const targetTime = (playhead - clip.startTime) * speed + clip.inPoint;
        if (Math.abs(vid.currentTime - targetTime) > 0.15) {
          vid.currentTime = Math.max(0, targetTime);
        }
        if (vid.playbackRate !== speed) {
          vid.playbackRate = speed;
        }

        // Apply video clip volume & master volume
        const clipVol = typeof clip.volume === "number" ? clip.volume : 1.0;
        const effectiveVol = isMuted ? 0 : Math.max(0, Math.min(1.0, clipVol * masterVolume));
        vid.volume = effectiveVol;
        vid.muted = isMuted || effectiveVol === 0;

        if (isPlaying) {
          vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      }
    });
  }, [activeTransitionData, activeVisuals, playhead, isPlaying, isMuted, masterVolume]);

  const topActiveClip = activeVisuals[activeVisuals.length - 1];

  // Render a visual clip node (Image or Video) with transform & click selection
  const renderVisualNode = (clip: typeof clips[0], baseStyle?: React.CSSProperties) => {
    const asset = assetMap.get(clip.assetId);
    if (!asset) return null;

    const transform = sanitizeClipTransform(clip.transform);
    const isSelected = clip.id === selectedClipId;
    const motion = getClipMotionAtTime(clip, playhead);

    const netX = (transform.x + motion.offsetX) * 100;
    const netY = (transform.y + motion.offsetY) * 100;
    const netScale = parseFloat((transform.scale * motion.scale).toFixed(4));

    const transformStr = `translate(${netX}%, ${netY}%) scale(${netScale}) rotate(${transform.rotation || 0}deg)`;
    const nodeStyle: React.CSSProperties = {
      ...baseStyle,
      transform: baseStyle?.transform
        ? `${baseStyle.transform} ${transformStr}`
        : transformStr,
      transformOrigin: "center center",
    };

    return (
      <div
        key={clip.id}
        onClick={(e) => {
          e.stopPropagation();
          selectClip(clip.id);
        }}
        style={nodeStyle}
        className={`absolute inset-0 w-full h-full overflow-hidden select-none cursor-pointer transition-shadow ${
          isSelected ? "ring-1 ring-primary/40" : ""
        }`}
      >
        {asset.category === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={asset.name}
            className="w-full h-full object-cover rounded-xl pointer-events-none"
          />
        ) : asset.category === "video" ? (
          <video
            ref={(el) => {
              if (el) videoRefs.current.set(clip.id, el);
              else videoRefs.current.delete(clip.id);
            }}
            src={asset.url}
            playsInline
            className="w-full h-full object-cover rounded-xl pointer-events-none"
          />
        ) : null}
      </div>
    );
  };

  return (
    <Card size="sm" className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        {/* Left: Panel identity + active output resolution */}
        <div className="flex min-w-0 items-center gap-2">
          <Eye className="size-4 shrink-0 text-primary" />
          <CardTitle>Preview</CardTitle>
          <span className="truncate font-mono text-2xs text-muted-foreground tabular-nums">
            {aspectRatio === "16:9" ? "16:9 · 1920 × 1080" : "9:16 · 1080 × 1920"}
          </span>
        </div>

        {/* Right: Compact viewport zoom + contextual status badge */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div
            className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
            title="Ctrl + scroll to zoom · Ctrl / Space + drag to pan"
          >
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={handleZoomOut}
              disabled={viewportZoom <= 25}
              title="Zoom out"
              aria-label="Zoom out preview canvas"
            >
              <ZoomOut />
            </Button>
            <button
              type="button"
              onClick={handleResetView}
              title="Reset canvas view to 100%"
              className="min-w-9 cursor-pointer px-1 font-mono text-2xs font-semibold text-foreground tabular-nums transition-colors hover:text-primary"
            >
              {viewportZoom}%
            </button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={handleZoomIn}
              disabled={viewportZoom >= 400}
              title="Zoom in"
              aria-label="Zoom in preview canvas"
            >
              <ZoomIn />
            </Button>
          </div>

          {activeTransitionData ? (
            <Badge variant="outline">
              <span className="flex items-center gap-1">
                <Sparkles className="size-3 shrink-0 text-primary" />
                <span>
                  {activeTransitionData.transition.type} · {Math.round(activeTransitionData.progress * 100)}%
                </span>
              </span>
            </Badge>
          ) : isHydrated && topActiveClip ? (
            <Badge variant="outline">
              <span className="flex max-w-40 items-center gap-1">
                <span className="truncate">{topActiveClip.name}</span>
                {activeVisuals.length > 1 && (
                  <span className="shrink-0 text-muted-foreground">{activeVisuals.length} layers</span>
                )}
              </span>
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 justify-between gap-3">
        {/* Stage Container with dark backdrop, dot-grid pattern, and viewport pan & zoom navigation */}
        <div
          ref={canvasOuterStageRef}
          data-canvas-stage="true"
          onPointerDown={handleViewportPointerDown}
          onMouseEnter={() => {
            isHoveringCanvasRef.current = true;
          }}
          onMouseLeave={() => {
            isHoveringCanvasRef.current = false;
            setIsSpacePressed(false);
          }}
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.08) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
          className={`flex items-center justify-center bg-editor-stage rounded-2xl p-4 flex-1 min-h-0 overflow-hidden relative select-none border border-border shadow-inner ${
            isPanning ? "cursor-grabbing" : isCtrlPressed || isSpacePressed ? "cursor-grab" : ""
          }`}
        >
          {/* CapCut-style 2X fast forward indicator while Space is held */}
          {playbackSpeed === 2.0 && (
            <div
              data-testid="playback-speed-badge"
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground font-mono font-bold shadow-lg backdrop-blur-sm animate-pulse pointer-events-none select-none"
            >
              <span>▶▶</span>
              <span>2X FAST FORWARD</span>
            </div>
          )}
          {/* Viewport Transform Wrapper: strictly handles viewing zoom and pan */}
          <div
            style={{
              transform: `translate(${viewportPan.x}px, ${viewportPan.y}px) scale(${viewportZoom / 100})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform 75ms ease-out",
            }}
            className="w-full h-full flex items-center justify-center pointer-events-auto"
          >
            {/* Canvas Mockup matching active aspect ratio with premium hardware framing */}
            <div
              style={{ aspectRatio: aspectRatio === "16:9" ? "16/9" : "9/16" }}
              className={`relative bg-editor-screen flex flex-col items-center justify-between overflow-visible transition-all duration-200 select-none ${
                aspectRatio === "16:9"
                  ? "w-full max-w-3xl h-auto aspect-video max-h-96 sm:max-h-100 md:max-h-125 rounded-2xl border-2 border-border shadow-2xl p-2"
                  : "h-full max-h-96 sm:max-h-100 md:max-h-125 rounded-3xl border-2 border-border shadow-2xl p-2"
              }`}
            >
              {/* Dynamic Island Phone Camera Pill (Vertical 9:16 only) */}
              {aspectRatio === "9:16" && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 rounded-full bg-editor-screen border border-border z-30 flex items-center justify-end pr-2.5 shadow-md pointer-events-none">
                  <div className="size-2 rounded-full bg-card border border-primary/40 ring-1 ring-primary/20 shadow-inner" />
                </div>
              )}

              {/* Stage Media Display Container with transition & multi-track layering */}
              <div
                ref={stageContainerRef}
                onClick={() => selectClip(null)}
                className="relative w-full h-full rounded-xl flex items-center justify-center bg-muted/10 select-none overflow-visible"
              >
                {/* Rule-of-Thirds Composition Grid Overlay */}
                {showGrid && (
                  <div className="absolute inset-0 z-20 pointer-events-none rounded-xl overflow-hidden grid grid-cols-3 grid-rows-3 border border-primary/20">
                    <div className="border-r border-b border-primary/25 border-dashed" />
                    <div className="border-r border-b border-primary/25 border-dashed" />
                    <div className="border-b border-primary/25 border-dashed" />
                    <div className="border-r border-b border-primary/25 border-dashed" />
                    <div className="border-r border-b border-primary/25 border-dashed flex items-center justify-center">
                      <div className="size-2 rounded-full border border-primary/60 bg-primary/20" />
                    </div>
                    <div className="border-b border-primary/25 border-dashed" />
                    <div className="border-r border-primary/25 border-dashed" />
                    <div className="border-r border-primary/25 border-dashed" />
                    <div />
                  </div>
                )}
              {/* Media clips container (clipped to phone boundary) */}
              <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-auto">
                {isHydrated && activeTransitionData ? (
                  /* TRANSITION COMPOSITING RENDERING (Layer-Aware: preserves overlays & other tracks) */
                  (() => {
                    const { transition, fromClip, toClip, progress } = activeTransitionData;
                    const transitionTrackIndex = getVisualTrackLayerIndex(fromClip.trackId);
                    const otherVisuals = activeVisuals.filter(
                      (c) => c.id !== fromClip.id && c.id !== toClip.id
                    );

                    const renderTransitionContent = () => {
                      if (transition.type === "cross-dissolve") {
                        return (
                          <div className="relative w-full h-full" style={{ isolation: "isolate" }}>
                            {renderVisualNode(fromClip, { opacity: 1, zIndex: 1 })}
                            {renderVisualNode(toClip, { opacity: progress, zIndex: 2 })}
                          </div>
                        );
                      }

                      if (transition.type === "fade-black") {
                        const fromOpacity = progress < 0.5 ? 1 - progress * 2 : 0;
                        const toOpacity = progress >= 0.5 ? (progress - 0.5) * 2 : 0;
                        return (
                          <div className="relative w-full h-full bg-editor-screen z-1">
                            {renderVisualNode(fromClip, { opacity: fromOpacity, zIndex: 1 })}
                            {renderVisualNode(toClip, { opacity: toOpacity, zIndex: 2 })}
                          </div>
                        );
                      }

                      if (transition.type === "slide-left") {
                        return (
                          <>
                            {renderVisualNode(fromClip, {
                              transform: `translateX(${-progress * 100}%)`,
                              zIndex: 1,
                            })}
                            {renderVisualNode(toClip, {
                              transform: `translateX(${(1 - progress) * 100}%)`,
                              zIndex: 2,
                            })}
                          </>
                        );
                      }

                      if (transition.type === "slide-right") {
                        return (
                          <>
                            {renderVisualNode(fromClip, {
                              transform: `translateX(${progress * 100}%)`,
                              zIndex: 1,
                            })}
                            {renderVisualNode(toClip, {
                              transform: `translateX(${-(1 - progress) * 100}%)`,
                              zIndex: 2,
                            })}
                          </>
                        );
                      }

                      return null;
                    };

                    return (
                      <>
                        {/* 1. Layers below the transition layer */}
                        {otherVisuals
                          .filter((c) => getVisualTrackLayerIndex(c.trackId) < transitionTrackIndex)
                          .map((c) =>
                            renderVisualNode(c, { position: "absolute", inset: 0, zIndex: 0 })
                          )}

                        {/* 2. Transition content on its layer */}
                        {renderTransitionContent()}

                        {/* 3. Overlay layers above the transition layer */}
                        {otherVisuals
                          .filter((c) => getVisualTrackLayerIndex(c.trackId) > transitionTrackIndex)
                          .map((c) =>
                            renderVisualNode(c, { position: "absolute", inset: 0, zIndex: 10 })
                          )}
                      </>
                    );
                  })()
                ) : isHydrated && activeVisuals.length > 0 ? (
                  activeVisuals.map((clip, index) => {
                    const isOverlay = index > 0;
                    return renderVisualNode(clip, {
                      position: "absolute",
                      inset: 0,
                      zIndex: isOverlay ? 10 : 0,
                    });
                  })
                ) : (
                  /* High-End Studio Cinema Empty State */
                  <div className="flex flex-col items-center justify-center text-center space-y-3 p-4 h-full bg-radial from-card/30 to-editor-screen">
                    <div className="size-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-inner">
                      <Film className="size-6 stroke-[1.75]" />
                    </div>

                    <div className="space-y-1">
                      <p className="font-semibold text-foreground tracking-wide">
                        {aspectRatio === "16:9" ? "16:9 Cinema Canvas" : "9:16 Reel Canvas"}
                      </p>
                      <p className="text-muted-foreground/80 max-w-56 leading-relaxed">
                        {!isHydrated || clips.length === 0
                          ? "Add clips to timeline or media library to begin preview."
                          : "Move playhead over an active clip to preview."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="outline" className="font-mono py-0 px-2">
                        {aspectRatio === "16:9" ? "1920 × 1080" : "1080 × 1920"}
                      </Badge>
                      <Badge variant="secondary" className="font-mono py-0 px-2">
                        30 FPS
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Preview Transform Gizmo for selected visual clip (unclipped overlay) */}
              {isHydrated &&
                selectedClip &&
                activeVisuals.some((c) => c.id === selectedClip.id) &&
                stageDimensions.width > 0 &&
                stageDimensions.height > 0 && (
                  <PreviewTransformGizmo
                    clip={selectedClip}
                    containerWidth={stageDimensions.width}
                    containerHeight={stageDimensions.height}
                    getContainerRect={() => stageContainerRef.current?.getBoundingClientRect() ?? null}
                    allClips={clips}
                    setClipsTransient={setClipsTransient}
                    commitClipGesture={commitClipGesture}
                    cancelClipGesture={cancelClipGesture}
                    onReset={() =>
                      updateClip(selectedClip.id, {
                        transform: { x: 0, y: 0, scale: 1.0, rotation: 0 },
                      })
                    }
                  />
                )}
            </div>

            {/* Bottom Home Indicator Bar (Vertical 9:16 only) */}
            {aspectRatio === "9:16" && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-1 rounded-full bg-border shadow-sm z-30 pointer-events-none" />
            )}
          </div>
          </div>
        </div>

        {/* Transport Controls Bar */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          {/* Playback action buttons */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                seek(0);
                commitPlayhead(0);
              }}
              title="Jump to timeline start (Home)"
              aria-label="Jump to timeline start"
            >
              <SkipBack className="size-3.5" />
            </Button>

            <Button
              size="icon"
              onClick={togglePlay}
              title={isPlaying ? "Pause timeline (Space)" : "Play timeline (Space)"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="size-3.5 fill-current" />
              ) : (
                <Play className="size-3.5 fill-current" />
              )}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                seek(totalDuration);
                commitPlayhead(totalDuration);
              }}
              title="Jump to timeline end (End)"
              aria-label="Jump to timeline end"
            >
              <SkipForward className="size-3.5" />
            </Button>

            {/* Timecode Counter */}
            <div className="ml-1 font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
              {formatTimecode(isHydrated ? playhead : 0)} / {formatTimecode(isHydrated ? totalDuration : 0)}
            </div>
          </div>

          {/* Secondary Controls: Dynamic Volume, Grid & Fullscreen */}
          <div className="flex items-center gap-1 relative">
            {/* Master Volume: click-to-open dropdown with slider + mute */}
            <div ref={volumeDropdownRef} className="relative flex items-center">
              <Button
                size="icon"
                variant={isMuted ? "destructive" : "ghost"}
                onClick={() => setShowVolumeSlider((prev) => !prev)}
                aria-haspopup="true"
                aria-expanded={showVolumeSlider}
                title={isMuted ? "Master volume: muted (M)" : `Master volume: ${Math.round(masterVolume * 100)}% (M)`}
                aria-label="Master volume"
                className="cursor-pointer transition-colors"
              >
                {isMuted || masterVolume === 0 ? (
                  <VolumeX className="size-3.5" />
                ) : masterVolume < 0.5 ? (
                  <Volume1 className="size-3.5" />
                ) : (
                  <Volume2 className="size-3.5" />
                )}
              </Button>

              {showVolumeSlider && (
                <div
                  role="dialog"
                  aria-label="Master volume controls"
                  className="absolute bottom-full right-0 z-50 mb-2 flex w-48 flex-col gap-2 rounded-xl border border-border bg-popover/95 p-3 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-medium text-foreground">Master volume</span>
                    <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                      {isMuted ? "Muted" : `${Math.round(masterVolume * 100)}%`}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : masterVolume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setMasterVolume(v);
                      if (isMuted && v > 0) setIsMuted(false);
                      if (v === 0) setIsMuted(true);
                    }}
                    aria-label="Master preview volume slider"
                    className="h-1.5 w-full cursor-pointer rounded-full bg-muted accent-primary"
                  />

                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={handleToggleMute}
                    className="w-full justify-start gap-1.5"
                    aria-label={isMuted ? "Unmute master audio" : "Mute master audio"}
                  >
                    {isMuted ? <VolumeX /> : <Volume2 />}
                    <span>{isMuted ? "Unmute" : "Mute"}</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Rule-of-Thirds Composition Grid Toggle Button */}
            <Button
              size="icon"
              variant={showGrid ? "secondary" : "ghost"}
              onClick={() => setShowGrid((prev) => !prev)}
              title={showGrid ? "Hide rule-of-thirds composition grid" : "Show rule-of-thirds composition grid"}
              aria-label={showGrid ? "Hide composition grid" : "Show composition grid"}
              className={`size-8 cursor-pointer transition-colors ${
                showGrid ? "text-primary border border-primary/30 bg-primary/10" : ""
              }`}
            >
              <Grid3X3 className="size-3.5" />
            </Button>

            {/* Fullscreen Preview Toggle Button */}
            <Button
              size="icon"
              variant={isFullscreen ? "secondary" : "ghost"}
              onClick={handleToggleFullscreen}
              title={isFullscreen ? "Exit fullscreen preview (Esc or F)" : "Fullscreen preview (F)"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen preview"}
              className="size-8 cursor-pointer transition-colors"
            >
              {isFullscreen ? (
                <Minimize2 className="size-3.5 text-primary" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
