"use client";

import { useState } from "react";
import type { StoryProcessResponse } from "@/lib/validation";
import { useSelectedModel } from "@/lib/model-storage";
import { StudioSidebar } from "@/components/studio/studio-sidebar";
import { StudioHeader } from "@/components/studio/studio-header";
import { StoryInputCard } from "@/components/studio/story-input-card";
import { SettingsCard } from "@/components/studio/settings-card";
import { OutputCard } from "@/components/studio/output-card";
import { HowItWorksCard } from "@/components/studio/how-it-works-card";
import { OutputFormatCard } from "@/components/studio/output-format-card";
import { Button } from "@/components/ui/button";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

const SAMPLE_STORY = `আজ তোমাদের শোনাবো রীনা আর করিমের গল্প—দুই পুরোনো বন্ধুর, যাদের জীবনে এক ভোরের দেখা ফিরিয়ে এনেছিল বহু বছরের ফেলে আসা স্মৃতি।

সেদিন ভোরের আবছা আলোয় নদীর ঘাটে যেতেই রিনার চোখ হঠাৎ থমকে গিয়েছিল। ঘাটের সিঁড়িতে দাঁড়িয়ে থাকা ওই অচেনা অবয়বটি আসলে কে? কুয়াশা কাটতেই দেখা গেল, বহু বছর পর শহর থেকে ফিরে এসেছে করিম। শান্ত নদীর কিনারে দাঁড়িয়ে, কত বছর বাদে দুই পুরোনো বন্ধু আবার একসঙ্গে কথা বলতে লাগল। ভোরের মৃদুমন্দ বাতাসে ভেসে চলল তাদের ফেলে আসা সেই সোনালী অতীতের কত শত স্মৃতি।`;

export default function StudioPage() {
  const { selectedModel } = useSelectedModel();
  const [story, setStory] = useState(SAMPLE_STORY);
  const [visualStyle, setVisualStyle] = useState("Auto");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9">("9:16");
  const [duration, setDuration] = useState<"Auto" | number>("Auto");
  const [staticFramePacing, setStaticFramePacing] = useState<"Auto" | number>(
    "Auto",
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<StoryProcessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!story.trim()) {
      setValidationError("Please enter a story to generate the package.");
      return;
    }

    setResult(null);
    setError(null);
    setValidationError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/story/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          story,
          settings: {
            model: selectedModel,
            visualStyle,
            aspectRatio,
            duration,
            staticFramePacing,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to generate production package");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
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

              {/* Production Settings Card */}
              <SettingsCard
                visualStyle={visualStyle}
                onVisualStyleChange={setVisualStyle}
                aspectRatio={aspectRatio}
                onAspectRatioChange={setAspectRatio}
                duration={duration}
                onDurationChange={setDuration}
                staticFramePacing={staticFramePacing}
                onStaticFramePacingChange={setStaticFramePacing}
                activeModel={selectedModel}
                disabled={isGenerating}
              />

              {/* Generate Button */}
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={isGenerating || !story.trim()}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-4.5 animate-spin" />
                    <span>Generating Production Package...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4.5" />
                    <span>Generate Production Package</span>
                    <ArrowRight className="size-4.5" />
                  </>
                )}
              </Button>

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
