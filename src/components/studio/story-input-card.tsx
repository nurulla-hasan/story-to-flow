"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

interface StoryInputCardProps {
  story: string
  onChange: (value: string) => void
  onClear?: () => void
  validationError?: string | null
  disabled?: boolean
}

function StoryInputHeaderIcon({ className = "size-5" }: { className?: string }) {
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
      <rect width="18" height="18" x="3" y="3" rx="3.5" />
      <path d="M7 8h10" />
      <path d="M7 12h8" />
      <path d="M7 16h5" />
    </svg>
  )
}

export function StoryInputCard({
  story,
  onChange,
  onClear,
  validationError,
  disabled = false,
}: StoryInputCardProps) {
  return (
    <Card className="rounded-2xl border border-border shadow-xs bg-card overflow-hidden">
      <CardContent>
        <div className="space-y-4">
          {/* Card Header with Icon */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-brand-subtle flex items-center justify-center shrink-0 border border-brand-border/40">
              <StoryInputHeaderIcon className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">
                Story Input
              </h2>
              <p className="text-xs text-muted-foreground font-bangla">
                বাংলা বা ইংরেজিতে আপনার গল্প লিখুন
              </p>
            </div>
          </div>

          {/* Text Area using shadcn Textarea */}
          <Textarea
            id="story-input"
            value={story}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="আজ তোমাদের শোনাবো রীনা আর করিমের গল্প—দুই পুরোনো বন্ধুর, যাদের জীবনে এক ভোরের দেখা ফিরিয়ে এনেছিল বহু বছরের ফেলে আসা স্মৃতি..."
            className="w-full min-h-64 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground/60 text-sm font-bangla leading-relaxed resize-none disabled:cursor-not-allowed disabled:opacity-50"
          />

          {/* Footer Bar: Counter & Clear Button */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {story.length.toLocaleString()} / 50,000
            </span>

            <div className="flex items-center gap-3">
              {validationError && (
                <span className="text-xs text-destructive font-medium">
                  {validationError}
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClear}
                disabled={disabled || !story}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear input"
              >
                <Trash2 className="size-3.5" />
                <span>Clear</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}