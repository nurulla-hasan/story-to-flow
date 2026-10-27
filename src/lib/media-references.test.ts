import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkMediaAssetRemoval,
  clearRegisteredTimelineAssetReferences,
  collectMediaAssetReferences,
  getMediaAssetUsage,
  isMediaAssetReferenced,
  registerTimelineAssetReferences,
} from "./media-references";
import { TIMELINE_STORAGE_KEY } from "./timeline-storage";

type ReferencedClip = {
  id: string;
  assetId: string;
  trackId: "visual" | "visual-1" | "visual-2" | "audio" | "audio-1";
  name: string;
};

function clip(overrides: Partial<ReferencedClip> = {}): ReferencedClip {
  return {
    id: "clip-1",
    assetId: "asset-1",
    trackId: "visual-1",
    name: "scene.png",
    ...overrides,
  };
}

const globalWithWindow = globalThis as unknown as { window?: unknown };
const originalWindow = globalWithWindow.window;

function installWindow(savedClips: ReferencedClip[] = []) {
  const values = new Map<string, string>();
  values.set(
    TIMELINE_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      projectTitle: "Saved project",
      clips: savedClips,
      transitions: [],
      playhead: 0,
      zoom: 100,
      selectedClipId: null,
      selectedTransitionId: null,
      updatedAt: 1,
    })
  );

  globalWithWindow.window = {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

beforeEach(() => {
  installWindow([]);
});

afterEach(() => {
  clearRegisteredTimelineAssetReferences();
  globalWithWindow.window = originalWindow;
});

describe("timeline media references", () => {
  it("collects references across every visual and audio track", () => {
    const references = collectMediaAssetReferences([
      clip({ id: "clip-a", trackId: "visual" }),
      clip({ id: "clip-b", trackId: "visual-1" }),
      clip({ id: "clip-c", trackId: "visual-2" }),
      clip({ id: "clip-d", trackId: "audio" }),
      clip({ id: "clip-e", trackId: "audio-1" }),
      clip({ id: "clip-other", assetId: "asset-2", trackId: "visual-1" }),
    ]);

    const shared = references.get("asset-1");
    expect(shared?.clipCount).toBe(5);
    expect(shared?.clipIds).toEqual(["clip-a", "clip-b", "clip-c", "clip-d", "clip-e"]);
    expect(new Set(shared?.trackIds)).toEqual(
      new Set(["visual", "visual-1", "visual-2", "audio", "audio-1"])
    );
    expect(references.get("asset-2")?.clipCount).toBe(1);
  });

  it("merges live and saved references without double-counting the same clip", () => {
    installWindow([
      clip({ id: "clip-1", name: "saved-name.png" }),
      clip({ id: "clip-2", name: "saved-only.png" }),
    ]);

    registerTimelineAssetReferences([
      clip({ id: "clip-1", name: "live-name.png" }),
    ]);

    const usage = getMediaAssetUsage("asset-1");

    expect(usage.clipCount).toBe(2);
    expect(usage.clipIds).toEqual(["clip-1", "clip-2"]);
    expect(usage.clipNames).toEqual(["live-name.png", "saved-only.png"]);
  });

  it("still blocks deletion from saved state when no live timeline is registered", () => {
    installWindow([clip({ id: "clip-saved", trackId: "audio-1" })]);

    expect(isMediaAssetReferenced("asset-1")).toBe(true);
    const removal = checkMediaAssetRemoval("asset-1");

    expect(removal.canRemove).toBe(false);
    if (!removal.canRemove) {
      expect(removal.reason).toBe("in-use");
      expect(removal.usage.clipCount).toBe(1);
      expect(removal.usage.trackIds).toEqual(["audio-1"]);
    }
  });

  it("allows removal of assets that no clip references", () => {
    installWindow([clip({ id: "clip-saved", assetId: "asset-in-use" })]);
    registerTimelineAssetReferences([clip({ id: "clip-live", assetId: "asset-live-in-use" })]);

    expect(isMediaAssetReferenced("asset-unused")).toBe(false);
    expect(checkMediaAssetRemoval("asset-unused").canRemove).toBe(true);
    expect(checkMediaAssetRemoval("asset-live-in-use").canRemove).toBe(false);
    expect(checkMediaAssetRemoval("asset-in-use").canRemove).toBe(false);
  });

  it("drops live references after the timeline unregisters", () => {
    registerTimelineAssetReferences([clip({ id: "clip-live" })]);
    expect(checkMediaAssetRemoval("asset-1").canRemove).toBe(false);

    clearRegisteredTimelineAssetReferences();
    expect(checkMediaAssetRemoval("asset-1").canRemove).toBe(true);
  });
});
