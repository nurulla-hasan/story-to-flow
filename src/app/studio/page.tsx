"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Copy,
  Download,
  FileText,
  Loader2,
  Mic,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SimpleSelect } from "@/components/simple-select";
import { ToastNotification, type ToastState } from "@/components/toast-notification";
import { CleanPromptCard } from "@/components/studio/clean-prompt-card";
import { copyText } from "@/lib/apiClient";
import { cn } from "cn";
import {
  STUDIO_STYLE_PRESETS,
  type StudioClip,
  type StudioProject,
} from "@/components/studio/types";
import { api, ApiError } from "@/lib/apiClient";

const INITIAL_PROJECT: StudioProject = {
  id: "studio-default",
  title: "Untitled Story",
  story: `একটি অন্ধকার পুরোনো ঘড়ির দোকানে বৃদ্ধ কারিগর শামসু কাজ করছিল। টেবিলের ওপর রাখা ছিল একটি পিতলের ছোট মেকানিক্যাল মাকড়সা।
হঠাৎ শামসুর কনুই লেগে চায়ের কাপটি নিচে পড়ে গেল!
শামসু চিৎকার করে পেছনের দেয়ালের বড় লাল লিভারটা টেনে দিল—আর সাথে সাথে সময় পুরোপুরি থমকে গেল!
বাতাসে ছিটকে যাওয়া চা আর গরম বাষ্প মেঝের ওপর পাথরের মতো ভেসে রইল!`,
  stylePreset: "3D Pixar Animation",
  aspectRatio: "9:16",
  defaultClipDuration: 3.0,
  continuousVoiceover: "",
  audioUrl: null,
  audioDuration: 0,
  clips: [],
};

