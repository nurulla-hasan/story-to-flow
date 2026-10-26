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
import type { TimelineClip, TrackId } from "@/types/timeline";

export function TimelineDock() {
  const {
    clips,
    selectedClipId,
    selectClip,
    moveClip,
    trimClip,
    splitClipAtPlayhead,
    deleteClip,
    duplicateClip,
    playhead,
    seek,
    zoom,
    setZoom,
    totalDuration,
    addAssetToTimeline,
    fitVisualsToVoiceover,
  } = useTimeline();

  const { assets } = useMediaLibrary();

  // Pixels per second scaled by zoom (40px/s at 100% zoom)
  const pxPerSec = (zoom / 100) * 40;
  const tracksContentWidth = Math.max(800, totalDuration * pxPerSec);

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

  // Interactive Clip Move Dragging Handler
  const startMoveDrag = (e: React.PointerEvent, clip: TimelineClip) => {
    e.stopPropagation();
    selectClip(clip.id);

    const startX = e.clientX;
    const initialStart = clip.startTime;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSec = deltaX / pxPerSec;
      moveClip(clip.id, Math.max(0, initialStart + deltaSec));
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Interactive Clip Trim Dragging Handler
  const startTrimDrag = (e: React.PointerEvent, clip: TimelineClip) => {
    e.stopPropagation();
    selectClip(clip.id);

    const startX = e.clientX;
    const initialDuration = clip.duration;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaSec = deltaX / pxPerSec;
      trimClip(clip.id, Math.max(0.5, initialDuration + deltaSec));
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const visualClips = clips.filter((c) => c.trackId === "visual");
  const audioClips = clips.filter((c) => c.trackId === "audio");
  const hasAudio = audioClips.length > 0;
  const hasVisual = visualClips.length > 0;

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
              disabled={!selectedClipId}
              onClick={() => selectedClipId && deleteClip(selectedClipId)}
              className="gap-1 text-destructive hover:bg-destructive/10"
              title="Delete selected clip (Del / Backspace)"
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
          <div className="flex items-center gap-1.5">
            <div className="font-mono text-2xs bg-muted text-foreground font-semibold px-1.5 py-0.5 rounded">
              {playhead.toFixed(2)}s
            </div>

            <Button
              variant="ghost"
              size="icon"
              disabled
              title="Toggle timeline snapping"
              aria-label="Toggle timeline snapping"
            >
              <Magnet className="size-3" />
            </Button>

            <div className="flex items-center gap-0.5">
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

              <Badge variant="secondary">
                {zoom}%
              </Badge>

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
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col">
        {/* Horizontal scroll container for tracks */}
        <div ref={tracksScrollRef} className="overflow-x-auto overflow-y-hidden">
          <div
            style={{ width: `${tracksContentWidth + 144}px` }}
            className="flex flex-col select-none"
          >
            {/* Time Ruler Section */}
            <div className="flex border-b border-border bg-muted/30 h-6 select-none shrink-0">
              {/* Track headers offset spacer */}
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

              {/* Track 1: Visual Scenes (Hero Videos & Images) */}
              <div className="flex h-12 bg-card hover:bg-muted/10 transition-colors">
                {/* Track 1 Header */}
                <div className="w-36 shrink-0 border-r border-border p-2 flex items-center justify-between bg-muted/20 z-20">
                  <div className="flex items-center gap-1.5">
                    <div className="size-5 rounded bg-primary/10 flex items-center justify-center text-primary">
                      <Video className="size-3" />
                    </div>
                    <div>
                      <p className="text-2xs font-semibold text-foreground leading-tight">
                        Visual Scenes
                      </p>
                      <p className="text-3xs text-muted-foreground">{visualClips.length} clips</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="size-2.5" />
                    <Lock className="size-2.5" />
                  </div>
                </div>

                {/* Track 1 Lane Surface */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleTrackDrop(e, "visual")}
                  style={{ width: `${tracksContentWidth}px` }}
                  className="relative h-full flex items-center px-1 overflow-visible"
                >
                  {visualClips.length === 0 ? (
                    <div className="w-full border border-dashed border-border rounded h-8 flex items-center justify-center text-3xs text-muted-foreground gap-1.5 bg-muted/10 pointer-events-none">
                      <Video className="size-3 text-muted-foreground/60" />
                      <span>Drag scene images or videos here, or click &quot;+&quot; in Media Library.</span>
                    </div>
                  ) : (
                    visualClips.map((clip) => {
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
                          className={`group absolute h-9 rounded-md border flex items-center justify-between px-1.5 overflow-hidden transition-shadow select-none cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? "border-primary bg-primary/20 ring-2 ring-primary shadow-sm z-10"
                              : "border-border bg-card hover:border-primary/50"
                          }`}
                        >
                          {/* Clip thumbnail preview badge */}
                          <div className="flex items-center gap-1.5 min-w-0 pointer-events-none">
                            {asset?.thumbnailUrl || asset?.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={asset.thumbnailUrl || asset.url}
                                alt={clip.name}
                                className="size-6 rounded object-cover shrink-0"
                              />
                            ) : (
                              <Video className="size-3.5 text-primary shrink-0" />
                            )}
                            <span className="text-2xs font-medium text-foreground truncate">
                              {clip.name}
                            </span>
                          </div>

                          <span className="text-3xs font-mono text-muted-foreground shrink-0 pl-1 pointer-events-none">
                            {clip.duration.toFixed(1)}s
                          </span>

                          {/* Right edge trim handle */}
                          <div
                            onPointerDown={(e) => startTrimDrag(e, clip)}
                            className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-primary/30 hover:bg-primary cursor-ew-resize transition-all rounded-r"
                            title="Drag to trim duration"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Track 2: Voiceover Narration (Cartesia Audio) */}
              <div className="flex h-12 bg-card hover:bg-muted/10 transition-colors">
                {/* Track 2 Header */}
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

                {/* Track 2 Lane Surface */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleTrackDrop(e, "audio")}
                  style={{ width: `${tracksContentWidth}px` }}
                  className="relative h-full flex items-center px-1 overflow-visible"
                >
                  {audioClips.length === 0 ? (
                    <div className="w-full border border-dashed border-border rounded h-8 flex items-center justify-center text-3xs text-muted-foreground gap-1.5 bg-muted/10 pointer-events-none">
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
                          className={`group absolute h-9 rounded-md border flex items-center justify-between px-2 overflow-hidden transition-shadow select-none cursor-grab active:cursor-grabbing ${
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
                            <span className="text-2xs font-medium text-foreground truncate">
                              {clip.name}
                            </span>
                          </div>

                          <span className="text-3xs font-mono text-muted-foreground shrink-0 pl-1 pointer-events-none z-10">
                            {clip.duration.toFixed(1)}s
                          </span>

                          {/* Right edge trim handle */}
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
