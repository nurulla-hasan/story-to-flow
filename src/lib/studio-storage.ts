"use client";

import { useSyncExternalStore } from "react";
import type { StoryProcessResponse } from "@/lib/validation";

export const STUDIO_STORAGE_VERSION = 1;
export const STUDIO_STORAGE_KEY = "story_forge_studio_state_v1";
export const STUDIO_STORAGE_EVENT = "story_forge_studio_storage_change";

export interface StoredStudioState {
  version: number;
  story: string;
  lastResult: StoryProcessResponse | null;
  savedAt: number;
}

const DEFAULT_STUDIO_STATE: StoredStudioState = {
  version: STUDIO_STORAGE_VERSION,
  story: "",
  lastResult: null,
  savedAt: 0,
};

let cachedStudioSnapshot: StoredStudioState = DEFAULT_STUDIO_STATE;
let cachedStudioRaw: string | null = "__init__";

/**
 * Safely read stored studio state from browser localStorage.
 * Handles SSR, quota limits, and corrupted data gracefully.
 */
export function getStoredStudioState(): StoredStudioState {
  if (typeof window === "undefined") {
    return DEFAULT_STUDIO_STATE;
  }

  try {
    const raw = window.localStorage.getItem(STUDIO_STORAGE_KEY);
    if (!raw) return DEFAULT_STUDIO_STATE;

    const parsed = JSON.parse(raw);

    // Verify version and shape
    if (parsed && typeof parsed === "object" && parsed.version === STUDIO_STORAGE_VERSION) {
      return {
        version: STUDIO_STORAGE_VERSION,
        story: typeof parsed.story === "string" ? parsed.story : "",
        lastResult:
          parsed.lastResult &&
          typeof parsed.lastResult === "object" &&
          typeof parsed.lastResult.response === "string" &&
          parsed.lastResult.metadata
            ? (parsed.lastResult as StoryProcessResponse)
            : null,
        savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
      };
    }
  } catch {
    // Malformed JSON or restricted storage; fall back cleanly
  }

  return DEFAULT_STUDIO_STATE;
}

/**
 * Persist the current story text to localStorage.
 * Handles quota errors and non-blocking failures.
 */
export function saveStoredStory(story: string): void {
  if (typeof window === "undefined") return;

  try {
    const current = getStoredStudioState();
    const updated: StoredStudioState = {
      ...current,
      story,
      savedAt: Date.now(),
    };
    const serialized = JSON.stringify(updated);
    cachedStudioRaw = serialized;
    cachedStudioSnapshot = updated;
    window.localStorage.setItem(STUDIO_STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent(STUDIO_STORAGE_EVENT));
  } catch {
    // Gracefully handle storage quota or private-browsing restrictions
  }
}

/**
 * Persist the latest successful generation output and metadata.
 * Called only after generation completes successfully.
 */
export function saveStoredResult(result: StoryProcessResponse | null): void {
  if (typeof window === "undefined") return;

  try {
    const current = getStoredStudioState();
    const updated: StoredStudioState = {
      ...current,
      lastResult: result,
      savedAt: Date.now(),
    };
    const serialized = JSON.stringify(updated);
    cachedStudioRaw = serialized;
    cachedStudioSnapshot = updated;
    window.localStorage.setItem(STUDIO_STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent(STUDIO_STORAGE_EVENT));
  } catch {
    // Gracefully handle storage quota or private-browsing restrictions
  }
}

/**
 * Clear all stored Studio state (story, lastResult).
 * Keeps the user's global AI Model selection in Settings untouched.
 */
export function clearStoredStudioState(): void {
  if (typeof window === "undefined") return;

  try {
    cachedStudioRaw = null;
    cachedStudioSnapshot = DEFAULT_STUDIO_STATE;
    window.localStorage.removeItem(STUDIO_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(STUDIO_STORAGE_EVENT));
  } catch {
    // Ignore storage errors on clear
  }
}

function subscribeToStudioStorage(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(STUDIO_STORAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STUDIO_STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getStudioSnapshot(): StoredStudioState {
  if (typeof window === "undefined") {
    return DEFAULT_STUDIO_STATE;
  }
  try {
    const raw = window.localStorage.getItem(STUDIO_STORAGE_KEY);
    if (raw !== cachedStudioRaw) {
      cachedStudioRaw = raw;
      cachedStudioSnapshot = getStoredStudioState();
    }
    return cachedStudioSnapshot;
  } catch {
    return DEFAULT_STUDIO_STATE;
  }
}

function getServerStudioSnapshot(): StoredStudioState {
  return DEFAULT_STUDIO_STATE;
}

/**
 * React hook using useSyncExternalStore for hydration-safe studio persistence.
 */
export function useStudioStorage() {
  return useSyncExternalStore(
    subscribeToStudioStorage,
    getStudioSnapshot,
    getServerStudioSnapshot
  );
}
