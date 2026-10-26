"use client"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Check,
  Copy,
  FileText,
  AlertCircle,
  Sparkles,
  Clock,
  Cpu,
  Layers,
  Mic,
  Film,
} from "lucide-react"
import type { StoryProcessResponse } from "@/lib/validation"

interface OutputCardProps {
  result: StoryProcessResponse | null
  error: string | null
  copied: boolean
  onCopyAll: () => void
}

function StylizedEmptyIllustration() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer ambient glow */}
      <div className="size-28 sm:size-32 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center relative">
        {/* Floating animated sparkles */}
        <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-card border border-primary/30 shadow-xs">
          <Sparkles className="size-3 text-primary animate-pulse" />
        </span>
        <span className="absolute bottom-1 -left-1 flex size-4 items-center justify-center rounded-full bg-card border border-border shadow-xs">
          <Sparkles className="size-2 text-primary" />
        </span>

        {/* Inner core card */}
        <div className="size-18 sm:size-20 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-center">
          <FileText className="size-8 sm:size-9 text-primary/80" />
        </div>
      </div>
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-info-subtle flex items-center justify-center shrink-0 border border-info-subtle-foreground/20">
              <FileText className="size-5 text-info-subtle-foreground" />
            </div>
            <div>
              <CardTitle>Generated Output</CardTitle>
              <CardDescription>
                Complete raw Markdown package ready for production
              </CardDescription>
            </div>
          </div>

          {/* Quick Copy Button when output is ready */}
          {result && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCopyAll}
              disabled={copied}
              className="gap-1.5"
              title="Copy entire production package to clipboard"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-success" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copy All</span>
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* 1. Empty State — Elegant, Centered & Informative */}
          {!result && !error && (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 sm:p-12 min-h-125 flex flex-col items-center justify-center text-center space-y-5">
              <StylizedEmptyIllustration />

              <div className="space-y-1.5 max-w-md">
                <h3 className="text-base font-bold text-foreground">
                  Your Production Package Awaits
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Write your story on the left, set your production preferences, and click
                  &ldquo;Generate Production Package&rdquo;. Your complete package will be compiled here.
                </p>
              </div>

              {/* Feature Highlights Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-2xs font-medium text-muted-foreground shadow-xs">
                  <Mic className="size-3 text-primary" />
                  <span>Bengali Voiceover</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-2xs font-medium text-muted-foreground shadow-xs">
                  <Film className="size-3 text-primary" />
                  <span>Scene Prompts</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-2xs font-medium text-muted-foreground shadow-xs">
                  <Clock className="size-3 text-primary" />
                  <span>Timing &amp; Camera Cues</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Error State — Clean, High-Contrast & Actionable */}
          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-destructive/20 border border-destructive/30 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="size-4.5 text-destructive" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-destructive leading-tight">
                    Generation Encountered an Issue
                  </h4>
                  <p className="text-xs text-destructive/90 leading-relaxed wrap-break-word">
                    {error}
                  </p>
                </div>
              </div>

              {/* Troubleshooting Tips */}
              <div className="rounded-xl border border-destructive/20 bg-card p-3.5 text-2xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground">Recommended troubleshooting:</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  <li>Verify that your AI Gateway server is reachable and active.</li>
                  <li>Check or select an alternative model in the Settings page.</li>
                  <li>Ensure your input story text does not exceed 50,000 characters.</li>
                </ul>
              </div>
            </div>
          )}

          {/* 3. Result State — Production Window with Telemetry & Raw Output */}
          {result && (
            <div className="space-y-3">
              {/* Telemetry Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-2xs">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Status Indicator */}
                  <span className="flex items-center gap-1.5 font-medium text-success">
                    <span className="size-2 rounded-full bg-success animate-pulse" />
                    <span>Package Ready</span>
                  </span>

                  <span className="text-muted-foreground">•</span>

                  {/* Active Model */}
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Cpu className="size-3 text-primary shrink-0" />
                    <span className="font-mono font-medium text-foreground">{result.metadata.modelUsed}</span>
                  </span>

                  <span className="text-muted-foreground">•</span>

                  {/* Prompt Version */}
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Layers className="size-3 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground">{result.metadata.promptVersion}</span>
                  </span>

                  <span className="text-muted-foreground">•</span>

                  {/* Generation Time */}
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground">{(result.metadata.processingTimeMs / 1000).toFixed(1)}s</span>
                  </span>
                </div>

                {/* Length badge */}
                <span className="font-mono text-muted-foreground">
                  {result.response.length.toLocaleString()} characters
                </span>
              </div>

              {/* Raw Markdown Output Container */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
                {/* Code Window Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full bg-border" />
                      <span className="size-2.5 rounded-full bg-border" />
                      <span className="size-2.5 rounded-full bg-border" />
                    </div>
                    <span className="text-2xs font-mono font-semibold text-foreground ml-1">
                      production-package.md
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCopyAll}
                    disabled={copied}
                    className="gap-1.5"
                    title="Copy full output"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3 text-success" />
                        <span className="text-2xs text-success font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3 text-muted-foreground" />
                        <span className="text-2xs text-muted-foreground">Copy</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Output Pre Block with Padding & Custom Scrollbar */}
                <div className="p-4 sm:p-6 max-h-160 overflow-y-auto bg-muted/10">
                  <pre className="whitespace-pre-wrap wrap-break-word text-xs font-mono text-foreground leading-relaxed select-text font-normal">
                    {result.response}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
