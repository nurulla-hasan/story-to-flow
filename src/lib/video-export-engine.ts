"use client";

import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import {
  type TimelineClip,
  type TimelineTransition,
  isVisualTrack,
  isAudioTrack,
  getVisualTrackLayerIndex,
} from "../types/timeline";
import type { MediaAssetItem } from "./media-storage";
import { getTransitionProgress } from "./transition-helpers";
import { calculateCanvasDrawParams } from "./clip-transform";

export const MAX_SAFE_EXPORT_DURATION = 300; // 5 minutes max safe browser export duration
export const MAX_VIDEO_QUEUE_SIZE = 5; // Conservative max pending frames in GPU/RAM encoder queue
export const MAX_AUDIO_QUEUE_SIZE = 10; // Conservative max pending audio chunks in encoder queue

export interface ExportOptions {
  width: number; // 720 (default) or 1080
  height: number; // 1280 (default) or 1920
  fps?: number; // default 30
  bitrate?: number; // default 2_500_000 (720p) or 5_000_000 (1080p)
}

export interface ExportProgress {
  phase: "preparing" | "rendering" | "encoding_audio" | "muxing" | "complete";
  currentFrame: number;
  totalFrames: number;
  percent: number;
  message: string;
}

/**
 * Sanitize a project title to form a clean, safe filename
 */
export function sanitizeFilename(title: string): string {
  return (
    title
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s-]+/g, "_")
      .substring(0, 50) || "Story_Video"
  );
}

/**
 * Check if the browser environment supports WebCodecs video encoding
 */
export function checkWebCodecsSupport(): { supported: boolean; reason?: string } {
  if (typeof window === "undefined") {
    return {
      supported: false,
      reason: "WebCodecs is only available in a browser environment.",
    };
  }

  const hasVideoEncoder = typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder !== "undefined";
  const hasVideoFrame = typeof (window as unknown as { VideoFrame?: unknown }).VideoFrame !== "undefined";

  if (!hasVideoEncoder || !hasVideoFrame) {
    return {
      supported: false,
      reason:
        "Your browser does not support WebCodecs (VideoEncoder). Please use modern Google Chrome, Microsoft Edge, Safari 16.4+, or Firefox 130+.",
    };
  }

  return { supported: true };
}

/**
 * Calculate the timeline duration and total frames required for export
 */
export function calculateExportPlan(
  clips: TimelineClip[],
  fps: number = 30
): {
  totalDuration: number;
  totalFrames: number;
  visualClipsCount: number;
  audioClipsCount: number;
} {
  if (clips.length === 0) {
    return { totalDuration: 0, totalFrames: 0, visualClipsCount: 0, audioClipsCount: 0 };
  }
  const maxEnd = Math.max(...clips.map((c) => c.startTime + c.duration));
  const totalFrames = Math.ceil(maxEnd * fps);
  return {
    totalDuration: maxEnd,
    totalFrames,
    visualClipsCount: clips.filter((c) => isVisualTrack(c.trackId)).length,
    audioClipsCount: clips.filter((c) => isAudioTrack(c.trackId)).length,
  };
}

/**
 * Preflight memory and duration safety check before starting render
 */
export function validateExportSafety(
  plan: { totalDuration: number; totalFrames: number },
  options: ExportOptions
): { safe: boolean; warning?: string; error?: string } {
  if (plan.totalDuration <= 0) {
    return { safe: false, error: "Timeline has no media clips to export." };
  }

  if (plan.totalDuration > MAX_SAFE_EXPORT_DURATION) {
    return {
      safe: false,
      error: `Project duration (${plan.totalDuration.toFixed(1)}s) exceeds the safe browser limit (${MAX_SAFE_EXPORT_DURATION}s / 5 minutes). Please shorten your timeline for in-browser export.`,
    };
  }

  if (options.width >= 1080 && plan.totalDuration > 120) {
    return {
      safe: true,
      warning: `Exporting ${plan.totalDuration.toFixed(1)}s at 1080p requires significant memory and GPU resources. 720p is recommended for longer projects.`,
    };
  }

  return { safe: true };
}

