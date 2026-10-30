"use client";

import { useMemo } from "react";
import {
  Clock,
  Film,
  Volume2,
  Image as ImageIcon,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Square,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MAX_SAFE_EXPORT_DURATION } from "@/lib/video-export-engine";
import type { ProductionSettingsState } from "@/lib/settings-storage";
import type {
  VisualAssetMode,
  VideoSoundMode,
  VideoAssetDuration,
} from "@/lib/validation";

interface CartesiaDurationCardProps {
  minutes: string;
  seconds: string;
  onMinutesChange: (val: string) => void;
  onSecondsChange: (val: string) => void;
  settings: ProductionSettingsState;
  onUpdateSetting: <K extends keyof ProductionSettingsState>(
    key: K,
    value: ProductionSettingsState[K]
  ) => void;
  onGenerateScenes: () => void;
  onStop?: () => void;
  elapsedSeconds?: number;
  progressLabel?: string;
  isGenerating?: boolean;
  disabled?: boolean;
}

function formatSeconds(sec: number): string {
  const mins = Math.floor(sec / 60);
  const remaining = sec % 60;
  return `${mins}:${remaining.toString().padStart(2, "0")}`;
}

const VISUAL_ASSET_MODE_OPTIONS: { value: VisualAssetMode; label: string; desc: string }[] = [
  {
    value: "Hybrid",
    label: "Hybrid (Default)",
    desc: "AI intelligently mixes static image shots and video shots based on narrative action.",
  },
  {
    value: "All Images",
    label: "All Images",
    desc: "Generates static image prompts for every shot. No video shots requested.",
  },
  {
    value: "All Videos",
    label: "All Videos",
    desc: "Generates animated video prompts for every shot, adhering to the selected video duration.",
  },
];

const VIDEO_SOUND_OPTIONS: { value: VideoSoundMode; label: string; desc: string }[] = [
  {
    value: "Silent Video",
    label: "Silent Video (Default)",
    desc: "Prompts explicitly request silent visuals with no generated audio/dialogue. Cartesia voiceover remains the dedicated speech track.",
  },
  {
    value: "Ambient Sound & SFX",
    label: "Ambient Sound & SFX",
    desc: "Prompts specify environmental audio (rain, wind, footsteps, room tone) without speech/narration.",
  },
  {
    value: "Full Generated Audio",
    label: "Full Generated Audio",
    desc: "Prompts request dialogue and ambience when supported by external video AI models. (Prompt instruction only).",
  },
];

const PACING_OPTIONS = [
  { value: 4.0, label: "4.0s per image (Default)" },
  { value: 2.5, label: "2.5s per image (Fast)" },
  { value: 3.0, label: "3.0s per image (Dynamic)" },
  { value: 5.0, label: "5.0s per image (Cinematic)" },
  { value: "Auto", label: "Auto (AI chooses pacing)" },
];

const VIDEO_DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: "4", label: "4.0 seconds (Default)" },
  { value: "6", label: "6.0 seconds" },
  { value: "8", label: "8.0 seconds" },
];

