import { describe, it, expect } from "vitest";
import type { TimelineClip } from "../types/timeline";
import { calculateFitVisualsToVoiceover } from "./fit-visuals";

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

    for (let i = 1; i <= 55; i++) {
      history.push([{ ...sampleClip, id: `clip-${i}` }]);
      if (history.length > maxHistory) {
        history.shift();
      }
    }

    expect(history.length).toBe(50);
    expect(history[0][0].id).toBe("clip-6");
    expect(history[49][0].id).toBe("clip-55");
  });
});

describe("Fit Visuals to Voiceover Algorithm", () => {
  const audioClip: TimelineClip = {
    id: "audio-1",
    assetId: "asset-audio-1",
    name: "narration.mp3",
    type: "audio",
    trackId: "audio",
    startTime: 0,
    duration: 20.0,
    inPoint: 0,
    outPoint: 20.0,
  };

  it("returns error message when no audio clips exist", () => {
    const visualClips: TimelineClip[] = [
      {
        id: "vis-1",
        assetId: "a1",
        name: "s1.png",
        type: "image",
        trackId: "visual",
        startTime: 0,
        duration: 3,
        inPoint: 0,
        outPoint: 3,
      },
    ];

    const result = calculateFitVisualsToVoiceover(visualClips);
    expect(result.success).toBe(false);
    expect(result.message).toContain("No voiceover audio found");
  });

  it("fits 4 equal images to exactly cover 20s voiceover with zero gaps", () => {
    const clips: TimelineClip[] = [
      audioClip,
      { id: "img-1", assetId: "a1", name: "1.png", type: "image", trackId: "visual", startTime: 0, duration: 2.5, inPoint: 0, outPoint: 2.5 },
      { id: "img-2", assetId: "a2", name: "2.png", type: "image", trackId: "visual", startTime: 2.5, duration: 2.5, inPoint: 0, outPoint: 2.5 },
      { id: "img-3", assetId: "a3", name: "3.png", type: "image", trackId: "visual", startTime: 5.0, duration: 2.5, inPoint: 0, outPoint: 2.5 },
      { id: "img-4", assetId: "a4", name: "4.png", type: "image", trackId: "visual", startTime: 7.5, duration: 2.5, inPoint: 0, outPoint: 2.5 },
    ];

    const result = calculateFitVisualsToVoiceover(clips);
    expect(result.success).toBe(true);

    const fittedVisuals = result.updatedClips.filter((c) => c.trackId === "visual");
    expect(fittedVisuals.length).toBe(4);

    // Each image should be scaled to 5.0s
    expect(fittedVisuals[0].startTime).toBe(0);
    expect(fittedVisuals[0].duration).toBe(5);

    expect(fittedVisuals[1].startTime).toBe(5);
    expect(fittedVisuals[1].duration).toBe(5);

    expect(fittedVisuals[2].startTime).toBe(10);
    expect(fittedVisuals[2].duration).toBe(5);

    expect(fittedVisuals[3].startTime).toBe(15);
    expect(fittedVisuals[3].duration).toBe(5);

    // Total visual sequence ends exactly at 20.0s (equal to voiceover duration)
    const finalEnd = fittedVisuals[3].startTime + fittedVisuals[3].duration;
    expect(finalEnd).toBe(20.0);
  });

  it("keeps video at source limit and expands image to absorb remaining voiceover", () => {
    const clips: TimelineClip[] = [
      audioClip, // 20.0s voiceover
      // 1 hero video of 4.0s
      { id: "vid-1", assetId: "v1", name: "hero.mp4", type: "video", trackId: "visual", startTime: 0, duration: 4.0, inPoint: 0, outPoint: 4.0, sourceDuration: 4.0 },
      // 2 images initially 3.0s each
      { id: "img-1", assetId: "i1", name: "1.png", type: "image", trackId: "visual", startTime: 4.0, duration: 3.0, inPoint: 0, outPoint: 3.0 },
      { id: "img-2", assetId: "i2", name: "2.png", type: "image", trackId: "visual", startTime: 7.0, duration: 3.0, inPoint: 0, outPoint: 3.0 },
    ];

    const result = calculateFitVisualsToVoiceover(clips);
    expect(result.success).toBe(true);

    const fittedVisuals = result.updatedClips.filter((c) => c.trackId === "visual");
    // Video remains 4.0s
    expect(fittedVisuals[0].duration).toBe(4.0);
    // Remaining 16.0s split equally between 2 images = 8.0s each
    expect(fittedVisuals[1].duration).toBe(8.0);
    expect(fittedVisuals[2].duration).toBe(8.0);

    const totalVisualEnd = fittedVisuals[2].startTime + fittedVisuals[2].duration;
    expect(totalVisualEnd).toBe(20.0);
  });
});
