"use client";

import * as React from "react";
import {
  Play,
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

export function PreviewCanvasPanel() {
  return (
    <Card size="sm" className="flex flex-col h-full">
      <CardHeader className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-primary" />
            <CardTitle>9:16 Preview Canvas</CardTitle>
          </div>
          <Badge variant="outline">1080 × 1920</Badge>
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
            className="h-full max-h-72 sm:max-h-84 md:max-h-96 rounded-2xl border-2 border-border bg-card shadow-md flex flex-col items-center justify-between p-3 overflow-hidden"
          >
            {/* Top Phone Notch / Camera indicator */}
            <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />

            {/* Canvas Empty State Content */}
            <div className="flex flex-col items-center justify-center text-center space-y-2 p-2">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Smartphone className="size-5" />
              </div>

              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">
                  Canvas is empty
                </p>
                <p className="text-2xs text-muted-foreground max-w-40 leading-tight">
                  Timeline clips will render here with real-time 9:16 vertical playback.
                </p>
              </div>

              <Badge variant="secondary">
                9:16 • 30 FPS • 1.0x
              </Badge>
            </div>

            {/* Bottom Home Indicator Bar */}
            <div className="w-16 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        </div>

        {/* Transport Controls Bar */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
          {/* Playback action buttons */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              disabled
              title="Jump to timeline start"
              aria-label="Jump to timeline start"
            >
              <SkipBack className="size-3.5" />
            </Button>

            <Button
              size="icon"
              disabled
              title="Play / Pause timeline preview — Available in Phase 3"
              aria-label="Play or pause timeline preview"
            >
              <Play className="size-3.5 fill-current" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              disabled
              title="Jump to timeline end"
              aria-label="Jump to timeline end"
            >
              <SkipForward className="size-3.5" />
            </Button>

            {/* Timecode Counter */}
            <div className="ml-1 font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
              00:00:00 / 00:00:00
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
