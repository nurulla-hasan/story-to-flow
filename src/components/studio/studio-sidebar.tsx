"use client";

import * as React from "react";
import { BookOpen, FilePlus, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SimpleSelect } from "@/components/simple-select";
import { cn } from "cn";
import { STUDIO_STYLE_PRESETS } from "./types";

interface StudioSidebarProps {
  story: string;
  clipCount: number;
  defaultClipDuration: number;
  aspectRatio: "9:16" | "16:9";
  stylePreset: string;
  isPlanning: boolean;
  onUpdateStory: (story: string) => void;
  onNewStory: () => void;
  onPacingChange: (duration: number) => void;
  onAspectRatioChange: (aspectRatio: "9:16" | "16:9") => void;
  onStylePresetChange: (preset: string) => void;
  onPlanStory: () => void;
}

export function StudioSidebar({
  story,
  clipCount,
  defaultClipDuration,
  aspectRatio,
  stylePreset,
  isPlanning,
  onUpdateStory,
  onNewStory,
  onPacingChange,
  onAspectRatioChange,
  onStylePresetChange,
  onPlanStory,
}: StudioSidebarProps) {
  return (
    <aside className="w-full shrink-0 space-y-4 lg:w-85">
      {/* Story Input Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <BookOpen className="size-4" />
            </span>
            <CardTitle className="text-sm font-bold">Story</CardTitle>
          </div>

          <button
            type="button"
            onClick={onNewStory}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Clear and start a fresh story"
          >
            <FilePlus className="size-3.5" />
            New story
          </button>
        </CardHeader>

        <CardContent className="space-y-3 pt-2">
          <label htmlFor="story-input" className="sr-only">
            Story text
          </label>
          <Textarea
            id="story-input"
            value={story}
            onChange={(e) => onUpdateStory(e.target.value)}
            placeholder="Paste your story here (Bangla or English)..."
            rows={8}
            className="min-h-36 max-h-72 overflow-y-auto text-xs leading-6"
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {story.trim()
                ? `${story.trim().length.toLocaleString()} characters`
                : "Empty"}
            </span>
            {clipCount > 0 ? (
              <span className="font-mono text-2xs font-semibold text-primary">
                {clipCount} images planned
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Settings Card: Pacing, Aspect Ratio & Art Style */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Wand2 className="size-4" />
            </span>
            <CardTitle className="text-sm font-bold">Settings</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-3.5 pt-2">
          <div>
            <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pacing (Seconds Per Image)
            </label>
            <div className="mt-1.5 flex items-center gap-1">
              {[2.5, 3.0, 4.0, 5.0].map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => onPacingChange(dur)}
                  className={cn(
                    "flex-1 rounded py-1.5 font-mono text-2xs transition-colors",
                    defaultClipDuration === dur
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {dur}s
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aspect Ratio
            </label>
            <div className="mt-1.5 flex items-center gap-1">
              {(["9:16", "16:9"] as const).map((aspect) => (
                <button
                  key={aspect}
                  type="button"
                  onClick={() => onAspectRatioChange(aspect)}
                  className={cn(
                    "flex-1 rounded py-1.5 font-mono text-2xs transition-colors",
                    aspectRatio === aspect
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                  title={
                    aspect === "9:16"
                      ? "Vertical 9:16 for Shorts / TikTok / Reels"
                      : "Widescreen 16:9 for YouTube"
                  }
                >
                  {aspect === "9:16" ? "9:16 (Shorts)" : "16:9 (YT)"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Visual Art Style
            </label>
            <SimpleSelect
              value={stylePreset}
              onValueChange={onStylePresetChange}
              options={STUDIO_STYLE_PRESETS.map((preset) => ({
                value: preset,
                label: preset,
              }))}
              className="mt-1.5 text-xs"
            />
          </div>

          {/* Primary Action Button */}
          <Button
            type="button"
            onClick={onPlanStory}
            disabled={!story.trim() || isPlanning}
            className="mt-2 h-10 w-full gap-2 text-xs font-semibold"
          >
            {isPlanning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4 fill-current" />
            )}
            {isPlanning
              ? "Planning Voiceover & Flow Prompts…"
              : "✨ Generate Flow Prompts & Voiceover"}
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
}
