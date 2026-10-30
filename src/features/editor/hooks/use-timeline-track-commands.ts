"use client";

import * as React from "react";
import type { TimelineClip, TimelineTrack, TimelineTransition, TrackId, TrackType, AudioTrackRole } from "@/types/timeline";
import { areClipsOnSameTrack, getTrackById, getAudioTracks, getVisualTracks } from "@/types/timeline";

type SelectionSetter = React.Dispatch<React.SetStateAction<string | null | undefined>>;
type PersistTimeline = (
  clips: TimelineClip[],
  transitions: TimelineTransition[],
  tracks?: TimelineTrack[],
  selectedClipId?: string | null,
  selectedTransitionId?: string | null
) => boolean;
type PushHistorySnapshot = (
  clips: TimelineClip[],
  transitions: TimelineTransition[],
  tracks?: TimelineTrack[]
) => void;

interface TimelineTrackCommandOptions {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  setLocalTracks: React.Dispatch<React.SetStateAction<TimelineTrack[] | null>>;
  setLocalClips: React.Dispatch<React.SetStateAction<TimelineClip[] | null>>;
  setLocalTransitions: React.Dispatch<React.SetStateAction<TimelineTransition[] | null>>;
  setLocalSelectedClipId: SelectionSetter;
  setLocalSelectedTransitionId: SelectionSetter;
  pushHistorySnapshot: PushHistorySnapshot;
  persistTimeline: PersistTimeline;
}

