"use client";

import * as React from "react";
import type {
  AudioTrackRole,
  TimelineClip,
  TimelineTrack,
  TimelineTransition,
  TrackId,
  TrackType,
} from "@/types/timeline";
import { areClipsOnSameTrack, getTrackById } from "@/types/timeline";

interface UseTimelineTrackCommandsOptions {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  setLocalTracks: React.Dispatch<React.SetStateAction<TimelineTrack[] | null>>;
  setLocalClips: React.Dispatch<React.SetStateAction<TimelineClip[] | null>>;
  setLocalTransitions: React.Dispatch<React.SetStateAction<TimelineTransition[] | null>>;
  setLocalSelectedClipId: React.Dispatch<React.SetStateAction<string | null | undefined>>;
  setLocalSelectedTransitionId: React.Dispatch<React.SetStateAction<string | null | undefined>>;
  pushHistorySnapshot: (
    currentClips: TimelineClip[],
    currentTransitions: TimelineTransition[],
    currentTracks?: TimelineTrack[],
  ) => void;
  persistTimeline: (
    nextClips: TimelineClip[],
    nextTransitions: TimelineTransition[],
    nextTracks?: TimelineTrack[],
    nextSelectedClipId?: string | null,
    nextSelectedTransitionId?: string | null,
  ) => boolean | void;
}

