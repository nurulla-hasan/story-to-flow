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

/**
 * Format seconds into standard MM:SS:FF timecode
 */
function formatTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30); // 30 fps frame index
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
}

export function PreviewCanvasPanel() {
  const {
    clips,
    playhead,
    isPlaying,
    togglePlay,
    seek,
    totalDuration,
  } = useTimeline();

  const { assets } = useMediaLibrary();
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Find active visual clip under current playhead
  const visualClips = React.useMemo(() => clips.filter((c) => c.trackId === "visual"), [clips]);
  const activeClip = React.useMemo(() => {
    return visualClips.find(
      (c) => playhead >= c.startTime && playhead < c.startTime + c.duration
    );
  }, [visualClips, playhead]);

  // Find matching asset object URL from IndexedDB library
  const activeAsset = React.useMemo(() => {
    if (!activeClip) return null;
    return assets.find((a) => a.id === activeClip.assetId) || null;
  }, [activeClip, assets]);

  // Synchronize video element playback time with timeline playhead
  React.useEffect(() => {
    if (activeAsset?.category === "video" && videoRef.current && activeClip) {
      const targetTime = (playhead - activeClip.startTime) + activeClip.inPoint;
      if (Math.abs(videoRef.current.currentTime - targetTime) > 0.15) {
        videoRef.current.currentTime = Math.max(0, targetTime);
      }
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [activeAsset, activeClip, playhead, isPlaying]);

  return (
    <Card size="sm" className="flex flex-col h-full">
      <CardHeader className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-primary" />
            <CardTitle>9:16 Preview Canvas</CardTitle>
          </div>
          <Badge variant="outline">
            {activeClip ? `${activeClip.name}` : "1080 × 1920"}
          </Badge>
        </div>
        <CardDescription>
          Real-time vertical canvas rendered for Reels, TikTok &amp; Shorts
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 justify-between gap-2">
        {/* Stage Container with dark backdrop */}
        <div className="flex items-center justify-center bg-muted/40 rounded-xl p-2 flex-1 min-h-0 overflow-hidden">
          {/* Vertical 9:16 Phone Canvas Mockup */}
          <div
            style={{ aspectRatio: "9/16" }}
            className="relative h-full max-h-72 sm:max-h-84 md:max-h-96 rounded-2xl border-2 border-border bg-card shadow-md flex flex-col items-center justify-between p-2.5 overflow-hidden"
          >
            {/* Top Phone Notch / Camera indicator */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-muted-foreground/30 z-20 pointer-events-none" />

            {/* Stage Media Display */}
            <div className="relative w-full h-full rounded-xl overflow-hidden flex items-center justify-center bg-muted/20">
              {activeAsset && activeClip ? (
                activeAsset.category === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeAsset.url}
                    alt={activeAsset.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : activeAsset.category === "video" ? (
                  <video
                    ref={videoRef}
                    src={activeAsset.url}
                    playsInline
                    muted
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <Smartphone className="size-8 text-primary/60 mb-2" />
                    <p className="text-xs font-semibold text-foreground">Audio Track Active</p>
                    <p className="text-2xs text-muted-foreground">{activeClip.name}</p>
                  </div>
                )
              ) : (
                /* Empty Canvas Placeholder */
                <div className="flex flex-col items-center justify-center text-center space-y-2 p-2">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Smartphone className="size-5" />
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">
                      Canvas is empty
                    </p>
                    <p className="text-2xs text-muted-foreground max-w-40 leading-tight">
                      {clips.length === 0
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

            {/* Bottom Home Indicator Bar */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-muted-foreground/30 z-20 pointer-events-none" />
          </div>
        </div>

        {/* Transport Controls Bar */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          {/* Playback action buttons */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => seek(0)}
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
              onClick={() => seek(totalDuration)}
              title="Jump to timeline end (End)"
              aria-label="Jump to timeline end"
            >
              <SkipForward className="size-3.5" />
            </Button>

            {/* Timecode Counter */}
            <div className="ml-1 font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
              {formatTimecode(playhead)} / {formatTimecode(totalDuration)}
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
