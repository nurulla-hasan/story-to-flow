import { describe, expect, it } from "vitest";
import { cleanNarration } from "../src/lib/studio-plan";
import type { StudioClip } from "../src/components/studio/types";

function computeClipTimings(clips: StudioClip[]): { clip: StudioClip; start: number; end: number }[] {
  let cur = 0;
  const timings: { clip: StudioClip; start: number; end: number }[] = [];
  for (const clip of clips) {
    const dur = clip.duration || 3;
    const start = cur;
    const end = cur + dur;
    cur = end;
    timings.push({ clip, start, end });
  }
  return timings;
}

function scaleClipSpeed(
  clip: StudioClip,
  newSpeed: number,
): { duration: number; speed: number; baseDuration: number } {
  const clampedSpeed = Math.max(0.25, Math.min(3.0, Number(newSpeed.toFixed(2))));
  const currentSpeed = clip.speed ?? 1.0;
  const base = clip.baseDuration ?? (clip.duration * currentSpeed);
  const newDur = Number(Math.max(0.5, Math.min(30, base / clampedSpeed)).toFixed(1));
  return {
    speed: clampedSpeed,
    baseDuration: Number(base.toFixed(1)),
    duration: newDur,
  };
}

function trimClipEdge(
  initialDur: number,
  deltaX: number,
  pxPerSec: number,
  edge: "left" | "right",
): number {
  const deltaSec = deltaX / pxPerSec;
  const delta = edge === "right" ? deltaSec : -deltaSec;
  return Math.max(0.5, Math.min(30, Number((initialDur + delta).toFixed(1))));
}

function splitClipAtTimestamp(
  clip: StudioClip,
  clipStart: number,
  clipEnd: number,
  splitTime: number,
): [StudioClip, StudioClip] {
  const offsetInClip = splitTime - clipStart;
  const part1Dur = Number(Math.max(0.3, offsetInClip).toFixed(1));
  const part2Dur = Number(Math.max(0.3, clip.duration - part1Dur).toFixed(1));
  const speed = clip.speed ?? 1.0;

  const clip1: StudioClip = {
    ...clip,
    duration: part1Dur,
    baseDuration: Number((part1Dur * speed).toFixed(1)),
  };

  const clip2: StudioClip = {
    ...clip,
    id: `${clip.id}_part2`,
    duration: part2Dur,
    baseDuration: Number((part2Dur * speed).toFixed(1)),
  };

  return [clip1, clip2];
}

