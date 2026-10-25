"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clapperboard,
  Loader2,
  Sparkles,
} from "lucide-react";
import { ToastNotification, type ToastState } from "@/components/toast-notification";
import { VideoEditor } from "@/components/studio/video-editor";
import { useStudioBatchImages } from "@/components/studio/use-studio-batch-images";
import { useStudioProject } from "@/components/studio/use-studio-project";

export default function StudioEditorPage() {
  const {
    project,
    isLoaded,
    saveStatus,
    setProject,
    updateProject,
    updateClip,
  } = useStudioProject();
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const notify = React.useCallback(
    (message: string, kind: "info" | "error" | "success" = "info") => {
      const id = Date.now();
      setToast({ id, message, kind });
      window.setTimeout(() => {
        setToast((curr) => (curr?.id === id ? null : curr));
      }, 4000);
    },
    [],
  );

  const { batchFileInputRef, handleBatchFileChange, openBatchFileDialog } =
    useStudioBatchImages({
      clips: project.clips,
      setProject,
      notify,
    });

  const totalDuration = React.useMemo(
    () =>
      project.clips.reduce(
        (acc, clip) => acc + (clip.duration || project.defaultClipDuration || 3),
        0,
      ),
    [project.clips, project.defaultClipDuration],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Compact editor chrome */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-3 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2 text-2xs font-semibold text-foreground shadow-xs transition-colors hover:bg-muted"
              title="Back to the story planner"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Planner</span>
            </Link>

            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clapperboard className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-foreground">
                  {project.title || "Video editor"}
                </p>
                <p className="truncate text-3xs text-muted-foreground">
                  {project.clips.length} clip{project.clips.length === 1 ? "" : "s"} ·{" "}
                  {Math.floor(totalDuration / 60)}:
                  {String(Math.floor(totalDuration % 60)).padStart(2, "0")} ·{" "}
                  {project.aspectRatio} · full-screen editor
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className="hidden items-center gap-1 text-3xs text-muted-foreground sm:inline-flex"
              title="Changes are saved to this browser and the local studio project"
            >
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Saving…
                </>
              ) : saveStatus === "error" ? (
                <>
                  <AlertTriangle className="size-3 text-warning" />
                  Not saved
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <Check className="size-3 text-success" />
                  Saved
                </>
              ) : null}
            </span>

            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-2xs font-semibold text-foreground shadow-xs transition-colors hover:bg-muted sm:inline-flex"
            >
              <Sparkles className="size-3.5 text-primary" />
              Story &amp; prompts
            </Link>
          </div>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3">
        {!isLoaded ? (
          <div className="flex min-h-96 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading your project…
          </div>
        ) : project.clips.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Clapperboard className="size-6" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">No clips to edit yet</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Open the Story Planner, generate a Shorts / Voiceover plan, then import
                your images here for the full-screen timeline and MP4 export.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <ArrowLeft className="size-3.5" />
              Open Story Planner
            </Link>
          </div>
        ) : (
          <VideoEditor
            project={project}
            onUpdateProject={updateProject}
            onUpdateClip={updateClip}
            notify={notify}
            onImportImagesClick={openBatchFileDialog}
          />
        )}
      </main>

      <input
        ref={batchFileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="sr-only"
        onChange={handleBatchFileChange}
      />

      <ToastNotification toast={toast} />
    </div>
  );
}
