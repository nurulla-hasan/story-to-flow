"use client";

import * as React from "react";
import {
  SlidersHorizontal,
  Clock,
  Gauge,
  Sparkles,
  MousePointerClick,
  Info,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ClipInspectorPanel() {
  return (
    <Card size="sm" className="flex flex-col h-full">
      <CardHeader className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            <CardTitle>Clip Inspector</CardTitle>
          </div>
          <Badge variant="outline">No Selection</Badge>
        </div>
        <CardDescription>
          Fine-tune clip timing, motion &amp; narration
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 justify-between gap-3">
        {/* Empty selection guidance box */}
        <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-3 text-center space-y-1 bg-muted/20">
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <MousePointerClick className="size-3.5" />
          </div>
          <p className="text-xs font-semibold text-foreground">
            No clip selected
          </p>
          <p className="text-3xs text-muted-foreground max-w-44 leading-tight">
            Select any scene clip or voiceover track on the timeline below to edit its properties.
          </p>
        </div>

        {/* Disabled Preview Parameters */}
        <div className="space-y-3 opacity-60">
          {/* Duration Control Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-2xs">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Clock className="size-3 text-muted-foreground" />
                <span>Duration</span>
              </span>
              <span className="font-mono text-3xs text-muted-foreground">3.00s</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="15"
              step="0.5"
              defaultValue="3"
              disabled
              aria-label="Clip duration preview"
              className="w-full accent-primary cursor-not-allowed"
            />
          </div>

          {/* Speed Preset Chips */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-2xs font-medium text-foreground">
              <Gauge className="size-3 text-muted-foreground" />
              <span>Speed</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center">
              {["0.5x", "1.0x", "1.5x", "2.0x"].map((speed, i) => (
                <div
                  key={speed}
                  className={`py-0.5 text-3xs font-mono rounded border border-border ${
                    i === 1 ? "bg-muted font-bold" : "text-muted-foreground"
                  }`}
                >
                  {speed}
                </div>
              ))}
            </div>
          </div>

          {/* Motion Presets Preview */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-2xs font-medium text-foreground">
              <Sparkles className="size-3 text-muted-foreground" />
              <span>Motion Preset</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {["Static", "Zoom In", "Pan Left", "Pan Right"].map((motion, i) => (
                <div
                  key={motion}
                  className={`py-0.5 px-1.5 text-3xs rounded border border-border text-center ${
                    i === 0 ? "bg-muted font-bold" : "text-muted-foreground"
                  }`}
                >
                  {motion}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Phase 3 info notice */}
        <div className="flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-2xs text-muted-foreground">
          <Info className="size-3 shrink-0 mt-0.5 text-primary" />
          <p className="leading-tight">
            Clip splitting, duration trimming, and speed controls will be fully interactive in Phase 3.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
