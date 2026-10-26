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
import { useTimeline } from "@/lib/timeline-context";
import { useMediaLibrary } from "@/lib/use-media-library";
import { AudioWaveformView } from "@/components/editor/audio-waveform-view";
import {
  type TimelineClip,
  type TrackId,
  isAudioTrack,
} from "@/types/timeline";
import { findAdjacentClipPairs } from "@/lib/transition-helpers";

export function TimelineDock() {
  const {
    isHydrated,
    clips,
    transitions,
    selectedClipId,
    selectedTransitionId,
    selectClip,
    selectTransition,
    moveClip,
    trimClip,
    splitClipAtPlayhead,
    deleteClip,
    duplicateClip,
    addTransition,
    deleteTransition,
    playhead,
    seek,
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

  // Pixels per second scaled by zoom (40px/s at 100% zoom)
  const pxPerSec = (zoom / 100) * 40;
  const tracksContentWidth = Math.max(900, (totalDuration + 5) * pxPerSec);

  const rulerRef = React.useRef<HTMLDivElement>(null);
  const tracksScrollRef = React.useRef<HTMLDivElement>(null);

  // Ruler tick intervals: step by 1s, 2s, or 5s depending on zoom
  const step = zoom >= 140 ? 1 : zoom <= 75 ? 5 : 2;
  const rulerTicks = React.useMemo(() => {
    const ticks: number[] = [];
    for (let t = 0; t <= totalDuration; t += step) {
      ticks.push(t);
    }
    return ticks;
  }, [totalDuration, step]);

  // Scrubbing on Time Ruler
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, clickX / pxPerSec);
    seek(newTime);
  };

  // Drag-and-drop from Media Library onto tracks
  const handleTrackDrop = (e: React.DragEvent, trackId: TrackId) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (raw) {
        const asset = JSON.parse(raw);
        if (asset && asset.id) {
          const rect = e.currentTarget.getBoundingClientRect();
          const dropX = e.clientX - rect.left;
          const dropTime = Math.max(0, dropX / pxPerSec);
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

  // Interactive Clip Move Dragging Handler with Magnetic Snapping
  const startMoveDrag = (e: React.PointerEvent, clip: TimelineClip) => {
    e.stopPropagation();
    selectClip(clip.id);

    const startX = e.clientX;
    const initialStart = clip.startTime;
    const snapThresholdSec = 10 / pxPerSec; // 10px snap window
    const snapPoints = getSnapPoints(clip.id);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let rawStart = Math.max(0, initialStart + deltaX / pxPerSec);
      let snapped = false;

      // Magnetic Snapping (can be bypassed by holding Shift)
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

      moveClip(clip.id, rawStart);
    };

    const onPointerUp = () => {
      setActiveSnapGuide(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Interactive Clip Trim Dragging Handler with Magnetic Snapping
  const startTrimDrag = (e: React.PointerEvent, clip: TimelineClip) => {
    e.stopPropagation();
    selectClip(clip.id);

    const startX = e.clientX;
    const initialDuration = clip.duration;
    const snapThresholdSec = 10 / pxPerSec;
    const snapPoints = getSnapPoints(clip.id);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let rawDuration = Math.max(0.5, initialDuration + deltaX / pxPerSec);
      const rawEnd = clip.startTime + rawDuration;
      let snapped = false;

      if (snapEnabled && !moveEvent.shiftKey) {
        for (const pt of snapPoints) {
          if (pt > clip.startTime && Math.abs(rawEnd - pt) <= snapThresholdSec) {
            rawDuration = Math.max(0.5, pt - clip.startTime);
            setActiveSnapGuide(pt);
            snapped = true;
            break;
          }
        }
      }

      if (!snapped) {
        setActiveSnapGuide(null);
      }

      trimClip(clip.id, rawDuration);
    };

    const onPointerUp = () => {
      setActiveSnapGuide(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Multi-Track Layers Separation
  const visualLayer2Clips = clips.filter((c) => c.trackId === "visual-2");
  const visualLayer1Clips = clips.filter((c) => c.trackId === "visual-1" || c.trackId === "visual");
  const audioClips = clips.filter((c) => isAudioTrack(c.trackId));

  const hasAudio = audioClips.length > 0;
  const hasVisual = visualLayer1Clips.length > 0 || visualLayer2Clips.length > 0;

  // Render a visual track lane with clips and transition seam badges
  const renderVisualTrackLane = (trackId: "visual-1" | "visual-2", trackClips: TimelineClip[]) => {
    const adjacentPairs = findAdjacentClipPairs(trackClips);

    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleTrackDrop(e, trackId)}
        style={{ width: `${tracksContentWidth}px` }}
        className="relative h-full flex items-center px-1 overflow-visible"
      >
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
            {/* Visual Clips on Track */}
            {trackClips.map((clip) => {
              const isSelected = clip.id === selectedClipId;
              const leftPos = clip.startTime * pxPerSec;
              const widthPx = Math.max(20, clip.duration * pxPerSec);
              const asset = assets.find((a) => a.id === clip.assetId);

              return (
                <div
                  key={clip.id}
                  style={{
                    left: `${leftPos}px`,
                    width: `${widthPx}px`,
                  }}
                  onPointerDown={(e) => startMoveDrag(e, clip)}
                  className={`group absolute h-8 rounded-md border flex items-center justify-between px-1.5 overflow-hidden transition-shadow select-none cursor-grab active:cursor-grabbing ${
                    isSelected
                      ? "border-primary bg-primary/20 ring-2 ring-primary shadow-sm z-10"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0 pointer-events-none">
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

                  <span className="text-3xs font-mono text-muted-foreground shrink-0 pl-1 pointer-events-none">
                    {clip.duration.toFixed(1)}s
                  </span>

                  <div
                    onPointerDown={(e) => startTrimDrag(e, clip)}
                    className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-primary/30 hover:bg-primary cursor-ew-resize transition-all rounded-r"
                    title="Drag to trim duration"
                  />
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
                  className="absolute z-20 flex items-center justify-center pointer-events-auto"
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
      {/* Timeline Controls Header */}
      <CardHeader className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Clip Editing Tools */}
          <div className="flex items-center gap-1">
            <div className="mr-1.5 flex items-center">
              <CardTitle className="flex items-center gap-1">
                Timeline
              </CardTitle>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={!selectedClipId}
              onClick={() => splitClipAtPlayhead()}
              className="gap-1"
              title="Split clip at playhead (Ctrl+B)"
            >
              <Scissors className="size-3" />
              <span className="hidden sm:inline">Split</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!selectedClipId && !selectedTransitionId}
              onClick={() => {
                if (selectedClipId) deleteClip(selectedClipId);
                else if (selectedTransitionId) deleteTransition(selectedTransitionId);
              }}
              className="gap-1 text-destructive hover:bg-destructive/10"
              title="Delete selected clip or transition (Del / Backspace)"
            >
              <Trash2 className="size-3" />
              <span className="hidden sm:inline">Delete</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!selectedClipId}
              onClick={() => selectedClipId && duplicateClip(selectedClipId)}
              className="gap-1"
              title="Duplicate selected clip (Ctrl+D)"
            >
              <Copy className="size-3" />
              <span className="hidden sm:inline">Duplicate</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={!hasAudio || !hasVisual}
              onClick={() => fitVisualsToVoiceover()}
              className="gap-1"
              title="Auto-fit visual scenes to voiceover duration"
            >
              <Wand2 className="size-3" />
              <span className="hidden md:inline">Fit to Audio</span>
            </Button>
          </div>

          {/* Right: Timeline Zoom, Snap & Playhead Position */}
          <div className="flex items-center gap-2">
            <div className="font-mono text-2xs bg-muted text-foreground font-semibold px-1.5 py-0.5 rounded">
              {isHydrated ? playhead.toFixed(2) : "0.00"}s
            </div>

            {/* Magnetic Snapping Toggle */}
            <Button
              variant={snapEnabled ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setSnapEnabled(!snapEnabled)}
              title={snapEnabled ? "Snapping ON (Hold Shift while dragging to disable)" : "Snapping OFF"}
              aria-label="Toggle magnetic snapping"
            >
              <Magnet className={`size-3.5 ${snapEnabled ? "text-primary" : "text-muted-foreground"}`} />
            </Button>

            {/* Interactive Timeline Zoom Slider & Buttons */}
            <div className="flex items-center gap-1.5 bg-muted/40 p-0.5 rounded-lg border border-border">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(zoom - 15)}
                disabled={zoom <= 50}
                title="Zoom out timeline"
                aria-label="Zoom out timeline"
              >
                <ZoomOut className="size-3" />
              </Button>

              <input
                type="range"
                min="50"
                max="200"
                step="5"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Timeline zoom scale"
                className="w-16 sm:w-20 accent-primary cursor-pointer h-1"
              />

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(zoom + 15)}
                disabled={zoom >= 200}
                title="Zoom in timeline"
                aria-label="Zoom in timeline"
              >
                <ZoomIn className="size-3" />
              </Button>

              <Badge variant="secondary">
                {isHydrated ? zoom : 100}%
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col">
        {/* Horizontal scroll container for multi-track timeline */}
        <div ref={tracksScrollRef} className="overflow-x-auto overflow-y-hidden">
          <div
            style={{ width: `${tracksContentWidth + 144}px` }}
            className="flex flex-col select-none"
          >
            {/* Time Ruler Section */}
            <div className="flex border-b border-border bg-muted/30 h-6 select-none shrink-0">
              <div className="w-36 shrink-0 border-r border-border px-2 flex items-center text-3xs text-muted-foreground uppercase font-medium">
                Tracks
              </div>

              {/* Interactive Ruler surface */}
              <div
                ref={rulerRef}
                onClick={handleRulerClick}
                style={{ width: `${tracksContentWidth}px` }}
                className="relative h-full cursor-pointer hover:bg-muted/50"
              >
                {rulerTicks.map((tick) => {
                  const leftPos = tick * pxPerSec;
                  const mins = Math.floor(tick / 60);
                  const secs = tick % 60;
                  const label = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

                  return (
                    <div
                      key={tick}
                      style={{ left: `${leftPos}px` }}
                      className="absolute bottom-0 flex flex-col items-start pointer-events-none"
                    >
                      <span className="text-3xs font-mono text-muted-foreground pl-1">
                        {label}
                      </span>
                      <div className="w-px h-1.5 bg-border" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tracks Area Container */}
            <div className="relative flex flex-col divide-y divide-border">
              {/* Dynamic Playhead Scrubber Line */}
              <div
                style={{ left: `${144 + playhead * pxPerSec}px` }}
                className="absolute top-0 bottom-0 z-30 flex flex-col items-center pointer-events-none transition-transform duration-75"
              >
                <div className="size-2.5 rotate-45 bg-primary -mt-1 shadow-sm" />
                <div className="w-0.5 flex-1 bg-primary" />
              </div>

              {/* Active Snap Guide Line */}
              {activeSnapGuide !== null && (
                <div
                  style={{ left: `${144 + activeSnapGuide * pxPerSec}px` }}
                  className="absolute top-0 bottom-0 z-40 w-px bg-info pointer-events-none shadow-sm"
                />
              )}

              {/* Layer 2: Visual Track 2 (Overlay / Top Visual Layer) */}
              <div className="flex h-11 bg-card hover:bg-muted/10 transition-colors">
                <div className="w-36 shrink-0 border-r border-border p-2 flex items-center justify-between bg-muted/20 z-20">
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

                {renderVisualTrackLane("visual-2", visualLayer2Clips)}
              </div>

              {/* Layer 1: Visual Track 1 (Base / Main Visual Layer) */}
              <div className="flex h-11 bg-card hover:bg-muted/10 transition-colors">
                <div className="w-36 shrink-0 border-r border-border p-2 flex items-center justify-between bg-muted/20 z-20">
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

                {renderVisualTrackLane("visual-1", visualLayer1Clips)}
              </div>

              {/* Track 3: Voiceover Narration (Cartesia Audio) */}
              <div className="flex h-11 bg-card hover:bg-muted/10 transition-colors">
                <div className="w-36 shrink-0 border-r border-border p-2 flex items-center justify-between bg-muted/20 z-20">
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

                {/* Track 3 Surface */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleTrackDrop(e, "audio")}
                  style={{ width: `${tracksContentWidth}px` }}
                  className="relative h-full flex items-center px-1 overflow-visible"
                >
                  {!isHydrated || audioClips.length === 0 ? (
                    <div className="w-full border border-dashed border-border rounded h-7 flex items-center justify-center text-3xs text-muted-foreground gap-1.5 bg-muted/10 pointer-events-none">
                      <Mic className="size-3 text-muted-foreground/60" />
                      <span>Drag voiceover audio here to align visual scene pacing.</span>
                    </div>
                  ) : (
                    audioClips.map((clip) => {
                      const isSelected = clip.id === selectedClipId;
                      const leftPos = clip.startTime * pxPerSec;
                      const widthPx = Math.max(20, clip.duration * pxPerSec);
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
                          {/* Real Audio Waveform Visualization in background */}
                          <div className="absolute inset-0 flex items-center justify-center px-1 overflow-hidden pointer-events-none opacity-30">
                            <AudioWaveformView blob={asset?.blob || null} clipDuration={clip.duration} />
                          </div>

                          <div className="flex items-center gap-1.5 min-w-0 pointer-events-none z-10">
                            <Mic className="size-3 text-primary shrink-0" />
                            <span className="text-3xs font-medium text-foreground truncate">
                              {clip.name}
                            </span>
                          </div>

                          <span className="text-3xs font-mono text-muted-foreground shrink-0 pl-1 pointer-events-none z-10">
                            {clip.duration.toFixed(1)}s
                          </span>

                          <div
                            onPointerDown={(e) => startTrimDrag(e, clip)}
                            className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-primary/30 hover:bg-primary cursor-ew-resize transition-all rounded-r z-20"
                            title="Drag to trim duration"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
