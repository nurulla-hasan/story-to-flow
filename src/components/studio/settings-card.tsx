"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Palette, Clock, Image as ImageIcon, Settings } from "lucide-react"

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

const DURATION_OPTIONS = [
  { value: "Auto", label: "Auto" },
  { value: "20", label: "20 seconds" },
  { value: "30", label: "30 seconds" },
  { value: "45", label: "45 seconds" },
  { value: "60", label: "60 seconds" },
  { value: "90", label: "90 seconds" },
  { value: "120", label: "120 seconds" },
] as const

const PACING_OPTIONS = [
  { value: "Auto", label: "Auto" },
  { value: "2.5", label: "2.5s per image" },
  { value: "3.0", label: "3.0s per image" },
  { value: "4.0", label: "4.0s per image" },
  { value: "5.0", label: "5.0s per image" },
] as const

interface SettingsCardProps {
  visualStyle: string
  onVisualStyleChange: (value: string) => void
  aspectRatio: "9:16" | "16:9"
  onAspectRatioChange: (value: "9:16" | "16:9") => void
  duration: "Auto" | number
  onDurationChange: (value: "Auto" | number) => void
  staticFramePacing: "Auto" | number
  onStaticFramePacingChange: (value: "Auto" | number) => void
  disabled?: boolean
}

export function SettingsCard({
  visualStyle,
  onVisualStyleChange,
  aspectRatio,
  onAspectRatioChange,
  duration,
  onDurationChange,
  staticFramePacing,
  onStaticFramePacingChange,
  disabled = false,
}: SettingsCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-brand-subtle flex items-center justify-center shrink-0 border border-brand-border/40">
              <Settings className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">
                Production Settings
              </h2>
              <p className="text-xs text-muted-foreground font-bangla mt-0.5">
                কনটেন্ট অনুযায়ী আপনার পছন্দের সেটিংস নির্বাচন করুন
              </p>
            </div>
          </div>

          {/* 2x2 Grid of Dropdowns */}
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
                      {style}
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

            {/* Duration */}
            <Field>
              <FieldLabel>
                <Clock className="size-3.5 text-muted-foreground" />
                <span>Duration</span>
              </FieldLabel>
              <Select
                value={String(duration)}
                onValueChange={(val) => {
                  if (val) {
                    onDurationChange(val === "Auto" ? "Auto" : Number(val))
                  }
                }}
                disabled={disabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Static Frame Pacing */}
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
            </Field>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
