import { describe, it, expect } from "vitest";
import type { TimelineClip, TimelineTransition } from "@/types/timeline";
import {
  isAudioTrack,
  isVisualTrack,
  getVisualTrackLayerIndex,
} from "@/types/timeline";
import {
  MAX_TRANSITION_DURATION,
  MIN_TRANSITION_DURATION,
  validateTransitionDuration,
  areClipsAdjacentForTransition,
  getTransitionProgress,
} from "./transition-helpers";
import { calculateExportPlan } from "./video-export-engine";
import { calculateAudioGain } from "./audio-fade-helpers";

describe("Preview/Export Parity — Audio Tracks & Multi-Track Mixing (C-04)", () => {
  it("recognizes audio-1 alongside audio as valid audio tracks", () => {
    expect(isAudioTrack("audio")).toBe(true);
    expect(isAudioTrack("audio-1")).toBe(true);
    expect(isAudioTrack("visual")).toBe(false);
    expect(isAudioTrack("visual-1")).toBe(false);
  });

  it("calculates multi-track audio gains concurrently for overlapping clips with fades", () => {
    const voiceover: TimelineClip = {
      id: "voice",
      assetId: "a1",
      name: "voice.mp3",
      type: "audio",
      trackId: "audio",
      startTime: 0,
      duration: 10,
      inPoint: 0,
      outPoint: 10,
      volume: 1.0,
      fadeInDuration: 1.0,
      fadeOutDuration: 1.0,
    };

    const bgMusic: TimelineClip = {
      id: "music",
      assetId: "a2",
      name: "bg.mp3",
      type: "audio",
      trackId: "audio-1",
      startTime: 0,
      duration: 10,
      inPoint: 0,
      outPoint: 10,
      volume: 0.5,
      fadeInDuration: 2.0,
      fadeOutDuration: 2.0,
    };

    const playhead = 0.5; // During fade-in of both

    // Voiceover at 0.5s (fadeIn=1.0s) -> 50% of 1.0 volume = 0.5
    const voiceGain = calculateAudioGain(
      playhead - voiceover.startTime,
      voiceover.duration,
      voiceover.volume ?? 1.0,
      voiceover.fadeInDuration ?? 0,
      voiceover.fadeOutDuration ?? 0
    );
    expect(voiceGain).toBeCloseTo(0.5, 2);

    // BG Music at 0.5s (fadeIn=2.0s) -> 25% of 0.5 volume = 0.125
    const musicGain = calculateAudioGain(
      playhead - bgMusic.startTime,
      bgMusic.duration,
      bgMusic.volume ?? 1.0,
      bgMusic.fadeInDuration ?? 0,
      bgMusic.fadeOutDuration ?? 0
    );
    expect(musicGain).toBeCloseTo(0.125, 2);

    // Export plan counts both tracks
    const plan = calculateExportPlan([voiceover, bgMusic], 30);
    expect(plan.audioClipsCount).toBe(2);
  });
});

describe("Preview/Export Parity — Overlay Preservation during Transitions (C-05)", () => {
  const base1: TimelineClip = {
    id: "base-1",
    assetId: "v1",
    name: "scene1.png",
    type: "image",
    trackId: "visual-1",
    startTime: 0,
    duration: 5,
    inPoint: 0,
    outPoint: 5,
  };

  const base2: TimelineClip = {
    id: "base-2",
    assetId: "v2",
    name: "scene2.png",
    type: "image",
    trackId: "visual-1",
    startTime: 5,
    duration: 5,
    inPoint: 0,
    outPoint: 5,
  };

  const overlay: TimelineClip = {
    id: "overlay-1",
    assetId: "ov1",
    name: "logo.png",
    type: "image",
    trackId: "visual-2",
    startTime: 3,
    duration: 4, // spans 3s to 7s (active during 4.5s-5.5s transition!)
    inPoint: 0,
    outPoint: 4,
  };

  const transition: TimelineTransition = {
    id: "trans-1",
    type: "cross-dissolve",
    duration: 1.0,
    fromClipId: "base-1",
    toClipId: "base-2",
    trackId: "visual-1",
  };

  it("identifies transition on layer 1 while layer 2 overlay is concurrently active", () => {
    const currentTime = 5.0; // Mid-transition (4.5s to 5.5s)
    const progress = getTransitionProgress(currentTime, transition, base1, base2);
    expect(progress).toBeCloseTo(0.5, 2);

    const clips = [base1, base2, overlay];
    const activeVisuals = clips
      .filter((c) => isVisualTrack(c.trackId) && currentTime >= c.startTime && currentTime < c.startTime + c.duration)
      .sort((a, b) => getVisualTrackLayerIndex(a.trackId) - getVisualTrackLayerIndex(b.trackId));

    // Active clips at 5.0s: base2 and overlay
    expect(activeVisuals.some((c) => c.id === "overlay-1")).toBe(true);
    expect(getVisualTrackLayerIndex(overlay.trackId)).toBe(2);
    expect(getVisualTrackLayerIndex(transition.trackId)).toBe(1);

    // Filter non-transition visuals that must be preserved above the transition
    const higherLayers = activeVisuals.filter(
      (c) => c.id !== transition.fromClipId && c.id !== transition.toClipId && getVisualTrackLayerIndex(c.trackId) > getVisualTrackLayerIndex(transition.trackId)
    );
    expect(higherLayers).toHaveLength(1);
    expect(higherLayers[0].id).toBe("overlay-1");
  });
});

