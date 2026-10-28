import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TimelineClip, TimelineTransition } from "@/types/timeline";
import {
  DEFAULT_TIMELINE_STATE,
  INITIAL_TIMELINE_SAVE_STATUS,
  TIMELINE_STORAGE_KEY,
  createPlayheadCommitGate,
  deserializeTimelineState,
  formatTimelineSaveError,
  getStoredTimelineState,
  resolveTimelineSelection,
  saveStoredTimelineState,
  timelineSaveStatusReducer,
} from "./timeline-storage";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      const error = new Error("QuotaExceededError: storage is full");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  seed(key: string, value: string): void {
    this.values.set(key, value);
  }

  raw(key: string): string | null {
    return this.values.get(key) ?? null;
  }
}

function createClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: "clip-1",
    assetId: "asset-1",
    name: "scene.png",
    type: "image",
    trackId: "visual-1",
    startTime: 0,
    duration: 4,
    inPoint: 0,
    outPoint: 4,
    ...overrides,
  };
}

function createTransition(overrides: Partial<TimelineTransition> = {}): TimelineTransition {
  return {
    id: "transition-1",
    type: "cross-dissolve",
    duration: 0.5,
    fromClipId: "clip-1",
    toClipId: "clip-2",
    trackId: "visual-1",
    ...overrides,
  };
}

const globalWithWindow = globalThis as unknown as { window?: unknown };
const originalWindow = globalWithWindow.window;

let storage: MemoryStorage;

