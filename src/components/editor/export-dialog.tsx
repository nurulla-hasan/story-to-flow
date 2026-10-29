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
import { Badge } from "@/components/ui/badge";
import { useTimeline } from "@/lib/timeline-context";
import { useMediaLibrary } from "@/lib/use-media-library";
import {
  exportTimelineToMp4,
  calculateExportPlan,
  validateExportSafety,
  sanitizeFilename,
  checkWebCodecsSupport,
  type ExportOptions,
  type ExportProgress,
} from "@/lib/video-export-engine";
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
  const [isExporting, setIsExporting] = React.useState(false);
  const [progress, setProgress] = React.useState<ExportProgress | null>(null);
  const [exportedBlob, setExportedBlob] = React.useState<Blob | null>(null);
  const [exportedFilename, setExportedFilename] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  const abortControllerRef = React.useRef<AbortController | null>(null);
  const leaseReleaseRef = React.useRef<(() => void) | null>(null);

  // Route changes must cancel the render, but the release of Object URL leases
  // is owned by the export's finally block so URLs cannot disappear underneath
  // an operation that is still finishing.
  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const plan = React.useMemo(() => calculateExportPlan(clips, 30, tracks), [clips, tracks]);
  const webCodecsStatus = React.useMemo(() => checkWebCodecsSupport(), []);

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

  const safety = React.useMemo(() => {
    return validateExportSafety(plan, { width: resolution.width, height: resolution.height });
  }, [plan, resolution]);

  const triggerDownload = React.useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const handleStartExport = async () => {
    // Prevent starting duplicate concurrent exports
    if (isExporting) return;

    if (!safety.safe) {
      setError(safety.error || "Timeline exceeds safe export limits.");
      return;
    }

    // Keep every media Object URL referenced by the timeline alive for the
    // entire export, including during a route change or provider unmount.
    const referencedAssetIds = Array.from(new Set(clips.map((clip) => clip.assetId)));
    leaseReleaseRef.current = acquireAssetLease(referencedAssetIds);

    setError(null);
    setExportedBlob(null);
    setIsExporting(true);
    setProgress({
      phase: "preparing",
      currentFrame: 0,
      totalFrames: plan.totalFrames,
      percent: 0,
      message: "Starting video render pipeline...",
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const exportOptions: ExportOptions = {
      width: resolution.width,
      height: resolution.height,
      fps: 30,
    };

    const filename = `${sanitizeFilename(projectTitle)}_${resolution.width}x${resolution.height}.mp4`;
    setExportedFilename(filename);

    try {
      const blob = await exportTimelineToMp4({
        clips,
        transitions,
        tracks,
        assets,
        options: exportOptions,
        onProgress: (p) => setProgress(p),
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        setIsExporting(false);
        setError("Export was cancelled.");
        return;
      }

      setExportedBlob(blob);
      setIsExporting(false);
      // Auto-trigger browser download
      triggerDownload(blob, filename);
    } catch (err) {
      if (controller.signal.aborted) {
        setError("Export was cancelled.");
      } else {
        console.error("Export failed:", err);
        setError((err as Error).message || "Video rendering failed. Please try again.");
      }
      setIsExporting(false);
    } finally {
      abortControllerRef.current = null;
      if (leaseReleaseRef.current) {
        leaseReleaseRef.current();
        leaseReleaseRef.current = null;
      }
    }
  };

  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClose = () => {
    if (isExporting) {
      handleCancelExport();
    }
    setError(null);
    setProgress(null);
    setExportedBlob(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Film className="size-4" />
            </div>
            <div>
              <DialogTitle>Export MP4 Video</DialogTitle>
              <DialogDescription>
                Client-side {isLandscape ? "16:9 landscape" : "9:16 vertical"} video composition
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
          <div className="flex items-start gap-2 rounded-lg bg-warning-subtle border border-warning/20 p-3 text-2xs text-warning-foreground">
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
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-destructive/70 hover:text-destructive cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Active Export Progress State */}
        {isExporting && progress ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  <span>{progress.message}</span>
                </span>
                <span className="font-mono text-primary font-bold">{progress.percent}%</span>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  style={{ width: `${progress.percent}%` }}
                  className="h-full bg-primary transition-all duration-150 rounded-full"
                />
              </div>

              <div className="flex items-center justify-between text-3xs font-mono text-muted-foreground pt-1">
                <span>
                  Frame {progress.currentFrame} / {progress.totalFrames}
                </span>
                <span>30 FPS • Bounded Queue</span>
              </div>
            </div>

            <div className="flex items-start gap-1.5 rounded-lg bg-muted/40 p-2 text-3xs text-muted-foreground">
              <ShieldCheck className="size-3.5 shrink-0 text-primary mt-0.5" />
              <p className="leading-tight">
                Hardware encoding with bounded memory backpressure active. Do not close this browser tab while export is running.
              </p>
            </div>
          </div>
        ) : exportedBlob ? (
          /* Export Complete Success State */
          <div className="flex flex-col items-center justify-center text-center space-y-3 py-4 bg-muted/20 rounded-xl border border-border p-4">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <CheckCircle2 className="size-6" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Export Succeeded!</p>
              <p className="font-mono text-2xs text-muted-foreground truncate max-w-72">
                {exportedFilename}
              </p>
              <Badge variant="secondary" className="gap-1 mt-1">
                <HardDrive className="size-3" />
                <span>{formatBytes(exportedBlob.size)}</span>
              </Badge>
            </div>

            <Button
              onClick={() => triggerDownload(exportedBlob, exportedFilename)}
              className="gap-1.5 mt-2"
            >
              <Download className="size-4" />
              <span>Download MP4 Again</span>
            </Button>
          </div>
        ) : (
          /* Normal Configuration View */
          <div className="space-y-4 py-1">
            {/* Resolution Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  Output Resolution ({isLandscape ? "16:9 Landscape" : "9:16 Vertical"})
                </label>
                <span className="text-3xs text-muted-foreground">30 FPS Standard</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* 720p: Recommended Default */}
                <button
                  type="button"
                  onClick={() => setPreset("720p")}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    preset === "720p"
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-foreground">
                      {isLandscape ? "1280 × 720" : "720 × 1280"}
                    </span>
                    <Badge variant="secondary">Recommended</Badge>
                  </div>
                  <span className="text-3xs text-muted-foreground mt-1">
                    Fast &amp; Memory-Safe for Laptops
                  </span>
                </button>

                {/* 1080p: Optional Explicit Choice */}
                <button
                  type="button"
                  onClick={() => setPreset("1080p")}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    preset === "1080p"
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-foreground">
                      {isLandscape ? "1920 × 1080" : "1080 × 1920"}
                    </span>
                    <Badge variant="outline">Full HD</Badge>
                  </div>
                  <span className="text-3xs text-muted-foreground mt-1">
                    Higher RAM &amp; GPU Usage
                  </span>
                </button>
              </div>

              {/* 1080p Caution Warning */}
              {preset === "1080p" && (
                <div className="flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-3xs text-muted-foreground border border-border">
                  <AlertCircle className="size-3.5 shrink-0 text-muted-foreground mt-0.5" />
                  <p className="leading-tight">
                    1080p renders 2.07 million pixels per frame. If your laptop has limited RAM or shared graphics, 720p is recommended to prevent system slowdowns.
                  </p>
                </div>
              )}
            </div>

            {/* Timeline Summary Specs */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-2xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3" />
                  <span>Total Duration</span>
                </span>
                <span className="font-mono text-foreground font-semibold">
                  {formatDuration(plan.totalDuration)} ({plan.totalDuration.toFixed(1)}s)
                </span>
              </div>

              <div className="flex items-center justify-between text-2xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Film className="size-3" />
                  <span>Visual Scenes</span>
                </span>
                <span className="font-mono text-foreground">
                  {plan.visualClipsCount} {plan.visualClipsCount === 1 ? "clip" : "clips"}
                </span>
              </div>

              <div className="flex items-center justify-between text-2xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Sparkles className="size-3" />
                  <span>Audio Tracks</span>
                </span>
                <span className="font-mono text-foreground">
                  {plan.audioClipsCount} {plan.audioClipsCount === 1 ? "track" : "tracks"}
                </span>
              </div>

              <div className="flex items-center justify-between text-2xs border-t border-border pt-1.5">
                <span className="text-muted-foreground">Encoding Engine</span>
                <span className="font-mono text-foreground font-medium">
                  WebCodecs + Bounded Queue MP4
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
