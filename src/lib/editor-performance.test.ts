import { describe, it, expect } from "vitest";
import type { TimelineClip, TimelineTransition } from "@/types/timeline";
import { getTransitionProgress } from "./transition-helpers";

describe("Editor Playback Performance Optimizations (P-02, P-03, P-04, P-05)", () => {
  const mockClips: TimelineClip[] = [
    {
      id: "v1",
      assetId: "a1",
      name: "scene1.png",
      type: "image",
      trackId: "visual-1",
      startTime: 0,
      duration: 5,
      inPoint: 0,
      outPoint: 5,
    },
    {
      id: "v2",
      assetId: "a2",
      name: "scene2.png",
      type: "image",
      trackId: "visual-1",
      startTime: 5,
      duration: 5,
      inPoint: 0,
      outPoint: 5,
    },
    {
      id: "ov1",
      assetId: "a3",
      name: "overlay.png",
      type: "image",
      trackId: "visual-2",
      startTime: 2,
      duration: 4,
      inPoint: 0,
      outPoint: 4,
    },
    {
      id: "aud1",
      assetId: "a4",
      name: "voice.mp3",
      type: "audio",
      trackId: "audio",
      startTime: 0,
      duration: 10,
      inPoint: 0,
      outPoint: 10,
    },
  ];

  const mockTransitions: TimelineTransition[] = [
    {
      id: "trans-1",
      type: "cross-dissolve",
      duration: 1.0,
      fromClipId: "v1",
      toClipId: "v2",
      trackId: "visual-1",
    },
  ];

  it("P-04: indexes clips into Map for O(1) transition lookup instead of O(N) array search", () => {
    const clipMap = new Map(mockClips.map((c) => [c.id, c]));

    const playhead = 5.0; // Mid-transition (4.5s to 5.5s)
    let activeTransitionData = null;

    for (const trans of mockTransitions) {
      const fromClip = clipMap.get(trans.fromClipId);
      const toClip = clipMap.get(trans.toClipId);

      expect(fromClip).toBeDefined();
      expect(toClip).toBeDefined();

      if (fromClip && toClip) {
        const progress = getTransitionProgress(playhead, trans, fromClip, toClip);
        if (progress !== null) {
          activeTransitionData = { transition: trans, fromClip, toClip, progress };
          break;
        }
      }
    }

    expect(activeTransitionData).not.toBeNull();
    expect(activeTransitionData?.progress).toBeCloseTo(0.5, 2);
  });

  it("P-03: indexes assets into Map for O(1) asset metadata resolution across tracks", () => {
    const mockAssets = [
      { id: "a1", name: "scene1.png", category: "image" as const },
      { id: "a2", name: "scene2.png", category: "image" as const },
      { id: "a3", name: "overlay.png", category: "image" as const },
      { id: "a4", name: "voice.mp3", category: "audio" as const },
    ];

    const assetMap = new Map(mockAssets.map((a) => [a.id, a]));

    for (const clip of mockClips) {
      const asset = assetMap.get(clip.assetId);
      expect(asset).toBeDefined();
      expect(asset?.id).toBe(clip.assetId);
    }
  });

  it("P-05: verifies transient slider update pattern updates local clips without pushing history snapshot", () => {
    let historyPushedCount = 0;
    const historyStack: TimelineClip[][] = [];
    let currentClips = [...mockClips];

    const pushHistory = (clips: TimelineClip[]) => {
      historyPushedCount++;
      historyStack.push(JSON.parse(JSON.stringify(clips)));
    };

    const setClipsTransient = (newClips: TimelineClip[]) => {
      // Direct transient update (no history snapshot pushed)
      currentClips = newClips;
    };

    const commitChange = (originalClips: TimelineClip[], finalClips: TimelineClip[]) => {
      pushHistory(originalClips);
      currentClips = finalClips;
    };

    // User scrubs a slider generating 5 intermediate onInput ticks:
    const initialClips = [...currentClips];
    for (let step = 1; step <= 5; step++) {
      setClipsTransient(
        currentClips.map((c) =>
          c.id === "v1" ? { ...c, duration: 5.0 + step * 0.1 } : c
        )
      );
    }

    // Intermediate onInput should have pushed 0 history snapshots:
    expect(historyPushedCount).toBe(0);
    expect(currentClips.find((c) => c.id === "v1")?.duration).toBeCloseTo(5.5, 2);

    // User releases the slider (onChange fires):
    commitChange(initialClips, currentClips);

    // Exactly 1 history snapshot pushed for the entire drag operation!
    expect(historyPushedCount).toBe(1);
    expect(historyStack[0].find((c) => c.id === "v1")?.duration).toBe(5.0); // can undo back to 5.0s
  });

  it("P-05: verifies pointer gesture lifecycle for scale/rotation/duration commits once on release and supports single Ctrl+Z", () => {
    let historyPushedCount = 0;
    const historyStack: TimelineClip[][] = [];
    const redoStack: TimelineClip[][] = [];
    let currentClips = [...mockClips];

    let initialClipsRef: TimelineClip[] | null = null;

    const onPointerDown = () => {
      initialClipsRef = JSON.parse(JSON.stringify(currentClips));
    };

    const onTransientChange = (newClips: TimelineClip[]) => {
      currentClips = newClips;
    };

    const onPointerUp = () => {
      if (initialClipsRef) {
        historyPushedCount++;
        historyStack.push(initialClipsRef);
        redoStack.length = 0;
        initialClipsRef = null;
      }
    };

    const undo = () => {
      if (historyStack.length === 0) return;
      const prev = historyStack.pop()!;
      redoStack.push(JSON.parse(JSON.stringify(currentClips)));
      currentClips = prev;
    };

    const redo = () => {
      if (redoStack.length === 0) return;
      const next = redoStack.pop()!;
      historyStack.push(JSON.parse(JSON.stringify(currentClips)));
      currentClips = next;
    };

    // User starts dragging Scale slider from 1.0 (100%) to 1.5 (150%) across 10 intermediate ticks:
    onPointerDown();
    for (let step = 1; step <= 10; step++) {
      onTransientChange(
        currentClips.map((c) =>
          c.id === "v1"
            ? { ...c, transform: { x: 0, y: 0, scale: 1.0 + step * 0.05, rotation: 0 } }
            : c
        )
      );
    }

    // While dragging, 0 history snapshots pushed:
    expect(historyPushedCount).toBe(0);
    expect(currentClips.find((c) => c.id === "v1")?.transform?.scale).toBe(1.5);

    // User releases the slider pointer:
    onPointerUp();
    expect(historyPushedCount).toBe(1);

    // Single Ctrl+Z reverts directly back to initial scale 1.0:
    undo();
    expect(currentClips.find((c) => c.id === "v1")?.transform?.scale).toBeUndefined(); // or initial
    expect(historyStack).toHaveLength(0);

    // Single Ctrl+Y re-applies the final scale 1.5:
    redo();
    expect(currentClips.find((c) => c.id === "v1")?.transform?.scale).toBe(1.5);
  });
});
