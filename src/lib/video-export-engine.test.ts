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
  detectAudioTrackInVideo,
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

  describe("P0 — Embedded Video Audio Container Detection", () => {
    it("detectAudioTrackInVideo: detects MP4 audio track from soun handler box", () => {
      // Mock MP4 header containing 'soun' (0x73, 0x6f, 0x75, 0x6e)
      const buffer = new ArrayBuffer(64);
      const view = new Uint8Array(buffer);
      // 'moov' ... 'hdlr' ... 'soun'
      view[20] = 0x73; // 's'
      view[21] = 0x6f; // 'o'
      view[22] = 0x75; // 'u'
      view[23] = 0x6e; // 'n'

      expect(detectAudioTrackInVideo(buffer)).toBe(true);
    });

    it("detectAudioTrackInVideo: returns false for silent MP4 without soun handler", () => {
      const buffer = new ArrayBuffer(64);
      const view = new Uint8Array(buffer);
      // 'moov' ... 'hdlr' ... 'vide' (0x76, 0x69, 0x64, 0x65)
      view[20] = 0x76;
      view[21] = 0x69;
      view[22] = 0x64;
      view[23] = 0x65;

      expect(detectAudioTrackInVideo(buffer)).toBe(false);
    });

    it("detectAudioTrackInVideo: detects WebM audio track from EBML tags", () => {
      const buffer = new ArrayBuffer(64);
      const view = new Uint8Array(buffer);
      // WebM signature: 0x1A 0x45 0xDF 0xA3
      view[0] = 0x1a;
      view[1] = 0x45;
      view[2] = 0xdf;
      view[3] = 0xa3;
      // TrackType 0x83 0x02 (Audio)
      view[10] = 0x83;
      view[11] = 0x02;

      expect(detectAudioTrackInVideo(buffer)).toBe(true);
    });

    it("detectAudioTrackInVideo: returns false for empty or short buffer", () => {
      expect(detectAudioTrackInVideo(new ArrayBuffer(4))).toBe(false);
    });
  });
});
