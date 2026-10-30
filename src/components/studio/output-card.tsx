"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, Check, Copy, FileText, Film } from "lucide-react";
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

function formatSize(text: string): string {
  const bytes = new TextEncoder().encode(text).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

interface CopyPanelProps {
  icon: ReactNode;
  title: string;
  meta: string;
  preview: string | null;
  copyLabel: string;
  emptyLabel: string;
  copied: boolean;
  onCopy: () => void;
}

function CopyPanel({
  icon,
  title,
  meta,
  preview,
  copyLabel,
  emptyLabel,
  copied,
  onCopy,
}: CopyPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{meta}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {preview ? (
          <pre className="max-h-40 flex-1 overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-muted/40 p-3 font-mono text-2xs leading-relaxed text-muted-foreground">
            {preview}
          </pre>
        ) : (
          <p className="flex-1 text-sm text-muted-foreground">{emptyLabel}</p>
        )}

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={onCopy}
          disabled={!preview || copied}
        >
          {copied ? (
            <Check className="size-4 text-success" />
          ) : (
            <Copy className="size-4" />
          )}
          {copied ? "Copied" : copyLabel}
        </Button>
      </CardContent>
    </Card>
  );
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
      setTimeout(
        () =>
          setCopiedTarget((current) => (current === target ? null : current)),
        2000,
      );
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
            Scene prompts and the timeline plan appear here once generation
            finishes.
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

  const scenesMeta = parsed.scenesText
    ? `${parsed.scenes.length} scene${parsed.scenes.length === 1 ? "" : "s"} · ${formatSize(parsed.scenesText)}`
    : "Not found in response";
  const planMeta = parsed.planJson
    ? formatSize(parsed.planJson)
    : "Not found in response";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
        <span className="font-mono text-foreground">
          {result.metadata.modelUsed}
        </span>
        <span aria-hidden>·</span>
        <span>{result.metadata.promptVersion}</span>
        <span aria-hidden>·</span>
        <span>{(result.metadata.processingTimeMs / 1000).toFixed(1)}s</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CopyPanel
          icon={<Film className="size-4 text-primary" />}
          title="Scene prompts"
          meta={scenesMeta}
          preview={parsed.scenesText}
          copyLabel="Copy all scenes"
          emptyLabel="Scene prompts could not be isolated from the generated response."
          copied={copiedTarget === "all-scenes"}
          onCopy={() => copyText("all-scenes", parsed.scenesText)}
        />

        <CopyPanel
          icon={<FileText className="size-4 text-primary" />}
          title="Timeline JSON"
          meta={planMeta}
          preview={parsed.planJson}
          copyLabel="Copy JSON"
          emptyLabel="A valid machine-readable JSON block was not found in the generated response."
          copied={copiedTarget === "plan-json"}
          onCopy={() => copyText("plan-json", parsed.planJson)}
        />
      </div>
    </div>
  );
}
