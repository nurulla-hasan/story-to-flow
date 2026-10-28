"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { StoryProcessResponse } from "@/lib/validation";
import { useSelectedModel } from "@/lib/model-storage";
import { useProductionSettings } from "@/lib/settings-storage";
import {
  useStudioStorage,
  saveStoredResult,
  saveStoredStudioData,
  clearStoredStudioState,
} from "@/lib/studio-storage";
import { StoryInputCard } from "@/components/studio/story-input-card";
import { StudioStepper } from "@/components/studio/studio-stepper";
import { VoiceoverScriptCard } from "@/components/studio/voiceover-script-card";
import { CartesiaDurationCard } from "@/components/studio/cartesia-duration-card";
import { StudioSettingsBar } from "@/components/studio/studio-settings-bar";
import { OutputCard } from "@/components/studio/output-card";
import { HowItWorksCard } from "@/components/studio/how-it-works-card";
import { OutputFormatCard } from "@/components/studio/output-format-card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

function formatSeconds(sec: number): string {
  const mins = Math.floor(sec / 60);
  const remaining = sec % 60;
  return `${mins}:${remaining.toString().padStart(2, "0")}`;
}

function getProgressPhase(sec: number, phase: "voiceover" | "scenes" | null): string {
  if (phase === "voiceover") {
    if (sec < 6) return "Analyzing story tone & emotional arc...";
    if (sec < 18) return "Crafting natural Bangladeshi Bengali narration...";
    return "Polishing voiceover cadence for Cartesia speech...";
  }
  if (sec < 6) return "Aligning visual beats with measured voiceover duration...";
  if (sec < 18) return "Engineering visual scene compositions & shot modes...";
  if (sec < 45) return "Generating cinematic prompts & lighting instructions...";
  return "Finalizing complete scene & shot package...";
}

