"use client";

import { useState, useRef, useEffect } from "react";
import type { StoryProcessResponse } from "@/lib/validation";
import { useSelectedModel } from "@/lib/model-storage";
import { useProductionSettings } from "@/lib/settings-storage";
import {
  useStudioStorage,
  saveStoredStory,
  saveStoredResult,
  clearStoredStudioState,
} from "@/lib/studio-storage";
import { StudioSidebar } from "@/components/studio/studio-sidebar";
import { StudioHeader } from "@/components/studio/studio-header";
import { StoryInputCard } from "@/components/studio/story-input-card";
import { StudioSettingsBar } from "@/components/studio/studio-settings-bar";
import { OutputCard } from "@/components/studio/output-card";
import { HowItWorksCard } from "@/components/studio/how-it-works-card";
import { OutputFormatCard } from "@/components/studio/output-format-card";
import { Button } from "@/components/ui/button";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
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

function getProgressPhase(sec: number): string {
  if (sec < 6) return "Analyzing story tone & structure...";
  if (sec < 18) return "Composing continuous Bengali voiceover...";
  if (sec < 45) return "Engineering visual prompts & timecodes...";
  return "Finalizing complete production package...";
}

export default function StudioPage() {
  const { selectedModel } = useSelectedModel();
  const { settings: prodSettings } = useProductionSettings();
  const storedStudio = useStudioStorage();

  // Local states with fallback to persistent storage
  const [localStory, setLocalStory] = useState<string | null>(null);
  const [localResult, setLocalResult] = useState<StoryProcessResponse | null | undefined>(undefined);

  const story = localStory !== null ? localStory : storedStudio.story;
  const result = localResult !== undefined ? localResult : storedStudio.lastResult;

  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);
  const storySaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (storySaveTimeoutRef.current) {
        clearTimeout(storySaveTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Debounced story input auto-save (persists 400ms after user pauses typing)
  const handleStoryChange = (val: string) => {
    setLocalStory(val);
    setValidationError(null);

    if (storySaveTimeoutRef.current) {
      clearTimeout(storySaveTimeoutRef.current);
    }
    storySaveTimeoutRef.current = setTimeout(() => {
      saveStoredStory(val);
    }, 400);
  };

  const handleClear = () => {
    setLocalStory("");
    setValidationError(null);
    if (storySaveTimeoutRef.current) {
      clearTimeout(storySaveTimeoutRef.current);
    }
    saveStoredStory("");
  };

  const handleGenerate = async () => {
    if (!story.trim()) {
      setValidationError("Please enter a story to generate the package.");
      return;
    }

    // Cancel any previous in-flight request
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

    try {
      const response = await fetch("/api/story/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          story,
          settings: {
            model: selectedModel,
            visualStyle: prodSettings.visualStyle,
            aspectRatio: prodSettings.aspectRatio,
            duration: prodSettings.duration,
            staticFramePacing: prodSettings.staticFramePacing,
          },
        }),
      });

      // Ignore if superseded or cancelled
      if (requestIdRef.current !== currentRequestId) return;

      const data = await response.json();

      if (!response.ok) {
        if (data.cancelled || response.status === 499) {
          setCancelNotice("Generation was stopped.");
          return;
        }
        setError(data.error || "Failed to generate production package");
        return;
      }

      setLocalResult(data);
      // Persist latest successful output only after generation completes
      saveStoredResult(data);
    } catch (err) {
      if (requestIdRef.current !== currentRequestId) return;

      if (err instanceof Error && err.name === "AbortError") {
        setCancelNotice("Generation was stopped.");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
      );
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsGenerating(false);
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
    setElapsedSeconds(0);
    setCancelNotice("Generation was stopped.");
    setTimeout(() => {
      setCancelNotice((prev) => (prev === "Generation was stopped." ? null : prev));
    }, 4000);
  };

  // Reset Studio workspace action (clears story work & output, preserves production settings & model)
  const handleConfirmResetStudio = () => {
    // 1. Abort active generation if in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 2. Invalidate request ID to ignore late responses
    requestIdRef.current++;

    // 3. Clear stored Studio state from localStorage (story & generated output only)
    clearStoredStudioState();

    // 4. Clear local component state for story work and output (preserves prodSettings & selectedModel)
    setLocalStory("");
    setLocalResult(null);
    setError(null);
    setValidationError(null);
    setIsGenerating(false);
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
    <SidebarProvider defaultOpen={true}>
      <StudioSidebar />
      <SidebarInset className="bg-background flex flex-col min-h-screen">
        <StudioHeader />

        {/* Main Content Area */}
        <div className="flex-1 p-4 sm:p-6 w-full mx-auto max-w-full">
          {/* 2-Column Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Input + Settings Summary + Generate Button + How It Works + Format Info */}
            <div className="space-y-6">
              {/* Story Input Card */}
              <StoryInputCard
                story={story}
                onChange={handleStoryChange}
                onClear={handleClear}
                validationError={validationError}
                disabled={isGenerating}
              />

              {/* Compact Active Production Settings Bar with Reset Studio Button */}
              <StudioSettingsBar
                settings={prodSettings}
                model={selectedModel}
                onResetClick={() => setIsResetDialogOpen(true)}
              />

              {/* Generate & Stop Button Controls with Live Timer */}
              <div className="space-y-2.5">
                {isGenerating ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <Button
                        size="lg"
                        className="flex-1 gap-2.5 cursor-default select-none shadow-sm"
                        tabIndex={-1}
                      >
                        <Loader2 className="size-4 animate-spin shrink-0 text-primary-foreground" />
                        <span className="font-semibold truncate">Generating Package</span>
                        <span className="font-mono text-xs font-bold bg-primary-foreground/20 px-2 py-0.5 rounded-md shadow-xs">
                          {formatSeconds(elapsedSeconds)}
                        </span>
                      </Button>
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={handleStop}
                        className="gap-2 shrink-0 cursor-pointer shadow-sm"
                        title="Cancel generation and abort request"
                      >
                        <Square className="size-3.5 fill-current" />
                        <span>Stop</span>
                      </Button>
                    </div>

                    {/* Live Progress Phase & Timer Bar */}
                    <div className="flex items-center justify-between text-2xs text-muted-foreground px-1.5 animate-in fade-in">
                      <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                        <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                        <span>{getProgressPhase(elapsedSeconds)}</span>
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {elapsedSeconds}s elapsed
                      </span>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleGenerate}
                    disabled={!story.trim()}
                    className="w-full gap-2 cursor-pointer shadow-sm"
                  >
                    <Sparkles className="size-4.5" />
                    <span>Generate Production Package</span>
                    <ArrowRight className="size-4.5" />
                  </Button>
                )}

                {/* Brief cancellation / reset notice */}
                {cancelNotice && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground animate-in fade-in">
                    <span className="size-2 rounded-full bg-muted-foreground/50" />
                    <span>{cancelNotice}</span>
                  </div>
                )}
              </div>

              {/* How it works Card */}
              <HowItWorksCard />

              {/* Output format Card */}
              <OutputFormatCard />
            </div>

            {/* Right Column: Generated Output (Voiceover & Scene Cards) */}
            <div className="space-y-6">
              <OutputCard
                result={result}
                error={error}
                copied={copied}
                onCopyAll={handleCopyAll}
              />
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Reset Studio Confirmation Alert Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive border border-destructive/20">
              <AlertTriangle className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Reset Studio Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently clear your current story text, cancel any active generation, and remove the generated production package. Your production settings and AI model preference will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>
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
    </SidebarProvider>
  );
}
