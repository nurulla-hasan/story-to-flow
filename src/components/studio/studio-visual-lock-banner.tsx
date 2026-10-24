"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";

interface StudioVisualLockBannerProps {
  characterVisualLock: string;
}

export function StudioVisualLockBanner({
  characterVisualLock,
}: StudioVisualLockBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3.5 shadow-xs">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <ShieldCheck className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <h3 className="text-xs font-bold text-foreground">
            Character Visual Lock (100% Identity Consistency)
          </h3>
          <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-3xs font-semibold text-primary">
            Anchored In Every Prompt
          </span>
        </div>
        <p className="font-mono text-2xs leading-relaxed text-muted-foreground select-all">
          {characterVisualLock}
        </p>
      </div>
    </div>
  );
}
