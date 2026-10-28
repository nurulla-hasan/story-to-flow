import { describe, it, expect } from "vitest";
import type { TimelineClip } from "@/types/timeline";
import { applyRippleDelete } from "./timeline-trim";

describe("Ripple Delete for Timeline Clips", () => {
  const clipA: TimelineClip = {
    id: "clip-A",
    assetId: "a1",
    name: "Clip A",
    type: "image",
    trackId: "visual-1",
    startTime: 0,
    duration: 5.0, // 0 - 5s
    inPoint: 0,
    outPoint: 5.0,
  };

  const clipB: TimelineClip = {
    id: "clip-B",
    assetId: "a2",
    name: "Clip B",
    type: "image",
    trackId: "visual-1",
    startTime: 5.0,
    duration: 8.0, // 5 - 13s
    inPoint: 0,
    outPoint: 8.0,
  };

  const clipC: TimelineClip = {
    id: "clip-C",
    assetId: "a3",
    name: "Clip C",
    type: "image",
    trackId: "visual-1",
    startTime: 13.0,
    duration: 5.0, // 13 - 18s
    inPoint: 0,
    outPoint: 5.0,
  };

  const voiceover: TimelineClip = {
    id: "voiceover-1",
    assetId: "v1",
    name: "Voiceover",
    type: "audio",
    trackId: "audio",
    startTime: 0, // 0 - 25s
    duration: 25.0,
    inPoint: 0,
    outPoint: 25.0,
  };

  const downstreamSfx: TimelineClip = {
    id: "sfx-1",
    assetId: "s1",
    name: "Sound Effect",
    type: "audio",
    trackId: "audio-1",
    startTime: 14.0, // 14 - 16s (after Clip B's end of 13s)
    duration: 2.0,
    inPoint: 0,
    outPoint: 2.0,
  };

  const earlyOverlay: TimelineClip = {
    id: "overlay-early",
    assetId: "o1",
    name: "Early Overlay",
    type: "image",
    trackId: "visual-2",
    startTime: 2.0, // starts before Clip B's end of 13s
    duration: 6.0,
    inPoint: 0,
    outPoint: 6.0,
  };

  const downstreamOverlay: TimelineClip = {
    id: "overlay-downstream",
    assetId: "o2",
    name: "Late Overlay",
    type: "image",
    trackId: "visual-2",
    startTime: 13.0, // starts at Clip B's end
    duration: 4.0,
    inPoint: 0,
    outPoint: 4.0,
  };

  const allClips = [
    clipA,
    clipB,
    clipC,
    voiceover,
    downstreamSfx,
    earlyOverlay,
    downstreamOverlay,
  ];

  it("deleting middle Clip B shifts downstream Clip C left by 8s without leaving a gap", () => {
    // Problem scenario from prompt:
    // Clip A: 0–5s
    // Clip B: 5–13s
    // Clip C: 13–18s
    // Voiceover: 0–25s
    // When Clip B is deleted:
    // - Clip A remains at 0–5s.
    // - Clip C shifts left to 5–10s.
    // - Voiceover remains at 0s with its duration unchanged.
    const { updatedClips, deletedClip } = applyRippleDelete("clip-B", allClips);

    expect(deletedClip?.id).toBe("clip-B");
    expect(updatedClips.find((c) => c.id === "clip-B")).toBeUndefined();

    const a = updatedClips.find((c) => c.id === "clip-A")!;
    const c = updatedClips.find((c) => c.id === "clip-C")!;
    const vo = updatedClips.find((c) => c.id === "voiceover-1")!;

    // Clip A remains at 0–5s
    expect(a.startTime).toBe(0);
    expect(a.duration).toBe(5.0);

    // Clip C shifts left by 8s to 5–10s
    expect(c.startTime).toBe(5.0); // 13.0 - 8.0 = 5.0
    expect(c.duration).toBe(5.0);

    // Voiceover remains at 0s with duration 25s intact
    expect(vo.startTime).toBe(0);
    expect(vo.duration).toBe(25.0);
  });

  it("shifts downstream secondary audio (SFX) left by the removed duration", () => {
    const { updatedClips } = applyRippleDelete("clip-B", allClips);
    const sfx = updatedClips.find((c) => c.id === "sfx-1")!;

    // Original start: 14.0s. Shift left by 8.0s -> 6.0s
    expect(sfx.startTime).toBe(6.0);
    expect(sfx.duration).toBe(2.0);
  });

  it("preserves overlays starting before the deletion boundary and shifts downstream overlays", () => {
    const { updatedClips } = applyRippleDelete("clip-B", allClips);

    const early = updatedClips.find((c) => c.id === "overlay-early")!;
    const late = updatedClips.find((c) => c.id === "overlay-downstream")!;

    // Starts at 2.0s (< 13s), unchanged
    expect(early.startTime).toBe(2.0);

    // Starts at 13.0s (>= 13s), shifts left by 8.0s -> 5.0s
    expect(late.startTime).toBe(5.0);
  });

  it("returns unchanged clips if deleted clip is not found", () => {
    const { updatedClips, deletedClip } = applyRippleDelete("non-existent-id", allClips);
    expect(deletedClip).toBeNull();
    expect(updatedClips).toEqual(allClips);
  });

  it("supports full atomic undo and redo for ripple delete", () => {
    const undoStack: TimelineClip[][] = [];
    const redoStack: TimelineClip[][] = [];

    let currentClips = [...allClips];

    // Delete Clip B
    undoStack.push(JSON.parse(JSON.stringify(currentClips)));
    const { updatedClips } = applyRippleDelete("clip-B", currentClips);
    currentClips = updatedClips;

    expect(currentClips.find((c) => c.id === "clip-C")?.startTime).toBe(5.0);

    // Undo: restores Clip B and returns Clip C to 13s
    const prev = undoStack.pop()!;
    redoStack.push(JSON.parse(JSON.stringify(currentClips)));
    currentClips = prev;

    expect(currentClips.find((c) => c.id === "clip-B")).toBeDefined();
    expect(currentClips.find((c) => c.id === "clip-C")?.startTime).toBe(13.0);

    // Redo: re-applies ripple delete
    const next = redoStack.pop()!;
    undoStack.push(JSON.parse(JSON.stringify(currentClips)));
    currentClips = next;

    expect(currentClips.find((c) => c.id === "clip-B")).toBeUndefined();
    expect(currentClips.find((c) => c.id === "clip-C")?.startTime).toBe(5.0);
  });

  it("calculates overall timeline duration change accurately after ripple delete", () => {
    // Initial timeline: Clip A (0-5s), Clip B (5-13s), Clip C (13-18s)
    const originalMaxEnd = Math.max(clipA.startTime + clipA.duration, clipB.startTime + clipB.duration, clipC.startTime + clipC.duration);
    expect(originalMaxEnd).toBe(18.0);

    const { updatedClips } = applyRippleDelete("clip-B", [clipA, clipB, clipC]);
    const newMaxEnd = Math.max(...updatedClips.map((c) => c.startTime + c.duration));

    // After deleting Clip B (8s), total duration drops from 18s to 10s
    expect(newMaxEnd).toBe(10.0);
  });

  it("clamps overlay clips that start inside the deleted interval to the splice point", () => {
    const midOverlay: TimelineClip = {
      id: "overlay-mid",
      assetId: "o3",
      name: "Mid Overlay",
      type: "image",
      trackId: "visual-2",
      startTime: 7.0, // starts at 7s (inside Clip B: 5–13s)
      duration: 3.0,
      inPoint: 0,
      outPoint: 3.0,
    };

    const { updatedClips } = applyRippleDelete("clip-B", [clipA, clipB, clipC, midOverlay]);
    const ov = updatedClips.find((c) => c.id === "overlay-mid")!;

    // Clamps cleanly to Clip B's start time (5.0s), preventing negative start or intrusion into Clip A
    expect(ov.startTime).toBe(5.0);
    expect(ov.duration).toBe(3.0);
  });

  it("handles ripple delete of a split clip correctly", () => {
    // Clip B was split into B1 (5-9s, dur 4s) and B2 (9-13s, dur 4s)
    const clipB1: TimelineClip = { ...clipB, id: "clip-B1", duration: 4.0, outPoint: 4.0 };
    const clipB2: TimelineClip = { ...clipB, id: "clip-B2", startTime: 9.0, duration: 4.0, inPoint: 4.0, outPoint: 8.0 };

    // Deleting B1 (duration 4s)
    const { updatedClips } = applyRippleDelete("clip-B1", [clipA, clipB1, clipB2, clipC]);

    const b2 = updatedClips.find((c) => c.id === "clip-B2")!;
    const c = updatedClips.find((c) => c.id === "clip-C")!;

    // B2 shifts left from 9s to 5s
    expect(b2.startTime).toBe(5.0);
    // Clip C shifts left from 13s to 9s
    expect(c.startTime).toBe(9.0);
  });

  it("prevents same-track overlap on secondary tracks when interval clip and downstream clip shift", () => {
    const midOverlay: TimelineClip = {
      id: "overlay-mid",
      assetId: "o3",
      name: "Mid Overlay",
      type: "image",
      trackId: "visual-2",
      startTime: 7.0, // starts at 7s (inside Clip B: 5–13s)
      duration: 3.0, // 7.0 - 10.0s
      inPoint: 0,
      outPoint: 3.0,
    };

    const lateOverlay: TimelineClip = {
      id: "overlay-late",
      assetId: "o4",
      name: "Late Overlay",
      type: "image",
      trackId: "visual-2",
      startTime: 13.5, // starts at 13.5s (after Clip B: 5–13s)
      duration: 3.0, // 13.5 - 16.5s
      inPoint: 0,
      outPoint: 3.0,
    };

    const { updatedClips } = applyRippleDelete("clip-B", [clipA, clipB, clipC, midOverlay, lateOverlay]);
    const ovMid = updatedClips.find((c) => c.id === "overlay-mid")!;
    const ovLate = updatedClips.find((c) => c.id === "overlay-late")!;

    // ovMid is positioned at splice point (5.0s - 8.0s)
    expect(ovMid.startTime).toBe(5.0);
    expect(ovMid.duration).toBe(3.0);

    // ovLate is positioned after ovMid to prevent 2.5s same-track collision (8.0s - 11.0s)
    expect(ovLate.startTime).toBe(8.0);
    expect(ovLate.duration).toBe(3.0);

    // Zero overlap between ovMid and ovLate
    expect(ovLate.startTime >= ovMid.startTime + ovMid.duration).toBe(true);
  });
});
