"use client";

import { Check, Mic, Clock, Film, FileText } from "lucide-react";

interface StudioStepperProps {
  currentStage: number; // 1, 2, 3, 4
  hasStory: boolean;
  hasVoiceover: boolean;
  hasDuration: boolean;
  hasScenes: boolean;
  onStageClick?: (stage: number) => void;
  inputMode?: "story" | "direct-voiceover";
}

export function StudioStepper({
  currentStage,
  hasStory,
  hasVoiceover,
  hasDuration,
  hasScenes,
  onStageClick,
  inputMode = "story",
}: StudioStepperProps) {
  const isDirect = inputMode === "direct-voiceover";

  const steps = [
    {
      id: 1,
      title: isDirect ? "Story (Skipped)" : "Story",
      icon: FileText,
      isCompleted: isDirect ? true : hasStory && (hasVoiceover || currentStage > 1),
      isActive: !isDirect && currentStage === 1,
    },
    {
      id: 2,
      title: isDirect ? "Direct Voiceover" : "Voiceover",
      icon: Mic,
      isCompleted: hasVoiceover && (hasDuration || currentStage > 2),
      isActive: currentStage === 2 || (isDirect && currentStage === 1),
    },
    {
      id: 3,
      title: "Duration",
      icon: Clock,
      isCompleted: hasDuration && (hasScenes || currentStage > 3),
      isActive: currentStage === 3,
    },
    {
      id: 4,
      title: "Prompts",
      icon: Film,
      isCompleted: hasScenes,
      isActive: currentStage === 4,
    },
  ];

  const currentStep =
    steps.find((s) => s.isActive) ||
    steps.find((s) => s.id === currentStage) ||
    steps[0];

  const displayStepNumber = isDirect && currentStage === 1 ? 2 : currentStage;

  return (
    <div className="w-full bg-card/70 backdrop-blur-sm border border-border/80 rounded-xl px-3.5 py-2.5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Current Active Step Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-7 rounded-lg bg-primary/10 border border-primary/25 text-primary flex items-center justify-center shrink-0">
            <currentStep.icon className="size-3.5" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Step {displayStepNumber} of 4:
            </span>
            <span className="text-xs font-semibold text-foreground truncate">
              {currentStep.title}
            </span>
          </div>
        </div>

        {/* Right: Minimal Interactive Segmented Progress Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {steps.map((step, idx) => {
            const isClickable =
              (step.id === 1 && !isDirect && hasStory) ||
              (step.id === 1 && isDirect) ||
              (step.id === 2 && (isDirect || hasStory || hasVoiceover)) ||
              (step.id === 3 && hasVoiceover) ||
              (step.id === 4 && hasDuration && hasScenes);

            return (
              <div key={step.id} className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => isClickable && onStageClick?.(step.id)}
                  disabled={!isClickable}
                  title={`${step.title} (Step ${step.id})`}
                  className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                    step.isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : step.isCompleted
                        ? "bg-muted text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
                        : "text-muted-foreground/40 cursor-not-allowed"
                  }`}
                >
                  <span className="size-3.5 rounded-full flex items-center justify-center shrink-0">
                    {step.isCompleted ? (
                      <Check className="size-3 stroke-[2.5]" />
                    ) : (
                      <span className="text-3xs font-mono font-bold">{step.id}</span>
                    )}
                  </span>
                  <span className="text-2xs font-medium hidden md:inline">
                    {step.title}
                  </span>
                </button>

                {idx < steps.length - 1 && (
                  <div
                    className={`h-0.5 w-3 sm:w-5 rounded-full transition-colors ${
                      step.isCompleted ? "bg-primary/60" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

