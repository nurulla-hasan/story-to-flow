"use client";

import { Check, Minus, Lock, FileText, Mic, Clock, Film } from "lucide-react";

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
      title: "Story",
      hint: "Original narrative",
      icon: FileText,
      isSkipped: isDirect,
      isCompleted: !isDirect && hasStory && (hasVoiceover || currentStage > 1),
      isActive: !isDirect && currentStage === 1,
      canNavigate: isDirect || hasStory,
    },
    {
      id: 2,
      title: isDirect ? "Direct voiceover" : "Voiceover",
      hint: isDirect ? "Your own script" : "Bengali narration",
      icon: Mic,
      isSkipped: false,
      isCompleted: hasVoiceover && (hasDuration || currentStage > 2),
      isActive: currentStage === 2 || (isDirect && currentStage === 1),
      canNavigate: isDirect || hasStory || hasVoiceover,
    },
    {
      id: 3,
      title: "Duration",
      hint: "Cartesia timing",
      icon: Clock,
      isSkipped: false,
      isCompleted: hasDuration && (hasScenes || currentStage > 3),
      isActive: currentStage === 3,
      canNavigate: hasVoiceover,
    },
    {
      id: 4,
      title: "Prompts",
      hint: "Scene & shot plan",
      icon: Film,
      isSkipped: false,
      isCompleted: hasScenes,
      isActive: currentStage === 4,
      canNavigate: hasDuration && hasScenes,
    },
  ];

  const completedCount = steps.filter((s) => s.isCompleted || s.isSkipped).length;

  return (
    <nav
      aria-label="Studio workflow"
      className="rounded-xl border border-border bg-card p-2"
    >
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <span className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
          Workflow
        </span>
        <span className="text-2xs font-mono font-semibold text-muted-foreground">
          {completedCount}/4 done
        </span>
      </div>

      <ol className="space-y-1">
        {steps.map((step) => {
          const isLocked = !step.canNavigate && !step.isActive;

          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => step.canNavigate && onStageClick?.(step.id)}
                disabled={!step.canNavigate}
                aria-current={step.isActive ? "step" : undefined}
                title={isLocked ? `${step.title} — complete the previous step first` : step.title}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  step.isActive
                    ? "bg-primary/10 ring-1 ring-primary/25"
                    : isLocked
                      ? "opacity-45 cursor-not-allowed"
                      : "hover:bg-muted"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-md border ${
                    step.isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : step.isCompleted
                        ? "border-success/30 bg-success-subtle text-success"
                        : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {step.isSkipped ? (
                    <Minus className="size-3.5" />
                  ) : step.isCompleted ? (
                    <Check className="size-3.5" />
                  ) : (
                    <step.icon className="size-3.5" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-2xs font-medium text-muted-foreground">
                    Step {step.id}
                  </span>
                  <span
                    className={`block truncate text-sm font-semibold ${
                      step.isActive ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {step.hint}
                  </span>
                </span>

                <span className="shrink-0 text-muted-foreground">
                  {isLocked ? (
                    <Lock className="size-3" aria-hidden="true" />
                  ) : step.isSkipped ? (
                    <span className="text-3xs font-medium">Skipped</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
