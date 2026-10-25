"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { ToastNotification, type ToastState } from "@/components/toast-notification";
import { StudioHeader } from "@/components/studio/studio-header";
import { StudioSidebar } from "@/components/studio/studio-sidebar";
import { StudioVoiceoverCard } from "@/components/studio/studio-voiceover-card";
import { StudioVisualLockBanner } from "@/components/studio/studio-visual-lock-banner";
import { StudioPromptsCard } from "@/components/studio/studio-prompts-card";
import { StudioEditorCta } from "@/components/studio/studio-editor-cta";
import { StudioPromptCardsList } from "@/components/studio/studio-prompt-cards-list";
import { StudioEmptyState } from "@/components/studio/studio-empty-state";
import { useStudioBatchImages } from "@/components/studio/use-studio-batch-images";
import {
  downloadTextFile,
  formatAllPrompts,
  formatPromptsExport,
} from "@/components/studio/utils";
import { api, ApiError, copyText } from "@/lib/apiClient";
import { isFlowExtensionInstalled, sendToFlow } from "@/lib/flowBridge";
import type { BgmMood, StudioClip, StudioProject } from "@/components/studio/types";

const DEFAULT_STORY = `একটি অন্ধকার পুরোনো ঘড়ির দোকানে বৃদ্ধ কারিগর শামসু কাজ করছিল। টেবিলের ওপর রাখা ছিল একটি পিতলের ছোট মেকানিক্যাল মাকড়সা।
হঠাৎ শামসুর কনুই লেগে চায়ের কাপটি নিচে পড়ে গেল!
শামসু চিৎকার করে পেছনের দেয়ালের বড় লাল লিভারটা টেনে দিল—আর সাথে সাথে সময় পুরোপুরি থমকে গেল!
বাতাসে ছিটকে যাওয়া চা আর গরম বাষ্প মেঝের ওপর পাথরের মতো ভেসে রইল!`;

const INITIAL_PROJECT: StudioProject = {
  id: "studio-default",
  title: "Story to Video",
  story: DEFAULT_STORY,
  stylePreset: "3D Pixar Animation",
  aspectRatio: "9:16",
  defaultClipDuration: 3.0,
  continuousVoiceover: "",
  audioUrl: null,
  audioDuration: 0,
  clips: [],
};

const STORAGE_KEY = "story_to_flow_studio_project";

