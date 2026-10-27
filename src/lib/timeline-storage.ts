"use client";

import { useSyncExternalStore } from "react";
import type { TimelineProjectState, TimelineClip, TimelineTransition } from "@/types/timeline";

export const TIMELINE_STORAGE_KEY = "story_forge_timeline_state_v1";
export const TIMELINE_STORAGE_VERSION = 1;
export const TIMELINE_STORAGE_EVENT = "story_forge_timeline_storage_change";

export const DEFAULT_TIMELINE_STATE: TimelineProjectState = {
  version: TIMELINE_STORAGE_VERSION,
  projectTitle: "Untitled Story Video",
  clips: [],
  transitions: [],
  playhead: 0,
  zoom: 100,
  selectedClipId: null,
  selectedTransitionId: null,
  updatedAt: 0,
};

let cachedTimelineRaw: string | null = "__init__";
let cachedTimelineSnapshot: TimelineProjectState = DEFAULT_TIMELINE_STATE;

/**
 * Safely load saved timeline project state from browser localStorage.
 */
export function getStoredTimelineState(): TimelineProjectState {
  if (typeof window === "undefined") {
    return DEFAULT_TIMELINE_STATE;
  }

  try {
    const raw = window.localStorage.getItem(TIMELINE_STORAGE_KEY);
    if (!raw) return DEFAULT_TIMELINE_STATE;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.version === TIMELINE_STORAGE_VERSION) {
      return {
        version: TIMELINE_STORAGE_VERSION,
        projectTitle: typeof parsed.projectTitle === "string" ? parsed.projectTitle : "Untitled Story Video",
        clips: Array.isArray(parsed.clips) ? (parsed.clips as TimelineClip[]) : [],
        transitions: Array.isArray(parsed.transitions) ? (parsed.transitions as TimelineTransition[]) : [],
        playhead: typeof parsed.playhead === "number" ? Math.max(0, parsed.playhead) : 0,
        zoom: typeof parsed.zoom === "number" ? Math.min(500, Math.max(10, parsed.zoom)) : 100,
        selectedClipId: typeof parsed.selectedClipId === "string" ? parsed.selectedClipId : null,
        selectedTransitionId: typeof parsed.selectedTransitionId === "string" ? parsed.selectedTransitionId : null,
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      };
    }
  } catch (err) {
    console.error("Failed to read timeline storage:", err);
  }

  return DEFAULT_TIMELINE_STATE;
}

/**
 * Safely save timeline project state to browser localStorage.
 */
export function saveStoredTimelineState(state: Partial<TimelineProjectState>): void {
  if (typeof window === "undefined") return;

  try {
    const current = getStoredTimelineState();
    const updated: TimelineProjectState = {
      ...current,
      ...state,
      version: TIMELINE_STORAGE_VERSION,
      updatedAt: Date.now(),
    };
    const serialized = JSON.stringify(updated);
    cachedTimelineRaw = serialized;
    cachedTimelineSnapshot = updated;
    window.localStorage.setItem(TIMELINE_STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent(TIMELINE_STORAGE_EVENT));
  } catch (err) {
    console.error("Failed to save timeline state:", err);
  }
}

/**
 * Clear stored timeline state from localStorage
 */
export function clearStoredTimelineState(): void {
  if (typeof window === "undefined") return;
  try {
    cachedTimelineRaw = null;
    cachedTimelineSnapshot = DEFAULT_TIMELINE_STATE;
    window.localStorage.removeItem(TIMELINE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(TIMELINE_STORAGE_EVENT));
  } catch (err) {
    console.error("Failed to clear timeline storage:", err);
  }
}

function subscribeToTimelineStorage(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(TIMELINE_STORAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(TIMELINE_STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getTimelineSnapshot(): TimelineProjectState {
  if (typeof window === "undefined") {
    return DEFAULT_TIMELINE_STATE;
  }
  try {
    const raw = window.localStorage.getItem(TIMELINE_STORAGE_KEY);
    if (raw !== cachedTimelineRaw) {
      cachedTimelineRaw = raw;
      cachedTimelineSnapshot = getStoredTimelineState();
    }
    return cachedTimelineSnapshot;
  } catch {
    return DEFAULT_TIMELINE_STATE;
  }
}

function getServerTimelineSnapshot(): TimelineProjectState {
  return DEFAULT_TIMELINE_STATE;
}

/**
 * Hydration-safe React hook using useSyncExternalStore for timeline persistence.
 * Server snapshot and client's first render are 100% identical.
 */
export function useTimelineStorage(): TimelineProjectState {
  return useSyncExternalStore(
    subscribeToTimelineStorage,
    getTimelineSnapshot,
    getServerTimelineSnapshot
  );
}