/**
 * Bounded queue backpressure helper for WebCodecs VideoEncoder and AudioEncoder.
 * Waits when pending queue exceeds maxQueue; wakes up when queue drains, on error, or abort.
 */
export async function waitForEncoderQueue(
  encoder: { encodeQueueSize: number; ondequeue: ((ev: Event) => unknown) | null },
  maxQueue: number = MAX_VIDEO_QUEUE_SIZE,
  signal?: AbortSignal,
  checkErrors?: () => Error | null
): Promise<void> {
  const initialErr = checkErrors?.();
  if (initialErr) throw initialErr;
  if (signal?.aborted) throw new Error("Export cancelled by user");

  if (encoder.encodeQueueSize < maxQueue) {
    return;
  }

  return new Promise<void>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      encoder.ondequeue = null;
      if (timeoutId) clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(new Error("Export cancelled by user"));
    };

    const check = () => {
      const err = checkErrors?.();
      if (err) {
        cleanup();
        reject(err);
        return;
      }

      if (signal?.aborted) {
        cleanup();
        reject(new Error("Export cancelled by user"));
        return;
      }

      if (encoder.encodeQueueSize < maxQueue) {
        cleanup();
        resolve();
      }
    };

    encoder.ondequeue = check;
    signal?.addEventListener("abort", onAbort, { once: true });

    // 4000ms safety timeout to prevent hanging indefinitely if hardware encoder stalls
    timeoutId = setTimeout(() => {
      cleanup();
      const currentErr = checkErrors?.();
      if (currentErr) {
        reject(currentErr);
      } else if (signal?.aborted) {
        reject(new Error("Export cancelled by user"));
      } else if (encoder.encodeQueueSize >= maxQueue) {
        reject(
          new Error(
            `Encoder stalled: queue failed to drain below ${maxQueue} within 4000ms (${encoder.encodeQueueSize} pending).`
          )
        );
      } else {
        resolve();
      }
    }, 4000);
  });
}

/**
 * Preload HTMLImageElement from Object URL with abort support
 */
function preloadImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Export cancelled by user"));
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      img.src = "";
      reject(new Error("Export cancelled by user"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = () => {
      cleanup();
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });
}

/**
 * Seek HTMLVideoElement with safe timeout, error handling, and abort signal to prevent freezing
 */
function seekVideoElement(
  video: HTMLVideoElement,
  time: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Export cancelled by user"));
      return;
    }

    if (Math.abs(video.currentTime - time) < 0.05) {
      resolve();
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      if (timer) clearTimeout(timer);
    };

    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      resolve(); // Proceed gracefully with current frame rather than hanging
    };

    const onAbort = () => {
      cleanup();
      reject(new Error("Export cancelled by user"));
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });

    // 1500ms max seek wait to prevent deadlock
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, 1500);

    try {
      video.currentTime = Math.max(0, time);
    } catch {
      cleanup();
      resolve();
    }
  });
}

/**
 * Render the entire timeline frame-by-frame and mux into an MP4 file with bounded backpressure.
 */
