"use client";

import * as React from "react";
import type { TimelineClip, TimelineTrack } from "@/types/timeline";
import { isTrackLocked } from "@/types/timeline";
import { applyRippleExtend } from "@/lib/timeline-trim";
import { validateFadeDuration } from "@/lib/audio-fade-helpers";
import { sanitizeZoomEffect } from "@/lib/zoom-effect";

interface UseInspectorClipGesturesOptions {
  clips: TimelineClip[];
  selectedClip: TimelineClip | null;
  tracks: TimelineTrack[];
  setClipsTransient: (clips: TimelineClip[]) => void;
  commitClipGesture: (originalClips: TimelineClip[], finalClips: TimelineClip[]) => void;
}

/** Owns inspector slider gesture snapshots and transient clip-edit proposals. */
export function useInspectorClipGestures({
  clips,
  selectedClip,
  tracks,
  setClipsTransient,
  commitClipGesture,
}: UseInspectorClipGesturesOptions) {
  const initialClipsRef = React.useRef<TimelineClip[] | null>(null);
  const latestClipsRef = React.useRef<TimelineClip[] | null>(null);

  const handleSliderPointerDown = React.useCallback(() => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    initialClipsRef.current = JSON.parse(JSON.stringify(clips));
    latestClipsRef.current = null;
  }, [clips, selectedClip, tracks]);

  const handleSliderPointerUp = React.useCallback(() => {
    if (!initialClipsRef.current) return;
    const finalClips = latestClipsRef.current ?? clips;
    commitClipGesture(initialClipsRef.current, finalClips);
    initialClipsRef.current = null;
    latestClipsRef.current = null;
  }, [clips, commitClipGesture]);

  React.useEffect(() => {
    const onWindowPointerUp = () => {
      if (initialClipsRef.current) handleSliderPointerUp();
    };
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    return () => {
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    };
  }, [handleSliderPointerUp]);

  const getBaseClips = React.useCallback((): TimelineClip[] => {
    if (!initialClipsRef.current) {
      const snapshot: TimelineClip[] = JSON.parse(JSON.stringify(clips));
      initialClipsRef.current = snapshot;
      latestClipsRef.current = null;
      return snapshot;
    }
    return initialClipsRef.current;
  }, [clips]);

  const handleTransientDurationChange = React.useCallback((val: number | readonly number[]) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const baseClips = getBaseClips();
    const rawVal = Array.isArray(val) ? val[0] : val;
    const num = typeof rawVal === "number" ? rawVal : Number.parseFloat(String(rawVal));
    if (!Number.isNaN(num) && num >= 0.5) {
      const speed = selectedClip.speed && selectedClip.speed > 0 ? selectedClip.speed : 1.0;
      let clampedDuration = num;
      if (selectedClip.sourceDuration && selectedClip.sourceDuration > 0) {
        const remaining = (selectedClip.sourceDuration - selectedClip.inPoint) / speed;
        clampedDuration = Math.min(clampedDuration, remaining);
      }
      const transientClips = applyRippleExtend(selectedClip.id, clampedDuration, baseClips, tracks);
      latestClipsRef.current = transientClips;
      setClipsTransient(transientClips);
    }
  }, [selectedClip, tracks, getBaseClips, setClipsTransient]);

  const handleTransientVolumeChange = React.useCallback((val: number | readonly number[]) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const baseClips = getBaseClips();
    const rawVal = Array.isArray(val) ? val[0] : val;
    const num = typeof rawVal === "number" ? rawVal : Number.parseFloat(String(rawVal));
    if (!Number.isNaN(num)) {
      const updated = baseClips.map((clip) =>
        clip.id === selectedClip.id ? { ...clip, volume: num } : clip
      );
      latestClipsRef.current = updated;
      setClipsTransient(updated);
    }
  }, [selectedClip, tracks, getBaseClips, setClipsTransient]);

  const handleTransientFadeInChange = React.useCallback((val: number | readonly number[]) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const baseClips = getBaseClips();
    const rawVal = Array.isArray(val) ? val[0] : val;
    const num = typeof rawVal === "number" ? rawVal : Number.parseFloat(String(rawVal));
    const safeFade = validateFadeDuration(num, selectedClip.duration, selectedClip.fadeOutDuration ?? 0);
    setClipsTransient(baseClips.map((clip) =>
      clip.id === selectedClip.id ? { ...clip, fadeInDuration: safeFade } : clip
    ));
  }, [selectedClip, tracks, getBaseClips, setClipsTransient]);

  const handleTransientFadeOutChange = React.useCallback((val: number | readonly number[]) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const baseClips = getBaseClips();
    const rawVal = Array.isArray(val) ? val[0] : val;
    const num = typeof rawVal === "number" ? rawVal : Number.parseFloat(String(rawVal));
    const safeFade = validateFadeDuration(num, selectedClip.duration, selectedClip.fadeInDuration ?? 0);
    setClipsTransient(baseClips.map((clip) =>
      clip.id === selectedClip.id ? { ...clip, fadeOutDuration: safeFade } : clip
    ));
  }, [selectedClip, tracks, getBaseClips, setClipsTransient]);

  const handleTransientZoomAmountChange = React.useCallback((val: number | readonly number[]) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const effect = sanitizeZoomEffect(selectedClip.zoomEffect);
    if (!effect) return;
    const baseClips = getBaseClips();
    const rawVal = Array.isArray(val) ? val[0] : val;
    const num = typeof rawVal === "number" ? rawVal : Number.parseFloat(String(rawVal));
    const amount = num / 100;
    const zoomEffect = sanitizeZoomEffect({ ...effect, amount });
    setClipsTransient(baseClips.map((clip) =>
      clip.id === selectedClip.id ? { ...clip, zoomEffect } : clip
    ));
  }, [selectedClip, tracks, getBaseClips, setClipsTransient]);

  return {
    getBaseClips,
    handleSliderPointerDown,
    handleSliderPointerUp,
    handleTransientDurationChange,
    handleTransientVolumeChange,
    handleTransientFadeInChange,
    handleTransientFadeOutChange,
    handleTransientZoomAmountChange,
  };
}