/** Track-specific commands: lane ordering, toggles, and cascading track deletion. */
export function useTimelineTrackCommands({
  tracks, clips, transitions, selectedClipId, selectedTransitionId,
  setLocalTracks, setLocalClips, setLocalTransitions,
  setLocalSelectedClipId, setLocalSelectedTransitionId,
  pushHistorySnapshot, persistTimeline,
}: TimelineTrackCommandOptions) {
  // ==========================================
  // DYNAMIC TRACK MANAGEMENT API
  // ==========================================

  // 1. ADD TRACK
  const addTrack = React.useCallback(
    (type: TrackType, role?: AudioTrackRole, customName?: string): TrackId => {
      pushHistorySnapshot(clips, transitions, tracks);

      let id: string;
      let name: string;
      let trackOrder: number;
      let existingTracks = tracks;

      if (type === "visual") {
        let maxVisualNum = 0;
        for (const t of tracks) {
          if (t.type === "visual") {
            const m = t.id.match(/^visual-(\d+)$/);
            if (m) maxVisualNum = Math.max(maxVisualNum, parseInt(m[1], 10));
          }
        }
        const nextNum = maxVisualNum + 1;
        id = `visual-${nextNum}`;
        name = customName || `Visual Layer ${nextNum}`;
        // New visual overlay track is placed on top (order 0), shifting existing visual tracks down
        trackOrder = 0;
        existingTracks = tracks.map((t) =>
          t.type === "visual" ? { ...t, order: t.order + 1 } : t
        );
      } else {
        const rolePrefix = role || "audio";
        let maxAudioNum = 0;
        for (const t of tracks) {
          if (t.type === "audio") {
            const m = t.id.match(new RegExp(`^${rolePrefix}-(\\d+)$`));
            if (m) maxAudioNum = Math.max(maxAudioNum, parseInt(m[1], 10));
          }
        }
        const nextNum = maxAudioNum + 1;
        id = `${rolePrefix}-${nextNum}`;

        if (customName) {
          name = customName;
        } else if (role === "voiceover") {
          name = nextNum === 1 ? "Voiceover" : `Voiceover ${nextNum}`;
        } else if (role === "music") {
          name = nextNum === 1 ? "Background Music" : `Music ${nextNum}`;
        } else if (role === "sfx") {
          name = `SFX ${nextNum}`;
        } else if (role === "ambient") {
          name = nextNum === 1 ? "Ambient Sound" : `Ambient ${nextNum}`;
        } else {
          name = `Audio Track ${nextNum}`;
        }

        const existingAudio = tracks.filter((t) => t.type === "audio");
        trackOrder = existingAudio.length > 0 ? Math.max(...existingAudio.map((t) => t.order)) + 1 : 0;
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
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 2. UPDATE TRACK
  const updateTrack = React.useCallback(
    (trackId: TrackId, updates: Partial<TimelineTrack>) => {
      const target = getTrackById(tracks, trackId);
      if (!target) return;

      pushHistorySnapshot(clips, transitions, tracks);

      const updatedTracks = tracks.map((t) => (t.id === trackId ? { ...t, ...updates } : t));
      setLocalTracks(updatedTracks);
      persistTimeline(clips, transitions, updatedTracks);
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 3. RENAME TRACK
  const renameTrack = React.useCallback(
    (trackId: TrackId, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      updateTrack(trackId, { name: trimmed });
    },
    [updateTrack]
  );

  // 4. TOGGLE TRACK MUTE
  const toggleTrackMute = React.useCallback(
    (trackId: TrackId) => {
      const target = getTrackById(tracks, trackId);
      if (!target) return;
      updateTrack(trackId, { muted: !target.muted });
    },
    [tracks, updateTrack]
  );

  // 5. TOGGLE TRACK LOCK
  const toggleTrackLock = React.useCallback(
    (trackId: TrackId) => {
      const target = getTrackById(tracks, trackId);
      if (!target) return;
      updateTrack(trackId, { locked: !target.locked });
    },
    [tracks, updateTrack]
  );

  // 6. TOGGLE TRACK VISIBILITY
  const toggleTrackVisibility = React.useCallback(
    (trackId: TrackId) => {
      const target = getTrackById(tracks, trackId);
      if (!target) return;
      updateTrack(trackId, { visible: !target.visible });
    },
    [tracks, updateTrack]
  );

  // 7. REORDER TRACK (Up/Down)
  const reorderTrack = React.useCallback(
    (trackId: TrackId, direction: "up" | "down") => {
      const target = getTrackById(tracks, trackId);
      if (!target) return;

      const sameType = tracks
        .filter((t) => t.type === target.type)
        .sort((a, b) => a.order - b.order);

      const currentIndex = sameType.findIndex((t) => t.id === trackId);
      if (currentIndex === -1) return;

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= sameType.length) return;

      pushHistorySnapshot(clips, transitions, tracks);

      const other = sameType[targetIndex];
      const updatedTracks = tracks.map((t) => {
        if (t.id === target.id) return { ...t, order: other.order };
        if (t.id === other.id) return { ...t, order: target.order };
        return t;
      });

      setLocalTracks(updatedTracks);
      persistTimeline(clips, transitions, updatedTracks);
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 8. DELETE TRACK (With cascading cleanup of clips and transitions)
  const deleteTrack = React.useCallback(
    (trackId: TrackId): boolean => {
      const target = getTrackById(tracks, trackId);
      if (!target) return false;

      // Check lock state
      if (target.locked) return false;

      pushHistorySnapshot(clips, transitions, tracks);

      // Remove track
      const updatedTracks = tracks.filter((t) => t.id !== trackId);

      // Remove all clips on this track
      const clipsToDelete = new Set(clips.filter((c) => areClipsOnSameTrack(c.trackId, trackId, tracks)).map((c) => c.id));
      const updatedClips = clips.filter((c) => !clipsToDelete.has(c.id));

      // Remove any transitions attached to deleted clips
      const updatedTransitions = transitions.filter(
        (t) => !clipsToDelete.has(t.fromClipId) && !clipsToDelete.has(t.toClipId)
      );

      // Reconcile selections
      const newSelectedClip = selectedClipId && clipsToDelete.has(selectedClipId) ? null : selectedClipId;
      const newSelectedTrans =
        selectedTransitionId &&
        transitions.some(
          (t) => t.id === selectedTransitionId && (clipsToDelete.has(t.fromClipId) || clipsToDelete.has(t.toClipId))
        )
          ? null
          : selectedTransitionId;

      setLocalTracks(updatedTracks);
      setLocalClips(updatedClips);
      setLocalTransitions(updatedTransitions);
      setLocalSelectedClipId(newSelectedClip);
      setLocalSelectedTransitionId(newSelectedTrans);

      persistTimeline(updatedClips, updatedTransitions, updatedTracks, newSelectedClip, newSelectedTrans);
      return true;
    },
    [tracks, clips, transitions, selectedClipId, selectedTransitionId, pushHistorySnapshot, persistTimeline]
  );
  return { addTrack, updateTrack, renameTrack, toggleTrackMute, toggleTrackLock, toggleTrackVisibility, reorderTrack, deleteTrack };
}
