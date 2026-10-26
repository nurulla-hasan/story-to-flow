"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Copy, FileText, AlertCircle } from "lucide-react"
import type { StoryProcessResponse } from "@/lib/validation"

interface OutputCardProps {
  result: StoryProcessResponse | null
  error: string | null
  copied: boolean
  onCopyAll: () => void
}

function EmptyOutputIllustration() {
  return (
    <div className="size-32 rounded-full bg-info-subtle/50 border border-info-subtle-foreground/15 flex items-center justify-center relative">
      {/* 4-pointed sparkle star top-right */}
      <svg
        className="size-5 text-primary absolute top-4 right-6 animate-pulse"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2L14 9L21 11L14 13L12 20L10 13L3 11L10 9L12 2Z" />
      </svg>
      {/* 4-pointed sparkle star top-right small */}
      <svg
        className="size-3 text-primary absolute top-10 right-4"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2L14 9L21 11L14 13L12 20L10 13L3 11L10 9L12 2Z" />
      </svg>
      {/* 4-pointed sparkle star bottom-left */}
      <svg
        className="size-4 text-primary absolute bottom-8 left-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2L14 9L21 11L14 13L12 20L10 13L3 11L10 9L12 2Z" />
      </svg>

      {/* Folded Document Icon */}
      <svg
        viewBox="0 0 48 56"
        fill="none"
        stroke="currentColor"
        className="w-11 h-14 text-primary"
        aria-hidden="true"
      >
        <path
          d="M6 3 H32 L42 13 V51 C42 52.6 40.6 54 39 54 H6 C4.4 54 3 52.6 3 51 V6 C3 4.4 4.4 3 6 3 Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="var(--card)"
        />
        <path
          d="M32 3 V13 H42"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="11" y1="23" x2="26" y2="23" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="11" y1="31" x2="34" y2="31" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="11" y1="39" x2="24" y2="39" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export function OutputCard({
  result,
  error,
  copied,
  onCopyAll,
}: OutputCardProps) {
  return (
    <Card className="rounded-2xl border border-border shadow-xs bg-card overflow-hidden">
      <CardContent>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-info-subtle flex items-center justify-center shrink-0 border border-info-subtle-foreground/20">
                <FileText className="size-5 text-info-subtle-foreground" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground leading-tight">
                  Generated Output
                </h2>
                <p className="text-xs text-muted-foreground">
                  Complete raw Markdown/text from the AI
                </p>
              </div>
            </div>

            {/* Copy Button when output is available */}
            {result && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCopyAll}
                disabled={copied}
                className="rounded-xl border-border hover:bg-muted text-xs font-semibold"
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 size-3.5 text-success" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 size-3.5" />
                    Copy All
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Empty State matching Screenshot */}
          {!result && !error && (
            <div className="rounded-2xl bg-muted/30 border border-border/50 min-h-96 flex flex-col items-center justify-center text-center">
              <EmptyOutputIllustration />

              <h3 className="text-sm font-bold text-foreground">
                Your generated output will appear here
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                After clicking Generate, you&apos;ll see the complete production package
                including all scenes, prompts and metadata.
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 flex items-start gap-3">
              <AlertCircle className="size-5 text-destructive shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-destructive">Generation Error</h4>
                <p className="text-xs text-destructive/90">{error}</p>
              </div>
            </div>
          )}

          {/* Result State */}
          {result && (
            <div className="space-y-3">
              {/* Metadata pill */}
              <div className="flex flex-wrap items-center gap-2 text-2xs font-medium text-muted-foreground bg-muted/60 rounded-lg border border-border/50">
                <span>Model: {result.metadata.modelUsed}</span>
                <span>•</span>
                <span>Version: {result.metadata.promptVersion}</span>
                <span>•</span>
                <span>Time: {(result.metadata.processingTimeMs / 1000).toFixed(1)}s</span>
              </div>

              {/* Raw Markdown Output */}
              <div className="rounded-xl border border-border bg-muted/30 max-h-125 overflow-y-auto">
                <pre className="whitespace-pre-wrap break-words text-xs font-mono text-foreground leading-relaxed select-text">
                  {result.response}
                </pre>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}