"use client";

import * as React from "react";
import type { TimelineClip, TimelineTransition, TimelineTrack } from "@/types/timeline";
import type { MediaAssetItem } from "@/lib/media-storage";
import {
  calculateExportPlan,
  checkWebCodecsSupport,
  exportTimelineToMp4,
  sanitizeFilename,
  validateExportSafety,
  type ExportOptions,
  type ExportProgress,
} from "@/lib/video-export-engine";

interface UseExportJobOptions {
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  tracks: TimelineTrack[];
  assets: MediaAssetItem[];
  projectTitle: string;
  resolution: { width: number; height: number };
  acquireAssetLease: (assetIds: Iterable<string>) => () => void;
}

export function useExportJob({
  clips,
  transitions,
  tracks,
  assets,
  projectTitle,
  resolution,
  acquireAssetLease,
}: UseExportJobOptions) {
  const [isExporting, setIsExporting] = React.useState(false);
  const [progress, setProgress] = React.useState<ExportProgress | null>(null);
  const [exportedBlob, setExportedBlob] = React.useState<Blob | null>(null);
  const [exportedFilename, setExportedFilename] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const leaseReleaseRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  const plan = React.useMemo(() => calculateExportPlan(clips, 30, tracks), [clips, tracks]);
  const webCodecsStatus = React.useMemo(() => checkWebCodecsSupport(), []);
  const safety = React.useMemo(
    () => validateExportSafety(plan, resolution),
    [plan, resolution],
  );

  const triggerDownload = React.useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const handleStartExport = React.useCallback(async () => {
    if (isExporting) return;

    if (!safety.safe) {
      setError(safety.error || "Timeline exceeds safe export limits.");
      return;
    }

    // Lease media URLs until the export engine has fully stopped using them.
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
        onProgress: (nextProgress) => setProgress(nextProgress),
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        setIsExporting(false);
        setError("Export was cancelled.");
        return;
      }

      setExportedBlob(blob);
      setIsExporting(false);
      triggerDownload(blob, filename);
    } catch (exportError) {
      if (controller.signal.aborted) {
        setError("Export was cancelled.");
      } else {
        console.error("Export failed:", exportError);
        setError((exportError as Error).message || "Video rendering failed. Please try again.");
      }
      setIsExporting(false);
    } finally {
      abortControllerRef.current = null;
      if (leaseReleaseRef.current) {
        leaseReleaseRef.current();
        leaseReleaseRef.current = null;
      }
    }
  }, [
    isExporting,
    safety,
    clips,
    acquireAssetLease,
    plan.totalFrames,
    resolution.width,
    resolution.height,
    projectTitle,
    transitions,
    tracks,
    assets,
    triggerDownload,
  ]);

  const handleCancelExport = React.useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const resetExportState = React.useCallback(() => {
    setError(null);
    setProgress(null);
    setExportedBlob(null);
  }, []);

  return {
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
  };
}
