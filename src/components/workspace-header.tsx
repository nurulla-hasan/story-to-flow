"use client";

import * as React from "react";
import { Bot, CheckCircle2, Download, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkspaceHeaderProps {
  projectName?: string;
  doneCount: number;
  totalScenes: number;
  onOpenChat: () => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
}

export function WorkspaceHeader({
  projectName,
  doneCount,
  totalScenes,
  onOpenChat,
  onOpenSettings,
  onOpenExport,
}: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xs">
      <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-xs tracking-wider text-primary-foreground shadow-xs">
            STF
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-tight">
              {projectName || "Story to Flow"}
            </h1>
            <p className="text-xs text-muted-foreground">
              AI video production plan · Google Flow consistency
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold tabular-nums text-foreground sm:inline-flex">
            <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
            {doneCount} of {totalScenes} clips done
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenChat}
            className="h-9 gap-1.5 text-xs"
          >
            <Bot className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Chat edit</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className="h-9 gap-1.5 text-xs"
          >
            <Settings2 className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Settings</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onOpenExport}
            className="h-9 gap-1.5 text-xs"
          >
            <Download className="size-3.5" aria-hidden />
            Export
          </Button>
        </div>
      </div>
    </header>
  );
}
