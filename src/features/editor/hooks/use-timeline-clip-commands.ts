"use client";

import * as React from "react";
import type { TimelineClip, TimelineTransition, TimelineTrack, TransitionType, TrackId } from "@/types/timeline";
import {
  areClipsOnSameTrack,
  getTrackById,
  getVisualTracks,
  getAudioTracks,
  isTrackLocked,
  isVisualTrack,
  normalizeVisualTrackId,
} from "@/types/timeline";
import { calculateFitVisualsToVoiceover } from "@/lib/fit-visuals";
import { validateTransitionDuration, areClipsAdjacentForTransition, applyToAllTransitions as executeApplyToAll } from "@/lib/transition-helpers";
import { sanitizeZoomEffect, type ClipZoomEffect, type ZoomEffectType } from "@/lib/zoom-effect";
import { applyRippleExtend, applyRippleDelete } from "@/lib/timeline-trim";
import { hasVisualOverlap, findNextAvailableStartTime, findTrackEndTime } from "@/lib/timeline-overlap";
import { reorderClipOnTrack } from "@/lib/timeline-reorder";
import { insertClipAtTime } from "@/lib/timeline-insert";
import { hasLockedTrackGestureViolation } from "@/lib/timeline-locks";
import { reconcileTransitionsForClips } from "@/features/editor/domain/timeline-transition-state";
import { calculateSafeRotation90, resolveSafeClipMotion } from "@/lib/motion-canvas-safety";
import { applyPlanTransitions } from "@/lib/auto-transitions";
import { getAllShotsFromPlan, type ScenePlan, type ShotPlanItem } from "@/lib/scene-plan";
import type { MediaAssetItem } from "@/lib/media-storage";

const MIN_CLIP_DURATION = 0.5;

type SelectionSetter = React.Dispatch<React.SetStateAction<string | null | undefined>>;
type PersistTimeline = (
  clips: TimelineClip[],
  transitions: TimelineTransition[],
  tracks?: TimelineTrack[],
  selectedClipId?: string | null,
  selectedTransitionId?: string | null,
  scenePlan?: ScenePlan | null
) => boolean;
type PushHistorySnapshot = (
  clips: TimelineClip[],
  transitions: TimelineTransition[],
  tracks?: TimelineTrack[],
  scenePlan?: ScenePlan | null
) => void;

interface TimelineClipCommandOptions {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  scenePlan?: ScenePlan | null;
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  playhead: number | (() => number);
  setLocalClips: React.Dispatch<React.SetStateAction<TimelineClip[] | null>>;
  setLocalTransitions: React.Dispatch<React.SetStateAction<TimelineTransition[] | null>>;
  setLocalScenePlan?: (plan: ScenePlan | null) => void;
  setLocalSelectedClipId: SelectionSetter;
  setLocalSelectedTransitionId: SelectionSetter;
  pushHistorySnapshot: PushHistorySnapshot;
  persistTimeline: PersistTimeline;
}

function areClipsStructurallyEqual(a: readonly TimelineClip[], b: readonly TimelineClip[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i];
    const cb = b[i];
    if (
      ca.id !== cb.id ||
      ca.startTime !== cb.startTime ||
      ca.duration !== cb.duration ||
      ca.inPoint !== cb.inPoint ||
      ca.outPoint !== cb.outPoint ||
      ca.trackId !== cb.trackId ||
      ca.speed !== cb.speed ||
      ca.volume !== cb.volume ||
      ca.zoomEffect?.type !== cb.zoomEffect?.type ||
      ca.zoomEffect?.amount !== cb.zoomEffect?.amount
    ) {
      return false;
    }
  }
  return true;
}

