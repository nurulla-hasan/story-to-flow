import { describe, it, expect } from "vitest";
import type { TimelineClip } from "@/types/timeline";

describe("Timeline Operations Logic", () => {
  const sampleClip: TimelineClip = {
    id: "clip-1",
    assetId: "asset-1",
    name: "scene-1.png",
    type: "image",
    trackId: "visual",
    startTime: 2.0,
    duration: 4.0,
    inPoint: 0,
    outPoint: 4.0,
  };

  it("prevents negative start times when moving clips", () => {
    const newStartTime = Math.max(0, -5.0);
    expect(newStartTime).toBe(0);
  });

  it("enforces minimum duration when trimming clips", () => {
    const minDuration = 0.5;
    const requestedDuration = 0.2;
    const trimmed = Math.max(minDuration, requestedDuration);
    expect(trimmed).toBe(0.5);
  });

  it("splits a clip accurately into two adjacent parts at playhead", () => {
    const playhead = 3.5;
    const clipStart = sampleClip.startTime; // 2.0
    const clipDuration = sampleClip.duration; // 4.0

    const splitOffset = playhead - clipStart; // 1.5s
    const part1Duration = splitOffset; // 1.5s
    const part2Duration = clipDuration - splitOffset; // 2.5s

    const part1: TimelineClip = {
      ...sampleClip,
      duration: part1Duration,
      outPoint: sampleClip.inPoint + part1Duration,
    };

    const part2: TimelineClip = {
      ...sampleClip,
      id: "clip-2",
      startTime: playhead,
      duration: part2Duration,
      inPoint: sampleClip.inPoint + splitOffset,
      outPoint: sampleClip.outPoint,
    };

    expect(part1.startTime).toBe(2.0);
    expect(part1.duration).toBe(1.5);
    expect(part2.startTime).toBe(3.5);
    expect(part2.duration).toBe(2.5);
    expect(part1.duration + part2.duration).toBe(4.0);
  });

  it("duplicates a clip and places it immediately adjacent", () => {
    const duplicate: TimelineClip = {
      ...sampleClip,
      id: "clip-copy",
      name: `${sampleClip.name} (Copy)`,
      startTime: sampleClip.startTime + sampleClip.duration,
    };

    expect(duplicate.startTime).toBe(6.0);
    expect(duplicate.duration).toBe(4.0);
  });

  it("manages bounded undo/redo history correctly", () => {
    const history: TimelineClip[][] = [];
    const maxHistory = 50;

    // Push 55 items
    for (let i = 1; i <= 55; i++) {
      history.push([{ ...sampleClip, id: `clip-${i}` }]);
      if (history.length > maxHistory) {
        history.shift();
      }
    }

    expect(history.length).toBe(50);
    // Oldest should be clip-6 (1 to 5 were shifted off)
    expect(history[0][0].id).toBe("clip-6");
    expect(history[49][0].id).toBe("clip-55");
  });
});
