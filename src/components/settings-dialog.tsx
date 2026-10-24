"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Cpu, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { Field } from "@/components/field";
import { LabeledCheckbox } from "@/components/labeled-checkbox";
import { SimpleSelect } from "@/components/simple-select";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";
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
  const [availableModels, setAvailableModels] = React.useState<string[]>([]);
  const [modelDefaults, setModelDefaults] = React.useState<Record<string, string>>({});
  const [loadingModels, setLoadingModels] = React.useState(false);

  const loadModels = React.useCallback(async () => {
    setLoadingModels(true);
    try {
      const res = await api<{
        models: Array<{ id: string }>;
        defaults: Record<string, string>;
        count: number;
      }>("/api/models");
      if (res && Array.isArray(res.models)) {
        setAvailableModels(res.models.map((m) => m.id));
      }
      if (res && res.defaults) {
        setModelDefaults(res.defaults);
      }
    } catch {
      // ignore network errors
    } finally {
      setLoadingModels(false);
    }
  }, []);

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
        {/* Scene Planning Mode & Duration */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Scene planning mode"
            htmlFor="sceneCountMode"
            hint="Story pacing control"
          >
            <SimpleSelect
              id="sceneCountMode"
              value={form.sceneCountMode}
              onValueChange={(val) =>
                set("sceneCountMode", val as Settings["sceneCountMode"])
              }
              options={[
                { value: "auto", label: "Auto — AI decides from story" },
                { value: "custom", label: "Custom — specify exact count" },
              ]}
            />
          </Field>

          {form.sceneCountMode === "custom" ? (
            <Field
              label="Target scene count"
              htmlFor="targetScenes"
              hint={`Total ~${scenes * form.clipSeconds}s (${formatRuntime(scenes * form.clipSeconds)})`}
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
          ) : (
            <Field
              label="Scene count"
              htmlFor="autoPacing"
              hint="Story-driven pacing"
            >
              <div
                id="autoPacing"
                className="flex h-9 items-center rounded-lg border border-border bg-muted px-3 text-sm text-foreground"
              >
                Auto-detected from story
              </div>
            </Field>
          )}

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
            onClick={() => {
              const next = !showAdvanced;
              setShowAdvanced(next);
              if (next && availableModels.length === 0) {
                void loadModels();
              }
            }}
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

            {/* AI Models Configuration */}
            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="size-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    AI Models Configuration
                  </span>
                  {availableModels.length > 0 ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-semibold text-primary">
                      {availableModels.length} models available
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={loadModels}
                  disabled={loadingModels}
                  className="h-7 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={cn("size-3", loadingModels && "animate-spin")} />
                  {loadingModels ? "Loading..." : "Refresh models"}
                </Button>
              </div>

              {/* Image Provider Selection */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">AI Keyframe Generation</p>
                  <p className="text-2xs text-muted-foreground">
                    Generate scene starting frames directly via AI Gateway or upload manually.
                  </p>
                </div>
                <SimpleSelect
                  id="imageProvider"
                  value={form.imageProvider}
                  onValueChange={(val) => set("imageProvider", val as "omniroute" | "manual")}
                  options={[
                    { value: "omniroute", label: "Enabled (AI Gateway)" },
                    { value: "manual", label: "Manual (Copy & Upload)" },
                  ]}
                  className="w-48 text-xs"
                />
              </div>

              {/* Datalist for autocomplete on all model inputs */}
              <datalist id="available-gateway-models">
                {availableModels.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Planner Model */}
                <Field
                  label="Planner model"
                  htmlFor="modelPlanner"
                  hint={
                    form.models.planner ? (
                      <span className="flex items-center gap-1 text-primary">
                        Custom override
                        <button
                          type="button"
                          onClick={() => set("models", { ...form.models, planner: "" })}
                          className="ml-1 underline hover:text-foreground"
                        >
                          (Reset)
                        </button>
                      </span>
                    ) : (
                      `Default: ${modelDefaults.planner || "from .env"}`
                    )
                  }
                >
                  <div className="space-y-1.5">
                    <Input
                      id="modelPlanner"
                      list="available-gateway-models"
                      value={form.models.planner}
                      onChange={(event) =>
                        set("models", { ...form.models, planner: event.target.value })
                      }
                      placeholder={modelDefaults.planner || "Select or type model..."}
                      className="font-mono text-xs"
                    />
                    {/* Quick Pick Recommended Models */}
                    <div className="flex flex-wrap items-center gap-1 text-2xs">
                      <span className="mr-0.5 text-muted-foreground">Quick:</span>
                      {[
                        "antigravity/claude-sonnet-4-6",
                        "antigravity/gemini-3.8-flash-high",
                        "auto/best-reasoning",
                      ].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => set("models", { ...form.models, planner: m })}
                          className={cn(
                            "rounded bg-secondary px-1.5 py-0.5 font-mono text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground",
                            form.models.planner === m && "ring-1 ring-primary font-bold",
                          )}
                          title={m}
                        >
                          {m.split("/").pop()}
                        </button>
                      ))}
                    </div>
                  </div>
                </Field>

                {/* Validator Model */}
                <Field
                  label="Validator model"
                  htmlFor="modelValidator"
                  hint={
                    form.models.validator ? (
                      <span className="flex items-center gap-1 text-primary">
                        Custom override
                        <button
                          type="button"
                          onClick={() => set("models", { ...form.models, validator: "" })}
                          className="ml-1 underline hover:text-foreground"
                        >
                          (Reset)
                        </button>
                      </span>
                    ) : (
                      `Default: ${modelDefaults.validator || "from .env"}`
                    )
                  }
                >
                  <div className="space-y-1.5">
                    <Input
                      id="modelValidator"
                      list="available-gateway-models"
                      value={form.models.validator}
                      onChange={(event) =>
                        set("models", { ...form.models, validator: event.target.value })
                      }
                      placeholder={modelDefaults.validator || "Select or type model..."}
                      className="font-mono text-xs"
                    />
                    {/* Quick Pick Recommended Models */}
                    <div className="flex flex-wrap items-center gap-1 text-2xs">
                      <span className="mr-0.5 text-muted-foreground">Quick:</span>
                      {[
                        "antigravity/gemini-3.8-flash-low",
                        "kr/claude-haiku-4.5",
                        "groq/openai/gpt-oss-120b",
                      ].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => set("models", { ...form.models, validator: m })}
                          className={cn(
                            "rounded bg-secondary px-1.5 py-0.5 font-mono text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground",
                            form.models.validator === m && "ring-1 ring-primary font-bold",
                          )}
                          title={m}
                        >
                          {m.split("/").pop()}
                        </button>
                      ))}
                    </div>
                  </div>
                </Field>

                {/* Image Model */}
                <Field
                  label="Image model"
                  htmlFor="modelImage"
                  hint={
                    form.models.image ? (
                      <span className="flex items-center gap-1 text-primary">
                        Custom override
                        <button
                          type="button"
                          onClick={() => set("models", { ...form.models, image: "" })}
                          className="ml-1 underline hover:text-foreground"
                        >
                          (Reset)
                        </button>
                      </span>
                    ) : (
                      `Default: ${modelDefaults.image || "from .env"}`
                    )
                  }
                >
                  <div className="space-y-1.5">
                    <Input
                      id="modelImage"
                      list="available-gateway-models"
                      value={form.models.image}
                      onChange={(event) =>
                        set("models", { ...form.models, image: event.target.value })
                      }
                      placeholder={modelDefaults.image || "Select or type model..."}
                      className="font-mono text-xs"
                    />
                    {/* Quick Pick Recommended Models */}
                    <div className="flex flex-wrap items-center gap-1 text-2xs">
                      <span className="mr-0.5 text-muted-foreground">Quick:</span>
                      {[
                        "antigravity/gemini-3.1-flash-image",
                        "auto/best-vision",
                      ].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => set("models", { ...form.models, image: m })}
                          className={cn(
                            "rounded bg-secondary px-1.5 py-0.5 font-mono text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground",
                            form.models.image === m && "ring-1 ring-primary font-bold",
                          )}
                          title={m}
                        >
                          {m.split("/").pop()}
                        </button>
                      ))}
                    </div>
                  </div>
                </Field>
              </div>
            </div>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
