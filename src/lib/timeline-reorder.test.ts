import { describe, it, expect } from "vitest";
import type { TimelineClip } from "../types/timeline";
import { reorderClipOnTrack } from "./timeline-reorder";

function createClip(
  id: string,
  startTime: number,
  duration: number,
  trackId: TimelineClip["trackId"] = "visual-1"
): TimelineClip {
  return {
    id,
    assetId: `asset-${id}`,
    name: `${id}.png`,
    type: "image",
    trackId,
    startTime,
    duration,
    inPoint: 0,
    outPoint: duration,
  };
}

function byId(clips: TimelineClip[], id: string): TimelineClip {
  const clip = clips.find((c) => c.id === id);
  if (!clip) throw new Error(`Missing clip ${id}`);
  return clip;
}

describe("Timeline clip reordering (right to left)", () => {
  const a = createClip("A", 0, 5);
  const b = createClip("B", 5, 5);
  const c = createClip("C", 10, 5);
  const timeline = [a, b, c];

  it("moves a clip from the right before an earlier clip", () => {
    const result = reorderClipOnTrack(c, 5, timeline);

    expect(byId(result.clips, "A").startTime).toBe(0);
    expect(byId(result.clips, "C").startTime).toBe(5);
    expect(byId(result.clips, "B").startTime).toBe(10);
    expect(result.insertionTime).toBe(5);
  });

  it("moves a clip to the front of the lane", () => {
    const result = reorderClipOnTrack(c, 0, timeline);

    expect(byId(result.clips, "C").startTime).toBe(0);
    expect(byId(result.clips, "A").startTime).toBe(5);
    expect(byId(result.clips, "B").startTime).toBe(10);
  });

  it("moves a clip to the end of the lane", () => {
    const result = reorderClipOnTrack(a, 10, timeline);

    expect(byId(result.clips, "B").startTime).toBe(0);
    expect(byId(result.clips, "C").startTime).toBe(5);
    expect(byId(result.clips, "A").startTime).toBe(10);
  });

  it("preserves clip identity, media, duration, and edit properties", () => {
    const styled: TimelineClip = {
      ...c,
      volume: 0.4,
      speed: 1.5,
      transform: { x: 0.1, y: 0, scale: 1.2, rotation: 10 },
    };
    const result = reorderClipOnTrack(styled, 5, [a, b, styled]);
    const moved = byId(result.clips, "C");

    expect(moved.assetId).toBe(styled.assetId);
    expect(moved.duration).toBe(5);
    expect(moved.volume).toBe(0.4);
    expect(moved.speed).toBe(1.5);
    expect(moved.transform).toEqual(styled.transform);
    expect(result.clips.filter((clip) => clip.id === "C")).toHaveLength(1);
  });

  it("closes the source gap without creating same-track collisions", () => {
    const result = reorderClipOnTrack(c, 5, timeline);
    const sorted = [...result.clips].sort((x, y) => x.startTime - y.startTime);

    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = sorted[i].startTime + sorted[i].duration;
      expect(sorted[i + 1].startTime).toBeGreaterThanOrEqual(currentEnd - 0.01);
    }
  });

  it("does not swap neighbours on a small rightward nudge", () => {
    const result = reorderClipOnTrack(b, 5.5, timeline);

    expect(byId(result.clips, "A").startTime).toBe(0);
    expect(byId(result.clips, "B").startTime).toBe(5);
    expect(byId(result.clips, "C").startTime).toBe(10);
  });

  it("moves a clip right past the next clip's midpoint", () => {
    const result = reorderClipOnTrack(b, 8, timeline);

    expect(byId(result.clips, "A").startTime).toBe(0);
    expect(byId(result.clips, "C").startTime).toBe(5);
    expect(byId(result.clips, "B").startTime).toBe(10);
  });

  it("keeps clips on other tracks anchored", () => {
    const voiceover = createClip("voice", 0, 12, "audio");
    const result = reorderClipOnTrack(c, 5, [...timeline, voiceover]);

    expect(byId(result.clips, "voice").startTime).toBe(0);
  });

  it("moves audio clips freely without rippling other audio", () => {
    const music = createClip("music", 4, 6, "audio-1");
    const voiceover = createClip("voice", 0, 12, "audio");
    const result = reorderClipOnTrack(music, 1, [voiceover, music]);

    expect(byId(result.clips, "music").startTime).toBe(1);
    expect(byId(result.clips, "voice").startTime).toBe(0);
  });
});