describe("Preview/Export Parity — Timeline & Export Duration Consistency (C-06)", () => {
  it("ensures total content duration matches calculateExportPlan duration exactly", () => {
    const clips: TimelineClip[] = [
      {
        id: "c1",
        assetId: "a1",
        name: "scene.png",
        type: "image",
        trackId: "visual-1",
        startTime: 0,
        duration: 8.5,
        inPoint: 0,
        outPoint: 8.5,
      },
    ];

    const plan = calculateExportPlan(clips, 30);
    expect(plan.totalDuration).toBe(8.5);

    // Shared content duration rule
    const maxEnd = Math.max(...clips.map((c) => c.startTime + c.duration));
    const contentDuration = parseFloat(maxEnd.toFixed(3));

    expect(contentDuration).toBe(8.5); // exact content end matching export plan!
    expect(maxEnd).toBe(8.5);
  });

  it("matches export plan duration for a project shorter than 10 seconds (e.g. 5.0s)", () => {
    const clips: TimelineClip[] = [
      {
        id: "short-clip",
        assetId: "a1",
        name: "5s.png",
        type: "image",
        trackId: "visual-1",
        startTime: 0,
        duration: 5.0,
        inPoint: 0,
        outPoint: 5.0,
      },
    ];

    const plan = calculateExportPlan(clips, 30);
    expect(plan.totalDuration).toBe(5.0);

    const maxEnd = Math.max(...clips.map((c) => c.startTime + c.duration));
    const contentDuration = parseFloat(maxEnd.toFixed(3));
    expect(contentDuration).toBe(5.0);
    expect(contentDuration).toBe(plan.totalDuration);
  });
});

describe("Preview/Export Parity — Transition Duration Constraints (C-07)", () => {
  it("enforces shared MAX_TRANSITION_DURATION across validation helpers", () => {
    expect(MAX_TRANSITION_DURATION).toBe(2.0);
    expect(MIN_TRANSITION_DURATION).toBe(0.2);

    const longClipA: TimelineClip = {
      id: "a",
      assetId: "a",
      name: "a",
      type: "image",
      trackId: "visual-1",
      startTime: 0,
      duration: 10,
      inPoint: 0,
      outPoint: 10,
    };

    const longClipB: TimelineClip = {
      id: "b",
      assetId: "b",
      name: "b",
      type: "image",
      trackId: "visual-1",
      startTime: 10,
      duration: 10,
      inPoint: 0,
      outPoint: 10,
    };

    // Both clips are 10s (half is 5s), so max should be MAX_TRANSITION_DURATION (2.0s)
    const validated = validateTransitionDuration(MAX_TRANSITION_DURATION, longClipA, longClipB);
    expect(validated).toBe(2.0);
  });

  it("clamps transition duration to half of shorter connecting clip", () => {
    const shortClip: TimelineClip = {
      id: "short",
      assetId: "s",
      name: "short",
      type: "image",
      trackId: "visual-1",
      startTime: 0,
      duration: 1.0, // half is 0.5s
      inPoint: 0,
      outPoint: 1.0,
    };

    const longClip: TimelineClip = {
      id: "long",
      assetId: "l",
      name: "long",
      type: "image",
      trackId: "visual-1",
      startTime: 1.0,
      duration: 10.0,
      inPoint: 0,
      outPoint: 10.0,
    };

    const validated = validateTransitionDuration(2.0, shortClip, longClip);
    expect(validated).toBe(0.5); // clamped to half of 1.0s
  });
});

describe("Preview/Export Parity — Split-Related Transition Integrity (C-09)", () => {
  it("reconciles incoming and outgoing transitions safely across a clip split", () => {
    const clipA: TimelineClip = {
      id: "clip-A",
      assetId: "a",
      name: "A.png",
      type: "image",
      trackId: "visual-1",
      startTime: 0,
      duration: 6.0,
      inPoint: 0,
      outPoint: 6.0,
    };

    const clipB: TimelineClip = {
      id: "clip-B",
      assetId: "b",
      name: "B.png",
      type: "image",
      trackId: "visual-1",
      startTime: 6.0,
      duration: 6.0,
      inPoint: 0,
      outPoint: 6.0,
    };

    const outgoingTrans: TimelineTransition = {
      id: "trans-A-B",
      type: "cross-dissolve",
      duration: 1.0,
      fromClipId: "clip-A",
      toClipId: "clip-B",
      trackId: "visual-1",
    };

    // Split clip-A at playhead = 3.0s into part1 (0-3s, id: clip-A) and part2 (3-6s, id: part2)
    const part1: TimelineClip = {
      ...clipA,
      duration: 3.0,
      outPoint: 3.0,
    };
    const part2: TimelineClip = {
      ...clipA,
      id: "clip-A-part2",
      startTime: 3.0,
      duration: 3.0,
      inPoint: 3.0,
      outPoint: 6.0,
    };

    const updatedClips = [part1, part2, clipB];
    const clipMap = new Map(updatedClips.map((c) => [c.id, c]));

    // Reconcile transitions
    const reconciledTransitions: TimelineTransition[] = [];
    for (const t of [outgoingTrans]) {
      if (t.fromClipId === "clip-A") {
        const to = clipMap.get(t.toClipId);
        if (to && areClipsAdjacentForTransition(part2, to)) {
          const safeDur = validateTransitionDuration(t.duration, part2, to);
          reconciledTransitions.push({ ...t, fromClipId: part2.id, duration: safeDur });
        }
      }
    }

    expect(reconciledTransitions).toHaveLength(1);
    expect(reconciledTransitions[0].fromClipId).toBe("clip-A-part2"); // transferred to right part!
    expect(reconciledTransitions[0].toClipId).toBe("clip-B");
    expect(reconciledTransitions[0].duration).toBe(1.0);
  });
});
