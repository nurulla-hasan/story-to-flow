"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronsUpDown,
  Download,
  Layers,
  RefreshCw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeftPanel } from "@/components/left-panel";
import { CharactersPanel } from "@/components/characters-panel";
import { LocationsPanel } from "@/components/locations-panel";
import { RulesPanel } from "@/components/rules-panel";
import { SceneCard } from "@/components/scene-card";
import { SettingsDialog } from "@/components/settings-dialog";
import { ReviewModal } from "@/components/review-modal";
import { ChatDialog } from "@/components/chat-panel";
import { ExportDialog } from "@/components/export-dialog";
import { api, ApiError } from "@/lib/apiClient";
import type { JobRecord, ProjectData, SceneStatus } from "@/lib/types";

export default function WorkspacePage() {
  const [data, setData] = React.useState<ProjectData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [openSceneN, setOpenSceneN] = React.useState<number | null>(1);
  const [filter, setFilter] = React.useState<SceneStatus | "all">("all");
  const [reviewSceneN, setReviewSceneN] = React.useState<number | null>(null);

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);

  const [toast, setToast] = React.useState<{
    id: number;
    message: string;
    kind: "info" | "error" | "success";
  } | null>(null);

  const [activeJob, setActiveJob] = React.useState<JobRecord | null>(null);

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
          }
        }
      } catch {
        // ignore poll errors
      }
    }, 1500);
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

  const doneCount = data.scenes.filter((s) => s.status === "done").length;
  const filteredScenes = data.scenes.filter((s) =>
    filter === "all" ? true : s.status === filter,
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xs">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-xs tracking-wider text-primary-foreground shadow-xs">
              STF
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-tight">
                {data.project.name || "Story to Flow"}
              </h1>
              <p className="text-xs text-muted-foreground">
                AI video production plan · Google Flow consistency
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold tabular-nums text-foreground sm:inline-flex">
              <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
              {doneCount} of {data.scenes.length} clips done
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setChatOpen(true)}
              className="h-9 gap-1.5 text-xs"
            >
              <Bot className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Chat edit</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="h-9 gap-1.5 text-xs"
            >
              <Settings2 className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Settings</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setExportOpen(true)}
              className="h-9 gap-1.5 text-xs"
            >
              <Download className="size-3.5" aria-hidden />
              Export
            </Button>
          </div>
        </div>
      </header>

      {/* Planning Job Progress Banner */}
      {activeJob && activeJob.status === "running" ? (
        <div className="border-b border-brand-border bg-brand-subtle px-4 py-2.5 text-xs text-secondary-foreground">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="size-3.5 animate-spin text-primary" />
              <span className="font-semibold">{activeJob.message || "Planning scenes…"}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${activeJob.progress}%` }}
                />
              </div>
              <span className="font-mono font-medium tabular-nums">{activeJob.progress}%</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main 3-column Workspace */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row">
        {/* Left Column: Story & Settings Overview (320px) */}
        <aside className="w-full shrink-0 lg:w-80">
          <LeftPanel
            data={data}
            onChanged={refreshData}
            notify={notify}
            onOpenSettings={() => setSettingsOpen(true)}
            onPlanStarted={(job) => setActiveJob(job)}
          />
        </aside>

        {/* Center Column: Scenes (N) list */}
        <section className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight">
                Scenes ({data.scenes.length})
              </h2>
              {data.scenes.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  ~{data.scenes.length * data.project.settings.clipSeconds}s total runtime
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-0.5 text-xs font-medium">
                {(["all", "ready", "needs_attention", "done"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFilter(status)}
                    className={`rounded-md px-2 py-1 transition-colors ${
                      filter === status
                        ? "bg-card font-semibold text-foreground shadow-xs ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {status === "all"
                      ? "All"
                      : status === "ready"
                        ? "Ready"
                        : status === "needs_attention"
                          ? "Attention"
                          : "Done"}
                  </button>
                ))}
              </div>

              {/* Expand / Collapse All */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setOpenSceneN(openSceneN !== null ? null : (data.scenes[0]?.n ?? 1))}
              >
                <ChevronsUpDown className="size-3.5" aria-hidden />
                {openSceneN !== null ? "Collapse" : "Expand"}
              </Button>
            </div>
          </div>

          {data.scenes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                <Layers className="size-6" />
              </span>
              <h3 className="mt-3 text-sm font-semibold">No scenes planned yet</h3>
              <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                Paste your story in the left panel, click &quot;Create story bible&quot;, then
                &quot;Re-plan scenes&quot; to generate your 8–10 second production clips.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredScenes.map((scene) => (
                <SceneCard
                  key={scene.n}
                  data={data}
                  scene={scene}
                  open={openSceneN === scene.n}
                  onToggle={() =>
                    setOpenSceneN(openSceneN === scene.n ? null : scene.n)
                  }
                  onChanged={refreshData}
                  onOpenReview={(n) => setReviewSceneN(n)}
                  notify={notify}
                />
              ))}
            </div>
          )}
        </section>

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

      {/* Toast Notification */}
      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-border bg-foreground px-4 py-3 text-xs font-medium text-background shadow-2xl animate-in fade-in slide-in-from-bottom-3">
          {toast.kind === "success" ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : toast.kind === "error" ? (
            <AlertTriangle className="size-4 text-destructive" />
          ) : (
            <Sparkles className="size-4 text-primary" />
          )}
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}
