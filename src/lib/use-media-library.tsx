"use client";

import * as React from "react";
import {
  type MediaAssetItem,
  type PersistedMediaRecord,
  saveMediaAssetToDb,
  loadAllMediaAssetsFromDb,
  deleteMediaAssetFromDb,
} from "@/lib/media-storage";
import {
  classifyMediaFile,
  createMediaFingerprintRegistry,
  extractMediaMetadata,
} from "@/lib/media-helpers";
import { checkMediaAssetRemoval } from "@/lib/media-references";
import {
  createMediaResourceLeaseTracker,
  type MediaResourceLeaseTracker,
} from "@/lib/media-resource-leases";
import type { TrackId } from "@/types/timeline";

export type RemoveMediaAssetResult =
  | { removed: true }
  | {
      removed: false;
      reason: "in-use";
      clipCount: number;
      trackIds: TrackId[];
    }
  | { removed: false; reason: "error"; error: Error };

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
  removeAsset: (id: string) => Promise<RemoveMediaAssetResult>;
  acquireAssetLease: (assetIds: Iterable<string>) => () => void;
  clearError: () => void;
}

const MediaLibraryContext = React.createContext<MediaLibraryState | null>(null);

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

function toError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) return value;
  return new Error(fallbackMessage);
}

export function MediaLibraryProvider({ children }: { children: React.ReactNode }) {
  const [assets, setAssets] = React.useState<MediaAssetItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const assetsRef = React.useRef<MediaAssetItem[]>([]);
  const [leaseTracker] = React.useState<MediaResourceLeaseTracker>(() =>
    createMediaResourceLeaseTracker()
  );

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
          assetsRef.current = hydrated;
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

    return () => {
      isMounted = false;
      for (const asset of assetsRef.current) {
        leaseTracker.revokeWhenReleased(asset.id, () => revokeAssetUrls(asset));
      }
      leaseTracker.dispose();
    };
  }, [leaseTracker]);

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

  const acquireAssetLease = React.useCallback(
    (assetIds: Iterable<string>) => leaseTracker.acquire(assetIds),
    [leaseTracker]
  );

  const removeAsset = React.useCallback(
    async (id: string): Promise<RemoveMediaAssetResult> => {
      const target = assetsRef.current.find((a) => a.id === id);

      const removal = checkMediaAssetRemoval(id);
      if (!removal.canRemove) {
        const usage = removal.usage;
        const clipLabel = usage.clipCount === 1 ? "clip" : "clips";
        setError(
          target
            ? `"${target.name}" is used by ${usage.clipCount} timeline ${clipLabel}. Remove those clips from the timeline before deleting this media asset.`
            : `This asset is used by ${usage.clipCount} timeline ${clipLabel}. Remove those clips before deleting it.`
        );
        return {
          removed: false,
          reason: "in-use",
          clipCount: usage.clipCount,
          trackIds: usage.trackIds,
        };
      }

      try {
        await deleteMediaAssetFromDb(id);

        assetsRef.current = assetsRef.current.filter((a) => a.id !== id);
        setAssets((prev) => prev.filter((a) => a.id !== id));

        if (target) {
          // If an export or another operation still leases this asset, keep its
          // Object URLs alive until that operation releases the lease.
          leaseTracker.revokeWhenReleased(id, () => revokeAssetUrls(target));
        }

        setError(null);
        return { removed: true };
      } catch (err) {
        console.error("Failed to delete media asset:", err);
        setError("Failed to delete asset from local database.");
        return {
          removed: false,
          reason: "error",
          error: toError(err, "Failed to delete asset from local database."),
        };
      }
    },
    [leaseTracker]
  );

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
      // Seed from the current library, then reserve each accepted file before
      // any await so identical files in one batch cannot both pass the check.
      const fingerprints = createMediaFingerprintRegistry(
        assetsRef.current.map((asset) => ({
          name: asset.name,
          size: asset.size,
          lastModified: asset.lastModified,
        }))
      );

      try {
        for (const file of files) {
          const category = classifyMediaFile(file);
          if (!category) {
            errors.push(`"${file.name}" is not a supported image, video, or audio file.`);
            continue;
          }

          if (!fingerprints.reserve(file)) {
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
              lastModified: file.lastModified,
            };

            await saveMediaAssetToDb(record);
            const hydrated = hydrateRecord(record);
            newHydratedItems.push(hydrated);
            assetsRef.current = [hydrated, ...assetsRef.current];
          } catch (err) {
            // Allow a later identical file in the same batch to retry when the
            // first attempt failed before anything was committed.
            fingerprints.release(file);
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

        return { importedCount: newHydratedItems.length, errors };
      } finally {
        setIsImporting(false);
      }
    },
    []
  );

  return (
    <MediaLibraryContext.Provider
      value={{
        assets,
        isLoading,
        isImporting,
        error,
        counts,
        importFiles,
        removeAsset,
        acquireAssetLease,
        clearError,
      }}
    >
      {children}
    </MediaLibraryContext.Provider>
  );
}

export function useMediaLibrary(): MediaLibraryState {
  const context = React.useContext(MediaLibraryContext);
  if (!context) {
    throw new Error("useMediaLibrary must be used within a MediaLibraryProvider");
  }
  return context;
}
