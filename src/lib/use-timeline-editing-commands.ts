"use client";

import * as React from "react";
import type {
  TimelineClip,
  TimelineTransition,
  TimelineTrack,
  TrackId,
  TransitionType,
} from "@/types/timeline";
import {
  areClipsOnSameTrack,
  areClipsAdjacentForTransition,
  getAudioTracks,
  getTrackById,
  getVisualTracks,
  isTrackLocked,
  isVisualTrack,
  normalizeVisualTrackId,
} from "@/types/timeline";
import { calculateFitVisualsToVoiceover } from "@/lib/fit-visuals";
import {
  validateTransitionDuration,
  applyToAllTransitions as executeApplyToAll,
} from "@/lib/transition-helpers";
import { applyRippleExtend, applyRippleDelete } from "@/lib/timeline-trim";
import {
  hasVisualOverlap,
  findNextAvailableStartTime,
  findTrackEndTime,
} from "@/lib/timeline-overlap";
import { reorderClipOnTrack } from "@/lib/timeline-reorder";
import { insertClipAtTime } from "@/lib/timeline-insert";
import { hasLockedTrackGestureViolation } from "@/lib/timeline-locks";
import { reconcileTransitionsForClips } from "@/lib/timeline-derived-state";
import { sanitizeZoomEffect, type ClipZoomEffect, type ZoomEffectType } from "@/lib/zoom-effect";

