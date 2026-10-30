import { performance } from "node:perf_hooks";
import type { TimelineClip, TimelineTrack, TimelineTransition } from "../src/types/timeline";
import { getActiveVisualClips, getActiveTransitionsByTrack } from "../src/features/editor/domain/preview-selectors";
import { isAudioTrack, isTrackLocked } from "../src/types/timeline";
import { reorderClipOnTrack } from "../src/lib/timeline-reorder";
import { findAdjacentClipPairs } from "../src/lib/transition-helpers";
import { generateAdaptiveRulerTicks } from "../src/lib/ruler-scale";
import { calculateTimelineRulerSpan } from "../src/features/editor/domain/timeline-geometry";

interface Asset {
  id: string;
  name: string;
  category: "image" | "video" | "audio";
  size: number;
  importedAt: number;
  url?: string;
  thumbnailUrl?: string;
}

function createMockTracks(): TimelineTrack[] {
  return [
    { id: "visual-1", name: "Main Visual", type: "visual", order: 0, visible: true, locked: false, muted: false, volume: 1 },
    { id: "visual-2", name: "Overlay Visual", type: "visual", order: 1, visible: true, locked: false, muted: false, volume: 1 },
    { id: "audio-1", name: "Voiceover", type: "audio", role: "voiceover", order: 2, muted: false, locked: false, volume: 1, visible: true },
    { id: "audio-2", name: "Music", type: "audio", role: "music", order: 3, muted: false, locked: false, volume: 0.8, visible: true },
    { id: "audio-3", name: "SFX", type: "audio", role: "sfx", order: 4, muted: false, locked: false, volume: 1, visible: true },
  ];
}

function createMockProject(clipCount: number) {
  const tracks = createMockTracks();
  const clips: TimelineClip[] = [];
  const transitions: TimelineTransition[] = [];

  const visual1Count = Math.floor(clipCount * 0.4);
  const visual2Count = Math.floor(clipCount * 0.2);
  const audio1Count = Math.floor(clipCount * 0.2);
  const audio2Count = clipCount - (visual1Count + visual2Count + audio1Count);

  let v1Time = 0;
  for (let i = 0; i < visual1Count; i++) {
    const dur = 3 + (i % 5);
    const clipId = `v1_clip_${i}`;
    clips.push({
      id: clipId,
      assetId: `asset_v1_${i % 100}`,
      name: `Scene_${i}.png`,
      type: "image",
      trackId: "visual-1",
      startTime: v1Time,
      duration: dur,
      inPoint: 0,
      outPoint: dur,
    });
    if (i > 0 && i % 3 === 0) {
      transitions.push({
        id: `trans_${i}`,
        type: "cross-dissolve",
        duration: 0.8,
        fromClipId: `v1_clip_${i - 1}`,
        toClipId: clipId,
        trackId: "visual-1",
      });
    }
    v1Time += dur;
  }

  let v2Time = 0;
  for (let i = 0; i < visual2Count; i++) {
    const dur = 4;
    clips.push({
      id: `v2_clip_${i}`,
      assetId: `asset_v2_${i % 100}`,
      name: `Overlay_${i}.mp4`,
      type: "video",
      trackId: "visual-2",
      startTime: v2Time,
      duration: dur,
      inPoint: 0,
      outPoint: dur,
    });
    v2Time += dur + 1;
  }

  let a1Time = 0;
  for (let i = 0; i < audio1Count; i++) {
    const dur = 5;
    clips.push({
      id: `a1_clip_${i}`,
      assetId: `asset_a1_${i % 100}`,
      name: `Voiceover_${i}.mp3`,
      type: "audio",
      trackId: "audio-1",
      startTime: a1Time,
      duration: dur,
      inPoint: 0,
      outPoint: dur,
    });
    a1Time += dur;
  }

  let a2Time = 0;
  for (let i = 0; i < audio2Count; i++) {
    const dur = 10;
    clips.push({
      id: `a2_clip_${i}`,
      assetId: `asset_a2_${i % 100}`,
      name: `Music_${i}.mp3`,
      type: "audio",
      trackId: "audio-2",
      startTime: a2Time,
      duration: dur,
      inPoint: 0,
      outPoint: dur,
    });
    a2Time += dur;
  }

  return { tracks, clips, transitions };
}

