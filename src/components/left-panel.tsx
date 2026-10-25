"use client";

import * as React from "react";
import {
  BookOpen,
  FilePlus,
  Film,
  ListOrdered,
  Loader2,
  Mic,
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
import { cn } from "cn";
import type { JobRecord, ProjectData, Settings } from "@/lib/types";
import { sceneCount } from "@/lib/types";

const SHORTS_PACING_OPTIONS = ["auto", "2.5", "3", "4", "5"] as const;

export function LeftPanel({
  data,
  onChanged,
  notify,
  // onOpenSettings,
  onPlanStarted,
  onPlanShorts,
  isShortsPlanning,
  onStoryReset,
  shortsShotCount,
}: {
  data: ProjectData;
  onChanged: () => Promise<void>;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
  onOpenSettings: () => void;
  onPlanStarted: (job: JobRecord) => void;
  onPlanShorts: (story: string) => void;
  isShortsPlanning: boolean;
  onStoryReset?: () => void;
  shortsShotCount?: number;
}) {
  const [story, setStory] = React.useState(data.project.story);
  const [prevStory, setPrevStory] = React.useState(data.project.story);
  const [busy, setBusy] = React.useState<"save" | "bible" | "plan" | "full" | "reset" | null>(null);
  const [settingsBusy, setSettingsBusy] = React.useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = React.useState(false);

  if (data.project.story !== prevStory) {
    setPrevStory(data.project.story);
    setStory(data.project.story);
  }

  const settings = data.project.settings;
  const isShortsMode = settings.workflowMode === "shorts-animatic";
  const pacing = settings.shortsPacing;
  const dirty = story !== data.project.story;
  const hasBible = data.characters.length > 0;
  const hasScenes = data.scenes.length > 0;

  async function updateSettings(patch: Partial<Settings>) {
    if (settingsBusy) return;
    setSettingsBusy(true);
    try {
      await api("/api/project", {
        method: "PATCH",
        // Send the full settings object: the PATCH schema applies defaults to
        // omitted keys, which would otherwise reset unrelated fields.
        body: JSON.stringify({ settings: { ...settings, ...patch } }),
      });
      await onChanged();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setSettingsBusy(false);
    }
  }

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
      onStoryReset?.();
      await onChanged();
      notify("Started fresh new story.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  function planShorts() {
    if (!story.trim()) {
      notify("Please paste a story first.", "error");
      return;
    }
    onPlanShorts(story);
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
            {isShortsMode ? (
              <>
                <Button
                  type="button"
                  onClick={planShorts}
                  disabled={
                    !story.trim() ||
                    isShortsPlanning ||
                    Boolean(busy) ||
                    settingsBusy
                  }
                  className="gap-2"
                >
                  {isShortsPlanning ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Mic className="size-4" aria-hidden />
                  )}
                  {isShortsPlanning
                    ? "Writing Shorts Plan…"
                    : "Generate Shorts Plan & Voiceover"}
                </Button>

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
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {isShortsMode
              ? "Writes a continuous clean-Bangla voiceover and sequential 2.5–5s image prompts using the locked Characters, Locations and Custom Rules."
              : '"Generate Full Plan" detects characters, locks visual/voice attributes, and plans all scenes automatically.'}
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
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Workflow mode
              </p>
              {settingsBusy ? (
                <Loader2 className="size-3 animate-spin text-muted-foreground" aria-hidden />
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => void updateSettings({ workflowMode: "video-clips" })}
                disabled={settingsBusy || Boolean(busy) || isShortsPlanning}
                aria-pressed={!isShortsMode}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                  !isShortsMode
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <Film className="size-3.5" aria-hidden />
                  Video Clips
                </span>
                <span className="text-3xs">10s Flow</span>
              </button>

              <button
                type="button"
                onClick={() => void updateSettings({ workflowMode: "shorts-animatic" })}
                disabled={settingsBusy || Boolean(busy) || isShortsPlanning}
                aria-pressed={isShortsMode}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                  isShortsMode
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <Mic className="size-3.5" aria-hidden />
                  Shorts / Voiceover
                </span>
                <span className="text-3xs">Images + Voiceover</span>
              </button>
            </div>
          </div>

          {isShortsMode ? (
            <div className="mb-3">
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Shot pacing
              </p>
              <div className="flex flex-wrap gap-1">
                {SHORTS_PACING_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => void updateSettings({ shortsPacing: value })}
                    disabled={settingsBusy || Boolean(busy) || isShortsPlanning}
                    aria-pressed={pacing === value}
                    className={cn(
                      "h-7 rounded-md border px-2 text-2xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                      pacing === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {value === "auto" ? "Auto" : `${value}s`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <dl className="divide-y divide-border text-xs">
            <Row label="Language" value={settings.dialogueLanguage === "bn" ? "Bangla" : "English"} />
            <Row
              label="Format"
              value={
                isShortsMode
                  ? `Shorts · ${pacing === "auto" ? "Auto pacing" : `${pacing}s / image`} · ${settings.aspectRatio}`
                  : `${settings.sceneCountMode === "auto" ? "Auto clips" : `${sceneCount(settings)} clips`} · ${settings.clipSeconds}s · ${settings.aspectRatio}`
              }
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
            {isShortsMode
              ? `${shortsShotCount ?? 0} shorts shots planned`
              : `${data.scenes.length} scenes planned`}{" "}
            · {data.rules.length} custom rules
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
