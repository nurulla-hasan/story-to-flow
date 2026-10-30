"use client";

import * as React from "react";
import { useTimelineState } from "@/lib/timeline-context";
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

type ResolutionPreset = "720p" | "1080p";

/**
 * Owns export orchestration, cancellation, media URL leases, and export state.
 * The dialog remains a presentation layer and only renders this hook's state.
 */
export function useExportJob(onOpenChange: (open: boolean) => void) {
  const { tracks, clips, transitions, projectTitle, aspectRatio } = useTimelineState();
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


  return {
    preset,
    setPreset,
    isExporting,
    progress,
    exportedBlob,
    exportedFilename,
    error,
    setError,
    plan,
    webCodecsStatus,
    isLandscape,
    resolution,
    safety,
    triggerDownload,
    handleStartExport,
    handleCancelExport,
    handleClose,
  };
}
