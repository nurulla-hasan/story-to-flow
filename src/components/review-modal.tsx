"use client";

import * as React from "react";
import Image from "next/image";
import {
  Check,
  CheckSquare,
  Download,
  Film,
  Link2,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError, fileUrl, upload } from "@/lib/apiClient";
import type { ProjectData, SceneRecord } from "@/lib/types";

const PROBLEMS = [
  { id: "face_changed", label: "Face changed", desc: "Actor looks like a different person" },
  { id: "dress_changed", label: "Dress changed", desc: "Clothes, colors or accessories shifted" },
  { id: "location_changed", label: "Location changed", desc: "Background or lighting doesn't match" },
  { id: "voice_changed", label: "Voice changed", desc: "Accent, pitch or tone drifted" },
  { id: "continuity_broken", label: "Continuity broken", desc: "End of last clip doesn't match start of this clip" },
] as const;

export function ReviewModal({
  data,
  sceneN,
  open,
  onClose,
  onChanged,
  notify,
}: {
  data: ProjectData;
  sceneN: number | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}) {
  const scene = data.scenes.find((item) => item.n === sceneN);
  if (!open || !scene) return null;

  return (
    <ReviewModalContent
      key={scene.n}
      data={data}
      scene={scene}
      open={open}
      onClose={onClose}
      onChanged={onChanged}
      notify={notify}
    />
  );
}

