"use client";

import { Check, Mic, Clock, Film, FileText } from "lucide-react";

interface StudioStepperProps {
  currentStage: number; // 1, 2, 3, 4
  hasStory: boolean;
  hasVoiceover: boolean;
  hasDuration: boolean;
  hasScenes: boolean;
  onStageClick?: (stage: number) => void;
}

export function StudioStepper({
  currentStage,
  hasStory,
  hasVoiceover,
  hasDuration,
  hasScenes,
  onStageClick,
}: StudioStepperProps) {
  const steps = [
    {
      id: 1,
      title: "Story Input",
      icon: FileText,
      isCompleted: hasStory && (hasVoiceover || currentStage > 1),
      isActive: currentStage === 1,
    },
    {
      id: 2,
      title: "Voiceover Script",
      icon: Mic,
      isCompleted: hasVoiceover && (hasDuration || currentStage > 2),
      isActive: currentStage === 2,
    },
    {
      id: 3,
      title: "Cartesia Duration",
      icon: Clock,
      isCompleted: hasDuration && (hasScenes || currentStage > 3),
      isActive: currentStage === 3,
    },
    {
      id: 4,
      title: "Scene & Shot Prompts",
      icon: Film,
      isCompleted: hasScenes,
      isActive: currentStage === 4,
    },
  ];

  return (
    <div className="w-full bg-card border border-border rounded-xl p-3 shadow-2xs">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isClickable =
            (step.id === 1 && hasStory) ||
            (step.id === 2 && (hasStory || hasVoiceover)) ||
            (step.id === 3 && hasVoiceover) ||
            (step.id === 4 && hasDuration && hasScenes);

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => isClickable && onStageClick?.(step.id)}
                disabled={!isClickable}
                className={`flex items-center gap-2 p-1.5 rounded-lg text-left transition-all w-full select-none ${
                  step.isActive
                    ? "bg-primary/10 border border-primary/30 text-primary font-semibold shadow-2xs"
                    : step.isCompleted
                      ? "text-foreground hover:bg-muted/60 cursor-pointer"
                      : "text-muted-foreground/60 cursor-not-allowed"
                }`}
              >
                <div
                  className={`size-6 rounded-md flex items-center justify-center shrink-0 text-xs font-mono font-bold transition-colors ${
                    step.isCompleted
                      ? "bg-primary text-primary-foreground"
                      : step.isActive
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.isCompleted ? (
                    <Check className="size-3.5 stroke-[2.5]" />
                  ) : (
                    step.id
                  )}
                </div>

                <div className="min-w-0 truncate">
                  <div className="flex items-center gap-1.5 truncate">
                    <Icon className="size-3.5 shrink-0 opacity-80" />
                    <span className="text-xs truncate">{step.title}</span>
                  </div>
                </div>
              </button>

              {idx < steps.length - 1 && (
                <div className="hidden sm:block w-3 h-px bg-border/80 mx-1 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
