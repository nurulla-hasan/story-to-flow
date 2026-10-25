"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clapperboard,
  FileText,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudioHeaderProps {
  clipCount: number;
  attachedCount: number;
  onImportAllImages: () => void;
  onClearAllImages: () => void;
  onDownloadPrompts: () => void;
}

export function StudioHeader({
  clipCount,
  attachedCount,
  onImportAllImages,
  onClearAllImages,
  onDownloadPrompts,
}: StudioHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xs">
      <div className="flex h-14 w-full items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Return to Video Prompt Planner"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-xs tracking-wider text-primary-foreground shadow-xs sm:flex">
            STF
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold tracking-tight">
              Story-to-Video Studio
            </h1>
            <p className="hidden truncate text-xs text-muted-foreground md:block">
              Continuous Voiceover Script &amp; Sequential Google Flow Image Prompts
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="hidden h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:inline-flex sm:h-9"
          >
            <Clapperboard className="size-3.5" />
            <span className="hidden lg:inline">Flow Prompts</span>
          </Link>

          {clipCount > 0 ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onImportAllImages}
                className="h-8 gap-1.5 px-2.5 text-xs sm:h-9"
                title="Import/upload all generated images from Flow at once"
              >
                <Upload className="size-3.5" />
                <span className="hidden lg:inline">Import All Images</span>
                {attachedCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-2xs font-semibold text-primary">
                    {attachedCount}/{clipCount}
                  </span>
                ) : null}
              </Button>

              {attachedCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onClearAllImages}
                  className="h-8 gap-1 px-2 text-2xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:h-9"
                  title="Remove all attached images from clips"
                >
                  <Trash2 className="size-3.5" />
                  <span className="hidden xl:inline">Clear Images</span>
                </Button>
              ) : null}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onDownloadPrompts}
                className="h-8 gap-1.5 px-2.5 text-xs sm:h-9"
                title="Download all image prompts as a formatted .txt file"
              >
                <FileText className="size-3.5" />
                <span className="hidden lg:inline">Download Prompts</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
