"use client";

import * as React from "react";
import { Layers, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudioEmptyStateProps {
  story: string;
  isPlanning: boolean;
  onPlanStory: () => void;
}

export function StudioEmptyState({
  story,
  isPlanning,
  onPlanStory,
}: StudioEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
        <Layers className="size-6" />
      </span>
      <h3 className="mt-3 text-sm font-semibold">No image prompts generated yet</h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
        Paste your story in the left sidebar, choose pacing and art style, then click
        &quot;Generate Flow Prompts &amp; Voiceover&quot; to create sequential 3-second image
        prompts for Google Flow!
      </p>
      {story.trim() ? (
        <Button
          type="button"
          className="mt-4 gap-1.5 text-xs"
          onClick={onPlanStory}
          disabled={isPlanning}
        >
          {isPlanning ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Generate Flow Prompts now
        </Button>
      ) : null}
    </div>
  );
}
