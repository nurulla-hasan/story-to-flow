"use client";

import * as React from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clapperboard,
  Copy,
  Download,
  Film,
  ImagePlus,
  Link2,
  Loader2,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { api, ApiError, copyText, fileUrl, STATUS_META, upload } from "@/lib/apiClient";
import { isFlowExtensionInstalled, sendToFlow } from "@/lib/flowBridge";
import type { ProjectData, SceneRecord } from "@/lib/types";
import { languageLabel } from "@/lib/types";

export function SceneCard({
  data,
  scene,
  open,
  onToggle,
  onChanged,
  onOpenReview,
  notify,
}: {
  data: ProjectData;
  scene: SceneRecord;
  open: boolean;
  onToggle: () => void;
  onChanged: () => Promise<void>;
  onOpenReview: (n: number) => void;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [copiedImagePrompt, setCopiedImagePrompt] = React.useState(false);
  const clipInput = React.useRef<HTMLInputElement>(null);
  const keyframeInput = React.useRef<HTMLInputElement>(null);

  const meta = STATUS_META[scene.status];
  const location =
    data.locations.find((item) => item.id === scene.location_id)?.name ??
    scene.location_id;
  const visible = scene.characters
    .map((id) => data.characters.find((character) => character.id === id))
    .filter(Boolean);
  const keyframe = fileUrl(scene.keyframePath);
  const startFrame = fileUrl(scene.startFramePath);
  const displayImage = startFrame || keyframe;
  const isChained = Boolean(startFrame);
  const prompt = scene.prompt?.text ?? "";
  const imagePrompt = scene.prompt?.imagePrompt ?? "";
  const dialogueCharacter = scene.dialogue
    ? data.characters.find((character) => character.id === scene.dialogue?.speaker)
    : undefined;
  const speakerNames = scene.dialogue
    ? scene.dialogue.speaker
        .split(/[,&/]/)
        .map((s) => data.characters.find((c) => c.id === s.trim())?.name ?? s.trim())
        .join(" & ")
    : "";
  const dialogueLanguage =
    dialogueCharacter?.language ?? data.project.settings.dialogueLanguage;

  async function act(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
      await onChanged();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  async function copyPrompt() {
    if (!prompt) return;
    try {
      await copyText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      notify("Prompt copied. Paste it into Flow.", "success");
    } catch {
      notify("Could not access the clipboard.", "error");
    }
  }

  async function copyImagePrompt() {
    if (!imagePrompt) return;
    try {
      await copyText(imagePrompt);
      setCopiedImagePrompt(true);
      window.setTimeout(() => setCopiedImagePrompt(false), 1800);
      notify("Keyframe image prompt copied! Ready to paste into Midjourney, Flux, or Imagen.", "success");
    } catch {
      notify("Could not access the clipboard.", "error");
    }
  }

  async function handleGenerateKeyframe() {
    await act("keyframe-gen", async () => {
      notify(`Generating keyframe image for scene ${scene.n} with AI…`, "info");
      const res = await api<{ path?: string; note?: string }>(
        `/api/scenes/${scene.n}/keyframe`,
        { method: "POST" },
      );
      notify(res.note ? `Keyframe created (${res.note})!` : "Keyframe generated successfully!", "success");
    });
  }

  async function handleSendToFlow() {
    if (!prompt) return;
    setBusy("flow");
    try {
      const isInstalled = isFlowExtensionInstalled();
      if (!isInstalled) {
        await copyText(prompt);
        window.open("https://flow.google.com", "_blank");
        notify(
          "Prompt copied! Load the extension from the 'extension' folder to enable 1-click auto-typing & image uploads in Flow.",
          "info",
        );
        return;
      }

      notify(
        displayImage
          ? "Placing prompt & image into Google Flow…"
          : "Sending prompt to Google Flow…",
        "info",
      );
      const res = await sendToFlow({
        prompt,
        imageUrl: displayImage,
        imageName: isChained
          ? `scene-${scene.n}-start-frame.png`
          : `scene-${scene.n}-keyframe.png`,
        autoRun: !displayImage,
      });

      if (res.success) {
        notify(
          res.message ||
            (displayImage
              ? `Scene ${scene.n} prompt & image placed in Flow!`
              : `Scene ${scene.n} sent to Google Flow!`),
          "success",
        );
      } else {
        notify(res.error || "Failed to send to Google Flow.", "error");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function patchStatus(status: SceneRecord["status"]) {
    await act("status", async () => {
      await api(`/api/scenes/${scene.n}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      notify(
        status === "done" ? `Scene ${scene.n} marked done.` : `Scene ${scene.n} reopened.`,
        "success",
      );
    });
  }

  async function assemblePrompt() {
    await act("assemble", async () => {
      await api(`/api/scenes/${scene.n}/prompt`, { method: "POST" });
      notify(`Prompt assembled for scene ${scene.n}.`, "success");
    });
  }

  async function validate() {
    await act("validate", async () => {
      const result = await api<{ status: string; reasons: string[] }>(
        `/api/scenes/${scene.n}/validate`,
        { method: "POST" },
      );
      notify(
        result.status === "ready"
          ? `Scene ${scene.n} validated and ready.`
          : `Scene ${scene.n} needs attention: ${result.reasons.slice(0, 2).join("; ")}`,
        result.status === "ready" ? "success" : "error",
      );
    });
  }

  async function onClipFile(file: File | null) {
    if (!file) return;
    await act("clip", async () => {
      await upload(`/api/scenes/${scene.n}/clip`, file);
      notify(`Clip uploaded for scene ${scene.n}.`, "success");
      onOpenReview(scene.n);
    });
  }

  async function onKeyframeFile(file: File | null) {
    if (!file) return;
    await act("keyframe", async () => {
      await upload(`/api/scenes/${scene.n}/keyframe`, file);
      notify(`Keyframe uploaded for scene ${scene.n}.`, "success");
    });
  }

  const busyLabel: Record<string, string> = {
    status: "Saving…",
    assemble: "Assembling…",
    validate: "Validating…",
    clip: "Uploading clip…",
    keyframe: "Uploading…",
  };

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-card transition-shadow ${
        open
          ? "border-brand-border shadow-md"
          : "border-border shadow-xs hover:border-muted-foreground/30"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted font-mono text-xs font-semibold tabular-nums text-foreground">
          {String(scene.n).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {scene.action || "Untitled scene"}
            </span>
            {scene.is_establishing ? (
              <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
                Establishing
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{location}</span>
            {visible.length ? <span aria-hidden>·</span> : null}
            {visible.length ? (
              <span className="truncate">
                {visible.map((character) => character?.name).filter(Boolean).join(", ")}
              </span>
            ) : null}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground sm:inline-flex">
          <span
            className={cn("size-1.5 rounded-full", meta.dot)}
            aria-hidden
          />
          {meta.label}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-border px-4 pb-4 pt-4">
          {scene.status === "needs_attention" && scene.reasons.length ? (
            <div className="mb-4 flex gap-2.5 rounded-lg border border-warning/30 bg-warning-subtle p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0 text-xs leading-6 text-foreground">
                <p className="font-semibold text-warning">Needs attention</p>
                <ul className="list-inside list-disc">
                  {scene.reasons.slice(0, 6).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full md:w-56 md:shrink-0">
              <div
                className={`relative overflow-hidden rounded-lg border border-border bg-muted ${
                  data.project.settings.aspectRatio === "9:16"
                    ? "mx-auto aspect-9/16 w-full max-w-48"
                    : "aspect-video"
                }`}
              >
                {displayImage ? (
                  <Image
                    src={displayImage}
                    alt={isChained ? `Start frame from Scene ${scene.chainedFrom ?? scene.n - 1}` : `Keyframe for scene ${scene.n}`}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="220px"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                    {scene.status === "done" ? (
                      <Clapperboard className="size-7 text-muted-foreground" aria-hidden />
                    ) : (
                      <ImagePlus className="size-7 text-muted-foreground" aria-hidden />
                    )}
                    <p className="text-xs font-medium leading-4 text-muted-foreground">
                      No frame yet
                    </p>
                  </div>
                )}
                {isChained ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary/95 px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow">
                    <Link2 className="size-3" aria-hidden />
                    Start frame from Scene {scene.chainedFrom ?? scene.n - 1}
                  </span>
                ) : null}
              </div>
              <div
                className={`mt-2 flex flex-col gap-1.5 ${
                  data.project.settings.aspectRatio === "9:16"
                    ? "mx-auto w-full max-w-48"
                    : "w-full"
                }`}
              >
                {/* Primary Action: Full-width AI Keyframe Button */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8.5 w-full justify-center gap-1.5 border-primary/30 text-xs font-semibold text-primary hover:bg-primary/10"
                  onClick={handleGenerateKeyframe}
                  disabled={Boolean(busy) || !imagePrompt}
                  title="Generate keyframe image using your configured AI image model"
                >
                  {busy === "keyframe-gen" ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-3.5 text-primary" aria-hidden />
                  )}
                  {busy === "keyframe-gen"
                    ? "Generating…"
                    : displayImage
                      ? "Regenerate Keyframe"
                      : "AI Keyframe"}
                </Button>

                {/* Secondary Actions: Clean 3-Button Icon Toolbar */}
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-full justify-center p-0"
                    onClick={copyImagePrompt}
                    disabled={!imagePrompt}
                    title={
                      copiedImagePrompt
                        ? "Copied image prompt!"
                        : "Copy image prompt for Midjourney, Flux, or Imagen"
                    }
                    aria-label="Copy image prompt"
                  >
                    {copiedImagePrompt ? (
                      <Check className="size-3.5 shrink-0 text-success" aria-hidden />
                    ) : (
                      <Copy className="size-3.5 shrink-0" aria-hidden />
                    )}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-full justify-center p-0"
                    onClick={() => keyframeInput.current?.click()}
                    disabled={Boolean(busy)}
                    title="Upload keyframe image from computer"
                    aria-label="Upload keyframe image"
                  >
                    <Upload className="size-3.5 shrink-0" aria-hidden />
                  </Button>

                  {displayImage ? (
                    <a
                      href={displayImage}
                      download={
                        isChained
                          ? `scene-${scene.n}-start-frame-for-flow.png`
                          : `scene-${scene.n}-keyframe.png`
                      }
                      className="inline-flex h-8 w-full items-center justify-center rounded-md border border-border bg-card p-0 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title={
                        isChained
                          ? "Download this frame to use as Start Frame in Flow"
                          : "Download image"
                      }
                      aria-label="Download image"
                    >
                      <Download className="size-3.5 shrink-0" aria-hidden />
                    </a>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled
                      className="h-8 w-full cursor-not-allowed justify-center p-0 opacity-30"
                      title="No image to download"
                      aria-label="Download image (disabled)"
                    >
                      <Download className="size-3.5 shrink-0" aria-hidden />
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={keyframeInput}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => void onKeyframeFile(event.target.files?.[0] ?? null)}
              />
            </div>

            <div className="min-w-0 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface-subtle p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Start state
                  </p>
                  <p className="mt-1 text-xs leading-6 text-foreground">
                    {scene.start_state || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-subtle p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    End state
                  </p>
                  <p className="mt-1 text-xs leading-6 text-foreground">
                    {scene.end_state || "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Film className="size-3.5" aria-hidden />
                  {scene.camera.shot} · {scene.camera.angle} · {scene.camera.movement}
                </span>
                {scene.sound ? <span>Sound: {scene.sound}</span> : null}
              </div>

              {scene.dialogue ? (
                <div className="rounded-lg border border-brand-border bg-brand-subtle p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
                    Dialogue · {speakerNames || dialogueCharacter?.name || scene.dialogue.speaker} ·{" "}
                    {languageLabel(dialogueLanguage)}
                  </p>
                  <p
                    className={`mt-1 text-base leading-7 text-secondary-foreground whitespace-pre-line ${
                      dialogueLanguage === "bn" ? "font-bangla" : ""
                    }`}
                    lang={dialogueLanguage}
                  >
                    “{scene.dialogue.line}”
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 text-xs font-semibold"
                  onClick={handleSendToFlow}
                  disabled={!prompt || busy === "flow"}
                  title={
                    displayImage
                      ? "Auto-inject prompt and attach start frame image into Google Flow"
                      : "Auto-inject prompt into Google Flow"
                  }
                >
                  {busy === "flow" ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-3.5" aria-hidden />
                  )}
                  {busy === "flow"
                    ? "Sending to Flow…"
                    : displayImage
                      ? "🚀 Send to Flow (+Image)"
                      : "🚀 Send to Flow"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={copyPrompt}
                  disabled={!prompt}
                >
                  {copied ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    <Copy className="size-3.5" aria-hidden />
                  )}
                  Copy prompt
                </Button>
                {!prompt ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={assemblePrompt}
                    disabled={Boolean(busy)}
                  >
                    Assemble prompt
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={() => clipInput.current?.click()}
                  disabled={Boolean(busy)}
                >
                  {busy === "clip" ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Upload className="size-3.5" aria-hidden />
                  )}
                  {scene.clipPath ? "Replace clip" : "Upload clip"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={() => onOpenReview(scene.n)}
                >
                  <PlayCircle className="size-3.5" aria-hidden />
                  Review
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={validate}
                  disabled={Boolean(busy)}
                >
                  {busy === "validate" ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ShieldCheck className="size-3.5" aria-hidden />
                  )}
                  Validate
                </Button>
                {scene.status === "done" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-9 text-xs"
                    onClick={() => patchStatus("ready")}
                    disabled={Boolean(busy)}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Reopen
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-9 text-xs"
                    onClick={() => patchStatus("done")}
                    disabled={Boolean(busy)}
                  >
                    <Check className="size-3.5" aria-hidden />
                    Mark done
                  </Button>
                )}
              </div>
              {busy ? (
                <p className="text-xs text-muted-foreground">{busyLabel[busy] ?? "Working…"}</p>
              ) : null}
              <input
                ref={clipInput}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/*"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => void onClipFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Master prompt
                </p>
                {scene.prompt ? (
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    v{scene.prompt.version}
                  </span>
                ) : null}
              </div>
              {imagePrompt ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={async () => {
                    await copyText(imagePrompt);
                    notify("Keyframe prompt copied.", "success");
                  }}
                >
                  <Copy className="size-3.5" aria-hidden />
                  Copy image prompt
                </Button>
              ) : null}
            </div>
            {prompt ? (
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-surface-subtle p-4 font-mono text-xs leading-6 text-foreground">
                {prompt}
              </pre>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-surface-subtle p-5 text-center text-xs text-muted-foreground">
                No prompt assembled for this scene yet.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
