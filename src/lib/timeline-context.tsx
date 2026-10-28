"use client";

import * as React from "react";
import type {
  TimelineClip,
  TimelineTransition,
  TransitionType,
  TrackId,
} from "@/types/timeline";
import {
  isVisualTrack,
  isAudioTrack,
  areClipsOnSameTrack,
  normalizeVisualTrackId,
} from "@/types/timeline";
import { useMediaLibrary } from "@/lib/use-media-library";
import {
  DEFAULT_TIMELINE_STATE,
  INITIAL_TIMELINE_SAVE_STATUS,
  createPlayheadCommitGate,
  formatTimelineSaveError,
  resolveTimelineSelection,
  saveStoredTimelineState,
  timelineSaveStatusReducer,
  useTimelineStorage,
} from "@/lib/timeline-storage";
import {
  clearRegisteredTimelineAssetReferences,
  registerTimelineAssetReferences,
} from "@/lib/media-references";
import { calculateFitVisualsToVoiceover } from "@/lib/fit-visuals";
import {
  validateTransitionDuration,
  areClipsAdjacentForTransition,
  applyToAllTransitions as executeApplyToAll,
} from "@/lib/transition-helpers";
import {
  sanitizeZoomEffect,
  type ClipZoomEffect,
  type ZoomEffectType,
} from "@/lib/zoom-effect";
import { stepFrame, TIMELINE_FPS } from "@/lib/frame-navigation";
import { calculateAudioGain } from "@/lib/audio-fade-helpers";
import { applyRippleExtend, applyRippleDelete } from "@/lib/timeline-trim";
import {
  hasVisualOverlap,
  findNextNonOverlappingStartTime,
} from "@/lib/timeline-overlap";
import { reorderClipOnTrack } from "@/lib/timeline-reorder";
import { insertClipAtTime } from "@/lib/timeline-insert";

export interface TimelineContextType {
  isHydrated: boolean;
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  selectedClipId: string | null;
  selectedClip: TimelineClip | null;
  selectedTransitionId: string | null;
  selectedTransition: TimelineTransition | null;
  playhead: number;
  isPlaying: boolean;
  zoom: number;
  totalDuration: number;
  projectTitle: string;
  aspectRatio: "9:16" | "16:9";
  canUndo: boolean;
  canRedo: boolean;
  saveError: string | null;
  isDirty: boolean;
  setProjectTitle: (title: string) => void;
  setAspectRatio: (ratio: "9:16" | "16:9") => void;
  setPlayhead: (time: number) => void;
  commitPlayhead: (time?: number) => void;
  seek: (time: number) => void;
  dismissSaveError: () => void;
  stepFrameForward: () => void;
  stepFrameBackward: () => void;
  togglePlay: () => void;
  pause: () => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  masterVolume: number;
  setMasterVolume: (volume: number) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean | ((prev: boolean) => boolean)) => void;
  setZoom: (zoom: number) => void;
  selectClip: (clipId: string | null) => void;
  selectTransition: (transitionId: string | null) => void;
  addAssetToTimeline: (asset: { id: string; name: string; category: "image" | "video" | "audio"; duration?: number | null }, trackId?: TrackId, startTime?: number) => void;
  moveClip: (clipId: string, newStartTime: number) => void;
  trimClip: (clipId: string, newDuration: number) => void;
  setClipsTransient: (newClips: TimelineClip[]) => void;
  commitClipGesture: (originalClips: TimelineClip[], finalClips: TimelineClip[]) => void;
  cancelClipGesture: (originalClips: TimelineClip[]) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  splitClipAtPlayhead: (clipId?: string) => void;
  deleteClip: (clipId: string) => void;
  duplicateClip: (clipId: string) => void;
  addTransition: (fromClipId: string, toClipId: string, type?: TransitionType, duration?: number) => void;
  updateTransition: (transitionId: string, updates: Partial<TimelineTransition>) => void;
  deleteTransition: (transitionId: string) => void;
  applyToAllTransitions: (sourceTransitionId: string) => { success: boolean; message: string; count: number };
  applyMotionToAllClips: (effect?: Partial<ClipZoomEffect> | null) => { success: boolean; message: string; count: number };
  fitVisualsToVoiceover: () => { success: boolean; message: string };
  undo: () => void;
  redo: () => void;
}

const TimelineContext = React.createContext<TimelineContextType | null>(null);

const MAX_HISTORY = 50;
const MIN_CLIP_DURATION = 0.5; // minimum 500ms
const emptySubscribe = () => () => {};

/**
 * Keep only transitions whose connecting clips are still adjacent on the same
 * visual track, and clamp durations to the (possibly changed) clip lengths.
 */
