"use client";

import * as React from "react";
import {
  BookOpen,
  FilePlus,
  ListOrdered,
  Loader2,
  Play,
  Save,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api, ApiError } from "@/lib/apiClient";
import type { JobRecord, ProjectData } from "@/lib/types";
import { sceneCount } from "@/lib/types";

export function LeftPanel({
  data,
  onChanged,
  notify,
  // onOpenSettings,
  onPlanStarted,
}: {
  data: ProjectData;
  onChanged: () => Promise<void>;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
  onOpenSettings: () => void;
  onPlanStarted: (job: JobRecord) => void;
}) {
  const [story, setStory] = React.useState(data.project.story);
  const [prevStory, setPrevStory] = React.useState(data.project.story);
  const [busy, setBusy] = React.useState<"save" | "bible" | "plan" | "full" | "reset" | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = React.useState(false);

  if (data.project.story !== prevStory) {
    setPrevStory(data.project.story);
    setStory(data.project.story);
  }

  const settings = data.project.settings;
  const dirty = story !== data.project.story;
  const hasBible = data.characters.length > 0;
  const hasScenes = data.scenes.length > 0;

  async function saveStory() {
    setBusy("save");
    try {
      await api("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ story }),
      });
      await onChanged();
      notify("Story saved.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  function handleNewStoryClick() {
    if (data.project.story.trim() || hasBible || hasScenes) {
      setConfirmResetOpen(true);
      return;
    }
    void doReset();
  }

  async function doReset() {
    setBusy("reset");
    try {
      await api("/api/project", { method: "DELETE" });
      setStory("");
      await onChanged();
      notify("Started fresh new story.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  async function generateFullPlan() {
    if (!story.trim()) {
      notify("Please paste a story first.", "error");
      return;
    }
    setBusy("full");
    try {
      if (dirty) {
        await api("/api/project", {
          method: "PATCH",
          body: JSON.stringify({ story }),
        });
      }
      const planRes = await api<{ job: JobRecord }>("/api/plan", {
        method: "POST",
        body: JSON.stringify({ full: true }),
      });
      onPlanStarted(planRes.job);
      notify("Production plan started. Tracking progress above.", "info");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  async function createBible() {
    if (!story.trim()) {
      notify("Please paste a story first.", "error");
      return;
    }
    setBusy("bible");
    try {
      if (dirty) {
        await api("/api/project", {
          method: "PATCH",
          body: JSON.stringify({ story }),
        });
      }
      const res = await api<{ job: JobRecord }>("/api/bible", {
        method: "POST",
        body: JSON.stringify({ preserveScenes: true, async: true }),
      });
      onPlanStarted(res.job);
      notify("Locking characters & locations. Tracking progress above.", "info");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  async function planScenes() {
    if (!story.trim()) {
      notify("Please paste a story first.", "error");
      return;
    }
    if (!hasBible) {
      notify("Create the story bible first so characters and locations are locked.", "error");
      return;
    }
    setBusy("plan");
    try {
      if (dirty) {
        await api("/api/project", {
          method: "PATCH",
          body: JSON.stringify({ story }),
        });
      }
      const result = await api<{ job: JobRecord }>("/api/plan", {
        method: "POST",
      });
      onPlanStarted(result.job);
      notify("Scene planning started. You can watch the progress here.", "info");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <BookOpen className="size-4" aria-hidden />
            </span>
            <CardTitle>Story</CardTitle>
          </div>
          <button
            type="button"
            onClick={handleNewStoryClick}
            disabled={Boolean(busy)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Clear and start a fresh story"
          >
            <FilePlus className="size-3.5" aria-hidden />
            New story
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          <label htmlFor="story" className="sr-only">
            Story text
          </label>
          <Textarea
            id="story"
            value={story}
            onChange={(event) => setStory(event.target.value)}
            placeholder="Paste your story here (Bangla or English)..."
            rows={8}
            className="min-h-36 max-h-72 overflow-y-auto text-xs leading-6"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {story.trim() ? `${story.trim().length.toLocaleString()} characters` : "Empty"}
            </span>
            <button
              type="button"
              onClick={saveStory}
              disabled={!dirty || Boolean(busy)}
              className="inline-flex h-8 items-center gap-1 rounded px-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
            >
              {busy === "save" ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Save className="size-3" aria-hidden />
              )}
              {dirty ? "Save story" : "Saved"}
            </button>
          </div>

          <div className="grid gap-2">
            {/* Primary 1-Click Action */}
            <Button
              type="button"
              onClick={generateFullPlan}
              disabled={!story.trim() || Boolean(busy)}
              className="gap-2"
            >
              {busy === "full" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Play className="size-4 fill-current" aria-hidden />
              )}
              {hasScenes ? "Generate Full Plan (New Story)" : "Generate Full Plan (1-Click)"}
            </Button>

            {/* Individual Steps (if user wants granular control) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={createBible}
                disabled={!story.trim() || Boolean(busy)}
                className="text-xs"
              >
                {busy === "bible" ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
                {hasBible ? "Update Bible" : "Create Bible"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={planScenes}
                disabled={!hasBible || Boolean(busy)}
                className="text-xs"
              >
                {busy === "plan" ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Wand2 className="size-3.5" aria-hidden />
                )}
                {hasScenes ? "Re-plan Scenes" : "Plan Scenes"}
              </Button>
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            &quot;Generate Full Plan&quot; detects characters, locks visual/voice attributes, and plans all scenes automatically.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Settings2 className="size-4" aria-hidden />
            </span>
            <CardTitle>Project settings</CardTitle>
          </div>
          {/* <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-primary underline-offset-4 hover:bg-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings2 className="size-3.5" aria-hidden />
            Edit
          </button> */}
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border text-xs">
            <Row label="Language" value={settings.dialogueLanguage === "bn" ? "Bangla" : "English"} />
            <Row
              label="Format"
              value={`${settings.sceneCountMode === "auto" ? "Auto clips" : `${sceneCount(settings)} clips`} · ${settings.clipSeconds}s · ${settings.aspectRatio}`}
            />
            <Row label="Style" value={settings.stylePreset} />
            <Row label="Dialogue" value={settings.dialogueEnabled ? "Enabled" : "Disabled"} />
          </dl>
          <div className="mt-3 rounded-lg border border-border bg-surface-subtle p-2.5 text-xs leading-5 text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <ListOrdered className="size-3.5" aria-hidden />
              {data.characters.length} characters · {data.locations.length} locations
            </span>
            <br />
            {data.scenes.length} scenes planned · {data.rules.length} custom rules
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Start a new story?"
        description="This will clear the current story, locked characters, locations, and planned scenes. Are you sure you want to proceed?"
        confirmLabel="Clear and start new"
        cancelLabel="Keep current story"
        variant="destructive"
        onConfirm={doReset}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
