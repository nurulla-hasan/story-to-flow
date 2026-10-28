"use client";

import Link from "next/link";
import { Sliders, Settings, RotateCcw } from "lucide-react";
import type { ProductionSettingsState } from "@/lib/settings-storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface StudioSettingsBarProps {
  settings: ProductionSettingsState;
  model: string;
  onResetClick?: () => void;
}

export function StudioSettingsBar({
  settings,
  model,
  onResetClick,
}: StudioSettingsBarProps) {
  const styleLabel =
    settings.visualStyle === "Auto" ? "Auto Style" : settings.visualStyle;
  const pacingLabel =
    settings.staticFramePacing === "Auto"
      ? "Auto Pacing"
      : `${settings.staticFramePacing}s Static`;
  const videoDurationLabel = `${settings.videoAssetDuration || 4}s Video`;

  return (
    <Card>
      <CardContent>
        {/* Clean, Non-Wrapping Single-Line Toolbar */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Sliders Icon + Cohesive Settings Metadata */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0">
              <Sliders className="size-3.5 text-primary" />
            </div>

            <div className="flex items-center gap-2 text-xs truncate min-w-0">
              <span className="font-semibold text-foreground truncate">
                {styleLabel}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-muted-foreground shrink-0 font-medium">
                {settings.aspectRatio}
              </span>
              <span className="text-muted-foreground/40 hidden sm:inline">•</span>
              <span className="text-muted-foreground shrink-0 hidden sm:inline">
                {pacingLabel}
              </span>
              <span className="text-muted-foreground/40 hidden md:inline">•</span>
              <span className="text-muted-foreground shrink-0 hidden md:inline">
                {settings.visualAssetMode || "Hybrid"}
              </span>
              <span className="text-muted-foreground/40 hidden lg:inline">•</span>
              <span className="text-muted-foreground shrink-0 hidden lg:inline">
                {videoDurationLabel}
              </span>
              <span className="text-muted-foreground/40 hidden xl:inline">•</span>
              <span className="text-muted-foreground shrink-0 hidden xl:inline">
                {settings.videoSoundMode || "Silent Video"}
              </span>
              <span className="text-muted-foreground/40 hidden 2xl:inline">•</span>
              <span
                className="font-mono text-2xs text-muted-foreground/80 truncate hidden 2xl:inline max-w-36"
                title={model}
                suppressHydrationWarning
              >
                {model}
              </span>
            </div>
          </div>

          {/* Right: Actions (Customize in Settings + Reset Studio) */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shadow-2xs"
              title="Customize AI model and production settings in Settings"
            >
              <Settings className="size-3.5 text-primary" />
              <span>Customize</span>
            </Link>

            {onResetClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetClick}
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                title="Reset studio workspace and clear all current work"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset Studio</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
