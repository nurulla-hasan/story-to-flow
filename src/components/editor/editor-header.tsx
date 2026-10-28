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
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTimeline } from "@/lib/timeline-context";
import { isAudioTrack, isVisualTrack } from "@/types/timeline";
import { ExportDialog } from "@/components/editor/export-dialog";

export function EditorHeader() {
  const {
    isHydrated,
    projectTitle,
    setProjectTitle,
    canUndo,
    canRedo,
    saveError,
    isDirty,
    dismissSaveError,
    undo,
    redo,
    clips,
    aspectRatio,
    setAspectRatio,
    fitVisualsToVoiceover,
  } = useTimeline();

  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProjectTitle(e.target.value);
  };

  const handleFit = () => {
    const res = fitVisualsToVoiceover();
    setFeedback({
      type: res.success ? "success" : "error",
      message: res.message,
    });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const hasAudio = isHydrated && clips.some((c) => isAudioTrack(c.trackId));
  const hasVisual = isHydrated && clips.some((c) => isVisualTrack(c.trackId));
  const canExport = isHydrated && clips.length > 0;

  return (
    <>
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
              value={isHydrated ? projectTitle : "Untitled Story Video"}
              onChange={handleTitleChange}
              aria-label="Project Title"
              className="font-semibold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-hidden px-1 py-0.5 max-w-44 sm:max-w-64 truncate text-sm"
            />
          </div>

          <Badge variant="outline">
            {isHydrated && clips.length > 0 ? `${clips.length} ${clips.length === 1 ? "Clip" : "Clips"}` : "Draft"}
          </Badge>

          <Separator orientation="vertical" className="h-4 hidden md:block" />

          {/* Undo / Redo controls with shadcn Tooltips */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={undo}
                    disabled={!canUndo}
                    aria-label="Undo"
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>
                <span>{canUndo ? "Undo (Ctrl+Z)" : "Nothing to undo"}</span>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={redo}
                    disabled={!canRedo}
                    aria-label="Redo"
                  >
                    <RotateCw className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>
                <span>{canRedo ? "Redo (Ctrl+Y)" : "Nothing to redo"}</span>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Right: Aspect ratio, Smart Auto-fit, Export & Theme Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Persistence feedback: failed writes are persistent and dismissible */}
          {saveError ? (
            <div
              role="status"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-medium bg-destructive/10 text-destructive border border-destructive/20"
            >
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="max-w-72 leading-tight">{saveError}</span>
              <button
                type="button"
                onClick={dismissSaveError}
                className="text-destructive/70 hover:text-destructive cursor-pointer"
                aria-label="Dismiss save error"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : isDirty ? (
            <Badge variant="destructive" title="Changes are not saved to browser storage">
              Unsaved changes
            </Badge>
          ) : feedback ? (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-medium animate-in fade-in duration-200 ${
                feedback.type === "success"
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="size-3.5 shrink-0" />
              ) : (
                <AlertCircle className="size-3.5 shrink-0" />
              )}
              <span className="truncate max-w-56">{feedback.message}</span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setAspectRatio(aspectRatio === "16:9" ? "9:16" : "16:9")}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-secondary hover:bg-muted text-xs font-medium cursor-pointer transition-colors"
            title={`Click to switch canvas aspect ratio (currently ${aspectRatio})`}
          >
            <Smartphone className={`size-3 ${aspectRatio === "16:9" ? "rotate-90" : ""} transition-transform`} />
            <span>{aspectRatio === "16:9" ? "16:9 Landscape" : "9:16 Vertical"}</span>
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleFit}
            disabled={!hasAudio || !hasVisual}
            className="gap-1.5"
            title={
              !hasAudio
                ? "Add an audio clip to fit visual scenes"
                : !hasVisual
                ? "Add visual scenes to fit"
                : "Auto-fit visual scenes to match voiceover duration"
            }
          >
            <Wand2 className="size-3.5" />
            <span className="hidden md:inline">Fit to Voiceover</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsExportDialogOpen(true)}
            disabled={!canExport}
            className="gap-1.5"
            title={!canExport ? "Add clips to timeline before exporting" : "Export MP4 Video"}
          >
            <Download className="size-3.5" />
            <span>Export MP4</span>
          </Button>

          <Separator orientation="vertical" className="h-5 hidden sm:block" />

          <ThemeToggle />
        </div>
      </header>

      {/* Export MP4 Dialog Modal */}
      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
      />
    </>
  );
}
