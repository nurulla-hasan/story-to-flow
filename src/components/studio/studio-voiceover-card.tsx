"use client";

import * as React from "react";
import { Check, Copy, Download, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ShortsPacing } from "@/lib/types";

interface StudioVoiceoverCardProps {
  voiceover: string;
  totalDuration: number;
  clipCount: number;
  pacing?: ShortsPacing;
  copiedVoiceover: boolean;
  onCopyVoiceover: () => void;
  onDownloadVoiceover: () => void;
}

export function StudioVoiceoverCard({
  voiceover,
  totalDuration,
  clipCount,
  pacing = "auto",
  copiedVoiceover,
  onCopyVoiceover,
  onDownloadVoiceover,
}: StudioVoiceoverCardProps) {
  const pacingLabel = pacing === "auto" ? "2.5–5s auto" : `${pacing}s each`;
  return (
    <div className="rounded-xl border border-brand-border bg-card p-4 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mic className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Complete Story Voiceover Paragraph
            </h2>
            <p className="text-2xs text-muted-foreground">
              Continuous narration text for CapCut Text-to-Speech (TTS) or reading aloud into a mic
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onCopyVoiceover}
            className="h-8 gap-1.5 px-3 text-xs font-semibold"
          >
            {copiedVoiceover ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copiedVoiceover ? "Copied Script!" : "Copy for CapCut TTS"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onDownloadVoiceover}
            className="h-8 gap-1.5 px-2.5 text-xs"
            title="Download voiceover as .txt"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">.txt</span>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-brand-subtle/50 p-4 font-bangla text-base leading-relaxed text-secondary-foreground whitespace-pre-line select-all max-h-48 overflow-y-auto">
        {voiceover}
      </div>

      <div className="flex items-center justify-between text-2xs text-muted-foreground pt-0.5">
        <span>
          Total Runtime: ~{totalDuration.toFixed(0)}s ({clipCount} images • {pacingLabel})
        </span>
        <span>Language: Bangla</span>
      </div>
    </div>
  );
}
