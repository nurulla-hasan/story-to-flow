"use client";

import * as React from "react";
import {
  BookOpen,
  ListOrdered,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/apiClient";
import type { JobRecord, ProjectData } from "@/lib/types";
import { sceneCount } from "@/lib/types";

export function LeftPanel({
  data,
  onChanged,
  notify,
  onOpenSettings,
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
  const [busy, setBusy] = React.useState<"save" | "bible" | "plan" | null>(null);

  if (data.project.story !== prevStory) {
    setPrevStory(data.project.story);
    setStory(data.project.story);
  }

  const settings = data.project.settings;
  const dirty = story !== data.project.story;

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

  async function createBible() {
    if (
      data.characters.length &&
      !window.confirm(
        "Replacing the story bible replaces characters and locations. Existing scenes keep their ids and may need re-planning. Continue?",
      )
    ) {
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
      await api("/api/bible", { method: "POST" });
      await onChanged();
      notify("Story bible created. Characters and locations are locked.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  async function rePlan() {
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
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <BookOpen className="size-4" aria-hidden />
            </span>
            <CardTitle>Story</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <label htmlFor="story" className="sr-only">
            Story text
          </label>
          <Textarea
            id="story"
            value={story}
            onChange={(event) => setStory(event.target.value)}
            placeholder="Paste your story here. Bangla or English."
            rows={8}
            className="min-h-44 text-xs leading-6"
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
            <Button
              type="button"
              onClick={createBible}
              disabled={!story.trim() || Boolean(busy)}
            >
              {busy === "bible" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {data.characters.length ? "Rebuild story bible" : "Create story bible"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={rePlan}
              disabled={!data.characters.length || Boolean(busy)}
            >
              {busy === "plan" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="size-4" aria-hidden />
              )}
              Re-plan scenes
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            The bible detects every character and location. Scenes are planned in
            batches and prompts are assembled by code, never by the model.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Settings2 className="size-4" aria-hidden />
            </span>
            <CardTitle>Project settings</CardTitle>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-primary underline-offset-4 hover:bg-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings2 className="size-3.5" aria-hidden />
            Edit
          </button>
        </CardHeader>
        <CardContent className="pt-2">
          <dl className="divide-y divide-border text-xs">
            <Row label="Language" value={settings.dialogueLanguage === "bn" ? "Bangla" : "English"} />
            <Row
              label="Length"
              value={`${settings.totalMinutes} min · ${settings.clipSeconds}s clips`}
            />
            <Row
              label="Plan"
              value={`${sceneCount(settings)} scenes · ${settings.aspectRatio}`}
            />
            <Row label="Style" value={settings.stylePreset} />
            <Row label="People" value={`Max ${settings.maxPeople} per scene`} />
            <Row label="Dialogue" value={settings.dialogueEnabled ? `On · ≤${settings.maxDialogueWords} words` : "Off"} />
            <Row label="Ambient" value={settings.ambientSound ? "On" : "Off"} />
            <Row label="Chaining" value={settings.frameChaining ? "On" : "Off"} />
            <Row label="Validator" value={settings.validatorStrictness} />
            <Row label="Images" value={settings.imageProvider === "manual" ? "Manual" : "OmniRoute"} />
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

      {busy === "bible" ? (
        <div className="flex items-start gap-2 rounded-lg border border-brand-border bg-brand-subtle p-3 text-xs leading-5 text-secondary-foreground">
          <RefreshCw className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
          Reading the story and locking characters, dress, voice and locations…
        </div>
      ) : null}
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
