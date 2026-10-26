"use client";

import { useState, useRef, useEffect } from "react";
import type { StoryProcessResponse } from "@/lib/validation";
import { useSelectedModel } from "@/lib/model-storage";
import { useProductionSettings } from "@/lib/settings-storage";
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
import { Sparkles, ArrowRight, Loader2, Square } from "lucide-react";

export default function StudioPage() {
  const { selectedModel } = useSelectedModel();
  const { settings: prodSettings } = useProductionSettings();
  const [story, setStory] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<StoryProcessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<number>(0);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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

    setResult(null);
    setError(null);
    setValidationError(null);
    setCancelNotice(null);
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

      setResult(data);
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
    setCancelNotice("Generation was stopped.");
    setTimeout(() => {
      setCancelNotice((prev) => (prev === "Generation was stopped." ? null : prev));
    }, 4000);
  };

  const handleClear = () => {
    setStory("");
    setValidationError(null);
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
            {/* Left Column: Input + Settings + Generate Button + How It Works + Format Info */}
            <div className="space-y-6">
              {/* Story Input Card */}
              <StoryInputCard
                story={story}
                onChange={(val) => {
                  setStory(val);
                  setValidationError(null);
                }}
                onClear={handleClear}
                validationError={validationError}
                disabled={isGenerating}
              />

              {/* Compact Active Production Settings Bar */}
              <StudioSettingsBar
                settings={prodSettings}
                model={selectedModel}
              />

              {/* Generate & Stop Button Controls */}
              <div className="space-y-2">
                {isGenerating ? (
                  <div className="flex items-center gap-2.5">
                    <Button
                      size="lg"
                      disabled
                      className="flex-1 gap-2 cursor-not-allowed"
                    >
                      <Loader2 className="size-4.5 animate-spin" />
                      <span>Generating Production Package...</span>
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={handleStop}
                      className="gap-2 shrink-0 cursor-pointer"
                      title="Cancel generation and abort request"
                    >
                      <Square className="size-3.5 fill-current" />
                      <span>Stop</span>
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleGenerate}
                    disabled={!story.trim()}
                    className="w-full gap-2 cursor-pointer"
                  >
                    <Sparkles className="size-4.5" />
                    <span>Generate Production Package</span>
                    <ArrowRight className="size-4.5" />
                  </Button>
                )}

                {/* Brief cancellation notice */}
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

            {/* Right Column: Generated Output Card */}
            <div className="space-y-6">
              {/* Generated Output Card */}
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
    </SidebarProvider>
  );
}
