"use client";

import * as React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize2,
  Smartphone,
  Eye,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Hand,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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
  } = useTimeline();

  const { assets } = useMediaLibrary();
  const videoRefs = React.useRef<Map<string, HTMLVideoElement>>(new Map());

  // Viewport Zoom & Pan Navigation State (strictly visual viewport - never affects export or clip transforms)
  const [viewportZoom, setViewportZoom] = React.useState<number>(100); // 25% to 400%, default 100%
  const [viewportPan, setViewportPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = React.useState<boolean>(false);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState<boolean>(false);
  const [isPanning, setIsPanning] = React.useState<boolean>(false);
  const isHoveringCanvasRef = React.useRef<boolean>(false);
  const canvasOuterStageRef = React.useRef<HTMLDivElement>(null);
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
  const handleFitToView = () => {
    setViewportZoom(100);
    setViewportPan({ x: 0, y: 0 });
  };

  // Modifier keys detection for Pan and Zoom
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        setIsCtrlPressed(true);
      }
      if (e.code === "Space" || e.key === " ") {
        const activeEl = document.activeElement;
        const isInput =
          activeEl?.tagName === "INPUT" ||
          activeEl?.tagName === "TEXTAREA" ||
          activeEl?.getAttribute("contenteditable") === "true";
        if (isInput) return;
        setIsSpacePressed(true);
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
  }, []);

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
        if (isPlaying) {
          vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      }
    });
  }, [activeTransitionData, activeVisuals, playhead, isPlaying]);

  const topActiveClip = activeVisuals[activeVisuals.length - 1];

  // Render a visual clip node (Image or Video) with transform & click selection
  const renderVisualNode = (clip: typeof clips[0], baseStyle?: React.CSSProperties) => {
    const asset = assetMap.get(clip.assetId);
    if (!asset) return null;

    const transform = sanitizeClipTransform(clip.transform);
    const isSelected = clip.id === selectedClipId;

    const transformStr = `translate(${transform.x * 100}%, ${transform.y * 100}%) scale(${transform.scale}) rotate(${transform.rotation || 0}deg)`;
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
            muted
            className="w-full h-full object-cover rounded-xl pointer-events-none"
          />
        ) : null}
      </div>
    );
  };

  return (
    <Card size="sm" className="flex flex-col h-full">
      <CardHeader className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-primary" />
            <CardTitle>{aspectRatio === "16:9" ? "16:9 Landscape Canvas" : "9:16 Preview Canvas"}</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Viewport Zoom & Pan Controls */}
            <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleZoomOut}
                disabled={viewportZoom <= 25}
                title="Zoom out preview canvas (-)"
                aria-label="Zoom out preview canvas"
                className="size-6 cursor-pointer"
              >
                <ZoomOut className="size-3" />
              </Button>
              <button
                type="button"
                onClick={handleResetView}
                title="Click to reset canvas view (100%)"
                className="px-1.5 py-0.5 text-3xs font-mono font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {viewportZoom}%
              </button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleZoomIn}
                disabled={viewportZoom >= 400}
                title="Zoom in preview canvas (+)"
                aria-label="Zoom in preview canvas"
                className="size-6 cursor-pointer"
              >
                <ZoomIn className="size-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleFitToView}
                title="Fit canvas to workspace"
                aria-label="Fit canvas to workspace"
                className="size-6 cursor-pointer"
              >
                <RotateCcw className="size-2.5" />
              </Button>
            </div>

            <Badge variant="outline">
              {activeTransitionData ? (
                <span className="flex items-center gap-1">
                  <Sparkles className="size-3 text-primary" />
                  <span>Transition: {activeTransitionData.transition.type} ({Math.round(activeTransitionData.progress * 100)}%)</span>
                </span>
              ) : isHydrated && topActiveClip ? (
                `${topActiveClip.name} (${activeVisuals.length > 1 ? `${activeVisuals.length} Layers` : "Layer 1"})`
              ) : (
                aspectRatio === "16:9" ? "1920 × 1080" : "1080 × 1920"
              )}
            </Badge>
          </div>
        </div>
        <CardDescription className="flex items-center justify-between">
          <span>
            {aspectRatio === "16:9"
              ? "Real-time landscape widescreen canvas rendered for YouTube & Desktop"
              : "Real-time vertical canvas rendered for Reels, TikTok & Shorts"}
          </span>
          <span className="text-3xs text-muted-foreground flex items-center gap-1">
            <Hand className="size-2.5 text-primary" />
            <span>Ctrl+Wheel to zoom • Ctrl+drag or Space+drag to pan</span>
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 justify-between gap-2">
        {/* Stage Container with dark backdrop and viewport pan & zoom navigation */}
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
          className={`flex items-center justify-center bg-muted/40 rounded-xl p-2 flex-1 min-h-0 overflow-hidden relative select-none ${
            isPanning ? "cursor-grabbing" : isCtrlPressed || isSpacePressed ? "cursor-grab" : ""
          }`}
        >
          {/* CapCut-style 2X fast forward indicator while Space is held */}
          {playbackSpeed === 2.0 && (
            <div
              data-testid="playback-speed-badge"
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-mono font-bold shadow-lg backdrop-blur-sm animate-pulse pointer-events-none select-none"
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
            {/* Canvas Mockup matching active aspect ratio */}
            <div
              style={{ aspectRatio: aspectRatio === "16:9" ? "16/9" : "9/16" }}
              className={`relative rounded-2xl border-2 border-border bg-card shadow-md flex flex-col items-center justify-between p-2.5 overflow-visible ${
                aspectRatio === "16:9"
                  ? "w-full max-w-xl h-auto aspect-video max-h-72 sm:max-h-84 md:max-h-96"
                  : "h-full max-h-72 sm:max-h-84 md:max-h-96"
              }`}
            >
            {/* Top Phone Notch / Camera indicator (Vertical 9:16 only) */}
            {aspectRatio === "9:16" && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-muted-foreground/30 z-30 pointer-events-none" />
            )}

            {/* Stage Media Display Container with transition & multi-track layering */}
            <div
              ref={stageContainerRef}
              onClick={() => selectClip(null)}
              className="relative w-full h-full rounded-xl flex items-center justify-center bg-muted/20 select-none overflow-visible"
            >
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
                          <>
                            {renderVisualNode(fromClip, { opacity: 1 - progress, zIndex: 1 })}
                            {renderVisualNode(toClip, { opacity: progress, zIndex: 2 })}
                          </>
                        );
                      }

                      if (transition.type === "fade-black") {
                        const fromOpacity = progress < 0.5 ? 1 - progress * 2 : 0;
                        const toOpacity = progress >= 0.5 ? (progress - 0.5) * 2 : 0;
                        return (
                          <div className="relative w-full h-full bg-black z-1">
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
                  /* Empty Canvas Placeholder */
                  <div className="flex flex-col items-center justify-center text-center space-y-2 p-2 h-full">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Smartphone className="size-5" />
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-foreground">
                        Canvas is empty
                      </p>
                      <p className="text-2xs text-muted-foreground max-w-40 leading-tight">
                        {!isHydrated || clips.length === 0
                          ? "Add clips to timeline to preview vertical video."
                          : "Playhead is on an empty timeline space."}
                      </p>
                    </div>

                    <Badge variant="secondary">
                      9:16 • 30 FPS • 1.0x
                    </Badge>
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
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-muted-foreground/30 z-30 pointer-events-none" />
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

          {/* Secondary Controls: Volume & Fullscreen */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              disabled
              title="Master audio volume"
              aria-label="Master audio volume"
            >
              <Volume2 className="size-3.5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              disabled
              title="Fullscreen preview"
              aria-label="Fullscreen preview"
            >
              <Maximize2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
