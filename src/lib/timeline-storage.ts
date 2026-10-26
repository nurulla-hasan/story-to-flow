"use client";

import type { TimelineProjectState, TimelineClip } from "@/types/timeline";

export const TIMELINE_STORAGE_KEY = "story_forge_timeline_state_v1";
export const TIMELINE_STORAGE_VERSION = 1;

export const DEFAULT_TIMELINE_STATE: TimelineProjectState = {
  version: TIMELINE_STORAGE_VERSION,
  projectTitle: "Untitled Story Video",
  clips: [],
  playhead: 0,
  zoom: 100,
  selectedClipId: null,
  updatedAt: 0,
};

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
        playhead: typeof parsed.playhead === "number" ? Math.max(0, parsed.playhead) : 0,
        zoom: typeof parsed.zoom === "number" ? Math.min(200, Math.max(50, parsed.zoom)) : 100,
        selectedClipId: typeof parsed.selectedClipId === "string" ? parsed.selectedClipId : null,
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
    window.localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(updated));
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
    window.localStorage.removeItem(TIMELINE_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear timeline storage:", err);
  }
}
