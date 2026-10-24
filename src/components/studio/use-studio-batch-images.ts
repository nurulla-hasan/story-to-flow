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
      const imageFiles = files.filter(
        (f) =>
          f.type.startsWith("image/") ||
          /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name),
      );

      if (imageFiles.length === 0) {
        notify("No valid image files found.", "error");
        return;
      }

      if (clips.length === 0) {
        notify(
          "Please generate Flow prompts first before importing images.",
          "error",
        );
        return;
      }

      // Sort files naturally by filename (e.g. image-1, image-2, image-10)
      imageFiles.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );

      const usedClipIds = new Set<string>();
      const assignments: { clipId: string; file: File; clipIndex: number }[] =
        [];
      const unassignedFiles: File[] = [];

      // 1. Match by number in filename (e.g. image-1, clip_02, 3.jpg, 04.png)
      for (const file of imageFiles) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        const numMatch = nameWithoutExt.match(
          /(?:image|clip|scene|img|#)?[-_\s]*0*(\d+)/i,
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
        notify("Could not match any images to the planned clips.", "error");
        return;
      }

      // Show instant local preview
      const localMap = new Map<string, string>();
      assignments.forEach(({ clipId, file }) => {
        localMap.set(clipId, URL.createObjectURL(file));
      });

      setProject((prev) => ({
        ...prev,
        clips: prev.clips.map((clip) => {
          const newUrl = localMap.get(clip.id);
          return newUrl ? { ...clip, imageUrl: newUrl } : clip;
        }),
      }));

      notify(
        `Saving ${assignments.length} image${assignments.length > 1 ? "s" : ""} to permanent storage…`,
        "info",
      );

      // Upload to server so images persist across reloads
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
          const serverUrlMap = new Map<string, string>();
          assignments.forEach(({ clipId, file }, idx) => {
            const uploaded =
              res.files.find((u) => u.name === file.name) || res.files[idx];
            if (uploaded?.url) {
              serverUrlMap.set(clipId, uploaded.url);
            }
          });

          setProject((prev) => {
            const updated = {
              ...prev,
              clips: prev.clips.map((clip) => {
                const permanentUrl = serverUrlMap.get(clip.id);
                return permanentUrl ? { ...clip, imageUrl: permanentUrl } : clip;
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
          `Successfully saved ${assignments.length} image${assignments.length > 1 ? "s" : ""}!`,
          "success",
        );
      } catch (err) {
        console.warn("[studio] Upload fallback to local preview:", err);
        notify(
          `Attached ${assignments.length} image${assignments.length > 1 ? "s" : ""} locally!`,
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
