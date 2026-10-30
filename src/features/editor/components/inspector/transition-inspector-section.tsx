"use client";

import { Clock, Sparkles, CopyCheck, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { TimelineTransition, TransitionType } from "@/types/timeline";
import { TRANSITION_PRESETS } from "@/lib/transition-helpers";

interface TransitionInspectorSectionProps {
  selectedTransition: TimelineTransition;
  eligibleTransitionBoundaryCount: number;
  applyFeedback: string | null;
  onApplyToAll: (transitionId: string) => void;
  updateTransition: (transitionId: string, updates: Partial<TimelineTransition>) => void;
  deleteTransition: (transitionId: string) => void;
}

/** Presentation and controls for editing the selected transition. */
export function TransitionInspectorSection({
  selectedTransition, eligibleTransitionBoundaryCount, applyFeedback,
  onApplyToAll, updateTransition, deleteTransition,
}: TransitionInspectorSectionProps) {
  return (
    <div className="space-y-3.5 flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2.5 border border-border">
                  <div className="size-7 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Sparkles className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs font-semibold text-foreground capitalize">
                      {selectedTransition.type.replace("-", " ")}
                    </p>
                    <p className="text-3xs text-muted-foreground">
                      Duration: {selectedTransition.duration.toFixed(2)}s
                    </p>
                  </div>
                </div>
    
                {/* Transition Preset Type Picker */}
                <div className="space-y-1.5 rounded-xl border border-border bg-surface-subtle/70 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Transition Style</span>
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-3xs font-semibold tracking-wide text-primary">
                      {selectedTransition.type}
                    </span>
                  </div>
    
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {TRANSITION_PRESETS.map((preset) => {
                      const isCurrent = selectedTransition.type === preset.type;
                      return (
                        <button
                          key={preset.type}
                          type="button"
                          onClick={() =>
                            updateTransition(selectedTransition.id, {
                              type: preset.type as TransitionType,
                            })
                          }
                          className={`cursor-pointer rounded-lg border p-2 text-left transition-all duration-150 ${
                            isCurrent
                              ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
                              : "border-border/70 bg-card hover:border-primary/30 hover:bg-muted"
                          }`}
                        >
                          <p
                            className={`text-3xs font-semibold ${
                              isCurrent ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {preset.label}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-3xs text-muted-foreground">
                            {preset.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
    
                {/* Transition Duration Slider */}
                <div className="space-y-1.5 rounded-xl border border-border bg-surface-subtle/70 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Clock className="size-3 text-muted-foreground" />
                      <span>Duration</span>
                    </span>
                    <span className="font-mono text-xs font-semibold text-primary">
                      {selectedTransition.duration.toFixed(2)}s
                    </span>
                  </div>
    
                  <Slider
                    min={0.2}
                    max={1.5}
                    step={0.05}
                    value={selectedTransition.duration}
                    onValueChange={(val) => {
                      const num = Array.isArray(val) ? val[0] : val;
                      updateTransition(selectedTransition.id, {
                        duration: typeof num === "number" ? num : parseFloat(String(num)),
                      });
                    }}
                    aria-label="Transition duration"
                    className="w-full"
                  />
    
                  <div className="flex items-center justify-between text-3xs text-muted-foreground font-mono">
                    <span>0.2s</span>
                    <span>Max: 1.5s</span>
                  </div>
                </div>
    
                {/* Apply to All Transitions Action Button */}
                <div className="space-y-1.5 pt-1">
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => onApplyToAll(selectedTransition.id)}
                    disabled={eligibleTransitionBoundaryCount === 0}
                    className="w-full"
                    title={
                      eligibleTransitionBoundaryCount === 0
                        ? "No eligible adjacent visual clip boundaries"
                        : `Apply ${selectedTransition.type.replace("-", " ")} (${selectedTransition.duration.toFixed(2)}s) to all ${eligibleTransitionBoundaryCount} eligible clip boundaries`
                    }
                  >
                    <CopyCheck className="size-3.5" />
                    <span>Apply to All Transitions ({eligibleTransitionBoundaryCount})</span>
                  </Button>
    
                  {applyFeedback && (
                    <div className="flex items-start gap-1.5 rounded-lg border border-primary/20 bg-primary/10 p-2 text-3xs font-medium leading-relaxed text-primary animate-in fade-in">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                      <span>{applyFeedback}</span>
                    </div>
                  )}
                </div>
    
                {/* Remove Transition Button */}
                <Button
                  variant="destructive"
                  size="default"
                  onClick={() => deleteTransition(selectedTransition.id)}
                  className="w-full"
                  title="Delete this transition"
                >
                  <Trash2 className="size-3" />
                  <span>Remove transition</span>
                </Button>
              </div>
  );
}
