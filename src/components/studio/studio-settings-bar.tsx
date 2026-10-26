"use client";

import Link from "next/link";
import { Sliders, Settings, Cpu } from "lucide-react";
import type { ProductionSettingsState } from "@/lib/settings-storage";

interface StudioSettingsBarProps {
  settings: ProductionSettingsState;
  model: string;
}

export function StudioSettingsBar({ settings, model }: StudioSettingsBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 sm:px-4 sm:py-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2 text-2xs">
        <span className="flex items-center gap-1.5 font-semibold text-foreground mr-1">
          <Sliders className="size-3.5 text-primary" />
          <span>Active Settings:</span>
        </span>

        <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-medium text-foreground">
          {settings.visualStyle === "Auto" ? "Auto Style" : settings.visualStyle}
        </span>

        <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-medium text-foreground">
          {settings.aspectRatio}
        </span>

        <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-medium text-foreground">
          {settings.duration === "Auto" ? "Auto Duration" : `${settings.duration}s`}
        </span>

        <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-medium text-foreground">
          {settings.staticFramePacing === "Auto" ? "Auto Pacing" : `${settings.staticFramePacing}s`}
        </span>

        <span
          className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-muted-foreground flex items-center gap-1"
          suppressHydrationWarning
        >
          <Cpu className="size-2.5 text-primary" />
          <span className="truncate max-w-28">{model}</span>
        </span>
      </div>

      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-2xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0 self-start sm:self-auto"
        title="Customize AI model and production settings in Settings"
      >
        <Settings className="size-3 text-primary" />
        <span>Customize in Settings</span>
      </Link>
    </div>
  );
}