export default function StudioPage() {
  const [project, setProject] = React.useState<StudioProject>(INITIAL_PROJECT);
  const [isPlanning, setIsPlanning] = React.useState(false);
  const [copiedVoiceover, setCopiedVoiceover] = React.useState(false);
  const [copiedAllPrompts, setCopiedAllPrompts] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const notify = React.useCallback(
    (message: string, kind: "info" | "error" | "success" = "info") => {
      const id = Date.now();
      setToast({ id, message, kind });
      window.setTimeout(() => {
        setToast((curr) => (curr?.id === id ? null : curr));
      }, 4000);
    },
    [],
  );

  const totalDuration = React.useMemo(() => {
    return project.clips.reduce((acc, c) => acc + c.duration, 0);
  }, [project.clips]);

  const handleUpdateProject = (patch: Partial<StudioProject>) => {
    setProject((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdateClip = (clipId: string, patch: Partial<StudioClip>) => {
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
    }));
  };

  const handlePlanStory = async () => {
    if (!project.story.trim()) {
      notify("Please paste a story first.", "error");
      return;
    }
    setIsPlanning(true);
    notify("Planning sequential image prompts & voiceover script…", "info");

    try {
      const res = await api<{
        title: string;
        continuousVoiceover: string;
        clips: StudioClip[];
      }>("/api/studio/plan", {
        method: "POST",
        body: JSON.stringify({
          story: project.story,
          clipDuration: project.defaultClipDuration,
          stylePreset: project.stylePreset,
          aspectRatio: project.aspectRatio,
        }),
      });

      setProject((prev) => ({
        ...prev,
        title: res.title || prev.title,
        continuousVoiceover: res.continuousVoiceover,
        clips: res.clips,
      }));

      notify(`Created ${res.clips.length} sequential image prompts & voiceover!`, "success");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : String(err), "error");
    } finally {
      setIsPlanning(false);
    }
  };

  const handleCopyVoiceover = async () => {
    if (!project.continuousVoiceover) return;
    try {
      await copyText(project.continuousVoiceover);
      setCopiedVoiceover(true);
      window.setTimeout(() => setCopiedVoiceover(false), 2000);
      notify("Voiceover text copied! Ready to paste into CapCut TTS.", "success");
    } catch {
      notify("Could not access clipboard.", "error");
    }
  };

  const handleCopyAllPrompts = async () => {
    if (!project.clips.length) return;
    const all = project.clips
      .map(
        (c) =>
          `IMAGE #${String(c.index).padStart(2, "0")} (${c.duration}s)\nVOICEOVER: ${c.narration}\nPROMPT: ${c.imagePrompt}\n`,
      )
      .join("\n" + "=".repeat(60) + "\n\n");
    try {
      await copyText(all);
      setCopiedAllPrompts(true);
      window.setTimeout(() => setCopiedAllPrompts(false), 2000);
      notify("All Google Flow prompts copied to clipboard!", "success");
    } catch {
      notify("Could not access clipboard.", "error");
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadVoiceover = () => {
    if (!project.continuousVoiceover) return;
    downloadFile(project.continuousVoiceover, `${project.title || "story"}-voiceover.txt`);
    notify("Downloaded voiceover script!", "success");
  };

  const handleDownloadPrompts = () => {
    if (!project.clips.length) return;
    const content =
      `STORY TO FLOW — PROMPT LIST\n` +
      `Title: ${project.title}\n` +
      `Total Images: ${project.clips.length} (~${totalDuration.toFixed(0)}s)\n` +
      `Aspect Ratio: ${project.aspectRatio}\n` +
      `Art Style: ${project.stylePreset}\n\n` +
      project.clips
        .map(
          (c) =>
            `IMAGE #${String(c.index).padStart(2, "0")}\n` +
            `Narration: ${c.narration}\n` +
            `Flow Prompt: ${c.imagePrompt}\n`,
        )
        .join("\n" + "-".repeat(60) + "\n\n");

    downloadFile(content, `${project.title || "story"}-flow-prompts.txt`);
    notify("Downloaded all Flow prompts!", "success");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xs">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Return to Video Prompt Planner"
            >
              <ArrowLeft className="size-4" />
            </Link>

            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-xs tracking-wider text-primary-foreground shadow-xs">
              STF
            </span>

            <div>
              <h1 className="text-sm font-bold tracking-tight">Story-to-Video Studio</h1>
              <p className="hidden text-2xs text-muted-foreground sm:block">
                Continuous Voiceover Script & Sequential Google Flow Image Prompts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Clapperboard className="size-3.5" />
              <span className="hidden sm:inline">Flow Prompts</span>
            </Link>

            {project.clips.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDownloadPrompts}
                className="h-8 gap-1.5 text-xs"
                title="Download all image prompts as a formatted .txt file"
              >
                <FileText className="size-3.5" />
                <span className="hidden sm:inline">Download Prompts</span>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Content Area: Spacious & Clean Container */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-6">
        {/* Top Section: Story Input & Settings Card */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wand2 className="size-4" />
              </span>
              <CardTitle className="text-sm font-bold">1. Paste Story</CardTitle>
            </div>
            {project.clips.length > 0 ? (
              <span className="font-mono text-2xs font-semibold text-primary">
                {project.clips.length} images ready (~{totalDuration.toFixed(0)}s)
              </span>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-4">
            <Textarea
              value={project.story}
              onChange={(e) => handleUpdateProject({ story: e.target.value })}
              placeholder="Paste your story here (Bangla or English)..."
              rows={5}
              className="text-xs leading-6"
            />

            {/* Quick Settings: Pacing, Aspect Ratio, Art Style */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pacing (Seconds Per Image)
                </label>
                <div className="mt-1 flex items-center gap-1">
                  {[2.5, 3.0, 4.0, 5.0].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => handleUpdateProject({ defaultClipDuration: dur })}
                      className={cn(
                        "flex-1 rounded py-1 font-mono text-2xs transition-colors",
                        project.defaultClipDuration === dur
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {dur}s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Aspect Ratio
                </label>
                <div className="mt-1 flex items-center gap-1">
                  {(["9:16", "16:9"] as const).map((aspect) => (
                    <button
                      key={aspect}
                      type="button"
                      onClick={() => handleUpdateProject({ aspectRatio: aspect })}
                      className={cn(
                        "flex-1 rounded py-1 font-mono text-2xs transition-colors",
                        project.aspectRatio === aspect
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                      title={
                        aspect === "9:16"
                          ? "Vertical 9:16 for Shorts / TikTok / Reels"
                          : "Widescreen 16:9 for YouTube"
                      }
                    >
                      {aspect === "9:16" ? "9:16 (Shorts)" : "16:9 (YT)"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Visual Art Style
                </label>
                <SimpleSelect
                  value={project.stylePreset}
                  onValueChange={(val) => handleUpdateProject({ stylePreset: val })}
                  options={STUDIO_STYLE_PRESETS.map((preset) => ({
                    value: preset,
                    label: preset,
                  }))}
                  className="mt-1 h-7.5 text-2xs"
                />
              </div>
            </div>

            {/* Primary Action Button */}
            <Button
              type="button"
              onClick={handlePlanStory}
              disabled={!project.story.trim() || isPlanning}
              className="h-10 w-full gap-2 text-sm font-semibold"
            >
              {isPlanning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4 fill-current" />
              )}
              {isPlanning
                ? "Planning Voiceover & Flow Prompts…"
                : "✨ Generate Full Voiceover & Flow Prompts"}
            </Button>
          </CardContent>
        </Card>

        {/* Section 1: Full Voiceover Paragraph Box (Top) */}
        {project.continuousVoiceover ? (
          <div className="rounded-xl border border-primary/30 bg-card p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mic className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    2. Complete Story Voiceover Paragraph
                  </h2>
                  <p className="text-2xs text-muted-foreground">
                    Continuous narration text for CapCut Text-to-Speech (TTS) or reading into a mic
                  </p>
                </div>
              </div>

              {/* Action Buttons: Copy & Download */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCopyVoiceover}
                  className="h-8 gap-1.5 px-3 text-xs font-semibold"
                >
                  {copiedVoiceover ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copiedVoiceover ? "Copied Script!" : "Copy for CapCut TTS"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadVoiceover}
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  title="Download voiceover as .txt"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">.txt</span>
                </Button>
              </div>
            </div>

            {/* Continuous Voiceover Text View */}
            <div className="rounded-lg border border-border bg-brand-subtle/50 p-4 font-bangla text-base leading-relaxed text-secondary-foreground whitespace-pre-line select-all">
              {project.continuousVoiceover}
            </div>

            <div className="flex items-center justify-between text-2xs text-muted-foreground pt-1">
              <span>
                Total Runtime: ~{totalDuration.toFixed(0)} seconds ({project.clips.length} images @{" "}
                {project.defaultClipDuration}s each)
              </span>
              <span>Language: Bangla</span>
            </div>
          </div>
        ) : null}

        {/* Section 2: Sequential Image Cards for Google Flow (Bottom) */}
        {project.clips.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  3. Google Flow Image Prompts ({project.clips.length} Images)
                </h2>
                <p className="text-2xs text-muted-foreground">
                  Click 🚀 Send to Flow on each card to generate images for free on Google Flow!
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyAllPrompts}
                className="h-8 gap-1.5 text-xs"
              >
                {copiedAllPrompts ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                {copiedAllPrompts ? "Copied All Prompts!" : "Copy All Prompts"}
              </Button>
            </div>

            {/* Sequential List of Clean Cards */}
            <div className="space-y-3">
              {project.clips.map((clip, idx) => {
                const startTime = idx * clip.duration;
                const endTime = (idx + 1) * clip.duration;

                return (
                  <CleanPromptCard
                    key={clip.id}
                    clip={clip}
                    totalClips={project.clips.length}
                    aspectRatio={project.aspectRatio}
                    startTime={startTime}
                    endTime={endTime}
                    onUpdateClip={(patch) => handleUpdateClip(clip.id, patch)}
                    notify={notify}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </main>

      <ToastNotification toast={toast} />
    </div>
  );
}