function installWindow() {
  globalWithWindow.window = {
    localStorage: storage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

beforeEach(() => {
  storage = new MemoryStorage();
  installWindow();
});

afterEach(() => {
  globalWithWindow.window = originalWindow;
});

describe("timeline persistence results", () => {
  it("saves a merged patch and reads it back", () => {
    const result = saveStoredTimelineState({
      clips: [createClip()],
      transitions: [createTransition()],
      playhead: 4.5,
      selectedClipId: "clip-1",
      selectedTransitionId: null,
    });

    expect(result).toEqual({ ok: true });

    const stored = getStoredTimelineState();
    expect(stored.version).toBe(1);
    expect(stored.projectTitle).toBe(DEFAULT_TIMELINE_STATE.projectTitle);
    expect(stored.clips).toHaveLength(1);
    expect(stored.transitions).toHaveLength(1);
    expect(stored.playhead).toBe(4.5);
    expect(stored.selectedClipId).toBe("clip-1");
    expect(stored.selectedTransitionId).toBeNull();
    expect(stored.updatedAt).toBeGreaterThan(0);
  });

  it("keeps the previous saved payload and reports quota failures", () => {
    expect(saveStoredTimelineState({ clips: [createClip()], playhead: 2 }).ok).toBe(true);
    const previousRaw = storage.raw(TIMELINE_STORAGE_KEY);

    storage.failWrites = true;
    const result = saveStoredTimelineState({ playhead: 9 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(formatTimelineSaveError(result.error)).toContain("storage is full");
    }

    expect(storage.raw(TIMELINE_STORAGE_KEY)).toBe(previousRaw);
    expect(getStoredTimelineState().playhead).toBe(2);
  });

  it("refuses to overwrite an unreadable saved project with defaults", () => {
    storage.seed(TIMELINE_STORAGE_KEY, "{ not valid json");

    const result = saveStoredTimelineState({ clips: [createClip()] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("unreadable");
    }
    expect(storage.raw(TIMELINE_STORAGE_KEY)).toBe("{ not valid json");
  });

  it("refuses to overwrite a newer saved project version", () => {
    const newerRaw = JSON.stringify({ version: 2, clips: [createClip()] });
    storage.seed(TIMELINE_STORAGE_KEY, newerRaw);

    const result = saveStoredTimelineState({ playhead: 3 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("newer version");
    }
    expect(storage.raw(TIMELINE_STORAGE_KEY)).toBe(newerRaw);
  });

  it("reports save status so the UI never claims unsaved work is saved", () => {
    let state = INITIAL_TIMELINE_SAVE_STATUS;

    state = timelineSaveStatusReducer(state, { type: "attempt" });
    expect(state).toEqual({ isDirty: true, error: null });

    state = timelineSaveStatusReducer(state, { type: "failure", message: "save failed" });
    expect(state).toEqual({ isDirty: true, error: "save failed" });

    state = timelineSaveStatusReducer(state, { type: "attempt" });
    expect(state).toEqual({ isDirty: true, error: "save failed" });

    state = timelineSaveStatusReducer(state, { type: "dismiss" });
    expect(state).toEqual({ isDirty: true, error: null });

    state = timelineSaveStatusReducer(state, { type: "success" });
    expect(state).toEqual({ isDirty: false, error: null });
  });
});

describe("playhead commit gate", () => {
  it("writes once at a boundary instead of on every playback frame", () => {
    const gate = createPlayheadCommitGate();
    const writes: number[] = [];

    // Frames during playback/drag only update React state; no gate commits.
    for (let frame = 0; frame < 120; frame += 1) {
      expect(writes).toHaveLength(0);
    }

    expect(gate.commit(3.25, (seconds) => writes.push(seconds))).toBe(true);
    expect(writes).toEqual([3.25]);
  });

  it("does not repeat writes for the same committed time", () => {
    const gate = createPlayheadCommitGate();
    const writes: number[] = [];
    const write = (seconds: number) => writes.push(seconds);

    expect(gate.commit(1.5, write)).toBe(true);
    expect(gate.commit(1.5, write)).toBe(false);
    expect(gate.commit(1.5004, write)).toBe(false);
    expect(gate.commit(1.6, write)).toBe(true);
    expect(writes).toEqual([1.5, 1.6]);
  });

  it("resets the gate when the stored playhead is restored", () => {
    const gate = createPlayheadCommitGate();
    const writes: number[] = [];
    const write = (seconds: number) => writes.push(seconds);

    gate.reset(2);
    expect(gate.commit(2, write)).toBe(false);

    gate.reset();
    expect(gate.commit(2, write)).toBe(true);
  });

  it("clamps invalid or negative playhead values", () => {
    const writes: number[] = [];

    const negativeGate = createPlayheadCommitGate();
    negativeGate.commit(-5, (seconds) => writes.push(seconds));

    const invalidGate = createPlayheadCommitGate();
    invalidGate.commit(Number.NaN, (seconds) => writes.push(seconds));

    expect(writes).toEqual([0, 0]);
  });
});

describe("selection restoration", () => {
  const clips = [{ id: "clip-1" }, { id: "clip-2" }];
  const transitions = [
    createTransition({ id: "transition-ok", fromClipId: "clip-1", toClipId: "clip-2" }),
    createTransition({ id: "transition-stale", fromClipId: "clip-1", toClipId: "clip-missing" }),
  ];

  it("restores valid clip and transition selections", () => {
    expect(resolveTimelineSelection("clip-1", "transition-ok", clips, transitions)).toEqual({
      selectedClipId: "clip-1",
      selectedTransitionId: "transition-ok",
    });
  });

  it("rejects stale clip and transition IDs", () => {
    expect(resolveTimelineSelection("clip-missing", "transition-missing", clips, transitions)).toEqual({
      selectedClipId: null,
      selectedTransitionId: null,
    });
  });

  it("rejects a transition whose endpoint clip no longer exists", () => {
    expect(resolveTimelineSelection(null, "transition-stale", clips, transitions)).toEqual({
      selectedClipId: null,
      selectedTransitionId: null,
    });
  });

  it("keeps an explicitly cleared selection null", () => {
    expect(resolveTimelineSelection(null, null, clips, transitions)).toEqual({
      selectedClipId: null,
      selectedTransitionId: null,
    });
  });
});

describe("legacy saved-state compatibility", () => {
  it("hydrates version-1 payloads that predate transitions and selections", () => {
    const legacy = {
      version: 1,
      projectTitle: "Legacy project",
      clips: [createClip({ id: "legacy-clip" })],
      playhead: 12,
    };

    const parsed = deserializeTimelineState(legacy);

    expect(parsed).not.toBeNull();
    expect(parsed?.projectTitle).toBe("Legacy project");
    expect(parsed?.clips.map((clip) => clip.id)).toEqual(["legacy-clip"]);
    expect(parsed?.clips[0].transform).toBeUndefined();
    expect(parsed?.transitions).toEqual([]);
    expect(parsed?.selectedClipId).toBeNull();
    expect(parsed?.selectedTransitionId).toBeNull();
    expect(parsed?.playhead).toBe(12);
    expect(parsed?.zoom).toBe(100);
  });

  it("clamps invalid saved playhead and zoom values", () => {
    const parsed = deserializeTimelineState({
      version: 1,
      clips: [],
      playhead: Number.NaN,
      zoom: 9999,
    });

    expect(parsed?.playhead).toBe(0);
    expect(parsed?.zoom).toBe(500);
  });

  it("sanitizes saved clip transforms", () => {
    const parsed = deserializeTimelineState({
      version: 1,
      clips: [createClip({ transform: { x: 99, y: -99, scale: 99 } })],
    });

    expect(parsed?.clips[0].transform).toEqual({
      x: 3,
      y: -3,
      scale: 5,
      rotation: 0,
    });
  });

  it("sanitizes saved clip speed and preserves rotation and aspectRatio", () => {
    const parsed = deserializeTimelineState({
      version: 1,
      aspectRatio: "16:9",
      clips: [
        createClip({
          speed: -2,
          transform: { x: 0, y: 0, scale: 1, rotation: 120 },
        }),
      ],
    });

    expect(parsed?.aspectRatio).toBe("16:9");
    expect(parsed?.clips[0].speed).toBe(1.0);
    expect(parsed?.clips[0].transform?.rotation).toBe(120);

    const validFast = deserializeTimelineState({
      version: 1,
      clips: [createClip({ speed: 1.5 })],
    });
    expect(validFast?.clips[0].speed).toBe(1.5);
    expect(validFast?.aspectRatio).toBe("9:16"); // default fallback
  });

  it("rejects non-object and newer payloads", () => {
    expect(deserializeTimelineState(null)).toBeNull();
    expect(deserializeTimelineState("nope")).toBeNull();
    expect(deserializeTimelineState([])).toBeNull();
    expect(deserializeTimelineState({ version: 2, clips: [] })).toBeNull();
  });
});