export default function StudioPage() {
  const { selectedModel } = useSelectedModel();
  const { settings: prodSettings, updateSetting } = useProductionSettings();
  const storedStudio = useStudioStorage();

  // Local state with fallback to persistent storage
  const [localStory, setLocalStory] = useState<string | null>(null);
  const [localVoiceoverScript, setLocalVoiceoverScript] = useState<string | null>(null);
  const [localMinutes, setLocalMinutes] = useState<string | null>(null);
  const [localSeconds, setLocalSeconds] = useState<string | null>(null);
  const [localStage, setLocalStage] = useState<number | null>(null);
  const [localResult, setLocalResult] = useState<StoryProcessResponse | null | undefined>(undefined);

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
  const [generationPhase, setGenerationPhase] = useState<"voiceover" | "scenes" | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
      if (storySaveTimeoutRef.current) clearTimeout(storySaveTimeoutRef.current);
      if (voiceoverSaveTimeoutRef.current) clearTimeout(voiceoverSaveTimeoutRef.current);
      if (durationSaveTimeoutRef.current) clearTimeout(durationSaveTimeoutRef.current);
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

  // Debounced story input auto-save with downstream state invalidation
  const handleStoryChange = (val: string) => {
    setLocalStory(val);
    setValidationError(null);

    // Cancel all pending auto-save timers to prevent race conditions
    if (storySaveTimeoutRef.current) clearTimeout(storySaveTimeoutRef.current);
    if (voiceoverSaveTimeoutRef.current) clearTimeout(voiceoverSaveTimeoutRef.current);
    if (durationSaveTimeoutRef.current) clearTimeout(durationSaveTimeoutRef.current);

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
      });
    }, 400);
  };

  const handleClear = () => {
    if (storySaveTimeoutRef.current) clearTimeout(storySaveTimeoutRef.current);
    if (voiceoverSaveTimeoutRef.current) clearTimeout(voiceoverSaveTimeoutRef.current);
    if (durationSaveTimeoutRef.current) clearTimeout(durationSaveTimeoutRef.current);

    setLocalStory("");
    setLocalVoiceoverScript("");
    setLocalMinutes("");
    setLocalSeconds("");
    setLocalResult(null);
    setLocalStage(1);
    setValidationError(null);

    saveStoredStudioData({
      story: "",
      voiceoverScript: "",
      voiceoverDurationMinutes: "",
      voiceoverDurationSeconds: "",
      actualVoiceoverDuration: null,
      lastResult: null,
      currentStage: 1,
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

    if (voiceoverSaveTimeoutRef.current) clearTimeout(voiceoverSaveTimeoutRef.current);
    if (durationSaveTimeoutRef.current) clearTimeout(durationSaveTimeoutRef.current);

    voiceoverSaveTimeoutRef.current = setTimeout(() => {
      saveStoredStudioData({
        voiceoverScript: val,
        voiceoverDurationMinutes: "",
        voiceoverDurationSeconds: "",
        actualVoiceoverDuration: null,
        lastResult: null,
        currentStage: 2,
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

    if (durationSaveTimeoutRef.current) clearTimeout(durationSaveTimeoutRef.current);
    durationSaveTimeoutRef.current = setTimeout(() => {
      saveStoredStudioData({
        voiceoverDurationMinutes: val,
        actualVoiceoverDuration: total > 0 ? parseFloat(total.toFixed(2)) : null,
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

    if (durationSaveTimeoutRef.current) clearTimeout(durationSaveTimeoutRef.current);
    durationSaveTimeoutRef.current = setTimeout(() => {
      saveStoredStudioData({
        voiceoverDurationSeconds: val,
        actualVoiceoverDuration: total > 0 ? parseFloat(total.toFixed(2)) : null,
        lastResult: null,
        currentStage: 3,
      });
    }, 300);
  };

  // STAGE 1 ACTION: Generate Master Voiceover Script Only
  const handleGenerateVoiceover = async () => {
    if (!story.trim()) {
      setValidationError("Please enter your story first to generate the voiceover script.");
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

      // Extract raw voiceover script
      const scriptText = (data.response || "").trim();
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
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
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
    if (!story.trim()) {
      setValidationError("Original story text is required.");
      return;
    }
    if (!voiceoverScript.trim()) {
      setError("Please generate and review the voiceover script before generating scenes.");
      return;
    }
    if (!actualVoiceoverDuration || actualVoiceoverDuration <= 0) {
      setError("Please enter the actual voiceover duration measured from Cartesia.");
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
          story,
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
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
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
      setCancelNotice((prev) => (prev === "Generation was stopped." ? null : prev));
    }, 4000);
  };

  const handleConfirmResetStudio = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (storySaveTimeoutRef.current) clearTimeout(storySaveTimeoutRef.current);
    if (voiceoverSaveTimeoutRef.current) clearTimeout(voiceoverSaveTimeoutRef.current);
    if (durationSaveTimeoutRef.current) clearTimeout(durationSaveTimeoutRef.current);

    requestIdRef.current++;
    clearStoredStudioState();

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
      setCancelNotice((prev) => (prev === "Story workspace reset. Settings preserved." ? null : prev));
    }, 3500);
  };

  const handleCopyAll = async () => {
    if (!result?.response) return;
    try {
      await navigator.clipboard.writeText(result.response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <>
      {/* Subtle background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-surface-subtle to-muted/30" />
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-secondary/5 via-transparent to-transparent" />
      </div>

      <div className="space-y-8 relative">
        {/* Workflow Progression Stepper */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl blur-xl -z-10" />
          <StudioStepper
            currentStage={currentStage}
            hasStory={!!story.trim()}
            hasVoiceover={!!voiceoverScript.trim()}
            hasDuration={!!actualVoiceoverDuration && actualVoiceoverDuration > 0}
            hasScenes={!!result?.response}
            onStageClick={(stg) => setLocalStage(stg)}
          />
        </div>

        {/* 2-Column Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Staged Story Workflow */}
          <div className="space-y-8">
            {/* STAGE 1: Original Story Input */}
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-to-br from-card via-card to-primary/5 rounded-xl blur-md -z-10 opacity-70" />
                <StoryInputCard
                  story={story}
                  onChange={handleStoryChange}
                  onClear={handleClear}
                  validationError={validationError}
                  disabled={isGenerating}
                />
              </div>

              {/* Action: Generate Master Voiceover Script */}
              {!voiceoverScript.trim() && (
                <div className="space-y-3">
                  {isGenerating && generationPhase === "voiceover" ? (
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/10 to-secondary/10 rounded-xl blur-sm -z-10" />
                        <Button
                          size="lg"
                          className="flex-1 gap-3 cursor-default select-none shadow-md"
                          tabIndex={-1}
                        >
                          <Loader2 className="size-4 animate-spin shrink-0 text-primary-foreground" />
                          <span className="font-semibold truncate">Writing Voiceover Script</span>
                          <span className="font-mono text-xs font-bold bg-primary-foreground/25 px-2.5 py-1 rounded-lg shadow-sm">
                            {formatSeconds(elapsedSeconds)}
                          </span>
                        </Button>
                      </div>
                      <div className="relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-destructive/20 to-destructive/10 rounded-xl blur-sm -z-10" />
                        <Button
                          size="lg"
                          variant="destructive"
                          onClick={handleStop}
                          className="gap-2.5 shrink-0 cursor-pointer shadow-md"
                          title="Cancel generation and abort request"
                        >
                          <Square className="size-3.5 fill-current" />
                          <span>Stop</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/10 to-secondary/10 rounded-xl blur-md -z-10 opacity-70" />
                      <Button
                        size="lg"
                        onClick={handleGenerateVoiceover}
                        disabled={!story.trim() || isGenerating}
                        className="w-full gap-3 cursor-pointer shadow-md text-sm font-semibold"
                      >
                        <Sparkles className="size-4.5" />
                        <span>Generate Voiceover Script</span>
                        <ArrowRight className="size-4.5" />
                      </Button>
                    </div>
                  )}

                  {isGenerating && generationPhase === "voiceover" && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-2 animate-in fade-in">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <span className="size-2 rounded-full bg-primary animate-pulse" />
                        <span>{getProgressPhase(elapsedSeconds, "voiceover")}</span>
                      </span>
                      <span className="font-mono font-semibold">{elapsedSeconds}s elapsed</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* STAGE 2: Master Voiceover Script (Review & Edit for Cartesia) */}
            {voiceoverScript.trim() && (
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-to-br from-info-subtle/30 via-card to-card rounded-xl blur-md -z-10 opacity-70" />
                <VoiceoverScriptCard
                  script={voiceoverScript}
                  onChange={handleVoiceoverChange}
                  onRegenerate={handleGenerateVoiceover}
                  onProceedToDuration={() => setLocalStage(3)}
                  isGenerating={isGenerating && generationPhase === "voiceover"}
                  disabled={isGenerating}
                />
              </div>
            )}

            {/* STAGE 3: Cartesia Duration Entry & Visual Settings */}
            {voiceoverScript.trim() && (
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-to-br from-success-subtle/30 via-card to-card rounded-xl blur-md -z-10 opacity-70" />
                <CartesiaDurationCard
                  minutes={minutes}
                  seconds={seconds}
                  onMinutesChange={handleMinutesChange}
                  onSecondsChange={handleSecondsChange}
                  settings={prodSettings}
                  onUpdateSetting={updateSetting}
                  onGenerateScenes={handleGenerateScenes}
                  isGenerating={isGenerating && generationPhase === "scenes"}
                  disabled={isGenerating}
                />
              </div>
            )}

            {/* In-Flight Scene Generation Status Bar */}
            {isGenerating && generationPhase === "scenes" && (
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 via-primary/10 to-secondary/10 rounded-xl blur-lg -z-10 opacity-70" />
                <div className="space-y-3 p-4 rounded-xl bg-card/80 backdrop-blur-sm border border-primary/30 shadow-lg animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl blur-sm -z-10" />
                      <Button
                        size="lg"
                        className="flex-1 gap-3 cursor-default select-none shadow-md"
                        tabIndex={-1}
                      >
                        <Loader2 className="size-4 animate-spin shrink-0 text-primary-foreground" />
                        <span className="font-semibold truncate">Engineering Scenes &amp; Shots</span>
                        <span className="font-mono text-xs font-bold bg-primary-foreground/25 px-2.5 py-1 rounded-lg shadow-sm">
                          {formatSeconds(elapsedSeconds)}
                        </span>
                      </Button>
                    </div>
                    <div className="relative">
                      <div className="absolute -inset-1 bg-gradient-to-r from-destructive/20 to-destructive/10 rounded-xl blur-sm -z-10" />
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={handleStop}
                        className="gap-2.5 shrink-0 cursor-pointer shadow-md"
                        title="Cancel generation and abort request"
                      >
                        <Square className="size-3.5 fill-current" />
                        <span>Stop</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <span className="size-2 rounded-full bg-primary animate-pulse" />
                      <span>{getProgressPhase(elapsedSeconds, "scenes")}</span>
                    </span>
                    <span className="font-mono font-semibold">{elapsedSeconds}s elapsed</span>
                  </div>
                </div>
              </div>
            )}

            {/* Compact Active Production Settings Bar with Reset Studio Button */}
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-br from-surface-subtle via-card to-card rounded-xl blur-md -z-10 opacity-70" />
              <StudioSettingsBar
                settings={prodSettings}
                model={selectedModel}
                onResetClick={() => setIsResetDialogOpen(true)}
              />
            </div>

            {/* Brief cancellation / reset notice */}
            {cancelNotice && (
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl blur-sm -z-10 opacity-70" />
                <div className="flex items-center gap-3 rounded-xl bg-muted/80 backdrop-blur-sm px-4 py-2.5 text-sm text-muted-foreground animate-in fade-in">
                  <span className="size-2.5 rounded-full bg-muted-foreground/60" />
                  <span className="font-medium">{cancelNotice}</span>
                </div>
              </div>
            )}

            {/* How it works Card */}
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-br from-info-subtle/30 via-card to-card rounded-xl blur-md -z-10 opacity-70" />
              <HowItWorksCard />
            </div>

            {/* Output format Card */}
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-br from-warning-subtle/30 via-card to-card rounded-xl blur-md -z-10 opacity-70" />
              <OutputFormatCard />
            </div>
          </div>

          {/* Right Column: Generated Output (Voiceover & Scene Cards) */}
          <div className="space-y-8">
            <div className="relative">
              <div className="absolute -inset-3 bg-gradient-to-br from-card via-card to-primary/5 rounded-xl blur-md -z-10 opacity-70" />
              <OutputCard
                result={result}
                error={error}
                copied={copied}
                onCopyAll={handleCopyAll}
              />
            </div>
          </div>
        </div>
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
              This will permanently clear your current story text, voiceover script,
              entered duration, and generated production package. Your production
              settings and AI model preference will remain unchanged.
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
    </>
  );
}
