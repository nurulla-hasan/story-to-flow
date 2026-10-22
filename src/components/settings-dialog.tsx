"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/apiClient";
import {
  STYLE_PRESETS,
  sceneCount,
  type ProjectData,
  type Settings,
} from "@/lib/types";

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

  if (open && data.project.settings !== prevSettings) {
    setPrevSettings(data.project.settings);
    setForm(data.project.settings);
  }

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const presetOptions = React.useMemo(() => {
    const list = STYLE_PRESETS as readonly string[];
    return list.includes(form.stylePreset)
      ? list
      : [form.stylePreset, ...list];
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
    <Dialog
      open={open}
      onClose={onClose}
      title="Project settings"
      description="Every setting is dynamic. Changing locks, style or rules re-assembles the prompts; it never re-plans the scenes."
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
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Dialogue language" htmlFor="dialogueLanguage">
            <Select
              id="dialogueLanguage"
              value={form.dialogueLanguage}
              onChange={(event) =>
                set("dialogueLanguage", event.target.value as Settings["dialogueLanguage"])
              }
            >
              <option value="bn">Bangla</option>
              <option value="en">English</option>
            </Select>
          </Field>
          <Field
            label="Accent note"
            htmlFor="accentNote"
            hint="Free text, added to every dialogue scene."
          >
            <Input
              id="accentNote"
              value={form.accentNote}
              onChange={(event) => set("accentNote", event.target.value)}
              placeholder="e.g. soft rural Bengali accent"
            />
          </Field>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Field label="Total length (minutes)" htmlFor="totalMinutes">
            <Input
              id="totalMinutes"
              type="number"
              min={0.2}
              max={120}
              step={0.5}
              value={form.totalMinutes}
              onChange={(event) => set("totalMinutes", Number(event.target.value))}
            />
          </Field>
          <Field label="Clip length" htmlFor="clipSeconds">
            <Select
              id="clipSeconds"
              value={String(form.clipSeconds)}
              onChange={(event) =>
                set("clipSeconds", Number(event.target.value) as 8 | 10)
              }
            >
              <option value="8">8 seconds</option>
              <option value="10">10 seconds</option>
            </Select>
          </Field>
          <Field
            label="Scene count"
            hint={`${scenes} scenes — ceil(${form.totalMinutes * 60}s / ${form.clipSeconds}s)`}
          >
            <div className="flex h-11 items-center rounded-lg border border-border bg-muted px-3 text-sm font-semibold tabular-nums">
              {scenes}
            </div>
          </Field>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Aspect ratio" htmlFor="aspectRatio">
            <Select
              id="aspectRatio"
              value={form.aspectRatio}
              onChange={(event) =>
                set("aspectRatio", event.target.value as Settings["aspectRatio"])
              }
            >
              <option value="16:9">16:9 — landscape</option>
              <option value="9:16">9:16 — vertical</option>
            </Select>
          </Field>
          <Field label="Visual style preset" htmlFor="stylePreset">
            <Select
              id="stylePreset"
              value={form.stylePreset}
              onChange={(event) => set("stylePreset", event.target.value)}
            >
              {presetOptions.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Style notes"
            htmlFor="styleNote"
            className="sm:col-span-2"
            hint="Look, lens, light, grade, mood. Folded into the style lock when the bible is generated."
          >
            <Textarea
              id="styleNote"
              value={form.styleNote}
              onChange={(event) => set("styleNote", event.target.value)}
              placeholder="e.g. 35mm, warm sunrise haze, muted greens, intimate handheld"
              rows={3}
            />
          </Field>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Max people per scene" htmlFor="maxPeople">
            <Input
              id="maxPeople"
              type="number"
              min={1}
              max={8}
              value={form.maxPeople}
              onChange={(event) => set("maxPeople", Number(event.target.value))}
            />
          </Field>
          <Field label="Max dialogue words" htmlFor="maxDialogueWords">
            <Input
              id="maxDialogueWords"
              type="number"
              min={1}
              max={80}
              value={form.maxDialogueWords}
              onChange={(event) =>
                set("maxDialogueWords", Number(event.target.value))
              }
            />
          </Field>
          <Checkbox
            label="Dialogue on"
            description="Planner may add one line per scene."
            checked={form.dialogueEnabled}
            onChange={(event) => set("dialogueEnabled", event.target.checked)}
          />
          <Checkbox
            label="Ambient sound on"
            description="Keep diegetic sound; no background music otherwise."
            checked={form.ambientSound}
            onChange={(event) => set("ambientSound", event.target.checked)}
          />
          <Checkbox
            label="Frame chaining"
            description="Scene N starts from the last frame of scene N-1."
            checked={form.frameChaining}
            onChange={(event) => set("frameChaining", event.target.checked)}
          />
          <Field label="Validator strictness" htmlFor="validatorStrictness">
            <Select
              id="validatorStrictness"
              value={form.validatorStrictness}
              onChange={(event) =>
                set(
                  "validatorStrictness",
                  event.target.value as Settings["validatorStrictness"],
                )
              }
            >
              <option value="off">Off — deterministic checks only</option>
              <option value="light">Light — one validation pass</option>
              <option value="strict">Strict — two fix rounds</option>
            </Select>
          </Field>
        </section>

        <Field
          label="Negative list"
          htmlFor="negativeList"
          hint="Inserted verbatim into every prompt under AVOID."
        >
          <Textarea
            id="negativeList"
            value={form.negativeList}
            onChange={(event) => set("negativeList", event.target.value)}
            rows={3}
          />
        </Field>

        <section className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <Field
            label="Image provider"
            htmlFor="imageProvider"
            hint="Manual is the safe default: copy the keyframe prompt, generate in Flow, upload."
          >
            <Select
              id="imageProvider"
              value={form.imageProvider}
              onChange={(event) =>
                set("imageProvider", event.target.value as Settings["imageProvider"])
              }
            >
              <option value="manual">Manual — copy prompt + upload</option>
              <option value="omniroute">OmniRoute — try to generate</option>
            </Select>
          </Field>
          <div className="flex items-end pb-1 text-xs leading-5 text-muted-foreground">
            The probe showed no image returned from the chat-tagged model, so
            manual is the evidence-based default.
          </div>
          <Field label="Planner model override" htmlFor="modelPlanner">
            <Input
              id="modelPlanner"
              value={form.models.planner}
              onChange={(event) =>
                set("models", { ...form.models, planner: event.target.value })
              }
              placeholder="Default from .env.local"
            />
          </Field>
          <Field label="Validator model override" htmlFor="modelValidator">
            <Input
              id="modelValidator"
              value={form.models.validator}
              onChange={(event) =>
                set("models", { ...form.models, validator: event.target.value })
              }
              placeholder="Default from .env.local"
            />
          </Field>
          <Field label="Image model override" htmlFor="modelImage">
            <Input
              id="modelImage"
              value={form.models.image}
              onChange={(event) =>
                set("models", { ...form.models, image: event.target.value })
              }
              placeholder="Default from .env.local"
            />
          </Field>
        </section>
      </form>
    </Dialog>
  );
}
