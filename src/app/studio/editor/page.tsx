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
import { api } from "@/lib/apiClient";
import type { StudioClip, StudioProject } from "@/components/studio/types";

const STORAGE_KEY = "story_to_flow_studio_project";

const EMPTY_PROJECT: StudioProject = {
  id: "studio-default",
  title: "Story to Video",
  story: "",
  stylePreset: "3D Pixar Animation",
  aspectRatio: "9:16",
  defaultClipDuration: 3.0,
  continuousVoiceover: "",
  audioUrl: null,
  audioDuration: 0,
  clips: [],
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function StudioEditorPage() {
  const [project, setProject] = React.useState<StudioProject>(EMPTY_PROJECT);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const isInitialMount = React.useRef(true);
  const projectRef = React.useRef(project);

  React.useEffect(() => {
    projectRef.current = project;
  }, [project]);

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

  // Load the project once: localStorage first (instant), then the saved server copy.
  React.useEffect(() => {
    let hasCached = false;

    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as StudioProject;
        if (
          parsed &&
          typeof parsed === "object" &&
          (parsed.story || parsed.clips?.length)
        ) {
          hasCached = true;
          queueMicrotask(() => {
            setProject(parsed);
            setIsLoaded(true);
            isInitialMount.current = false;
          });
        }
      }
    } catch {
      // ignore localstorage parse errors
    }

    let canceled = false;
    (async () => {
      if (hasCached) return;
      try {
        const res = await api<{ success: boolean; project: StudioProject | null }>(
          "/api/studio/project",
        );
        if (canceled) return;
        if (res.project && (res.project.story || res.project.clips?.length)) {
          setProject(res.project);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(res.project));
          } catch {}
        }
      } catch (err) {
        console.warn("[studio-editor] Could not fetch saved project:", err);
      } finally {
        if (!canceled) {
          isInitialMount.current = false;
          setIsLoaded(true);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  // Persist changes locally right away and to the server after a short pause.
  React.useEffect(() => {
    if (isInitialMount.current) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {}

    const timer = window.setTimeout(() => {
      api("/api/studio/project", {
        method: "POST",
        body: JSON.stringify(project),
      })
        .then(() => setSaveStatus("saved"))
        .catch((err) => {
          console.warn("[studio-editor] Auto-save failed:", err);
          setSaveStatus("error");
        });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [project]);

  // Flush the latest project when leaving the page (the debounce may still be pending).
  React.useEffect(() => {
    const flush = () => {
      if (isInitialMount.current) return;
      const latest = projectRef.current;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
      } catch {}
      try {
        navigator.sendBeacon(
          "/api/studio/project",
          new Blob([JSON.stringify(latest)], { type: "application/json" }),
        );
      } catch {
        // best effort only
      }
    };

    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const handleUpdateProject = React.useCallback((patch: Partial<StudioProject>) => {
    setSaveStatus("saving");
    setProject((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleUpdateClip = React.useCallback(
    (clipId: string, patch: Partial<StudioClip>) => {
      setSaveStatus("saving");
      setProject((prev) => ({
        ...prev,
        clips: prev.clips.map((clip) =>
          clip.id === clipId ? { ...clip, ...patch } : clip,
        ),
      }));
    },
    [],
  );

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
              href="/studio"
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2 text-2xs font-semibold text-foreground shadow-xs transition-colors hover:bg-muted"
              title="Back to the story planner"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Studio</span>
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
              href="/studio"
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
                Paste a story in the Studio, generate the sequential prompts and import
                your images — then come back here for the full-screen timeline.
              </p>
            </div>
            <Link
              href="/studio"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <ArrowLeft className="size-3.5" />
              Go to Studio
            </Link>
          </div>
        ) : (
          <VideoEditor
            project={project}
            onUpdateProject={handleUpdateProject}
            onUpdateClip={handleUpdateClip}
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
