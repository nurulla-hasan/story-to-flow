"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  Cpu,
  Copy,
  FileText,
  Film,
  Layers,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StoryProcessResponse } from "@/lib/validation";
import { parseProductionPackage } from "@/lib/output-parser";

interface OutputCardProps {
  result: StoryProcessResponse | null;
  error: string | null;
}

export function OutputCard({ result, error }: OutputCardProps) {
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const parsed = useMemo(
    () => parseProductionPackage(result?.response),
    [result?.response],
  );

  const copyText = async (target: string, text: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget((current) => current === target ? null : current), 2000);
    } catch {
      // Ignore clipboard write errors.
    }
  };

  if (!result && !error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Generated Output</CardTitle>
          <CardDescription>
            Scene and shot prompts, with the timeline plan JSON in a separate copyable section.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Generate scene prompts to see them here.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Generation Failed</CardTitle>
          <CardDescription>
            The AI service was unable to complete this generation request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-success">
          <span className="size-2 rounded-full bg-success" />
          Production ready
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Cpu className="size-3 text-primary" />
          <span className="font-mono text-foreground">{result.metadata.modelUsed}</span>
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Layers className="size-3" />
          <span>{result.metadata.promptVersion}</span>
        </span>
        <span className="text-muted-foreground">•</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" />
          <span>{(result.metadata.processingTimeMs / 1000).toFixed(1)}s</span>
        </span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Film className="size-5 text-primary" />
              <div>
                <CardTitle>Scene &amp; Image Prompts</CardTitle>
                <CardDescription>
                  Voiceover lines are omitted. Copy all prompts together or copy a scene individually.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyText("all-scenes", parsed.scenesText)}
              disabled={!parsed.scenesText || copiedTarget === "all-scenes"}
              className="gap-1.5"
            >
              {copiedTarget === "all-scenes" ? (
                <>
                  <Check className="size-3.5 text-success" />
                  <span>Copied prompts</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copy all prompts</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {parsed.scenes.length > 0 ? (
            <div className="space-y-3">
              {parsed.scenes.map((scene, index) => {
                const target = "scene-" + index;
                return (
                  <div key={target} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {scene.header}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyText(target, scene.fullBlock)}
                        className="gap-1"
                      >
                        {copiedTarget === target ? (
                          <>
                            <Check className="size-3 text-success" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Copy scene</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap wrap-break-word font-mono text-xs leading-relaxed text-foreground/90">
                      {scene.fullBlock}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Scene prompts could not be isolated from the generated response.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-primary" />
              <div>
                <CardTitle>Timeline Plan JSON</CardTitle>
                <CardDescription>
                  Structured scene, shot, duration, motion, and transition data. Copy as valid JSON without Markdown fences.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyText("plan-json", parsed.planJson)}
              disabled={!parsed.planJson || copiedTarget === "plan-json"}
              className="gap-1.5"
            >
              {copiedTarget === "plan-json" ? (
                <>
                  <Check className="size-3.5 text-success" />
                  <span>Copied JSON</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {parsed.planJson ? (
            <pre className="max-h-140 overflow-auto whitespace-pre-wrap wrap-break-word rounded-xl border border-border bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground">
              {parsed.planJson}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              A valid machine-readable JSON block was not found in the generated response.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
