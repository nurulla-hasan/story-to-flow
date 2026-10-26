import { describe, it, expect } from "vitest";
import type { TimelineClip } from "../types/timeline";
import {
  sanitizeFilename,
  calculateExportPlan,
  checkWebCodecsSupport,
  validateExportSafety,
  waitForEncoderQueue,
  MAX_SAFE_EXPORT_DURATION,
} from "./video-export-engine";

describe("Video Export Engine Plan & Helpers", () => {
  it("sanitizes project titles into clean file names", () => {
    expect(sanitizeFilename("My Epic Bengali Story! #1")).toBe("My_Epic_Bengali_Story_1");
    expect(sanitizeFilename("   ")).toBe("Story_Video");
    expect(sanitizeFilename("Village-Horror-Story_Part2")).toBe("Village_Horror_Story_Part2");
  });

  it("calculates export plan correctly for an empty timeline", () => {
    const plan = calculateExportPlan([], 30);
    expect(plan.totalDuration).toBe(0);
    expect(plan.totalFrames).toBe(0);
    expect(plan.visualClipsCount).toBe(0);
    expect(plan.audioClipsCount).toBe(0);
  });

  it("calculates total duration and total frames at 30 fps accurately", () => {
    const clips: TimelineClip[] = [
      {
        id: "vis-1",
        assetId: "a1",
        name: "scene-1.png",
        type: "image",
        trackId: "visual",
        startTime: 0,
        duration: 3.5,
        inPoint: 0,
        outPoint: 3.5,
      },
      {
        id: "vis-2",
        assetId: "a2",
        name: "hero.mp4",
        type: "video",
        trackId: "visual",
        startTime: 3.5,
        duration: 4.0,
        inPoint: 0,
        outPoint: 4.0,
      },
      {
        id: "aud-1",
        assetId: "a3",
        name: "voice.mp3",
        type: "audio",
        trackId: "audio",
        startTime: 0,
        duration: 10.0,
        inPoint: 0,
        outPoint: 10.0,
      },
    ];

    const plan = calculateExportPlan(clips, 30);
    expect(plan.totalDuration).toBe(10.0); // latest end is audio at 10.0s
    expect(plan.totalFrames).toBe(300); // 10s * 30fps = 300 frames
    expect(plan.visualClipsCount).toBe(2);
    expect(plan.audioClipsCount).toBe(1);
  });

  it("correctly identifies Node.js as non-browser environment for WebCodecs", () => {
    const check = checkWebCodecsSupport();
    expect(check.supported).toBe(false);
    expect(check.reason).toContain("browser environment");
  });
});

describe("Export Preflight Safety Validation", () => {
  it("rejects projects with zero duration", () => {
    const res = validateExportSafety({ totalDuration: 0, totalFrames: 0 }, { width: 720, height: 1280 });
    expect(res.safe).toBe(false);
    expect(res.error).toContain("no media clips");
  });

  it("rejects projects exceeding maximum safe duration (300s / 5min)", () => {
    const res = validateExportSafety(
      { totalDuration: MAX_SAFE_EXPORT_DURATION + 10, totalFrames: (MAX_SAFE_EXPORT_DURATION + 10) * 30 },
      { width: 720, height: 1280 }
    );
    expect(res.safe).toBe(false);
    expect(res.error).toContain("exceeds the safe browser limit");
  });

  it("approves safe 720p projects without warning", () => {
    const res = validateExportSafety({ totalDuration: 60, totalFrames: 1800 }, { width: 720, height: 1280 });
    expect(res.safe).toBe(true);
    expect(res.warning).toBeUndefined();
  });

  it("warns when 1080p is selected for longer projects (>120s)", () => {
    const res = validateExportSafety({ totalDuration: 150, totalFrames: 4500 }, { width: 1080, height: 1920 });
    expect(res.safe).toBe(true);
    expect(res.warning).toContain("significant memory and GPU");
  });
});

describe("Encoder Bounded Queue Backpressure Logic", () => {
  it("resolves immediately when queue is below threshold", async () => {
    const mockEncoder = {
      encodeQueueSize: 2,
      ondequeue: null as (((ev: Event) => unknown) | null),
    };

    // Should return immediately without waiting
    await expect(waitForEncoderQueue(mockEncoder, 5)).resolves.toBeUndefined();
  });

  it("waits when queue is full and resolves as soon as queue drains", async () => {
    const mockEncoder = {
      encodeQueueSize: 7,
      ondequeue: null as (((ev: Event) => unknown) | null),
    };

    let resolved = false;
    const promise = waitForEncoderQueue(mockEncoder, 5).then(() => {
      resolved = true;
    });

    // Still waiting because queueSize is 7 >= 5
    expect(resolved).toBe(false);
    expect(mockEncoder.ondequeue).toBeTypeOf("function");

    // Simulate encoder draining to 4
    mockEncoder.encodeQueueSize = 4;
    mockEncoder.ondequeue?.(new Event("dequeue"));

    await promise;
    expect(resolved).toBe(true);
  });

  it("rejects immediately if AbortSignal is cancelled", async () => {
    const controller = new AbortController();
    const mockEncoder = {
      encodeQueueSize: 6,
      ondequeue: null as (((ev: Event) => unknown) | null),
    };

    const promise = waitForEncoderQueue(mockEncoder, 5, controller.signal);
    controller.abort();

    await expect(promise).rejects.toThrow("Export cancelled by user");
  });

  it("propagates encoder callback errors through backpressure wait", async () => {
    const mockEncoder = {
      encodeQueueSize: 8,
      ondequeue: null as (((ev: Event) => unknown) | null),
    };

    let simulatedError: Error | null = null;
    const promise = waitForEncoderQueue(
      mockEncoder,
      5,
      undefined,
      () => simulatedError
    );

    // Simulate an encoder error occurring while waiting
    simulatedError = new Error("Hardware GPU pipeline crashed");
    mockEncoder.ondequeue?.(new Event("dequeue"));

    await expect(promise).rejects.toThrow("Hardware GPU pipeline crashed");
  });
});
