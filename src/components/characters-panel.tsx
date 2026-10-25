"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Merge, Pencil, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/modal";
import { Field } from "@/components/field";
import { LabeledCheckbox } from "@/components/labeled-checkbox";
import { SimpleSelect } from "@/components/simple-select";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api, ApiError, fileUrl, upload } from "@/lib/apiClient";
import type { CharacterRecord, ProjectData } from "@/lib/types";

type Draft = {
  id: string;
  name: string;
  visual_lock: string;
  voice_lock: string;
  language: "bn" | "en";
  outfit_changes: boolean;
};

const EMPTY_DRAFT: Draft = {
  id: "",
  name: "",
  visual_lock: "",
  voice_lock: "",
  language: "bn",
  outfit_changes: false,
};

export function CharactersPanel({
  data,
  onChanged,
  notify,
}: {
  data: ProjectData;
  onChanged: (meta?: { characterIdMap?: Record<string, string> }) => Promise<void>;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}) {
  const [dialog, setDialog] = React.useState<"add" | "edit" | "merge" | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = React.useState(false);
  const [sourceId, setSourceId] = React.useState("");
  const [targetId, setTargetId] = React.useState("");
  const [refTarget, setRefTarget] = React.useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const refInput = React.useRef<HTMLInputElement>(null);

  function openAdd() {
    setDraft({ ...EMPTY_DRAFT, language: data.project.settings.dialogueLanguage });
    setDialog("add");
  }

  function openEdit(character: CharacterRecord) {
    setDraft({
      id: character.id,
      name: character.name,
      visual_lock: character.visual_lock,
      voice_lock: character.voice_lock,
      language: character.language,
      outfit_changes: character.outfit_changes,
    });
    setDialog("edit");
  }

  async function save() {
    setSaving(true);
    try {
      if (dialog === "add") {
        await api("/api/characters", {
          method: "POST",
          body: JSON.stringify({
            name: draft.name,
            visual_lock: draft.visual_lock,
            voice_lock: draft.voice_lock,
            language: draft.language,
            outfit_changes: draft.outfit_changes,
          }),
        });
        notify("Character added. Prompts re-assembled.", "success");
      } else if (dialog === "edit") {
        await api(`/api/characters/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: draft.name,
            visual_lock: draft.visual_lock,
            voice_lock: draft.voice_lock,
            language: draft.language,
            outfit_changes: draft.outfit_changes,
          }),
        });
        notify("Character lock updated. Prompts re-assembled.", "success");
      }
      await onChanged();
      setDialog(null);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    setSaving(true);
    try {
      await api(`/api/characters/${draft.id}`, { method: "DELETE" });
      await onChanged();
      setDialog(null);
      notify("Character deleted. Prompts re-assembled.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setSaving(false);
    }
  }

  async function merge() {
    setSaving(true);
    try {
      await api("/api/characters/merge", {
        method: "POST",
        body: JSON.stringify({ sourceId, targetId }),
      });
      await onChanged({ characterIdMap: { [sourceId]: targetId } });
      setDialog(null);
      notify("Characters merged. Prompts re-assembled.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setSaving(false);
    }
  }

  async function onRefFile(file: File | null) {
    if (!file || !refTarget) return;
    try {
      await upload(`/api/characters/${refTarget}/ref`, file);
      await onChanged();
      notify("Character reference uploaded.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setRefTarget(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Users className="size-4" aria-hidden />
          </span>
          <CardTitle>Characters</CardTitle>
          <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
            {data.characters.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.characters.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-subtle p-3 text-xs leading-5 text-muted-foreground">
            Characters appear here after the story bible is created. You can also add
            one by hand.
          </p>
        ) : null}

        {data.characters.map((character) => {
          const ref = fileUrl(character.refImage);
          return (
            <div
              key={character.id}
              className="rounded-lg border border-border bg-surface-subtle p-3"
            >
              <div className="flex items-start gap-2.5">
                <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border bg-secondary text-xs font-bold text-secondary-foreground">
                  {ref ? (
                    <Image
                      src={ref}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="36px"
                    />
                  ) : (
                    character.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {character.name}
                    </p>
                    <span className="shrink-0 rounded bg-card px-1.5 py-0.5 text-xs font-medium uppercase text-muted-foreground ring-1 ring-border">
                      {character.language}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {character.visual_lock}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
                    <span className="font-medium text-foreground">Voice:</span>{" "}
                    {character.voice_lock}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(character)}
                  className="inline-flex h-8 items-center gap-1 rounded px-1.5 text-xs font-medium text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pencil className="size-3" aria-hidden />
                  Edit lock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRefTarget(character.id);
                    refInput.current?.click();
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded px-1.5 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ImagePlus className="size-3" aria-hidden />
                  {character.refImage ? "Replace ref" : "Add ref"}
                </button>
              </div>
            </div>
          );
        })}

        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" className="h-9 flex-1 text-xs" onClick={openAdd}>
            <Plus className="size-3.5" aria-hidden />
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 flex-1 text-xs"
            onClick={() => {
              setSourceId(data.characters[0]?.id ?? "");
              setTargetId(data.characters[1]?.id ?? "");
              setDialog("merge");
            }}
            disabled={data.characters.length < 2}
          >
            <Merge className="size-3.5" aria-hidden />
            Merge
          </Button>
        </div>

        <input
          ref={refInput}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            void onRefFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
      </CardContent>

      <Modal
        open={dialog === "add" || dialog === "edit"}
        onClose={() => setDialog(null)}
        title={dialog === "add" ? "Add character" : `Edit ${draft.name}`}
        description="These locks are inserted verbatim into every scene prompt. Keep dress and voice factual."
        size="lg"
        footer={
          <>
            {dialog === "edit" ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={saving}
                className="mr-auto"
              >
                Delete
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? <Spinner /> : null}
              {dialog === "add" ? "Add character" : "Save locks"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="char-name">
              <Input
                id="char-name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Rina"
              />
            </Field>
            <Field label="Dialogue language" htmlFor="char-language">
              <SimpleSelect
                id="char-language"
                value={draft.language}
                onValueChange={(val) =>
                  setDraft({ ...draft, language: val as "bn" | "en" })
                }
                options={[
                  { value: "bn", label: "Bangla" },
                  { value: "en", label: "English" },
                ]}
              />
            </Field>
          </div>
          <Field
            label="Visual lock"
            htmlFor="char-visual"
            hint="40–60 words: age, face, hair, skin tone, DRESS, accessories. Visual facts only."
          >
            <Textarea
              id="char-visual"
              value={draft.visual_lock}
              onChange={(event) => setDraft({ ...draft, visual_lock: event.target.value })}
              rows={5}
            />
          </Field>
          <Field
            label="Voice lock"
            htmlFor="char-voice"
            hint="Age, pitch, speed, accent, mood. Concrete."
          >
            <Textarea
              id="char-voice"
              value={draft.voice_lock}
              onChange={(event) => setDraft({ ...draft, voice_lock: event.target.value })}
              rows={3}
            />
          </Field>
          <LabeledCheckbox
            label="This character changes outfit in the story"
            description="When off, dress never changes between scenes."
            checked={draft.outfit_changes}
            onCheckedChange={(checked) =>
              setDraft({ ...draft, outfit_changes: checked })
            }
          />
        </div>
      </Modal>

      <Modal
        open={dialog === "merge"}
        onClose={() => setDialog(null)}
        title="Merge two characters"
        description="Use this when the story mentions the same person under two names. The target keeps its locks; the source is removed."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={merge}
              disabled={saving || !sourceId || !targetId || sourceId === targetId}
            >
              {saving ? <Spinner /> : <Merge className="size-4" aria-hidden />}
              Merge
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Remove (source)" htmlFor="merge-source">
            <SimpleSelect
              id="merge-source"
              value={sourceId}
              onValueChange={setSourceId}
              options={data.characters.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Keep (target)" htmlFor="merge-target">
            <SimpleSelect
              id="merge-target"
              value={targetId}
              onValueChange={setTargetId}
              options={data.characters.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete character "${draft.name}"?`}
        description="Scenes using this character will drop them from the scene. Are you sure you want to proceed?"
        confirmLabel="Delete character"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={doDelete}
      />
    </Card>
  );
}
