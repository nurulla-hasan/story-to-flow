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

  it("shifts downstream clips leftward when reducing a clip duration in ripple mode (zero gap)", () => {
    // Shrinking Clip B from 8s to 6s (-2s delta)
    const updated = applyRippleExtend("clip-B", 6.0, initialClips);

    const b = updated.find((c) => c.id === "clip-B")!;
    const c = updated.find((c) => c.id === "clip-C")!;

    expect(b.startTime).toBe(5.0);
    expect(b.duration).toBe(6.0);
    expect(b.startTime + b.duration).toBe(11.0); // ends at 11s
    expect(c.startTime).toBe(11.0); // shifts left by 2s to 11s: zero gap!
    expect(c.duration).toBe(5.0);
  });

  it("maintains transition adjacency between extended clip and shifted downstream clip", () => {
    const updated = applyRippleExtend("clip-B", 12.0, initialClips);

    const b = updated.find((c) => c.id === "clip-B")!;
    const c = updated.find((c) => c.id === "clip-C")!;

    // Extended Clip B ends at 5 + 12 = 17s. Shifted Clip C starts at 17s.
    expect(areClipsAdjacentForTransition(b, c)).toBe(true);
  });

  it("ignores non-finite or non-positive requested durations", () => {
    expect(applyRippleExtend("clip-B", Number.NaN, initialClips)).toEqual(initialClips);
    expect(applyRippleExtend("clip-B", Number.POSITIVE_INFINITY, initialClips)).toEqual(initialClips);
    expect(applyRippleExtend("clip-B", 0, initialClips)).toEqual(initialClips);
    expect(applyRippleExtend("clip-B", -1, initialClips)).toEqual(initialClips);
  });

  it("keeps ordinary image clips at the minimum duration for short requests", () => {
    const updated = applyRippleExtend("clip-B", 0.2, initialClips);
    const edited = updated.find((clip) => clip.id === "clip-B")!;
    const downstream = updated.find((clip) => clip.id === "clip-C")!;

    expect(edited.duration).toBe(0.5);
    expect(downstream.startTime).toBe(5.5);
    expect(edited.startTime + edited.duration).toBe(downstream.startTime);
  });

  it("never extends a source-limited video past a short remaining source tail", () => {
    const shortVideo: TimelineClip = {
      ...clipB,
      id: "short-video",
      type: "video",
      duration: 1,
      inPoint: 4.8,
      outPoint: 5.8,
      sourceDuration: 5,
      speed: 1,
    };
    const downstream: TimelineClip = {
      ...clipC,
      startTime: 6,
    };

    const updated = applyRippleExtend(shortVideo.id, 5, [shortVideo, downstream]);
    const video = updated.find((clip) => clip.id === shortVideo.id)!;
    const next = updated.find((clip) => clip.id === downstream.id)!;

    expect(video.duration).toBeCloseTo(0.2, 3);
    expect(video.outPoint).toBeLessThanOrEqual(video.sourceDuration!);
    expect(next.startTime).toBeCloseTo(video.startTime + video.duration, 3);
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

  it("QA Bug Fix: handles back-and-forth slider movement during one gesture without leaving unwanted gaps", () => {
    // Scenario from prompt:
    // Clip B initially occupies 5–13s (duration 8s); Clip C starts at 13s.
    // During a single Inspector gesture, user extends Clip B to 14s duration and then reduces it to 10s duration.
    // The final Clip B end must be 15s (5 + 10), and Clip C must start at 15s, with no 4-second gap.
    const initialSnapshot = JSON.parse(JSON.stringify(initialClips));

    // Step 1: User moves slider to 14s
    const intermediate14s = applyRippleExtend("clip-B", 14.0, initialSnapshot);
    const b14 = intermediate14s.find((c) => c.id === "clip-B")!;
    const c14 = intermediate14s.find((c) => c.id === "clip-C")!;
    expect(b14.startTime + b14.duration).toBe(19.0); // 5 + 14 = 19
    expect(c14.startTime).toBe(19.0); // 13 + (14 - 8) = 19

    // Step 2: During the same gesture (without releasing pointer), user pulls slider back to 10s:
    // When calculated against the initial pre-gesture snapshot:
    const intermediate10s = applyRippleExtend("clip-B", 10.0, initialSnapshot);
    const b10 = intermediate10s.find((c) => c.id === "clip-B")!;
    const c10 = intermediate10s.find((c) => c.id === "clip-C")!;

    expect(b10.startTime).toBe(5.0);
    expect(b10.duration).toBe(10.0);
    expect(b10.startTime + b10.duration).toBe(15.0); // 5 + 10 = 15s
    expect(c10.startTime).toBe(15.0); // 13 + (10 - 8) = 15s! Zero gap!

    // Step 3: User continues dragging within the same gesture down to 6s (below original 8s):
    const intermediate6s = applyRippleExtend("clip-B", 6.0, initialSnapshot);
    const b6 = intermediate6s.find((c) => c.id === "clip-B")!;
    const c6 = intermediate6s.find((c) => c.id === "clip-C")!;

    expect(b6.startTime).toBe(5.0);
    expect(b6.duration).toBe(6.0);
    expect(b6.startTime + b6.duration).toBe(11.0); // 5 + 6 = 11s
    expect(c6.startTime).toBe(11.0); // 13 + (6 - 8) = 11s! Zero gap!
  });

  it("handles repeated extension and reduction cycles without drift or unintended gaps", () => {
    const initialSnapshot = JSON.parse(JSON.stringify(initialClips));

    // Cycle 1: Extend 8s -> 16s
    let state = applyRippleExtend("clip-B", 16.0, initialSnapshot);
    expect(state.find((c) => c.id === "clip-C")?.startTime).toBe(21.0); // 13 + 8

    // Cycle 2: Reduce 8s -> 7s
    state = applyRippleExtend("clip-B", 7.0, initialSnapshot);
    expect(state.find((c) => c.id === "clip-C")?.startTime).toBe(12.0); // 13 - 1

    // Cycle 3: Back to original 8s
    state = applyRippleExtend("clip-B", 8.0, initialSnapshot);
    expect(state.find((c) => c.id === "clip-C")?.startTime).toBe(13.0); // original

    // Voiceover at t=0 never moves across all cycles
    expect(state.find((c) => c.id === "voice-1")?.startTime).toBe(0);
  });

  it("applies 4s and 5s presets to an image clip with accurate ripple adjustment", () => {
    // Initial: clipA (0-5s), clipB (5-13s, duration 8s), clipC (13-18s)
    // Applying 4s preset to clipA
    let state = applyRippleExtend("clip-A", 4.0, initialClips);
    let a = state.find((c) => c.id === "clip-A")!;
    let b = state.find((c) => c.id === "clip-B")!;
    let c = state.find((c) => c.id === "clip-C")!;

    expect(a.duration).toBe(4.0);
    expect(b.startTime).toBe(4.0); // Shifted left by 1s
    expect(c.startTime).toBe(12.0); // Shifted left by 1s

    // Applying 5s preset to clipA
    state = applyRippleExtend("clip-A", 5.0, initialClips);
    a = state.find((c) => c.id === "clip-A")!;
    b = state.find((c) => c.id === "clip-B")!;
    c = state.find((c) => c.id === "clip-C")!;

    expect(a.duration).toBe(5.0);
    expect(b.startTime).toBe(5.0);
    expect(c.startTime).toBe(13.0);
  });
});
