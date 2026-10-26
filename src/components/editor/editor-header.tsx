"use client";

import * as React from "react";
import Link from "next/link";
import {
  Film,
  RotateCcw,
  RotateCw,
  Smartphone,
  Wand2,
  Download,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTimeline } from "@/lib/timeline-context";

export function EditorHeader() {
  const {
    projectTitle,
    setProjectTitle,
    canUndo,
    canRedo,
    undo,
    redo,
    clips,
  } = useTimeline();

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProjectTitle(e.target.value);
  };

  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3 shrink-0">
      {/* Left: Navigation back to Studio + Project title & History actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/studio">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            title="Return to Story Studio"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Story Studio</span>
          </Button>
        </Link>

        <Separator orientation="vertical" className="h-5 hidden sm:block" />

        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
            <Film className="size-4" />
          </div>
          <input
            type="text"
            value={projectTitle}
            onChange={handleTitleChange}
            aria-label="Project Title"
            className="font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-hidden px-1 py-0.5 max-w-44 sm:max-w-64 truncate text-sm"
          />
        </div>

        <Badge variant="outline">
          {clips.length > 0 ? `${clips.length} ${clips.length === 1 ? "Clip" : "Clips"}` : "Draft"}
        </Badge>

        <Separator orientation="vertical" className="h-4 hidden md:block" />

        {/* Undo / Redo controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={!canUndo}
            title={canUndo ? "Undo (Ctrl+Z)" : "Nothing to undo"}
            aria-label="Undo"
          >
            <RotateCcw className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={redo}
            disabled={!canRedo}
            title={canRedo ? "Redo (Ctrl+Y)" : "Nothing to redo"}
            aria-label="Redo"
          >
            <RotateCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Right: Aspect ratio, Smart Auto-fit, Export & Theme Toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1.5">
          <Smartphone className="size-3" />
          <span>9:16 Vertical</span>
        </Badge>

        <Button
          variant="outline"
          size="sm"
          disabled
          className="gap-1.5"
          title="Auto-fit visual scenes to voiceover duration — Phase 4"
        >
          <Wand2 className="size-3.5" />
          <span className="hidden md:inline">Fit to Voiceover</span>
        </Button>

        <Button
          size="sm"
          disabled
          className="gap-1.5"
          title="Export MP4 video — Available in Phase 5"
        >
          <Download className="size-3.5" />
          <span>Export MP4</span>
        </Button>

        <Separator orientation="vertical" className="h-5 hidden sm:block" />

        <ThemeToggle />
      </div>
    </header>
  );
}
