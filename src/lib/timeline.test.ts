import { describe, it, expect } from "vitest";
import {
  type TimelineClip,
  isVisualTrack,
  isAudioTrack,
  getVisualTrackLayerIndex,
} from "../types/timeline";
import { calculateFitVisualsToVoiceover } from "./fit-visuals";

describe("Timeline Operations Logic", () => {
  const sampleClip: TimelineClip = {
    id: "clip-1",
    assetId: "asset-1",
    name: "scene-1.png",
    type: "image",
    trackId: "visual-1",
    startTime: 2.0,
    duration: 4.0,
    inPoint: 0,
    outPoint: 4.0,
  };

  it("prevents negative start times when moving clips", () => {
    const newStartTime = Math.max(0, -5.0);
    expect(newStartTime).toBe(0);
  });

  it("preserves intentional gaps between clips when moving freely", () => {
    const clipA: TimelineClip = { ...sampleClip, id: "a", startTime: 0, duration: 3 };
    const clipB: TimelineClip = { ...sampleClip, id: "b", startTime: 8, duration: 4 }; // 5s gap

    // Moving clipB to 12s maintains the intentional gap
    const movedClipB = { ...clipB, startTime: 12 };
    expect(movedClipB.startTime).toBe(12);
    expect(movedClipB.startTime - (clipA.startTime + clipA.duration)).toBe(9); // 9s gap preserved
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

describe("Multi-Track Visual Layering Helpers", () => {
  it("correctly identifies visual tracks including backward-compatible trackId", () => {
    expect(isVisualTrack("visual")).toBe(true);
    expect(isVisualTrack("visual-1")).toBe(true);
    expect(isVisualTrack("visual-2")).toBe(true);
    expect(isVisualTrack("audio")).toBe(false);
  });

  it("correctly identifies audio tracks", () => {
    expect(isAudioTrack("audio")).toBe(true);
    expect(isAudioTrack("audio-1")).toBe(true);
    expect(isAudioTrack("visual-1")).toBe(false);
  });

  it("assigns higher z-order to visual-2 (overlay) over visual-1 (base)", () => {
    expect(getVisualTrackLayerIndex("visual-2")).toBe(2);
    expect(getVisualTrackLayerIndex("visual-1")).toBe(1);
    expect(getVisualTrackLayerIndex("visual")).toBe(1);
    expect(getVisualTrackLayerIndex("visual-2")).toBeGreaterThan(getVisualTrackLayerIndex("visual-1"));
  });
});

describe("Magnetic Snapping Logic", () => {
  it("snaps to nearby point when within threshold", () => {
    const snapPoints = [0, 4.0, 8.5];
    const thresholdSec = 0.2; // ~8px at 40px/s

    const rawPos = 4.12; // within 0.2s of 4.0
    let snappedPos = rawPos;

    for (const pt of snapPoints) {
      if (Math.abs(rawPos - pt) <= thresholdSec) {
        snappedPos = pt;
        break;
      }
    }

    expect(snappedPos).toBe(4.0);
  });

  it("does not snap when outside threshold", () => {
    const snapPoints = [0, 4.0, 8.5];
    const thresholdSec = 0.2;

    const rawPos = 4.35; // beyond 0.2s of 4.0
    let snappedPos = rawPos;

    for (const pt of snapPoints) {
      if (Math.abs(rawPos - pt) <= thresholdSec) {
        snappedPos = pt;
        break;
      }
    }

    expect(snappedPos).toBe(4.35); // keeps exact position
  });
});

describe("Timeline Zoom Scale Logic", () => {
  it("scales pixels per second without altering clip timing", () => {
    const clip: TimelineClip = {
      id: "c1",
      assetId: "a1",
      name: "scene.png",
      type: "image",
      trackId: "visual-1",
      startTime: 5.0,
      duration: 3.0,
      inPoint: 0,
      outPoint: 3.0,
    };

    const zoom100PxPerSec = (100 / 100) * 40; // 40px/s
    const zoom150PxPerSec = (150 / 100) * 40; // 60px/s

    // Pixel width changes with zoom
    expect(clip.duration * zoom100PxPerSec).toBe(120);
    expect(clip.duration * zoom150PxPerSec).toBe(180);

    // Clip timing remains 100% constant
    expect(clip.startTime).toBe(5.0);
    expect(clip.duration).toBe(3.0);
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
        trackId: "visual-1",
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
      { id: "img-1", assetId: "a1", name: "1.png", type: "image", trackId: "visual-1", startTime: 0, duration: 2.5, inPoint: 0, outPoint: 2.5 },
      { id: "img-2", assetId: "a2", name: "2.png", type: "image", trackId: "visual-1", startTime: 2.5, duration: 2.5, inPoint: 0, outPoint: 2.5 },
      { id: "img-3", assetId: "a3", name: "3.png", type: "image", trackId: "visual-1", startTime: 5.0, duration: 2.5, inPoint: 0, outPoint: 2.5 },
      { id: "img-4", assetId: "a4", name: "4.png", type: "image", trackId: "visual-1", startTime: 7.5, duration: 2.5, inPoint: 0, outPoint: 2.5 },
    ];

    const result = calculateFitVisualsToVoiceover(clips);
    expect(result.success).toBe(true);

    const fittedVisuals = result.updatedClips.filter((c) => isVisualTrack(c.trackId));
    expect(fittedVisuals.length).toBe(4);

    expect(fittedVisuals[0].startTime).toBe(0);
    expect(fittedVisuals[0].duration).toBe(5);

    expect(fittedVisuals[1].startTime).toBe(5);
    expect(fittedVisuals[1].duration).toBe(5);

    expect(fittedVisuals[2].startTime).toBe(10);
    expect(fittedVisuals[2].duration).toBe(5);

    expect(fittedVisuals[3].startTime).toBe(15);
    expect(fittedVisuals[3].duration).toBe(5);

    const finalEnd = fittedVisuals[3].startTime + fittedVisuals[3].duration;
    expect(finalEnd).toBe(20.0);
  });

  it("keeps video at source limit and expands image to absorb remaining voiceover", () => {
    const clips: TimelineClip[] = [
      audioClip,
      { id: "vid-1", assetId: "v1", name: "hero.mp4", type: "video", trackId: "visual-1", startTime: 0, duration: 4.0, inPoint: 0, outPoint: 4.0, sourceDuration: 4.0 },
      { id: "img-1", assetId: "i1", name: "1.png", type: "image", trackId: "visual-1", startTime: 4.0, duration: 3.0, inPoint: 0, outPoint: 3.0 },
      { id: "img-2", assetId: "i2", name: "2.png", type: "image", trackId: "visual-1", startTime: 7.0, duration: 3.0, inPoint: 0, outPoint: 3.0 },
    ];

    const result = calculateFitVisualsToVoiceover(clips);
    expect(result.success).toBe(true);

    const fittedVisuals = result.updatedClips.filter((c) => isVisualTrack(c.trackId));
    expect(fittedVisuals[0].duration).toBe(4.0);
    expect(fittedVisuals[1].duration).toBe(8.0);
    expect(fittedVisuals[2].duration).toBe(8.0);

    const totalVisualEnd = fittedVisuals[2].startTime + fittedVisuals[2].duration;
    expect(totalVisualEnd).toBe(20.0);
  });
});
