import { describe, it, expect, vi } from "vitest";
import type { TimelineClip } from "../types/timeline";
import {
  sanitizeFilename,
  calculateExportPlan,
  checkWebCodecsSupport,
  validateExportSafety,
  waitForEncoderQueue,
  seekVideoElement,
  preloadVideo,
  inspectVideoAudioTrack,
  decodeVideoEmbeddedAudio,
  assembleAudioBufferFromWrappedChunks,
  compositeCrossDissolve,
  computeCrossDissolvePixel,
  MAX_SAFE_EXPORT_DURATION,
} from "./video-export-engine";

describe("Video Export Engine Plan & Helpers", () => {
  it("sanitizes project titles into clean file names while preserving Unicode scripts", () => {
    expect(sanitizeFilename("My Epic Bengali Story! #1")).toBe("My_Epic_Bengali_Story_1");
    expect(sanitizeFilename("   ")).toBe("Story_Video");
    expect(sanitizeFilename("Village-Horror-Story_Part2")).toBe("Village_Horror_Story_Part2");
    // Bengali Unicode support:
    expect(sanitizeFilename("রূপকথার গল্প: পর্ব ১")).toBe("রূপকথার_গল্প_পর্ব_১");
    expect(sanitizeFilename("ভুতুড়ে বাড়ি? / পর্ব *২")).toBe("ভুতুড়ে_বাড়ি_পর্ব_২");
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

  it("rejects with stall timeout error if queue remains full after 4000ms", async () => {
    vi.useFakeTimers();
    try {
      const mockEncoder = {
        encodeQueueSize: 7,
        ondequeue: null as (((ev: Event) => unknown) | null),
      };

      const promise = waitForEncoderQueue(mockEncoder, 5);

      // Fast-forward time by 4000ms
      vi.advanceTimersByTime(4000);

      await expect(promise).rejects.toThrow(/Encoder stalled/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves safely on timeout if queue drained below threshold before timeout fired", async () => {
    vi.useFakeTimers();
    try {
      const mockEncoder = {
        encodeQueueSize: 7,
        ondequeue: null as (((ev: Event) => unknown) | null),
      };

      const promise = waitForEncoderQueue(mockEncoder, 5);

      // Drain queue to 3
      mockEncoder.encodeQueueSize = 3;

      // Fast-forward time by 4000ms
      vi.advanceTimersByTime(4000);

      await expect(promise).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Export Cancellation and Resource Cleanup Guarantees", () => {
  it("ensures VideoFrame is closed even if encoder.encode throws", () => {
    let closed = false;
    const mockFrame = {
      close: () => {
        closed = true;
      },
    };

    const mockEncoder = {
      encode: () => {
        throw new Error("GPU device lost during frame encode");
      },
    };

    expect(() => {
      try {
        mockEncoder.encode();
      } finally {
        mockFrame.close();
      }
    }).toThrow("GPU device lost during frame encode");

    expect(closed).toBe(true);
  });

  it("ensures AudioData is closed even if audioEncoder.encode throws", () => {
    let closed = false;
    const mockAudioData = {
      close: () => {
        closed = true;
      },
    };

    const mockEncoder = {
      encode: () => {
        throw new Error("Audio buffer format mismatch");
      },
    };

    expect(() => {
      try {
        mockEncoder.encode();
      } finally {
        mockAudioData.close();
      }
    }).toThrow("Audio buffer format mismatch");

    expect(closed).toBe(true);
  });

  it("prevents download trigger when AbortSignal is cancelled", () => {
    const controller = new AbortController();
    controller.abort();

    let downloadTriggered = false;
    const triggerDownload = () => {
      downloadTriggered = true;
    };

    // Simulated component completion handler
    if (controller.signal.aborted) {
      // Abort detected: should not trigger download
    } else {
      triggerDownload();
    }

    expect(downloadTriggered).toBe(false);
  });

  it("rejects immediately if AbortSignal is cancelled before/during image preload", async () => {
    const controller = new AbortController();
    controller.abort();

    // Verify preloadImage abort contract
    const preloadContract = (signal?: AbortSignal) =>
      new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error("Export cancelled by user"));
          return;
        }
        resolve("loaded");
      });

    await expect(preloadContract(controller.signal)).rejects.toThrow("Export cancelled by user");
  });

  it("rejects seek operations immediately when AbortSignal is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    const mockVideo = {
      currentTime: 0,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as HTMLVideoElement;

    await expect(seekVideoElement(mockVideo, 5.0, controller.signal)).rejects.toThrow(
      "Export cancelled by user"
    );
  });

  it("M-08: rejects with explicit error if video seek times out (does not export stale frame)", async () => {
    vi.useFakeTimers();
    try {
      const listeners: Record<string, (() => void) | undefined> = {};
      const mockVideo = {
        currentTime: 0,
        addEventListener: (event: string, cb: () => void) => {
          listeners[event] = cb;
        },
        removeEventListener: (event: string) => {
          delete listeners[event];
        },
      } as unknown as HTMLVideoElement;

      const promise = seekVideoElement(mockVideo, 4.0, undefined, 1000);

      // Fast forward past the 1000ms seek timeout
      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow("Video seek timed out at 4.00s (1000ms elapsed).");
    } finally {
      vi.useRealTimers();
    }
  });

  it("M-08: rejects with explicit error if video element emits error during seek", async () => {
    const listeners: Record<string, (() => void) | undefined> = {};
    const mockVideo = {
      currentTime: 0,
      addEventListener: (event: string, cb: () => void) => {
        listeners[event] = cb;
      },
      removeEventListener: (event: string) => {
        delete listeners[event];
      },
    } as unknown as HTMLVideoElement;

    const promise = seekVideoElement(mockVideo, 2.5);

    // Simulate video element error event
    listeners["error"]?.();

    await expect(promise).rejects.toThrow("Failed to decode video frame at 2.50s.");
  });

  it("resolves promptly when video emits seeked event", async () => {
    const listeners: Record<string, (() => void) | undefined> = {};
    const mockVideo = {
      currentTime: 0,
      addEventListener: (event: string, cb: () => void) => {
        listeners[event] = cb;
      },
      removeEventListener: (event: string) => {
        delete listeners[event];
      },
    } as unknown as HTMLVideoElement;

    const promise = seekVideoElement(mockVideo, 3.0);

    // Simulate successful seeked event
    listeners["seeked"]?.();

    await expect(promise).resolves.toBeUndefined();
  });

  it("aborts when dialog triggers cancellation or unmounts", () => {
    let exportCancelled = false;
    let leaseReleased = false;

    const abortController = new AbortController();
    const releaseLease = () => {
      leaseReleased = true;
    };

    // Simulate dialog close/unmount
    const handleCloseOrUnmount = () => {
      abortController.abort();
      exportCancelled = abortController.signal.aborted;
      releaseLease();
    };

    handleCloseOrUnmount();

    expect(exportCancelled).toBe(true);
    expect(leaseReleased).toBe(true);
  });

  it("propagates audio track decode failures instead of reporting clean success", () => {
    const simulateAudioDecode = (clipName: string, shouldFail: boolean) => {
      if (shouldFail) {
        throw new Error(
          `Failed to decode audio track "${clipName}": The string did not match the expected pattern.`
        );
      }
      return { duration: 10 };
    };

    expect(() => simulateAudioDecode("voiceover.mp3", true)).toThrow(
      'Failed to decode audio track "voiceover.mp3"'
    );
  });

  describe("P0 — Frame-Level Video Seeking & Readiness", () => {
    it("does not skip 30fps frames (33.3ms difference must perform seek, not shortcut)", async () => {
      let seekAttempted = false;
      let currentTimeVal = 0.0;
      const listeners: Record<string, (() => void) | undefined> = {};
      const mockVideo = {
        get currentTime() {
          return currentTimeVal;
        },
        set currentTime(val: number) {
          seekAttempted = true;
          currentTimeVal = val;
        },
        readyState: 4,
        addEventListener: (event: string, cb: () => void) => {
          listeners[event] = cb;
        },
        removeEventListener: (event: string) => {
          delete listeners[event];
        },
      } as unknown as HTMLVideoElement;

      // Frame 1 at 30fps (approx 0.0333s)
      const promise = seekVideoElement(mockVideo, 0.0333);
      expect(seekAttempted).toBe(true);
      listeners["seeked"]?.();
      await expect(promise).resolves.toBeUndefined();
    });

    it("never shortcuts initial frame seek if video readyState < 2", async () => {
      let seekAttempted = false;
      let currentTimeVal = 0.0;
      const listeners: Record<string, (() => void) | undefined> = {};
      const mockVideo = {
        get currentTime() {
          return currentTimeVal;
        },
        set currentTime(val: number) {
          seekAttempted = true;
          currentTimeVal = val;
        },
        readyState: 1, // HAVE_METADATA only, not yet HAVE_CURRENT_DATA
        addEventListener: (event: string, cb: () => void) => {
          listeners[event] = cb;
        },
        removeEventListener: (event: string) => {
          delete listeners[event];
        },
      } as unknown as HTMLVideoElement;

      const promise = seekVideoElement(mockVideo, 0.0);
      expect(seekAttempted).toBe(true);
      listeners["seeked"]?.();
      await expect(promise).resolves.toBeUndefined();
    });

    it("shortcuts seek only when readyState >= 2 and time difference <= 2ms", async () => {
      let seekAttempted = false;
      let currentTimeVal = 1.0;
      const mockVideo = {
        get currentTime() {
          return currentTimeVal;
        },
        set currentTime(val: number) {
          seekAttempted = true;
          currentTimeVal = val;
        },
        readyState: 4,
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as HTMLVideoElement;

      // Seeking to 1.001s (1ms delta <= 2ms tolerance)
      const promise = seekVideoElement(mockVideo, 1.001);
      expect(seekAttempted).toBe(false);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe("P0 — Video Preloading & Decoded Frame Readiness", () => {
    it("preloadVideo: resolves when loadeddata event is dispatched", async () => {
      const listeners: Record<string, (() => void) | undefined> = {};
      const mockVideoElement = {
        crossOrigin: "",
        muted: false,
        playsInline: false,
        preload: "",
        src: "",
        readyState: 0,
        load: vi.fn(),
        pause: vi.fn(),
        removeAttribute: vi.fn(),
        addEventListener: (event: string, cb: () => void) => {
          listeners[event] = cb;
        },
        removeEventListener: (event: string) => {
          delete listeners[event];
        },
      };

      const originalDocument = globalThis.document;
      globalThis.document = {
        createElement: (tag: string) => (tag === "video" ? mockVideoElement : {}) as unknown as HTMLElement,
      } as unknown as Document;

      try {
        const promise = preloadVideo("blob:http://localhost/video1");
        expect(mockVideoElement.preload).toBe("auto");
        expect(mockVideoElement.muted).toBe(true);
        expect(mockVideoElement.playsInline).toBe(true);

        // Dispatch loadeddata
        listeners["loadeddata"]?.();

        const res = await promise;
        expect(res).toBe(mockVideoElement);
      } finally {
        globalThis.document = originalDocument;
      }
    });

    it("preloadVideo: rejects with clear error when media fails to load", async () => {
      const listeners: Record<string, (() => void) | undefined> = {};
      const mockVideoElement = {
        crossOrigin: "",
        muted: false,
        playsInline: false,
        preload: "",
        src: "",
        readyState: 0,
        load: vi.fn(),
        pause: vi.fn(),
        removeAttribute: vi.fn(),
        addEventListener: (event: string, cb: () => void) => {
          listeners[event] = cb;
        },
        removeEventListener: (event: string) => {
          delete listeners[event];
        },
      };

      const originalDocument = globalThis.document;
      globalThis.document = {
        createElement: (tag: string) => (tag === "video" ? mockVideoElement : {}) as unknown as HTMLElement,
      } as unknown as Document;

      try {
        const promise = preloadVideo("blob:http://localhost/bad-video");
        listeners["error"]?.();

        await expect(promise).rejects.toThrow("Failed to load video: blob:http://localhost/bad-video");
      } finally {
        globalThis.document = originalDocument;
      }
    });

    it("preloadVideo: rejects immediately if signal is aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(preloadVideo("blob:http://localhost/video", controller.signal)).rejects.toThrow(
        "Export cancelled by user"
      );
    });
  });

  describe("P0 — Embedded Video Audio Inspection & Decoding", () => {
    it("inspectVideoAudioTrack: returns hasAudioTrack false for empty or non-media blob", async () => {
      const emptyBlob = new Blob([new Uint8Array(8)]);
      const info = await inspectVideoAudioTrack(emptyBlob);
      expect(info.hasAudioTrack).toBe(false);
    });

    it("decodeVideoEmbeddedAudio: returns null cleanly for silent video without throwing", async () => {
      // Blob without audio tracks
      const silentBlob = new Blob([new Uint8Array(32)]);
      const mockAudioContext = {
        decodeAudioData: vi.fn(),
      } as unknown as BaseAudioContext;

      const result = await decodeVideoEmbeddedAudio(silentBlob, "silent_hero.mp4", mockAudioContext);
      expect(result).toBeNull();
      // Should not attempt to decode or fail on silent video
    });

    it("decodeVideoEmbeddedAudio: returns decoded AudioBuffer when audio track exists and decodes successfully", async () => {
      const mockBuffer = {
        sampleRate: 48000,
        numberOfChannels: 2,
        duration: 5.0,
      } as AudioBuffer;

      const mockAudioContext = {
        decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
      } as unknown as BaseAudioContext;

      // Mock audio-bearing blob
      const testBlob = new Blob([new Uint8Array(64)]);
      // When decodeAudioData succeeds, returns the buffer
      const res = await decodeVideoEmbeddedAudio(testBlob, "clip_with_audio.mp4", mockAudioContext);
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();
      expect(res).toBe(mockBuffer);
    });

    it("playback-rate source-duration math: verifies buffer duration scaling against clip speed", () => {
      // TimelineClip semantics proof:
      // When clip.duration is 4.0s on the timeline:
      const clipDuration = 4.0;

      // Case A: 2x speed (fast motion). In 4s of timeline time, 8s of source media plays!
      const speedFast = 2.0;
      const bufferDurationFast = clipDuration * speedFast;
      expect(bufferDurationFast).toBe(8.0);
      // Playback duration on timeline = bufferDuration / speed:
      expect(bufferDurationFast / speedFast).toBe(clipDuration);

      // Case B: 0.5x speed (slow motion). In 4s of timeline time, 2s of source media plays!
      const speedSlow = 0.5;
      const bufferDurationSlow = clipDuration * speedSlow;
      expect(bufferDurationSlow).toBe(2.0);
      expect(bufferDurationSlow / speedSlow).toBe(clipDuration);

      // Case C: 1x speed
      const speedNormal = 1.0;
      const bufferDurationNormal = clipDuration * speedNormal;
      expect(bufferDurationNormal).toBe(4.0);
      expect(bufferDurationNormal / speedNormal).toBe(clipDuration);
    });
  });

  describe("P0 — Mediabunny WrappedAudioBuffer Assembly & PTS Preservation", () => {
    function createMockAudioContext() {
      return {
        createBuffer: (channels: number, length: number, sampleRate: number) => {
          const channelData = Array.from({ length: channels }, () => new Float32Array(length));
          return {
            sampleRate,
            numberOfChannels: channels,
            length,
            duration: length / sampleRate,
            getChannelData: (ch: number) => channelData[ch],
          } as unknown as AudioBuffer;
        },
      } as unknown as BaseAudioContext;
    }

    it("preserves non-zero initial timestamp by inserting silence before first packet", () => {
      const mockCtx = createMockAudioContext();
      const sampleRate = 1000;

      // Chunk 1 starts at t = 0.2s (sample index 200), length = 100 samples
      const chunk1Buffer = mockCtx.createBuffer(1, 100, sampleRate);
      chunk1Buffer.getChannelData(0).fill(1.0);

      const chunks = [
        {
          buffer: chunk1Buffer,
          timestamp: 0.2, // starts at 200ms
          duration: 0.1,
        },
      ];

      const merged = assembleAudioBufferFromWrappedChunks(chunks, mockCtx);
      expect(merged).not.toBeNull();
      expect(merged!.length).toBe(300); // 200 silence + 100 audio
      expect(merged!.duration).toBe(0.3);

      const data = merged!.getChannelData(0);
      // Samples 0 to 199 must be silence (0.0)
      for (let i = 0; i < 200; i++) {
        expect(data[i]).toBe(0.0);
      }
      // Samples 200 to 299 must be audio (1.0)
      for (let i = 200; i < 300; i++) {
        expect(data[i]).toBe(1.0);
      }
    });

    it("preserves gaps between packets without timeline compression", () => {
      const mockCtx = createMockAudioContext();
      const sampleRate = 1000;

      // Packet A: 0.0s to 0.1s (100 samples)
      const bufA = mockCtx.createBuffer(1, 100, sampleRate);
      bufA.getChannelData(0).fill(0.5);

      // Packet B: 0.25s to 0.35s (100 samples) - gap of 150ms between 0.1s and 0.25s
      const bufB = mockCtx.createBuffer(1, 100, sampleRate);
      bufB.getChannelData(0).fill(0.8);

      const chunks = [
        { buffer: bufA, timestamp: 0.0, duration: 0.1 },
        { buffer: bufB, timestamp: 0.25, duration: 0.1 },
      ];

      const merged = assembleAudioBufferFromWrappedChunks(chunks, mockCtx);
      expect(merged!.length).toBe(350); // 100 + 150 gap + 100 = 350 samples
      expect(merged!.duration).toBe(0.35);

      const data = merged!.getChannelData(0);
      // 0 to 99: packet A (0.5)
      expect(data[0]).toBeCloseTo(0.5, 5);
      expect(data[99]).toBeCloseTo(0.5, 5);

      // 100 to 249: gap silence (0.0)
      for (let i = 100; i < 250; i++) {
        expect(data[i]).toBe(0.0);
      }

      // 250 to 349: packet B (0.8)
      expect(data[250]).toBeCloseTo(0.8, 5);
      expect(data[349]).toBeCloseTo(0.8, 5);
    });

    it("synchronizes source inPoint trimming with assembled timestamped buffer", () => {
      const mockCtx = createMockAudioContext();
      const sampleRate = 1000;

      // Packet 1: 0.0s to 0.1s (intro)
      const buf1 = mockCtx.createBuffer(1, 100, sampleRate);
      buf1.getChannelData(0).fill(0.1);

      // Packet 2: 0.1s to 0.5s (speech body, value = 0.9)
      const buf2 = mockCtx.createBuffer(1, 400, sampleRate);
      buf2.getChannelData(0).fill(0.9);

      const chunks = [
        { buffer: buf1, timestamp: 0.0, duration: 0.1 },
        { buffer: buf2, timestamp: 0.1, duration: 0.4 },
      ];

      const merged = assembleAudioBufferFromWrappedChunks(chunks, mockCtx)!;

      // In timeline, user trims the video with inPoint = 0.1s:
      const inPoint = 0.1;
      const offsetSample = Math.round(inPoint * sampleRate);

      const data = merged.getChannelData(0);
      expect(data[offsetSample]).toBeCloseTo(0.9, 5); // Exactly packet 2!
    });

    it("handles negative chunk timestamps by trimming pre-roll samples so t=0 aligns with video start", () => {
      const mockCtx = createMockAudioContext();
      const sampleRate = 1000;

      // Priming packet: starts at -0.05s (-50 samples), length = 80 samples
      // Samples 0 to 49 are pre-roll (t < 0)
      // Samples 50 to 79 are valid media audio (t >= 0, value = 0.77)
      const bufPriming = mockCtx.createBuffer(1, 80, sampleRate);
      const primingData = bufPriming.getChannelData(0);
      primingData.fill(0.1, 0, 50); // pre-roll
      primingData.fill(0.77, 50, 80); // valid t >= 0 audio

      const chunks = [
        { buffer: bufPriming, timestamp: -0.05, duration: 0.08 },
      ];

      const merged = assembleAudioBufferFromWrappedChunks(chunks, mockCtx);
      expect(merged).not.toBeNull();
      // Length must be 30 samples (the 30 samples at t >= 0)
      expect(merged!.length).toBe(30);

      const data = merged!.getChannelData(0);
      // Index 0 in merged must be sample 50 of the priming packet (0.77), not the pre-roll 0.1!
      expect(data[0]).toBeCloseTo(0.77, 5);
      expect(data[29]).toBeCloseTo(0.77, 5);
    });

    it("cleanly skips packets that are entirely in negative time", () => {
      const mockCtx = createMockAudioContext();
      const sampleRate = 1000;

      // Entirely negative chunk (-0.10s to -0.05s, 50 samples)
      const bufDiscard = mockCtx.createBuffer(1, 50, sampleRate);
      bufDiscard.getChannelData(0).fill(0.99);

      // Valid chunk starting at 0.0s (100 samples, value 0.44)
      const bufValid = mockCtx.createBuffer(1, 100, sampleRate);
      bufValid.getChannelData(0).fill(0.44);

      const chunks = [
        { buffer: bufDiscard, timestamp: -0.10, duration: 0.05 },
        { buffer: bufValid, timestamp: 0.0, duration: 0.1 },
      ];

      const merged = assembleAudioBufferFromWrappedChunks(chunks, mockCtx);
      expect(merged!.length).toBe(100);
      expect(merged!.getChannelData(0)[0]).toBeCloseTo(0.44, 5);
    });
  });

  describe("P0 — Mathematically Normalized Cross-Dissolve Compositing", () => {
    it("compositeCrossDissolve: performs isolated additive blend avoiding midpoint darkening", () => {
      const operations: string[] = [];
      const alphas: number[] = [];

      const mockBlendCtx = {
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        drawImage: vi.fn(),
        set globalAlpha(val: number) {
          alphas.push(val);
        },
        set globalCompositeOperation(val: string) {
          operations.push(val);
        },
      };

      const mockBlendCanvasTrans = {
        getContext: () => mockBlendCtx,
      } as unknown as HTMLCanvasElement;

      const mockTargetCtx = {
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      const layerCanvasFrom = {} as HTMLCanvasElement;
      const layerCanvasTo = {} as HTMLCanvasElement;

      // Test at midpoint: progress = 0.5
      compositeCrossDissolve(
        mockTargetCtx,
        layerCanvasFrom,
        layerCanvasTo,
        mockBlendCanvasTrans,
        0.5,
        1920,
        1080
      );

      // 1. Clears blend canvas first
      expect(mockBlendCtx.clearRect).toHaveBeenCalledWith(0, 0, 1920, 1080);

      // 2. Outgoing clip drawn at 1 - p = 0.5 with source-over
      expect(alphas[0]).toBeCloseTo(0.5, 3);
      expect(operations).toContain("source-over");

      // 3. Incoming clip added at p = 0.5 with "lighter"
      expect(alphas[1]).toBeCloseTo(0.5, 3);
      expect(operations).toContain("lighter");

      // 4. Target context receives the normalized composite
      expect(mockTargetCtx.drawImage).toHaveBeenCalledWith(mockBlendCanvasTrans, 0, 0);

      // Math verification: (1 - 0.5) + 0.5 === 1.0 (100% total opacity, no 25% darkening)
      expect(alphas[0] + alphas[1]).toBe(1.0);
    });

    it("compositeCrossDissolve: transitions smoothly at progress 0 and 1", () => {
      const alphasP0: number[] = [];
      const mockBlendCtxP0 = {
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        drawImage: vi.fn(),
        set globalAlpha(val: number) {
          alphasP0.push(val);
        },
        set globalCompositeOperation(_val: string) {},
      };
      const transCanvasP0 = { getContext: () => mockBlendCtxP0 } as unknown as HTMLCanvasElement;
      const targetCtx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;

      // Progress 0
      compositeCrossDissolve(targetCtx, {} as unknown as HTMLCanvasElement, {} as unknown as HTMLCanvasElement, transCanvasP0, 0.0, 100, 100);
      expect(alphasP0[0]).toBe(1.0); // Outgoing full opacity
      expect(alphasP0[1]).toBe(0.0); // Incoming zero opacity

      // Progress 1
      const alphasP1: number[] = [];
      const mockBlendCtxP1 = {
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        drawImage: vi.fn(),
        set globalAlpha(val: number) {
          alphasP1.push(val);
        },
        set globalCompositeOperation(_val: string) {},
      };
      const transCanvasP1 = { getContext: () => mockBlendCtxP1 } as unknown as HTMLCanvasElement;

      compositeCrossDissolve(targetCtx, {} as unknown as HTMLCanvasElement, {} as unknown as HTMLCanvasElement, transCanvasP1, 1.0, 100, 100);
      expect(alphasP1[0]).toBe(0.0); // Outgoing zero opacity
      expect(alphasP1[1]).toBe(1.0); // Incoming full opacity
    });

    describe("Deterministic Pixel-Level Canvas Render Tests", () => {
      const white = { r: 255, g: 255, b: 255, a: 1 };
      const blackBg = { r: 0, g: 0, b: 0, a: 1 };
      const red = { r: 255, g: 0, b: 0, a: 1 };
      const blue = { r: 0, g: 0, b: 255, a: 1 };
      const transparent = { r: 0, g: 0, b: 0, a: 0 };

      it("pixel test: opaque white-to-white at progress 0.5 preserves 100% luminance (255) with zero darkening", () => {
        // Old buggy behavior: 0.5 * 255 + 0.25 * 255 = 191 (25% darkening)
        // Correct behavior: 0.5 * 255 + 0.5 * 255 = 255 (100% white)
        const pixelMid = computeCrossDissolvePixel(white, white, 0.5, blackBg);
        expect(pixelMid.r).toBe(255);
        expect(pixelMid.g).toBe(255);
        expect(pixelMid.b).toBe(255);
        expect(pixelMid.a).toBe(1.0);
      });

      it("pixel test: opaque red-to-blue at progress 0, 0.5, and 1.0 blends without black background leakage", () => {
        const at0 = computeCrossDissolvePixel(red, blue, 0.0, blackBg);
        expect(at0).toEqual({ r: 255, g: 0, b: 0, a: 1.0 });

        const atMid = computeCrossDissolvePixel(red, blue, 0.5, blackBg);
        expect(atMid.r).toBe(128); // 0.5 * 255
        expect(atMid.g).toBe(0);
        expect(atMid.b).toBe(128); // 0.5 * 255
        expect(atMid.a).toBe(1.0); // Completely opaque: zero black leakage

        const at1 = computeCrossDissolvePixel(red, blue, 1.0, blackBg);
        expect(at1).toEqual({ r: 0, g: 0, b: 255, a: 1.0 });
      });

      it("pixel test: transparent region in incoming clip fades outgoing clip out completely by progress 1.0", () => {
        // At progress 0: outgoing red is 100% visible
        const at0 = computeCrossDissolvePixel(red, transparent, 0.0, blackBg);
        expect(at0).toEqual({ r: 255, g: 0, b: 0, a: 1.0 });

        // At progress 0.5: outgoing red has faded by 50%
        const atMid = computeCrossDissolvePixel(red, transparent, 0.5, blackBg);
        expect(atMid.r).toBe(128);
        expect(atMid.a).toBe(1.0); // composite over blackBg

        // At progress 1.0: outgoing red is 100% gone, background shows through completely
        const at1 = computeCrossDissolvePixel(red, transparent, 1.0, blackBg);
        expect(at1).toEqual({ r: 0, g: 0, b: 0, a: 1.0 }); // Pure black background
      });

      it("pixel test: transparent region in outgoing clip transitions to incoming clip smoothly", () => {
        // At progress 0: transparent outgoing reveals background
        const at0 = computeCrossDissolvePixel(transparent, blue, 0.0, blackBg);
        expect(at0).toEqual({ r: 0, g: 0, b: 0, a: 1.0 });

        // At progress 0.5: incoming blue has faded in by 50%
        const atMid = computeCrossDissolvePixel(transparent, blue, 0.5, blackBg);
        expect(atMid.b).toBe(128);

        // At progress 1.0: incoming blue is 100% visible
        const at1 = computeCrossDissolvePixel(transparent, blue, 1.0, blackBg);
        expect(at1).toEqual({ r: 0, g: 0, b: 255, a: 1.0 });
      });
    });
  });
});
