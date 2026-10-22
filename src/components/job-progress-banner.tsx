"use client";

import * as React from "react";
import { Loader2, RefreshCw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobRecord } from "@/lib/types";

interface JobProgressBannerProps {
  job: JobRecord | null;
  onCancel?: () => Promise<void> | void;
  cancelling?: boolean;
}

export function JobProgressBanner({
  job,
  onCancel,
  cancelling = false,
}: JobProgressBannerProps) {
  if (!job || job.status !== "running") return null;

  return (
    <div className="border-b border-border bg-card/95 px-4 py-2 text-xs text-foreground backdrop-blur-xs">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <RefreshCw className="size-3.5 animate-spin text-primary" />
          <span className="font-semibold text-foreground">
            {job.message || "Planning scenes…"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar track */}
          <div className="h-2 w-32 overflow-hidden rounded-full bg-muted ring-1 ring-border">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <span className="font-mono font-medium tabular-nums text-muted-foreground">
            {job.progress}%
          </span>

          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={onCancel}
              className="h-7 gap-1.5 border-destructive/30 bg-destructive/10 px-2.5 text-xs font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-destructive"
              title="Stop scene planning"
            >
              {cancelling ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Square className="size-2.5 fill-current" />
              )}
              {cancelling ? "Stopping…" : "Stop"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
