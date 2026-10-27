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

function toError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) return value;
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return new Error(message);
    }
  }
  return new Error(fallbackMessage);
}

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

    let request: IDBOpenDBRequest;
    try {
      request = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(toError(error, "Failed to open IndexedDB"));
      return;
    }

    let settled = false;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(toError(error, "Failed to open IndexedDB"));
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("importedAt", "importedAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      if (settled) {
        try {
          request.result.close();
        } catch {
          // Ignore close failures on an already-rejected open request.
        }
        return;
      }
      settled = true;
      resolve(request.result);
    };

    request.onerror = () => {
      fail(request.error || new Error("Failed to open IndexedDB"));
    };

    request.onblocked = () => {
      fail(new Error("IndexedDB is blocked by another open connection. Close other tabs and try again."));
    };
  });
}

/**
 * Run an IndexedDB transaction and settle only once the whole transaction has
 * committed. Request-level errors abort the transaction, so quota failures and
 * write failures are reported after IndexedDB finishes aborting.
 */
function runMediaTransaction<T>(
  mode: IDBTransactionMode,
  perform: (store: IDBObjectStore, trackRequest: <R extends IDBRequest>(request: R) => R) => void,
  readResult: () => T
): Promise<T> {
  return openMediaDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let settled = false;
        let closed = false;
        let requestError: Error | null = null;

        const closeDatabase = () => {
          if (closed) return;
          closed = true;
          try {
            db.close();
          } catch {
            // Closing an already-closed database is harmless.
          }
        };

        const settle = (fn: (value: T) => void, value: T) => {
          if (settled) return;
          settled = true;
          closeDatabase();
          fn(value);
        };

        const fail = (error: unknown, fallbackMessage: string) => {
          if (settled) return;
          settled = true;
          closeDatabase();
          reject(toError(error, fallbackMessage));
        };

        let tx: IDBTransaction;
        try {
          tx = db.transaction(STORE_NAME, mode);
        } catch (error) {
          fail(error, "Failed to start media transaction");
          return;
        }

        const trackRequest = <R extends IDBRequest>(request: R): R => {
          request.onerror = () => {
            requestError = toError(request.error, "Media transaction request failed");
            // In normal IndexedDB behavior the error already aborts the
            // transaction. Abort explicitly when a browser needs a nudge.
            try {
              tx.abort();
            } catch {
              // The transaction may already be aborting/finished.
            }
          };
          return request;
        };

        tx.oncomplete = () => {
          if (requestError) {
            fail(requestError, "Media transaction failed");
            return;
          }
          let result: T;
          try {
            result = readResult();
          } catch (error) {
            fail(error, "Failed to read media transaction result");
            return;
          }
          settle(resolve, result);
        };

        tx.onerror = () => {
          fail(requestError || tx.error, "Media transaction failed");
        };

        tx.onabort = () => {
          fail(
            requestError || tx.error || new Error("Media transaction was aborted"),
            "Media transaction was aborted"
          );
        };

        try {
          perform(tx.objectStore(STORE_NAME), trackRequest);
        } catch (error) {
          requestError = requestError ?? toError(error, "Media transaction failed");
          try {
            tx.abort();
          } catch {
            fail(requestError, "Media transaction failed");
          }
        }
      })
  );
}

/**
 * Persist a media record containing binary File/Blob into IndexedDB.
 * Resolves only after the readwrite transaction commits.
 */
export function saveMediaAssetToDb(record: PersistedMediaRecord): Promise<void> {
  return runMediaTransaction<void>(
    "readwrite",
    (store, trackRequest) => {
      trackRequest(store.put(record));
    },
    () => undefined
  );
}

/**
 * Retrieve all persisted media records from IndexedDB.
 * Resolves only after the readonly transaction completes.
 */
export function loadAllMediaAssetsFromDb(): Promise<PersistedMediaRecord[]> {
  let results: PersistedMediaRecord[] = [];

  return runMediaTransaction<PersistedMediaRecord[]>(
    "readonly",
    (store, trackRequest) => {
      const request = trackRequest(store.getAll());
      request.onsuccess = () => {
        results = (request.result as PersistedMediaRecord[]) || [];
      };
    },
    () => {
      results.sort((a, b) => b.importedAt - a.importedAt);
      return results;
    }
  );
}

/**
 * Delete a specific media asset from IndexedDB by its ID.
 * Resolves only after the readwrite transaction commits.
 */
export function deleteMediaAssetFromDb(id: string): Promise<void> {
  return runMediaTransaction<void>(
    "readwrite",
    (store, trackRequest) => {
      trackRequest(store.delete(id));
    },
    () => undefined
  );
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
