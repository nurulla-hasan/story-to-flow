import { describe, expect, it } from "vitest";
import { cleanNarration } from "../src/lib/studio-plan";
import type {
  StudioClip,
  StudioProject,
  StudioVoiceSegment,
} from "../src/components/studio/types";
import {
  computeVoiceSegmentTimings,
  getClipMedia,
  getProjectVoiceSegments,
  isVideoMedia,
} from "../src/components/studio/editor/editor-shared";

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

describe("Hybrid Media Support (Images + Video clips)", () => {
  it("correctly identifies image vs video media files", () => {
    expect(isVideoMedia("https://example.com/asset.mp4")).toBe(true);
    expect(isVideoMedia("/api/files/scene-1.webm")).toBe(true);
    expect(isVideoMedia("sample.mov")).toBe(true);
    expect(isVideoMedia("data:video/mp4;base64,xxxx")).toBe(true);

    expect(isVideoMedia("https://example.com/image.png")).toBe(false);
    expect(isVideoMedia("/api/files/photo.jpg")).toBe(false);
    expect(isVideoMedia("illustration.webp")).toBe(false);
  });

  it("extracts unified media source and mediaType from StudioClip", () => {
    const imageClip: StudioClip = {
      id: "c1",
      index: 1,
      duration: 3,
      imageUrl: "/api/files/frame1.png",
      imagePrompt: "Image prompt",
      narration: "Narrate",
      motion: "zoom-in",
    };
    expect(getClipMedia(imageClip)).toEqual({
      type: "image",
      url: "/api/files/frame1.png",
    });

    const videoClip: StudioClip = {
      id: "c2",
      index: 2,
      duration: 5,
      imageUrl: null,
      videoUrl: "/api/files/clip2.mp4",
      mediaType: "video",
      videoVolume: 0.8,
      imagePrompt: "Video prompt",
      narration: "Narrate video",
      motion: "static",
    };
    expect(getClipMedia(videoClip)).toEqual({
      type: "video",
      url: "/api/files/clip2.mp4",
    });
  });
});

describe("Splittable Multi-Segment Voice Track & Independent Splitting", () => {
  const dummyProject: Pick<
    StudioProject,
    "voiceSegments" | "audioUrl" | "audioDuration"
  > = {
    audioUrl: "/api/files/voiceover.mp3",
    audioDuration: 12.0,
  };

  it("extracts default voice segment from project audioUrl", () => {
    const segments = getProjectVoiceSegments(dummyProject);
    expect(segments).toHaveLength(1);
    expect(segments[0].audioUrl).toBe("/api/files/voiceover.mp3");
    expect(segments[0].startOffset).toBe(0);
    expect(segments[0].duration).toBe(12.0);
  });

  it("computes accurate sequential voice segment timings", () => {
    const multiSegments: StudioVoiceSegment[] = [
      {
        id: "seg-1",
        audioUrl: "/api/files/voiceover.mp3",
        startOffset: 0.0,
        duration: 4.5,
      },
      {
        id: "seg-2",
        audioUrl: "/api/files/voiceover.mp3",
        startOffset: 4.5,
        duration: 7.5,
      },
    ];

    const timings = computeVoiceSegmentTimings(multiSegments);
    expect(timings).toHaveLength(2);
    expect(timings[0].start).toBe(0.0);
    expect(timings[0].end).toBe(4.5);
    expect(timings[1].start).toBe(4.5);
    expect(timings[1].end).toBe(12.0);
  });

  it("splits a voice segment non-destructively using startOffset math", () => {
    const segment: StudioVoiceSegment = {
      id: "seg-orig",
      audioUrl: "/api/files/voiceover.mp3",
      startOffset: 2.0,
      duration: 6.0,
    };
    const segStart = 0.0;
    const splitTime = 2.5;

    const offsetInSeg = splitTime - segStart; // 2.5s
    const part1Dur = Number(offsetInSeg.toFixed(2)); // 2.5s
    const part2Dur = Number((segment.duration - offsetInSeg).toFixed(2)); // 3.5s

    const segA: StudioVoiceSegment = {
      ...segment,
      duration: part1Dur,
    };
    const segB: StudioVoiceSegment = {
      ...segment,
      id: "seg-part2",
      startOffset: Number((segment.startOffset + offsetInSeg).toFixed(2)), // 2.0 + 2.5 = 4.5s
      duration: part2Dur,
    };

    expect(segA.audioUrl).toBe(segment.audioUrl);
    expect(segA.startOffset).toBe(2.0);
    expect(segA.duration).toBe(2.5);

    expect(segB.audioUrl).toBe(segment.audioUrl);
    expect(segB.startOffset).toBe(4.5);
    expect(segB.duration).toBe(3.5);
    expect(segA.duration + segB.duration).toBe(6.0);
  });
});

describe("Undo & Redo History Engine", () => {
  it("pushes and pops immutable project states", () => {
    const state0: StudioProject = {
      id: "p1",
      title: "State 0",
      story: "Story",
      stylePreset: "Cinematic",
      aspectRatio: "16:9",
      defaultClipDuration: 3,
      continuousVoiceover: "",
      audioUrl: null,
      audioDuration: 0,
      clips: [],
    };

    const state1: StudioProject = {
      ...state0,
      title: "State 1 - Split Clip Added",
    };

    const state2: StudioProject = {
      ...state1,
      title: "State 2 - Trimmed",
    };

    const history: StudioProject[] = [];
    let future: StudioProject[] = [];
    let current = state0;

    // Mutate 1
    history.push(current);
    future = [];
    current = state1;

    // Mutate 2
    history.push(current);
    future = [];
    current = state2;

    expect(history).toHaveLength(2);
    expect(current.title).toBe("State 2 - Trimmed");

    // Undo: should revert to state1
    future.unshift(current);
    current = history.pop()!;
    expect(current.title).toBe("State 1 - Split Clip Added");
    expect(future).toHaveLength(1);

    // Undo again: should revert to state0
    future.unshift(current);
    current = history.pop()!;
    expect(current.title).toBe("State 0");
    expect(future).toHaveLength(2);

    // Redo: should re-advance to state1
    history.push(current);
    current = future.shift()!;
    expect(current.title).toBe("State 1 - Split Clip Added");

    // Redo again: should re-advance to state2
    history.push(current);
    current = future.shift()!;
    expect(current.title).toBe("State 2 - Trimmed");
  });
});
