"use client";

import * as React from "react";
import { extractWaveformPeaks } from "@/lib/audio-waveform";

interface AudioWaveformViewProps {
  blob: Blob | null;
  clipDuration: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

export function AudioWaveformView({
  blob,
  clipDuration,
  fadeInDuration = 0,
  fadeOutDuration = 0,
}: AudioWaveformViewProps) {
  const [peaks, setPeaks] = React.useState<number[]>([]);

  React.useEffect(() => {
    let isMounted = true;

    if (!blob) return;

    // Number of bars proportional to duration (e.g. ~8 bars per second, clamped between 20 and 120)
    const numBars = Math.max(20, Math.min(120, Math.round(clipDuration * 8)));

    extractWaveformPeaks(blob, numBars).then((p) => {
      if (isMounted) {
        setPeaks(p);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [blob, clipDuration]);

  const fadeInPercent =
    clipDuration > 0 && fadeInDuration > 0
      ? Math.min(50, (fadeInDuration / clipDuration) * 100)
      : 0;

  const fadeOutPercent =
    clipDuration > 0 && fadeOutDuration > 0
      ? Math.min(50, (fadeOutDuration / clipDuration) * 100)
      : 0;

  return (
    <div className="relative w-full h-full overflow-hidden pointer-events-none select-none">
      {/* Waveform amplitude bars */}
      <div className="flex items-center justify-between w-full h-full gap-0.5 px-1 opacity-75">
        {peaks.length === 0 ? (
          <div className="w-full h-0.5 bg-primary/40 rounded-full" />
        ) : (
          peaks.map((peak, idx) => (
            <div
              key={idx}
              style={{ height: `${Math.max(15, Math.round(peak * 90))}%` }}
              className="w-0.5 bg-primary rounded-full shrink-0"
            />
          ))
        )}
      </div>

      {/* Visual Audio Fade-In Ramp Overlay */}
      {fadeInPercent > 0 && (
        <svg
          style={{ width: `${fadeInPercent}%` }}
          className="absolute left-0 top-0 bottom-0 h-full overflow-visible z-10 opacity-70"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {/* Shaded triangle showing volume ramping up from zero */}
          <polygon
            points="0,100 100,0 100,100"
            className="fill-primary/20"
          />
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
          className="absolute right-0 top-0 bottom-0 h-full overflow-visible z-10 opacity-70"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {/* Shaded triangle showing volume ramping down to zero */}
          <polygon
            points="0,0 100,100 0,100"
            className="fill-primary/20"
          />
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
