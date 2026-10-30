"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import type { StoryProcessResponse } from "@/lib/validation";
import { parseProductionPackage } from "@/lib/output-parser";
import { useSelectedModel } from "@/lib/model-storage";
import { useProductionSettings } from "@/lib/settings-storage";
import {
  useStudioStorage,
  saveStoredResult,
  saveStoredStudioData,
  clearStoredStudioState,
} from "@/lib/studio-storage";
import { stripMarkdownCodeFence } from "@/lib/voiceover-cleaner";
import { StoryInputCard } from "@/components/studio/story-input-card";
import { StudioStepper } from "@/components/studio/studio-stepper";
import { VoiceoverScriptCard } from "@/components/studio/voiceover-script-card";
import { CartesiaDurationCard } from "@/components/studio/cartesia-duration-card";
import { StudioSettingsBar } from "@/components/studio/studio-settings-bar";
import { OutputCard } from "@/components/studio/output-card";
import { HowItWorksCard } from "@/components/studio/how-it-works-card";
import { OutputFormatCard } from "@/components/studio/output-format-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogMedia,
} from "@/components/ui/alert-dialog";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  Square,
  AlertTriangle,
  RotateCcw,
  FileText,
  Mic,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Film,
  Trash2,
} from "lucide-react";

function formatSeconds(sec: number): string {
  const mins = Math.floor(sec / 60);
  const remaining = sec % 60;
  return `${mins}:${remaining.toString().padStart(2, "0")}`;
}

function getProgressPhase(
  sec: number,
  phase: "voiceover" | "scenes" | null,
): string {
  if (phase === "voiceover") {
    if (sec < 6) return "Analyzing story tone & emotional arc...";
    if (sec < 18) return "Crafting natural Bangladeshi Bengali narration...";
    return "Polishing voiceover cadence for Cartesia speech...";
  }
  if (sec < 6)
    return "Aligning visual beats with measured voiceover duration...";
  if (sec < 18) return "Engineering visual scene compositions & shot modes...";
  if (sec < 45)
    return "Generating cinematic prompts & lighting instructions...";
  return "Finalizing complete scene & shot package...";
}