export function CartesiaDurationCard({
  minutes,
  seconds,
  onMinutesChange,
  onSecondsChange,
  settings,
  onUpdateSetting,
  onGenerateScenes,
  onStop,
  elapsedSeconds = 0,
  progressLabel,
  isGenerating = false,
  disabled = false,
}: CartesiaDurationCardProps) {
  // Calculate total seconds accurately
  const totalSeconds = useMemo(() => {
    const m = parseFloat(minutes) || 0;
    const s = parseFloat(seconds) || 0;
    const total = m * 60 + s;
    return total > 0 ? parseFloat(total.toFixed(2)) : 0;
  }, [minutes, seconds]);

  const isValidDuration = totalSeconds > 0;

  // Format time display as M:SS
  const formattedDisplay = useMemo(() => {
    if (totalSeconds <= 0) return "0:00";
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [totalSeconds]);

  const videoDurationSec: VideoAssetDuration =
    settings.videoAssetDuration === 6 || settings.videoAssetDuration === 8
      ? settings.videoAssetDuration
      : 4;

  const isVideoAssetModeActive = settings.visualAssetMode !== "All Images";

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
            <Clock className="size-5" />
          </div>
          <div>
            <CardTitle>Audio Duration &amp; Visual Settings</CardTitle>
            <CardDescription className="mt-0.5">
              Synthesize the script in Cartesia, then enter the measured audio
              duration here to calibrate scene and shot pacing.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 1. Actual Measured Audio Duration Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FieldLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" />
              <span>Actual Cartesia Voiceover Duration</span>
            </FieldLabel>

            {isValidDuration ? (
              <Badge variant="secondary" className="font-mono text-xs font-bold text-primary">
                {formattedDisplay}
              </Badge>
            ) : (
              <span className="text-3xs text-destructive flex items-center gap-1">
                <AlertCircle className="size-3" />
                <span>Required for visual generation</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Minutes Input */}
            <Field>
              <FieldLabel className="text-3xs text-muted-foreground">Minutes</FieldLabel>
              <div className="relative">
                <Input
                  id="cartesia-duration-minutes"
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  placeholder="0"
                  value={minutes}
                  onChange={(e) => onMinutesChange(e.target.value)}
                  disabled={disabled}
                  className="font-mono text-sm text-foreground pr-8"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs font-mono text-muted-foreground pointer-events-none">
                  min
                </span>
              </div>
            </Field>

            {/* Seconds Input (supports decimals like 2.96 or 14.5) */}
            <Field>
              <FieldLabel className="text-3xs text-muted-foreground">Seconds</FieldLabel>
              <div className="relative">
                <Input
                  id="cartesia-duration-seconds"
                  type="number"
                  min="0"
                  max="59.99"
                  step="0.01"
                  placeholder="0.00"
                  value={seconds}
                  onChange={(e) => onSecondsChange(e.target.value)}
                  disabled={disabled}
                  className="font-mono text-sm text-foreground pr-8"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs font-mono text-muted-foreground pointer-events-none">
                  sec
                </span>
              </div>
            </Field>
          </div>

          {/* Export Duration Safety Limit Notice */}
          {totalSeconds > MAX_SAFE_EXPORT_DURATION && (
            <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-subtle p-3 text-3xs leading-relaxed text-warning-subtle-foreground animate-in fade-in">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <div>
                <span className="font-semibold">
                  Browser Export Limit Notice ({Math.floor(MAX_SAFE_EXPORT_DURATION / 60)} minutes / {MAX_SAFE_EXPORT_DURATION}s)
                </span>
                <p className="mt-0.5 opacity-90">
                  Your voiceover duration ({totalSeconds.toFixed(1)}s) exceeds the {Math.floor(MAX_SAFE_EXPORT_DURATION / 60)}-minute safe limit of the in-browser MP4 exporter. You can generate scene &amp; shot prompts for this story, but in-browser video rendering requires timelines to be within {Math.floor(MAX_SAFE_EXPORT_DURATION / 60)}:00 ({MAX_SAFE_EXPORT_DURATION}s).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 2. Visual Generation Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Visual Asset Mode */}
          <Field className="space-y-1.5">
            <FieldLabel className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Film className="size-3.5 text-primary" />
              <span>Visual Asset Mode</span>
            </FieldLabel>
            <Select
              value={settings.visualAssetMode || "Hybrid"}
              onValueChange={(val) => onUpdateSetting("visualAssetMode", val as VisualAssetMode)}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {VISUAL_ASSET_MODE_OPTIONS.find((o) => o.value === (settings.visualAssetMode || "Hybrid"))?.label || "Select asset mode"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VISUAL_ASSET_MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription className="text-3xs text-muted-foreground">
              {VISUAL_ASSET_MODE_OPTIONS.find((o) => o.value === settings.visualAssetMode)?.desc}
            </FieldDescription>
          </Field>

          {/* Video Sound Mode */}
          <Field className="space-y-1.5">
            <FieldLabel className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Volume2 className="size-3.5 text-primary" />
              <span>Video Sound</span>
            </FieldLabel>
            <Select
              value={settings.videoSoundMode || "Silent Video"}
              onValueChange={(val) => onUpdateSetting("videoSoundMode", val as VideoSoundMode)}
              disabled={disabled || settings.visualAssetMode === "All Images"}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {settings.visualAssetMode === "All Images"
                    ? "Disabled (All Images mode)"
                    : VIDEO_SOUND_OPTIONS.find((o) => o.value === (settings.videoSoundMode || "Silent Video"))?.label || "Select sound mode"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VIDEO_SOUND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription className="text-3xs text-muted-foreground">
              {settings.visualAssetMode === "All Images" 
                ? "Disabled when using All Images mode (no video assets)" 
                : VIDEO_SOUND_OPTIONS.find((o) => o.value === settings.videoSoundMode)?.desc}
            </FieldDescription>
          </Field>

          {/* Static Image Shot Pacing */}
          <Field className="space-y-1.5">
            <FieldLabel className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <ImageIcon className="size-3.5 text-primary" />
              <span>Static Image Shot Pacing</span>
            </FieldLabel>
            <Select
              value={settings.staticFramePacing === "Auto" 
                ? "Auto" 
                : String(settings.staticFramePacing ?? 4.0)}
              onValueChange={(val) => {
                if (val) {
                  const newValue = val === "Auto" ? "Auto" : parseFloat(val);
                  onUpdateSetting(
                    "staticFramePacing",
                    newValue
                  );
                }
              }}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {PACING_OPTIONS.find((o) => 
                    String(o.value) === String(settings.staticFramePacing ?? 4.0)
                  )?.label || "Select pacing"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PACING_OPTIONS.map((opt) => (
                  <SelectItem key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription className="text-3xs text-muted-foreground">
              Default duration for static image shots. Story scenes can contain multiple shots to match narration pacing.
            </FieldDescription>
          </Field>

          {/* Video Source Asset Duration */}
          <Field className="space-y-1.5">
            <div className="flex items-center justify-between">
              <FieldLabel className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Film className="size-3.5 text-primary" />
                <span>Video Source Asset Duration</span>
              </FieldLabel>
              {isVideoAssetModeActive && (
                <span className="text-3xs font-mono font-semibold text-primary">
                  {videoDurationSec}.0s
                </span>
              )}
            </div>
            <Select
              value={String(videoDurationSec)}
              onValueChange={(val) => {
                if (val) {
                  onUpdateSetting(
                    "videoAssetDuration",
                    parseInt(val, 10) as VideoAssetDuration
                  );
                }
              }}
              disabled={disabled || !isVideoAssetModeActive}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {!isVideoAssetModeActive 
                    ? "Disabled (All Images mode)" 
                    : VIDEO_DURATION_OPTIONS.find((o) => o.value === String(videoDurationSec))?.label || "Select video duration"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VIDEO_DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription className="text-3xs text-muted-foreground leading-relaxed">
              {settings.visualAssetMode === "All Images"
                ? "Not applicable when using All Images mode (no video assets)"
                : "Use the same duration in your external video generator. If your chosen generator does not offer this duration, select a supported duration there and update this Studio setting to match."}
            </FieldDescription>
          </Field>
        </div>

        {/* 3. Generate Scenes & Shot Prompts Action Button */}
        <div>
          {isGenerating ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  size="lg"
                  className="flex-1 cursor-default select-none gap-2"
                  tabIndex={-1}
                >
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                  <span className="truncate">Engineering scenes &amp; shots</span>
                  <span className="font-mono text-xs">
                    {formatSeconds(elapsedSeconds)}
                  </span>
                </Button>
                {onStop && (
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={onStop}
                    className="shrink-0 gap-1.5"
                    title="Cancel generation and abort request"
                  >
                    <Square className="size-3.5 fill-current" />
                    <span>Stop</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 px-1 text-2xs text-muted-foreground">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  <span>{progressLabel ?? "Engineering visual scene compositions..."}</span>
                </span>
                <span className="font-mono">{elapsedSeconds}s</span>
              </div>
            </div>
          ) : (
            <Button
              size="lg"
              onClick={onGenerateScenes}
              disabled={!isValidDuration || disabled}
              className="w-full gap-2"
            >
              <Film className="size-4" />
              <span>
                {totalSeconds > 0
                  ? `Generate Scene & Shot Prompts (${formattedDisplay})`
                  : "Enter a duration to continue"}
              </span>
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