function createMockAssets(assetCount: number): Asset[] {
  const assets: Asset[] = [];
  const categories: Array<"image" | "video" | "audio"> = ["image", "video", "audio"];
  const now = Date.now();
  for (let i = 0; i < assetCount; i++) {
    const cat = categories[i % 3];
    assets.push({
      id: `asset_${i}`,
      name: `media_file_${i.toString().padStart(5, "0")}.${cat === "image" ? "png" : cat === "video" ? "mp4" : "mp3"}`,
      category: cat,
      size: 1024 * (10 + (i % 5000)),
      importedAt: now - (i * 3600 * 1000) % (45 * 24 * 3600 * 1000),
      url: `blob:http://localhost:3000/mock-${i}`,
      thumbnailUrl: cat === "video" ? `blob:http://localhost:3000/thumb-${i}` : undefined,
    });
  }
  return assets;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function runBenchmark() {
  console.log("==================================================================");
  console.log("STORY-TO-FLOW PERFORMANCE BENCHMARK (BASELINE)");
  console.log(`Node: ${process.version} | Platform: ${process.platform} (${process.arch})`);
  console.log("Date: " + new Date().toISOString());
  console.log("==================================================================\n");

  const clipTiers = [100, 500, 2000];
  const assetTiers = [100, 1000, 5000];

  // 1. PLAYBACK FRAME TIME (PREVIEW SELECTORS: Visual clips + Transitions)
  console.log("### 1. PLAYBACK FRAME TIME (60 consecutive frames / 1 sec playback)");
  for (const count of clipTiers) {
    const { tracks, clips, transitions } = createMockProject(count);
    const frameTimes: number[] = [];
    const totalDuration = clips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 0);
    const step = totalDuration / 60;

    for (let f = 0; f < 60; f++) {
      const playhead = f * step;
      const t0 = performance.now();
      void getActiveVisualClips(clips, tracks, playhead);
      void getActiveTransitionsByTrack(transitions, clips, tracks, playhead);
      const t1 = performance.now();
      frameTimes.push(t1 - t0);
    }

    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const p50 = percentile(frameTimes, 50);
    const p95 = percentile(frameTimes, 95);
    const p99 = percentile(frameTimes, 99);
    console.log(`Clips: ${count.toString().padEnd(5)} | Avg: ${avg.toFixed(3)}ms | p50: ${p50.toFixed(3)}ms | p95: ${p95.toFixed(3)}ms | p99: ${p99.toFixed(3)}ms | Total 60f: ${(avg * 60).toFixed(2)}ms`);
  }

  // 2. AUDIO PLAYBACK SYNC SCAN (Clips scan + asset lookup per audio clip)
  console.log("\n### 2. AUDIO PLAYBACK SYNC SCAN (60 consecutive frames with Asset Lookups)");
  for (const clipCount of clipTiers) {
    for (const assetCount of assetTiers) {
      const { tracks, clips } = createMockProject(clipCount);
      const assets = createMockAssets(assetCount);
      const frameTimes: number[] = [];

      for (let f = 0; f < 60; f++) {
        const playhead = f * 1.5;
        const t0 = performance.now();
        // Simulating current useTimelineAudioPlayback loop
        const trackMap = new Map(tracks.map((track) => [track.id, track]));
        const activeAudioClips = clips.filter(
          (clip) =>
            isAudioTrack(clip.trackId, tracks) &&
            playhead >= clip.startTime &&
            playhead < clip.startTime + clip.duration
        );
        for (const clip of activeAudioClips) {
          trackMap.get(clip.trackId);
          assets.find((item) => item.id === clip.assetId);
        }
        const t1 = performance.now();
        frameTimes.push(t1 - t0);
      }

      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const p95 = percentile(frameTimes, 95);
      console.log(`Clips: ${clipCount.toString().padEnd(4)} | Assets: ${assetCount.toString().padEnd(4)} | Avg: ${avg.toFixed(3)}ms | p95: ${p95.toFixed(3)}ms`);
    }
  }

  // 3. DRAG & TRIM GESTURES (Start clone + 60 pointer moves)
  console.log("\n### 3. DRAG & TRIM GESTURE PROCESSING");
  for (const count of clipTiers) {
    const { tracks, clips } = createMockProject(count);
    const targetClip = clips[Math.floor(clips.length / 2)];

    // Measure deep clone on gesture start
    const cloneStart = performance.now();
    for (let i = 0; i < 50; i++) {
      void JSON.parse(JSON.stringify(clips));
    }
    const cloneAvg = (performance.now() - cloneStart) / 50;

    // Measure 60 pointer moves during drag
    const moveTimes: number[] = [];
    const pxPerSec = 50;
    const initialClips = JSON.parse(JSON.stringify(clips)) as TimelineClip[];

    // Snap points extraction
    const snapPoints = [0, 5];
    for (const c of clips) {
      if (c.id === targetClip.id) continue;
      snapPoints.push(c.startTime, c.startTime + c.duration);
    }

    for (let m = 0; m < 60; m++) {
      const deltaX = m * 2;
      const t0 = performance.now();
      const rawStart = Math.max(0, targetClip.startTime + deltaX / pxPerSec);

      // Current reorder on visual track
      const result = reorderClipOnTrack(targetClip, rawStart, initialClips, tracks);
      const latestClips = result.clips;

      // Current setClipsTransient mapping
      const origMap = new Map(clips.map((c) => [c.id, c]));
      void latestClips.map((c) => {
        const orig = origMap.get(c.id);
        if (orig && isTrackLocked(orig.trackId, tracks)) return orig;
        return c;
      });

      const t1 = performance.now();
      moveTimes.push(t1 - t0);
    }

    const moveAvg = moveTimes.reduce((a, b) => a + b, 0) / moveTimes.length;
    const moveP95 = percentile(moveTimes, 95);
    console.log(`Clips: ${count.toString().padEnd(5)} | Start Deep-Clone: ${cloneAvg.toFixed(3)}ms | Move Event Avg: ${moveAvg.toFixed(3)}ms | Move p95: ${moveP95.toFixed(3)}ms | Total 60 moves: ${(moveAvg * 60).toFixed(2)}ms`);
  }

  // 4. TIMELINE DOCK DERIVATIONS & RENDER PREPARATION
  console.log("\n### 4. TIMELINE DOCK DERIVATIONS (clipsByTrack, adjacentPairs, rulerTicks)");
  for (const count of clipTiers) {
    const { tracks, clips } = createMockProject(count);
    const times: number[] = [];
    const totalDuration = clips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 0);
    const pxPerSec = 50;
    const tracksContentWidth = Math.max(1200, (totalDuration + 10) * pxPerSec);

    for (let i = 0; i < 30; i++) {
      const t0 = performance.now();
      // clipsByTrack
      const map = new Map<string, TimelineClip[]>();
      for (const track of tracks) map.set(track.id, []);
      for (const clip of clips) {
        const list = map.get(clip.trackId);
        if (list) list.push(clip);
        else map.set(clip.trackId, [clip]);
      }
      // adjacentPairs
      for (const track of tracks) {
        const trackClips = map.get(track.id) || [];
        if (track.type === "visual") {
          findAdjacentClipPairs(trackClips);
        }
      }
      // ruler ticks
      const span = calculateTimelineRulerSpan(totalDuration, tracksContentWidth, pxPerSec);
      void generateAdaptiveRulerTicks(100, span, 30);
      const t1 = performance.now();
      times.push(t1 - t0);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`Clips: ${count.toString().padEnd(5)} | Dock Layout Prep Avg: ${avg.toFixed(3)}ms`);
  }

  // 5. MEDIA LIBRARY FILTER, SEARCH & SORT
  console.log("\n### 5. MEDIA LIBRARY FILTER, SEARCH & SORT");
  for (const count of assetTiers) {
    const assets = createMockAssets(count);
    const times: number[] = [];

    // Filter, search "scene", sort by name
    for (let i = 0; i < 30; i++) {
      const t0 = performance.now();
      // counts calculation (current implementation)
      void {
        all: assets.length,
        video: assets.filter((a) => a.category === "video").length,
        image: assets.filter((a) => a.category === "image").length,
        audio: assets.filter((a) => a.category === "audio").length,
      };

      // Filter
      const needle = "media_file_001";
      const matches = assets.filter((asset) => {
        if (asset.category !== "image" && "all" !== "all") return false;
        if (needle && !asset.name.toLowerCase().includes(needle)) return false;
        return true;
      });

      // Sort
      void [...matches].sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      });

      const t1 = performance.now();
      times.push(t1 - t0);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = percentile(times, 95);
    console.log(`Assets: ${count.toString().padEnd(5)} | Filter & Sort Avg: ${avg.toFixed(3)}ms | p95: ${p95.toFixed(3)}ms`);
  }

  // 6. MEMORY USAGE ESTIMATION
  console.log("\n### 6. PROCESS MEMORY PROFILE (End of Baseline)");
  const mem = process.memoryUsage();
  console.log(`Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB | Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB | RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log("==================================================================");
}

runBenchmark();
