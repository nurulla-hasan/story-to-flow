"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/modal";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, fileUrl, upload } from "@/lib/apiClient";
import type { LocationRecord, ProjectData } from "@/lib/types";

export function LocationsPanel({
  data,
  onChanged,
  notify,
}: {
  data: ProjectData;
  onChanged: () => Promise<void>;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}) {
  const [editing, setEditing] = React.useState<LocationRecord | null>(null);
  const [name, setName] = React.useState("");
  const [lock, setLock] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [refTarget, setRefTarget] = React.useState<string | null>(null);
  const refInput = React.useRef<HTMLInputElement>(null);

  function openEdit(location: LocationRecord) {
    setEditing(location);
    setName(location.name);
    setLock(location.visual_lock);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/api/locations/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, visual_lock: lock }),
      });
      await onChanged();
      setEditing(null);
      notify("Location lock updated. Prompts re-assembled.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setSaving(false);
    }
  }

  async function onRefFile(file: File | null) {
    if (!file || !refTarget) return;
    try {
      await upload(`/api/locations/${refTarget}/ref`, file);
      await onChanged();
      notify("Location reference uploaded.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setRefTarget(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-warning-subtle text-warning">
            <MapPin className="size-4" aria-hidden />
          </span>
          <CardTitle>Locations</CardTitle>
          <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
            {data.locations.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5 pt-1">
        {data.locations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-subtle p-3 text-xs leading-5 text-muted-foreground">
            Locations are detected with the story bible.
          </p>
        ) : null}
        {data.locations.map((location) => {
          const ref = fileUrl(location.refImage);
          return (
            <div key={location.id} className="flex items-start gap-2.5">
              <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
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
                  <MapPin className="size-4 text-muted-foreground" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{location.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {location.visual_lock}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(location)}
                    className="inline-flex h-7 items-center gap-1 rounded px-1 text-xs font-medium text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Pencil className="size-3" aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRefTarget(location.id);
                      refInput.current?.click();
                    }}
                    className="inline-flex h-7 items-center gap-1 rounded px-1 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ImagePlus className="size-3" aria-hidden />
                    {location.refImage ? "Replace ref" : "Add ref"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
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
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name ?? "location"}`}
        description="The visual lock is inserted verbatim into every scene in this location."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? <Spinner /> : null}
              Save location
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Display name" htmlFor="loc-name">
            <Input
              id="loc-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field
            label="Visual lock"
            htmlFor="loc-lock"
            hint="Architecture, objects, time of day, light, colors. No people or plot."
          >
            <Textarea
              id="loc-lock"
              value={lock}
              onChange={(event) => setLock(event.target.value)}
              rows={5}
            />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
