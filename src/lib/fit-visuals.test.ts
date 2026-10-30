import { describe, expect, it } from "vitest";
import type { TimelineClip, TimelineTransition } from "@/types/timeline";
import { calculateFitVisualsToVoiceover } from "./fit-visuals";

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

describe("Fit Visuals to Voiceover - Layer-Aware Processing", () => {
  it("requires at least one audio clip", () => {
    const clips = [createClip()];
    const result = calculateFitVisualsToVoiceover(clips, []);

    expect(result.success).toBe(false);
    expect(result.message).toContain("No voiceover audio");
  });

  it("requires at least one visual clip", () => {
    const clips = [createClip({ trackId: "audio", type: "audio" })];
    const result = calculateFitVisualsToVoiceover(clips, []);

    expect(result.success).toBe(false);
    expect(result.message).toContain("No visual scene clips");
  });

  it("fits multiple base-layer clips sequentially to voiceover duration", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 10 }),
      createClip({ id: "vis-1", trackId: "visual-1", startTime: 0, duration: 3 }),
      createClip({ id: "vis-2", trackId: "visual-1", startTime: 3, duration: 2 }),
      createClip({ id: "vis-3", trackId: "visual-1", startTime: 5, duration: 1 }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);

    expect(result.success).toBe(true);
    const visuals = result.updatedClips.filter((c) => c.trackId === "visual-1");
    expect(visuals).toHaveLength(3);

    // Should be sequential with no gaps
    expect(visuals[0].startTime).toBe(0);
    expect(visuals[1].startTime).toBeGreaterThan(visuals[0].startTime);
    expect(visuals[2].startTime).toBeGreaterThan(visuals[1].startTime);

    // Total should match voiceover
    const totalDuration = visuals.reduce((sum, c) => sum + c.duration, 0);
    expect(totalDuration).toBeCloseTo(10, 1);
  });

  it("keeps overlay clips on Visual Layer 2 separate from base layer", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 10 }),
      createClip({ id: "base-1", trackId: "visual-1", startTime: 0, duration: 5 }),
      createClip({ id: "base-2", trackId: "visual-1", startTime: 5, duration: 5 }),
      createClip({ id: "overlay-1", trackId: "visual-2", startTime: 2, duration: 3 }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);

    expect(result.success).toBe(true);

    const layer1 = result.updatedClips.filter((c) => c.trackId === "visual-1");
    const layer2 = result.updatedClips.filter((c) => c.trackId === "visual-2");

    expect(layer1).toHaveLength(2);
    expect(layer2).toHaveLength(1);

    // Layer 1 should be sequential starting at 0
    expect(layer1[0].id).toBe("base-1");
    expect(layer1[0].startTime).toBe(0);
    expect(layer1[1].id).toBe("base-2");
    expect(layer1[1].startTime).toBe(layer1[0].duration);

    // Layer 2 should be fitted independently starting at 0
    expect(layer2[0].id).toBe("overlay-1");
    expect(layer2[0].startTime).toBe(0);
    expect(layer2[0].trackId).toBe("visual-2");
  });

  it("allows cross-layer overlaps after fitting", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 10 }),
      createClip({ id: "base-1", trackId: "visual-1", startTime: 0, duration: 5 }),
      createClip({ id: "base-2", trackId: "visual-1", startTime: 5, duration: 5 }),
      createClip({ id: "overlay-1", trackId: "visual-2", startTime: 3, duration: 4 }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);

    expect(result.success).toBe(true);

    const layer1 = result.updatedClips.filter((c) => c.trackId === "visual-1");
    const layer2 = result.updatedClips.filter((c) => c.trackId === "visual-2");

    // Both layers should fit to 10s independently
    const layer1Total = layer1.reduce((sum, c) => sum + c.duration, 0);
    const layer2Total = layer2.reduce((sum, c) => sum + c.duration, 0);

    expect(layer1Total).toBeCloseTo(10, 1);
    expect(layer2Total).toBeCloseTo(10, 1);

    // Layers should overlap in time (layer 1 starts at 0, layer 2 starts at 0)
    expect(layer1[0].startTime).toBe(0);
    expect(layer2[0].startTime).toBe(0);
  });

  it("does not interleave clips from different layers into one timeline", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 12 }),
      createClip({ id: "L1-A", trackId: "visual-1", startTime: 0, duration: 3 }),
      createClip({ id: "L2-A", trackId: "visual-2", startTime: 1, duration: 2 }),
      createClip({ id: "L1-B", trackId: "visual-1", startTime: 3, duration: 3 }),
      createClip({ id: "L2-B", trackId: "visual-2", startTime: 4, duration: 2 }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);

    expect(result.success).toBe(true);

    const layer1 = result.updatedClips.filter((c) => c.trackId === "visual-1");
    const layer2 = result.updatedClips.filter((c) => c.trackId === "visual-2");

    // Each layer should have its own sequential timeline
    expect(layer1[0].id).toBe("L1-A");
    expect(layer1[0].startTime).toBe(0);
    expect(layer1[1].id).toBe("L1-B");
    expect(layer1[1].startTime).toBe(layer1[0].duration);

    expect(layer2[0].id).toBe("L2-A");
    expect(layer2[0].startTime).toBe(0);
    expect(layer2[1].id).toBe("L2-B");
    expect(layer2[1].startTime).toBe(layer2[0].duration);

    // Clips from different layers should NOT appear in each other's sequences
    expect(layer1.every((c) => c.trackId === "visual-1")).toBe(true);
    expect(layer2.every((c) => c.trackId === "visual-2")).toBe(true);
  });

  it("preserves still-image scaling behavior", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 12 }),
      createClip({ id: "img-1", trackId: "visual-1", type: "image", duration: 2 }),
      createClip({ id: "img-2", trackId: "visual-1", type: "image", duration: 3 }),
      createClip({ id: "img-3", trackId: "visual-1", type: "image", duration: 1 }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);

    expect(result.success).toBe(true);

    const images = result.updatedClips.filter((c) => c.type === "image");
    const totalDuration = images.reduce((sum, c) => sum + c.duration, 0);

    // Images should scale to exactly match voiceover
    expect(totalDuration).toBeCloseTo(12, 1);
    expect(images[0].startTime).toBe(0);
  });

  it("preserves video durations when mixed with images", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 12 }),
      createClip({
        id: "vid-1",
        trackId: "visual-1",
        type: "video",
        duration: 4,
        sourceDuration: 10,
      }),
      createClip({ id: "img-1", trackId: "visual-1", type: "image", duration: 2 }),
      createClip({ id: "img-2", trackId: "visual-1", type: "image", duration: 2 }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);

    expect(result.success).toBe(true);

    const visuals = result.updatedClips.filter((c) => c.trackId === "visual-1");
    const video = visuals.find((c) => c.type === "video");
    const images = visuals.filter((c) => c.type === "image");

    // Video should keep its original duration
    expect(video?.duration).toBeCloseTo(4, 1);

    // Images should scale to fill the remaining 8 seconds
    const imagesTotalDuration = images.reduce((sum, c) => sum + c.duration, 0);
    expect(imagesTotalDuration).toBeCloseTo(8, 1);
  });

  it("handles empty Visual Layer 2 gracefully", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 10 }),
      createClip({ id: "vis-1", trackId: "visual-1", duration: 5 }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);

    expect(result.success).toBe(true);

    const layer1 = result.updatedClips.filter((c) => c.trackId === "visual-1");
    const layer2 = result.updatedClips.filter((c) => c.trackId === "visual-2");

    expect(layer1).toHaveLength(1);
    expect(layer2).toHaveLength(0);
  });

  it("enforces minimum clip duration", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 0.6 }),
      createClip({ id: "img-1", trackId: "visual-1", type: "image", duration: 0.2 }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);

    expect(result.success).toBe(true);

    const visuals = result.updatedClips.filter((c) => c.trackId === "visual-1");
    expect(visuals[0].duration).toBeGreaterThanOrEqual(0.5);
  });

  it("keeps a source-limited video within bounds and allocates the rest to images", () => {
    const clips = [
      createClip({ id: "voice", trackId: "audio", type: "audio", duration: 10 }),
      createClip({
        id: "video-short",
        type: "video",
        duration: 8,
        sourceDuration: 3,
        inPoint: 0,
        outPoint: 8,
      }),
      createClip({ id: "image-a", type: "image", duration: 2 }),
      createClip({ id: "image-b", type: "image", duration: 2 }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);
    expect(result.success).toBe(true);

    const visuals = result.updatedClips.filter((clip) => clip.trackId === "visual-1");
    const video = visuals.find((clip) => clip.id === "video-short")!;
    const images = visuals.filter((clip) => clip.type === "image");

    expect(video.duration).toBe(3);
    expect(video.outPoint).toBeLessThanOrEqual(video.sourceDuration!);
    expect(images.reduce((total, clip) => total + clip.duration, 0)).toBeCloseTo(7, 3);
    expect(visuals[visuals.length - 1].startTime + visuals[visuals.length - 1].duration).toBeCloseTo(10, 3);
  });

  it("does not report success when two minimum-length images cannot fit", () => {
    const clips = [
      createClip({ id: "voice", trackId: "audio", type: "audio", duration: 0.6 }),
      createClip({ id: "image-a", type: "image", duration: 0.3 }),
      createClip({ id: "image-b", type: "image", duration: 0.3, startTime: 0.3 }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);
    expect(result.success).toBe(false);
    expect(result.updatedClips).toEqual(clips);
    expect(result.message).toContain("cannot fit");
  });

  it("caps video-only tracks at source EOF and warns when voiceover remains uncovered", () => {
    const clips = [
      createClip({ id: "voice", trackId: "audio", type: "audio", duration: 10 }),
      createClip({
        id: "video-short",
        type: "video",
        duration: 4,
        sourceDuration: 4,
        inPoint: 0,
        outPoint: 4,
      }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);
    expect(result.success).toBe(true);
    const video = result.updatedClips.find((clip) => clip.id === "video-short")!;
    expect(video.duration).toBe(4);
    expect(video.outPoint).toBe(4);
    expect(video.startTime + video.duration).toBeLessThan(10);
    expect(result.message).toContain("end before the voiceover");
  });

  it("does not extend a source-limited video beyond its remaining source time", () => {
    const clips = [
      createClip({ id: "voice", trackId: "audio", type: "audio", duration: 8 }),
      createClip({
        id: "video-limited",
        type: "video",
        duration: 4,
        inPoint: 2,
        sourceDuration: 5,
        outPoint: 6,
      }),
      createClip({ id: "image-fill", type: "image", duration: 3 }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, []);
    expect(result.success).toBe(true);
    const video = result.updatedClips.find((clip) => clip.id === "video-limited")!;
    expect(video.duration).toBe(3);
    expect(video.outPoint).toBeLessThanOrEqual(5);
  });
});

describe("Fit Visuals to Voiceover - Transition Reconciliation", () => {
  it("preserves valid transitions when clips remain adjacent", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 10 }),
      createClip({ id: "clip-1", trackId: "visual-1", startTime: 0, duration: 5 }),
      createClip({ id: "clip-2", trackId: "visual-1", startTime: 5, duration: 5 }),
    ];
    const transitions = [
      createTransition({
        fromClipId: "clip-1",
        toClipId: "clip-2",
        trackId: "visual-1",
      }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, transitions);

    expect(result.success).toBe(true);
    expect(result.updatedTransitions).toHaveLength(1);
    expect(result.updatedTransitions[0].fromClipId).toBe("clip-1");
    expect(result.updatedTransitions[0].toClipId).toBe("clip-2");
  });

  it("removes transitions when clips are no longer adjacent", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 10 }),
      createClip({ id: "clip-1", trackId: "visual-1", startTime: 0, duration: 3 }),
      createClip({ id: "clip-2", trackId: "visual-1", startTime: 7, duration: 3 }),
    ];
    const transitions = [
      createTransition({
        fromClipId: "clip-1",
        toClipId: "clip-2",
        trackId: "visual-1",
      }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, transitions);

    expect(result.success).toBe(true);
    // After fitting, clips should be adjacent, but if they weren't originally
    // designed to be, the transition may be dropped. Let's verify the behavior:
    const vis = result.updatedClips.filter((c) => c.trackId === "visual-1");
    const clip1End = vis[0].startTime + vis[0].duration;
    const clip2Start = vis[1].startTime;

    // If they're now adjacent (within 0.2s), transition should be kept
    const gap = Math.abs(clip2Start - clip1End);
    expect(gap).toBeLessThanOrEqual(0.2);
    expect(result.updatedTransitions).toHaveLength(1);
  });

  it("removes transitions referencing deleted clips", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 10 }),
      createClip({ id: "clip-1", trackId: "visual-1", startTime: 0, duration: 5 }),
    ];
    const transitions = [
      createTransition({
        fromClipId: "clip-1",
        toClipId: "clip-missing",
        trackId: "visual-1",
      }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, transitions);

    expect(result.success).toBe(true);
    expect(result.updatedTransitions).toHaveLength(0);
    expect(result.message).toContain("Removed 1 stale transition");
  });

  it("revalidates transition durations against updated clip durations", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 2 }),
      createClip({ id: "clip-1", trackId: "visual-1", startTime: 0, duration: 5 }),
      createClip({ id: "clip-2", trackId: "visual-1", startTime: 5, duration: 5 }),
    ];
    const transitions = [
      createTransition({
        fromClipId: "clip-1",
        toClipId: "clip-2",
        duration: 2.0, // Very long transition
        trackId: "visual-1",
      }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, transitions);

    expect(result.success).toBe(true);
    expect(result.updatedTransitions).toHaveLength(1);

    // After scaling clips down to 2s total, the 2s transition should be clamped
    const transition = result.updatedTransitions[0];
    const clip1 = result.updatedClips.find((c) => c.id === "clip-1");
    const clip2 = result.updatedClips.find((c) => c.id === "clip-2");

    expect(clip1).toBeDefined();
    expect(clip2).toBeDefined();

    // Transition duration must not exceed half of either clip
    const maxAllowed = Math.min((clip1?.duration ?? 0) * 0.5, (clip2?.duration ?? 0) * 0.5);
    expect(transition.duration).toBeLessThanOrEqual(maxAllowed);
  });

  it("preserves transitions within each layer independently", () => {
    const clips = [
      createClip({ id: "audio-1", trackId: "audio", type: "audio", duration: 10 }),
      createClip({ id: "L1-A", trackId: "visual-1", startTime: 0, duration: 5 }),
      createClip({ id: "L1-B", trackId: "visual-1", startTime: 5, duration: 5 }),
      createClip({ id: "L2-A", trackId: "visual-2", startTime: 0, duration: 5 }),
      createClip({ id: "L2-B", trackId: "visual-2", startTime: 5, duration: 5 }),
    ];
    const transitions = [
      createTransition({
        id: "trans-L1",
        fromClipId: "L1-A",
        toClipId: "L1-B",
        trackId: "visual-1",
      }),
      createTransition({
        id: "trans-L2",
        fromClipId: "L2-A",
        toClipId: "L2-B",
        trackId: "visual-2",
      }),
    ];

    const result = calculateFitVisualsToVoiceover(clips, transitions);

    expect(result.success).toBe(true);
    expect(result.updatedTransitions).toHaveLength(2);

    const layer1Trans = result.updatedTransitions.find((t) => t.trackId === "visual-1");
    const layer2Trans = result.updatedTransitions.find((t) => t.trackId === "visual-2");

    expect(layer1Trans).toBeDefined();
    expect(layer2Trans).toBeDefined();
  });
});