export default function StudioPage() {
  const [project, setProject] = React.useState<StudioProject>(INITIAL_PROJECT);
  const [openClipId, setOpenClipId] = React.useState<string | null>(null);
  const [isPlanning, setIsPlanning] = React.useState(false);
  const [copiedVoiceover, setCopiedVoiceover] = React.useState(false);
  const [copiedAllPrompts, setCopiedAllPrompts] = React.useState(false);
  const [sendingAllFlow, setSendingAllFlow] = React.useState(false);
  const [showDetailedCards, setShowDetailedCards] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const isInitialMount = React.useRef(true);

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

  const {
    batchFileInputRef,
    isDraggingOver,
    attachedCount,
    handleBatchFileChange,
    handleClearAllImages,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    openBatchFileDialog,
  } = useStudioBatchImages({
    clips: project.clips,
    setProject,
    notify,
  });

  // Load saved project on mount (localStorage for instant UI + server fetch for sync)
  React.useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as StudioProject;
        if (parsed && typeof parsed === "object" && (parsed.story || parsed.clips?.length)) {
          queueMicrotask(() => {
            setProject(parsed);
            if (parsed.clips?.length) {
              setOpenClipId(parsed.clips[0].id);
            }
          });
        }
      }
    } catch {
      // ignore localstorage parse error
    }

    (async () => {
      try {
        const res = await api<{ success: boolean; project: StudioProject | null }>(
          "/api/studio/project",
        );
        if (res.project && (res.project.story || res.project.clips?.length)) {
          setProject(res.project);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(res.project));
          } catch {}
          if (res.project.clips?.length) {
            setOpenClipId(res.project.clips[0].id);
          }
        }
      } catch (err) {
        console.warn("[studio] Could not fetch saved project:", err);
      } finally {
        isInitialMount.current = false;
      }
    })();
  }, []);

  // Auto-save changes to localStorage (immediate) and server (debounced)
  React.useEffect(() => {
    if (isInitialMount.current) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {}

    const timer = window.setTimeout(() => {
      api("/api/studio/project", {
        method: "POST",
        body: JSON.stringify(project),
      }).catch((err) => {
        console.warn("[studio] Auto-save failed:", err);
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [project]);

  const totalDuration = React.useMemo(() => {
    return project.clips.reduce(
      (acc, c) => acc + (c.duration || project.defaultClipDuration || 3.0),
      0,
    );
  }, [project.clips, project.defaultClipDuration]);

  const handlePacingChange = React.useCallback(
    (dur: number) => {
      const updatedClips = project.clips.map((c) => ({
        ...c,
        duration: dur,
      }));
      setProject((prev) => ({
        ...prev,
        defaultClipDuration: dur,
        clips: updatedClips,
      }));
      notify(`Pacing set to ${dur}s per image (${(updatedClips.length * dur).toFixed(0)}s total runtime)!`, "info");
    },
    [project.clips, notify],
  );

  const handleUpdateProject = (patch: Partial<StudioProject>) => {
    setProject((prev) => ({ ...prev, ...patch }));
  };

  const handleUpdateClip = (clipId: string, patch: Partial<StudioClip>) => {
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
    }));
  };

  const handleNewStory = () => {
    if (project.story && !window.confirm("Start a new story? This will clear current text and generated prompts.")) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
      api("/api/studio/project", { method: "DELETE" }).catch(() => {});
    } catch {}
    setProject({
      ...INITIAL_PROJECT,
      story: "",
      clips: [],
      continuousVoiceover: "",
    });
    setOpenClipId(null);
    notify("Cleared! Ready for a new story.", "info");
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
        characterVisualLock?: string;
        environmentVisualLock?: string;
        recommendedBgmMood?: BgmMood;
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
        characterVisualLock: res.characterVisualLock,
        environmentVisualLock: res.environmentVisualLock,
        recommendedBgmMood: res.recommendedBgmMood,
        bgmMood: res.recommendedBgmMood || prev.bgmMood,
        continuousVoiceover: res.continuousVoiceover,
        clips: res.clips,
      }));

      if (res.clips.length > 0) {
        setOpenClipId(res.clips[0].id);
      }

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

  const allPromptsFormatted = React.useMemo(() => {
    return formatAllPrompts(project.clips, project.defaultClipDuration);
  }, [project.clips, project.defaultClipDuration]);

  const handleCopyAllPrompts = async () => {
    if (!project.clips.length) return;
    try {
      await copyText(allPromptsFormatted);
      setCopiedAllPrompts(true);
      window.setTimeout(() => setCopiedAllPrompts(false), 2000);
      notify("All Google Flow prompts copied to clipboard!", "success");
    } catch {
      notify("Could not access clipboard.", "error");
    }
  };

  const handleSendAllToFlow = async () => {
    if (!project.clips.length) return;
    setSendingAllFlow(true);
    notify("Preparing prompts for Google Flow…", "info");

    try {
      await copyText(allPromptsFormatted);

      const isInstalled = isFlowExtensionInstalled();
      if (!isInstalled) {
        window.open("https://flow.google.com", "_blank");
        notify(
          "All prompts copied to clipboard! Load extension from 'extension' folder to automate.",
          "info",
        );
        return;
      }

      const first = project.clips[0];
      const res = await sendToFlow({
        prompt: first.imagePrompt,
        imageUrl: first.imageUrl,
        imageName: "image-1.png",
        autoRun: true,
      });

      if (res.success) {
        notify("All prompts copied & initial prompt placed in Google Flow tab!", "success");
      } else {
        notify(res.error || "All prompts copied! Opened Google Flow tab.", "info");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setSendingAllFlow(false);
    }
  };

  const handleDownloadVoiceover = () => {
    if (!project.continuousVoiceover) return;
    downloadTextFile(project.continuousVoiceover, `${project.title || "story"}-voiceover.txt`);
    notify("Downloaded voiceover script!", "success");
  };

  const handleDownloadPrompts = () => {
    if (!project.clips.length) return;
    const content = formatPromptsExport(project, totalDuration);
    downloadTextFile(content, `${project.title || "story"}-flow-prompts.txt`);
    notify("Downloaded all Flow prompts!", "success");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Header Bar */}
      <StudioHeader
        clipCount={project.clips.length}
        attachedCount={attachedCount}
        onImportAllImages={openBatchFileDialog}
        onClearAllImages={handleClearAllImages}
        onDownloadPrompts={handleDownloadPrompts}
      />

      {/* Main Layout: 2-Column Dashboard */}
      <main className="flex w-full flex-1 flex-col gap-6 p-4 sm:p-6 lg:flex-row">
        {/* Left Column Sidebar: Story & Settings Overview */}
        <StudioSidebar
          story={project.story}
          clipCount={project.clips.length}
          defaultClipDuration={project.defaultClipDuration}
          aspectRatio={project.aspectRatio}
          stylePreset={project.stylePreset}
          isPlanning={isPlanning}
          onUpdateStory={(story) => handleUpdateProject({ story })}
          onNewStory={handleNewStory}
          onPacingChange={handlePacingChange}
          onAspectRatioChange={(aspectRatio) => handleUpdateProject({ aspectRatio })}
          onStylePresetChange={(stylePreset) => handleUpdateProject({ stylePreset })}
          onPlanStory={handlePlanStory}
        />

        {/* Right Main Column: Output Section */}
        <section
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="min-w-0 flex-1 space-y-4"
        >
          {/* Top Card: Complete Voiceover Script */}
          {project.continuousVoiceover ? (
            <StudioVoiceoverCard
              voiceover={project.continuousVoiceover}
              totalDuration={totalDuration}
              clipCount={project.clips.length}
              defaultClipDuration={project.defaultClipDuration}
              copiedVoiceover={copiedVoiceover}
              onCopyVoiceover={handleCopyVoiceover}
              onDownloadVoiceover={handleDownloadVoiceover}
            />
          ) : null}

          {/* Character Visual Lock Banner */}
          {project.characterVisualLock ? (
            <StudioVisualLockBanner characterVisualLock={project.characterVisualLock} />
          ) : null}

          {/* Sequential Image Prompts Card */}
          {project.clips.length > 0 ? (
            <StudioPromptsCard
              clipCount={project.clips.length}
              totalDuration={totalDuration}
              aspectRatio={project.aspectRatio}
              attachedCount={attachedCount}
              allPromptsFormatted={allPromptsFormatted}
              sendingAllFlow={sendingAllFlow}
              copiedAllPrompts={copiedAllPrompts}
              showDetailedCards={showDetailedCards}
              onSendAllToFlow={handleSendAllToFlow}
              onCopyAllPrompts={handleCopyAllPrompts}
              onDownloadPrompts={handleDownloadPrompts}
              onToggleDetailedCards={() => setShowDetailedCards((s) => !s)}
            />
          ) : null}

          {/* Drag & Drop Visual Indicator */}
          {isDraggingOver ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5 py-10 text-center animate-pulse">
              <Upload className="size-8 text-primary" />
              <p className="mt-2 text-sm font-semibold text-primary">
                Drop images here to auto-assign across clips!
              </p>
              <p className="text-2xs text-muted-foreground">
                Matches by numbers in filenames (e.g. image-1.png, 02.png) or sequential order
              </p>
            </div>
          ) : null}

          {/* CapCut-Style Video Editor entry point (dedicated full-width page) */}
          {project.clips.length > 0 ? (
            <StudioEditorCta project={project} totalDuration={totalDuration} />
          ) : null}

          {/* Optional Detailed Prompt Cards View */}
          {project.clips.length > 0 && showDetailedCards ? (
            <StudioPromptCardsList
              clips={project.clips}
              defaultClipDuration={project.defaultClipDuration}
              aspectRatio={project.aspectRatio}
              openClipId={openClipId}
              onToggleClip={(id) => setOpenClipId((curr) => (curr === id ? null : id))}
              onUpdateClip={handleUpdateClip}
              notify={notify}
            />
          ) : null}

          {/* Empty Placeholder */}
          {project.clips.length === 0 ? (
            <StudioEmptyState
              story={project.story}
              isPlanning={isPlanning}
              onPlanStory={handlePlanStory}
            />
          ) : null}
        </section>
      </main>

      <input
        ref={batchFileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="sr-only"
        onChange={handleBatchFileChange}
      />

      <ToastNotification toast={toast} />
    </div>
  );
}