"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { Field } from "@/components/field";
import { LabeledCheckbox } from "@/components/labeled-checkbox";
import { SimpleSelect } from "@/components/simple-select";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/apiClient";
import {
  STYLE_PRESETS,
  sceneCount,
  type ProjectData,
  type Settings,
} from "@/lib/types";

function formatRuntime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function SettingsDialog({
  data,
  open,
  onClose,
  onSaved,
  onError,
}: {
  data: ProjectData;
  open: boolean;
  onClose: () => void;
  onSaved: (data: ProjectData & { changedPrompts?: number }) => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = React.useState<Settings>(data.project.settings);
  const [prevSettings, setPrevSettings] = React.useState<Settings>(data.project.settings);
  const [saving, setSaving] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  if (open && data.project.settings !== prevSettings) {
    setPrevSettings(data.project.settings);
    setForm(data.project.settings);
  }

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const presetOptions = React.useMemo(() => {
    const list = STYLE_PRESETS as readonly string[];
    const all = list.includes(form.stylePreset)
      ? list
      : [form.stylePreset, ...list];
    return all.map((preset) => ({ value: preset, label: preset }));
  }, [form.stylePreset]);

  const scenes = sceneCount(form);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api<ProjectData & { changedPrompts?: number }>(
        "/api/project",
        {
          method: "PATCH",
          body: JSON.stringify({ settings: form }),
        },
      );
      onSaved(result);
      onClose();
    } catch (error) {
      onError(error instanceof ApiError ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Project settings"
      description="Configure video style, duration, and dialogue. Prompts update dynamically."
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="settings-form" disabled={saving}>
            {saving ? <Spinner /> : <Save className="size-4" aria-hidden />}
            Save settings
          </Button>
        </>
      }
    >
      <form id="settings-form" onSubmit={submit} className="grid gap-5">
        {/* Scene Count & Runtime */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Target scene count"
            htmlFor="targetScenes"
            hint="Number of clips to plan"
          >
            <Input
              id="targetScenes"
              type="number"
              min={1}
              max={60}
              value={scenes}
              onChange={(event) => {
                const count = Math.max(1, Math.min(60, Number(event.target.value) || 1));
                const mins = Math.round(((count * form.clipSeconds) / 60) * 10) / 10;
                set("totalMinutes", mins);
              }}
            />
          </Field>
          <Field label="Clip length" htmlFor="clipSeconds">
            <SimpleSelect
              id="clipSeconds"
              value={String(form.clipSeconds)}
              onValueChange={(val) => {
                const secs = Number(val) as 8 | 10;
                set("clipSeconds", secs);
                const mins = Math.round(((scenes * secs) / 60) * 10) / 10;
                set("totalMinutes", mins);
              }}
              options={[
                { value: "10", label: "10 seconds" },
                { value: "8", label: "8 seconds" },
              ]}
            />
          </Field>
          <Field label="Estimated runtime" htmlFor="runtime">
            <div
              id="runtime"
              className="flex h-9 items-center rounded-lg border border-border bg-muted px-3 text-xs font-semibold tabular-nums text-foreground"
            >
              {formatRuntime(scenes * form.clipSeconds)} ({scenes} clips)
            </div>
          </Field>
        </section>

        {/* Style & Aspect Ratio */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Aspect ratio" htmlFor="aspectRatio">
            <SimpleSelect
              id="aspectRatio"
              value={form.aspectRatio}
              onValueChange={(val) =>
                set("aspectRatio", val as Settings["aspectRatio"])
              }
              options={[
                { value: "16:9", label: "16:9 — Landscape" },
                { value: "9:16", label: "9:16 — Vertical (Shorts/Reels)" },
              ]}
            />
          </Field>
          <Field label="Visual style preset" htmlFor="stylePreset">
            <SimpleSelect
              id="stylePreset"
              value={form.stylePreset}
              onValueChange={(val) => set("stylePreset", val)}
              options={presetOptions}
            />
          </Field>
          <Field
            label="Style notes"
            htmlFor="styleNote"
            className="sm:col-span-2"
            hint="Mood, lighting, and camera lens look."
          >
            <Textarea
              id="styleNote"
              value={form.styleNote}
              onChange={(event) => set("styleNote", event.target.value)}
              placeholder="e.g. 35mm film, warm sunrise haze, muted greens, cinematic realism"
              rows={2}
            />
          </Field>
        </section>

        {/* Language & Dialogue */}
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Dialogue language" htmlFor="dialogueLanguage">
            <SimpleSelect
              id="dialogueLanguage"
              value={form.dialogueLanguage}
              onValueChange={(val) =>
                set("dialogueLanguage", val as Settings["dialogueLanguage"])
              }
              options={[
                { value: "bn", label: "Bangla" },
                { value: "en", label: "English" },
              ]}
            />
          </Field>
          <Field
            label="Accent note (optional)"
            htmlFor="accentNote"
            hint="Added to dialogue lines (e.g. rural dialect, calm tone)."
          >
            <Input
              id="accentNote"
              value={form.accentNote}
              onChange={(event) => set("accentNote", event.target.value)}
              placeholder="e.g. soft rural Bengali accent"
            />
          </Field>
        </section>

        {/* Advanced Settings Toggle */}
        <div className="border-t border-border pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline focus-visible:outline-none"
          >
            {showAdvanced ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            {showAdvanced ? "Hide advanced settings" : "Show advanced settings (prompts, models, limits)"}
          </button>
        </div>

        {showAdvanced ? (
          <div className="grid gap-4 rounded-xl border border-border bg-muted/40 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledCheckbox
                label="Dialogue on"
                description="Planner may add dialogue to dialogue-driven scenes."
                checked={form.dialogueEnabled}
                onCheckedChange={(checked) => set("dialogueEnabled", checked)}
              />
              <LabeledCheckbox
                label="Ambient sound on"
                description="Add natural background ambience to shot audio."
                checked={form.ambientSound}
                onCheckedChange={(checked) => set("ambientSound", checked)}
              />
              <LabeledCheckbox
                label="Frame chaining"
                description="Scene N starts from the last frame of scene N-1."
                checked={form.frameChaining}
                onCheckedChange={(checked) => set("frameChaining", checked)}
              />
              <Field
                label="AI validator strictness"
                htmlFor="validatorStrictness"
                hint="Deterministic rules always run."
              >
                <SimpleSelect
                  id="validatorStrictness"
                  value={form.validatorStrictness}
                  onValueChange={(val) =>
                    set(
                      "validatorStrictness",
                      val as Settings["validatorStrictness"],
                    )
                  }
                  options={[
                    { value: "off", label: "Off (Fastest) — rules check only" },
                    { value: "light", label: "Light — 1 AI review pass" },
                    { value: "strict", label: "Strict — 2 AI review passes" },
                  ]}
                />
              </Field>
            </div>

            <Field
              label="Negative prompt list"
              htmlFor="negativeList"
              hint="Common visual artifacts to avoid."
            >
              <Textarea
                id="negativeList"
                value={form.negativeList}
                onChange={(event) => set("negativeList", event.target.value)}
                rows={2}
                className="text-xs"
              />
            </Field>

            <section className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
              <Field label="Planner model override" htmlFor="modelPlanner">
                <Input
                  id="modelPlanner"
                  value={form.models.planner}
                  onChange={(event) =>
                    set("models", { ...form.models, planner: event.target.value })
                  }
                  placeholder="From .env.local"
                />
              </Field>
              <Field label="Validator model override" htmlFor="modelValidator">
                <Input
                  id="modelValidator"
                  value={form.models.validator}
                  onChange={(event) =>
                    set("models", { ...form.models, validator: event.target.value })
                  }
                  placeholder="From .env.local"
                />
              </Field>
              <Field label="Image model override" htmlFor="modelImage">
                <Input
                  id="modelImage"
                  value={form.models.image}
                  onChange={(event) =>
                    set("models", { ...form.models, image: event.target.value })
                  }
                  placeholder="From .env.local"
                />
              </Field>
            </section>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
