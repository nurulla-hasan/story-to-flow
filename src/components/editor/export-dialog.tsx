"use client";

import * as React from "react";
import {
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Film,
  Clock,
  HardDrive,
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTimeline } from "@/lib/timeline-context";
import { useMediaLibrary } from "@/lib/use-media-library";
import { useExportJob } from "@/lib/use-export-job";
import { formatBytes, formatDuration } from "@/lib/media-helpers";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ResolutionPreset = "720p" | "1080p";

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { tracks, clips, transitions, projectTitle, aspectRatio } = useTimeline();
  const { assets, acquireAssetLease } = useMediaLibrary();

  // Conservative default: 720p for memory safety on laptops and mobile devices
  const [preset, setPreset] = React.useState<ResolutionPreset>("720p");
  // Resolution dimensions reflecting active project aspect ratio (16:9 landscape vs 9:16 vertical)
  const isLandscape = aspectRatio === "16:9";
  const resolution = React.useMemo(() => {
    if (isLandscape) {
      if (preset === "1080p") return { width: 1920, height: 1080 };
      return { width: 1280, height: 720 };
    }
    if (preset === "1080p") return { width: 1080, height: 1920 };
    return { width: 720, height: 1280 };
  }, [preset, isLandscape]);

  const {
    isExporting,
    progress,
    exportedBlob,
    exportedFilename,
    error,
    plan,
    webCodecsStatus,
    safety,
    handleStartExport,
    handleCancelExport,
    resetExportState,
  } = useExportJob({
    clips,
    transitions,
    tracks,
    assets,
    projectTitle,
    resolution,
    acquireAssetLease,
  });

  const handleClose = () => {
    if (isExporting) handleCancelExport();
    resetExportState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand-subtle text-primary ring-1 ring-brand-border">
              <Film className="size-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Export MP4 video</DialogTitle>
              <DialogDescription>
                Client-side render · {isLandscape ? "16:9 landscape" : "9:16 vertical"} · 30 fps
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Browser WebCodecs compatibility check */}
        {!webCodecsStatus.supported && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-2xs text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">WebCodecs not supported</p>
              <p className="mt-0.5 leading-relaxed">{webCodecsStatus.reason}</p>
            </div>
          </div>
        )}

        {/* Safety error if duration exceeds limit */}
        {!safety.safe && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-2xs text-destructive">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Export Safety Guard</p>
              <p className="mt-0.5 leading-relaxed">{safety.error}</p>
            </div>
          </div>
        )}

        {/* Safety warning for high resolution / long duration */}
        {safety.safe && safety.warning && (
          <div className="flex items-start gap-2 rounded-lg bg-warning-subtle border border-warning/20 p-3 text-2xs text-warning-subtle-foreground">
            <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" />
            <div>
              <p className="font-semibold text-warning">Export Memory Warning</p>
              <p className="mt-0.5 leading-relaxed">{safety.warning}</p>
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="flex items-start justify-between gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-2xs text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <p className="leading-tight">{error}</p>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => setError(null)} aria-label="Dismiss error">
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Active Export Progress State */}
        {isExporting && progress ? (
          <div className="space-y-3 rounded-xl border border-border bg-surface-subtle/70 p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs font-medium">
                <span className="flex min-w-0 items-center gap-1.5 text-foreground">
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                  <span className="truncate">{progress.message}</span>
                </span>
                <span className="shrink-0 font-mono text-primary">{progress.percent}%</span>
              </div>

              {/* Progress Bar Container */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  style={{ width: `${progress.percent}%` }}
                  className="h-full rounded-full bg-primary transition-all duration-150"
                />
              </div>

              <div className="flex items-center justify-between pt-0.5 font-mono text-3xs text-muted-foreground">
                <span>
                  Frame {progress.currentFrame} / {progress.totalFrames}
                </span>
                <span>30 fps · bounded queue</span>
              </div>
            </div>

            <div className="flex items-start gap-1.5 rounded-lg bg-muted/40 p-2 text-3xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <p className="leading-tight">
                Hardware encoding with bounded memory backpressure active. Do not close this browser tab while export is running.
              </p>
            </div>
          </div>
        ) : exportedBlob ? (
          /* Export Complete Success State */
          <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-border bg-surface-subtle/70 p-5 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
              <CheckCircle2 className="size-5" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Export ready</p>
              <p className="max-w-72 truncate font-mono text-2xs text-muted-foreground">
                {exportedFilename}
              </p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-3xs text-muted-foreground">
                <HardDrive className="size-3" />
                <span>{formatBytes(exportedBlob.size)}</span>
              </span>
            </div>

            <Button
              onClick={() => triggerDownload(exportedBlob, exportedFilename)}
              className="mt-1 gap-1.5"
            >
              <Download className="size-4" />
              <span>Download again</span>
            </Button>
          </div>
        ) : (
          /* Normal Configuration View */
          <div className="space-y-3">
            {/* Resolution Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Output resolution
                </span>
                <span className="font-mono text-3xs text-muted-foreground">
                  {isLandscape ? "16:9" : "9:16"} · 30 fps
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: "720p" as const,
                      label: isLandscape ? "1280 × 720" : "720 × 1280",
                      note: "Fast & memory-safe",
                      badge: "Recommended",
                    },
                    {
                      id: "1080p" as const,
                      label: isLandscape ? "1920 × 1080" : "1080 × 1920",
                      note: "Higher RAM & GPU usage",
                      badge: "Full HD",
                    },
                  ]
                ).map((option) => {
                  const isActive = preset === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPreset(option.id)}
                      aria-pressed={isActive}
                      className={`flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-150 ${
                        isActive
                          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
                          : "border-border bg-card hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-1">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {option.label}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-mono text-3xs uppercase tracking-wide ${
                            isActive
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {option.badge}
                        </span>
                      </div>
                      <span className="text-3xs text-muted-foreground">{option.note}</span>
                    </button>
                  );
                })}
              </div>

              {/* 1080p Caution Warning */}
              {preset === "1080p" && (
                <div className="flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-3xs text-muted-foreground">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <p className="leading-tight">
                    1080p renders 2.07 million pixels per frame. On limited RAM or shared
                    graphics, 720p avoids system slowdowns.
                  </p>
                </div>
              )}
            </div>

            {/* Timeline Summary Specs */}
            <div className="rounded-xl border border-border bg-surface-subtle/70">
              <div className="flex items-center justify-between px-3 py-2 text-2xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3" />
                  <span>Total duration</span>
                </span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {formatDuration(plan.totalDuration)} · {plan.totalDuration.toFixed(1)}s
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-2xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Film className="size-3" />
                  <span>Visual scenes</span>
                </span>
                <span className="font-mono tabular-nums text-foreground">
                  {plan.visualClipsCount}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-2xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="size-3" />
                  <span>Audio tracks</span>
                </span>
                <span className="font-mono tabular-nums text-foreground">
                  {plan.audioClipsCount}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-2xs">
                <span className="text-muted-foreground">Encoding</span>
                <span className="font-mono text-3xs text-foreground">
                  WebCodecs · bounded queue MP4
                </span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {isExporting ? (
            <Button
              variant="destructive"
              onClick={handleCancelExport}
              className="w-full gap-1.5"
            >
              <X className="size-4" />
              <span>Cancel Export</span>
            </Button>
          ) : exportedBlob ? (
            <Button variant="outline" onClick={handleClose} className="w-full">
              Done
            </Button>
          ) : (
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleStartExport}
                disabled={isExporting || !webCodecsStatus.supported || plan.totalFrames === 0 || !safety.safe}
                className="gap-1.5"
              >
                <Download className="size-4" />
                <span>Start Export</span>
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
