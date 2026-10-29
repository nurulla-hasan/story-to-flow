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
  EditorPanel,
  EditorPanelBody,
  EditorPanelHeader,
} from "@/components/editor/editor-panel";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useTimeline } from "@/lib/timeline-context";
import { useMediaLibrary } from "@/lib/use-media-library";
import { usePreviewCanvasViewport } from "@/lib/use-preview-canvas-viewport";
import {
  isVisualTrack,
  getVisualTrackLayerIndex,
  isTrackVisible,
  isTrackMuted,
  getTrackVolume,
  calculateEffectivePlaybackRate,
  normalizeVisualTrackId,
  getVisualTracks,
  areClipsOnSameTrack,
} from "@/types/timeline";
import { getTransitionProgress } from "@/lib/transition-helpers";
import { formatFrameTimecode } from "@/lib/frame-navigation";
import { PreviewTransformGizmo } from "@/components/editor/preview-transform-gizmo";
import { PreviewMediaClip } from "@/components/editor/preview-media-clip";

function formatTimecode(seconds: number): string {
  return formatFrameTimecode(seconds, 30);
}

export function PreviewCanvasPanel() {
  const {
    isHydrated,
    tracks,
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
    cancelSpaceAction,
  } = useTimeline();

  const { assets } = useMediaLibrary();
  const {
    videoRefs,
    viewportZoom,
    viewportPan,
    isSpacePressed,
    setIsSpacePressed,
    isCtrlPressed,
    isPanning,
    isFullscreen,
    showGrid,
    setShowGrid,
    showVolumeSlider,
    setShowVolumeSlider,
    isHoveringCanvasRef,
    canvasOuterStageRef,
    volumeDropdownRef,
    stageContainerRef,
    stageDimensions,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleToggleFullscreen,
    handleToggleMute,
    handleViewportPointerDown,
  } = usePreviewCanvasViewport({
    masterVolume,
    isMuted,
    setIsMuted,
    isPlaying,
    togglePlay,
    cancelSpaceAction,
  });

  // Find currently selected visual clip
  const selectedClip = React.useMemo(() => {
    if (!selectedClipId) return null;
    return clips.find((c) => c.id === selectedClipId && isVisualTrack(c.trackId, tracks)) || null;
  }, [clips, selectedClipId, tracks]);

  const clipMap = React.useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips]);
  const assetMap = React.useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  interface ActiveTransitionData {
    transition: typeof transitions[0];
    fromClip: typeof clips[0];
    toClip: typeof clips[0];
    progress: number;
  }

  // Map active transitions by normalized track ID so multiple visual tracks can have simultaneous transitions
  const activeTransitionsByTrack = React.useMemo(() => {
    const map = new Map<string, ActiveTransitionData>();
    if (!isHydrated || transitions.length === 0) return map;

    for (const trans of transitions) {
      const fromClip = clipMap.get(trans.fromClipId);
      const toClip = clipMap.get(trans.toClipId);
      if (!fromClip || !toClip) continue;
      // Skip transition if its visual track is hidden
      if (!isTrackVisible(fromClip.trackId, tracks)) continue;

      const progress = getTransitionProgress(playhead, trans, fromClip, toClip);
      if (progress !== null) {
        const key = normalizeVisualTrackId(fromClip.trackId);
        if (!map.has(key)) {
          map.set(key, { transition: trans, fromClip, toClip, progress });
        }
      }
    }
    return map;
  }, [isHydrated, transitions, clipMap, playhead, tracks]);

  // Find all active visual clips under current playhead sorted by z-order
  // Excludes visual clips on hidden tracks
  const visualClips = React.useMemo(
    () => clips.filter((c) => isVisualTrack(c.trackId, tracks) && isTrackVisible(c.trackId, tracks)),
    [clips, tracks]
  );
  const activeVisuals = React.useMemo(() => {
    if (!isHydrated) return [];
    return visualClips
      .filter((c) => playhead >= c.startTime && playhead < c.startTime + c.duration)
      .sort((a, b) => getVisualTrackLayerIndex(a.trackId, tracks) - getVisualTrackLayerIndex(b.trackId, tracks));
  }, [isHydrated, visualClips, playhead, tracks]);

  // Canonical visual tracks sorted from bottom (background z-index 1) to top (highest z-index)
  const orderedVisibleVisualTracks = React.useMemo(() => {
    const list = getVisualTracks(tracks).filter((t) => t.visible);
    return [...list].reverse();
  }, [tracks]);

  // Synchronize ALL active video elements with timeline playhead and global playback speed
  React.useEffect(() => {
    const videosToSync = new Map<string, typeof clips[0]>();

    // 1. All active visual clips on unhidden tracks
    activeVisuals.forEach((c) => {
      if (c.type === "video") {
        videosToSync.set(c.id, c);
      }
    });

    // 2. Connecting clips in active transitions
    activeTransitionsByTrack.forEach(({ fromClip, toClip }) => {
      if (fromClip.type === "video") videosToSync.set(fromClip.id, fromClip);
      if (toClip.type === "video") videosToSync.set(toClip.id, toClip);
    });

    videosToSync.forEach((clip) => {
      const vid = videoRefs.current.get(clip.id);
      if (!vid) return;

      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
      const effectiveRate = calculateEffectivePlaybackRate(speed, playbackSpeed);
      const targetTime = (playhead - clip.startTime) * speed + clip.inPoint;

      if (!isPlaying || Math.abs(vid.currentTime - targetTime) > 0.25) {
        if (Math.abs(vid.currentTime - targetTime) > 0.05) {
          vid.currentTime = Math.max(0, targetTime);
        }
      }

      if (vid.playbackRate !== effectiveRate) {
        vid.playbackRate = effectiveRate;
      }

      // Apply video clip volume, track volume, track mute, and master volume
      const clipVol = typeof clip.volume === "number" ? clip.volume : 1.0;
      const trackVol = getTrackVolume(clip.trackId, tracks);
      const isTrackMutedBool = isTrackMuted(clip.trackId, tracks);
      const effectiveVol =
        isMuted || isTrackMutedBool
          ? 0
          : Math.max(0, Math.min(1.0, clipVol * trackVol * masterVolume));
      vid.volume = effectiveVol;
      vid.muted = isMuted || isTrackMutedBool || effectiveVol === 0;

      if (isPlaying && vid.paused) {
        vid.play().catch(() => {});
      } else if (!isPlaying && !vid.paused) {
        vid.pause();
      }
    });
  }, [
    activeTransitionsByTrack,
    activeVisuals,
    playhead,
    isPlaying,
    playbackSpeed,
    isMuted,
    masterVolume,
    tracks,
  ]);

  const topActiveClip = activeVisuals[activeVisuals.length - 1];

  // Rendering one media node is a dedicated presentational component.
  const renderVisualNode = (clip: typeof clips[0], baseStyle?: React.CSSProperties) => {
    const asset = assetMap.get(clip.assetId);
    if (!asset) return null;
    return (
      <PreviewMediaClip
        key={clip.id}
        clip={clip}
        asset={asset}
        playhead={playhead}
        isSelected={clip.id === selectedClipId}
        videoRefs={videoRefs}
        onSelectClip={selectClip}
        baseStyle={baseStyle}
      />
    );
  };

  return (
    <EditorPanel>
      <EditorPanelHeader
        icon={<Eye className="size-4" />}
        title="Preview"
        meta={aspectRatio === "16:9" ? "16:9 · 1920 × 1080" : "9:16 · 1080 × 1920"}
        actions={
          <div className="flex shrink-0 items-center gap-1.5">
            <div
              className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
              title="Ctrl + scroll to zoom · Ctrl / Space + drag to pan"
            >
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleZoomOut}
                disabled={viewportZoom <= 25}
                title="Zoom out"
                aria-label="Zoom out preview canvas"
              >
                <ZoomOut className="size-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="xs"
                onClick={handleResetView}
                title="Reset canvas view to 100%"
                className="min-w-9"
              >
                {viewportZoom}%
              </Button>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleZoomIn}
                disabled={viewportZoom >= 400}
                title="Zoom in"
                aria-label="Zoom in preview canvas"
              >
                <ZoomIn className="size-3.5" />
              </Button>
            </div>

            {activeTransitionsByTrack.size > 0 ? (
              <span className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-3xs font-medium text-primary">
                <Sparkles className="size-3 shrink-0" />
                <span>
                  {activeTransitionsByTrack.values().next().value?.transition.type} ·{" "}
                  {Math.round((activeTransitionsByTrack.values().next().value?.progress ?? 0) * 100)}%
                </span>
              </span>
            ) : isHydrated && topActiveClip ? (
              <span className="flex max-w-40 items-center gap-1 rounded-full border border-border bg-surface-subtle px-2 py-1 text-3xs font-medium text-foreground">
                <span className="truncate">{topActiveClip.name}</span>
                {activeVisuals.length > 1 && (
                  <span className="shrink-0 font-mono text-muted-foreground">
                    {activeVisuals.length} layers
                  </span>
                )}
              </span>
            ) : null}
          </div>
        }
      />

      <EditorPanelBody className="justify-between gap-2.5 p-3">
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
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--editor-line) 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
          className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-editor-line bg-editor-stage p-4 shadow-inner select-none ${
            isPanning ? "cursor-grabbing" : isCtrlPressed || isSpacePressed ? "cursor-grab" : ""
          }`}
        >
          {/* Ambient studio glow behind the canvas */}
          <div className="pointer-events-none absolute inset-0 bg-radial from-primary/20 via-transparent to-transparent" />
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
              className={`relative flex flex-col items-center justify-between overflow-visible bg-editor-screen ring-1 ring-editor-line transition-all duration-200 select-none ${
                aspectRatio === "16:9"
                  ? "aspect-video h-auto max-h-96 w-full max-w-3xl rounded-2xl border border-editor-line p-2 shadow-2xl sm:max-h-100 md:max-h-125"
                  : "h-full max-h-96 rounded-3xl border border-editor-line p-2 shadow-2xl sm:max-h-100 md:max-h-125"
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
                {isHydrated && (activeVisuals.length > 0 || activeTransitionsByTrack.size > 0) ? (
                  /* MULTI-TRACK LAYER COMPOSITING (Renders each visual track in canonical z-order with simultaneous transition support) */
                  (() => {
                    const renderTransitionContent = (
                      transition: (typeof transitions)[0],
                      fromClip: (typeof clips)[0],
                      toClip: (typeof clips)[0],
                      progress: number,
                      zIndex: number
                    ) => {
                      if (transition.type === "cross-dissolve") {
                        return (
                          <div className="absolute inset-0 w-full h-full" style={{ isolation: "isolate", zIndex }}>
                            {renderVisualNode(fromClip, { opacity: 1 - progress, zIndex: 1 })}
                            {renderVisualNode(toClip, { opacity: progress, zIndex: 2, mixBlendMode: "plus-lighter" })}
                          </div>
                        );
                      }

                      if (transition.type === "fade-black") {
                        const fromOpacity = progress < 0.5 ? 1 - progress * 2 : 0;
                        const toOpacity = progress >= 0.5 ? (progress - 0.5) * 2 : 0;
                        return (
                          <div className="absolute inset-0 w-full h-full bg-editor-screen" style={{ zIndex }}>
                            {renderVisualNode(fromClip, { opacity: fromOpacity, zIndex: 1 })}
                            {renderVisualNode(toClip, { opacity: toOpacity, zIndex: 2 })}
                          </div>
                        );
                      }

                      if (transition.type === "slide-left") {
                        return (
                          <div className="absolute inset-0 w-full h-full overflow-hidden" style={{ zIndex }}>
                            {renderVisualNode(fromClip, {
                              transform: `translateX(${-progress * 100}%)`,
                              zIndex: 1,
                            })}
                            {renderVisualNode(toClip, {
                              transform: `translateX(${(1 - progress) * 100}%)`,
                              zIndex: 2,
                            })}
                          </div>
                        );
                      }

                      if (transition.type === "slide-right") {
                        return (
                          <div className="absolute inset-0 w-full h-full overflow-hidden" style={{ zIndex }}>
                            {renderVisualNode(fromClip, {
                              transform: `translateX(${progress * 100}%)`,
                              zIndex: 1,
                            })}
                            {renderVisualNode(toClip, {
                              transform: `translateX(${-(1 - progress) * 100}%)`,
                              zIndex: 2,
                            })}
                          </div>
                        );
                      }

                      return null;
                    };

                    return (
                      <>
                        {orderedVisibleVisualTracks.map((track) => {
                          const trackKey = normalizeVisualTrackId(track.id);
                          const layerZIndex = getVisualTrackLayerIndex(track.id, tracks);
                          const activeTrans = activeTransitionsByTrack.get(trackKey);
                          const trackClip = activeVisuals.find((c) =>
                            areClipsOnSameTrack(c.trackId, track.id, tracks)
                          );

                          if (activeTrans) {
                            return (
                              <React.Fragment key={`trans_track_${track.id}`}>
                                {renderTransitionContent(
                                  activeTrans.transition,
                                  activeTrans.fromClip,
                                  activeTrans.toClip,
                                  activeTrans.progress,
                                  layerZIndex
                                )}
                              </React.Fragment>
                            );
                          }

                          if (trackClip) {
                            return (
                              <React.Fragment key={`clip_track_${track.id}`}>
                                {renderVisualNode(trackClip, {
                                  position: "absolute",
                                  inset: 0,
                                  zIndex: layerZIndex,
                                })}
                              </React.Fragment>
                            );
                          }

                          return null;
                        })}
                      </>
                    );
                  })()
                ) : (
                  /* High-End Studio Cinema Empty State */
                  <div className="flex h-full flex-col items-center justify-center gap-3 bg-radial from-primary/15 to-editor-screen p-4 text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary shadow-inner">
                      <Film className="size-6 stroke-[1.75]" />
                    </div>

                    <div className="space-y-1">
                      <p className="font-semibold tracking-wide text-editor-on-dark">
                        {aspectRatio === "16:9" ? "16:9 Cinema Canvas" : "9:16 Reel Canvas"}
                      </p>
                      <p className="mx-auto max-w-56 leading-relaxed text-editor-on-dark-muted">
                        {!isHydrated || clips.length === 0
                          ? "Add clips to timeline or media library to begin preview."
                          : "Move playhead over an active clip to preview."}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="rounded-full border border-editor-line px-2 py-0.5 font-mono text-3xs font-medium text-editor-on-dark">
                        {aspectRatio === "16:9" ? "1920 × 1080" : "1080 × 1920"}
                      </span>
                      <span className="rounded-full bg-editor-line px-2 py-0.5 font-mono text-3xs font-medium text-editor-on-dark">
                        30 FPS
                      </span>
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
        <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-border bg-surface-subtle px-1.5 py-1.5">
          {/* Playback action buttons */}
          <div className="flex min-w-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
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
              variant="default"
              size="icon-lg"
              onClick={togglePlay}
              title={isPlaying ? "Pause timeline (Space)" : "Play timeline (Space)"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="size-4 fill-current" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
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
            <div className="ml-1 flex min-w-0 items-baseline gap-1 rounded-md bg-card px-2 py-1 font-mono text-3xs tabular-nums ring-1 ring-border">
              <span className="font-semibold text-foreground">
                {formatTimecode(isHydrated ? playhead : 0)}
              </span>
              <span className="text-muted-foreground/60">/</span>
              <span className="truncate text-muted-foreground">
                {formatTimecode(isHydrated ? totalDuration : 0)}
              </span>
            </div>
          </div>

          {/* Secondary Controls: Dynamic Volume, Grid & Fullscreen */}
          <div className="relative flex items-center gap-1">
            {/* Master Volume: click-to-open dropdown with slider + mute */}
            <div ref={volumeDropdownRef} className="relative flex items-center">
              <Button
                variant={isMuted ? "destructive" : "ghost"}
                size="icon-sm"
                onClick={() => setShowVolumeSlider((prev) => !prev)}
                aria-haspopup="true"
                aria-expanded={showVolumeSlider}
                title={isMuted ? "Master volume: muted (M)" : `Master volume: ${Math.round(masterVolume * 100)}% (M)`}
                aria-label="Master volume"
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
                  className="absolute bottom-full right-0 z-50 mb-2 flex w-48 animate-in flex-col gap-2 rounded-xl border border-border bg-popover/95 p-3 shadow-xl backdrop-blur-md fade-in slide-in-from-bottom-2 duration-150"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-medium text-foreground">Master volume</span>
                    <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                      {isMuted ? "Muted" : `${Math.round(masterVolume * 100)}%`}
                    </span>
                  </div>

                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : masterVolume}
                    onValueChange={(value) => {
                      const num = Array.isArray(value) ? value[0] : value;
                      setMasterVolume(num);
                      if (isMuted && num > 0) setIsMuted(false);
                      if (num === 0) setIsMuted(true);
                    }}
                    aria-label="Master preview volume slider"
                    className="w-full"
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleMute}
                    className="w-full justify-start"
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
              variant={showGrid ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setShowGrid((prev) => !prev)}
              title={showGrid ? "Hide rule-of-thirds composition grid" : "Show rule-of-thirds composition grid"}
              aria-label={showGrid ? "Hide composition grid" : "Show composition grid"}
            >
              <Grid3X3 className="size-3.5" />
            </Button>

            {/* Fullscreen Preview Toggle Button */}
            <Button
              variant={isFullscreen ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? "Exit fullscreen preview (Esc or F)" : "Fullscreen preview (F)"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen preview"}
            >
              {isFullscreen ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </EditorPanelBody>
    </EditorPanel>
  );
}