function reconcileTransitionsForClips(
  candidateTransitions: TimelineTransition[],
  candidateClips: TimelineClip[]
): TimelineTransition[] {
  return candidateTransitions
    .filter((t) => {
      const from = candidateClips.find((c) => c.id === t.fromClipId);
      const to = candidateClips.find((c) => c.id === t.toClipId);
      if (!from || !to) return false;
      return areClipsAdjacentForTransition(from, to);
    })
    .map((t) => {
      const from = candidateClips.find((c) => c.id === t.fromClipId);
      const to = candidateClips.find((c) => c.id === t.toClipId);
      return {
        ...t,
        duration: validateTransitionDuration(t.duration, from, to),
      };
    });
}

interface HistorySnapshot {
  clips: TimelineClip[];
  transitions: TimelineTransition[];
}

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  const { assets } = useMediaLibrary();

  // Hydration-safe client detection via React useSyncExternalStore
  const isHydrated = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Hydration-safe external store subscription for persisted timeline state
  const storedState = useTimelineStorage();

  // Local overrides during active session (starts null so server and client first render use default)
  const [localTitle, setLocalTitle] = React.useState<string | null>(null);
  const [localAspectRatio, setLocalAspectRatio] = React.useState<"9:16" | "16:9" | null>(null);
  const [localClips, setLocalClips] = React.useState<TimelineClip[] | null>(null);
  const [localTransitions, setLocalTransitions] = React.useState<TimelineTransition[] | null>(null);
  // undefined means "inherit the stored selection"; null means "explicitly cleared".
  const [localSelectedClipId, setLocalSelectedClipId] = React.useState<string | null | undefined>(undefined);
  const [localSelectedTransitionId, setLocalSelectedTransitionId] = React.useState<string | null | undefined>(undefined);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [localPlayhead, setLocalPlayhead] = React.useState<number | null>(null);
  const [localZoom, setLocalZoom] = React.useState<number | null>(null);
  const [saveStatus, dispatchSaveStatus] = React.useReducer(
    timelineSaveStatusReducer,
    INITIAL_TIMELINE_SAVE_STATUS
  );

  // Derived active state: perfectly identical between server and client first render
  const projectTitle = localTitle ?? (isHydrated ? storedState.projectTitle : DEFAULT_TIMELINE_STATE.projectTitle);
  const aspectRatio = localAspectRatio ?? (isHydrated ? (storedState.aspectRatio || "9:16") : (DEFAULT_TIMELINE_STATE.aspectRatio || "9:16"));
  const clips = localClips ?? (isHydrated ? storedState.clips : DEFAULT_TIMELINE_STATE.clips);
  const transitions = localTransitions ?? (isHydrated ? storedState.transitions : DEFAULT_TIMELINE_STATE.transitions);
  const playhead = localPlayhead ?? (isHydrated ? storedState.playhead : DEFAULT_TIMELINE_STATE.playhead);
  const zoom = localZoom ?? (isHydrated ? storedState.zoom : DEFAULT_TIMELINE_STATE.zoom);
  const storedSelection = resolveTimelineSelection(
    storedState.selectedClipId,
    storedState.selectedTransitionId,
    clips,
    transitions
  );
  const selectedClipId = React.useMemo(() => {
    const candidate =
      localSelectedClipId !== undefined ? localSelectedClipId : storedSelection.selectedClipId;
    return candidate && clips.some((clip) => clip.id === candidate) ? candidate : null;
  }, [localSelectedClipId, storedSelection.selectedClipId, clips]);
  const selectedTransitionId = React.useMemo(() => {
    const candidate =
      localSelectedTransitionId !== undefined
        ? localSelectedTransitionId
        : storedSelection.selectedTransitionId;
    return candidate && transitions.some((transition) => transition.id === candidate)
      ? candidate
      : null;
  }, [localSelectedTransitionId, storedSelection.selectedTransitionId, transitions]);

  // Undo / Redo Stacks storing both clips and transitions atomically
  const undoStackRef = React.useRef<HistorySnapshot[]>([]);
  const redoStackRef = React.useRef<HistorySnapshot[]>([]);
  const [canUndo, setCanUndo] = React.useState<boolean>(false);
  const [canRedo, setCanRedo] = React.useState<boolean>(false);

  // Dedicated Audio Elements Pool for multi-track synchronized timeline playback
  const audioElementsRef = React.useRef<Map<string, HTMLAudioElement>>(new Map());

  React.useEffect(() => {
    const pool = audioElementsRef.current;
    return () => {
      for (const el of pool.values()) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
      pool.clear();
    };
  }, []);

  const syncHistoryFlags = React.useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  // Persist a partial patch and feed success/failure back into visible state.
  const persistPartial = React.useCallback(
    (patch: Partial<typeof DEFAULT_TIMELINE_STATE>): boolean => {
      if (!isHydrated) return false;

      dispatchSaveStatus({ type: "attempt" });
      const result = saveStoredTimelineState(patch);
      if (result.ok) {
        dispatchSaveStatus({ type: "success" });
        return true;
      }

      console.error("Failed to persist timeline state:", result.error);
      dispatchSaveStatus({ type: "failure", message: formatTimelineSaveError(result.error) });
      return false;
    },
    [isHydrated]
  );

  // Save changes to localStorage with hydration guard
  const persistTimeline = React.useCallback(
    (
      newClips: TimelineClip[],
      newTransitions: TimelineTransition[],
      newSelectedClipId?: string | null,
      newSelectedTransitionId?: string | null
    ) => {
      if (!isHydrated) return false;
      return persistPartial({
        clips: newClips,
        transitions: newTransitions,
        selectedClipId: newSelectedClipId !== undefined ? newSelectedClipId : selectedClipId,
        selectedTransitionId:
          newSelectedTransitionId !== undefined ? newSelectedTransitionId : selectedTransitionId,
      });
    },
    [isHydrated, persistPartial, selectedClipId, selectedTransitionId]
  );

  const dismissSaveError = React.useCallback(() => {
    dispatchSaveStatus({ type: "dismiss" });
  }, []);

  // Persist playhead only at explicit boundaries (seek end, pause, frame step).
  const playheadCommitGateRef = React.useRef(createPlayheadCommitGate());
  const commitPlayhead = React.useCallback(
    (time?: number) => {
      if (!isHydrated) return;
      const next = Math.max(0, time ?? playhead);
      playheadCommitGateRef.current.commit(next, (seconds) => {
        persistPartial({ playhead: seconds });
      });
    },
    [isHydrated, persistPartial, playhead]
  );

  // Push current snapshot to undo stack before a mutation
  const pushHistorySnapshot = React.useCallback(
    (currentClips: TimelineClip[], currentTransitions: TimelineTransition[]) => {
      undoStackRef.current.push({
        clips: JSON.parse(JSON.stringify(currentClips)),
        transitions: JSON.parse(JSON.stringify(currentTransitions)),
      });
      if (undoStackRef.current.length > MAX_HISTORY) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      syncHistoryFlags();
    },
    [syncHistoryFlags]
  );

  const setProjectTitle = React.useCallback(
    (title: string) => {
      setLocalTitle(title);
      persistPartial({ projectTitle: title });
    },
    [persistPartial]
  );

  const setAspectRatio = React.useCallback(
    (ratio: "9:16" | "16:9") => {
      setLocalAspectRatio(ratio);
      persistPartial({ aspectRatio: ratio });
    },
    [persistPartial]
  );

  const setZoom = React.useCallback(
    (newZoom: number) => {
      const clamped = Math.min(500, Math.max(10, newZoom));
      setLocalZoom(clamped);
      persistPartial({ zoom: clamped });
    },
    [persistPartial]
  );

  const totalDuration = React.useMemo(() => {
    const activeClips = isHydrated ? clips : DEFAULT_TIMELINE_STATE.clips;
    if (activeClips.length === 0) return 0;
    const maxEnd = Math.max(...activeClips.map((c) => c.startTime + c.duration));
    return parseFloat(maxEnd.toFixed(3));
  }, [isHydrated, clips]);

  const setPlayhead = React.useCallback((time: number) => {
    setLocalPlayhead(Math.max(0, time));
  }, []);

  const seek = React.useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(totalDuration, time));
      setLocalPlayhead(clamped);
    },
    [totalDuration]
  );

  // Step playhead forward by exactly 1 frame at 30 fps
  const stepFrameForward = React.useCallback(() => {
    setIsPlaying(false);
    const next = stepFrame(playhead, 1, totalDuration, TIMELINE_FPS);
    setLocalPlayhead(next);
    commitPlayhead(next);
  }, [totalDuration, playhead, commitPlayhead]);

  // Step playhead backward by exactly 1 frame at 30 fps
  const stepFrameBackward = React.useCallback(() => {
    setIsPlaying(false);
    const next = stepFrame(playhead, -1, totalDuration, TIMELINE_FPS);
    setLocalPlayhead(next);
    commitPlayhead(next);
  }, [totalDuration, playhead, commitPlayhead]);

  const togglePlay = React.useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const pause = React.useCallback(() => {
    setIsPlaying(false);
  }, []);

  const [playbackSpeed, setPlaybackSpeed] = React.useState<number>(1.0);
  const playbackSpeedRef = React.useRef(playbackSpeed);
  React.useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const [masterVolume, setMasterVolume] = React.useState<number>(1.0);
  const [isMuted, setIsMuted] = React.useState<boolean>(false);

  const isPlayingRef = React.useRef(isPlaying);
  React.useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Persist the final playhead when playback pauses or reaches the end.
  const wasPlayingRef = React.useRef(false);
  React.useEffect(() => {
    const wasPlaying = wasPlayingRef.current;
    wasPlayingRef.current = isPlaying;
    if (isHydrated && wasPlaying && !isPlaying) {
      commitPlayhead(playhead);
    }
  }, [isPlaying, isHydrated, playhead, commitPlayhead]);

  // Keep a ref to the latest playhead so the animation frame loop never needs to restart
  const playheadRef = React.useRef(playhead);
  React.useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  // Real-time playback loop for timeline clock
  React.useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const dt = Math.max(0, (now - lastTime) / 1000);
      lastTime = now;

      setLocalPlayhead((prev) => {
        const current = prev ?? playheadRef.current;
        const next = current + dt * playbackSpeedRef.current;
        if (next >= totalDuration) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, totalDuration]);

  // Synchronize multi-track audio playback with timeline clock
  React.useEffect(() => {
    const pool = audioElementsRef.current;
    const allAudioClips = clips.filter((c) => isAudioTrack(c.trackId));
    const activeAudioClips = allAudioClips.filter(
      (c) => playhead >= c.startTime && playhead < c.startTime + c.duration
    );
    const activeClipIds = new Set(activeAudioClips.map((c) => c.id));

    // Pause and remove audio elements for clips that are no longer active
    for (const [clipId, audioEl] of pool.entries()) {
      if (!activeClipIds.has(clipId)) {
        audioEl.pause();
        audioEl.removeAttribute("src");
        audioEl.load();
        pool.delete(clipId);
      }
    }

    // Synchronize and mix each active audio clip concurrently
    for (const clip of activeAudioClips) {
      const asset = assets.find((a) => a.id === clip.assetId);
      if (!asset || !asset.url) continue;

      let audioEl = pool.get(clip.id);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.preload = "auto";
        pool.set(clip.id, audioEl);
      }

      if (audioEl.src !== asset.url) {
        audioEl.src = asset.url;
      }

      const targetTime = (playhead - clip.startTime) + clip.inPoint;
      if (Math.abs(audioEl.currentTime - targetTime) > 0.15) {
        audioEl.currentTime = Math.max(0, targetTime);
      }

      const clipRelativeTime = playhead - clip.startTime;
      const currentGain = calculateAudioGain(
        clipRelativeTime,
        clip.duration,
        clip.volume ?? 1.0,
        clip.fadeInDuration ?? 0,
        clip.fadeOutDuration ?? 0
      );

      const finalVolume = isMuted ? 0 : Math.max(0, Math.min(1.0, currentGain * masterVolume));
      audioEl.volume = finalVolume;
      const targetRate = (clip.speed || 1.0) * playbackSpeedRef.current;
      if (audioEl.playbackRate !== targetRate) {
        audioEl.playbackRate = targetRate;
      }

      if (isPlaying) {
        audioEl.play().catch(() => {});
      } else {
        audioEl.pause();
      }
    }
  }, [playhead, isPlaying, clips, assets, isMuted, masterVolume]);

  const selectClip = React.useCallback(
    (clipId: string | null) => {
      setLocalSelectedClipId(clipId);
      if (clipId) setLocalSelectedTransitionId(null);
      persistPartial(
        clipId
          ? { selectedClipId: clipId, selectedTransitionId: null }
          : { selectedClipId: null }
      );
    },
    [persistPartial]
  );

  const selectTransition = React.useCallback(
    (transitionId: string | null) => {
      setLocalSelectedTransitionId(transitionId);
      if (transitionId) setLocalSelectedClipId(null);
      persistPartial(
        transitionId
          ? { selectedClipId: null, selectedTransitionId: transitionId }
          : { selectedTransitionId: null }
      );
    },
    [persistPartial]
  );

  // Clear selections that refer to clips/transitions removed while the editor
  // was closed, so stale IDs do not reappear after hydration.
  React.useEffect(() => {
    if (!isHydrated) return;

    if (
      storedState.selectedClipId &&
      !clips.some((clip) => clip.id === storedState.selectedClipId)
    ) {
      persistPartial({ selectedClipId: null });
    }

    if (
      storedState.selectedTransitionId &&
      !transitions.some(
        (transition) =>
          transition.id === storedState.selectedTransitionId &&
          clips.some((clip) => clip.id === transition.fromClipId) &&
          clips.some((clip) => clip.id === transition.toClipId)
      )
    ) {
      persistPartial({ selectedTransitionId: null });
    }
  }, [
    isHydrated,
    storedState.selectedClipId,
    storedState.selectedTransitionId,
    clips,
    transitions,
    persistPartial,
  ]);

  // Register asset references for safe media deletion without importing the
  // timeline context from the media library.
  React.useEffect(() => {
    if (!isHydrated) return;
    registerTimelineAssetReferences(clips);
  }, [isHydrated, clips]);

  React.useEffect(() => {
    return () => clearRegisteredTimelineAssetReferences();
  }, []);

  const selectedClip = React.useMemo(() => {
    if (!selectedClipId) return null;
    return clips.find((c) => c.id === selectedClipId) || null;
  }, [selectedClipId, clips]);

  const selectedTransition = React.useMemo(() => {
    if (!selectedTransitionId) return null;
    return transitions.find((t) => t.id === selectedTransitionId) || null;
  }, [selectedTransitionId, transitions]);

  // 1. ADD ASSET TO TIMELINE
  const addAssetToTimeline = React.useCallback(
    (asset: { id: string; name: string; category: "image" | "video" | "audio"; duration?: number | null }, targetTrack?: TrackId, customStartTime?: number) => {
      pushHistorySnapshot(clips, transitions);

      const trackId: TrackId = targetTrack || (asset.category === "audio" ? "audio" : "visual-1");

      let duration = 3.0;
      if (asset.category === "video" || asset.category === "audio") {
        duration = asset.duration && asset.duration > 0 ? asset.duration : 4.0;
      }

      const newClip: TimelineClip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        assetId: asset.id,
        name: asset.name,
        type: asset.category,
        trackId,
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
        const insertResult = insertClipAtTime(newClip, customStartTime, clips);
        updatedClips = insertResult.clips;

        // If an existing clip was split, outgoing transitions must follow the
        // right-hand segment that inherited the original clip's tail.
        if (insertResult.split) {
          const { originalClipId, rightPartId } = insertResult.split;
          updatedTransitions = transitions.map((t) =>
            t.fromClipId === originalClipId
              ? { ...t, fromClipId: rightPartId }
              : t
          );
        }

        updatedTransitions = reconcileTransitionsForClips(
          updatedTransitions,
          updatedClips
        );
      } else {
        // No explicit position: keep the existing append/next-free-slot behavior.
        const startTime = findNextNonOverlappingStartTime(
          trackId,
          duration,
          clips
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
      persistTimeline(updatedClips, updatedTransitions, newClip.id, null);
    },
    [clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 2. MOVE CLIP
  const moveClip = React.useCallback(
    (clipId: string, newStartTime: number) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      pushHistorySnapshot(clips, transitions);

      // Reorder within the same track (closes the source gap and makes room at
      // the insertion point) instead of clamping against occupied intervals.
      const updatedClips = reorderClipOnTrack(
        target,
        newStartTime,
        clips
      ).clips;

      const validTransitions = reconcileTransitionsForClips(
        transitions,
        updatedClips
      );

      setLocalClips(updatedClips);
      setLocalTransitions(validTransitions);
      persistTimeline(updatedClips, validTransitions);
    },
    [clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 3. TRIM CLIP / ADJUST DURATION
  const trimClip = React.useCallback(
    (clipId: string, newDuration: number) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      pushHistorySnapshot(clips, transitions);

      const speed = target.speed && target.speed > 0 ? target.speed : 1.0;
      let clampedDuration = Math.max(MIN_CLIP_DURATION, newDuration);
      if (target.sourceDuration && target.sourceDuration > 0) {
        const remaining = (target.sourceDuration - target.inPoint) / speed;
        clampedDuration = Math.min(clampedDuration, remaining);
      }

      // Apply ripple extension to downstream clips if extending duration
      const updatedClips = applyRippleExtend(clipId, clampedDuration, clips);

      // Validate transitions connected to shifted or resized clips
      const validTransitions = transitions.filter((t) => {
        const from = updatedClips.find((c) => c.id === t.fromClipId);
        const to = updatedClips.find((c) => c.id === t.toClipId);
        if (!from || !to) return false;
        return areClipsAdjacentForTransition(from, to);
      }).map((t) => {
        const from = updatedClips.find((c) => c.id === t.fromClipId);
        const to = updatedClips.find((c) => c.id === t.toClipId);
        const safeDur = validateTransitionDuration(t.duration, from, to);
        return { ...t, duration: safeDur };
      });

      setLocalClips(updatedClips);
      setLocalTransitions(validTransitions);
      persistTimeline(updatedClips, validTransitions);
    },
    [clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // Transient clip update (during real-time drag gestures, without pushing history)
  const setClipsTransient = React.useCallback((newClips: TimelineClip[]) => {
    setLocalClips(newClips);
  }, []);

  // Commit completed drag gesture as one single undoable history snapshot
  const commitClipGesture = React.useCallback(
    (originalClips: TimelineClip[], finalClips: TimelineClip[]) => {
      const changed = JSON.stringify(originalClips) !== JSON.stringify(finalClips);
      if (!changed) return;

      pushHistorySnapshot(originalClips, transitions);

      // Validate transitions after move or trim (reorder can break adjacency)
      const validTransitions = reconcileTransitionsForClips(
        transitions,
        finalClips
      );

      setLocalClips(finalClips);
      setLocalTransitions(validTransitions);
      persistTimeline(finalClips, validTransitions);
    },
    [transitions, pushHistorySnapshot, persistTimeline]
  );

  // Safely cancel in-progress gesture without corrupting state
  const cancelClipGesture = React.useCallback((originalClips: TimelineClip[]) => {
    setLocalClips(originalClips);
  }, []);

  // 4. UPDATE CLIP GENERAL PROPERTIES
  const updateClip = React.useCallback(
    (clipId: string, updates: Partial<TimelineClip>) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      // Prevent switching visual layer if target lane is already occupied at this interval
      if (updates.trackId && updates.trackId !== target.trackId && isVisualTrack(updates.trackId)) {
        if (hasVisualOverlap({ ...target, ...updates, trackId: updates.trackId }, clips)) {
          return;
        }
      }

      pushHistorySnapshot(clips, transitions);

      const updatedClips = clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c));
      setLocalClips(updatedClips);
      persistTimeline(updatedClips, transitions);
    },
    [clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 5. SPLIT SELECTED CLIP AT PLAYHEAD (Ctrl+B)
  const splitClipAtPlayhead = React.useCallback(
    (targetClipId?: string) => {
      const idToSplit = targetClipId || selectedClipId;
      if (!idToSplit) return;

      const clip = clips.find((c) => c.id === idToSplit);
      if (!clip) return;

      const clipEnd = clip.startTime + clip.duration;
      if (playhead <= clip.startTime + MIN_CLIP_DURATION || playhead >= clipEnd - MIN_CLIP_DURATION) {
        return;
      }

      pushHistorySnapshot(clips, transitions);

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

      // Reconcile transitions:
      // - Incoming transition to the original clip stays on part1 with revalidated duration
      // - Outgoing transition from the original clip shifts its fromClipId to part2 with revalidated duration
      // - Stale transitions that are no longer adjacent are safely pruned
      const reconciledTransitions: TimelineTransition[] = [];
      for (const t of transitions) {
        if (t.toClipId === idToSplit) {
          const from = clipMap.get(t.fromClipId);
          if (from && areClipsAdjacentForTransition(from, part1)) {
            const safeDur = validateTransitionDuration(t.duration, from, part1);
            reconciledTransitions.push({ ...t, duration: safeDur });
          }
        } else if (t.fromClipId === idToSplit) {
          const to = clipMap.get(t.toClipId);
          if (to && areClipsAdjacentForTransition(part2, to)) {
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
      persistTimeline(updatedClips, reconciledTransitions, part2.id, null);
    },
    [clips, transitions, selectedClipId, playhead, pushHistorySnapshot, persistTimeline]
  );

  // 6. DELETE SELECTED CLIP (Delete/Backspace) with Ripple Delete
  const deleteClip = React.useCallback(
    (clipId: string) => {
      const exists = clips.some((c) => c.id === clipId);
      if (!exists) return;

      pushHistorySnapshot(clips, transitions);

      const { updatedClips } = applyRippleDelete(clipId, clips);

      // Reconcile transitions:
      // - Remove any transitions connected to the deleted clip
      // - For remaining transitions, ensure their connecting clips are still adjacent and durations valid
      const remainingTransitions = transitions.filter(
        (t) => t.fromClipId !== clipId && t.toClipId !== clipId
      );

      const validTransitions = remainingTransitions
        .filter((t) => {
          const from = updatedClips.find((c) => c.id === t.fromClipId);
          const to = updatedClips.find((c) => c.id === t.toClipId);
          if (!from || !to) return false;
          return areClipsAdjacentForTransition(from, to);
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
      persistTimeline(updatedClips, validTransitions, newSelected, null);
    },
    [clips, transitions, selectedClipId, pushHistorySnapshot, persistTimeline]
  );

  // 7. DUPLICATE SELECTED CLIP (Ctrl+D)
  const duplicateClip = React.useCallback(
    (clipId: string) => {
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;

      pushHistorySnapshot(clips, transitions);

      // Find next available placement that does not overlap same visual lane
      const preferredStart = clip.startTime + clip.duration;
      const targetStart = findNextNonOverlappingStartTime(
        clip.trackId,
        clip.duration,
        clips,
        preferredStart
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
      persistTimeline(updatedClips, transitions, duplicate.id, null);
    },
    [clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 8. ADD VISUAL TRANSITION
  const addTransition = React.useCallback(
    (fromClipId: string, toClipId: string, type: TransitionType = "cross-dissolve", duration: number = 0.5) => {
      const fromClip = clips.find((c) => c.id === fromClipId);
      const toClip = clips.find((c) => c.id === toClipId);
      if (!fromClip || !toClip) return;
      if (!isVisualTrack(fromClip.trackId) || !areClipsOnSameTrack(fromClip.trackId, toClip.trackId)) return;
      if (!areClipsAdjacentForTransition(fromClip, toClip)) return;

      pushHistorySnapshot(clips, transitions);

      const safeDur = validateTransitionDuration(duration, fromClip, toClip);
      const newTransition: TimelineTransition = {
        id: `trans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        duration: safeDur,
        fromClipId,
        toClipId,
        trackId: normalizeVisualTrackId(fromClip.trackId),
      };

      // Filter out existing transition between these two clips and add the new one
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
      persistTimeline(clips, updatedTransitions, null, newTransition.id);
    },
    [clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 9. UPDATE TRANSITION
  const updateTransition = React.useCallback(
    (transitionId: string, updates: Partial<TimelineTransition>) => {
      const target = transitions.find((t) => t.id === transitionId);
      if (!target) return;

      pushHistorySnapshot(clips, transitions);

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
    [clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 10. DELETE TRANSITION
  const deleteTransition = React.useCallback(
    (transitionId: string) => {
      const exists = transitions.some((t) => t.id === transitionId);
      if (!exists) return;

      pushHistorySnapshot(clips, transitions);

      const updatedTransitions = transitions.filter((t) => t.id !== transitionId);
      setLocalTransitions(updatedTransitions);
      const newSelectedTrans = selectedTransitionId === transitionId ? null : selectedTransitionId;
      setLocalSelectedTransitionId(newSelectedTrans);
      persistTimeline(clips, updatedTransitions, selectedClipId, newSelectedTrans);
    },
    [clips, transitions, selectedTransitionId, selectedClipId, pushHistorySnapshot, persistTimeline]
  );

  // 11. APPLY TO ALL TRANSITIONS
  const applyAllTransitions = React.useCallback(
    (sourceTransitionId: string) => {
      const source = transitions.find((t) => t.id === sourceTransitionId);
      if (!source) {
        return { success: false, message: "Selected transition not found.", count: 0 };
      }

      pushHistorySnapshot(clips, transitions);

      const result = executeApplyToAll(source, transitions, clips);
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
        selectedClipId,
        nextSelectedTransitionId
      );

      return { success: true, message: result.message, count: result.count };
    },
    [
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
        (c) => isVisualTrack(c.trackId) && c.type === "image"
      );
      if (targetClips.length === 0) {
        return { success: false, message: "No image scenes found on timeline.", count: 0 };
      }

      pushHistorySnapshot(clips, transitions);

      const updatedClips = clips.map((c) => {
        if (isVisualTrack(c.trackId) && c.type === "image") {
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
    [clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 13. FIT VISUALS TO VOICEOVER ACTION
  const fitVisualsToVoiceover = React.useCallback(() => {
    const result = calculateFitVisualsToVoiceover(clips, transitions);
    if (result.success) {
      pushHistorySnapshot(clips, transitions);
      setLocalClips(result.updatedClips);
      setLocalTransitions(result.updatedTransitions);
      persistTimeline(result.updatedClips, result.updatedTransitions);
    }
    return { success: result.success, message: result.message };
  }, [clips, transitions, pushHistorySnapshot, persistTimeline]);

  // 12. UNDO & REDO
  const undo = React.useCallback(() => {
    if (undoStackRef.current.length === 0) return;

    const previous = undoStackRef.current.pop()!;
    redoStackRef.current.push({
      clips: JSON.parse(JSON.stringify(clips)),
      transitions: JSON.parse(JSON.stringify(transitions)),
    });

    setLocalClips(previous.clips);
    setLocalTransitions(previous.transitions);
    persistTimeline(previous.clips, previous.transitions);
    syncHistoryFlags();
  }, [clips, transitions, persistTimeline, syncHistoryFlags]);

  const redo = React.useCallback(() => {
    if (redoStackRef.current.length === 0) return;

    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push({
      clips: JSON.parse(JSON.stringify(clips)),
      transitions: JSON.parse(JSON.stringify(transitions)),
    });

    setLocalClips(next.clips);
    setLocalTransitions(next.transitions);
    persistTimeline(next.clips, next.transitions);
    syncHistoryFlags();
  }, [clips, transitions, persistTimeline, syncHistoryFlags]);

  // Space Key Hold / Tap State Refs (persistent across renders)
  const spaceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingSpaceRef = React.useRef<boolean>(false);
  const wasPlayingBeforeHoldRef = React.useRef<boolean>(false);

  // Stable actions ref so global keyboard shortcuts never tear down 60 times per second during playback
  const actionsRef = React.useRef({
    undo,
    redo,
    stepFrameForward,
    stepFrameBackward,
    splitClipAtPlayhead,
    duplicateClip,
    deleteClip,
    deleteTransition,
    togglePlay,
    selectedClipId,
    selectedTransitionId,
  });

  React.useEffect(() => {
    actionsRef.current = {
      undo,
      redo,
      stepFrameForward,
      stepFrameBackward,
      splitClipAtPlayhead,
      duplicateClip,
      deleteClip,
      deleteTransition,
      togglePlay,
      selectedClipId,
      selectedTransitionId,
    };
  });

  // Keyboard Shortcuts Listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.tagName === "SELECT" ||
        activeEl?.getAttribute("contenteditable") === "true" ||
        activeEl?.getAttribute("role") === "slider";

      // Guard: do not intercept if typing in an input, textarea, or slider
      if (isInput) return;

      // Guard: do not intercept if a modal or dialog owns focus
      const isInsideDialog = Boolean(
        activeEl?.closest('[role="dialog"]') ||
        activeEl?.closest('[role="alertdialog"]')
      );
      if (isInsideDialog) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Single-Frame Step Backward (Left Arrow)
      if (!modifier && !e.altKey && (e.key === "ArrowLeft" || e.key === "Left")) {
        e.preventDefault();
        actionsRef.current.stepFrameBackward();
        return;
      }

      // Single-Frame Step Forward (Right Arrow)
      if (!modifier && !e.altKey && (e.key === "ArrowRight" || e.key === "Right")) {
        e.preventDefault();
        actionsRef.current.stepFrameForward();
        return;
      }

      if (modifier && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        actionsRef.current.undo();
      } else if (
        (modifier && e.key.toLowerCase() === "y") ||
        (modifier && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        actionsRef.current.redo();
      } else if (modifier && e.key.toLowerCase() === "b") {
        e.preventDefault();
        actionsRef.current.splitClipAtPlayhead();
      } else if (modifier && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (actionsRef.current.selectedClipId) actionsRef.current.duplicateClip(actionsRef.current.selectedClipId);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (actionsRef.current.selectedClipId) {
          e.preventDefault();
          actionsRef.current.deleteClip(actionsRef.current.selectedClipId);
        } else if (actionsRef.current.selectedTransitionId) {
          e.preventDefault();
          actionsRef.current.deleteTransition(actionsRef.current.selectedTransitionId);
        }
      } else if (e.key === " " || e.code === "Space") {
        if (e.defaultPrevented) return;
        e.preventDefault();

        // Avoid repeated keydown handling while holding Space
        if (e.repeat) return;

        wasPlayingBeforeHoldRef.current = isPlayingRef.current;
        isHoldingSpaceRef.current = false;

        if (spaceTimerRef.current) {
          clearTimeout(spaceTimerRef.current);
        }

        // CapCut-style 2X fast forward when Space is held down (>200ms)
        spaceTimerRef.current = setTimeout(() => {
          isHoldingSpaceRef.current = true;
          setPlaybackSpeed(2.0);
          if (!isPlayingRef.current) {
            setIsPlaying(true);
          }
        }, 200);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.tagName === "SELECT" ||
        activeEl?.getAttribute("contenteditable") === "true" ||
        activeEl?.getAttribute("role") === "slider";

      // Guard: do not intercept if typing in an input, textarea, or slider
      if (isInput) return;

      const isInsideDialog = Boolean(
        activeEl?.closest('[role="dialog"]') ||
        activeEl?.closest('[role="alertdialog"]')
      );
      if (isInsideDialog) return;

      if (e.key === " " || e.code === "Space") {
        if (spaceTimerRef.current) {
          clearTimeout(spaceTimerRef.current);
          spaceTimerRef.current = null;
        }

        if (isHoldingSpaceRef.current) {
          // Released after holding Space: restore 1.0x playback
          isHoldingSpaceRef.current = false;
          setPlaybackSpeed(1.0);
          // If it wasn't playing prior to holding Space, pause it
          if (!wasPlayingBeforeHoldRef.current) {
            setIsPlaying(false);
          }
        } else {
          // Short tap (< 200ms): standard Play / Pause toggle
          actionsRef.current.togglePlay();
        }
      }
    };

    const handleBlur = () => {
      // If focus lost or window blurs while Space was held down, restore 1.0x immediately
      if (spaceTimerRef.current) {
        clearTimeout(spaceTimerRef.current);
        spaceTimerRef.current = null;
      }
      if (isHoldingSpaceRef.current) {
        isHoldingSpaceRef.current = false;
        setPlaybackSpeed(1.0);
        if (!wasPlayingBeforeHoldRef.current) {
          setIsPlaying(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return (
    <TimelineContext.Provider
      value={{
        isHydrated,
        clips,
        transitions,
        selectedClipId,
        selectedClip,
        selectedTransitionId,
        selectedTransition,
        playhead,
        isPlaying,
        zoom,
        totalDuration,
        projectTitle,
        aspectRatio,
        canUndo,
        canRedo,
        saveError: saveStatus.error,
        isDirty: saveStatus.isDirty,
        setProjectTitle,
        setAspectRatio,
        setPlayhead,
        commitPlayhead,
        seek,
        dismissSaveError,
        stepFrameForward,
        stepFrameBackward,
        togglePlay,
        pause,
        playbackSpeed,
        setPlaybackSpeed,
        masterVolume,
        setMasterVolume,
        isMuted,
        setIsMuted,
        setZoom,
        selectClip,
        selectTransition,
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
        applyToAllTransitions: applyAllTransitions,
        applyMotionToAllClips,
        fitVisualsToVoiceover,
        undo,
        redo,
      }}
    >
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimeline(): TimelineContextType {
  const context = React.useContext(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within a TimelineProvider");
  }
  return context;
}
