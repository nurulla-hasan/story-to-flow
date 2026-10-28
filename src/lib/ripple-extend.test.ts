import { describe, it, expect } from "vitest";
import type { TimelineClip } from "@/types/timeline";
import { applyRippleExtend } from "./timeline-trim";
import { areClipsAdjacentForTransition } from "./transition-helpers";

describe("Ripple Editing / Ripple Extend (CapCut-style)", () => {
  const clipA: TimelineClip = {
    id: "clip-A",
    assetId: "a1",
    name: "Scene A.png",
    type: "image",
    trackId: "visual-1",
    startTime: 0,
    duration: 5.0, // 0s - 5s
    inPoint: 0,
    outPoint: 5.0,
  };

  const clipB: TimelineClip = {
    id: "clip-B",
    assetId: "a2",
    name: "Scene B.png",
    type: "image",
    trackId: "visual-1",
    startTime: 5.0,
    duration: 8.0, // 5s - 13s
    inPoint: 0,
    outPoint: 8.0,
  };

  const clipC: TimelineClip = {
    id: "clip-C",
    assetId: "a3",
    name: "Scene C.png",
    type: "image",
    trackId: "visual-1",
    startTime: 13.0,
    duration: 5.0, // 13s - 18s
    inPoint: 0,
    outPoint: 5.0,
  };

  const voiceover: TimelineClip = {
    id: "voice-1",
    assetId: "vo1",
    name: "narration.mp3",
    type: "audio",
    trackId: "audio",
    startTime: 0, // Voiceover begins at 0s
    duration: 30.0,
    inPoint: 0,
    outPoint: 30.0,
  };

  const downstreamSoundEffect: TimelineClip = {
    id: "sfx-downstream",
    assetId: "sfx1",
    name: "whoosh.mp3",
    type: "audio",
    trackId: "audio-1",
    startTime: 14.0, // starts at 14s (after clip B's original end 13s)
    duration: 2.0,
    inPoint: 0,
    outPoint: 2.0,
  };

  const crossTrackOverlay: TimelineClip = {
    id: "overlay-1",
    assetId: "ov1",
    name: "logo.png",
    type: "image",
    trackId: "visual-2",
    startTime: 2.0, // starts at 2s (before clip B's original end 13s)
    duration: 6.0,
    inPoint: 0,
    outPoint: 6.0,
  };

  const downstreamOverlay: TimelineClip = {
    id: "overlay-downstream",
    assetId: "ov2",
    name: "badge.png",
    type: "image",
    trackId: "visual-2",
    startTime: 13.5, // starts after clip B's original end 13s
    duration: 3.0,
    inPoint: 0,
    outPoint: 3.0,
  };

  const initialClips = [
    clipA,
    clipB,
    clipC,
    voiceover,
    downstreamSoundEffect,
    crossTrackOverlay,
    downstreamOverlay,
  ];

  it("extends a middle clip and shifts downstream clips rightward by exact duration delta", () => {
    // Problem scenario from prompt:
    // Clip A: 0s-5s
    // Clip B: 5s-13s (duration 8s)
    // Clip C: 13s-18s (duration 5s)
    // User extends Clip B from 8s to 12s (+4s delta)
    const updated = applyRippleExtend("clip-B", 12.0, initialClips);

    const b = updated.find((c) => c.id === "clip-B")!;
    const c = updated.find((c) => c.id === "clip-C")!;
    const a = updated.find((c) => c.id === "clip-A")!;

    // Clip B becomes 5s-17s (duration 12s)
    expect(b.startTime).toBe(5.0);
    expect(b.duration).toBe(12.0);
    expect(b.outPoint).toBe(12.0);

    // Clip C shifts right by 4s and becomes 17s-22s
    expect(c.startTime).toBe(17.0); // 13.0 + 4.0
    expect(c.duration).toBe(5.0);

    // Clip A before Clip B remains unchanged at 0s-5s
    expect(a.startTime).toBe(0);
    expect(a.duration).toBe(5.0);
  });

  it("keeps voiceover starting at 0s anchored without shifting", () => {
    const updated = applyRippleExtend("clip-B", 12.0, initialClips);
    const vo = updated.find((c) => c.id === "voice-1")!;

    expect(vo.startTime).toBe(0);
    expect(vo.duration).toBe(30.0);
  });

  it("shifts downstream audio/sfx starting at or after ripple boundary", () => {
    const updated = applyRippleExtend("clip-B", 12.0, initialClips);
    const sfx = updated.find((c) => c.id === "sfx-downstream")!;

    // Original start: 14.0s (after 13.0s boundary). With +4.0s delta -> 18.0s
    expect(sfx.startTime).toBe(18.0);
    expect(sfx.duration).toBe(2.0);
  });

  it("preserves intentional overlays that start before the ripple boundary", () => {
    const updated = applyRippleExtend("clip-B", 12.0, initialClips);
    const ov1 = updated.find((c) => c.id === "overlay-1")!;

    // Starts at 2.0s (< 13.0s boundary), remains at 2.0s
    expect(ov1.startTime).toBe(2.0);
    expect(ov1.duration).toBe(6.0);
  });

  it("shifts downstream overlays on visual-2 that start at or after the boundary", () => {
    const updated = applyRippleExtend("clip-B", 12.0, initialClips);
    const ovDown = updated.find((c) => c.id === "overlay-downstream")!;

    // Original start: 13.5s. With +4.0s delta -> 17.5s
    expect(ovDown.startTime).toBe(17.5);
    expect(ovDown.duration).toBe(3.0);
  });

  it("does not shift downstream clips when shrinking a clip (standard trim behavior)", () => {
    // Shrinking Clip B from 8s to 6s (-2s delta)
    const updated = applyRippleExtend("clip-B", 6.0, initialClips);

    const b = updated.find((c) => c.id === "clip-B")!;
    const c = updated.find((c) => c.id === "clip-C")!;

    expect(b.duration).toBe(6.0);
    expect(c.startTime).toBe(13.0); // remains anchored
  });

  it("maintains transition adjacency between extended clip and shifted downstream clip", () => {
    const updated = applyRippleExtend("clip-B", 12.0, initialClips);

    const b = updated.find((c) => c.id === "clip-B")!;
    const c = updated.find((c) => c.id === "clip-C")!;

    // Extended Clip B ends at 5 + 12 = 17s. Shifted Clip C starts at 17s.
    expect(areClipsAdjacentForTransition(b, c)).toBe(true);
  });

  it("supports single undo/redo reversion across all shifted clips", () => {
    const undoStack: TimelineClip[][] = [];
    const redoStack: TimelineClip[][] = [];

    let currentClips = [...initialClips];

    // User extends clip-B: commit gesture pushes initialClips to undoStack
    undoStack.push(JSON.parse(JSON.stringify(currentClips)));
    currentClips = applyRippleExtend("clip-B", 12.0, currentClips);

    expect(currentClips.find((c) => c.id === "clip-C")?.startTime).toBe(17.0);

    // Ctrl+Z Undo: reverts all clips to original positions atomically
    const prev = undoStack.pop()!;
    redoStack.push(JSON.parse(JSON.stringify(currentClips)));
    currentClips = prev;

    expect(currentClips.find((c) => c.id === "clip-B")?.duration).toBe(8.0);
    expect(currentClips.find((c) => c.id === "clip-C")?.startTime).toBe(13.0);
    expect(currentClips.find((c) => c.id === "sfx-downstream")?.startTime).toBe(14.0);

    // Ctrl+Y Redo: restores ripple extension
    const next = redoStack.pop()!;
    undoStack.push(JSON.parse(JSON.stringify(currentClips)));
    currentClips = next;

    expect(currentClips.find((c) => c.id === "clip-B")?.duration).toBe(12.0);
    expect(currentClips.find((c) => c.id === "clip-C")?.startTime).toBe(17.0);
    expect(currentClips.find((c) => c.id === "sfx-downstream")?.startTime).toBe(18.0);
  });
});
