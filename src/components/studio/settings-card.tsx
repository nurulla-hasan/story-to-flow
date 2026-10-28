"use client"

import Link from "next/link"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Palette,
  Image as ImageIcon,
  Settings,
  Cpu,
  RotateCcw,
  Film,
  Volume2,
} from "lucide-react"
import type {
  VisualAssetMode,
  VideoSoundMode,
  VideoAssetDuration,
} from "@/lib/validation"

function AspectRatioIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="15" x="2" y="4.5" rx="2" />
      <path d="M6 8.5h2" />
      <path d="M16 8.5h2" />
      <path d="M6 15.5h2" />
      <path d="M16 15.5h2" />
    </svg>
  )
}

const VISUAL_STYLE_OPTIONS = [
  "Auto",
  "3D Animated Cartoon",
  "Cinematic Realism",
  "Minimalist Stickman Cartoon",
  "Anime & Manga Style",
  "Vintage Comic Book",
  "Hand-Drawn Sketch",
  "Painterly Storybook",
  "Warm Rural Drama",
  "Moody Noir",
  "Documentary Natural",
] as const

const ASPECT_RATIO_OPTIONS = [
  { value: "9:16", label: "9:16 (Vertical)" },
  { value: "16:9", label: "16:9 (Landscape)" },
] as const

const PACING_OPTIONS = [
  { value: "Auto", label: "Auto (AI recommends)" },
  { value: "2.5", label: "2.5s per image" },
  { value: "3.0", label: "3.0s per image" },
  { value: "4.0", label: "4.0s per image (Default)" },
  { value: "5.0", label: "5.0s per image" },
] as const

const VIDEO_DURATION_OPTIONS = [
  { value: "4", label: "4.0 seconds (Default)" },
  { value: "6", label: "6.0 seconds" },
  { value: "8", label: "8.0 seconds" },
] as const

const VISUAL_ASSET_MODE_OPTIONS = [
  { value: "Hybrid", label: "Hybrid (AI mixes static images & video)" },
  { value: "All Images", label: "All Images (Static shots only)" },
  { value: "All Videos", label: "All Videos (Video motion shots only)" },
] as const

const VIDEO_SOUND_OPTIONS = [
  { value: "Silent Video", label: "Silent Video (Default)" },
  { value: "Ambient Sound & SFX", label: "Ambient Sound & SFX" },
  { value: "Full Generated Audio", label: "Full Generated Audio (Experimental prompt)" },
] as const

interface SettingsCardProps {
  visualStyle: string
  onVisualStyleChange: (value: string) => void
  aspectRatio: "9:16" | "16:9"
  onAspectRatioChange: (value: "9:16" | "16:9") => void
  staticFramePacing: "Auto" | number
  onStaticFramePacingChange: (value: "Auto" | number) => void
  videoAssetDuration?: VideoAssetDuration
  onVideoAssetDurationChange?: (value: VideoAssetDuration) => void
  visualAssetMode?: VisualAssetMode
  onVisualAssetModeChange?: (value: VisualAssetMode) => void
  videoSoundMode?: VideoSoundMode
  onVideoSoundModeChange?: (value: VideoSoundMode) => void
  activeModel?: string
  disabled?: boolean
  onResetDefaults?: () => void
  isDefault?: boolean
}

