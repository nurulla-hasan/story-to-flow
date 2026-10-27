"use client";

import { useSyncExternalStore } from "react";
import type { TimelineProjectState, TimelineClip, TimelineTransition } from "@/types/timeline";

import { sanitizeClipTransform } from "@/lib/clip-transform";

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

export type TimelineSaveResult =
  | { ok: true }
  | { ok: false; error: Error };

export interface TimelineSaveStatus {
  isDirty: boolean;
  error: string | null;
}

export const INITIAL_TIMELINE_SAVE_STATUS: TimelineSaveStatus = {
  isDirty: false,
  error: null,
};

export type TimelineSaveStatusAction =
  | { type: "attempt" }
  | { type: "success" }
  | { type: "failure"; message: string }
  | { type: "dismiss" };

/**
 * Reducer used by the editor header so a failed write is visible and never
 * reported as saved. The dirty flag stays set until a later write succeeds.
 */
export function timelineSaveStatusReducer(
  state: TimelineSaveStatus,
  action: TimelineSaveStatusAction
): TimelineSaveStatus {
  switch (action.type) {
    case "attempt":
      return state.isDirty && state.error ? state : { isDirty: true, error: state.error };
    case "success":
      return INITIAL_TIMELINE_SAVE_STATUS;
    case "failure":
      return { isDirty: true, error: action.message };
    case "dismiss":
      return { isDirty: state.isDirty, error: null };
    default:
      return state;
  }
}

export function formatTimelineSaveError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";

  if (/quota/i.test(`${name} ${message}`)) {
    return "Browser storage is full, so the project was not saved. Your latest changes remain in this tab; free up space and make another change to retry.";
  }

  if (/refus|unreadable|newer version/i.test(message)) {
    return `${message} Your latest changes remain in this tab, but they will be lost on reload.`;
  }

  return "Project changes could not be saved to this browser. Your latest changes remain in this tab but will be lost on reload. Check storage permissions or free up space, then make another change to retry.";
}

/**
 * A playhead write gate. Callers only invoke commit at a boundary (seek end,
 * pause, frame step), so drag and playback frames do not write localStorage.
 */
export interface PlayheadCommitGate {
  commit: (time: number, write: (seconds: number) => void) => boolean;
  reset: (time?: number | null) => void;
}

export function createPlayheadCommitGate(): PlayheadCommitGate {
  let lastCommitted: number | null = null;

  return {
    commit(time, write) {
      const clamped = Math.max(0, Number.isFinite(time) ? time : 0);
      if (lastCommitted !== null && Math.abs(lastCommitted - clamped) < 0.001) {
        return false;
      }
      lastCommitted = clamped;
      write(clamped);
      return true;
    },
    reset(time) {
      lastCommitted = typeof time === "number" && Number.isFinite(time) ? Math.max(0, time) : null;
    },
  };
}

/**
 * Keep restored selections only when their referenced item still exists.
 * Transitions also need both endpoint clips to be present.
 */
export function resolveTimelineSelection(
  selectedClipId: string | null | undefined,
  selectedTransitionId: string | null | undefined,
  clips: readonly Pick<TimelineClip, "id">[],
  transitions: readonly Pick<TimelineTransition, "id" | "fromClipId" | "toClipId">[]
): { selectedClipId: string | null; selectedTransitionId: string | null } {
  const clipIds = new Set(clips.map((clip) => clip.id));

  const resolvedClipId =
    selectedClipId && clipIds.has(selectedClipId) ? selectedClipId : null;

  const resolvedTransitionId =
    selectedTransitionId &&
    transitions.some(
      (transition) =>
        transition.id === selectedTransitionId &&
        clipIds.has(transition.fromClipId) &&
        clipIds.has(transition.toClipId)
    )
      ? selectedTransitionId
      : null;

  return {
    selectedClipId: resolvedClipId,
    selectedTransitionId: resolvedTransitionId,
  };
}

let cachedTimelineRaw: string | null = "__init__";
let cachedTimelineSnapshot: TimelineProjectState = DEFAULT_TIMELINE_STATE;

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
 * Parse a stored timeline record, including older version-1 payloads that
 * predate transitions, selected transitions, or clip transforms.
 */
