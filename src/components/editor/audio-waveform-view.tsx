"use client";

import * as React from "react";
import { extractWaveformPeaks } from "@/lib/audio-waveform";

interface AudioWaveformViewProps {
  blob: Blob | null;
  clipDuration: number;
}

export function AudioWaveformView({ blob, clipDuration }: AudioWaveformViewProps) {
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

  if (peaks.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full opacity-40">
        <div className="w-full h-0.5 bg-primary/40 rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between w-full h-full gap-0.5 overflow-hidden px-1 pointer-events-none opacity-80">
      {peaks.map((peak, idx) => (
        <div
          key={idx}
          style={{ height: `${Math.max(15, Math.round(peak * 90))}%` }}
          className="w-0.5 bg-primary rounded-full shrink-0"
        />
      ))}
    </div>
  );
}
