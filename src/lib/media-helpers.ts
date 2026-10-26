"use client";

import type { MediaCategory } from "@/lib/media-storage";

export interface MediaMetadata {
  category: MediaCategory;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  thumbnailBlob?: Blob | null;
}

const SUPPORTED_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
const SUPPORTED_VIDEO_EXTS = new Set(["mp4", "webm", "mov", "mkv", "ogg"]);
const SUPPORTED_AUDIO_EXTS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "flac"]);

/**
 * Classify a file into image, video, or audio using MIME type and fallback extension
 */
export function classifyMediaFile(file: File): MediaCategory | null {
  const mime = file.type.toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";

  // Fallback to extension check if MIME is generic (e.g. application/octet-stream)
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (SUPPORTED_IMAGE_EXTS.has(ext)) return "image";
  if (SUPPORTED_VIDEO_EXTS.has(ext)) return "video";
  if (SUPPORTED_AUDIO_EXTS.has(ext)) return "audio";

  return null;
}

/**
 * Format raw byte size into human readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format duration in seconds to MM:SS or M:SS
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Extract dimensional metadata from an Image Blob
 */
async function extractImageMetadata(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

/**
 * Extract duration from an Audio Blob
 */
async function extractAudioMetadata(blob: Blob): Promise<{ duration: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";

    audio.onloadedmetadata = () => {
      const duration = audio.duration || 0;
      URL.revokeObjectURL(url);
      resolve({ duration });
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: 0 });
    };

    audio.src = url;
  });
}

/**
 * Extract duration, resolution, and generate thumbnail frame from a Video Blob
 */
async function extractVideoMetadata(blob: Blob): Promise<{
  width: number;
  height: number;
  duration: number;
  thumbnailBlob: Blob | null;
}> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    // Timeout safety in case video is corrupt
    const timeoutTimer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0, duration: 0, thumbnailBlob: null });
    }, 5000);

    video.onloadedmetadata = () => {
      const duration = video.duration || 0;

      // Seek slightly into the video to capture an informative frame (e.g. 0.2s)
      const seekTime = Math.min(0.2, duration > 0 ? duration / 2 : 0);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      clearTimeout(timeoutTimer);
      try {
        const canvas = document.createElement("canvas");
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 180;

        // Scale thumbnail down to max 320px width to keep DB light
        const scale = Math.min(1, 320 / w);
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (thumbBlob) => {
              URL.revokeObjectURL(url);
              resolve({
                width: video.videoWidth,
                height: video.videoHeight,
                duration: video.duration,
                thumbnailBlob: thumbBlob,
              });
            },
            "image/jpeg",
            0.8
          );
          return;
        }
      } catch {
        // In case of cross-origin or canvas security issue
      }

      URL.revokeObjectURL(url);
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        thumbnailBlob: null,
      });
    };

    video.onerror = () => {
      clearTimeout(timeoutTimer);
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0, duration: 0, thumbnailBlob: null });
    };

    video.src = url;
  });
}

/**
 * Unified metadata extraction router for any supported media file
 */
export async function extractMediaMetadata(file: File, category: MediaCategory): Promise<MediaMetadata> {
  if (category === "image") {
    const meta = await extractImageMetadata(file);
    return {
      category: "image",
      width: meta.width,
      height: meta.height,
    };
  }

  if (category === "audio") {
    const meta = await extractAudioMetadata(file);
    return {
      category: "audio",
      duration: meta.duration,
    };
  }

  if (category === "video") {
    const meta = await extractVideoMetadata(file);
    return {
      category: "video",
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
      thumbnailBlob: meta.thumbnailBlob,
    };
  }

  return { category };
}
