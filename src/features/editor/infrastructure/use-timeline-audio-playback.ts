"use client";

import * as React from "react";
import type { TimelineClip, TimelineTrack } from "@/types/timeline";
import { isAudioTrack, calculateEffectivePlaybackRate } from "@/types/timeline";
import type { MediaAssetItem } from "@/lib/media-storage";
import { calculateAudioGain } from "@/lib/audio-fade-helpers";

interface TimelineAudioPlaybackOptions {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  assets: MediaAssetItem[];
  playhead: number;
  isPlaying: boolean;
  playbackSpeed: number;
  playbackSpeedRef: { current: number };
  isMuted: boolean;
  masterVolume: number;
}

/** Owns browser audio elements and keeps timeline audio synchronized with the project clock. */
export function useTimelineAudioPlayback({
  clips, tracks, assets, playhead, isPlaying, playbackSpeed, playbackSpeedRef, isMuted, masterVolume,
}: TimelineAudioPlaybackOptions): void {
  const audioElementsRef = React.useRef<Map<string, HTMLAudioElement>>(new Map());

  // Index assets and tracks for O(1) metadata resolution
  const assetMap = React.useMemo(() => new Map(assets.map((item) => [item.id, item])), [assets]);
  const trackMap = React.useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const audioClips = React.useMemo(
    () => clips.filter((clip) => isAudioTrack(clip.trackId, tracks)),
    [clips, tracks]
  );

  React.useEffect(() => {
    const pool = audioElementsRef.current;
    return () => {
      for (const element of pool.values()) {
        element.pause();
        element.removeAttribute("src");
        element.load();
      }
      pool.clear();
    };
  }, []);

  React.useEffect(() => {
    const pool = audioElementsRef.current;
    const activeAudioClips = audioClips.filter(
      (clip) =>
        playhead >= clip.startTime &&
        playhead < clip.startTime + clip.duration
    );
    const activeClipIds = new Set(activeAudioClips.map((clip) => clip.id));

    // Dispose pooled elements once clips leave the active playback window.
    for (const [clipId, element] of pool.entries()) {
      if (!activeClipIds.has(clipId)) {
        element.pause();
        element.removeAttribute("src");
        element.load();
        pool.delete(clipId);
      }
    }

    for (const clip of activeAudioClips) {
      const track = trackMap.get(clip.trackId);
      const isTrackMutedBool = track?.muted === true;
      const trackVolume = typeof track?.volume === "number" && !Number.isNaN(track.volume) ? track.volume : 1;
      const asset = assetMap.get(clip.assetId);
      if (!asset?.url) continue;

      let audioElement = pool.get(clip.id);
      if (!audioElement) {
        audioElement = new Audio();
        audioElement.preload = "auto";
        pool.set(clip.id, audioElement);
      }

      if (audioElement.src !== asset.url) audioElement.src = asset.url;
      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
      const targetTime = (playhead - clip.startTime) * speed + clip.inPoint;
      if (!isPlaying || Math.abs(audioElement.currentTime - targetTime) > 0.25) {
        if (Math.abs(audioElement.currentTime - targetTime) > 0.05) {
          audioElement.currentTime = Math.max(0, targetTime);
        }
      }

      const currentGain = calculateAudioGain(
        playhead - clip.startTime, clip.duration, clip.volume ?? 1,
        clip.fadeInDuration ?? 0, clip.fadeOutDuration ?? 0
      );
      const effectiveTrackVolume = isTrackMutedBool ? 0 : trackVolume;
      const finalVolume = isMuted || isTrackMutedBool
        ? 0
        : Math.max(0, Math.min(1, currentGain * effectiveTrackVolume * masterVolume));
      audioElement.volume = finalVolume;
      audioElement.muted = isMuted || isTrackMutedBool || finalVolume === 0;

      const targetRate = calculateEffectivePlaybackRate(speed, playbackSpeedRef.current);
      if (audioElement.playbackRate !== targetRate) audioElement.playbackRate = targetRate;
      if (isPlaying && audioElement.paused) {
        audioElement.play().catch(() => {});
      } else if (!isPlaying && !audioElement.paused) {
        audioElement.pause();
      }
    }
  }, [playhead, isPlaying, playbackSpeed, audioClips, trackMap, assetMap, isMuted, masterVolume, playbackSpeedRef]);
}
