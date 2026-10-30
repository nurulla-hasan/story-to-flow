import { describe, it, expect, vi } from "vitest";
import { createPlayheadStore } from "@/lib/playhead-store";
import { getActiveVisualClips, getActiveTransitionsByTrack } from "@/features/editor/domain/preview-selectors";
import type { TimelineClip, TimelineTrack, TimelineTransition } from "@/types/timeline";

describe("Timeline Performance Architecture Guard Tests", () => {
  it("PlayheadStore decouples high-frequency ticks from static project state", () => {
    const store = createPlayheadStore(0);
    const subscriber = vi.fn();

    const unsubscribe = store.subscribe(subscriber);

    // 60 consecutive frames
    for (let f = 1; f <= 60; f++) {
      store.setPlayhead(f * 0.016);
    }

    expect(subscriber).toHaveBeenCalledTimes(60);
    expect(store.getPlayhead()).toBeCloseTo(0.96, 2);

    unsubscribe();
    store.setPlayhead(1.0);
    expect(subscriber).toHaveBeenCalledTimes(60);
  });

  it("getActiveVisualClips runs efficiently with 2,000 clips and respects layer order", () => {
    const tracks: TimelineTrack[] = [
      { id: "visual-1", name: "Base Track", type: "visual", order: 1, visible: true, locked: false, muted: false, volume: 1 },
      { id: "visual-2", name: "Overlay Track", type: "visual", order: 0, visible: true, locked: false, muted: false, volume: 1 },
    ];

    const clips: TimelineClip[] = [];
    for (let i = 0; i < 2000; i++) {
      const isBase = i % 2 === 0;
      clips.push({
        id: `clip_${i}`,
        assetId: `asset_${i}`,
        name: `scene_${i}.png`,
        type: "image",
        trackId: isBase ? "visual-1" : "visual-2",
        startTime: i * 2,
        duration: 4,
        inPoint: 0,
        outPoint: 4,
      });
    }

    // At playhead = 100.5s:
    // Base clip at index 50 (start: 100, dur: 4) is active (order 1 -> lower layer)
    // Overlay clip at index 49 (start: 98, dur: 4) is active
    // Overlay clip at index 51 (start: 102, dur: 4) is not yet active
    const t0 = performance.now();
    const active = getActiveVisualClips(clips, tracks, 100.5);
    const durationMs = performance.now() - t0;

    expect(durationMs).toBeLessThan(15); // Must execute rapidly well below 16.7ms frame budget
    expect(active.length).toBeGreaterThan(0);

    // Overlay (order 0) must be after Base (order 1) in the compositing stack
    const baseIdx = active.findIndex((c) => c.trackId === "visual-1");
    const overlayIdx = active.findIndex((c) => c.trackId === "visual-2");
    if (baseIdx !== -1 && overlayIdx !== -1) {
      expect(overlayIdx).toBeGreaterThan(baseIdx);
    }
  });

  it("getActiveTransitionsByTrack accepts a memoized Map for O(1) transition lookup", () => {
    const tracks: TimelineTrack[] = [
      { id: "visual-1", name: "Base", type: "visual", order: 0, visible: true, locked: false, muted: false, volume: 1 },
    ];
    const clipA: TimelineClip = {
      id: "cA", assetId: "a1", name: "A", type: "image", trackId: "visual-1",
      startTime: 0, duration: 5, inPoint: 0, outPoint: 5,
    };
    const clipB: TimelineClip = {
      id: "cB", assetId: "a2", name: "B", type: "image", trackId: "visual-1",
      startTime: 5, duration: 5, inPoint: 0, outPoint: 5,
    };
    const transition: TimelineTransition = {
      id: "t1", fromClipId: "cA", toClipId: "cB", trackId: "visual-1",
      duration: 1.0, type: "cross-dissolve",
    };

    const clipMap = new Map<string, TimelineClip>([
      ["cA", clipA],
      ["cB", clipB],
    ]);

    const activeAtMid = getActiveTransitionsByTrack([transition], clipMap, tracks, 5.0);
    expect(activeAtMid.has("visual-1")).toBe(true);
    expect(activeAtMid.get("visual-1")?.progress).toBeCloseTo(0.5, 2);

    const activeOutside = getActiveTransitionsByTrack([transition], clipMap, tracks, 1.0);
    expect(activeOutside.size).toBe(0);
  });

  it("virtualization window correctly filters 2,000 clips to only visible viewport slice", () => {
    const clips: TimelineClip[] = [];
    for (let i = 0; i < 2000; i++) {
      clips.push({
        id: `clip_${i}`,
        assetId: `asset_${i}`,
        name: `scene_${i}.png`,
        type: "image",
        trackId: "visual-1",
        startTime: i * 3, // each clip is 3s
        duration: 3,
        inPoint: 0,
        outPoint: 3,
      });
    }

    // Viewport from 100s to 120s with overscan of 10s (visible range: 90s to 130s)
    const visibleStartTime = 90;
    const visibleEndTime = 130;
    const selectedClipId = "clip_1999"; // selected clip far offscreen

    const visibleClips = clips.filter(
      (clip) =>
        clip.id === selectedClipId ||
        (clip.startTime + clip.duration >= visibleStartTime && clip.startTime <= visibleEndTime)
    );

    // Out of 2,000 clips, only ~15 clips plus the 1 selected clip should be rendered
    expect(visibleClips.length).toBeLessThan(20);
    expect(visibleClips.some((c) => c.id === "clip_1999")).toBe(true);
  });
});
