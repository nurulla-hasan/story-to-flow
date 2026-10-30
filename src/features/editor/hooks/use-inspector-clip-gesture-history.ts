"use client";

import * as React from "react";
import type { TimelineClip } from "@/types/timeline";

interface InspectorClipGestureHistoryOptions {
  clips: TimelineClip[];
  commitClipGesture: (originalClips: TimelineClip[], finalClips: TimelineClip[]) => void;
}

/** Groups inspector slider updates into a single undoable clip gesture. */
export function useInspectorClipGestureHistory({ clips, commitClipGesture }: InspectorClipGestureHistoryOptions) {
  const initialClipsRef = React.useRef<TimelineClip[] | null>(null);
  const latestClipsRef = React.useRef<TimelineClip[] | null>(null);

  const finishGesture = React.useCallback(() => {
    if (!initialClipsRef.current) return;
    const finalClips = latestClipsRef.current ?? clips;
    commitClipGesture(initialClipsRef.current, finalClips);
    initialClipsRef.current = null;
    latestClipsRef.current = null;
  }, [clips, commitClipGesture]);

  React.useEffect(() => {
    const finishOnWindowRelease = () => {
      if (initialClipsRef.current) finishGesture();
    };
    window.addEventListener("pointerup", finishOnWindowRelease);
    window.addEventListener("pointercancel", finishOnWindowRelease);
    return () => {
      window.removeEventListener("pointerup", finishOnWindowRelease);
      window.removeEventListener("pointercancel", finishOnWindowRelease);
    };
  }, [finishGesture]);

  const beginGesture = React.useCallback(() => {
    initialClipsRef.current = JSON.parse(JSON.stringify(clips)) as TimelineClip[];
    latestClipsRef.current = null;
  }, [clips]);

  const getBaseClips = React.useCallback((): TimelineClip[] => {
    if (!initialClipsRef.current) {
      initialClipsRef.current = JSON.parse(JSON.stringify(clips)) as TimelineClip[];
      latestClipsRef.current = null;
    }
    return initialClipsRef.current;
  }, [clips]);

  const setLatestClips = React.useCallback((nextClips: TimelineClip[]) => {
    latestClipsRef.current = nextClips;
  }, []);

  return { beginGesture, finishGesture, getBaseClips, setLatestClips };
}