export function SettingsCard({
  visualStyle,
  onVisualStyleChange,
  aspectRatio,
  onAspectRatioChange,
  staticFramePacing,
  onStaticFramePacingChange,
  videoAssetDuration = 4,
  onVideoAssetDurationChange,
  visualAssetMode = "Hybrid",
  onVisualAssetModeChange,
  videoSoundMode = "Silent Video",
  onVideoSoundModeChange,
  activeModel,
  disabled = false,
  onResetDefaults,
  isDefault = true,
}: SettingsCardProps) {
  const isVideoModeActive = visualAssetMode !== "All Images";

  const currentVideoDuration: VideoAssetDuration =
    videoAssetDuration === 6 || videoAssetDuration === 8 ? videoAssetDuration : 4;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-brand-subtle flex items-center justify-center shrink-0 border border-brand-border/40">
              <Settings className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle>Production Settings</CardTitle>
              <CardDescription className="font-bangla">
                Select your preferred visual style, aspect ratio, and shot durations
              </CardDescription>
            </div>
          </div>

          {activeModel && (
            <Link
              href="/settings"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-2xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              title="Change active model in Settings"
            >
              <Cpu className="size-3 text-primary shrink-0" />
              <span className="truncate max-w-36 font-mono" suppressHydrationWarning>{activeModel}</span>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {/* Grid of Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Visual Style */}
            <Field>
              <FieldLabel>
                <Palette className="size-3.5 text-muted-foreground" />
                <span>Visual Style</span>
              </FieldLabel>
              <Select
                value={visualStyle}
                onValueChange={(val) => {
                  if (val) onVisualStyleChange(val)
                }}
                disabled={disabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
                <SelectContent>
                  {VISUAL_STYLE_OPTIONS.map((style) => (
                    <SelectItem key={style} value={style}>
                      {style === "Auto" ? "Auto (AI recommends)" : style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Aspect Ratio */}
            <Field>
              <FieldLabel>
                <AspectRatioIcon className="size-3.5 text-muted-foreground" />
                <span>Aspect Ratio</span>
              </FieldLabel>
              <Select
                value={aspectRatio}
                onValueChange={(val) => {
                  if (val === "9:16" || val === "16:9") {
                    onAspectRatioChange(val)
                  }
                }}
                disabled={disabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select ratio" />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Static Image Shot Pacing */}
            <Field>
              <FieldLabel>
                <ImageIcon className="size-3.5 text-muted-foreground" />
                <span>Static Frame Pacing</span>
              </FieldLabel>
              <Select
                value={String(staticFramePacing)}
                onValueChange={(val) => {
                  if (val) {
                    onStaticFramePacingChange(val === "Auto" ? "Auto" : Number(val))
                  }
                }}
                disabled={disabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select pacing" />
                </SelectTrigger>
                <SelectContent>
                  {PACING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription className="text-3xs text-muted-foreground">
                Default duration for static image shots.
              </FieldDescription>
            </Field>

            {/* Video Source Asset Duration */}
            {onVideoAssetDurationChange && isVideoModeActive && (
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel>
                    <Film className="size-3.5 text-muted-foreground" />
                    <span>Video Source Asset Duration</span>
                  </FieldLabel>
                  <span className="text-3xs font-mono font-semibold text-primary">
                    {currentVideoDuration}.0s
                  </span>
                </div>
                <Select
                  value={String(currentVideoDuration)}
                  onValueChange={(val) => {
                    if (val) {
                      onVideoAssetDurationChange(parseInt(val, 10) as VideoAssetDuration)
                    }
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select video duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription className="text-3xs text-muted-foreground leading-relaxed">
                  Use the same duration in your external video generator. If your chosen generator does not offer this duration, select a supported duration there and update this Studio setting to match.
                </FieldDescription>
              </Field>
            )}

            {/* Visual Asset Mode */}
            {onVisualAssetModeChange && (
              <Field>
                <FieldLabel>
                  <Film className="size-3.5 text-muted-foreground" />
                  <span>Visual Asset Mode</span>
                </FieldLabel>
                <Select
                  value={visualAssetMode}
                  onValueChange={(val) => {
                    if (val) {
                      onVisualAssetModeChange(val as VisualAssetMode)
                    }
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select asset mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {VISUAL_ASSET_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {/* Video Sound Mode */}
            {onVideoSoundModeChange && (
              <Field>
                <FieldLabel>
                  <Volume2 className="size-3.5 text-muted-foreground" />
                  <span>Video Sound</span>
                </FieldLabel>
                <Select
                  value={videoSoundMode}
                  onValueChange={(val) => {
                    if (val) {
                      onVideoSoundModeChange(val as VideoSoundMode)
                    }
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select video sound" />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_SOUND_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          {/* Reset Defaults Action Bar */}
          {onResetDefaults && (
            <div className="flex items-center justify-between border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onResetDefaults}
                disabled={isDefault || disabled}
                className="gap-1.5"
                title="Reset production settings to default values"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset to Defaults</span>
              </Button>

              <span className="text-2xs text-muted-foreground">
                Settings persist automatically in browser
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
