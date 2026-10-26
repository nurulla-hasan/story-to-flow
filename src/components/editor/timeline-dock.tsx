"use client";

import * as React from "react";
import {
  Scissors,
  Trash2,
  Copy,
  Wand2,
  Video,
  Mic,
  ZoomIn,
  ZoomOut,
  Magnet,
  Volume2,
  Eye,
  Lock,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function TimelineDock() {
  const rulerMarks = [
    "00:00",
    "00:02",
    "00:04",
    "00:06",
    "00:08",
    "00:10",
    "00:12",
    "00:14",
    "00:16",
    "00:18",
    "00:20",
  ];

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
              disabled
              className="gap-1"
              title="Split clip at playhead (Ctrl+B) — Phase 3"
            >
              <Scissors className="size-3" />
              <span className="hidden sm:inline">Split</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled
              className="gap-1"
              title="Delete selected clip (Del) — Phase 3"
            >
              <Trash2 className="size-3" />
              <span className="hidden sm:inline">Delete</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled
              className="gap-1"
              title="Duplicate selected clip (Ctrl+D) — Phase 3"
            >
              <Copy className="size-3" />
              <span className="hidden sm:inline">Duplicate</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled
              className="gap-1"
              title="Fit visual clips to voiceover duration — Phase 4"
            >
              <Wand2 className="size-3" />
              <span className="hidden md:inline">Fit to Audio</span>
            </Button>
          </div>

          {/* Right: Timeline Zoom, Snap & Playhead Position */}
          <div className="flex items-center gap-1.5">
            <div className="font-mono text-2xs bg-muted text-foreground font-semibold px-1.5 py-0.5 rounded">
              00:00.00
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
                disabled
                title="Zoom out timeline"
                aria-label="Zoom out timeline"
              >
                <ZoomOut className="size-3" />
              </Button>

              <Badge variant="secondary">
                100%
              </Badge>

              <Button
                variant="ghost"
                size="icon"
                disabled
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
        <div className="overflow-x-auto">
          <div className="min-w-160 flex flex-col">
            {/* Time Ruler Section */}
            <div className="flex border-b border-border bg-muted/30 h-6 select-none shrink-0">
              {/* Track headers offset spacer */}
              <div className="w-36 shrink-0 border-r border-border px-2 flex items-center text-3xs text-muted-foreground uppercase font-medium">
                Tracks
              </div>

              {/* Ruler tick markers */}
              <div className="flex-1 flex items-end justify-between px-4 pb-0.5 text-3xs font-mono text-muted-foreground">
                {rulerMarks.map((mark) => (
                  <div key={mark} className="flex flex-col items-center gap-0.5">
                    <span>{mark}</span>
                    <div className="w-px h-1 bg-border" />
                  </div>
                ))}
              </div>
            </div>

            {/* Tracks Area */}
            <div className="relative flex flex-col divide-y divide-border">
              {/* Playhead Red/Primary Line Marker */}
              <div className="absolute top-0 bottom-0 left-36 z-10 flex flex-col items-center pointer-events-none">
                <div className="size-2 rotate-45 bg-primary -mt-1 shadow-sm" />
                <div className="w-0.5 flex-1 bg-primary/70" />
              </div>

              {/* Track 1: Visual Scenes (Hero Videos & Images) */}
              <div className="flex h-12 bg-card hover:bg-muted/10 transition-colors">
                {/* Track 1 Header */}
                <div className="w-36 shrink-0 border-r border-border p-2 flex items-center justify-between bg-muted/20">
                  <div className="flex items-center gap-1.5">
                    <div className="size-5 rounded bg-primary/10 flex items-center justify-center text-primary">
                      <Video className="size-3" />
                    </div>
                    <div>
                      <p className="text-2xs font-semibold text-foreground leading-tight">
                        Visual Scenes
                      </p>
                      <p className="text-3xs text-muted-foreground">Flow 9:16 Clips</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="size-2.5" />
                    <Lock className="size-2.5" />
                  </div>
                </div>

                {/* Track 1 Lane Empty State */}
                <div className="flex-1 flex items-center px-3">
                  <div className="w-full border border-dashed border-border rounded h-8 flex items-center justify-center text-3xs text-muted-foreground gap-1.5 bg-muted/10">
                    <Video className="size-3 text-muted-foreground/60" />
                    <span>No visual scene clips on timeline. Drag video/images here or load from Story Studio.</span>
                  </div>
                </div>
              </div>

              {/* Track 2: Voiceover Narration (Cartesia Audio) */}
              <div className="flex h-12 bg-card hover:bg-muted/10 transition-colors">
                {/* Track 2 Header */}
                <div className="w-36 shrink-0 border-r border-border p-2 flex items-center justify-between bg-muted/20">
                  <div className="flex items-center gap-1.5">
                    <div className="size-5 rounded bg-secondary flex items-center justify-center text-foreground">
                      <Mic className="size-3" />
                    </div>
                    <div>
                      <p className="text-2xs font-semibold text-foreground leading-tight">
                        Voiceover
                      </p>
                      <p className="text-3xs text-muted-foreground">Bengali Speech</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Volume2 className="size-2.5" />
                    <Lock className="size-2.5" />
                  </div>
                </div>

                {/* Track 2 Lane Empty State */}
                <div className="flex-1 flex items-center px-3">
                  <div className="w-full border border-dashed border-border rounded h-8 flex items-center justify-center text-3xs text-muted-foreground gap-1.5 bg-muted/10">
                    <Mic className="size-3 text-muted-foreground/60" />
                    <span>No voiceover track loaded. Audio waveform and timing will appear here.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
