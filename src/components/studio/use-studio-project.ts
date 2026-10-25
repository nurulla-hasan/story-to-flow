"use client";

import * as React from "react";
import { api } from "@/lib/apiClient";
import type { StudioClip, StudioProject } from "./types";

export const STUDIO_PROJECT_STORAGE_KEY = "story_to_flow_studio_project";

export const EMPTY_STUDIO_PROJECT: StudioProject = {
  id: "studio-default",
  title: "Story to Video",
  story: "",
  workflowMode: "video-clips",
  cast: [],
  locations: [],
  stylePreset: "3D Pixar Animation",
  aspectRatio: "9:16",
  defaultClipDuration: 3.0,
  continuousVoiceover: "",
  audioUrl: null,
  audioDuration: 0,
  clips: [],
};

export type StudioSaveStatus = "idle" | "saving" | "saved" | "error";

function normalizeStudioProject(value: StudioProject): StudioProject {
  return {
    ...EMPTY_STUDIO_PROJECT,
    ...value,
    cast: Array.isArray(value.cast) ? value.cast : [],
    locations: Array.isArray(value.locations) ? value.locations : [],
    clips: Array.isArray(value.clips)
      ? value.clips.map((clip, idx) => ({
          ...clip,
          index: clip.index ?? idx + 1,
          duration: Number(clip.duration) || 3,
        }))
      : [],
  };
}

function hasProjectContent(project: StudioProject | null): project is StudioProject {
  return Boolean(project && (project.story?.trim() || project.clips?.length));
}

/**
 * Shared StudioProject state used by both the root planner and the video
 * editor. localStorage is the fast path; the server copy is the handoff
 * between screens and survives a cleared browser cache.
 */
export function useStudioProject() {
  const [project, setProjectState] = React.useState<StudioProject>(EMPTY_STUDIO_PROJECT);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<StudioSaveStatus>("idle");

  const isInitialMount = React.useRef(true);
  const projectRef = React.useRef(project);
  const hasLocalChange = React.useRef(false);

  React.useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Load once: localStorage first (instant), then the saved server copy.
  React.useEffect(() => {
    let canceled = false;
    let hasCached = false;

    try {
      const cached = localStorage.getItem(STUDIO_PROJECT_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as StudioProject;
        if (hasProjectContent(parsed)) {
          hasCached = true;
          queueMicrotask(() => {
            if (canceled || hasLocalChange.current) return;
            setProjectState(normalizeStudioProject(parsed));
            setIsLoaded(true);
            isInitialMount.current = false;
          });
        }
      }
    } catch {
      // ignore localStorage parse errors
    }

    (async () => {
      if (hasCached) return;
      try {
        const res = await api<{ success: boolean; project: StudioProject | null }>(
          "/api/studio/project",
        );
        if (canceled || hasLocalChange.current) return;
        if (hasProjectContent(res.project)) {
          const next = normalizeStudioProject(res.project);
          setProjectState(next);
          try {
            localStorage.setItem(STUDIO_PROJECT_STORAGE_KEY, JSON.stringify(next));
          } catch {}
        }
      } catch (err) {
        console.warn("[studio-project] Could not fetch saved project:", err);
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

  // Persist locally right away and to the server after a short pause.
  React.useEffect(() => {
    if (isInitialMount.current) return;

    try {
      localStorage.setItem(STUDIO_PROJECT_STORAGE_KEY, JSON.stringify(project));
    } catch {}

    const timer = window.setTimeout(() => {
      api("/api/studio/project", {
        method: "POST",
        body: JSON.stringify(project),
      })
        .then(() => setSaveStatus("saved"))
        .catch((err) => {
          console.warn("[studio-project] Auto-save failed:", err);
          setSaveStatus("error");
        });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [project]);

  // Flush the latest project when leaving the page or switching screens.
  React.useEffect(() => {
    const flush = () => {
      if (isInitialMount.current) return;
      const latest = projectRef.current;
      try {
        localStorage.setItem(STUDIO_PROJECT_STORAGE_KEY, JSON.stringify(latest));
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

  const setProject = React.useCallback(
    (next: StudioProject | ((prev: StudioProject) => StudioProject)) => {
      hasLocalChange.current = true;
      isInitialMount.current = false;
      setIsLoaded(true);
      setSaveStatus("saving");
      setProjectState(next);
    },
    [],
  );

  const updateProject = React.useCallback((patch: Partial<StudioProject>) => {
    hasLocalChange.current = true;
    setSaveStatus("saving");
    setProjectState((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateClip = React.useCallback(
    (clipId: string, patch: Partial<StudioClip>) => {
      hasLocalChange.current = true;
      setSaveStatus("saving");
      setProjectState((prev) => ({
        ...prev,
        clips: prev.clips.map((clip) =>
          clip.id === clipId ? { ...clip, ...patch } : clip,
        ),
      }));
    },
    [],
  );

  const clearProject = React.useCallback(() => {
    hasLocalChange.current = true;
    isInitialMount.current = false;
    setProjectState(EMPTY_STUDIO_PROJECT);
    setSaveStatus("idle");
    try {
      localStorage.removeItem(STUDIO_PROJECT_STORAGE_KEY);
    } catch {}
    void api("/api/studio/project", { method: "DELETE" }).catch(() => {
      // best effort; the debounced save will overwrite it anyway
    });
  }, []);

  return {
    project,
    isLoaded,
    saveStatus,
    setProject,
    updateProject,
    updateClip,
    clearProject,
  };
}
