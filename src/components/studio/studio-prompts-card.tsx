"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudioPromptsCardProps {
  clipCount: number;
  totalDuration: number;
  aspectRatio: "9:16" | "16:9";
  attachedCount: number;
  allPromptsFormatted: string;
  sendingAllFlow: boolean;
  copiedAllPrompts: boolean;
  showDetailedCards: boolean;
  onSendAllToFlow: () => void;
  onCopyAllPrompts: () => void;
  onDownloadPrompts: () => void;
  onToggleDetailedCards: () => void;
}

export function StudioPromptsCard({
  clipCount,
  totalDuration,
  aspectRatio,
  attachedCount,
  allPromptsFormatted,
  sendingAllFlow,
  copiedAllPrompts,
  showDetailedCards,
  onSendAllToFlow,
  onCopyAllPrompts,
  onDownloadPrompts,
  onToggleDetailedCards,
}: StudioPromptsCardProps) {
  return (
    <div className="rounded-xl border border-brand-border bg-card p-4 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ImageIcon className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Sequential Google Flow Image Prompts ({clipCount})
            </h2>
            <p className="text-2xs text-muted-foreground">
              All image prompts in sequential order (~{totalDuration.toFixed(0)}s • {aspectRatio})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onSendAllToFlow}
            disabled={sendingAllFlow}
            className="h-8 gap-1.5 px-3 text-xs font-semibold"
            title="Send prompts to Google Flow"
          >
            {sendingAllFlow ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>{sendingAllFlow ? "Sending…" : "🚀 Send to Flow"}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCopyAllPrompts}
            className="h-8 gap-1.5 px-3 text-xs font-semibold"
          >
            {copiedAllPrompts ? (
              <Check className="size-3.5 text-success" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span>{copiedAllPrompts ? "Copied All!" : "Copy All Prompts"}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onDownloadPrompts}
            className="h-8 gap-1.5 px-2.5 text-xs"
            title="Download prompts as .txt"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">.txt</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-2xs text-muted-foreground"
            onClick={onToggleDetailedCards}
          >
            <ChevronsUpDown className="size-3.5" />
            <span>{showDetailedCards ? "Hide Cards" : "Cards View"}</span>
          </Button>
        </div>
      </div>

      {/* Formatted Prompts Text Box */}
      <div className="rounded-lg border border-border bg-surface-subtle/80 p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-line select-all max-h-52 overflow-y-auto">
        {allPromptsFormatted}
      </div>

      <div className="flex items-center justify-between text-2xs text-muted-foreground pt-0.5">
        <span>
          {attachedCount}/{clipCount} images attached in timeline
        </span>
        <span>Aspect: {aspectRatio}</span>
      </div>
    </div>
  );
}
