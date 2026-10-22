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
import { api, ApiError, copyText, fileUrl, STATUS_META, upload } from "@/lib/apiClient";
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
  const prompt = scene.prompt?.text ?? "";
  const imagePrompt = scene.prompt?.imagePrompt ?? "";
  const dialogueCharacter = scene.dialogue
    ? data.characters.find((character) => character.id === scene.dialogue?.speaker)
    : undefined;
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

  async function generateKeyframe() {
    await act("generate", async () => {
      const result = await api<{ note?: string }>(`/api/scenes/${scene.n}/keyframe`, {
        method: "POST",
        body: JSON.stringify({ generate: true }),
      });
      notify(result.note ? `Keyframe generated (${result.note}).` : "Keyframe generated.", "success");
    });
  }

  const busyLabel: Record<string, string> = {
    status: "Saving…",
    assemble: "Assembling…",
    validate: "Validating…",
    clip: "Uploading clip…",
    keyframe: "Uploading…",
    generate: "Generating…",
  };

  return (
    <article
      className={`overflow-hidden rounded-[12px] border bg-card transition-shadow ${
        open
          ? "border-[#b9cbc8] shadow-[0_2px_4px_rgba(20,32,43,0.04),0_16px_40px_-24px_rgba(15,118,110,0.35)]"
          : "border-border card-shadow hover:border-[#c4ced6]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/20"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-[#f8fafb] font-mono text-xs font-semibold tabular-nums text-[#3f4d5a]">
          {String(scene.n).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {scene.action || "Untitled scene"}
            </span>
            {scene.is_establishing ? (
              <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
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
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-[#3f4d5a] sm:inline-flex">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: meta.dot }}
            aria-hidden
          />
          {meta.label}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-border px-4 pb-4 pt-4">
          {scene.status === "needs_attention" && scene.reasons.length ? (
            <div className="mb-4 flex gap-2.5 rounded-[10px] border border-[#f0d9a8] bg-[#fff9ec] p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]" aria-hidden />
              <div className="min-w-0 text-[13px] leading-6 text-[#7a4b05]">
                <p className="font-semibold">Needs attention</p>
                <ul className="list-inside list-disc">
                  {scene.reasons.slice(0, 6).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <div
                className={`relative overflow-hidden rounded-[10px] border border-border bg-[#e9edf0] ${
                  data.project.settings.aspectRatio === "9:16"
                    ? "mx-auto aspect-[9/16] w-full max-w-[190px]"
                    : "aspect-video"
                }`}
              >
                {keyframe ? (
                  <Image
                    src={keyframe}
                    alt={`Keyframe for scene ${scene.n}`}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="220px"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                    {scene.status === "done" ? (
                      <Clapperboard className="h-7 w-7 text-[#8a99a8]" aria-hidden />
                    ) : (
                      <ImagePlus className="h-7 w-7 text-[#8a99a8]" aria-hidden />
                    )}
                    <p className="text-[11px] font-medium leading-4 text-[#68798a]">
                      No keyframe yet
                    </p>
                  </div>
                )}
                {scene.chainedFrom || scene.startFramePath ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#0b4f4a]/90 px-2 py-1 text-[10px] font-semibold text-white shadow">
                    <Link2 className="h-3 w-3" aria-hidden />
                    Chained from Scene {scene.chainedFrom ?? scene.n - 1}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={() => keyframeInput.current?.click()}
                  disabled={Boolean(busy)}
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden />
                  Keyframe
                </Button>
                {data.project.settings.imageProvider === "omniroute" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={generateKeyframe}
                    disabled={Boolean(busy)}
                  >
                    {busy === "generate" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Generate
                  </Button>
                ) : null}
                {keyframe ? (
                  <a
                    href={keyframe}
                    download={`scene-${scene.n}-keyframe`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[8px] px-2.5 text-xs font-medium text-[#0b5f58] underline-offset-4 hover:bg-[#e6f4f1] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Download
                  </a>
                ) : null}
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
                <div className="rounded-[10px] border border-border bg-[#fbfcfd] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Start state
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-[#283643]">
                    {scene.start_state || "—"}
                  </p>
                </div>
                <div className="rounded-[10px] border border-border bg-[#fbfcfd] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    End state
                  </p>
                  <p className="mt-1 text-[13px] leading-6 text-[#283643]">
                    {scene.end_state || "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Film className="h-3.5 w-3.5" aria-hidden />
                  {scene.camera.shot} · {scene.camera.angle} · {scene.camera.movement}
                </span>
                {scene.sound ? <span>Sound: {scene.sound}</span> : null}
              </div>

              {scene.dialogue ? (
                <div className="rounded-[10px] border border-[#cfe6e2] bg-[#f2faf8] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b5f58]">
                    Dialogue · {dialogueCharacter?.name ?? scene.dialogue.speaker} ·{" "}
                    {languageLabel(dialogueLanguage)}
                  </p>
                  <p
                    className={`mt-1 text-[15px] leading-7 text-[#173d39] ${
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
                  className="h-9 text-xs"
                  onClick={copyPrompt}
                  disabled={!prompt}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
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
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Upload className="h-3.5 w-3.5" aria-hidden />
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
                  <PlayCircle className="h-3.5 w-3.5" aria-hidden />
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
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
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
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
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
                    <Check className="h-3.5 w-3.5" aria-hidden />
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Master prompt
                </p>
                {scene.prompt ? (
                  <span className="rounded-full border border-border bg-white px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    v{scene.prompt.version}
                  </span>
                ) : null}
              </div>
              {imagePrompt ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-[11px]"
                  onClick={async () => {
                    await copyText(imagePrompt);
                    notify("Keyframe prompt copied.", "success");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Copy image prompt
                </Button>
              ) : null}
            </div>
            {prompt ? (
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-border bg-[#fbfcfd] p-4 font-mono text-[12.5px] leading-6 text-[#24313d]">
                {prompt}
              </pre>
            ) : (
              <div className="rounded-[10px] border border-dashed border-[#c4ced6] bg-[#fbfcfd] p-5 text-center text-[13px] text-muted-foreground">
                No prompt assembled for this scene yet.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
