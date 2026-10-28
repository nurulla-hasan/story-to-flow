import { describe, it, expect } from "vitest";
import type { TimelineClip } from "../types/timeline";
import { insertClipAtTime } from "./timeline-insert";

function createClip(
  id: string,
  startTime: number,
  duration: number,
  trackId: TimelineClip["trackId"] = "visual-1",
  overrides: Partial<TimelineClip> = {}
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
    ...overrides,
  };
}

function byId(clips: TimelineClip[], id: string): TimelineClip {
  const clip = clips.find((c) => c.id === id);
  if (!clip) throw new Error(`Missing clip ${id}`);
  return clip;
}

describe("Timeline clip insertion between existing clips", () => {
  const a = createClip("A", 0, 5);
  const b = createClip("B", 5, 5);

  it("inserts at a boundary and shifts downstream clips right", () => {
    const x = createClip("X", 0, 3);
    const result = insertClipAtTime(x, 5, [a, b]);

    expect(byId(result.clips, "A").startTime).toBe(0);
    expect(byId(result.clips, "X").startTime).toBe(5);
    expect(byId(result.clips, "X").duration).toBe(3);
    expect(byId(result.clips, "B").startTime).toBe(8);
    expect(result.clips).toHaveLength(3);
  });

  it("splits a clip when inserting inside it and places the new clip between parts", () => {
    const x = createClip("X", 0, 3);
    const result = insertClipAtTime(x, 2, [a, b]);

    expect(result.split?.originalClipId).toBe("A");
    const left = byId(result.clips, "A");
    const right = byId(result.clips, result.split!.rightPartId);

    expect(left.startTime).toBe(0);
    expect(left.duration).toBe(2);
    expect(byId(result.clips, "X").startTime).toBe(2);
    expect(byId(result.clips, "X").duration).toBe(3);
    expect(right.startTime).toBe(5);
    expect(right.duration).toBe(3);
    expect(byId(result.clips, "B").startTime).toBe(8);
  });

  it("does not overwrite or remove existing media", () => {
    const x = createClip("X", 0, 3);
    const result = insertClipAtTime(x, 5, [a, b]);

    expect(result.clips.map((c) => c.id).sort()).toEqual(["A", "B", "X"]);
    expect(byId(result.clips, "A").assetId).toBe("asset-A");
    expect(byId(result.clips, "B").assetId).toBe("asset-B");
  });

  it("keeps the voiceover anchored at t=0 and leaves other tracks untouched", () => {
    const voiceover = createClip("voice", 0, 13, "audio");
    const overlay = createClip("overlay", 0, 2, "visual-2");
    const x = createClip("X", 0, 3);
    const result = insertClipAtTime(x, 5, [a, b, voiceover, overlay]);

    expect(byId(result.clips, "voice").startTime).toBe(0);
    expect(byId(result.clips, "overlay").startTime).toBe(0);
  });

  it("places audio clips at the requested position without rippling audio", () => {
    const voiceover = createClip("voice", 0, 10, "audio");
    const music = createClip("music", 0, 4, "audio");
    const result = insertClipAtTime(music, 3, [voiceover]);

    expect(byId(result.clips, "music").startTime).toBe(3);
    expect(byId(result.clips, "voice").startTime).toBe(0);
    expect(byId(result.clips, "voice").duration).toBe(10);
  });

  it("snaps to the nearest boundary when a split would be too short", () => {
    const x = createClip("X", 0, 2);
    const result = insertClipAtTime(x, 0.2, [a, b]);

    expect(result.split).toBeUndefined();
    expect(byId(result.clips, "A").startTime).toBe(2);
    expect(byId(result.clips, "X").startTime).toBe(0);
  });
});