interface UseTimelineEditingCommandsOptions {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  playhead: number;
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

/** Owns timeline editing commands and all their domain-aware state transitions. */
export function useTimelineEditingCommands({
  tracks,
  clips,
  transitions,
  selectedClipId,
  selectedTransitionId,
  playhead,
  setLocalClips,
  setLocalTransitions,
  setLocalSelectedClipId,
  setLocalSelectedTransitionId,
  pushHistorySnapshot,
  persistTimeline,
}: UseTimelineEditingCommandsOptions) {
  const MIN_CLIP_DURATION = 0.5;

  // 1. ADD ASSET TO TIMELINE
  const addAssetToTimeline = React.useCallback(
    (
      asset: { id: string; name: string; category: "image" | "video" | "audio"; duration?: number | null },
      targetTrack?: TrackId,
      customStartTime?: number
    ) => {
      // Determine default target track if none specified
      let resolvedTrackId = targetTrack;
      if (!resolvedTrackId) {
        if (asset.category === "audio") {
          // Prefer default Voiceover track, or first audio track
          const audioTracksList = getAudioTracks(tracks);
          resolvedTrackId = audioTracksList.find((t) => t.role === "voiceover")?.id || audioTracksList[0]?.id || "audio";
        } else {
          // Prefer Base visual layer 1, or first visual track
          const visualTracksList = getVisualTracks(tracks);
          resolvedTrackId = visualTracksList.find((t) => t.id === "visual-1")?.id || visualTracksList[0]?.id || "visual-1";
        }
      }

      // Lock Guard: do not allow dropping onto a locked track
      const targetTrackDef = getTrackById(tracks, resolvedTrackId);
      if (targetTrackDef?.locked) {
        return;
      }

      pushHistorySnapshot(clips, transitions, tracks);

      let duration = 3.0;
      if (asset.category === "video" || asset.category === "audio") {
        duration = asset.duration && asset.duration > 0 ? asset.duration : 4.0;
      }

      const newClip: TimelineClip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        assetId: asset.id,
        name: asset.name,
        type: asset.category,
        trackId: resolvedTrackId,
        startTime: 0,
        duration,
        inPoint: 0,
        outPoint: duration,
        sourceDuration: asset.duration || null,
        speed: 1.0,
        volume: 1.0,
      };

      let updatedClips: TimelineClip[];
      let updatedTransitions = transitions;

      if (customStartTime !== undefined) {
        // Explicit drop position: insert (and ripple/split) instead of appending.
        const insertResult = insertClipAtTime(newClip, customStartTime, clips, tracks);
        updatedClips = insertResult.clips;

        if (insertResult.split) {
          const { originalClipId, rightPartId } = insertResult.split;
          updatedTransitions = transitions.map((t) =>
            t.fromClipId === originalClipId ? { ...t, fromClipId: rightPartId } : t
          );
        }

        updatedTransitions = reconcileTransitionsForClips(
          updatedTransitions,
          updatedClips,
          tracks
        );
      } else {
        // No explicit position means append after the last clip on this
        // track, even if there are earlier gaps. Drag-and-drop supplies an
        // explicit position above and keeps insertion-at-drop behavior.
        const trackEnd = findTrackEndTime(resolvedTrackId, clips, tracks);
        const startTime = findNextAvailableStartTime(
          resolvedTrackId,
          duration,
          clips,
          trackEnd,
          tracks
        );
        updatedClips = [
          ...clips,
          { ...newClip, startTime: Math.max(0, startTime) },
        ];
      }

      setLocalClips(updatedClips);
      setLocalTransitions(updatedTransitions);
      setLocalSelectedClipId(newClip.id);
      setLocalSelectedTransitionId(null);
      persistTimeline(updatedClips, updatedTransitions, tracks, newClip.id, null);
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 2. MOVE CLIP
  const moveClip = React.useCallback(
    (clipId: string, newStartTime: number) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      // Lock Guard
      if (getTrackById(tracks, target.trackId)?.locked) return;

      pushHistorySnapshot(clips, transitions, tracks);

      const updatedClips = reorderClipOnTrack(
        target,
        newStartTime,
        clips,
        tracks
      ).clips;

      const validTransitions = reconcileTransitionsForClips(
        transitions,
        updatedClips,
        tracks
      );

      setLocalClips(updatedClips);
      setLocalTransitions(validTransitions);
      persistTimeline(updatedClips, validTransitions);
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 3. TRIM CLIP / ADJUST DURATION
  const trimClip = React.useCallback(
    (clipId: string, newDuration: number) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      // Lock Guard
      if (getTrackById(tracks, target.trackId)?.locked) return;

      pushHistorySnapshot(clips, transitions, tracks);

      const speed = target.speed && target.speed > 0 ? target.speed : 1.0;
      let clampedDuration = Math.max(MIN_CLIP_DURATION, newDuration);
      if (target.sourceDuration && target.sourceDuration > 0) {
        const remaining = (target.sourceDuration - target.inPoint) / speed;
        clampedDuration = Math.min(clampedDuration, remaining);
      }

      const updatedClips = applyRippleExtend(clipId, clampedDuration, clips, tracks);

      const validTransitions = transitions
        .filter((t) => {
          const from = updatedClips.find((c) => c.id === t.fromClipId);
          const to = updatedClips.find((c) => c.id === t.toClipId);
          if (!from || !to) return false;
          return areClipsAdjacentForTransition(from, to, tracks);
        })
        .map((t) => {
          const from = updatedClips.find((c) => c.id === t.fromClipId);
          const to = updatedClips.find((c) => c.id === t.toClipId);
          const safeDur = validateTransitionDuration(t.duration, from, to);
          return { ...t, duration: safeDur };
        });

      setLocalClips(updatedClips);
      setLocalTransitions(validTransitions);
      persistTimeline(updatedClips, validTransitions);
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // Transient clip update (during real-time drag gestures, without pushing history)
  const setClipsTransient = React.useCallback(
    (newClips: TimelineClip[]) => {
      // Enforce lock constraint: clips on locked tracks stay at committed positions
      const origMap = new Map(clips.map((c) => [c.id, c]));
      const safeClips = newClips.map((c) => {
        const orig = origMap.get(c.id);
        if (orig && isTrackLocked(orig.trackId, tracks)) {
          return orig;
        }
        return c;
      });
      setLocalClips(safeClips);
    },
    [clips, tracks]
  );

  // Commit completed drag gesture as one single undoable history snapshot
  const commitClipGesture = React.useCallback(
    (originalClips: TimelineClip[], finalClips: TimelineClip[]) => {
      const changed = JSON.stringify(originalClips) !== JSON.stringify(finalClips);
      if (!changed) return;

      // Compare every clip property, including transforms, zoom effects,
      // volume and fades. Checking timing alone allowed locked clips to be edited.
      if (hasLockedTrackGestureViolation(originalClips, finalClips, tracks)) {
        // Revert any transient UI state immediately so screen matches committed state
        setLocalClips(originalClips);
        return;
      }

      pushHistorySnapshot(originalClips, transitions, tracks);

      const validTransitions = reconcileTransitionsForClips(
        transitions,
        finalClips,
        tracks
      );

      setLocalClips(finalClips);
      setLocalTransitions(validTransitions);
      persistTimeline(finalClips, validTransitions);
    },
    [tracks, transitions, pushHistorySnapshot, persistTimeline]
  );

  const cancelClipGesture = React.useCallback((originalClips: TimelineClip[]) => {
    setLocalClips(originalClips);
  }, []);

  // 4. UPDATE CLIP GENERAL PROPERTIES
  const updateClip = React.useCallback(
    (clipId: string, updates: Partial<TimelineClip>) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      // Lock Guard on current track
      if (getTrackById(tracks, target.trackId)?.locked) return;

      // Lock Guard on target track (if moving tracks)
      if (updates.trackId && updates.trackId !== target.trackId) {
        if (getTrackById(tracks, updates.trackId)?.locked) return;
      }

      // Prevent switching visual layer if target lane is already occupied at this interval
      if (updates.trackId && updates.trackId !== target.trackId && isVisualTrack(updates.trackId, tracks)) {
        if (hasVisualOverlap({ ...target, ...updates, trackId: updates.trackId }, clips, tracks)) {
          return;
        }
      }

      pushHistorySnapshot(clips, transitions, tracks);

      const updatedClips = clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c));
      setLocalClips(updatedClips);
      persistTimeline(updatedClips, transitions);
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 5. SPLIT SELECTED CLIP AT PLAYHEAD (Ctrl+B)
  const splitClipAtPlayhead = React.useCallback(
    (targetClipId?: string) => {
      const idToSplit = targetClipId || selectedClipId;
      if (!idToSplit) return;

      const clip = clips.find((c) => c.id === idToSplit);
      if (!clip) return;

      // Lock Guard
      if (getTrackById(tracks, clip.trackId)?.locked) return;

      const clipEnd = clip.startTime + clip.duration;
      if (playhead <= clip.startTime + MIN_CLIP_DURATION || playhead >= clipEnd - MIN_CLIP_DURATION) {
        return;
      }

      pushHistorySnapshot(clips, transitions, tracks);

      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
      const splitOffset = playhead - clip.startTime;
      const part1Duration = splitOffset;
      const part2Duration = clip.duration - splitOffset;

      const part1: TimelineClip = {
        ...clip,
        duration: part1Duration,
        outPoint: clip.inPoint + part1Duration * speed,
      };

      const part2: TimelineClip = {
        ...clip,
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        startTime: playhead,
        duration: part2Duration,
        inPoint: clip.inPoint + splitOffset * speed,
        outPoint: clip.outPoint,
      };

      const updatedClips = clips.flatMap((c) => (c.id === idToSplit ? [part1, part2] : [c]));
      const clipMap = new Map(updatedClips.map((c) => [c.id, c]));

      const reconciledTransitions: TimelineTransition[] = [];
      for (const t of transitions) {
        if (t.toClipId === idToSplit) {
          const from = clipMap.get(t.fromClipId);
          if (from && areClipsAdjacentForTransition(from, part1, tracks)) {
            const safeDur = validateTransitionDuration(t.duration, from, part1);
            reconciledTransitions.push({ ...t, duration: safeDur });
          }
        } else if (t.fromClipId === idToSplit) {
          const to = clipMap.get(t.toClipId);
          if (to && areClipsAdjacentForTransition(part2, to, tracks)) {
            const safeDur = validateTransitionDuration(t.duration, part2, to);
            reconciledTransitions.push({ ...t, fromClipId: part2.id, duration: safeDur });
          }
        } else {
          reconciledTransitions.push(t);
        }
      }

      setLocalClips(updatedClips);
      setLocalTransitions(reconciledTransitions);
      setLocalSelectedClipId(part2.id);
      setLocalSelectedTransitionId(null);
      persistTimeline(updatedClips, reconciledTransitions, tracks, part2.id, null);
    },
    [tracks, clips, transitions, selectedClipId, playhead, pushHistorySnapshot, persistTimeline]
  );

  // 6. DELETE SELECTED CLIP (Delete/Backspace) with Ripple Delete
  const deleteClip = React.useCallback(
    (clipId: string) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      // Lock Guard
      if (getTrackById(tracks, target.trackId)?.locked) return;

      pushHistorySnapshot(clips, transitions, tracks);

      const { updatedClips } = applyRippleDelete(clipId, clips, tracks);

      const remainingTransitions = transitions.filter(
        (t) => t.fromClipId !== clipId && t.toClipId !== clipId
      );

      const validTransitions = remainingTransitions
        .filter((t) => {
          const from = updatedClips.find((c) => c.id === t.fromClipId);
          const to = updatedClips.find((c) => c.id === t.toClipId);
          if (!from || !to) return false;
          return areClipsAdjacentForTransition(from, to, tracks);
        })
        .map((t) => {
          const from = updatedClips.find((c) => c.id === t.fromClipId);
          const to = updatedClips.find((c) => c.id === t.toClipId);
          const safeDur = validateTransitionDuration(t.duration, from, to);
          return { ...t, duration: safeDur };
        });

      setLocalClips(updatedClips);
      setLocalTransitions(validTransitions);
      const newSelected = selectedClipId === clipId ? null : selectedClipId;
      setLocalSelectedClipId(newSelected);
      setLocalSelectedTransitionId(null);
      persistTimeline(updatedClips, validTransitions, tracks, newSelected, null);
    },
    [tracks, clips, transitions, selectedClipId, pushHistorySnapshot, persistTimeline]
  );

  // 7. DUPLICATE SELECTED CLIP (Ctrl+D)
  const duplicateClip = React.useCallback(
    (clipId: string) => {
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;

      // Lock Guard
      if (getTrackById(tracks, clip.trackId)?.locked) return;

      pushHistorySnapshot(clips, transitions, tracks);

      const preferredStart = clip.startTime + clip.duration;
      const targetStart = findNextAvailableStartTime(
        clip.trackId,
        clip.duration,
        clips,
        preferredStart,
        tracks
      );

      const duplicate: TimelineClip = {
        ...clip,
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: `${clip.name} (Copy)`,
        startTime: targetStart,
      };

      const updatedClips = [...clips, duplicate];
      setLocalClips(updatedClips);
      setLocalSelectedClipId(duplicate.id);
      setLocalSelectedTransitionId(null);
      persistTimeline(updatedClips, transitions, tracks, duplicate.id, null);
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 8. ADD VISUAL TRANSITION
  const addTransition = React.useCallback(
    (fromClipId: string, toClipId: string, type: TransitionType = "cross-dissolve", duration: number = 0.5) => {
      const fromClip = clips.find((c) => c.id === fromClipId);
      const toClip = clips.find((c) => c.id === toClipId);
      if (!fromClip || !toClip) return;
      if (!isVisualTrack(fromClip.trackId, tracks) || !areClipsOnSameTrack(fromClip.trackId, toClip.trackId, tracks)) return;
      if (!areClipsAdjacentForTransition(fromClip, toClip, tracks)) return;

      // Lock Guard
      if (getTrackById(tracks, fromClip.trackId)?.locked) return;

      pushHistorySnapshot(clips, transitions, tracks);

      const safeDur = validateTransitionDuration(duration, fromClip, toClip);
      const newTransition: TimelineTransition = {
        id: `trans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        duration: safeDur,
        fromClipId,
        toClipId,
        trackId: normalizeVisualTrackId(fromClip.trackId),
      };

      const updatedTransitions = [
        ...transitions.filter(
          (t) =>
            !(
              (t.fromClipId === fromClipId && t.toClipId === toClipId) ||
              (t.fromClipId === toClipId && t.toClipId === fromClipId)
            )
        ),
        newTransition,
      ];

      setLocalTransitions(updatedTransitions);
      setLocalSelectedTransitionId(newTransition.id);
      setLocalSelectedClipId(null);
      persistTimeline(clips, updatedTransitions, tracks, null, newTransition.id);
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 9. UPDATE TRANSITION
  const updateTransition = React.useCallback(
    (transitionId: string, updates: Partial<TimelineTransition>) => {
      const target = transitions.find((t) => t.id === transitionId);
      if (!target) return;

      // Lock Guard
      if (getTrackById(tracks, target.trackId)?.locked) return;

      pushHistorySnapshot(clips, transitions, tracks);

      const fromClip = clips.find((c) => c.id === target.fromClipId);
      const toClip = clips.find((c) => c.id === target.toClipId);

      let newDur = updates.duration !== undefined ? updates.duration : target.duration;
      newDur = validateTransitionDuration(newDur, fromClip, toClip);

      const updatedTransitions = transitions.map((t) =>
        t.id === transitionId ? { ...t, ...updates, duration: newDur } : t
      );

      setLocalTransitions(updatedTransitions);
      persistTimeline(clips, updatedTransitions);
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 10. DELETE TRANSITION
  const deleteTransition = React.useCallback(
    (transitionId: string) => {
      const target = transitions.find((t) => t.id === transitionId);
      if (!target) return;

      // Lock Guard
      if (getTrackById(tracks, target.trackId)?.locked) return;

      pushHistorySnapshot(clips, transitions, tracks);

      const updatedTransitions = transitions.filter((t) => t.id !== transitionId);
      setLocalTransitions(updatedTransitions);
      const newSelectedTrans = selectedTransitionId === transitionId ? null : selectedTransitionId;
      setLocalSelectedTransitionId(newSelectedTrans);
      persistTimeline(clips, updatedTransitions, tracks, selectedClipId, newSelectedTrans);
    },
    [tracks, clips, transitions, selectedTransitionId, selectedClipId, pushHistorySnapshot, persistTimeline]
  );

  // 11. APPLY TO ALL TRANSITIONS
  const applyAllTransitions = React.useCallback(
    (sourceTransitionId: string) => {
      const source = transitions.find((t) => t.id === sourceTransitionId);
      if (!source) {
        return { success: false, message: "Selected transition not found.", count: 0 };
      }

      pushHistorySnapshot(clips, transitions, tracks);

      const result = executeApplyToAll(source, transitions, clips, tracks);
      const sourceStillExists = result.updatedTransitions.some(
        (t) => t.id === sourceTransitionId
      );
      const nextSelectedTransitionId = sourceStillExists
        ? selectedTransitionId
        : null;

      setLocalTransitions(result.updatedTransitions);
      setLocalSelectedTransitionId(nextSelectedTransitionId);
      persistTimeline(
        clips,
        result.updatedTransitions,
        tracks,
        selectedClipId,
        nextSelectedTransitionId
      );

      return { success: true, message: result.message, count: result.count };
    },
    [
      tracks,
      transitions,
      clips,
      selectedClipId,
      selectedTransitionId,
      pushHistorySnapshot,
      persistTimeline,
    ]
  );

  // 12. APPLY MOTION / ZOOM EFFECT TO ALL IMAGE SCENES
  const applyMotionToAllClips = React.useCallback(
    (effect?: Partial<ClipZoomEffect> | null) => {
      const safe = sanitizeZoomEffect(effect);
      const targetClips = clips.filter(
        (c) => isVisualTrack(c.trackId, tracks) && c.type === "image" && !isTrackLocked(c.trackId, tracks)
      );
      if (targetClips.length === 0) {
        return { success: false, message: "No unlocked image scenes found on timeline.", count: 0 };
      }

      pushHistorySnapshot(clips, transitions, tracks);

      const updatedClips = clips.map((c) => {
        if (isVisualTrack(c.trackId, tracks) && c.type === "image" && !isTrackLocked(c.trackId, tracks)) {
          return { ...c, zoomEffect: safe };
        }
        return c;
      });

      setLocalClips(updatedClips);
      persistTimeline(updatedClips, transitions);

      const labelMap: Record<ZoomEffectType, string> = {
        "zoom-in": "Zoom In",
        "zoom-out": "Zoom Out",
        "pan-left": "Pan Left",
        "pan-right": "Pan Right",
        "pan-up": "Pan Up",
        "pan-down": "Pan Down",
      };
      const label = safe ? labelMap[safe.type] : "Off";
      const count = targetClips.length;
      const message = safe
        ? `Applied ${label} (${Math.round(safe.amount * 100)}%) to all ${count} image scenes.`
        : `Removed motion effect from all ${count} image scenes.`;

      return { success: true, message, count };
    },
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 13. FIT VISUALS TO VOICEOVER ACTION
  const fitVisualsToVoiceover = React.useCallback(() => {
    const result = calculateFitVisualsToVoiceover(clips, transitions, tracks);
    if (result.success) {
      pushHistorySnapshot(clips, transitions, tracks);
      setLocalClips(result.updatedClips);
      setLocalTransitions(result.updatedTransitions);
      persistTimeline(result.updatedClips, result.updatedTransitions);
    }
    return { success: result.success, message: result.message };
  }, [tracks, clips, transitions, pushHistorySnapshot, persistTimeline]);

  return {
    addAssetToTimeline,
    moveClip,
    trimClip,
    setClipsTransient,
    commitClipGesture,
    cancelClipGesture,
    updateClip,
    splitClipAtPlayhead,
    deleteClip,
    duplicateClip,
    addTransition,
    updateTransition,
    deleteTransition,
    applyAllTransitions,
    applyMotionToAllClips,
    fitVisualsToVoiceover,
  };
}
