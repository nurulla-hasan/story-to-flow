"use client"

import { useState, useMemo } from "react"
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
  Code2,
} from "lucide-react"
import type { StoryProcessResponse } from "@/lib/validation"
import { parseProductionPackage } from "@/lib/output-parser"

interface OutputCardProps {
  result: StoryProcessResponse | null
  error: string | null
  copied: boolean
  onCopyAll: () => void
}

function StylizedEmptyIllustration() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="size-28 sm:size-32 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center relative">
        <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-card border border-primary/30 shadow-xs">
          <Sparkles className="size-3 text-primary animate-pulse" />
        </span>
        <span className="absolute bottom-1 -left-1 flex size-4 items-center justify-center rounded-full bg-card border border-border shadow-xs">
          <Sparkles className="size-2 text-primary" />
        </span>
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
  copied: copiedFullProp,
  onCopyAll,
}: OutputCardProps) {
  const [copiedVoiceover, setCopiedVoiceover] = useState(false)
  const [copiedScenes, setCopiedScenes] = useState(false)
  const [copiedSceneIndex, setCopiedSceneIndex] = useState<number | null>(null)
  const [showRawPackage, setShowRawPackage] = useState(false)

  // Parse raw response into Voiceover and Scene Prompts
  const parsed = useMemo(() => {
    return parseProductionPackage(result?.response)
  }, [result?.response])

  const handleCopyVoiceover = async () => {
    if (!parsed.voiceover) return
    try {
      await navigator.clipboard.writeText(parsed.voiceover)
      setCopiedVoiceover(true)
      setTimeout(() => setCopiedVoiceover(false), 2000)
    } catch {
      // Ignore clipboard write errors
    }
  }

  const handleCopyScenes = async () => {
    if (!parsed.scenesText) return
    try {
      await navigator.clipboard.writeText(parsed.scenesText)
      setCopiedScenes(true)
      setTimeout(() => setCopiedScenes(false), 2000)
    } catch {
      // Ignore clipboard write errors
    }
  }

  const handleCopySingleScene = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSceneIndex(index)
      setTimeout(() => setCopiedSceneIndex(null), 2000)
    } catch {
      // Ignore clipboard write errors
    }
  }

  // 1. Empty State — Initial view before generation
  if (!result && !error) {
    return (
      <Card>
        <CardHeader>
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
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 sm:p-12 min-h-125 flex flex-col items-center justify-center text-center space-y-5">
            <StylizedEmptyIllustration />
            <div className="space-y-1.5 max-w-md">
              <h3 className="text-base font-bold text-foreground">
                Your Production Package Awaits
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Write your story on the left, adjust your settings, and click
                &ldquo;Generate Production Package&rdquo;. The voiceover script and visual prompts will appear in separate dedicated cards.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-2xs font-medium text-muted-foreground shadow-xs">
                <Mic className="size-3 text-primary" />
                <span>Full Voiceover Card</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-2xs font-medium text-muted-foreground shadow-xs">
                <Film className="size-3 text-primary" />
                <span>Scene &amp; Image Prompts Card</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-2xs font-medium text-muted-foreground shadow-xs">
                <Clock className="size-3 text-primary" />
                <span>Provisional Timecodes</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 2. Error State
  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0 border border-destructive/30">
              <AlertCircle className="size-5 text-destructive" />
            </div>
            <div>
              <CardTitle>Generation Failed</CardTitle>
              <CardDescription>
                The AI service was unable to complete this generation request
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 sm:p-6 space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-destructive">Error Details</h4>
              <p className="text-xs text-destructive/90 leading-relaxed font-mono wrap-break-word">
                {error}
              </p>
            </div>
            <div className="rounded-xl border border-destructive/20 bg-card p-3.5 text-2xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground">Troubleshooting tips:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Verify your AI Gateway connection in Settings.</li>
                <li>Try selecting an alternative model in the Settings page.</li>
                <li>Check that the input story does not exceed the character limit.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 3. Result State — Render Telemetry Bar + Separated Cards
  return (
    <div className="space-y-6">
      {/* Telemetry Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs text-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium text-success">
            <span className="size-2 rounded-full bg-success animate-pulse" />
            <span>Production Ready</span>
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Cpu className="size-3 text-primary shrink-0" />
            <span className="font-mono font-medium text-foreground">{result?.metadata.modelUsed}</span>
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Layers className="size-3 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground">{result?.metadata.promptVersion}</span>
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground">
              {((result?.metadata.processingTimeMs || 0) / 1000).toFixed(1)}s
            </span>
          </span>
          {parsed.visualStyle && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                {parsed.visualStyle}
              </span>
            </>
          )}
        </div>

        {/* Global Action: Copy Full Original Package / Toggle View */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRawPackage(!showRawPackage)}
            className="gap-1.5"
            title="Toggle raw unparsed Markdown view"
          >
            <Code2 className="size-3.5" />
            <span>{showRawPackage ? "Show Structured View" : "View Raw Output"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onCopyAll}
            disabled={copiedFullProp}
            className="gap-1.5"
            title="Copy original full production package"
          >
            {copiedFullProp ? (
              <>
                <Check className="size-3.5 text-success" />
                <span>Copied Full Package</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy Full Package</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Raw Package Fallback / Inspection Mode */}
      {(showRawPackage || !parsed.success) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border">
                  <Code2 className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>Raw Production Package</CardTitle>
                  <CardDescription>
                    {parsed.fallbackMessage || "Unmodified full Markdown response from the AI model."}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onCopyAll}
                disabled={copiedFullProp}
                className="gap-1.5"
              >
                {copiedFullProp ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                <span>{copiedFullProp ? "Copied" : "Copy Raw"}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border bg-muted/20 p-4 max-h-140 overflow-y-auto">
              <pre className="whitespace-pre-wrap wrap-break-word font-mono text-xs text-foreground leading-relaxed select-text font-normal">
                {result?.response}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Structured Output Mode (Separated into Card A & Card B) */}
      {!showRawPackage && (
        <>
          {/* CARD A: Full Voiceover */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <Mic className="size-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Full Voiceover</CardTitle>
                    <CardDescription>
                      Continuous Bengali narration without markdown fences — ready for Cartesia TTS
                    </CardDescription>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyVoiceover}
                  disabled={copiedVoiceover || !parsed.voiceover}
                  className="gap-1.5"
                  title="Copy only the Bengali voiceover script"
                >
                  {copiedVoiceover ? (
                    <>
                      <Check className="size-3.5 text-success" />
                      <span>Copied Voiceover!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy Voiceover</span>
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {parsed.voiceover ? (
                <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                  <p className="whitespace-pre-wrap font-bangla text-base text-foreground leading-relaxed select-text">
                    {parsed.voiceover}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Voiceover section could not be isolated from the output. Use the raw output view above.
                </p>
              )}
            </CardContent>
          </Card>

          {/* CARD B: Scene & Image Prompts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-info-subtle flex items-center justify-center shrink-0 border border-info-subtle-foreground/20">
                    <Film className="size-5 text-info-subtle-foreground" />
                  </div>
                  <div>
                    <CardTitle>Scene &amp; Image Prompts</CardTitle>
                    <CardDescription>
                      Sequential prompts for Google Flow (per-scene voiceover lines omitted)
                    </CardDescription>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyScenes}
                  disabled={copiedScenes || !parsed.scenesText}
                  className="gap-1.5"
                  title="Copy all scene prompts in order"
                >
                  {copiedScenes ? (
                    <>
                      <Check className="size-3.5 text-success" />
                      <span>Copied All Scenes!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy All Scene Prompts</span>
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Timing Disclaimer Note (Requirement 4) */}
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-2xs text-muted-foreground border border-border/50">
                  <Clock className="size-3.5 text-primary shrink-0" />
                  <span>
                    Note: Scene timecodes are provisional estimates; final timing aligns when voiceover audio is rendered.
                  </span>
                </div>

                {/* Scene Blocks List */}
                {parsed.scenes.length > 0 ? (
                  <div className="space-y-3.5">
                    {parsed.scenes.map((scene, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-2.5 transition-colors hover:border-primary/40"
                      >
                        {/* Scene Header + Single Scene Copy Button */}
                        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {scene.header}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopySingleScene(scene.fullBlock, idx)}
                            className="gap-1"
                            title="Copy this scene entry"
                          >
                            {copiedSceneIndex === idx ? (
                              <>
                                <Check className="size-3 text-success" />
                                <span className="text-2xs text-success">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3 text-muted-foreground" />
                                <span className="text-2xs text-muted-foreground">Copy</span>
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Scene Block Text (without voiceover) */}
                        <pre className="whitespace-pre-wrap wrap-break-word font-mono text-xs text-foreground/90 leading-relaxed select-text font-normal">
                          {scene.fullBlock}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Scene prompts could not be isolated. Use the raw output view above.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
