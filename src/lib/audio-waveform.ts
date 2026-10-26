"use client";

// In-memory cache for decoded waveform peaks to avoid redundant audio decoding
const waveformCache = new Map<string, number[]>();

/**
 * Generate a cache key for a blob
 */
function getBlobKey(blob: Blob): string {
  return `${blob.size}_${blob.type}_${(blob as File).lastModified || 0}`;
}

/**
 * Fallback procedural waveform peaks in case audio decoding fails or codec is unsupported
 */
function generateFallbackPeaks(numPeaks: number): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < numPeaks; i++) {
    const norm = i / numPeaks;
    // Gentle natural voice-like envelope
    const envelope = Math.sin(norm * Math.PI);
    const noise = 0.3 + 0.7 * Math.abs(Math.sin(i * 12.5) * Math.cos(i * 3.7));
    peaks.push(Math.max(0.15, Math.min(1.0, envelope * noise)));
  }
  return peaks;
}

/**
 * Extract normalized waveform peaks (0.0 to 1.0) from an audio Blob using client-side Web Audio API
 */
export async function extractWaveformPeaks(
  blob: Blob,
  numPeaks: number = 64
): Promise<number[]> {
  const cacheKey = getBlobKey(blob);
  if (waveformCache.has(cacheKey)) {
    return waveformCache.get(cacheKey)!;
  }

  // Safety check for browser environment
  if (typeof window === "undefined" || (typeof window.AudioContext === "undefined" && typeof (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext === "undefined")) {
    return generateFallbackPeaks(numPeaks);
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtxClass();

    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const rawData = audioBuffer.getChannelData(0); // Left channel or mono
      const totalSamples = rawData.length;
      const blockSize = Math.floor(totalSamples / numPeaks);
      const peaks: number[] = [];

      let maxPeak = 0;
      for (let i = 0; i < numPeaks; i++) {
        const start = i * blockSize;
        let sum = 0;
        let blockMax = 0;

        for (let j = 0; j < blockSize; j++) {
          const val = Math.abs(rawData[start + j] || 0);
          if (val > blockMax) blockMax = val;
          sum += val;
        }

        const avg = sum / blockSize;
        // Blend peak and average for smoother aesthetic visualization
        const combined = blockMax * 0.7 + avg * 0.3;
        peaks.push(combined);
        if (combined > maxPeak) maxPeak = combined;
      }

      // Normalize peaks against maximum amplitude
      const normalized = peaks.map((p) => (maxPeak > 0 ? Math.max(0.1, p / maxPeak) : 0.2));
      waveformCache.set(cacheKey, normalized);
      return normalized;
    } finally {
      // Close context to release system audio handles
      if (audioCtx.state !== "closed") {
        await audioCtx.close();
      }
    }
  } catch (err) {
    console.warn("Waveform extraction failed, using procedural fallback:", err);
    const fallback = generateFallbackPeaks(numPeaks);
    waveformCache.set(cacheKey, fallback);
    return fallback;
  }
}
