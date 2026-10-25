"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeftPanel } from "@/components/left-panel";
import { CharactersPanel } from "@/components/characters-panel";
import { LocationsPanel } from "@/components/locations-panel";
import { RulesPanel } from "@/components/rules-panel";
import { WorkspaceHeader } from "@/components/workspace-header";
import { JobProgressBanner } from "@/components/job-progress-banner";
import { ScenesSection } from "@/components/scenes-section";
import { ShortsPlanPanel } from "@/components/shorts-plan-panel";
import { useStudioProject } from "@/components/studio/use-studio-project";
import type { StudioProject } from "@/components/studio/types";
import { ToastNotification, type ToastState } from "@/components/toast-notification";
import { SettingsDialog } from "@/components/settings-dialog";
import { ReviewModal } from "@/components/review-modal";
import { ChatDialog } from "@/components/chat-panel";
import { ExportDialog } from "@/components/export-dialog";
import { FlowExtensionDialog } from "@/components/flow-extension-dialog";
import { api, ApiError } from "@/lib/apiClient";
import type { JobRecord, ProjectData } from "@/lib/types";

export default function WorkspacePage() {
  const [data, setData] = React.useState<ProjectData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [openSceneN, setOpenSceneN] = React.useState<number | null>(1);
  const [reviewSceneN, setReviewSceneN] = React.useState<number | null>(null);

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [extensionOpen, setExtensionOpen] = React.useState(false);

  const [toast, setToast] = React.useState<ToastState | null>(null);
  const [activeJob, setActiveJob] = React.useState<JobRecord | null>(null);
  const [cancellingJob, setCancellingJob] = React.useState(false);
  const [isShortsPlanning, setIsShortsPlanning] = React.useState(false);

  const studio = useStudioProject();

  const notify = React.useCallback(
    (message: string, kind: "info" | "error" | "success" = "info") => {
      const id = Date.now();
      setToast({ id, message, kind });
      window.setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, 4000);
    },
    [],
  );

  const refreshData = React.useCallback(async () => {
    try {
      const res = await api<ProjectData>("/api/project");
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCancelJob = React.useCallback(async () => {
    if (!activeJob) return;
    setCancellingJob(true);
    try {
      const res = await api<{ job: JobRecord }>(`/api/jobs/${activeJob.id}/cancel`, {
        method: "POST",
      });
      setActiveJob(res.job);
      await refreshData();
      notify("Planning stopped by user.", "info");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : String(err), "error");
    } finally {
      setCancellingJob(false);
    }
  }, [activeJob, refreshData, notify]);

  React.useEffect(() => {
    let ignore = false;
    api<ProjectData>("/api/project")
      .then((res) => {
        if (!ignore) {
          setData(res);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof ApiError ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Polling active jobs (such as scene planning).
  React.useEffect(() => {
    if (!activeJob || activeJob.status !== "running") return;
    const interval = window.setInterval(async () => {
      try {
        const res = await api<{ job: JobRecord }>(`/api/jobs/${activeJob.id}`);
        setActiveJob(res.job);
        if (res.job.status !== "running") {
          await refreshData();
          if (res.job.status === "done") {
            notify(res.job.message || "Planning complete!", "success");
          } else if (res.job.status === "error") {
            notify(res.job.error || "Planning job failed.", "error");
          } else if (res.job.status === "cancelled") {
            notify(res.job.message || "Planning was stopped.", "info");
          }
        }
      } catch {
        // ignore poll errors
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [activeJob, refreshData, notify]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-r-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-lg">
          <AlertTriangle className="mx-auto size-8 text-destructive" />
          <h2 className="mt-3 text-base font-semibold">Failed to load project</h2>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <Button className="mt-4" onClick={() => { setLoading(true); void refreshData(); }}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const projectData = data;
  const doneCount = projectData.scenes.filter((s) => s.status === "done").length;
  const isShortsMode = projectData.project.settings.workflowMode === "shorts-animatic";

  async function handlePlanShorts(story: string) {
    if (!story.trim()) {
      notify("Paste a story in the Story panel first.", "error");
      return;
    }

    setIsShortsPlanning(true);
    try {
      if (story !== projectData.project.story) {
        await api("/api/project", {
          method: "PATCH",
          body: JSON.stringify({ story }),
        });
      }

      if (projectData.characters.length === 0) {
        notify(
          "No locked characters yet. Create the Story Bible for consistent character prompts.",
          "info",
        );
      }

      const res = await api<{ success: boolean; project: StudioProject }>(
        "/api/studio/plan",
        {
          method: "POST",
          body: JSON.stringify({
            story,
            workflowMode: "shorts-animatic",
            pacing: projectData.project.settings.shortsPacing,
            stylePreset: projectData.project.settings.stylePreset,
            styleLock: projectData.project.styleLock,
            aspectRatio: projectData.project.settings.aspectRatio,
            cast: projectData.characters
              .filter((character) => character.visual_lock?.trim().length >= 10)
              .map((character) => ({
                id: character.id,
                name: character.name,
                visualLock: character.visual_lock,
                voiceLock: character.voice_lock,
                refImageUrl: character.refImage,
              })),
            locations: projectData.locations
              .filter((location) => location.visual_lock?.trim().length >= 10)
              .map((location) => ({
                id: location.id,
                name: location.name,
                visualLock: location.visual_lock,
              })),
            rules: projectData.rules.map((rule) => rule.text),
          }),
        },
      );

      if (!res.project) {
        throw new Error("The planner did not return a studio project.");
      }

      studio.setProject(res.project);
      notify(
        `Shorts plan ready: ${res.project.clips.length} shots + continuous voiceover.`,
        "success",
      );
      await refreshData();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : String(err), "error");
    } finally {
      setIsShortsPlanning(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <WorkspaceHeader
        projectName={data.project.name}
        doneCount={doneCount}
        totalScenes={data.scenes.length}
        workflowMode={data.project.settings.workflowMode}
        shortsShotCount={studio.project.clips.length}
        onOpenChat={() => setChatOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onOpenExtension={() => setExtensionOpen(true)}
      />

      {/* Planning Job Progress Banner */}
      <JobProgressBanner
        job={activeJob}
        onCancel={handleCancelJob}
        cancelling={cancellingJob}
      />

      {/* Main 3-column Workspace */}
      <main className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row">
        {/* Left Column: Story & Settings Overview (320px) */}
        <aside className="w-full shrink-0 lg:w-80">
          <LeftPanel
            data={data}
            onChanged={refreshData}
            notify={notify}
            onOpenSettings={() => setSettingsOpen(true)}
            onPlanStarted={(job) => setActiveJob(job)}
            onPlanShorts={handlePlanShorts}
            isShortsPlanning={isShortsPlanning}
            onStoryReset={studio.clearProject}
            shortsShotCount={studio.project.clips.length}
          />
        </aside>

        {/* Center Column: Scenes (video-clips mode) or Shorts animatic plan */}
        {isShortsMode ? (
          <ShortsPlanPanel
            project={studio.project}
            isPlanning={isShortsPlanning}
            onPlan={() => void handlePlanShorts(data.project.story)}
            onUpdateClip={studio.updateClip}
            notify={notify}
          />
        ) : (
          <ScenesSection
            data={data}
            openSceneN={openSceneN}
            onToggleScene={(n) => setOpenSceneN(openSceneN === n ? null : n)}
            onExpandCollapseAll={() =>
              setOpenSceneN(openSceneN !== null ? null : (data.scenes[0]?.n ?? 1))
            }
            onChanged={refreshData}
            onOpenReview={(n) => setReviewSceneN(n)}
            notify={notify}
            onPlanStarted={(job) => setActiveJob(job)}
          />
        )}

        {/* Right Column: Characters, Locations, Rules (320px) */}
        <aside className="w-full shrink-0 space-y-4 lg:w-80">
          <CharactersPanel data={data} onChanged={refreshData} notify={notify} />
          <LocationsPanel data={data} onChanged={refreshData} notify={notify} />
          <RulesPanel data={data} onChanged={refreshData} notify={notify} />
        </aside>
      </main>

      {/* Modals & Dialogs */}
      <SettingsDialog
        data={data}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={async () => {
          await refreshData();
          notify("Settings saved. Prompts re-assembled.", "success");
        }}
        onError={(msg) => notify(msg, "error")}
      />

      <ReviewModal
        data={data}
        sceneN={reviewSceneN}
        open={reviewSceneN !== null}
        onClose={() => setReviewSceneN(null)}
        onChanged={refreshData}
        notify={notify}
      />

      <ChatDialog
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onChanged={refreshData}
        notify={notify}
      />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />

      <FlowExtensionDialog
        open={extensionOpen}
        onClose={() => setExtensionOpen(false)}
      />

      {/* Toast Notification */}
      <ToastNotification toast={toast} />
    </div>
  );
}