function ReviewModalContent({
  data,
  scene,
  open,
  onClose,
  onChanged,
  notify,
}: {
  data: ProjectData;
  scene: SceneRecord;
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}) {
  const nextScene = data.scenes.find((item) => item.n === scene.n + 1) ?? null;

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const clipInputRef = React.useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = React.useState(false);
  const [problems, setProblems] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [saveAsRule, setSaveAsRule] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const [proposal, setProposal] = React.useState<{
    reinforcements: string[];
    customRule: string | null;
    prompt: string;
  } | null>(null);

  const currentScene = scene;
  const clipSrc = fileUrl(currentScene.clipPath);
  const lastFrameSrc = fileUrl(currentScene.lastFramePath);

  function toggleProblem(id: string) {
    setProblems((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  /**
   * Browser-side frame extraction: hidden/in-page video seeks to duration - 0.08s,
   * draws onto canvas, converts to Blob, and POSTs to `/api/scenes/:n/last-frame`.
   */
  async function extractLastFrame() {
    const video = videoRef.current;
    if (!video || !clipSrc) {
      notify("Upload a clip first.", "error");
      return;
    }
    setExtracting(true);
    try {
      const blob = await captureLastFrame(video);
      const file = new File([blob], `scene-${currentScene.n}-last-frame.png`, {
        type: "image/png",
      });
      await upload(`/api/scenes/${currentScene.n}/last-frame`, file);
      await onChanged();
      notify("Last frame extracted.", "success");
    } catch (error) {
      notify(
        `Frame extraction failed: ${error instanceof Error ? error.message : String(error)}. Try uploading a PNG manually.`,
        "error",
      );
    } finally {
      setExtracting(false);
    }
  }

  async function sendToNextScene() {
    setBusy("chain");
    try {
      await api(`/api/scenes/${currentScene.n}/chain`, { method: "POST" });
      await onChanged();
      notify(`Last frame attached as start frame for Scene ${currentScene.n + 1}.`, "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  async function requestRegeneration() {
    setBusy("regenerate");
    try {
      const res = await api<{
        applied: boolean;
        reinforcements: string[];
        customRule: string | null;
        prompt: string;
      }>(`/api/scenes/${currentScene.n}/regenerate`, {
        method: "POST",
        body: JSON.stringify({
          problems,
          note,
          apply: false,
        }),
      });
      setProposal({
        reinforcements: res.reinforcements,
        customRule: res.customRule,
        prompt: res.prompt,
      });
      notify("Reinforcement lines generated. Review diff below.", "info");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  async function applyRegeneration() {
    if (!proposal) return;
    setBusy("apply");
    try {
      await api(`/api/scenes/${currentScene.n}/regenerate`, {
        method: "POST",
        body: JSON.stringify({
          problems,
          note,
          apply: true,
          reinforcements: proposal.reinforcements,
          customRule: proposal.customRule,
          saveRule: saveAsRule,
        }),
      });
      await onChanged();
      setProposal(null);
      notify("New prompt version saved. MUST lines applied.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Clip review · Scene ${scene.n}`}
      description="Inspect your generated Flow clip, capture its last frame to chain into the next scene, or report what drifted so the app fixes the prompt."
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Current prompt: v{scene.prompt?.version ?? 0}
          </span>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-foreground/95">
            {clipSrc ? (
              <video
                ref={videoRef}
                src={clipSrc}
                controls
                playsInline
                crossOrigin="anonymous"
                className="aspect-video w-full bg-foreground object-contain"
              />
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
                <Film className="size-10 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">No clip uploaded yet</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Generate this clip in Flow using the master prompt, then upload it
                  here.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-2 text-xs"
                  onClick={() => clipInputRef.current?.click()}
                >
                  <Upload className="size-3.5" aria-hidden />
                  Upload clip
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => clipInputRef.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden />
              {scene.clipPath ? "Replace clip" : "Upload clip"}
            </Button>
            {clipSrc ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={extractLastFrame}
                disabled={extracting}
              >
                {extracting ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
                Extract last frame
              </Button>
            ) : null}
            <input
              ref={clipInputRef}
              type="file"
              accept="video/*"
              className="sr-only"
              tabIndex={-1}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  await upload(`/api/scenes/${scene.n}/clip`, file);
                  await onChanged();
                  notify("Clip uploaded.", "success");
                } catch (error) {
                  notify(error instanceof ApiError ? error.message : String(error), "error");
                }
              }}
            />
          </div>

          <div className="rounded-lg border border-border bg-surface-subtle p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Last frame
              </span>
              {lastFrameSrc ? (
                <a
                  href={lastFrameSrc}
                  download={`scene-${scene.n}-last-frame.png`}
                  className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                >
                  <Download className="size-3" aria-hidden />
                  Download PNG
                </a>
              ) : null}
            </div>
            <div className="mt-2 flex items-start gap-3">
              <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                {lastFrameSrc ? (
                  <Image
                    src={lastFrameSrc}
                    alt="Last frame"
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="144px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    None
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2 text-xs">
                <p className="text-muted-foreground">
                  Use this as the first frame in Google Flow for Scene {scene.n + 1} to
                  guarantee frame-to-frame continuity.
                </p>
                {nextScene ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={sendToNextScene}
                    disabled={!scene.lastFramePath || busy === "chain"}
                  >
                    {busy === "chain" ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <Link2 className="size-3.5" aria-hidden />
                    )}
                    Send to Scene {nextScene.n}
                  </Button>
                ) : (
                  <span className="inline-block text-xs italic text-muted-foreground">
                    This is the final scene.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-subtle p-4">
            <h3 className="text-sm font-semibold text-foreground">What went wrong?</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tick what drifted in your Flow clip. The validator will generate 1–3
              concrete reinforcement lines for MUST.
            </p>

            <div className="mt-3 space-y-1">
              {PROBLEMS.map((problem) => (
                <Checkbox
                  key={problem.id}
                  label={problem.label}
                  description={problem.desc}
                  checked={problems.includes(problem.id)}
                  onChange={() => toggleProblem(problem.id)}
                />
              ))}
            </div>

            <div className="mt-3">
              <Field label="Additional note" htmlFor="problem-note">
                <Textarea
                  id="problem-note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. Rina's hair turned wavy; keep it dead-straight in a tight braid"
                  className="text-xs"
                />
              </Field>
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                onClick={requestRegeneration}
                disabled={
                  (!problems.length && !note.trim()) || busy === "regenerate"
                }
                className="flex-1 text-xs"
              >
                {busy === "regenerate" ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
                Regenerate prompt for Scene {scene.n}
              </Button>
            </div>
          </div>

          {proposal ? (
            <div className="rounded-xl border border-brand-border bg-brand-subtle p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <h4 className="text-sm font-semibold text-secondary-foreground">
                  Proposed reinforcement lines
                </h4>
              </div>

              <div className="mt-3 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
                  Added to MUST (diff):
                </p>
                {proposal.reinforcements.map((line, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 rounded-md border border-brand-border bg-card px-2.5 py-1.5 font-mono text-xs leading-5 text-secondary-foreground"
                  >
                    <span className="font-bold text-primary">+</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>

              {proposal.customRule ? (
                <div className="mt-3 border-t border-brand-border pt-3">
                  <Checkbox
                    label={
                      <span className="text-xs font-semibold text-secondary-foreground">
                        Save as custom rule for all scenes
                      </span>
                    }
                    description={`"${proposal.customRule}" — will be added to MUST in every scene.`}
                    checked={saveAsRule}
                    onChange={(event) => setSaveAsRule(event.target.checked)}
                  />
                </div>
              ) : null}

              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setProposal(null)}
                  className="text-xs"
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={applyRegeneration}
                  disabled={busy === "apply"}
                  className="flex-1 text-xs"
                >
                  {busy === "apply" ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <CheckSquare className="size-3.5" aria-hidden />
                  )}
                  Save new prompt version
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Capture frame client-side using an offscreen canvas and HTMLVideoElement.
 */
function captureLastFrame(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const originalTime = video.currentTime;
    const targetTime = Math.max(0, (video.duration || 1) - 0.08);

    const onSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get 2D canvas context");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            video.removeEventListener("seeked", onSeeked);
            video.currentTime = originalTime;
            if (blob) resolve(blob);
            else reject(new Error("Canvas blob conversion produced null"));
          },
          "image/png",
          1,
        );
      } catch (err) {
        video.removeEventListener("seeked", onSeeked);
        video.currentTime = originalTime;
        reject(err);
      }
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.currentTime = targetTime;
  });
}
