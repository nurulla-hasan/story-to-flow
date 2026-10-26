"use client";

export type MediaCategory = "image" | "video" | "audio";

export interface PersistedMediaRecord {
  id: string;
  name: string;
  category: MediaCategory;
  mimeType: string;
  size: number;
  blob: Blob;
  thumbnailBlob?: Blob | null;
  duration?: number | null; // in seconds
  width?: number | null;
  height?: number | null;
  importedAt: number;
  lastModified: number;
}

export interface MediaAssetItem extends Omit<PersistedMediaRecord, "blob" | "thumbnailBlob"> {
  blob: Blob;
  url: string; // Object URL for preview/playback
  thumbnailUrl?: string | null; // Object URL for thumbnail
}

const DB_NAME = "story_forge_media_db_v1";
const DB_VERSION = 1;
const STORE_NAME = "assets";

/**
 * Check if IndexedDB is available in the current environment
 */
export function isIndexedDbAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

/**
 * Open (or create) the IndexedDB database for media assets
 */
export function openMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("importedAt", "importedAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };
  });
}

/**
 * Persist a media record containing binary File/Blob into IndexedDB
 */
export async function saveMediaAssetToDb(record: PersistedMediaRecord): Promise<void> {
  const db = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error("Failed to save media asset"));

      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error || new Error("Transaction failed"));
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Retrieve all persisted media records from IndexedDB
 */
export async function loadAllMediaAssetsFromDb(): Promise<PersistedMediaRecord[]> {
  const db = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = req.result as PersistedMediaRecord[];
        // Sort descending by importedAt (newest first)
        results.sort((a, b) => b.importedAt - a.importedAt);
        resolve(results);
      };

      req.onerror = () => reject(req.error || new Error("Failed to load media assets"));

      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error || new Error("Transaction failed"));
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Delete a specific media asset from IndexedDB by its ID
 */
export async function deleteMediaAssetFromDb(id: string): Promise<void> {
  const db = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error(`Failed to delete media asset ${id}`));

      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error || new Error("Transaction failed"));
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Query estimated storage usage if supported by browser
 */
export async function getStorageEstimate(): Promise<{ usedBytes: number; quotaBytes: number | null }> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        usedBytes: estimate.usage || 0,
        quotaBytes: estimate.quota || null,
      };
    } catch {
      // Fallback
    }
  }
  return { usedBytes: 0, quotaBytes: null };
}
