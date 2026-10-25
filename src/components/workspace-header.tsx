"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, CheckCircle2, Download, Film, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkspaceHeaderProps {
  projectName?: string;
  doneCount: number;
  totalScenes: number;
  workflowMode?: "video-clips" | "shorts-animatic";
  shortsShotCount?: number;
  onOpenChat: () => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onOpenExtension: () => void;
}

export function WorkspaceHeader({
  projectName,
  doneCount,
  totalScenes,
  workflowMode = "video-clips",
  shortsShotCount = 0,
  onOpenChat,
  onOpenSettings,
  onOpenExport,
  onOpenExtension,
}: WorkspaceHeaderProps) {
  const isShortsMode = workflowMode === "shorts-animatic";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xs">
      <div className="flex h-14 w-full items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-xs tracking-wider text-primary-foreground shadow-xs">
            STF
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xs font-bold tracking-tight sm:text-sm">
              {projectName || "Story to Flow"}
            </h1>
            <p className="hidden truncate text-xs text-muted-foreground md:block">
              {isShortsMode
                ? "Shorts / Voiceover workflow · locked cast, clean Bangla TTS"
                : "AI video production plan · Google Flow consistency"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/studio"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 sm:h-9"
            title="CapCut-style Video Editor with timeline, image sync and MP4 export"
          >
            <Film className="size-3.5" />
            <span className="hidden sm:inline">Video Studio</span>
          </Link>

          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold tabular-nums text-foreground lg:inline-flex">
            <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
            {isShortsMode
              ? `${shortsShotCount} shots planned`
              : `${doneCount} of ${totalScenes} clips done`}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenExtension}
            className="h-8 w-8 gap-1.5 p-0 text-xs sm:h-9 sm:w-auto sm:px-2.5"
            title="Google Flow Auto-Bridge Extension"
          >
            <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="hidden md:inline">Flow Bridge</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenChat}
            className="h-8 w-8 gap-1.5 p-0 text-xs sm:h-9 sm:w-auto sm:px-2.5"
            title="Chat edit"
          >
            <Bot className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Chat</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className="h-8 w-8 gap-1.5 p-0 text-xs sm:h-9 sm:w-auto sm:px-2.5"
            title="Settings"
          >
            <Settings2 className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Settings</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onOpenExport}
            className="h-8 w-8 gap-1.5 p-0 text-xs sm:h-9 sm:w-auto sm:px-2.5"
            title="Export"
          >
            <Download className="size-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
