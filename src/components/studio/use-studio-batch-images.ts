"use client";

import * as React from "react";
import { api } from "@/lib/apiClient";
import type { StudioClip, StudioProject } from "./types";

interface UseStudioBatchImagesOptions {
  clips: StudioClip[];
  setProject: React.Dispatch<React.SetStateAction<StudioProject>>;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}

export function useStudioBatchImages({
  clips,
  setProject,
  notify,
}: UseStudioBatchImagesOptions) {
  const batchFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);

  const attachedCount = React.useMemo(() => {
    return clips.filter((c) => c.imageUrl !== null).length;
  }, [clips]);

  const importImageFiles = React.useCallback(
    async (files: File[]) => {
      const mediaFiles = files.filter(
        (f) =>
          f.type.startsWith("image/") ||
          f.type.startsWith("video/") ||
          /\.(png|jpe?g|webp|gif|avif|mp4|webm|mov|m4v)$/i.test(f.name),
      );

      if (mediaFiles.length === 0) {
        notify("No valid media files (images or video clips) found.", "error");
        return;
      }

      if (clips.length === 0) {
        notify(
          "Please generate Flow prompts first before importing media.",
          "error",
        );
        return;
      }

      // Sort files naturally by filename (e.g. image-1, image-2, clip_01, clip_02)
      mediaFiles.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

      const usedClipIds = new Set<string>();
      const assignments: { clipId: string; file: File; clipIndex: number }[] =
        [];
      const unassignedFiles: File[] = [];

      // 1. Match by number in filename (e.g. image-1, clip_02, video_03, 3.jpg, 04.mp4)
      for (const file of mediaFiles) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        const numMatch = nameWithoutExt.match(
          /(?:image|clip|scene|img|video|#)?[-_\s]*0*(\d+)/i,
        );
        const num = numMatch ? parseInt(numMatch[1], 10) : NaN;
        const targetClip = !isNaN(num)
          ? clips.find((c) => c.index === num && !usedClipIds.has(c.id))
          : null;

        if (targetClip) {
          assignments.push({
            clipId: targetClip.id,
            file,
            clipIndex: targetClip.index,
          });
          usedClipIds.add(targetClip.id);
        } else {
          unassignedFiles.push(file);
        }
      }

      // 2. Sequential fallback for unassigned files
      if (unassignedFiles.length > 0) {
        const remainingClips = clips.filter((c) => !usedClipIds.has(c.id));
        unassignedFiles.forEach((file, i) => {
          if (i < remainingClips.length) {
            const targetClip = remainingClips[i];
            assignments.push({
              clipId: targetClip.id,
              file,
              clipIndex: targetClip.index,
            });
            usedClipIds.add(targetClip.id);
          }
        });
      }

      if (assignments.length === 0) {
        notify("Could not match any media files to the planned clips.", "error");
        return;
      }

      // Show instant local preview
      const localMap = new Map<string, { url: string; isVideo: boolean }>();
      assignments.forEach(({ clipId, file }) => {
        const isVideo =
          file.type.startsWith("video/") ||
          /\.(mp4|webm|mov|m4v)$/i.test(file.name);
        localMap.set(clipId, { url: URL.createObjectURL(file), isVideo });
      });

      setProject((prev) => ({
        ...prev,
        clips: prev.clips.map((clip) => {
          const entry = localMap.get(clip.id);
          if (!entry) return clip;
          return {
            ...clip,
            imageUrl: entry.url,
            videoUrl: entry.isVideo ? entry.url : null,
            mediaUrl: entry.url,
            mediaType: entry.isVideo ? ("video" as const) : ("image" as const),
            videoVolume: clip.videoVolume ?? 0,
          };
        }),
      }));

      notify(
        `Saving ${assignments.length} media file${assignments.length > 1 ? "s" : ""} to permanent storage…`,
        "info",
      );

      // Upload to server so media files persist across reloads
      try {
        const formData = new FormData();
        assignments.forEach(({ file }) => {
          formData.append("file", file);
        });

        const res = await api<{
          success: boolean;
          files: { name: string; url: string; index?: number }[];
        }>("/api/studio/upload", {
          method: "POST",
          body: formData,
        });

        if (res.files?.length) {
          const serverUrlMap = new Map<
            string,
            { url: string; isVideo: boolean }
          >();
          assignments.forEach(({ clipId, file }, idx) => {
            const uploaded =
              res.files.find((u) => u.name === file.name) || res.files[idx];
            if (uploaded?.url) {
              const isVideo =
                file.type.startsWith("video/") ||
                /\.(mp4|webm|mov|m4v)$/i.test(file.name);
              serverUrlMap.set(clipId, { url: uploaded.url, isVideo });
            }
          });

          setProject((prev) => {
            const updated = {
              ...prev,
              clips: prev.clips.map((clip) => {
                const entry = serverUrlMap.get(clip.id);
                if (!entry) return clip;
                return {
                  ...clip,
                  imageUrl: entry.url,
                  videoUrl: entry.isVideo ? entry.url : null,
                  mediaUrl: entry.url,
                  mediaType: entry.isVideo
                    ? ("video" as const)
                    : ("image" as const),
                };
              }),
            };
            api("/api/studio/project", {
              method: "POST",
              body: JSON.stringify(updated),
            }).catch(() => {});
            return updated;
          });
        }

        notify(
          `Successfully saved ${assignments.length} media file${assignments.length > 1 ? "s" : ""}!`,
          "success",
        );
      } catch (err) {
        console.warn("[studio] Upload fallback to local preview:", err);
        notify(
          `Attached ${assignments.length} media file${assignments.length > 1 ? "s" : ""} locally!`,
          "success",
        );
      }
    },
    [clips, notify, setProject],
  );

  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      importImageFiles(files);
    }
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleClearAllImages = () => {
    if (attachedCount === 0) return;
    if (
      !window.confirm(`Remove attached images from all ${attachedCount} clips?`)
    ) {
      return;
    }

    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((clip) => ({ ...clip, imageUrl: null })),
    }));
    notify("Cleared attached images from all clips.", "info");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      importImageFiles(files);
    }
  };

  const openBatchFileDialog = () => {
    batchFileInputRef.current?.click();
  };

  return {
    batchFileInputRef,
    isDraggingOver,
    attachedCount,
    handleBatchFileChange,
    handleClearAllImages,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    openBatchFileDialog,
  };
}
