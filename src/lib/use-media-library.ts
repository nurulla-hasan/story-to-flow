"use client";

import * as React from "react";
import {
  type MediaAssetItem,
  type PersistedMediaRecord,
  saveMediaAssetToDb,
  loadAllMediaAssetsFromDb,
  deleteMediaAssetFromDb,
} from "@/lib/media-storage";
import { classifyMediaFile, extractMediaMetadata } from "@/lib/media-helpers";

export interface MediaLibraryState {
  assets: MediaAssetItem[];
  isLoading: boolean;
  isImporting: boolean;
  error: string | null;
  counts: {
    all: number;
    video: number;
    image: number;
    audio: number;
  };
  importFiles: (files: FileList | File[]) => Promise<{ importedCount: number; errors: string[] }>;
  removeAsset: (id: string) => Promise<void>;
  clearError: () => void;
}

/**
 * Hydrate a persisted record by allocating in-memory Object URLs
 */
function hydrateRecord(record: PersistedMediaRecord): MediaAssetItem {
  const url = URL.createObjectURL(record.blob);
  const thumbnailUrl = record.thumbnailBlob ? URL.createObjectURL(record.thumbnailBlob) : null;

  return {
    id: record.id,
    name: record.name,
    category: record.category,
    mimeType: record.mimeType,
    size: record.size,
    blob: record.blob,
    url,
    thumbnailUrl,
    duration: record.duration,
    width: record.width,
    height: record.height,
    importedAt: record.importedAt,
    lastModified: record.lastModified,
  };
}

/**
 * Clean up in-memory Object URLs to prevent browser memory leaks
 */
function revokeAssetUrls(asset: MediaAssetItem) {
  if (asset.url) {
    URL.revokeObjectURL(asset.url);
  }
  if (asset.thumbnailUrl) {
    URL.revokeObjectURL(asset.thumbnailUrl);
  }
}

export function useMediaLibrary(): MediaLibraryState {
  const [assets, setAssets] = React.useState<MediaAssetItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Keep a reference to current assets so cleanup on unmount always has the latest items
  const assetsRef = React.useRef<MediaAssetItem[]>([]);

  React.useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  // Initial load from IndexedDB on component mount
  React.useEffect(() => {
    let isMounted = true;

    async function loadAssets() {
      setIsLoading(true);
      try {
        const records = await loadAllMediaAssetsFromDb();
        if (isMounted) {
          const hydrated = records.map(hydrateRecord);
          setAssets(hydrated);
        }
      } catch (err) {
        console.error("Failed to load assets from IndexedDB:", err);
        if (isMounted) {
          setError("Failed to restore saved media assets from local database.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAssets();

    // Revoke all created URLs when unmounting
    return () => {
      isMounted = false;
      assetsRef.current.forEach(revokeAssetUrls);
    };
  }, []);

  const counts = React.useMemo(() => {
    return {
      all: assets.length,
      video: assets.filter((a) => a.category === "video").length,
      image: assets.filter((a) => a.category === "image").length,
      audio: assets.filter((a) => a.category === "audio").length,
    };
  }, [assets]);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const removeAsset = React.useCallback(async (id: string) => {
    try {
      // Find asset to revoke its URLs
      const target = assetsRef.current.find((a) => a.id === id);
      if (target) {
        revokeAssetUrls(target);
      }

      await deleteMediaAssetFromDb(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete media asset:", err);
      setError("Failed to delete asset from local database.");
    }
  }, []);

  const importFiles = React.useCallback(
    async (fileInput: FileList | File[]) => {
      const files = Array.from(fileInput);
      if (files.length === 0) {
        return { importedCount: 0, errors: [] };
      }

      setIsImporting(true);
      setError(null);

      const errors: string[] = [];
      const newHydratedItems: MediaAssetItem[] = [];

      for (const file of files) {
        const category = classifyMediaFile(file);
        if (!category) {
          errors.push(`"${file.name}" is not a supported image, video, or audio file.`);
          continue;
        }

        // Check for duplicates in current library (by name, size, and lastModified)
        const isDuplicate = assetsRef.current.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified
        );

        if (isDuplicate) {
          errors.push(`"${file.name}" is already imported in your Media Library.`);
          continue;
        }

        try {
          const meta = await extractMediaMetadata(file, category);
          const id = `media_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          const record: PersistedMediaRecord = {
            id,
            name: file.name,
            category,
            mimeType: file.type || `${category}/*`,
            size: file.size,
            blob: file,
            thumbnailBlob: meta.thumbnailBlob || null,
            duration: meta.duration || null,
            width: meta.width || null,
            height: meta.height || null,
            importedAt: Date.now(),
            lastModified: file.lastModified || Date.now(),
          };

          await saveMediaAssetToDb(record);
          const hydrated = hydrateRecord(record);
          newHydratedItems.push(hydrated);
        } catch (err) {
          console.error(`Failed to store ${file.name}:`, err);
          errors.push(`Failed to store "${file.name}". Storage limit might be exceeded.`);
        }
      }

      if (newHydratedItems.length > 0) {
        setAssets((prev) => [...newHydratedItems, ...prev]);
      }

      if (errors.length > 0) {
        setError(errors.join(" "));
      }

      setIsImporting(false);
      return { importedCount: newHydratedItems.length, errors };
    },
    []
  );

  return {
    assets,
    isLoading,
    isImporting,
    error,
    counts,
    importFiles,
    removeAsset,
    clearError,
  };
}
