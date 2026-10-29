import { describe, expect, it } from "vitest";
import type { TimelineClip } from "@/types/timeline";
import { TimelineHistoryManager, type TimelineHistorySnapshot } from "./timeline-history";

const makeSnapshot = (duration: number): TimelineHistorySnapshot => {
  const clip: TimelineClip = {
    id: "clip-1",
    assetId: "asset-1",
    name: "scene.mp4",
    type: "video",
    trackId: "visual-1",
    startTime: 0,
    duration,
    inPoint: 0,
    outPoint: duration,
    sourceDuration: duration,
  };
  return { tracks: [], clips: [clip], transitions: [] };
};

describe("TimelineHistoryManager", () => {
  it("restores the previous snapshot and then redoes the current snapshot", () => {
    const history = new TimelineHistoryManager();
    const before = makeSnapshot(2);
    const after = makeSnapshot(4);

    history.push(before);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    expect(history.undo(after)?.clips[0].duration).toBe(2);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);

    expect(history.redo(before)?.clips[0].duration).toBe(4);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it("clears the redo stack after a new committed edit", () => {
    const history = new TimelineHistoryManager();
    const first = makeSnapshot(1);
    const second = makeSnapshot(2);

    history.push(first);
    history.undo(second);
    expect(history.canRedo).toBe(true);

    history.push(makeSnapshot(3));
    expect(history.canRedo).toBe(false);
  });

  it("stores snapshots defensively", () => {
    const history = new TimelineHistoryManager();
    const original = makeSnapshot(2);
    history.push(original);
    original.clips[0].duration = 99;

    expect(history.undo(makeSnapshot(4))?.clips[0].duration).toBe(2);
  });

  it("bounds the undo stack to the configured capacity", () => {
    const history = new TimelineHistoryManager(2);
    history.push(makeSnapshot(1));
    history.push(makeSnapshot(2));
    history.push(makeSnapshot(3));

    expect(history.undo(makeSnapshot(4))?.clips[0].duration).toBe(3);
    expect(history.undo(makeSnapshot(3))?.clips[0].duration).toBe(2);
    expect(history.undo(makeSnapshot(2))).toBeNull();
  });

  it("returns null when no undo or redo entry exists", () => {
    const history = new TimelineHistoryManager();
    expect(history.undo(makeSnapshot(1))).toBeNull();
    expect(history.redo(makeSnapshot(1))).toBeNull();
  });

  it("rejects invalid history capacity", () => {
    expect(() => new TimelineHistoryManager(0)).toThrow(RangeError);
    expect(() => new TimelineHistoryManager(1.5)).toThrow(RangeError);
  });
});
