"use client";

import * as React from "react";
import { ChevronsUpDown, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneCard } from "@/components/scene-card";
import { api, ApiError } from "@/lib/apiClient";
import type { JobRecord, ProjectData, SceneStatus } from "@/lib/types";

interface ScenesSectionProps {
  data: ProjectData;
  openSceneN: number | null;
  onToggleScene: (n: number) => void;
  onExpandCollapseAll: () => void;
  onChanged: () => Promise<void>;
  onOpenReview: (n: number) => void;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
  onPlanStarted: (job: JobRecord) => void;
}

export function ScenesSection({
  data,
  openSceneN,
  onToggleScene,
  onExpandCollapseAll,
  onChanged,
  onOpenReview,
  notify,
  onPlanStarted,
}: ScenesSectionProps) {
  const [filter, setFilter] = React.useState<SceneStatus | "all">("all");

  const filteredScenes = data.scenes.filter((s) =>
    filter === "all" ? true : s.status === filter,
  );

  async function handlePlanScenes() {
    try {
      const res = await api<{ job: JobRecord }>("/api/plan", { method: "POST" });
      onPlanStarted(res.job);
      notify("Scene planning started. You can watch the progress here.", "info");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : String(err), "error");
    }
  }

  return (
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
          {/* Status Filter */}
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
            onClick={onExpandCollapseAll}
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
          <h3 className="mt-3 text-sm font-semibold">
            {data.characters.length > 0 ? "Story bible ready" : "No scenes planned yet"}
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            {data.characters.length > 0
              ? `${data.characters.length} characters and ${data.locations.length} locations are locked. Click below to plan scenes for this story!`
              : "Paste your story in the left panel, click \"Create story bible\", then \"Re-plan scenes\" to generate your 8–10 second production clips."}
          </p>
          {data.characters.length > 0 ? (
            <Button
              type="button"
              className="mt-4 gap-1.5 text-xs"
              onClick={handlePlanScenes}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Plan scenes for this story
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredScenes.map((scene) => (
            <SceneCard
              key={scene.n}
              data={data}
              scene={scene}
              open={openSceneN === scene.n}
              onToggle={() => onToggleScene(scene.n)}
              onChanged={onChanged}
              onOpenReview={onOpenReview}
              notify={notify}
            />
          ))}
        </div>
      )}
    </section>
  );
}
