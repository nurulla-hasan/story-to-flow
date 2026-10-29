"use client";

import * as React from "react";
import type { TimelineClip, TimelineTrack } from "@/types/timeline";
import { isAudioTrack, calculateEffectivePlaybackRate } from "@/types/timeline";
import { calculateAudioGain } from "@/lib/audio-fade-helpers";
import type { MediaAssetItem } from "@/lib/media-storage";

interface UseTimelineAudioPlaybackOptions {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  assets: MediaAssetItem[];
  playhead: number;
  isPlaying: boolean;
  isMuted: boolean;
  masterVolume: number;
  playbackSpeedRef: { current: number };
}

/**
 * Owns browser audio elements and synchronizes them to the timeline clock.
 * The timeline provider supplies project/playback state; this hook manages
 * audio element allocation, seeking, gain, fades, playback rate, and cleanup.
 */
export function useTimelineAudioPlayback({
  clips,
  tracks,
  assets,
  playhead,
  isPlaying,
  isMuted,
  masterVolume,
  playbackSpeedRef,
}: UseTimelineAudioPlaybackOptions): void {
  const audioElementsRef = React.useRef<Map<string, HTMLAudioElement>>(new Map());

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
    const trackMap = new Map(tracks.map((track) => [track.id, track]));
    const allAudioClips = clips.filter((clip) => isAudioTrack(clip.trackId, tracks));
    const activeAudioClips = allAudioClips.filter(
      (clip) => playhead >= clip.startTime && playhead < clip.startTime + clip.duration
    );
    const activeClipIds = new Set(activeAudioClips.map((clip) => clip.id));

    // Release elements when their clips are no longer active.
    for (const [clipId, audioElement] of pool.entries()) {
      if (!activeClipIds.has(clipId)) {
        audioElement.pause();
        audioElement.removeAttribute("src");
        audioElement.load();
        pool.delete(clipId);
      }
    }

    // Synchronize all active audio clips, allowing multiple tracks to mix.
    for (const clip of activeAudioClips) {
      const track = trackMap.get(clip.trackId);
      const isTrackMuted = track?.muted === true;
      const trackVolume =
        typeof track?.volume === "number" && !Number.isNaN(track.volume)
          ? track.volume
          : 1.0;
      const asset = assets.find((item) => item.id === clip.assetId);
      if (!asset?.url) continue;

      let audioElement = pool.get(clip.id);
      if (!audioElement) {
        audioElement = new Audio();
        audioElement.preload = "auto";
        pool.set(clip.id, audioElement);
      }

      if (audioElement.src !== asset.url) audioElement.src = asset.url;

      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
      const targetTime = (playhead - clip.startTime) * speed + clip.inPoint;
      if (!isPlaying || Math.abs(audioElement.currentTime - targetTime) > 0.25) {
        if (Math.abs(audioElement.currentTime - targetTime) > 0.05) {
          audioElement.currentTime = Math.max(0, targetTime);
        }
      }

      const clipRelativeTime = playhead - clip.startTime;
      const currentGain = calculateAudioGain(
        clipRelativeTime,
        clip.duration,
        clip.volume ?? 1.0,
        clip.fadeInDuration ?? 0,
        clip.fadeOutDuration ?? 0,
      );
      const effectiveTrackVolume = isTrackMuted ? 0 : trackVolume;
      const finalVolume = isMuted || isTrackMuted
        ? 0
        : Math.max(0, Math.min(1.0, currentGain * effectiveTrackVolume * masterVolume));

      audioElement.volume = finalVolume;
      audioElement.muted = isMuted || isTrackMuted || finalVolume === 0;

      const targetRate = calculateEffectivePlaybackRate(speed, playbackSpeedRef.current);
      if (audioElement.playbackRate !== targetRate) audioElement.playbackRate = targetRate;

      if (isPlaying && audioElement.paused) {
        audioElement.play().catch(() => {});
      } else if (!isPlaying && !audioElement.paused) {
        audioElement.pause();
      }
    }
  }, [playhead, isPlaying, clips, tracks, assets, isMuted, masterVolume, playbackSpeedRef]);
}