/** Coordinates clip/transition commands while keeping provider state and persistence injected. */
export function useTimelineClipCommands({
  tracks, clips, transitions, scenePlan, selectedClipId, selectedTransitionId, playhead,
  setLocalClips, setLocalTransitions, setLocalScenePlan, setLocalSelectedClipId, setLocalSelectedTransitionId,
  pushHistorySnapshot, persistTimeline,
}: TimelineClipCommandOptions) {
  const getPlayheadTime = React.useCallback(() => {
    return typeof playhead === "function" ? playhead() : playhead;
  }, [playhead]);
  // ==========================================
  // CLIP & TRANSITION EDITING OPERATIONS
  // ==========================================

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
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalClips, setLocalTransitions, setLocalSelectedClipId, setLocalSelectedTransitionId]
  );

  // Add selected assets in library order. Visual media fill the next compatible
  // unassigned Story Plan slots first; any overflow is appended to the timeline.
  const addAssetsToTimeline = React.useCallback(
    (
      assets: Array<{
        id: string;
        name: string;
        category: "image" | "video" | "audio";
        duration?: number | null;
      }>
    ): { addedCount: number; skippedCount: number } => {
      if (assets.length === 0) return { addedCount: 0, skippedCount: 0 };

      const openShots = scenePlan
        ? getAllShotsFromPlan(scenePlan).filter(
            (shot) => !shot.assignedAssetId && !shot.assignedClipId
          )
        : [];
      const plannedShotByAssetId = new Map<string, ShotPlanItem>();

      for (const asset of assets) {
        if (asset.category !== "image" && asset.category !== "video") continue;
        const shotIndex = openShots.findIndex((shot) => shot.mediaKind === asset.category);
        if (shotIndex < 0) continue;
        const shot = openShots[shotIndex];
        if (!shot) continue;
        openShots.splice(shotIndex, 1);
        plannedShotByAssetId.set(asset.id, shot);
      }

      let updatedClips = [...clips];
      let lastAddedClipId: string | null = null;
      let addedCount = 0;
      let reusedExistingClip = false;
      const reusedClipIds = new Set<string>();
      const assignedShots = new Map<string, { assetId: string; clipId: string }>();

      for (const asset of assets) {
        let resolvedTrackId: TrackId;
        if (asset.category === "audio") {
          const audioTracksList = getAudioTracks(tracks);
          resolvedTrackId =
            audioTracksList.find((track) => track.role === "voiceover")?.id ??
            audioTracksList[0]?.id ??
            "audio";
        } else {
          const visualTracksList = getVisualTracks(tracks);
          resolvedTrackId =
            visualTracksList.find((track) => track.id === "visual-1")?.id ??
            visualTracksList[0]?.id ??
            "visual-1";
        }

        const shot = plannedShotByAssetId.get(asset.id);
        const existingVisualClip = shot
          ? updatedClips.find(
              (clip) =>
                clip.assetId === asset.id &&
                isVisualTrack(clip.trackId, tracks) &&
                !getTrackById(tracks, clip.trackId)?.locked &&
                !reusedClipIds.has(clip.id)
            )
          : undefined;

        // If the default layer is locked, an already-existing clip can stay on
        // its current unlocked visual layer while being linked to the shot.
        if (
          shot &&
          getTrackById(tracks, resolvedTrackId)?.locked &&
          existingVisualClip &&
          !getTrackById(tracks, existingVisualClip.trackId)?.locked
        ) {
          resolvedTrackId = existingVisualClip.trackId;
        }

        // Never silently mutate a locked destination track.
        if (getTrackById(tracks, resolvedTrackId)?.locked) continue;

        if (shot) {
          const clipId =
            existingVisualClip?.id ??
            `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const plannedClip: TimelineClip = {
            ...(existingVisualClip ?? {
              id: clipId,
              assetId: asset.id,
              name: asset.name,
              type: shot.mediaKind,
              trackId: resolvedTrackId,
              startTime: shot.startTime,
              duration: shot.duration,
              inPoint: 0,
              outPoint: shot.duration,
            }),
            id: clipId,
            assetId: asset.id,
            name: asset.name,
            type: shot.mediaKind,
            trackId: resolvedTrackId,
            startTime: shot.startTime,
            duration: shot.duration,
            inPoint: 0,
            outPoint: shot.duration,
            sourceDuration: shot.sourceDuration || asset.duration || null,
            zoomEffect: shot.motion
              ? { type: shot.motion.type, amount: shot.motion.amount }
              : undefined,
          };

          if (existingVisualClip) {
            updatedClips = updatedClips.map((clip) =>
              clip.id === existingVisualClip.id ? plannedClip : clip
            );
            reusedClipIds.add(existingVisualClip.id);
            reusedExistingClip = true;
          } else {
            updatedClips.push(plannedClip);
          }

          assignedShots.set(shot.shotId, { assetId: asset.id, clipId });
          lastAddedClipId = clipId;
          addedCount += 1;
          continue;
        }

        const duration =
          (asset.category === "video" || asset.category === "audio") &&
          asset.duration &&
          asset.duration > 0
            ? asset.duration
            : asset.category === "image"
              ? 3
              : 4;
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
        const trackEnd = findTrackEndTime(resolvedTrackId, updatedClips, tracks);
        const startTime = findNextAvailableStartTime(
          resolvedTrackId,
          duration,
          updatedClips,
          trackEnd,
          tracks
        );
        updatedClips.push({
          ...newClip,
          startTime: Math.max(0, startTime),
        });
        lastAddedClipId = newClip.id;
        addedCount += 1;
      }

      if (addedCount === 0 || !lastAddedClipId) {
        return { addedCount: 0, skippedCount: assets.length };
      }

      updatedClips.sort((a, b) => a.startTime - b.startTime);
      const updatedTransitions = reusedExistingClip
        ? reconcileTransitionsForClips(transitions, updatedClips, tracks)
        : transitions;
      let updatedScenePlan = scenePlan ?? null;
      if (updatedScenePlan && assignedShots.size > 0) {
        updatedScenePlan = {
          ...updatedScenePlan,
          scenes: updatedScenePlan.scenes.map((scene) => ({
            ...scene,
            shots: scene.shots.map((shot) => {
              const assigned = assignedShots.get(shot.shotId);
              return assigned
                ? { ...shot, assignedAssetId: assigned.assetId, assignedClipId: assigned.clipId }
                : shot;
            }),
          })),
        };
        setLocalScenePlan?.(updatedScenePlan);
      }

      pushHistorySnapshot(clips, transitions, tracks, scenePlan);
      setLocalClips(updatedClips);
      setLocalTransitions(updatedTransitions);
      setLocalSelectedClipId(lastAddedClipId);
      setLocalSelectedTransitionId(null);
      persistTimeline(
        updatedClips,
        updatedTransitions,
        tracks,
        lastAddedClipId,
        null,
        updatedScenePlan
      );

      return { addedCount, skippedCount: assets.length - addedCount };
    },
    [
      tracks,
      clips,
      transitions,
      scenePlan,
      pushHistorySnapshot,
      persistTimeline,
      setLocalClips,
      setLocalTransitions,
      setLocalScenePlan,
      setLocalSelectedClipId,
      setLocalSelectedTransitionId,
    ]
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
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalClips, setLocalTransitions]
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
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalClips, setLocalTransitions]
  );

  // Transient clip update (during real-time drag gestures, without pushing history)
  const setClipsTransient = React.useCallback(
    (newClips: TimelineClip[]) => {
      const hasLockedTracks = tracks.some((t) => t.locked);
      if (!hasLockedTracks) {
        setLocalClips(newClips);
        return;
      }

      // Enforce lock constraint: clips on locked tracks stay at committed positions
      const origMap = new Map(clips.map((c) => [c.id, c]));
      const lockedTrackIds = new Set(tracks.filter((t) => t.locked).map((t) => t.id));
      const safeClips = newClips.map((c) => {
        const orig = origMap.get(c.id);
        if (orig && lockedTrackIds.has(orig.trackId)) {
          return orig;
        }
        return c;
      });
      setLocalClips(safeClips);
    },
    [clips, tracks, setLocalClips]
  );

  // Commit completed drag gesture as one single undoable history snapshot
  const commitClipGesture = React.useCallback(
    (originalClips: TimelineClip[], finalClips: TimelineClip[]) => {
      const changed = !areClipsStructurallyEqual(originalClips, finalClips);
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
    [tracks, transitions, pushHistorySnapshot, persistTimeline, setLocalClips, setLocalTransitions]
  );

  const cancelClipGesture = React.useCallback((originalClips: TimelineClip[]) => {
    setLocalClips(originalClips);
  }, [setLocalClips]);

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
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalClips]
  );

  // 5. SPLIT SELECTED CLIP AT PLAYHEAD (Ctrl+B)
  const splitClipAtPlayhead = React.useCallback(
    (targetClipId?: string) => {
      const currentPlayhead = getPlayheadTime();
      const idToSplit = targetClipId || selectedClipId;
      if (!idToSplit) return;

      const clip = clips.find((c) => c.id === idToSplit);
      if (!clip) return;

      // Lock Guard
      if (getTrackById(tracks, clip.trackId)?.locked) return;

      const clipEnd = clip.startTime + clip.duration;
      if (currentPlayhead <= clip.startTime + MIN_CLIP_DURATION || currentPlayhead >= clipEnd - MIN_CLIP_DURATION) {
        return;
      }

      pushHistorySnapshot(clips, transitions, tracks);

      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
      const splitOffset = currentPlayhead - clip.startTime;
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
        startTime: currentPlayhead,
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
    [tracks, clips, transitions, selectedClipId, getPlayheadTime, pushHistorySnapshot, persistTimeline, setLocalClips, setLocalTransitions, setLocalSelectedClipId, setLocalSelectedTransitionId]
  );

  // 6. DELETE SELECTED CLIP (Delete/Backspace) with Ripple Delete
  const deleteClip = React.useCallback(
    (clipId: string) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      // Lock Guard
      if (getTrackById(tracks, target.trackId)?.locked) return;

      pushHistorySnapshot(clips, transitions, tracks, scenePlan);

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

      let updatedScenePlan = scenePlan;
      if (
        scenePlan &&
        scenePlan.scenes.some((s) => s.shots.some((sh) => sh.assignedClipId === clipId))
      ) {
        updatedScenePlan = {
          ...scenePlan,
          scenes: scenePlan.scenes.map((sc) => ({
            ...sc,
            shots: sc.shots.map((sh) =>
              sh.assignedClipId === clipId
                ? { ...sh, assignedClipId: undefined, assignedAssetId: undefined }
                : sh
            ),
          })),
        };
        setLocalScenePlan?.(updatedScenePlan);
      }

      setLocalClips(updatedClips);
      setLocalTransitions(validTransitions);
      const newSelected = selectedClipId === clipId ? null : selectedClipId;
      setLocalSelectedClipId(newSelected);
      setLocalSelectedTransitionId(null);
      persistTimeline(
        updatedClips,
        validTransitions,
        tracks,
        newSelected,
        null,
        updatedScenePlan
      );
    },
    [tracks, clips, transitions, scenePlan, selectedClipId, pushHistorySnapshot, persistTimeline, setLocalClips, setLocalTransitions, setLocalScenePlan, setLocalSelectedClipId, setLocalSelectedTransitionId]
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
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalClips, setLocalSelectedClipId, setLocalSelectedTransitionId]
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
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalTransitions, setLocalSelectedTransitionId, setLocalSelectedClipId]
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
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalTransitions]
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
    [tracks, clips, transitions, selectedTransitionId, selectedClipId, pushHistorySnapshot, persistTimeline, setLocalTransitions, setLocalSelectedTransitionId]
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
      setLocalTransitions,
      setLocalSelectedTransitionId
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
    [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalClips]
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
  }, [tracks, clips, transitions, pushHistorySnapshot, persistTimeline, setLocalClips, setLocalTransitions]);
  // 14. SET IMAGE CLIP DURATION (PRESET / CUSTOM)
  const setImageClipDuration = React.useCallback(
    (clipId: string, duration: number) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target || target.type !== "image") return;
      if (getTrackById(tracks, target.trackId)?.locked) return;

      const safeDur = Math.max(MIN_CLIP_DURATION, Math.min(60, Number.isFinite(duration) ? duration : 4.0));
      if (Math.abs(target.duration - safeDur) < 0.001) return;
      trimClip(clipId, safeDur);
    },
    [clips, tracks, trimClip]
  );

  // 15. ROTATE VISUAL CLIP +90 DEGREES (WITH CANVAS-EDGE COVER SAFETY)
  const rotateClip90 = React.useCallback(
    (clipId: string, canvasWidth: number = 1920, canvasHeight: number = 1080) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target || target.type === "audio") return;
      if (getTrackById(tracks, target.trackId)?.locked) return;

      pushHistorySnapshot(clips, transitions, tracks);

      const rotatedTransform = calculateSafeRotation90({
        transform: target.transform,
        assetWidth: canvasWidth,
        assetHeight: canvasHeight,
        canvasWidth,
        canvasHeight,
      });

      const updatedClips = clips.map((c) =>
        c.id === clipId ? { ...c, transform: rotatedTransform } : c
      );

      setLocalClips(updatedClips);
      persistTimeline(updatedClips, transitions);
    },
    [clips, tracks, transitions, pushHistorySnapshot, persistTimeline, setLocalClips]
  );

  // 16. ASSIGN ASSET TO SHOT PLAN SLOT
  const assignAssetToShot = React.useCallback(
    (shot: ShotPlanItem, asset: MediaAssetItem, targetTrackId: TrackId = "visual-1"): string | undefined => {
      if (getTrackById(tracks, targetTrackId)?.locked) return undefined;

      pushHistorySnapshot(clips, transitions, tracks, scenePlan);

      const newClipId = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newClip: TimelineClip = {
        id: newClipId,
        assetId: asset.id,
        name: asset.name,
        type: shot.mediaKind,
        trackId: targetTrackId,
        startTime: shot.startTime,
        duration: shot.duration,
        inPoint: 0,
        outPoint: shot.duration,
        sourceDuration: shot.sourceDuration || asset.duration || null,
        zoomEffect: shot.motion ? { type: shot.motion.type, amount: shot.motion.amount } : undefined,
      };

      const updatedClips = [...clips, newClip].sort((a, b) => a.startTime - b.startTime);

      let updatedScenePlan = scenePlan;
      if (scenePlan) {
        updatedScenePlan = {
          ...scenePlan,
          scenes: scenePlan.scenes.map((sc) => ({
            ...sc,
            shots: sc.shots.map((sh) =>
              sh.shotId === shot.shotId
                ? { ...sh, assignedAssetId: asset.id, assignedClipId: newClipId }
                : sh
            ),
          })),
        };
        setLocalScenePlan?.(updatedScenePlan);
      }

      setLocalClips(updatedClips);
      persistTimeline(
        updatedClips,
        transitions,
        tracks,
        selectedClipId,
        selectedTransitionId,
        updatedScenePlan
      );
      return newClipId;
    },
    [tracks, clips, transitions, scenePlan, pushHistorySnapshot, persistTimeline, setLocalClips, setLocalScenePlan, selectedClipId, selectedTransitionId]
  );

  // 16B. ATOMIC BATCH ASSIGNMENT OF MEDIA ASSETS TO SHOT PLAN SLOTS (ONE UNDO STEP)
  const assignAssetsToShots = React.useCallback(
    (
      assignments: Array<{ shot: ShotPlanItem; asset: MediaAssetItem; targetTrackId?: TrackId }>
    ): { assignedCount: number; newClipIds: string[] } => {
      const validAssignments = assignments.filter(
        (a) => !getTrackById(tracks, a.targetTrackId || "visual-1")?.locked
      );
      if (validAssignments.length === 0) return { assignedCount: 0, newClipIds: [] };

      // SINGLE ATOMIC UNDO SNAPSHOT FOR ENTIRE BATCH ASSIGNMENT
      pushHistorySnapshot(clips, transitions, tracks, scenePlan);

      const newClips: TimelineClip[] = [];
      const shotToClipMap = new Map<string, { assetId: string; clipId: string }>();

      for (let i = 0; i < validAssignments.length; i++) {
        const item = validAssignments[i];
        const trackId = item.targetTrackId || "visual-1";
        const newClipId = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i + 1}`;
        newClips.push({
          id: newClipId,
          assetId: item.asset.id,
          name: item.asset.name,
          type: item.shot.mediaKind,
          trackId,
          startTime: item.shot.startTime,
          duration: item.shot.duration,
          inPoint: 0,
          outPoint: item.shot.duration,
          sourceDuration: item.shot.sourceDuration || item.asset.duration || null,
          zoomEffect: item.shot.motion ? { type: item.shot.motion.type, amount: item.shot.motion.amount } : undefined,
        });
        shotToClipMap.set(item.shot.shotId, { assetId: item.asset.id, clipId: newClipId });
      }

      const updatedClips = [...clips, ...newClips].sort((a, b) => a.startTime - b.startTime);

      let updatedScenePlan = scenePlan;
      if (scenePlan) {
        updatedScenePlan = {
          ...scenePlan,
          scenes: scenePlan.scenes.map((sc) => ({
            ...sc,
            shots: sc.shots.map((sh) => {
              const matched = shotToClipMap.get(sh.shotId);
              return matched
                ? { ...sh, assignedAssetId: matched.assetId, assignedClipId: matched.clipId }
                : sh;
            }),
          })),
        };
        setLocalScenePlan?.(updatedScenePlan);
      }

      setLocalClips(updatedClips);
      persistTimeline(
        updatedClips,
        transitions,
        tracks,
        selectedClipId,
        selectedTransitionId,
        updatedScenePlan
      );
      return { assignedCount: validAssignments.length, newClipIds: newClips.map((c) => c.id) };
    },
    [tracks, clips, transitions, scenePlan, pushHistorySnapshot, persistTimeline, setLocalClips, setLocalScenePlan, selectedClipId, selectedTransitionId]
  );

  // 17. APPLY AUTO MOTION FROM SCENE PLAN SUGGESTIONS (WITH EDGE SAFETY)
  const applyPlanAutoMotions = React.useCallback(
    (plan: ScenePlan, canvasWidth: number = 1920, canvasHeight: number = 1080): { appliedCount: number } => {
      const allShots = getAllShotsFromPlan(plan);
      const shotsWithMotion = allShots.filter((s) => s.motion && s.assignedClipId);
      if (shotsWithMotion.length === 0) return { appliedCount: 0 };

      pushHistorySnapshot(clips, transitions, tracks);

      const shotMap = new Map(shotsWithMotion.map((s) => [s.assignedClipId!, s]));
      let appliedCount = 0;

      const updatedClips = clips.map((c) => {
        const shot = shotMap.get(c.id);
        if (!shot || !shot.motion || c.type !== "image") return c;
        if (getTrackById(tracks, c.trackId)?.locked) return c;

        const safeRes = resolveSafeClipMotion({
          transform: c.transform,
          motion: shot.motion,
          assetWidth: canvasWidth,
          assetHeight: canvasHeight,
          canvasWidth,
          canvasHeight,
        });

        if (safeRes.safe && safeRes.appliedMotion) {
          appliedCount++;
          return {
            ...c,
            zoomEffect: safeRes.appliedMotion,
            transform: safeRes.recommendedTransformScale
              ? { ...(c.transform || { x: 0, y: 0, scale: 1.0, rotation: 0 }), scale: safeRes.recommendedTransformScale }
              : c.transform,
          };
        }
        return c;
      });

      setLocalClips(updatedClips);
      persistTimeline(updatedClips, transitions);
      return { appliedCount };
    },
    [clips, tracks, transitions, pushHistorySnapshot, persistTimeline, setLocalClips]
  );

  // 18. APPLY AUTO TRANSITIONS FROM SCENE PLAN SUGGESTIONS
  const applyPlanAutoTransitions = React.useCallback(
    (plan: ScenePlan, options?: { replaceExisting?: boolean }) => {
      const res = applyPlanTransitions(plan, clips, tracks, transitions, options);
      if (res.appliedCount > 0) {
        pushHistorySnapshot(clips, transitions, tracks);
        setLocalTransitions(res.transitions);
        persistTimeline(clips, res.transitions);
      }
      return res;
    },
    [clips, tracks, transitions, pushHistorySnapshot, persistTimeline, setLocalTransitions]
  );

  return {
    addAssetToTimeline, addAssetsToTimeline, moveClip, trimClip, setClipsTransient, commitClipGesture, cancelClipGesture,
    updateClip, splitClipAtPlayhead, deleteClip, duplicateClip, addTransition, updateTransition, deleteTransition,
    applyToAllTransitions: applyAllTransitions, applyMotionToAllClips, fitVisualsToVoiceover,
    setImageClipDuration, rotateClip90, assignAssetToShot, assignAssetsToShots, applyPlanAutoMotions, applyPlanAutoTransitions,
  };
}
