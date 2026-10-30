"use client";

// Weakly keyed by the source Blob so equal-sized audio files never share the wrong
// waveform, and cached peaks are released when the media asset is removed.
const waveformCache = new WeakMap<Blob, Map<number, number[]>>();

function getCachedWaveform(blob: Blob, numPeaks: number): number[] | undefined {
  return waveformCache.get(blob)?.get(numPeaks);
}

function cacheWaveform(blob: Blob, numPeaks: number, peaks: number[]): number[] {
  let variants = waveformCache.get(blob);
  if (!variants) {
    variants = new Map<number, number[]>();
    waveformCache.set(blob, variants);
  }
  variants.set(numPeaks, peaks);
  return peaks;
}

/** Extract real normalized amplitude peaks (0.0 to 1.0) from an audio Blob. */
export async function extractWaveformPeaks(
  blob: Blob,
  numPeaks: number = 64
): Promise<number[]> {
  const binCount = Math.max(1, Math.floor(numPeaks));
  const cached = getCachedWaveform(blob, binCount);
  if (cached) return cached;

  const silentWaveform = () => cacheWaveform(blob, binCount, Array(binCount).fill(0));

  if (
    typeof window === "undefined" ||
    (typeof window.AudioContext === "undefined" &&
      typeof (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext === "undefined")
  ) {
    return silentWaveform();
  }

  let audioCtx: AudioContext | undefined;
  try {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtxClass();
    const audioBuffer = await audioCtx.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) =>
      audioBuffer.getChannelData(channel)
    );
    const totalFrames = audioBuffer.length;
    const peaks: number[] = [];
    let maxPeak = 0;

    for (let bin = 0; bin < binCount; bin++) {
      const start = Math.floor((totalFrames * bin) / binCount);
      const end = Math.max(start + 1, Math.floor((totalFrames * (bin + 1)) / binCount));
      let blockPeak = 0;
      let sumSquares = 0;
      let frameCount = 0;

      for (let frame = start; frame < Math.min(end, totalFrames); frame++) {
        let framePeak = 0;
        for (const channel of channels) {
          framePeak = Math.max(framePeak, Math.abs(channel[frame] ?? 0));
        }
        blockPeak = Math.max(blockPeak, framePeak);
        sumSquares += framePeak * framePeak;
        frameCount++;
      }

      const rms = frameCount > 0 ? Math.sqrt(sumSquares / frameCount) : 0;
      const amplitude = blockPeak * 0.85 + rms * 0.15;
      peaks.push(amplitude);
      maxPeak = Math.max(maxPeak, amplitude);
    }

    const normalized = peaks.map((peak) => (maxPeak > 0 ? peak / maxPeak : 0));
    return cacheWaveform(blob, binCount, normalized);
  } catch (error) {
    console.warn("Unable to decode audio for waveform display:", error);
    // Do not invent a fake waveform: a flat line is more honest than random bars.
    return silentWaveform();
  } finally {
    if (audioCtx && audioCtx.state !== "closed") {
      await audioCtx.close().catch(() => undefined);
    }
  }
}