describe("CapCut-style timeline clip editing & magnetic ripple", () => {
  const initialClips: StudioClip[] = [
    {
      id: "clip-1",
      index: 1,
      duration: 4.0,
      imageUrl: null,
      imagePrompt: "Shot 1",
      narration: "প্রথম দৃশ্য",
      motion: "zoom-in",
    },
    {
      id: "clip-2",
      index: 2,
      duration: 3.0,
      imageUrl: null,
      imagePrompt: "Shot 2",
      narration: "দ্বিতীয় দৃশ্য",
      motion: "pan-left",
    },
    {
      id: "clip-3",
      index: 3,
      duration: 5.0,
      imageUrl: null,
      imagePrompt: "Shot 3",
      narration: "তৃতীয় দৃশ্য",
      motion: "zoom-out",
    },
  ];

  it("calculates sequential magnetic clip timings with zero gaps", () => {
    const timings = computeClipTimings(initialClips);
    expect(timings[0].start).toBe(0.0);
    expect(timings[0].end).toBe(4.0);

    expect(timings[1].start).toBe(4.0);
    expect(timings[1].end).toBe(7.0);

    expect(timings[2].start).toBe(7.0);
    expect(timings[2].end).toBe(12.0);
  });

  it("inversely scales clip duration when speed changes (slow-mo & fast-forward)", () => {
    const clip = initialClips[0]; // 4.0s

    // Slow-mo 0.5x -> 8.0s
    const slow = scaleClipSpeed(clip, 0.5);
    expect(slow.duration).toBe(8.0);
    expect(slow.speed).toBe(0.5);
    expect(slow.baseDuration).toBe(4.0);

    // Fast 2.0x -> 2.0s
    const fast = scaleClipSpeed(clip, 2.0);
    expect(fast.duration).toBe(2.0);
    expect(fast.speed).toBe(2.0);
    expect(fast.baseDuration).toBe(4.0);

    // 0.75x -> 5.3s
    const moderateSlow = scaleClipSpeed(clip, 0.75);
    expect(moderateSlow.duration).toBe(5.3);

    // 1.5x -> 2.7s
    const moderateFast = scaleClipSpeed(clip, 1.5);
    expect(moderateFast.duration).toBe(2.7);

    // Normal 1.0x -> 4.0s
    const normal = scaleClipSpeed(clip, 1.0);
    expect(normal.duration).toBe(4.0);
  });

  it("magnetic ripple updates downstream timings when speed changes", () => {
    // Speeding up clip-1 to 2.0x (duration 2.0s)
    const spedUpClip = {
      ...initialClips[0],
      duration: 2.0,
      speed: 2.0,
      baseDuration: 4.0,
    };
    const spedUpProject = [spedUpClip, initialClips[1], initialClips[2]];
    const timings = computeClipTimings(spedUpProject);

    expect(timings[0].start).toBe(0.0);
    expect(timings[0].end).toBe(2.0);
    // Downstream clips shifted earlier by 2s
    expect(timings[1].start).toBe(2.0);
    expect(timings[1].end).toBe(5.0);
    expect(timings[2].start).toBe(5.0);
    expect(timings[2].end).toBe(10.0);
  });

  it("splits a clip cleanly at playhead timestamp and ripples downstream clips", () => {
    const clip1 = initialClips[0]; // 4.0s (0.0 to 4.0)
    const [partA, partB] = splitClipAtTimestamp(clip1, 0.0, 4.0, 1.5);

    expect(partA.duration).toBe(1.5);
    expect(partB.duration).toBe(2.5);
    expect(partA.duration + partB.duration).toBe(4.0);
    expect(partB.imagePrompt).toBe(clip1.imagePrompt);
    expect(partB.motion).toBe(clip1.motion);

    const splicedClips = [partA, partB, initialClips[1], initialClips[2]].map(
      (c, i) => ({ ...c, index: i + 1 }),
    );
    const timings = computeClipTimings(splicedClips);

    expect(timings).toHaveLength(4);
    expect(timings[0].start).toBe(0.0);
    expect(timings[0].end).toBe(1.5);
    expect(timings[1].start).toBe(1.5);
    expect(timings[1].end).toBe(4.0);
    expect(timings[2].start).toBe(4.0);
    expect(timings[2].end).toBe(7.0);
    expect(timings[3].start).toBe(7.0);
    expect(timings[3].end).toBe(12.0);
  });

  it("correctly handles interactive edge trimming on both left and right handles", () => {
    const pxPerSec = 50; // 50px = 1 second
    const initialDur = 4.0;

    // Dragging right edge right (+50px = +1.0s) -> 5.0s
    expect(trimClipEdge(initialDur, 50, pxPerSec, "right")).toBe(5.0);

    // Dragging right edge left (-50px = -1.0s) -> 3.0s
    expect(trimClipEdge(initialDur, -50, pxPerSec, "right")).toBe(3.0);

    // Dragging left edge right (+50px = +1.0s) -> cuts start, duration decreases to 3.0s
    expect(trimClipEdge(initialDur, 50, pxPerSec, "left")).toBe(3.0);

    // Dragging left edge left (-50px = -1.0s) -> extends start, duration increases to 5.0s
    expect(trimClipEdge(initialDur, -50, pxPerSec, "left")).toBe(5.0);

    // Minimum clamp to 0.5s
    expect(trimClipEdge(initialDur, -200, pxPerSec, "right")).toBe(0.5);
    expect(trimClipEdge(initialDur, 200, pxPerSec, "left")).toBe(0.5);
  });
});

describe("Bengali emotional voiceover vocalizations preservation", () => {
  it("preserves deep human emotional vocalizations without stripping them", () => {
    const script =
      "ওরে বাবারে বাবা!! উফ্‌ফ্‌! অ্যাঁ?! একী কাণ্ড! হি হি হি! ইশ্‌শ্‌ রে... ওমা! হুঁউউ...";
    const cleaned = cleanNarration(script);

    expect(cleaned).toContain("ওরে বাবারে বাবা!");
    expect(cleaned).toContain("উফ্‌ফ্‌!");
    expect(cleaned).toContain("অ্যাঁ?! একী কাণ্ড!");
    expect(cleaned).toContain("হি হি হি!");
    expect(cleaned).toContain("ইশ্‌শ্‌ রে...");
    expect(cleaned).toContain("ওমা!");
    expect(cleaned).toContain("হুঁউউ...");
  });

  it("preserves panic and shock vocalizations", () => {
    const panicScript = "আআআ! হায় হায় রে! পালাও সবাই!";
    const cleaned = cleanNarration(panicScript);

    expect(cleaned).toContain("আআআ!");
    expect(cleaned).toContain("হায় হায় রে!");
    expect(cleaned).toContain("পালাও সবাই!");
  });
});
