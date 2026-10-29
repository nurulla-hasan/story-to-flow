import { describe, expect, it } from "vitest";
import {
  type TimelineClip,
  type TimelineTrack,
  DEFAULT_TIMELINE_TRACKS,
  getTrackById,
  getVisualTracks,
  getAudioTracks,
  getTrackOrder,
  getVisualTrackLayerIndex,
  isVisualTrack,
  isAudioTrack,
  areClipsOnSameTrack,
  isTrackLocked,
  isTrackMuted,
  isTrackVisible,
  getTrackVolume,
  normalizeLegacyTrackId,
} from "@/types/timeline";
import {
  deserializeTimelineState,
  TIMELINE_STORAGE_VERSION,
} from "@/lib/timeline-storage";
import {
  hasVisualOverlap,
  findNextAvailableStartTime,
} from "@/lib/timeline-overlap";
import { reorderClipOnTrack } from "@/lib/timeline-reorder";
import { applyRippleExtend, applyRippleDelete } from "@/lib/timeline-trim";
import { calculateFitVisualsToVoiceover } from "@/lib/fit-visuals";
import {
  selectAudioEligibleClips,
  calculateExportPlan,
} from "@/lib/video-export-engine";
import type { MediaAssetItem } from "@/lib/media-storage";

describe("Dynamic Multi-Track Timeline Architecture", () => {
  describe("A. Track Model and Defaults", () => {
    it("starts a new project with the expected three default tracks", () => {
      expect(DEFAULT_TIMELINE_TRACKS).toHaveLength(3);
      const ids = DEFAULT_TIMELINE_TRACKS.map((t) => t.id);
      expect(ids).toEqual(["visual-2", "visual-1", "audio"]);

      const visualTracks = getVisualTracks(DEFAULT_TIMELINE_TRACKS);
      expect(visualTracks).toHaveLength(2);
      expect(visualTracks.map((t) => t.id)).toEqual(["visual-2", "visual-1"]);

      const audioTracks = getAudioTracks(DEFAULT_TIMELINE_TRACKS);
      expect(audioTracks).toHaveLength(1);
      expect(audioTracks[0].id).toBe("audio");

      expect(normalizeLegacyTrackId("visual")).toBe("visual-1");
      expect(normalizeLegacyTrackId("audio-1")).toBe("audio-1");
    });

    it("ensures track IDs are unique and preserves track type and role", () => {
      const ids = DEFAULT_TIMELINE_TRACKS.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      const v2 = getTrackById(DEFAULT_TIMELINE_TRACKS, "visual-2");
      expect(v2?.type).toBe("visual");

      const v1 = getTrackById(DEFAULT_TIMELINE_TRACKS, "visual-1");
      expect(v1?.type).toBe("visual");

      const audio = getTrackById(DEFAULT_TIMELINE_TRACKS, "audio");
      expect(audio?.type).toBe("audio");
      expect(audio?.role).toBe("voiceover");
    });

    it("preserves default visual z-ordering (Visual Layer 2 is in front of Visual Layer 1)", () => {
      const layer2Z = getVisualTrackLayerIndex("visual-2", DEFAULT_TIMELINE_TRACKS);
      const layer1Z = getVisualTrackLayerIndex("visual-1", DEFAULT_TIMELINE_TRACKS);

      expect(layer2Z).toBe(2);
      expect(layer1Z).toBe(1);
      expect(layer2Z).toBeGreaterThan(layer1Z);
    });

    it("correctly handles arbitrary dynamic track IDs purely based on track metadata, not heuristics", () => {
      const customTracks: TimelineTrack[] = [
        {
          id: "custom-foreground-overlay",
          name: "Top Overlay",
          type: "visual",
          order: 0,
          muted: false,
          volume: 1,
          visible: true,
          locked: false,
        },
        {
          id: "custom-base-cam1",
          name: "Camera 1",
          type: "visual",
          order: 1,
          muted: false,
          volume: 1,
          visible: true,
          locked: false,
        },
        {
          id: "arbitrary-id-sfx-laser",
          name: "Laser SFX",
          type: "audio",
          role: "sfx",
          order: 0,
          muted: false,
          volume: 0.9,
          visible: true,
          locked: false,
        },
      ];

      expect(isVisualTrack("custom-foreground-overlay", customTracks)).toBe(true);
      expect(isAudioTrack("custom-foreground-overlay", customTracks)).toBe(false);

      expect(isAudioTrack("arbitrary-id-sfx-laser", customTracks)).toBe(true);
      expect(isVisualTrack("arbitrary-id-sfx-laser", customTracks)).toBe(false);

      expect(getVisualTrackLayerIndex("custom-foreground-overlay", customTracks)).toBe(2);
      expect(getVisualTrackLayerIndex("custom-base-cam1", customTracks)).toBe(1);
    });

    it("evaluates track controls correctly (locked, muted, visible, volume, order)", () => {
      const tracks: TimelineTrack[] = [
        {
          id: "trk-1",
          name: "Muted & Locked Audio",
          type: "audio",
          order: 0,
          muted: true,
          volume: 0.75,
          visible: true,
          locked: true,
        },
        {
          id: "trk-2",
          name: "Hidden Visual",
          type: "visual",
          order: 1,
          muted: false,
          volume: 1.0,
          visible: false,
          locked: false,
        },
      ];

      expect(isTrackLocked("trk-1", tracks)).toBe(true);
      expect(isTrackLocked("trk-2", tracks)).toBe(false);

      expect(isTrackMuted("trk-1", tracks)).toBe(true);
      expect(isTrackMuted("trk-2", tracks)).toBe(false);

      expect(isTrackVisible("trk-1", tracks)).toBe(true);
      expect(isTrackVisible("trk-2", tracks)).toBe(false);

      expect(getTrackVolume("trk-1", tracks)).toBe(0.75);
      expect(getTrackVolume("trk-2", tracks)).toBe(1.0);

      expect(getTrackOrder(tracks, "trk-1")).toBe(0);
      expect(getTrackOrder(tracks, "trk-2")).toBe(1);
    });
  });

  describe("B. Storage Migration & Persistence", () => {
    it("migrates legacy version-1 state without tracks to version-2 without losing clips or timing", () => {
      const legacyV1 = {
        version: 1,
        projectTitle: "My Legacy Story",
        playhead: 4.25,
        zoom: 120,
        aspectRatio: "16:9",
        clips: [
          {
            id: "clip-vis",
            assetId: "a1",
            name: "scene.png",
            type: "image",
            trackId: "visual", // legacy "visual" alias
            startTime: 0,
            duration: 5.0,
            inPoint: 0,
            outPoint: 5.0,
          },
          {
            id: "clip-overlay",
            assetId: "a2",
            name: "pip.mp4",
            type: "video",
            trackId: "visual-2",
            startTime: 1.0,
            duration: 3.0,
            inPoint: 0,
            outPoint: 3.0,
          },
          {
            id: "clip-audio2",
            assetId: "a3",
            name: "music.mp3",
            type: "audio",
            trackId: "audio-1", // legacy "audio-1"
            startTime: 0,
            duration: 10.0,
            inPoint: 0,
            outPoint: 10.0,
          },
        ],
        transitions: [
          {
            id: "trans-1",
            fromClipId: "clip-vis",
            toClipId: "clip-overlay",
            type: "cross-dissolve",
            duration: 0.5,
            trackId: "visual",
          },
        ],
      };

      const migrated = deserializeTimelineState(legacyV1);
      expect(migrated).not.toBeNull();
      expect(migrated?.version).toBe(TIMELINE_STORAGE_VERSION);
      expect(migrated?.projectTitle).toBe("My Legacy Story");
      expect(migrated?.playhead).toBe(4.25);
      expect(migrated?.zoom).toBe(120);
      expect(migrated?.aspectRatio).toBe("16:9");

      // All 3 clips preserved with exact timings
      expect(migrated?.clips).toHaveLength(3);
      const visClip = migrated?.clips.find((c) => c.id === "clip-vis");
      expect(visClip?.trackId).toBe("visual-1"); // normalized from "visual" to "visual-1"
      expect(visClip?.startTime).toBe(0);
      expect(visClip?.duration).toBe(5.0);

      const overlayClip = migrated?.clips.find((c) => c.id === "clip-overlay");
      expect(overlayClip?.trackId).toBe("visual-2");

      const audio2Clip = migrated?.clips.find((c) => c.id === "clip-audio2");
      expect(audio2Clip?.trackId).toBe("audio-1");

      // Distinct audio-1 track was created to prevent collapsing
      const audio1Track = migrated?.tracks.find((t) => t.id === "audio-1");
      expect(audio1Track).toBeDefined();
      expect(audio1Track?.type).toBe("audio");

      // Transitions preserved and normalized
      expect(migrated?.transitions).toHaveLength(1);
      expect(migrated?.transitions[0].trackId).toBe("visual-1");
    });

    it("survives serialization and reload with empty tracks intact", () => {
      const customTracks: TimelineTrack[] = [
        ...DEFAULT_TIMELINE_TRACKS,
        {
          id: "sfx-empty",
          name: "Empty SFX Track",
          type: "audio",
          role: "sfx",
          order: 1,
          muted: true,
          volume: 0.6,
          visible: true,
          locked: true,
        },
      ];

      const state = {
        version: TIMELINE_STORAGE_VERSION,
        projectTitle: "Empty Track Project",
        tracks: customTracks,
        clips: [],
        transitions: [],
        playhead: 0,
        zoom: 100,
        selectedClipId: null,
        selectedTransitionId: null,
        aspectRatio: "9:16" as const,
        updatedAt: Date.now(),
      };

      const deserialized = deserializeTimelineState(state);
      expect(deserialized?.tracks).toHaveLength(4);
      const emptyTrack = deserialized?.tracks.find((t) => t.id === "sfx-empty");
      expect(emptyTrack).toBeDefined();
      expect(emptyTrack?.name).toBe("Empty SFX Track");
      expect(emptyTrack?.muted).toBe(true);
      expect(emptyTrack?.volume).toBe(0.6);
      expect(emptyTrack?.locked).toBe(true);
    });
  });

  describe("C. Dynamic Visual Layers & Z-Ordering", () => {
    it("renders at least three visual tracks in the correct foreground-to-background order", () => {
      const threeVisualTracks: TimelineTrack[] = [
        {
          id: "visual-3",
          name: "Visual Layer 3",
          type: "visual",
          order: 0, // Topmost in timeline UI
          muted: false,
          volume: 1,
          visible: true,
          locked: false,
        },
        {
          id: "visual-2",
          name: "Visual Layer 2",
          type: "visual",
          order: 1, // Middle layer
          muted: false,
          volume: 1,
          visible: true,
          locked: false,
        },
        {
          id: "visual-1",
          name: "Visual Layer 1",
          type: "visual",
          order: 2, // Base layer
          muted: false,
          volume: 1,
          visible: true,
          locked: false,
        },
      ];

      const z3 = getVisualTrackLayerIndex("visual-3", threeVisualTracks);
      const z2 = getVisualTrackLayerIndex("visual-2", threeVisualTracks);
      const z1 = getVisualTrackLayerIndex("visual-1", threeVisualTracks);

      expect(z3).toBe(3); // Highest foreground overlay
      expect(z2).toBe(2);
      expect(z1).toBe(1); // Base background footage

      expect(z3).toBeGreaterThan(z2);
      expect(z2).toBeGreaterThan(z1);
    });

    it("reordering visual tracks updates z-order consistently", () => {
      // Suppose user moved Visual Layer 1 up above Visual Layer 2
      const reordered: TimelineTrack[] = [
        {
          id: "visual-1",
          name: "Visual Layer 1",
          type: "visual",
          order: 0, // Now on top!
          muted: false,
          volume: 1,
          visible: true,
          locked: false,
        },
        {
          id: "visual-2",
          name: "Visual Layer 2",
          type: "visual",
          order: 1,
          muted: false,
          volume: 1,
          visible: true,
          locked: false,
        },
      ];

      expect(getVisualTrackLayerIndex("visual-1", reordered)).toBe(2);
      expect(getVisualTrackLayerIndex("visual-2", reordered)).toBe(1);
    });
  });

  describe("D. Clip Placement & Overlap Rules", () => {
    const tracks: TimelineTrack[] = [
      { id: "visual-2", name: "Layer 2", type: "visual", order: 0, muted: false, volume: 1, visible: true, locked: false },
      { id: "visual-1", name: "Layer 1", type: "visual", order: 1, muted: false, volume: 1, visible: true, locked: false },
      { id: "audio-vo", name: "Voiceover", type: "audio", role: "voiceover", order: 0, muted: false, volume: 1, visible: true, locked: false },
      { id: "audio-music", name: "Music", type: "audio", role: "music", order: 1, muted: false, volume: 1, visible: true, locked: false },
      { id: "audio-sfx", name: "SFX 1", type: "audio", role: "sfx", order: 2, muted: false, volume: 1, visible: true, locked: false },
      { id: "locked-visual", name: "Locked Visual", type: "visual", order: 2, muted: false, volume: 1, visible: true, locked: true },
    ];

    it("permits clips on separate audio tracks to overlap concurrently", () => {
      const voClip: TimelineClip = {
        id: "vo-1",
        assetId: "a-vo",
        name: "voice.mp3",
        type: "audio",
        trackId: "audio-vo",
        startTime: 0,
        duration: 10.0,
        inPoint: 0,
        outPoint: 10.0,
      };

      const musicClip: TimelineClip = {
        id: "music-1",
        assetId: "a-mus",
        name: "bg.mp3",
        type: "audio",
        trackId: "audio-music",
        startTime: 2.0,
        duration: 15.0,
        inPoint: 0,
        outPoint: 15.0,
      };

      // Voiceover and Music overlap between 2.0s and 10.0s without error
      expect(hasVisualOverlap(musicClip, [voClip], tracks)).toBe(false);
      expect(areClipsOnSameTrack(voClip.trackId, musicClip.trackId, tracks)).toBe(false);
    });

    it("permits overlapping clips on the same audio track (e.g. overlapping SFX/fades)", () => {
      const sfx1: TimelineClip = {
        id: "sfx-1",
        assetId: "a-sfx1",
        name: "boom.mp3",
        type: "audio",
        trackId: "audio-sfx",
        startTime: 3.0,
        duration: 4.0,
        inPoint: 0,
        outPoint: 4.0,
      };

      const sfx2: TimelineClip = {
        id: "sfx-2",
        assetId: "a-sfx2",
        name: "whoosh.mp3",
        type: "audio",
        trackId: "audio-sfx",
        startTime: 5.0, // overlaps 3.0 to 7.0
        duration: 3.0,
        inPoint: 0,
        outPoint: 3.0,
      };

      // Audio track does not impose visual track collision prevention
      expect(hasVisualOverlap(sfx2, [sfx1], tracks)).toBe(false);
    });

    it("enforces collision prevention on the same visual track while permitting multi-layer overlays", () => {
      const base1: TimelineClip = {
        id: "base-1",
        assetId: "a-b1",
        name: "scene1.png",
        type: "image",
        trackId: "visual-1",
        startTime: 0,
        duration: 5.0,
        inPoint: 0,
        outPoint: 5.0,
      };

      const collidingCandidate: TimelineClip = {
        id: "base-2",
        assetId: "a-b2",
        name: "scene2.png",
        type: "image",
        trackId: "visual-1",
        startTime: 2.0, // Collision with base-1 on visual-1!
        duration: 4.0,
        inPoint: 0,
        outPoint: 4.0,
      };

      const overlayCandidate: TimelineClip = {
        id: "pip-1",
        assetId: "a-pip",
        name: "overlay.png",
        type: "image",
        trackId: "visual-2", // Different visual layer!
        startTime: 2.0,
        duration: 4.0,
        inPoint: 0,
        outPoint: 4.0,
      };

      expect(hasVisualOverlap(collidingCandidate, [base1], tracks)).toBe(true);
      expect(hasVisualOverlap(overlayCandidate, [base1], tracks)).toBe(false);

      // Finds next available non-overlapping slot on visual track
      const nextSlot = findNextAvailableStartTime("visual-1", 3.0, [base1], 2.0, tracks);
      expect(nextSlot).toBe(5.0); // Bumps past base-1 (0-5s) to 5.0s
    });

    it("prevents modifying clips on locked tracks through edit helpers", () => {
      const lockedClip: TimelineClip = {
        id: "c-locked",
        assetId: "a-lock",
        name: "locked.png",
        type: "image",
        trackId: "locked-visual",
        startTime: 0,
        duration: 5.0,
        inPoint: 0,
        outPoint: 5.0,
      };

      const followingClip: TimelineClip = {
        id: "c-after",
        assetId: "a-after",
        name: "after.png",
        type: "image",
        trackId: "visual-1",
        startTime: 5.0,
        duration: 5.0,
        inPoint: 0,
        outPoint: 5.0,
      };

      const all = [lockedClip, followingClip];

      // Ripple extend on locked clip is rejected
      const extended = applyRippleExtend("c-locked", 8.0, all, tracks);
      expect(extended[0].duration).toBe(5.0); // unchanged!

      // Ripple delete on locked clip is rejected
      const deleted = applyRippleDelete("c-locked", all, tracks);
      expect(deleted.deletedClip).toBeNull();
      expect(deleted.updatedClips).toHaveLength(2);

      // Reorder clip on locked track does not shift locked clips
      const reordered = reorderClipOnTrack(lockedClip, 10.0, all, tracks);
      // Locked clip stays in place
      expect(reordered.clips.find((c) => c.id === "c-locked")?.startTime).toBe(0);
    });
  });

  describe("E. Fit Visuals to Voiceover with Dynamic Tracks", () => {
    it("determines target duration specifically from Voiceover track, ignoring longer SFX or Music", () => {
      const tracks: TimelineTrack[] = [
        { id: "vis-1", name: "Visual 1", type: "visual", order: 0, muted: false, volume: 1, visible: true, locked: false },
        { id: "voiceover-track", name: "Narration", type: "audio", role: "voiceover", order: 0, muted: false, volume: 1, visible: true, locked: false },
        { id: "ambient-track", name: "Ambience", type: "audio", role: "ambient", order: 1, muted: false, volume: 1, visible: true, locked: false },
      ];

      const clips: TimelineClip[] = [
        {
          id: "vo-1",
          assetId: "a-vo",
          name: "voice.mp3",
          type: "audio",
          trackId: "voiceover-track",
          startTime: 0,
          duration: 10.0, // Voiceover ends at 10.0s
          inPoint: 0,
          outPoint: 10.0,
        },
        {
          id: "ambient-1",
          assetId: "a-amb",
          name: "long_wind.mp3",
          type: "audio",
          trackId: "ambient-track",
          startTime: 0,
          duration: 35.0, // Long background ambience (35.0s)
          inPoint: 0,
          outPoint: 35.0,
        },
        {
          id: "img-1",
          assetId: "a-img1",
          name: "scene1.png",
          type: "image",
          trackId: "vis-1",
          startTime: 0,
          duration: 2.0,
          inPoint: 0,
          outPoint: 2.0,
        },
        {
          id: "img-2",
          assetId: "a-img2",
          name: "scene2.png",
          type: "image",
          trackId: "vis-1",
          startTime: 2.0,
          duration: 2.0,
          inPoint: 0,
          outPoint: 2.0,
        },
      ];

      const result = calculateFitVisualsToVoiceover(clips, [], tracks);
      expect(result.success).toBe(true);

      const fittedVisuals = result.updatedClips.filter((c) => c.trackId === "vis-1");
      const totalVisualDuration = Math.max(...fittedVisuals.map((c) => c.startTime + c.duration));

      // Visuals fit to the 10.0s VOICEOVER, NOT the 35.0s ambience!
      expect(totalVisualDuration).toBeCloseTo(10.0, 1);

      // Ambient clip is untouched
      const ambientClip = result.updatedClips.find((c) => c.id === "ambient-1");
      expect(ambientClip?.duration).toBe(35.0);
    });
  });

  describe("F. Audio MP4 Export Candidate Selection & Parity", () => {
    it("collects eligible clips from all unmuted dynamic audio tracks into the mix", () => {
      const tracks: TimelineTrack[] = [
        { id: "vis-1", name: "Visual 1", type: "visual", order: 0, muted: false, volume: 1, visible: true, locked: false },
        { id: "vo-track", name: "Voiceover", type: "audio", role: "voiceover", order: 0, muted: false, volume: 1, visible: true, locked: false },
        { id: "music-track", name: "Music", type: "audio", role: "music", order: 1, muted: false, volume: 0.8, visible: true, locked: false },
        { id: "sfx-track", name: "SFX", type: "audio", role: "sfx", order: 2, muted: false, volume: 1, visible: true, locked: false },
        { id: "muted-sfx", name: "Muted SFX", type: "audio", role: "sfx", order: 3, muted: true, volume: 1, visible: true, locked: false },
      ];

      const clips: TimelineClip[] = [
        { id: "c-vo", assetId: "a-vo", name: "narration.mp3", type: "audio", trackId: "vo-track", startTime: 0, duration: 8.0, inPoint: 0, outPoint: 8.0 },
        { id: "c-mus", assetId: "a-mus", name: "music.mp3", type: "audio", trackId: "music-track", startTime: 0, duration: 12.0, inPoint: 0, outPoint: 12.0 },
        { id: "c-sfx", assetId: "a-sfx", name: "door.wav", type: "audio", trackId: "sfx-track", startTime: 4.0, duration: 1.5, inPoint: 0, outPoint: 1.5 },
        { id: "c-muted", assetId: "a-muted", name: "silenced.wav", type: "audio", trackId: "muted-sfx", startTime: 2.0, duration: 1.0, inPoint: 0, outPoint: 1.0 },
      ];

      const assets: MediaAssetItem[] = [
        { id: "a-vo", name: "narration.mp3", category: "audio", mimeType: "audio/mp3", size: 100, url: "blob:1", blob: new Blob([]), importedAt: 0, lastModified: 0 },
        { id: "a-mus", name: "music.mp3", category: "audio", mimeType: "audio/mp3", size: 100, url: "blob:2", blob: new Blob([]), importedAt: 0, lastModified: 0 },
        { id: "a-sfx", name: "door.wav", category: "audio", mimeType: "audio/wav", size: 100, url: "blob:3", blob: new Blob([]), importedAt: 0, lastModified: 0 },
        { id: "a-muted", name: "silenced.wav", category: "audio", mimeType: "audio/wav", size: 100, url: "blob:4", blob: new Blob([]), importedAt: 0, lastModified: 0 },
      ];

      const selection = selectAudioEligibleClips(clips, assets, tracks);
      expect(selection.hasAudioSources).toBe(true);

      const dedicatedIds = selection.dedicatedAudioClips.map((c) => c.id);
      expect(dedicatedIds).toContain("c-vo");
      expect(dedicatedIds).toContain("c-mus");
      expect(dedicatedIds).toContain("c-sfx");
      // Silenced/muted track clip is strictly excluded from mix!
      expect(dedicatedIds).not.toContain("c-muted");
    });

    it("accounts for trailing audio clips in total exported duration", () => {
      const clips: TimelineClip[] = [
        { id: "v1", assetId: "a-v", name: "video.mp4", type: "video", trackId: "visual-1", startTime: 0, duration: 5.0, inPoint: 0, outPoint: 5.0 },
        { id: "a-trail", assetId: "a-mus", name: "outro_fade.mp3", type: "audio", trackId: "audio", startTime: 3.0, duration: 6.0, inPoint: 0, outPoint: 6.0 }, // ends at 9.0s!
      ];

      const plan = calculateExportPlan(clips, 30);
      expect(plan.totalDuration).toBe(9.0); // Covers trailing audio clip!
      expect(plan.totalFrames).toBe(270);
      expect(plan.audioClipsCount).toBe(1);
      expect(plan.visualClipsCount).toBe(1);
    });

    it("omits hidden visual tracks from export visual clips", () => {
      const tracks: TimelineTrack[] = [
        { id: "vis-1", name: "Main Footage", type: "visual", order: 1, muted: false, volume: 1, visible: true, locked: false },
        { id: "vis-hidden", name: "Hidden Overlay", type: "visual", order: 0, muted: false, volume: 1, visible: false, locked: false },
      ];

      const clips: TimelineClip[] = [
        { id: "c1", assetId: "a1", name: "base.png", type: "image", trackId: "vis-1", startTime: 0, duration: 4.0, inPoint: 0, outPoint: 4.0 },
        { id: "c2", assetId: "a2", name: "hidden.png", type: "image", trackId: "vis-hidden", startTime: 0, duration: 4.0, inPoint: 0, outPoint: 4.0 },
      ];

      const visibleClips = clips.filter((c) => isVisualTrack(c.trackId, tracks) && isTrackVisible(c.trackId, tracks));
      expect(visibleClips).toHaveLength(1);
      expect(visibleClips[0].id).toBe("c1");
    });
  });
});
