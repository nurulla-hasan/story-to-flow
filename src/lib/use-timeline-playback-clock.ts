"use client";

import * as React from "react";
import { stepFrame, TIMELINE_FPS } from "@/lib/frame-navigation";

interface UseTimelinePlaybackClockOptions {
  playhead: number;
  totalDuration: number;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setLocalPlayhead: React.Dispatch<React.SetStateAction<number | null>>;
  playheadRef: { current: number };
  isPlayingRef: { current: boolean };
  playbackSpeedRef: { current: number };
  commitPlayhead: (time?: number) => void;
}

/** Owns playhead/frame controls and the animation-frame playback clock. */
export function useTimelinePlaybackClock({
  playhead,
  totalDuration,
  isPlaying,
  setIsPlaying,
  setLocalPlayhead,
  playheadRef,
  isPlayingRef,
  playbackSpeedRef,
  commitPlayhead,
}: UseTimelinePlaybackClockOptions) {
  const totalDurationRef = React.useRef(0);
  const wasPlayingRef = React.useRef(false);
  const [playbackSpeed, setPlaybackSpeedState] = React.useState(1);

  React.useEffect(() => {
    totalDurationRef.current = totalDuration;
  }, [totalDuration]);

  const setPlayhead = React.useCallback((time: number) => {
    const clamped = Math.max(0, time);
    playheadRef.current = clamped;
    setLocalPlayhead(clamped);
  }, [playheadRef, setLocalPlayhead]);

  const seek = React.useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(totalDurationRef.current, time));
    playheadRef.current = clamped;
    setLocalPlayhead(clamped);
    commitPlayhead(clamped);
  }, [playheadRef, setLocalPlayhead, commitPlayhead]);

  const stepFrameForward = React.useCallback(() => {
    const next = stepFrame(playheadRef.current, 1, totalDurationRef.current, TIMELINE_FPS);
    playheadRef.current = next;
    setLocalPlayhead(next);
    commitPlayhead(next);
  }, [playheadRef, setLocalPlayhead, commitPlayhead]);

  const stepFrameBackward = React.useCallback(() => {
    const next = stepFrame(playheadRef.current, -1, totalDurationRef.current, TIMELINE_FPS);
    playheadRef.current = next;
    setLocalPlayhead(next);
    commitPlayhead(next);
  }, [playheadRef, setLocalPlayhead, commitPlayhead]);

  const togglePlay = React.useCallback(() => {
    setIsPlaying((previous) => {
      const willPlay = !previous;
      if (willPlay && playheadRef.current >= totalDurationRef.current) {
        playheadRef.current = 0;
        setLocalPlayhead(0);
      }
      return willPlay;
    });
  }, [setIsPlaying, playheadRef, setLocalPlayhead]);

  const pause = React.useCallback(() => setIsPlaying(false), [setIsPlaying]);

  const setPlaybackSpeed = React.useCallback((speed: number) => {
    playbackSpeedRef.current = speed;
    setPlaybackSpeedState(speed);
  }, [playbackSpeedRef]);

  React.useEffect(() => {
    if (wasPlayingRef.current && !isPlaying) commitPlayhead(playheadRef.current);
    wasPlayingRef.current = isPlaying;
  }, [isPlaying, commitPlayhead, playheadRef]);

  React.useEffect(() => {
    isPlayingRef.current = isPlaying;
    // During playback, the animation-frame clock advances this ref monotonically.
    // When paused, resynchronize it with the persisted/derived state.
    if (!isPlaying) playheadRef.current = playhead;
  }, [isPlaying, playhead, isPlayingRef, playheadRef]);

  React.useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const loop = (currentTimestamp: number) => {
      const elapsedSec = ((currentTimestamp - lastTimestamp) / 1000) * playbackSpeedRef.current;
      lastTimestamp = currentTimestamp;
      const current = playheadRef.current;
      const targetDuration = Math.max(0.1, totalDurationRef.current);

      if (current >= targetDuration) {
        setIsPlaying(false);
        setLocalPlayhead(targetDuration);
        commitPlayhead(targetDuration);
        return;
      }

      const next = Math.min(targetDuration, current + elapsedSec);
      playheadRef.current = next;
      setLocalPlayhead(next);
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, setIsPlaying, setLocalPlayhead, playheadRef, playbackSpeedRef, commitPlayhead]);

  return {
    playbackSpeed,
    setPlaybackSpeed,
    setPlayhead,
    seek,
    stepFrameForward,
    stepFrameBackward,
    togglePlay,
    pause,
  };
}