export default function StudioPage() {
  const { selectedModel } = useSelectedModel();
  const { settings: prodSettings, updateSetting } = useProductionSettings();
  const storedStudio = useStudioStorage();

  // Local state with fallback to persistent storage
  const [localInputMode, setLocalInputMode] = useState<
    "story" | "direct-voiceover" | null
  >(null);
  const [localStory, setLocalStory] = useState<string | null>(null);
  const [localVoiceoverScript, setLocalVoiceoverScript] = useState<
    string | null
  >(null);
  const [localMinutes, setLocalMinutes] = useState<string | null>(null);
  const [localSeconds, setLocalSeconds] = useState<string | null>(null);
  const [localStage, setLocalStage] = useState<number | null>(null);
  const [localResult, setLocalResult] = useState<
    StoryProcessResponse | null | undefined
  >(undefined);

  const inputMode: "story" | "direct-voiceover" =
    localInputMode !== null
      ? localInputMode
      : storedStudio.inputMode ||
        (storedStudio.voiceoverScript && !storedStudio.story
          ? "direct-voiceover"
          : "story");

  const story = localStory !== null ? localStory : storedStudio.story;
  const voiceoverScript =
    localVoiceoverScript !== null
      ? localVoiceoverScript
      : storedStudio.voiceoverScript || "";
  const minutes =
    localMinutes !== null
      ? localMinutes
      : storedStudio.voiceoverDurationMinutes || "";
  const seconds =
    localSeconds !== null
      ? localSeconds
      : storedStudio.voiceoverDurationSeconds || "";
  const currentStage =
    localStage !== null ? localStage : storedStudio.currentStage || 1;
  const result =
    localResult !== undefined ? localResult : storedStudio.lastResult;

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<
    "voiceover" | "scenes" | null
  >(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  const storySaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voiceoverSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Live timer during active generation
  useEffect(() => {
    if (!isGenerating) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  // Cleanup timers & abort controller on unmount
  useEffect(() => {
    return () => {
      if (storySaveTimeoutRef.current)
        clearTimeout(storySaveTimeoutRef.current);
      if (voiceoverSaveTimeoutRef.current)
        clearTimeout(voiceoverSaveTimeoutRef.current);
      if (durationSaveTimeoutRef.current)
        clearTimeout(durationSaveTimeoutRef.current);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Calculate actual voiceover duration in seconds
  const actualVoiceoverDuration = useMemo(() => {
    const m = parseFloat(minutes) || 0;
    const s = parseFloat(seconds) || 0;
    const total = m * 60 + s;
    return total > 0 ? parseFloat(total.toFixed(2)) : null;
  }, [minutes, seconds]);

  // Mode switcher handler
  const handleSwitchMode = (mode: "story" | "direct-voiceover") => {
    setLocalInputMode(mode);
    setValidationError(null);
    setError(null);

    if (mode === "direct-voiceover") {
      if (currentStage === 1) {
        setLocalStage(2);
      }
    } else {
      if (!voiceoverScript.trim()) {
        setLocalStage(1);
      }
    }

    saveStoredStudioData({
      inputMode: mode,
      currentStage:
        mode === "direct-voiceover" && currentStage === 1 ? 2 : currentStage,
    });
  };

  const handleStageClick = (stg: number) => {
    if (stg === 1 && inputMode === "direct-voiceover") {
      handleSwitchMode("story");
    } else if (stg === 2 && inputMode === "story" && !voiceoverScript.trim()) {
      handleSwitchMode("direct-voiceover");
    } else {
      setLocalStage(stg);
    }
  };

  // Debounced story input auto-save with downstream state invalidation
  const handleStoryChange = (val: string) => {
    setLocalStory(val);
    setValidationError(null);

    // Cancel all pending auto-save timers to prevent race conditions
    if (storySaveTimeoutRef.current) clearTimeout(storySaveTimeoutRef.current);
    if (voiceoverSaveTimeoutRef.current)
      clearTimeout(voiceoverSaveTimeoutRef.current);
    if (durationSaveTimeoutRef.current)
      clearTimeout(durationSaveTimeoutRef.current);

    if (inputMode === "story") {
      // Invalidate downstream voiceover script, measured duration, and scenes
      setLocalVoiceoverScript("");
      setLocalMinutes("");
      setLocalSeconds("");
      setLocalResult(null);
      setLocalStage(1);

      storySaveTimeoutRef.current = setTimeout(() => {
        saveStoredStudioData({
          story: val,
          voiceoverScript: "",
          voiceoverDurationMinutes: "",
          voiceoverDurationSeconds: "",
          actualVoiceoverDuration: null,
          lastResult: null,
          currentStage: 1,
          inputMode: "story",
        });
      }, 400);
    } else {
      storySaveTimeoutRef.current = setTimeout(() => {
        saveStoredStudioData({
          story: val,
          inputMode: "direct-voiceover",
        });
      }, 400);
    }
  };

  const handleClear = () => {
    if (storySaveTimeoutRef.current) clearTimeout(storySaveTimeoutRef.current);
    if (voiceoverSaveTimeoutRef.current)
      clearTimeout(voiceoverSaveTimeoutRef.current);
    if (durationSaveTimeoutRef.current)
      clearTimeout(durationSaveTimeoutRef.current);

    setLocalStory("");
    if (inputMode === "story") {
      setLocalVoiceoverScript("");
      setLocalMinutes("");
      setLocalSeconds("");
      setLocalResult(null);
      setLocalStage(1);
    }
    setValidationError(null);

    saveStoredStudioData({
      story: "",
      ...(inputMode === "story"
        ? {
            voiceoverScript: "",
            voiceoverDurationMinutes: "",
            voiceoverDurationSeconds: "",
            actualVoiceoverDuration: null,
            lastResult: null,
            currentStage: 1,
            inputMode: "story",
          }
        : {
            inputMode: "direct-voiceover",
          }),
    });
  };

  const handleClearVoiceover = () => {
    if (voiceoverSaveTimeoutRef.current)
      clearTimeout(voiceoverSaveTimeoutRef.current);
    if (durationSaveTimeoutRef.current)
      clearTimeout(durationSaveTimeoutRef.current);

    setLocalVoiceoverScript("");
    setLocalMinutes("");
    setLocalSeconds("");
    setLocalResult(null);
    setLocalStage(inputMode === "direct-voiceover" ? 2 : 1);
    setError(null);

    saveStoredStudioData({
      voiceoverScript: "",
      voiceoverDurationMinutes: "",
      voiceoverDurationSeconds: "",
      actualVoiceoverDuration: null,
      lastResult: null,
      currentStage: inputMode === "direct-voiceover" ? 2 : 1,
      inputMode,
    });
  };

  // Voiceover script change handler with downstream duration and scene invalidation
  const handleVoiceoverChange = (val: string) => {
    setLocalVoiceoverScript(val);

    // Editing voiceover invalidates previously measured duration and generated scenes
    setLocalMinutes("");
    setLocalSeconds("");
    setLocalResult(null);
    setLocalStage(2);

    if (voiceoverSaveTimeoutRef.current)
      clearTimeout(voiceoverSaveTimeoutRef.current);
    if (durationSaveTimeoutRef.current)
      clearTimeout(durationSaveTimeoutRef.current);

    voiceoverSaveTimeoutRef.current = setTimeout(() => {
      saveStoredStudioData({
        voiceoverScript: val,
        voiceoverDurationMinutes: "",
        voiceoverDurationSeconds: "",
        actualVoiceoverDuration: null,
        lastResult: null,
        currentStage: 2,
        inputMode,
      });
    }, 400);
  };

  // Duration changes handlers with scene invalidation
  const handleMinutesChange = (val: string) => {
    setLocalMinutes(val);
    const m = parseFloat(val) || 0;
    const s = parseFloat(seconds) || 0;
    const total = m * 60 + s;

    // Changing duration invalidates scenes generated for previous duration
    setLocalResult(null);
    setLocalStage(3);

    if (durationSaveTimeoutRef.current)
      clearTimeout(durationSaveTimeoutRef.current);
    durationSaveTimeoutRef.current = setTimeout(() => {
      saveStoredStudioData({
        voiceoverDurationMinutes: val,
        actualVoiceoverDuration:
          total > 0 ? parseFloat(total.toFixed(2)) : null,
        lastResult: null,
        currentStage: 3,
      });
    }, 300);
  };

  const handleSecondsChange = (val: string) => {
    setLocalSeconds(val);
    const m = parseFloat(minutes) || 0;
    const s = parseFloat(val) || 0;
    const total = m * 60 + s;

    // Changing duration invalidates scenes generated for previous duration
    setLocalResult(null);
    setLocalStage(3);

    if (durationSaveTimeoutRef.current)
      clearTimeout(durationSaveTimeoutRef.current);
    durationSaveTimeoutRef.current = setTimeout(() => {
      saveStoredStudioData({
        voiceoverDurationSeconds: val,
        actualVoiceoverDuration:
          total > 0 ? parseFloat(total.toFixed(2)) : null,
        lastResult: null,
        currentStage: 3,
      });
    }, 300);
  };

  // STAGE 1 ACTION: Generate Master Voiceover Script Only
  const handleGenerateVoiceover = async () => {
    if (!story.trim()) {
      setValidationError(
        "Please enter your story first to generate the voiceover script.",
      );
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++requestIdRef.current;

    setError(null);
    setValidationError(null);
    setCancelNotice(null);
    setElapsedSeconds(0);
    setIsGenerating(true);
    setGenerationPhase("voiceover");

    try {
      const response = await fetch("/api/story/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          story,
          stage: "voiceover",
          settings: {
            model: selectedModel,
            visualStyle: prodSettings.visualStyle,
            aspectRatio: prodSettings.aspectRatio,
            staticFramePacing: prodSettings.staticFramePacing,
            visualAssetMode: prodSettings.visualAssetMode,
            videoSoundMode: prodSettings.videoSoundMode,
          },
        }),
      });

      if (requestIdRef.current !== currentRequestId) return;

      const data = await response.json();

      if (!response.ok) {
        if (data.cancelled || response.status === 499) {
          setCancelNotice("Voiceover script generation was stopped.");
          return;
        }
        setError(data.error || "Failed to generate voiceover script.");
        return;
      }

      // Extract raw voiceover script and defensively strip any Markdown code fences
      const scriptText = stripMarkdownCodeFence(data.response || "");
      setLocalVoiceoverScript(scriptText);
      setLocalMinutes("");
      setLocalSeconds("");
      setLocalResult(null);
      setLocalStage(2); // Advance to Voiceover Script Review stage
      saveStoredStudioData({
        voiceoverScript: scriptText,
        voiceoverDurationMinutes: "",
        voiceoverDurationSeconds: "",
        actualVoiceoverDuration: null,
        lastResult: null,
        currentStage: 2,
      });
    } catch (err) {
      if (requestIdRef.current !== currentRequestId) return;
      if (err instanceof Error && err.name === "AbortError") {
        setCancelNotice("Generation was stopped.");
        return;
      }
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsGenerating(false);
        setGenerationPhase(null);
        abortControllerRef.current = null;
      }
    }
  };

  // STAGE 4 ACTION: Generate Scene & Shot Prompts with Measured Duration
  const handleGenerateScenes = async () => {
    if (inputMode === "story" && !story.trim() && !voiceoverScript.trim()) {
      setValidationError(
        "Please enter your story first to generate the voiceover script.",
      );
      return;
    }
    if (!voiceoverScript.trim()) {
      setError(
        "Please enter or generate a voiceover script before generating scenes.",
      );
      return;
    }
    if (!actualVoiceoverDuration || actualVoiceoverDuration <= 0) {
      setError(
        "Please enter the actual voiceover duration measured from Cartesia.",
      );
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++requestIdRef.current;

    setError(null);
    setValidationError(null);
    setCancelNotice(null);
    setElapsedSeconds(0);
    setIsGenerating(true);
    setGenerationPhase("scenes");

    try {
      const response = await fetch("/api/story/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          story: story?.trim() || "",
          stage: "scenes",
          voiceoverScript: voiceoverScript.trim(),
          actualVoiceoverDuration,
          settings: {
            model: selectedModel,
            visualStyle: prodSettings.visualStyle,
            aspectRatio: prodSettings.aspectRatio,
            staticFramePacing: prodSettings.staticFramePacing,
            videoAssetDuration: prodSettings.videoAssetDuration,
            visualAssetMode: prodSettings.visualAssetMode,
            videoSoundMode: prodSettings.videoSoundMode,
          },
        }),
      });

      if (requestIdRef.current !== currentRequestId) return;

      const data = await response.json();

      if (!response.ok) {
        if (data.cancelled || response.status === 499) {
          setCancelNotice("Scene generation was stopped.");
          return;
        }
        setError(data.error || "Failed to generate scene & shot prompts.");
        return;
      }

      setLocalResult(data);
      setLocalStage(4); // Advance to Final Scene Prompts stage
      saveStoredResult(data);
      saveStoredStudioData({ currentStage: 4, lastResult: data });
    } catch (err) {
      if (requestIdRef.current !== currentRequestId) return;
      if (err instanceof Error && err.name === "AbortError") {
        setCancelNotice("Generation was stopped.");
        return;
      }
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsGenerating(false);
        setGenerationPhase(null);
        abortControllerRef.current = null;
      }
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setGenerationPhase(null);
    setElapsedSeconds(0);
    setCancelNotice("Generation was stopped.");
    setTimeout(() => {
      setCancelNotice((prev) =>
        prev === "Generation was stopped." ? null : prev,
      );
    }, 4000);
  };

  const handleConfirmResetStudio = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (storySaveTimeoutRef.current) clearTimeout(storySaveTimeoutRef.current);
    if (voiceoverSaveTimeoutRef.current)
      clearTimeout(voiceoverSaveTimeoutRef.current);
    if (durationSaveTimeoutRef.current)
      clearTimeout(durationSaveTimeoutRef.current);

    requestIdRef.current++;
    clearStoredStudioState();

    setLocalInputMode("story");
    setLocalStory("");
    setLocalVoiceoverScript("");
    setLocalMinutes("");
    setLocalSeconds("");
    setLocalStage(1);
    setLocalResult(null);
    setError(null);
    setValidationError(null);
    setIsGenerating(false);
    setGenerationPhase(null);
    setElapsedSeconds(0);
    setIsResetDialogOpen(false);

    setCancelNotice("Story workspace reset. Settings preserved.");
    setTimeout(() => {
      setCancelNotice((prev) =>
        prev === "Story workspace reset. Settings preserved." ? null : prev,
      );
    }, 3500);
  };

  // --- Focus wizard derived state -------------------------------------------
  const hasStory = !!story.trim();
  const hasVoiceover = !!voiceoverScript.trim();
  const hasDuration = !!actualVoiceoverDuration && actualVoiceoverDuration > 0;
  const hasScenes = !!result?.response;
  const isDirectMode = inputMode === "direct-voiceover";

  // Render exactly one stage at a time, and never show a stage whose input is missing.
  const activeStage = useMemo(() => {
    if (!hasVoiceover) return isDirectMode ? 2 : 1;
    if (currentStage < 1) return 1;
    if (currentStage === 4 && !hasScenes) return hasDuration ? 3 : 2;
    return currentStage;
  }, [currentStage, hasVoiceover, hasDuration, hasScenes, isDirectMode]);

  const canGoBack = activeStage > 1 && !(isDirectMode && activeStage === 2);
  const canGoForward =
    (activeStage === 1 && hasStory) ||
    (activeStage === 2 && hasVoiceover) ||
    (activeStage === 3 && hasScenes);

  const goToPreviousStage = () => {
    if (canGoBack) setLocalStage(activeStage - 1);
  };

  const goToNextStage = () => {
    if (canGoForward) setLocalStage(activeStage + 1);
  };

  const sceneCount = useMemo(
    () => parseProductionPackage(result?.response).scenes.length,
    [result?.response],
  );

  const isVoiceoverBusy = isGenerating && generationPhase === "voiceover";

  const workflowHint =
    activeStage === 1
      ? "Write or paste the story you want to turn into a video."
      : activeStage === 2
        ? "Review the narration, then synthesize it in Cartesia."
        : activeStage === 3
          ? "Enter the measured audio duration to calibrate the visuals."
          : "Copy the prompts into Google Flow and assemble the cut in the editor.";

  return (
    <section className="max-w-7xl mx-auto">
      {/* Subtle page wash */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-linear-to-b from-surface-subtle to-background" />

      <div className="w-full space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Left rail: stage navigator + reference material */}
          <aside className="w-full space-y-3 lg:w-72 lg:shrink-0">
            <StudioStepper
              currentStage={activeStage}
              hasStory={hasStory}
              hasVoiceover={hasVoiceover}
              hasDuration={hasDuration}
              hasScenes={hasScenes}
              onStageClick={handleStageClick}
              inputMode={inputMode}
            />

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                <span>How it works</span>
                <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="pt-2">
                <HowItWorksCard />
              </div>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                <span>Output format</span>
                <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="pt-2">
                <OutputFormatCard />
              </div>
            </details>
          </aside>

          {/* Right: the single active stage */}
          <section className="min-w-0 flex-1 space-y-4">
            <StudioSettingsBar
              settings={prodSettings}
              model={selectedModel}
              onResetClick={() => setIsResetDialogOpen(true)}
            />

            {/* Stage header + mode switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-foreground">
                  {activeStage === 1
                    ? "Story input"
                    : activeStage === 2
                      ? isDirectMode
                        ? "Direct voiceover"
                        : "Master voiceover script"
                      : activeStage === 3
                        ? "Audio duration & visual settings"
                        : "Production handoff"}
                </h1>
                <p className="text-xs text-muted-foreground">{workflowHint}</p>
              </div>

              {(activeStage === 1 || activeStage === 2) && (
                <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode("story")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      !isDirectMode
                        ? "bg-card text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileText className="size-3.5" />
                    <span>Story to script</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode("direct-voiceover")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      isDirectMode
                        ? "bg-card text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Mic className="size-3.5" />
                    <span>Direct voiceover</span>
                  </button>
                </div>
              )}
            </div>

            {/* STAGE 1 — Story input */}
            {activeStage === 1 && (
              <div className="space-y-4">
                <StoryInputCard
                  story={story}
                  onChange={handleStoryChange}
                  onClear={handleClear}
                  validationError={validationError}
                  disabled={isGenerating}
                />

                {!hasVoiceover && (
                  <div className="space-y-3">
                    {isVoiceoverBusy ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="lg"
                          className="flex-1 gap-2 cursor-default select-none"
                          tabIndex={-1}
                        >
                          <Loader2 className="size-4 shrink-0 animate-spin" />
                          <span className="truncate">
                            Writing voiceover script
                          </span>
                          <span className="font-mono text-xs">
                            {formatSeconds(elapsedSeconds)}
                          </span>
                        </Button>
                        <Button
                          size="lg"
                          variant="destructive"
                          onClick={handleStop}
                          className="shrink-0 gap-1.5"
                          title="Cancel generation and abort request"
                        >
                          <Square className="size-3.5 fill-current" />
                          <span>Stop</span>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="lg"
                        onClick={handleGenerateVoiceover}
                        disabled={!hasStory || isGenerating}
                        className="w-full gap-2"
                      >
                        <Sparkles className="size-4" />
                        <span>Generate voiceover script</span>
                        <ArrowRight className="size-4" />
                      </Button>
                    )}

                    {isVoiceoverBusy && (
                      <div className="flex items-center justify-between gap-2 px-1 text-2xs text-muted-foreground">
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                          <span>
                            {getProgressPhase(elapsedSeconds, "voiceover")}
                          </span>
                        </span>
                        <span className="font-mono">{elapsedSeconds}s</span>
                      </div>
                    )}

                    {!isGenerating && (
                      <p className="text-center text-xs text-muted-foreground">
                        Already have a voiceover?{" "}
                        <button
                          type="button"
                          onClick={() => handleSwitchMode("direct-voiceover")}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Enter it directly
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STAGE 2 — Voiceover script review */}
            {activeStage === 2 && (
              <div className="space-y-4">
                <VoiceoverScriptCard
                  script={voiceoverScript}
                  onChange={handleVoiceoverChange}
                  onClear={handleClearVoiceover}
                  onRegenerate={
                    !isDirectMode && story.trim()
                      ? handleGenerateVoiceover
                      : undefined
                  }
                  onProceedToDuration={() => setLocalStage(3)}
                  isGenerating={isVoiceoverBusy}
                  disabled={isGenerating}
                  isDirectVoiceover={isDirectMode}
                />

                {isVoiceoverBusy && (
                  <div className="flex items-center justify-between gap-2 px-1 text-2xs text-muted-foreground">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                      <span>
                        {getProgressPhase(elapsedSeconds, "voiceover")}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleStop}
                      className="gap-1.5"
                    >
                      <Square className="size-3" />
                      <span>Stop</span>
                    </Button>
                  </div>
                )}

                {isDirectMode && (
                  <details className="group rounded-xl border border-border bg-card overflow-hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col gap-0.5 text-left">
                        <span className="flex items-center gap-2 font-semibold">
                          <FileText className="size-3.5 text-primary" />
                          <span>Optional visual context</span>
                        </span>
                        <span className="text-2xs font-normal text-muted-foreground">
                          Add character appearance, setting, or visual continuity notes. Leave blank if your voiceover has enough detail.
                        </span>
                      </div>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-border p-3 space-y-2">
                      <Textarea
                        id="direct-visual-context-input"
                        value={story}
                        onChange={(e) => handleStoryChange(e.target.value)}
                        disabled={isGenerating}
                        placeholder="চরিত্রের রূপ, পোশাক, পরিবেশ বা ধারাবাহিকতার বিবরণ এখানে লিখুন (ভয়েসওভার পুনরায় পেস্ট করবেন না)... / Describe character appearance, setting, or visual continuity notes here. Do not re-paste your narration script."
                        className="w-full min-h-24 max-h-60 font-bangla text-xs leading-relaxed resize-y border-border/80 focus:border-primary p-3"
                      />
                      <div className="flex items-center justify-between text-2xs text-muted-foreground">
                        <span>{story.length.toLocaleString()} / 50,000 characters</span>
                        {story && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => handleStoryChange("")}
                            disabled={isGenerating}
                            className="gap-1 text-muted-foreground hover:text-foreground h-6 px-1.5"
                          >
                            <Trash2 className="size-3" />
                            <span>Clear</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* STAGE 3 — Cartesia duration & visual settings */}
            {activeStage === 3 && (
              <CartesiaDurationCard
                minutes={minutes}
                seconds={seconds}
                onMinutesChange={handleMinutesChange}
                onSecondsChange={handleSecondsChange}
                settings={prodSettings}
                onUpdateSetting={updateSetting}
                onGenerateScenes={handleGenerateScenes}
                onStop={handleStop}
                elapsedSeconds={elapsedSeconds}
                progressLabel={getProgressPhase(elapsedSeconds, "scenes")}
                isGenerating={isGenerating && generationPhase === "scenes"}
                disabled={isGenerating}
              />
            )}

            {/* Fallback stop control if the user navigates away while scenes are generating */}
            {isGenerating &&
              generationPhase === "scenes" &&
              activeStage !== 3 && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-2xs text-muted-foreground">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                    <span>Engineering scenes &amp; shots</span>
                    <span className="font-mono">
                      {formatSeconds(elapsedSeconds)}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleStop}
                    className="gap-1.5"
                  >
                    <Square className="size-3" />
                    <span>Stop</span>
                  </Button>
                </div>
              )}

            {/* STAGE 4 — Handoff */}
            {activeStage === 4 && (
              <div className="space-y-4 rounded-xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-success/30 bg-success-subtle text-success">
                    <Check className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Production package ready
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Copy the prompts into Google Flow, then assemble the final
                      cut in the editor.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
                      Scenes
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {sceneCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
                      Voiceover
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {actualVoiceoverDuration
                        ? formatSeconds(Math.round(actualVoiceoverDuration))
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted p-3">
                    <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
                      Prompt version
                    </p>
                    <p className="mt-1 truncate text-lg font-semibold text-foreground">
                      {result?.metadata.promptVersion ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    nativeButton={false}
                    className="gap-1.5"
                    render={<Link href="/editor" />}
                  >
                    <Film className="size-4" />
                    <span>Open video editor</span>
                  </Button>
                </div>

                <p className="text-2xs text-muted-foreground">
                  Scene prompts and timeline-plan JSON are shown below in separate copyable sections.
                </p>
              </div>
            )}

            {/* Brief cancellation / reset notice */}
            {cancelNotice && (
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground" />
                <span className="font-medium">{cancelNotice}</span>
              </div>
            )}

            {/* Wizard footer navigation */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="outline"
                onClick={goToPreviousStage}
                disabled={!canGoBack}
                className="gap-1.5"
              >
                <ChevronLeft className="size-4" />
                <span>Back</span>
              </Button>

              {activeStage < 4 ? (
                <Button
                  onClick={goToNextStage}
                  disabled={!canGoForward}
                  className="gap-1.5"
                >
                  <span>Continue</span>
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                <span className="text-2xs font-medium text-muted-foreground">
                  Workflow complete
                </span>
              )}
            </div>
          </section>
        </div>

        {/* Full-width generated output */}
        {(result || error) && (
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Generated output
              </h2>
              <p className="text-xs text-muted-foreground">
                Scene prompts and timeline-plan JSON, separated for copying.
              </p>
            </div>

            <OutputCard
              result={result}
              error={error}
            />
          </section>
        )}
      </div>

      {/* Reset Studio Confirmation Alert Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive border border-destructive/20">
              <AlertTriangle className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Reset Studio Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently clear your current story text, voiceover
              script, entered duration, and generated production package. Your
              production settings and AI model preference will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmResetStudio}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              <span>Confirm Reset</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