export async function exportTimelineToMp4({
  clips,
  transitions = [],
  assets,
  options,
  onProgress,
  signal,
}: {
  clips: TimelineClip[];
  transitions?: TimelineTransition[];
  assets: MediaAssetItem[];
  options: ExportOptions;
  onProgress: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const { supported, reason } = checkWebCodecsSupport();
  if (!supported) {
    throw new Error(reason || "WebCodecs is not supported in this browser.");
  }

  // Enforce 720p as default safe resolution if width is not provided
  const width = options.width || 720;
  const height = options.height || 1280;
  const fps = options.fps || 30;
  const bitrate = options.bitrate || (width >= 1080 ? 5_000_000 : 2_500_000);

  const plan = calculateExportPlan(clips, fps);
  const safety = validateExportSafety(plan, { width, height });
  if (!safety.safe) {
    throw new Error(safety.error || "Timeline is invalid or exceeds safe export limits.");
  }

  const visualClips = clips.filter((c) => isVisualTrack(c.trackId));
  const audioClips = clips.filter((c) => isAudioTrack(c.trackId));
  const hasAudio =
    audioClips.length > 0 &&
    typeof (window as unknown as { AudioEncoder?: unknown }).AudioEncoder !== "undefined";

  onProgress({
    phase: "preparing",
    currentFrame: 0,
    totalFrames: plan.totalFrames,
    percent: 0,
    message: "Preloading media assets...",
  });

  // Preload visual image and video elements
  const imageElements = new Map<string, HTMLImageElement>();
  const videoElements = new Map<string, HTMLVideoElement>();
  const canvas = document.createElement("canvas");
  let videoEncoder: VideoEncoder | null = null;
  let audioEncoder: AudioEncoder | null = null;

  try {
    for (const clip of visualClips) {
      if (signal?.aborted) throw new Error("Export cancelled by user");

      const asset = assets.find((a) => a.id === clip.assetId);
      if (!asset) continue;

      if (asset.category === "image" && !imageElements.has(asset.id)) {
        try {
          const img = await preloadImage(asset.url, signal);
          imageElements.set(asset.id, img);
        } catch (err) {
          if (signal?.aborted) throw err;
          console.warn(`Could not preload image ${asset.name}:`, err);
        }
      } else if (asset.category === "video" && !videoElements.has(asset.id)) {
        const vid = document.createElement("video");
        vid.crossOrigin = "anonymous";
        vid.src = asset.url;
        vid.muted = true;
        vid.playsInline = true;
        videoElements.set(asset.id, vid);
      }
    }

    // Setup Canvas for composition
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Failed to get 2D rendering context for video canvas.");

    // Setup MP4 Muxer with fastStart: false to prevent caching all chunks in duplicate RAM arrays
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: "avc",
        width,
        height,
      },
      audio: hasAudio
        ? {
            codec: "aac",
            numberOfChannels: 2,
            sampleRate: 48000,
          }
        : undefined,
      fastStart: false,
      firstTimestampBehavior: "offset",
    });

    // Error trackers that propagate failures properly instead of swallowing
    let videoEncoderError: Error | null = null;
    let audioEncoderError: Error | null = null;
    let muxerError: Error | null = null;

    const checkAllErrors = (): Error | null => {
      return videoEncoderError || audioEncoderError || muxerError;
    };

    // Setup VideoEncoder
    videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          muxer.addVideoChunk(chunk, meta);
        } catch (err) {
          muxerError = err instanceof Error ? err : new Error(String(err));
        }
      },
      error: (e) => {
        console.error("VideoEncoder error:", e);
        videoEncoderError = new Error(e.message || "VideoEncoder failed");
      },
    });

    videoEncoder.configure({
      codec: "avc1.4d002a", // H.264 Main Profile Level 4.2
      width,
      height,
      bitrate,
      framerate: fps,
    });
    // 1. VISUAL FRAME RENDERING LOOP WITH BOUNDED BACKPRESSURE
    for (let i = 0; i < plan.totalFrames; i++) {
      if (signal?.aborted) throw new Error("Export cancelled by user");
      const currentErr = checkAllErrors();
      if (currentErr) throw currentErr;

      // BOUNDED BACKPRESSURE: Wait if encoder queue reaches MAX_VIDEO_QUEUE_SIZE
      await waitForEncoderQueue(
        videoEncoder,
        MAX_VIDEO_QUEUE_SIZE,
        signal,
        checkAllErrors
      );

      const currentTime = i / fps;

      // Draw background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const drawClip = async (clip: TimelineClip, alpha: number = 1.0, xOffset: number = 0) => {
        const asset = assets.find((a) => a.id === clip.assetId);
        if (!asset) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

        if (asset.category === "image") {
          const img = imageElements.get(asset.id);
          if (img) {
            const imgW = img.naturalWidth || img.width;
            const imgH = img.naturalHeight || img.height;
            const { dw, dh, centerX, centerY, rotation } = calculateCanvasDrawParams({
              imgWidth: imgW,
              imgHeight: imgH,
              canvasWidth: width,
              canvasHeight: height,
              transform: clip.transform,
              xOffset,
            });
            ctx.translate(centerX, centerY);
            if (rotation) {
              ctx.rotate((rotation * Math.PI) / 180);
            }
            ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
          }
        } else if (asset.category === "video") {
          const vid = videoElements.get(asset.id);
          if (vid) {
            const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
            const videoTime = (currentTime - clip.startTime) * speed + clip.inPoint;
            await seekVideoElement(vid, videoTime, signal);
            const vidW = vid.videoWidth || width;
            const vidH = vid.videoHeight || height;
            const { dw, dh, centerX, centerY, rotation } = calculateCanvasDrawParams({
              imgWidth: vidW,
              imgHeight: vidH,
              canvasWidth: width,
              canvasHeight: height,
              transform: clip.transform,
              xOffset,
            });
            ctx.translate(centerX, centerY);
            if (rotation) {
              ctx.rotate((rotation * Math.PI) / 180);
            }
            ctx.drawImage(vid, -dw / 2, -dh / 2, dw, dh);
          }
        }

        ctx.restore();
      };

      // Check if an active transition is currently taking effect at currentTime
      let activeTransitionData: {
        transition: TimelineTransition;
        fromClip: TimelineClip;
        toClip: TimelineClip;
        progress: number;
      } | null = null;

      if (transitions && transitions.length > 0) {
        for (const trans of transitions) {
          const fromClip = visualClips.find((c) => c.id === trans.fromClipId);
          const toClip = visualClips.find((c) => c.id === trans.toClipId);
          if (!fromClip || !toClip) continue;

          const progress = getTransitionProgress(currentTime, trans, fromClip, toClip);
          if (progress !== null) {
            activeTransitionData = { transition: trans, fromClip, toClip, progress };
            break;
          }
        }
      }

      // Find all active visual clips at current frame timestamp sorted by layer z-order (lowest to highest)
      const activeVisuals = visualClips
        .filter((c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration)
        .sort((a, b) => getVisualTrackLayerIndex(a.trackId) - getVisualTrackLayerIndex(b.trackId));

      if (activeTransitionData) {
        const { transition, fromClip, toClip, progress } = activeTransitionData;
        const transitionLayerIndex = getVisualTrackLayerIndex(fromClip.trackId);

        // 1. Draw any active visual clips on tracks below the transition layer
        for (const activeClip of activeVisuals) {
          if (
            activeClip.id !== fromClip.id &&
            activeClip.id !== toClip.id &&
            getVisualTrackLayerIndex(activeClip.trackId) < transitionLayerIndex
          ) {
            await drawClip(activeClip, 1.0, 0);
          }
        }

        // 2. Draw the transition on its track layer
        if (transition.type === "cross-dissolve") {
          await drawClip(fromClip, 1 - progress, 0);
          await drawClip(toClip, progress, 0);
        } else if (transition.type === "fade-black") {
          if (progress < 0.5) {
            await drawClip(fromClip, 1 - progress * 2, 0);
          } else {
            await drawClip(toClip, (progress - 0.5) * 2, 0);
          }
        } else if (transition.type === "slide-left") {
          await drawClip(fromClip, 1, -progress * width);
          await drawClip(toClip, 1, (1 - progress) * width);
        } else if (transition.type === "slide-right") {
          await drawClip(fromClip, 1, progress * width);
          await drawClip(toClip, 1, -(1 - progress) * width);
        }

        // 3. Draw any active visual clips (e.g. overlays) on tracks above the transition layer
        for (const activeClip of activeVisuals) {
          if (
            activeClip.id !== fromClip.id &&
            activeClip.id !== toClip.id &&
            getVisualTrackLayerIndex(activeClip.trackId) > transitionLayerIndex
          ) {
            await drawClip(activeClip, 1.0, 0);
          }
        }
      } else {
        for (const activeClip of activeVisuals) {
          await drawClip(activeClip, 1.0, 0);
        }
      }

      // Construct and encode VideoFrame
      const frameTimestampUs = Math.round(i * (1_000_000 / fps));
      const videoFrame = new VideoFrame(canvas, { timestamp: frameTimestampUs });
      try {
        videoEncoder.encode(videoFrame, { keyFrame: i % (fps * 2) === 0 });
      } finally {
        videoFrame.close(); // Free GPU/RAM frame resource immediately
      }

      // Yield event loop every 3 frames to keep UI responsive
      if (i % 3 === 0 || i === plan.totalFrames - 1) {
        const percent = Math.round(((i + 1) / plan.totalFrames) * 80);
        onProgress({
          phase: "rendering",
          currentFrame: i + 1,
          totalFrames: plan.totalFrames,
          percent,
          message: `Rendering frames (${i + 1} / ${plan.totalFrames})...`,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // Flush remaining video chunks
    await videoEncoder.flush();
    if (signal?.aborted) throw new Error("Export cancelled by user");
    const postVideoErr = checkAllErrors();
    if (postVideoErr) throw postVideoErr;

    // RELEASE VIDEO-PHASE MEMORY: Video frames are completely flushed.
    // Clean up temporary video and image elements and zero canvas before audio mixing begins!
    for (const vid of videoElements.values()) {
      try {
        vid.pause();
        vid.removeAttribute("src");
        vid.load();
      } catch {}
    }
    videoElements.clear();
    imageElements.clear();
    canvas.width = 0;
    canvas.height = 0;

    // 2. AUDIO ENCODING (IF AUDIO TRACKS EXIST)
    if (hasAudio && audioClips.length > 0) {
      if (signal?.aborted) throw new Error("Export cancelled by user");

      onProgress({
        phase: "encoding_audio",
        currentFrame: plan.totalFrames,
        totalFrames: plan.totalFrames,
        percent: 85,
        message: "Compositing audio tracks...",
      });

      const sampleRate = 48000;
      const totalAudioSamples = Math.ceil(sampleRate * plan.totalDuration);
      const offlineCtx = new OfflineAudioContext(2, Math.max(128, totalAudioSamples), sampleRate);

      for (const clip of audioClips) {
        if (signal?.aborted) throw new Error("Export cancelled by user");

        const asset = assets.find((a) => a.id === clip.assetId);
        if (!asset || !asset.blob) {
          throw new Error(`Audio asset for "${clip.name}" is missing or unavailable.`);
        }

        try {
          const arrayBuffer = await asset.blob.arrayBuffer();
          const decodedBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

          const source = offlineCtx.createBufferSource();
          source.buffer = decodedBuffer;

          const gain = offlineCtx.createGain();
          const baseVol =
            typeof clip.volume === "number" ? Math.max(0, Math.min(1, clip.volume)) : 1.0;
          const fadeIn = Math.max(0, Math.min(clip.duration, clip.fadeInDuration ?? 0));
          const fadeOut = Math.max(0, Math.min(clip.duration, clip.fadeOutDuration ?? 0));

          if (fadeIn > 0) {
            gain.gain.setValueAtTime(0, clip.startTime);
            gain.gain.linearRampToValueAtTime(baseVol, clip.startTime + fadeIn);
          } else {
            gain.gain.setValueAtTime(baseVol, clip.startTime);
          }

          if (fadeOut > 0) {
            const fadeOutStart = clip.startTime + clip.duration - fadeOut;
            const holdUntil = Math.max(clip.startTime + fadeIn, fadeOutStart);
            gain.gain.setValueAtTime(baseVol, holdUntil);
            gain.gain.linearRampToValueAtTime(0, clip.startTime + clip.duration);
          }

          source.connect(gain);
          gain.connect(offlineCtx.destination);

          source.start(clip.startTime, clip.inPoint, clip.duration);
        } catch (err) {
          throw new Error(
            `Failed to decode audio track "${clip.name}": ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }

      if (signal?.aborted) throw new Error("Export cancelled by user");

      const renderedBuffer = await offlineCtx.startRendering();
      if (signal?.aborted) throw new Error("Export cancelled by user");

      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          try {
            muxer.addAudioChunk(chunk, meta);
          } catch (err) {
            muxerError = err instanceof Error ? err : new Error(String(err));
          }
        },
        error: (e) => {
          console.error("AudioEncoder error:", e);
          audioEncoderError = new Error(e.message || "AudioEncoder failed");
        },
      });

      audioEncoder.configure({
        codec: "mp4a.40.2", // AAC-LC
        numberOfChannels: 2,
        sampleRate,
        bitrate: 128_000,
      });

      const chunkSize = 1024;
      const leftChannel = renderedBuffer.getChannelData(0);
      const rightChannel =
        renderedBuffer.numberOfChannels > 1 ? renderedBuffer.getChannelData(1) : leftChannel;

      for (let offset = 0; offset < renderedBuffer.length; offset += chunkSize) {
        if (signal?.aborted) throw new Error("Export cancelled by user");
        const currentErr = checkAllErrors();
        if (currentErr) throw currentErr;

        // BOUNDED BACKPRESSURE: Wait if audio encoder queue exceeds MAX_AUDIO_QUEUE_SIZE
        await waitForEncoderQueue(
          audioEncoder,
          MAX_AUDIO_QUEUE_SIZE,
          signal,
          checkAllErrors
        );

        const currentChunkSize = Math.min(chunkSize, renderedBuffer.length - offset);
        const planarData = new Float32Array(currentChunkSize * 2);

        for (let j = 0; j < currentChunkSize; j++) {
          planarData[j] = leftChannel[offset + j] || 0;
          planarData[currentChunkSize + j] = rightChannel[offset + j] || 0;
        }

        const audioTimestampUs = Math.round((offset / sampleRate) * 1_000_000);
        const audioData = new AudioData({
          format: "f32-planar",
          sampleRate,
          numberOfFrames: currentChunkSize,
          numberOfChannels: 2,
          timestamp: audioTimestampUs,
          data: planarData,
        });

        try {
          audioEncoder.encode(audioData);
        } finally {
          audioData.close();
        }
      }

      await audioEncoder.flush();
      if (signal?.aborted) throw new Error("Export cancelled by user");
      const postAudioErr = checkAllErrors();
      if (postAudioErr) throw postAudioErr;
    }

    if (signal?.aborted) throw new Error("Export cancelled by user");
    const preMuxErr = checkAllErrors();
    if (preMuxErr) throw preMuxErr;

    // 3. FINALIZE MP4 CONTAINER
    onProgress({
      phase: "muxing",
      currentFrame: plan.totalFrames,
      totalFrames: plan.totalFrames,
      percent: 98,
      message: "Finalizing MP4 container...",
    });

    muxer.finalize();

    if (signal?.aborted) throw new Error("Export cancelled by user");
    const outputBlob = new Blob([muxer.target.buffer], { type: "video/mp4" });

    onProgress({
      phase: "complete",
      currentFrame: plan.totalFrames,
      totalFrames: plan.totalFrames,
      percent: 100,
      message: "Export complete!",
    });

    return outputBlob;
  } finally {
    // Guaranteed Resource cleanup on all exit paths (success, error, cancel)
    if (videoEncoder && videoEncoder.state !== "closed") {
      try {
        videoEncoder.close();
      } catch {}
    }
    if (audioEncoder && audioEncoder.state !== "closed") {
      try {
        audioEncoder.close();
      } catch {}
    }

    // Release temporary video elements and canvas to free GPU memory
    for (const vid of videoElements.values()) {
      try {
        vid.pause();
        vid.removeAttribute("src");
        vid.load();
      } catch {}
    }
    videoElements.clear();
    imageElements.clear();
    canvas.width = 0;
    canvas.height = 0;
  }
}