/** Owns multi-track operations and their cascading timeline/selection cleanup. */
export function useTimelineTrackCommands({
  tracks,
  clips,
  transitions,
  selectedClipId,
  selectedTransitionId,
  setLocalTracks,
  setLocalClips,
  setLocalTransitions,
  setLocalSelectedClipId,
  setLocalSelectedTransitionId,
  pushHistorySnapshot,
  persistTimeline,
}: UseTimelineTrackCommandsOptions) {
  const addTrack = React.useCallback(
    (type: TrackType, role?: AudioTrackRole, customName?: string): TrackId => {
      pushHistorySnapshot(clips, transitions, tracks);

      let id: string;
      let name: string;
      let trackOrder: number;
      let existingTracks = tracks;

      if (type === "visual") {
        let maxVisualNum = 0;
        for (const track of tracks) {
          if (track.type === "visual") {
            const match = track.id.match(/^visual-(\d+)$/);
            if (match) maxVisualNum = Math.max(maxVisualNum, parseInt(match[1], 10));
          }
        }
        const nextNum = maxVisualNum + 1;
        id = `visual-${nextNum}`;
        name = customName || `Visual Layer ${nextNum}`;
        trackOrder = 0;
        existingTracks = tracks.map((track) =>
          track.type === "visual" ? { ...track, order: track.order + 1 } : track
        );
      } else {
        const rolePrefix = role || "audio";
        let maxAudioNum = 0;
        for (const track of tracks) {
          if (track.type === "audio") {
            const match = track.id.match(new RegExp(`^${rolePrefix}-(\\d+)$`));
            if (match) maxAudioNum = Math.max(maxAudioNum, parseInt(match[1], 10));
          }
        }
        const nextNum = maxAudioNum + 1;
        id = `${rolePrefix}-${nextNum}`;

        if (customName) name = customName;
        else if (role === "voiceover") name = nextNum === 1 ? "Voiceover" : `Voiceover ${nextNum}`;
        else if (role === "music") name = nextNum === 1 ? "Background Music" : `Music ${nextNum}`;
        else if (role === "sfx") name = `SFX ${nextNum}`;
        else if (role === "ambient") name = nextNum === 1 ? "Ambient Sound" : `Ambient ${nextNum}`;
        else name = `Audio Track ${nextNum}`;

        const existingAudio = tracks.filter((track) => track.type === "audio");
        trackOrder = existingAudio.length > 0
          ? Math.max(...existingAudio.map((track) => track.order)) + 1
          : 0;
      }

      const newTrack: TimelineTrack = {
        id,
        name,
        type,
        role: type === "audio" ? role || "general" : undefined,
        order: trackOrder,
        muted: false,
        volume: 1.0,
        visible: true,
        locked: false,
      };

      const updatedTracks = [...existingTracks, newTrack];
      setLocalTracks(updatedTracks);
      persistTimeline(clips, transitions, updatedTracks);
      return id;
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalTracks],
  );

  const updateTrack = React.useCallback(
    (trackId: TrackId, updates: Partial<TimelineTrack>) => {
      if (!getTrackById(tracks, trackId)) return;
      pushHistorySnapshot(clips, transitions, tracks);
      const updatedTracks = tracks.map((track) =>
        track.id === trackId ? { ...track, ...updates } : track
      );
      setLocalTracks(updatedTracks);
      persistTimeline(clips, transitions, updatedTracks);
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalTracks],
  );

  const renameTrack = React.useCallback(
    (trackId: TrackId, newName: string) => {
      const trimmed = newName.trim();
      if (trimmed) updateTrack(trackId, { name: trimmed });
    },
    [updateTrack],
  );

  const toggleTrackMute = React.useCallback(
    (trackId: TrackId) => {
      const target = getTrackById(tracks, trackId);
      if (target) updateTrack(trackId, { muted: !target.muted });
    },
    [tracks, updateTrack],
  );

  const toggleTrackLock = React.useCallback(
    (trackId: TrackId) => {
      const target = getTrackById(tracks, trackId);
      if (target) updateTrack(trackId, { locked: !target.locked });
    },
    [tracks, updateTrack],
  );

  const toggleTrackVisibility = React.useCallback(
    (trackId: TrackId) => {
      const target = getTrackById(tracks, trackId);
      if (target) updateTrack(trackId, { visible: !target.visible });
    },
    [tracks, updateTrack],
  );

  const reorderTrack = React.useCallback(
    (trackId: TrackId, direction: "up" | "down") => {
      const target = getTrackById(tracks, trackId);
      if (!target) return;
      const sameType = tracks
        .filter((track) => track.type === target.type)
        .sort((a, b) => a.order - b.order);
      const currentIndex = sameType.findIndex((track) => track.id === trackId);
      if (currentIndex === -1) return;

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= sameType.length) return;
      pushHistorySnapshot(clips, transitions, tracks);

      const other = sameType[targetIndex];
      const updatedTracks = tracks.map((track) => {
        if (track.id === target.id) return { ...track, order: other.order };
        if (track.id === other.id) return { ...track, order: target.order };
        return track;
      });
      setLocalTracks(updatedTracks);
      persistTimeline(clips, transitions, updatedTracks);
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalTracks],
  );

  const deleteTrack = React.useCallback(
    (trackId: TrackId): boolean => {
      const target = getTrackById(tracks, trackId);
      if (!target || target.locked) return false;
      pushHistorySnapshot(clips, transitions, tracks);

      const updatedTracks = tracks.filter((track) => track.id !== trackId);
      const clipsToDelete = new Set(
        clips
          .filter((clip) => areClipsOnSameTrack(clip.trackId, trackId, tracks))
          .map((clip) => clip.id),
      );
      const updatedClips = clips.filter((clip) => !clipsToDelete.has(clip.id));
      const updatedTransitions = transitions.filter(
        (transition) =>
          !clipsToDelete.has(transition.fromClipId) &&
          !clipsToDelete.has(transition.toClipId),
      );

      const nextSelectedClip = selectedClipId && clipsToDelete.has(selectedClipId)
        ? null
        : selectedClipId;
      const nextSelectedTransition =
        selectedTransitionId &&
        transitions.some((transition) =>
          transition.id === selectedTransitionId &&
          (clipsToDelete.has(transition.fromClipId) || clipsToDelete.has(transition.toClipId))
        )
          ? null
          : selectedTransitionId;

      setLocalTracks(updatedTracks);
      setLocalClips(updatedClips);
      setLocalTransitions(updatedTransitions);
      setLocalSelectedClipId(nextSelectedClip);
      setLocalSelectedTransitionId(nextSelectedTransition);
      persistTimeline(
        updatedClips,
        updatedTransitions,
        updatedTracks,
        nextSelectedClip,
        nextSelectedTransition,
      );
      return true;
    },
    [
      tracks, clips, transitions, selectedClipId, selectedTransitionId,
      pushHistorySnapshot, persistTimeline, setLocalTracks, setLocalClips,
      setLocalTransitions, setLocalSelectedClipId, setLocalSelectedTransitionId,
    ],
  );

  return {
    addTrack,
    updateTrack,
    renameTrack,
    toggleTrackMute,
    toggleTrackLock,
    toggleTrackVisibility,
    reorderTrack,
    deleteTrack,
  };
}
