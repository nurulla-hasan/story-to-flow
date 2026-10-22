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
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#e6f4f1] text-[#0b5f58]">
              <BookOpen className="h-4 w-4" aria-hidden />
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
            className="min-h-[176px] text-[13px] leading-6"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {story.trim() ? `${story.trim().length.toLocaleString()} characters` : "Empty"}
            </span>
            <button
              type="button"
              onClick={saveStory}
              disabled={!dirty || Boolean(busy)}
              className="inline-flex h-8 items-center gap-1 rounded px-1.5 text-[11px] font-medium text-[#0b5f58] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
            >
              {busy === "save" ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Save className="h-3 w-3" aria-hidden />
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
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
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
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="h-4 w-4" aria-hidden />
              )}
              Re-plan scenes
            </Button>
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            The bible detects every character and location. Scenes are planned in
            batches and prompts are assembled by code, never by the model.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#eef1f4] text-[#3f4d5a]">
              <Settings2 className="h-4 w-4" aria-hidden />
            </span>
            <CardTitle>Project settings</CardTitle>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex h-9 items-center gap-1.5 rounded-[8px] px-2 text-[11px] font-semibold text-[#0b5f58] underline-offset-4 hover:bg-[#e6f4f1] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden />
            Edit
          </button>
        </CardHeader>
        <CardContent className="pt-2">
          <dl className="divide-y divide-border/80 text-[12.5px]">
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
          <div className="mt-3 rounded-[9px] border border-border bg-[#fbfcfd] p-2.5 text-[11px] leading-5 text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#3f4d5a]">
              <ListOrdered className="h-3.5 w-3.5" aria-hidden />
              {data.characters.length} characters · {data.locations.length} locations
            </span>
            <br />
            {data.scenes.length} scenes planned · {data.rules.length} custom rules
          </div>
        </CardContent>
      </Card>

      {busy === "bible" ? (
        <div className="flex items-start gap-2 rounded-[10px] border border-[#cfe6e2] bg-[#f2faf8] p-3 text-[12px] leading-5 text-[#0b5f58]">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
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
      <dd className="min-w-0 text-right font-medium text-[#283643]">{value}</dd>
    </div>
  );
}
