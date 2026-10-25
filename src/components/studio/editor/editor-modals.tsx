"use client";

import * as React from "react";
import {
  Check,
  Clock,
  FastForward,
  Loader2,
  Music,
  Play,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import {
  SFX_PRESETS,
  TRANSITION_PRESETS,
  type StudioProject,
  type TransitionType,
} from "../types";
import {
  formatSec,
  type ClipTiming,
  type SfxModalState,
  type TransitionModalState,
} from "./editor-shared";

interface EditorModalsProps {
  project: StudioProject;
  clipTimings: ClipTiming[];
  currentTime: number;
  activeTransitionModal: TransitionModalState | null;
  setActiveTransitionModal: React.Dispatch<
    React.SetStateAction<TransitionModalState | null>
  >;
  handleApplyTransition: (
    type: TransitionType,
    duration: number,
    applyToAll: boolean,
  ) => void;
  activeSfxModal: SfxModalState | null;
  setActiveSfxModal: React.Dispatch<React.SetStateAction<SfxModalState | null>>;
  handleSaveSfxModal: (config: SfxModalState["config"] | null) => void;
  handleTestSfx: (config: SfxModalState["config"]) => void;
  customSfxInputRef: React.RefObject<HTMLInputElement | null>;
  uploadingSfx: boolean;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}

export function EditorModals({
  project,
  clipTimings,
  currentTime,
  activeTransitionModal,
  setActiveTransitionModal,
  handleApplyTransition,
  activeSfxModal,
  setActiveSfxModal,
  handleSaveSfxModal,
  handleTestSfx,
  customSfxInputRef,
  uploadingSfx,
  notify,
}: EditorModalsProps) {
  return (
    <>
      {/* CapCut transition selector */}
      {activeTransitionModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Transition selector"
        >
          <div className="max-h-modal w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-2 border-b border-border/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Zap className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {activeTransitionModal.clipIndex !== null
                      ? `Transition: Clip #${activeTransitionModal.clipIndex + 1} → #${activeTransitionModal.clipIndex + 2}`
                      : "Transitions for every split"}
                  </h3>
                  <p className="text-3xs text-muted-foreground">
                    Cross dissolve, white flash, slides, zoom push and dip to black
                  </p>
                </div>
              </div>
      
              <button
                type="button"
                onClick={() => setActiveTransitionModal(null)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close transition selector"
              >
                <X className="size-4" />
              </button>
            </div>
      
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TRANSITION_PRESETS.map((preset) => (
                <button
                  key={preset.type}
                  type="button"
                  onClick={() =>
                    setActiveTransitionModal((prev) =>
                      prev ? { ...prev, type: preset.type } : null,
                    )
                  }
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-all",
                    activeTransitionModal.type === preset.type
                      ? "border-primary bg-primary/10 font-bold text-primary ring-2 ring-primary/30"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  <span className="text-xl leading-none">{preset.emoji}</span>
                  <span className="text-2xs font-semibold">{preset.label}</span>
                  <span className="line-clamp-1 text-3xs text-muted-foreground">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
      
            {activeTransitionModal.type !== "none" ? (
              <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/30 p-2.5">
                <div className="flex items-center justify-between text-2xs">
                  <span className="font-semibold text-muted-foreground">Duration</span>
                  <span className="font-mono font-bold text-foreground">
                    {activeTransitionModal.duration.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.1}
                  value={activeTransitionModal.duration}
                  onChange={(event) =>
                    setActiveTransitionModal((prev) =>
                      prev ? { ...prev, duration: parseFloat(event.target.value) } : null,
                    )
                  }
                  className="h-1.5 w-full cursor-pointer accent-primary"
                />
              </div>
            ) : null}
      
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-2">
              {activeTransitionModal.clipIndex !== null ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleApplyTransition(
                      activeTransitionModal.type,
                      activeTransitionModal.duration,
                      false,
                    )
                  }
                  className="text-2xs"
                >
                  Apply to this split
                </Button>
              ) : null}
      
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  handleApplyTransition(
                    activeTransitionModal.type,
                    activeTransitionModal.duration,
                    true,
                  )
                }
                className="gap-1.5 text-2xs font-semibold"
              >
                <Sparkles className="size-3.5" />
                <span>Apply to all splits</span>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      
      {/* SFX transform studio */}
      {activeSfxModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Sound effect transform studio"
        >
          <div className="max-h-modal w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-2 border-b border-border/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-track-sfx-soft text-track-sfx">
                  <Sliders className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    SFX transform · Clip #
                    {project.clips.find((clip) => clip.id === activeSfxModal.clipId)?.index ?? ""}
                  </h3>
                  <p className="text-3xs text-muted-foreground">
                    Source, timing, volume and pitch for this sound
                  </p>
                </div>
              </div>
      
              <button
                type="button"
                onClick={() => setActiveSfxModal(null)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close sound effect studio"
              >
                <X className="size-4" />
              </button>
            </div>
      
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-2xs">
                <span className="font-semibold text-foreground">Sound source</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploadingSfx}
                  onClick={() => customSfxInputRef.current?.click()}
                  className="h-7 gap-1 px-2 text-3xs font-semibold"
                >
                  {uploadingSfx ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Upload className="size-3" />
                  )}
                  <span>{activeSfxModal.config.customUrl ? "Replace audio" : "Upload audio"}</span>
                </Button>
              </div>
      
              {activeSfxModal.config.customUrl ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2 text-2xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <Music className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate font-mono text-3xs font-semibold text-foreground">
                      {activeSfxModal.config.customName || "custom-audio.wav"}
                    </span>
                  </div>
                  <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 font-mono text-3xs font-bold text-primary">
                    Custom
                  </span>
                </div>
              ) : null}
      
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {SFX_PRESETS.map((preset) => (
                  <button
                    key={preset.type}
                    type="button"
                    onClick={() =>
                      setActiveSfxModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              config: {
                                ...prev.config,
                                type: preset.type,
                                customUrl:
                                  preset.type === "none" ? null : prev.config.customUrl,
                              },
                            }
                          : null,
                      )
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2 text-left transition-all",
                      activeSfxModal.config.type === preset.type &&
                        !activeSfxModal.config.customUrl
                        ? "border-track-sfx bg-track-sfx-soft font-bold text-track-sfx ring-1 ring-track-sfx/40"
                        : "border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    <span className="text-base leading-none">{preset.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-3xs font-semibold">{preset.label}</div>
                      <div className="truncate text-3xs text-muted-foreground">
                        {preset.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
      
            {activeSfxModal.config.type !== "none" ? (
              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-2xs">
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Clock className="size-3 text-primary" />
                    <span>Timing offset</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-3xs font-bold text-foreground">
                      +{activeSfxModal.config.offset.toFixed(2)}s
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const targetClip = project.clips.find(
                          (clip) => clip.id === activeSfxModal.clipId,
                        );
                        const timing = clipTimings.find(
                          (item) => item.clip.id === activeSfxModal.clipId,
                        );
                        if (targetClip && timing) {
                          const snapOffset = Math.max(
                            0,
                            Math.min(
                              targetClip.duration || 3,
                              currentTime - timing.start,
                            ),
                          );
                          setActiveSfxModal((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  config: {
                                    ...prev.config,
                                    offset: Number(snapOffset.toFixed(2)),
                                  },
                                }
                              : null,
                          );
                          notify(`Snapped SFX to playhead (${snapOffset.toFixed(2)}s)!`, "info");
                        }
                      }}
                      className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-3xs font-semibold text-primary transition-colors hover:bg-primary/20"
                      title="Snap the sound effect to the current playhead"
                    >
                      Snap to playhead
                    </button>
                  </div>
                </div>
      
                <input
                  type="range"
                  min={0}
                  max={
                    project.clips.find((clip) => clip.id === activeSfxModal.clipId)?.duration || 3
                  }
                  step={0.05}
                  value={activeSfxModal.config.offset}
                  onChange={(event) =>
                    setActiveSfxModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: { ...prev.config, offset: parseFloat(event.target.value) },
                          }
                        : null,
                    )
                  }
                  className="h-1.5 w-full cursor-pointer accent-primary"
                />
      
                <div className="flex justify-between gap-2 font-mono text-3xs text-muted-foreground">
                  <span>Start 0.0s</span>
                  <span>
                    Timeline{" "}
                    {formatSec(
                      (clipTimings.find((item) => item.clip.id === activeSfxModal.clipId)?.start ||
                        0) + activeSfxModal.config.offset,
                    )}
                  </span>
                  <span>
                    End{" "}
                    {(
                      project.clips.find((clip) => clip.id === activeSfxModal.clipId)?.duration ||
                      3
                    ).toFixed(1)}
                    s
                  </span>
                </div>
              </div>
            ) : null}
      
            {activeSfxModal.config.type !== "none" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/30 p-2.5">
                  <div className="flex items-center justify-between text-2xs">
                    <span className="flex items-center gap-1 font-semibold text-muted-foreground">
                      <Volume2 className="size-3 text-primary" />
                      <span>Volume</span>
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {Math.round(activeSfxModal.config.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={activeSfxModal.config.volume}
                    onChange={(event) =>
                      setActiveSfxModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              config: { ...prev.config, volume: parseFloat(event.target.value) },
                            }
                          : null,
                      )
                    }
                    className="h-1.5 w-full cursor-pointer accent-primary"
                  />
                  <div className="flex items-center gap-1 pt-0.5">
                    {[0.5, 0.8, 1.0, 1.5, 2.0].map((volume) => (
                      <button
                        key={volume}
                        type="button"
                        onClick={() =>
                          setActiveSfxModal((prev) =>
                            prev
                              ? { ...prev, config: { ...prev.config, volume } }
                              : null,
                          )
                        }
                        className={cn(
                          "flex-1 rounded py-0.5 font-mono text-3xs transition-colors",
                          activeSfxModal.config.volume === volume
                            ? "bg-primary font-bold text-primary-foreground shadow-xs"
                            : "border border-border/70 bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {Math.round(volume * 100)}%
                      </button>
                    ))}
                  </div>
                </div>
      
                <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/30 p-2.5">
                  <div className="flex items-center justify-between text-2xs">
                    <span className="flex items-center gap-1 font-semibold text-muted-foreground">
                      <FastForward className="size-3 text-primary" />
                      <span>Speed / pitch</span>
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {activeSfxModal.config.speed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={activeSfxModal.config.speed}
                    onChange={(event) =>
                      setActiveSfxModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              config: { ...prev.config, speed: parseFloat(event.target.value) },
                            }
                          : null,
                      )
                    }
                    className="h-1.5 w-full cursor-pointer accent-primary"
                  />
                  <div className="flex items-center gap-1 pt-0.5">
                    {[0.5, 0.8, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() =>
                          setActiveSfxModal((prev) =>
                            prev ? { ...prev, config: { ...prev.config, speed } } : null,
                          )
                        }
                        className={cn(
                          "flex-1 rounded py-0.5 font-mono text-3xs transition-colors",
                          activeSfxModal.config.speed === speed
                            ? "bg-primary font-bold text-primary-foreground shadow-xs"
                            : "border border-border/70 bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
      
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2">
              <div className="flex items-center gap-2">
                {activeSfxModal.config.type !== "none" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestSfx(activeSfxModal.config)}
                    className="gap-1 text-2xs font-semibold"
                  >
                    <Play className="size-3 fill-current" />
                    <span>Test sound</span>
                  </Button>
                ) : null}
      
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSaveSfxModal(null)}
                  className="text-2xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                  <span>Remove</span>
                </Button>
              </div>
      
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveSfxModal(null)}
                  className="text-2xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSaveSfxModal(activeSfxModal.config)}
                  className="gap-1 text-2xs font-semibold"
                >
                  <Check className="size-3.5" />
                  <span>Save transforms</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
