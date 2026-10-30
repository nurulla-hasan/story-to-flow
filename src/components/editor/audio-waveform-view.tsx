"use client";

import * as React from "react";
import { extractWaveformPeaks } from "@/lib/audio-waveform";

interface AudioWaveformViewProps {
  blob: Blob | null;
  clipDuration: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

const EMPTY_WAVEFORM = "M 0 50 L 1000 50";
const EMPTY_PEAKS: number[] = [];

export function AudioWaveformView({
  blob,
  clipDuration,
  fadeInDuration = 0,
  fadeOutDuration = 0,
}: AudioWaveformViewProps) {
  const [waveform, setWaveform] = React.useState<{ source: Blob | null; peaks: number[] }>({
    source: null,
    peaks: [],
  });
  const peaks = waveform.source === blob ? waveform.peaks : EMPTY_PEAKS;

  React.useEffect(() => {
    let isMounted = true;
    if (!blob) return;

    // Decode once per source file; trimming must not trigger a fresh full-audio decode.
    extractWaveformPeaks(blob, 1400).then((nextPeaks) => {
      if (isMounted) setWaveform({ source: blob, peaks: nextPeaks });
    });

    return () => {
      isMounted = false;
    };
  }, [blob]);

  const waveformPath = React.useMemo(() => {
    if (peaks.length === 0) return EMPTY_WAVEFORM;

    const upper: string[] = [];
    const lower: string[] = [];
    const lastIndex = Math.max(1, peaks.length - 1);

    peaks.forEach((rawPeak, index) => {
      // A gentle perceptual curve makes quieter narration visible while preserving
      // the true relative amplitude: louder sections still draw taller waves.
      const amplitude = rawPeak > 0 ? Math.max(0.035, Math.pow(rawPeak, 0.65)) : 0;
      const x = (index / lastIndex) * 1000;
      const halfHeight = amplitude * 46;
      upper.push(`${x.toFixed(1)} ${(50 - halfHeight).toFixed(1)}`);
      lower.push(`${x.toFixed(1)} ${(50 + halfHeight).toFixed(1)}`);
    });

    return `M ${upper.join(" L ")} L ${lower.reverse().join(" L ")} Z`;
  }, [peaks]);

  const fadeInPercent =
    clipDuration > 0 && fadeInDuration > 0
      ? Math.min(50, (fadeInDuration / clipDuration) * 100)
      : 0;

  const fadeOutPercent =
    clipDuration > 0 && fadeOutDuration > 0
      ? Math.min(50, (fadeOutDuration / clipDuration) * 100)
      : 0;

  return (
    <div className="pointer-events-none relative h-full w-full select-none overflow-hidden">
      <svg
        className="h-full w-full text-primary opacity-90"
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={waveformPath} fill="currentColor" />
      </svg>

      {/* Visual Audio Fade-In Ramp Overlay */}
      {fadeInPercent > 0 && (
        <svg
          style={{ width: `${fadeInPercent}%` }}
          className="absolute left-0 top-0 bottom-0 z-10 h-full overflow-visible opacity-70"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <polygon points="0,100 100,0 100,100" className="fill-primary/20" />
          <line
            x1="0"
            y1="100"
            x2="100"
            y2="0"
            className="stroke-primary/80"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {/* Visual Audio Fade-Out Ramp Overlay */}
      {fadeOutPercent > 0 && (
        <svg
          style={{ width: `${fadeOutPercent}%` }}
          className="absolute right-0 top-0 bottom-0 z-10 h-full overflow-visible opacity-70"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <polygon points="0,0 100,100 0,100" className="fill-primary/20" />
          <line
            x1="0"
            y1="0"
            x2="100"
            y2="100"
            className="stroke-primary/80"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
}
