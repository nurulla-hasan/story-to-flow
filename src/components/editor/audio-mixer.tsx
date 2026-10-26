"use client";

import * as React from "react";
import {
  AudioLines,
  Headphones,
  Loader2,
  Music,
  Sliders,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { cn } from "cn";
import type { BgmMood, StudioProject } from "../types";
import { BGM_MOOD_PRESETS } from "@/lib/bgm";
import { formatSec, SPEED_PRESETS } from "./editor-shared";

interface AudioMixerProps {
  project: StudioProject;
  onUpdateProject: (patch: Partial<StudioProject>) => void;
  effectiveAudioDuration: number;
  currentSpeed: number;
  voiceVolume: number;
  bgmVolume: number;
  bgmLabel: string;
  enableDucking: boolean;
  generatingBgm: boolean;
  audioInputRef: React.RefObject<HTMLInputElement | null>;
  bgmInputRef: React.RefObject<HTMLInputElement | null>;
  onUpdateSpeed: (speed: number) => void;
  onGenerateBgm: (mood: BgmMood) => void;
}

export function AudioMixer({
  project,
  onUpdateProject,
  effectiveAudioDuration,
  currentSpeed,
  voiceVolume,
  bgmVolume,
  bgmLabel,
  enableDucking,
  generatingBgm,
  audioInputRef,
  bgmInputRef,
  onUpdateSpeed,
  onGenerateBgm,
}: AudioMixerProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Sliders className="size-3.5" />
        </span>
        <div>
          <p className="text-xs font-bold text-foreground">Audio mixer</p>
          <p className="text-3xs text-muted-foreground">Voice, music &amp; ducking</p>
        </div>
      </div>

      <div className="space-y-2.5 p-3">
        {/* Voiceover */}
        <div className="rounded-lg border border-track-voice/25 bg-track-voice-soft p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-3xs font-bold uppercase tracking-wider text-track-voice">
              <AudioLines className="size-3.5 shrink-0" />
              <span className="truncate">Voiceover</span>
            </span>
            {project.audioUrl ? (
              <button
                type="button"
                onClick={() => onUpdateProject({ audioUrl: null, audioDuration: 0 })}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                title="Remove the voiceover track"
              >
                <X className="size-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="rounded border border-track-voice/30 bg-card/60 px-1.5 py-0.5 text-3xs font-semibold text-track-voice transition-colors hover:bg-card"
              >
                Import
              </button>
            )}
          </div>

          {project.audioUrl ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between gap-2 font-mono text-3xs text-muted-foreground">
                <span>{formatSec(project.audioDuration)} source</span>
                <span>
                  {formatSec(effectiveAudioDuration)} @ {currentSpeed}x
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Volume2 className="size-3 shrink-0 text-muted-foreground" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={voiceVolume}
                  onChange={(event) =>
                    onUpdateProject({ voiceVolume: parseFloat(event.target.value) })
                  }
                  className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
                  title="Voiceover volume"
                />
                <span className="w-8 text-right font-mono text-3xs text-muted-foreground">
                  {Math.round(voiceVolume * 100)}%
                </span>
              </div>

              <div className="flex flex-wrap gap-1">
                {SPEED_PRESETS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => onUpdateSpeed(speed)}
                    className={cn(
                      "min-w-9 rounded-md px-1.5 py-0.5 font-mono text-3xs transition-colors",
                      currentSpeed === speed
                        ? "bg-primary font-bold text-primary-foreground shadow-xs"
                        : "bg-card/70 text-muted-foreground hover:text-foreground",
                    )}
                    title={`Voiceover speed ${speed}x`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onUpdateProject({ enableAudioDucking: !enableDucking })}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-track-voice/20 bg-card/50 px-2 py-1 text-3xs font-semibold text-muted-foreground transition-colors hover:bg-card/80"
                title="Lower the music to 15% while the voiceover speaks, swell back to 35% on pauses"
              >
                <span>Auto-duck music</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono font-bold",
                    enableDucking
                      ? "bg-track-voice/20 text-track-voice"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {enableDucking ? "ON" : "OFF"}
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="mt-2 flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-track-voice/30 bg-card/40 px-2 py-3 text-center transition-colors hover:bg-card/80"
            >
              <Music className="size-4 text-track-voice" />
              <span className="text-2xs font-semibold text-foreground">Import MP3 / WAV</span>
              <span className="text-3xs text-muted-foreground">
                CapCut TTS or recorded narration
              </span>
            </button>
          )}
        </div>

        {/* Background music */}
        <div className="rounded-lg border border-track-music/25 bg-track-music-soft p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-3xs font-bold uppercase tracking-wider text-track-music">
              <Headphones className="size-3.5 shrink-0" />
              <span className="truncate">Music</span>
            </span>
            {project.bgmUrl ? (
              <button
                type="button"
                onClick={() => onUpdateProject({ bgmUrl: null, bgmMood: null })}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                title="Remove background music"
              >
                <X className="size-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => bgmInputRef.current?.click()}
                className="rounded border border-track-music/30 bg-card/60 px-1.5 py-0.5 text-3xs font-semibold text-track-music transition-colors hover:bg-card"
              >
                Upload
              </button>
            )}
          </div>

          {project.bgmUrl ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between gap-2 text-3xs text-muted-foreground">
                <span className="truncate font-semibold text-foreground">{bgmLabel}</span>
                <span className="font-mono">{Math.round(bgmVolume * 100)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Volume2 className="size-3 shrink-0 text-muted-foreground" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgmVolume}
                  onChange={(event) =>
                    onUpdateProject({ bgmVolume: parseFloat(event.target.value) })
                  }
                  className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
                  title="Background music volume"
                />
              </div>
            </div>
          ) : (
            <p className="mt-1 text-3xs text-muted-foreground">
              Generate a procedural cinematic bed in one click.
            </p>
          )}

          {project.recommendedBgmMood ? (
            <button
              type="button"
              disabled={generatingBgm}
              onClick={() => onGenerateBgm(project.recommendedBgmMood!)}
              className={cn(
                "mt-2 flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1 text-3xs font-semibold transition-colors",
                project.bgmMood === project.recommendedBgmMood
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary/40 bg-card/60 text-primary hover:bg-card",
              )}
              title="Generate background music that matches the mood of your story"
            >
              <Sparkles className="size-3" />
              <span className="truncate">
                Story match:{" "}
                {BGM_MOOD_PRESETS.find((preset) => preset.id === project.recommendedBgmMood)
                  ?.label ?? "Recommended"}
              </span>
            </button>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1">
            {BGM_MOOD_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={generatingBgm}
                onClick={() => onGenerateBgm(preset.id)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-3xs font-medium transition-colors disabled:opacity-60",
                  project.bgmMood === preset.id
                    ? "bg-primary font-bold text-primary-foreground shadow-xs"
                    : "border border-border/70 bg-card/70 text-foreground hover:bg-card",
                )}
                title={preset.description}
              >
                <span>{preset.emoji}</span>
                <span>{preset.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {generatingBgm ? (
            <p className="mt-1.5 flex items-center gap-1 text-3xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Synthesizing music…
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