export function deserializeTimelineState(parsed: unknown): TimelineProjectState | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const version = typeof record.version === "number" ? record.version : TIMELINE_STORAGE_VERSION;
  if (!Number.isFinite(version) || version > TIMELINE_STORAGE_VERSION) {
    return null;
  }

  const playhead = typeof record.playhead === "number" && Number.isFinite(record.playhead)
    ? Math.max(0, record.playhead)
    : 0;
  const zoom = typeof record.zoom === "number" && Number.isFinite(record.zoom)
    ? Math.min(500, Math.max(10, record.zoom))
    : 100;

  return {
    version: TIMELINE_STORAGE_VERSION,
    projectTitle:
      typeof record.projectTitle === "string" ? record.projectTitle : "Untitled Story Video",
    clips: Array.isArray(record.clips)
      ? (record.clips as TimelineClip[]).map((clip) => ({
          ...clip,
          speed:
            typeof clip.speed === "number" && Number.isFinite(clip.speed) && clip.speed > 0
              ? clip.speed
              : 1.0,
          transform: clip.transform ? sanitizeClipTransform(clip.transform) : undefined,
        }))
      : [],
    transitions: Array.isArray(record.transitions)
      ? (record.transitions as TimelineTransition[])
      : [],
    playhead,
    zoom,
    selectedClipId: typeof record.selectedClipId === "string" ? record.selectedClipId : null,
    selectedTransitionId:
      typeof record.selectedTransitionId === "string" ? record.selectedTransitionId : null,
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : Date.now(),
  };
}

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

    const parsed = deserializeTimelineState(JSON.parse(raw));
    if (parsed) return parsed;
  } catch (err) {
    console.error("Failed to read timeline storage:", err);
  }

  return DEFAULT_TIMELINE_STATE;
}

/**
 * Safely save timeline project state to browser localStorage.
 * The in-memory snapshot is updated only after the write succeeds.
 */
export function saveStoredTimelineState(
  state: Partial<TimelineProjectState>
): TimelineSaveResult {
  if (typeof window === "undefined") {
    return { ok: false, error: new Error("Browser storage is not available on the server") };
  }

  try {
    const raw = window.localStorage.getItem(TIMELINE_STORAGE_KEY);
    let current = DEFAULT_TIMELINE_STATE;

    if (raw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return {
          ok: false,
          error: new Error("The existing saved project is unreadable, so it was not overwritten."),
        };
      }

      const stored = deserializeTimelineState(parsed);
      if (!stored) {
        return {
          ok: false,
          error: new Error("The existing saved project uses an unsupported format or newer version, so it was not overwritten."),
        };
      }
      current = stored;
    }

    const updated: TimelineProjectState = {
      ...current,
      ...state,
      version: TIMELINE_STORAGE_VERSION,
      updatedAt: Date.now(),
    };
    const serialized = JSON.stringify(updated);

    window.localStorage.setItem(TIMELINE_STORAGE_KEY, serialized);

    cachedTimelineRaw = serialized;
    cachedTimelineSnapshot = updated;

    try {
      window.dispatchEvent(new CustomEvent(TIMELINE_STORAGE_EVENT));
    } catch {
      // Storage succeeded; a failed change notification should not report a
      // data-loss failure to the user.
    }

    return { ok: true };
  } catch (err) {
    const error = toError(err, "Failed to save timeline state");
    console.error("Failed to save timeline state:", error);
    return { ok: false, error };
  }
}

/**
 * Clear stored timeline state from localStorage
 */
export function clearStoredTimelineState(): TimelineSaveResult {
  if (typeof window === "undefined") {
    return { ok: false, error: new Error("Browser storage is not available on the server") };
  }

  try {
    window.localStorage.removeItem(TIMELINE_STORAGE_KEY);
    cachedTimelineRaw = null;
    cachedTimelineSnapshot = DEFAULT_TIMELINE_STATE;
    try {
      window.dispatchEvent(new CustomEvent(TIMELINE_STORAGE_EVENT));
    } catch {
      // Ignore notification failures after the value was removed.
    }
    return { ok: true };
  } catch (err) {
    const error = toError(err, "Failed to clear timeline storage");
    console.error("Failed to clear timeline storage:", error);
    return { ok: false, error };
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
