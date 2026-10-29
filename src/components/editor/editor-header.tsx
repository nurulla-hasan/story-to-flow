"use client";

import * as React from "react";
import Link from "next/link";
import {
  Film,
  RotateCcw,
  RotateCw,
  Wand2,
  Download,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  X,
  Monitor,
  Smartphone,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTimeline } from "@/lib/timeline-context";
import { isAudioTrack, isVisualTrack } from "@/types/timeline";
import { ExportDialog } from "@/components/editor/export-dialog";

export function EditorHeader() {
  const {
    isHydrated,
    tracks,
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

  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
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

  const hasAudio = isHydrated && clips.some((c) => isAudioTrack(c.trackId, tracks));
  const hasVisual = isHydrated && clips.some((c) => isVisualTrack(c.trackId, tracks));
  const canExport = isHydrated && clips.length > 0;

  const statusTone = saveError
    ? "bg-destructive"
    : !isHydrated
      ? "bg-muted-foreground"
      : isDirty
        ? "bg-warning"
        : "bg-success";

  const statusText = saveError
    ? "Save failed"
    : !isHydrated
      ? "Loading project…"
      : isDirty
        ? "Unsaved changes"
        : "Saved to browser";

  return (
    <>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        {/* Identity: navigation, project mark, editable title, live save status */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Link
            href="/studio"
            title="Return to Story Studio"
            aria-label="Return to Story Studio"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <span className="hidden size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs sm:flex">
            <Film className="size-4" />
          </span>

          <div className="min-w-0">
            <Input
              type="text"
              value={isHydrated ? projectTitle : "Untitled Story Video"}
              onChange={handleTitleChange}
              aria-label="Project Title"
            />
            <div className="flex items-center gap-1.5 px-1.5">
              <span className={`size-1.5 shrink-0 rounded-full ${statusTone}`} />
              <span className="truncate text-3xs text-muted-foreground">
                {statusText}
              </span>
            </div>
          </div>

          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-3xs font-medium text-muted-foreground md:flex">
            <Layers className="size-3" />
            {isHydrated && clips.length > 0
              ? `${clips.length} ${clips.length === 1 ? "clip" : "clips"}`
              : "Draft"}
          </span>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {saveError ? (
            <div
              role="status"
              className="flex items-center gap-1.5 rounded-lg border border-destructive/25 bg-destructive/10 px-2 py-1 text-3xs font-medium text-destructive"
            >
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="max-w-64 leading-tight">{saveError}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={dismissSaveError}
                aria-label="Dismiss save error"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : feedback ? (
            <div
              className={`flex animate-in items-center gap-1.5 rounded-lg border px-2 py-1 text-3xs font-medium fade-in duration-200 ${
                feedback.type === "success"
                  ? "border-success/25 bg-success-subtle text-foreground"
                  : "border-destructive/25 bg-destructive/10 text-destructive"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="size-3.5 shrink-0 text-success" />
              ) : (
                <AlertCircle className="size-3.5 shrink-0" />
              )}
              <span className="max-w-56 truncate">{feedback.message}</span>
            </div>
          ) : null}

          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={undo}
              disabled={!canUndo}
              title={canUndo ? "Undo (Ctrl+Z)" : "Nothing to undo"}
              aria-label="Undo"
            >
              <RotateCcw className="size-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={redo}
              disabled={!canRedo}
              title={canRedo ? "Redo (Ctrl+Y)" : "Nothing to redo"}
              aria-label="Redo"
            >
              <RotateCw className="size-3.5" />
            </Button>
          </div>

          <div
            role="group"
            aria-label="Canvas aspect ratio"
            className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
          >
            <Button
              variant={aspectRatio === "16:9" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setAspectRatio("16:9")}
              aria-pressed={aspectRatio === "16:9"}
              title="16:9 landscape canvas"
            >
              <Monitor className="size-3.5" />
              <span className="hidden sm:inline">16:9</span>
            </Button>

            <Button
              variant={aspectRatio === "9:16" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setAspectRatio("9:16")}
              aria-pressed={aspectRatio === "9:16"}
              title="9:16 vertical canvas"
            >
              <Smartphone className="size-3.5" />
              <span className="hidden sm:inline">9:16</span>
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleFit}
            disabled={!hasAudio || !hasVisual}
            title={
              !hasAudio
                ? "Add an audio clip to fit visual scenes"
                : !hasVisual
                  ? "Add visual scenes to fit"
                  : "Auto-fit visual scenes to match voiceover duration"
            }
          >
            <Wand2 className="size-3.5 text-primary" />
            <span className="hidden md:inline">Fit to voiceover</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setIsExportDialogOpen(true)}
            disabled={!canExport}
            title={!canExport ? "Add clips to timeline before exporting" : "Export MP4 video"}
          >
            <Download className="size-3.5" />
            <span>Export MP4</span>
          </Button>

          <ThemeToggle />
        </div>
      </header>

      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
      />
    </>
  );
}
