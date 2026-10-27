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
  areClipsOnSameTrack,
  normalizeVisualTrackId,
} from "@/types/timeline";
import { useMediaLibrary } from "@/lib/use-media-library";
import {
  DEFAULT_TIMELINE_STATE,
  saveStoredTimelineState,
  useTimelineStorage,
} from "@/lib/timeline-storage";
import { calculateFitVisualsToVoiceover } from "@/lib/fit-visuals";
import {
  validateTransitionDuration,
  areClipsAdjacentForTransition,
  applyToAllTransitions as executeApplyToAll,
} from "@/lib/transition-helpers";
import { stepFrame, TIMELINE_FPS } from "@/lib/frame-navigation";

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
  canUndo: boolean;
  canRedo: boolean;
  setProjectTitle: (title: string) => void;
  setPlayhead: (time: number) => void;
  seek: (time: number) => void;
  stepFrameForward: () => void;
  stepFrameBackward: () => void;
  togglePlay: () => void;
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
  fitVisualsToVoiceover: () => { success: boolean; message: string };
  undo: () => void;
  redo: () => void;
}

const TimelineContext = React.createContext<TimelineContextType | null>(null);

const MAX_HISTORY = 50;
const MIN_CLIP_DURATION = 0.5; // minimum 500ms
const emptySubscribe = () => () => {};

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
  const [localClips, setLocalClips] = React.useState<TimelineClip[] | null>(null);
  const [localTransitions, setLocalTransitions] = React.useState<TimelineTransition[] | null>(null);
  const [localSelectedClipId, setLocalSelectedClipId] = React.useState<string | null>(null);
  const [localSelectedTransitionId, setLocalSelectedTransitionId] = React.useState<string | null>(null);
  const [playhead, setPlayheadState] = React.useState<number>(0);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [localZoom, setLocalZoom] = React.useState<number | null>(null);

  // Derived active state: perfectly identical between server and client first render
  const projectTitle = localTitle ?? (isHydrated ? storedState.projectTitle : DEFAULT_TIMELINE_STATE.projectTitle);
  const clips = localClips ?? (isHydrated ? storedState.clips : DEFAULT_TIMELINE_STATE.clips);
  const transitions = localTransitions ?? (isHydrated ? storedState.transitions : DEFAULT_TIMELINE_STATE.transitions);
  const zoom = localZoom ?? (isHydrated ? storedState.zoom : DEFAULT_TIMELINE_STATE.zoom);
  const selectedClipId = localSelectedClipId ?? (isHydrated ? storedState.selectedClipId : null);
  const selectedTransitionId = localSelectedTransitionId ?? (isHydrated ? storedState.selectedTransitionId : null);

  // Undo / Redo Stacks storing both clips and transitions atomically
  const undoStackRef = React.useRef<HistorySnapshot[]>([]);
  const redoStackRef = React.useRef<HistorySnapshot[]>([]);
  const [canUndo, setCanUndo] = React.useState<boolean>(false);
  const [canRedo, setCanRedo] = React.useState<boolean>(false);

  // Dedicated Audio Element for synchronized timeline playback
  const audioElementRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioElementRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
      audioElementRef.current = null;
    };
  }, []);

  const syncHistoryFlags = React.useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  // Save changes to localStorage with hydration guard
  const persistTimeline = React.useCallback(
    (
      newClips: TimelineClip[],
      newTransitions: TimelineTransition[],
      newSelectedClipId?: string | null,
      newSelectedTransitionId?: string | null
    ) => {
      if (!isHydrated) return;
      saveStoredTimelineState({
        clips: newClips,
        transitions: newTransitions,
        selectedClipId: newSelectedClipId !== undefined ? newSelectedClipId : selectedClipId,
        selectedTransitionId:
          newSelectedTransitionId !== undefined ? newSelectedTransitionId : selectedTransitionId,
      });
    },
    [isHydrated, selectedClipId, selectedTransitionId]
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
      if (isHydrated) {
        saveStoredTimelineState({ projectTitle: title });
      }
    },
    [isHydrated]
  );

  const setZoom = React.useCallback(
    (newZoom: number) => {
      const clamped = Math.min(200, Math.max(50, newZoom));
      setLocalZoom(clamped);
      if (isHydrated) {
        saveStoredTimelineState({ zoom: clamped });
      }
    },
    [isHydrated]
  );

  const totalDuration = React.useMemo(() => {
    const activeClips = isHydrated ? clips : DEFAULT_TIMELINE_STATE.clips;
    if (activeClips.length === 0) return 10;
    const maxEnd = Math.max(...activeClips.map((c) => c.startTime + c.duration));
    return Math.max(10, Math.ceil(maxEnd + 2));
  }, [isHydrated, clips]);

  const setPlayhead = React.useCallback((time: number) => {
    setPlayheadState(Math.max(0, time));
  }, []);

  const seek = React.useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(totalDuration, time));
      setPlayheadState(clamped);
    },
    [totalDuration]
  );

  // Step playhead forward by exactly 1 frame at 30 fps
  const stepFrameForward = React.useCallback(() => {
    setIsPlaying(false);
    setPlayheadState((prev) => stepFrame(prev, 1, totalDuration, TIMELINE_FPS));
  }, [totalDuration]);

  // Step playhead backward by exactly 1 frame at 30 fps
  const stepFrameBackward = React.useCallback(() => {
    setIsPlaying(false);
    setPlayheadState((prev) => stepFrame(prev, -1, totalDuration, TIMELINE_FPS));
  }, [totalDuration]);

  const togglePlay = React.useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Real-time playback loop for timeline clock
  React.useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setPlayheadState((prev) => {
        const next = prev + dt;
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

  // Synchronize audio playback with timeline clock
  React.useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio) return;

    const audioClips = clips.filter((c) => c.trackId === "audio");
    const activeAudioClip = audioClips.find(
      (c) => playhead >= c.startTime && playhead < c.startTime + c.duration
    );

    if (activeAudioClip) {
      const asset = assets.find((a) => a.id === activeAudioClip.assetId);
      if (asset && asset.url) {
        if (audio.src !== asset.url) {
          audio.src = asset.url;
        }

        const targetTime = (playhead - activeAudioClip.startTime) + activeAudioClip.inPoint;
        if (Math.abs(audio.currentTime - targetTime) > 0.15) {
          audio.currentTime = Math.max(0, targetTime);
        }

        audio.volume = typeof activeAudioClip.volume === "number" ? Math.max(0, Math.min(1, activeAudioClip.volume)) : 1.0;

        if (isPlaying) {
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
        return;
      }
    }

    audio.pause();
  }, [playhead, isPlaying, clips, assets]);

  const selectClip = React.useCallback(
    (clipId: string | null) => {
      setLocalSelectedClipId(clipId);
      if (clipId) setLocalSelectedTransitionId(null);
    },
    []
  );

  const selectTransition = React.useCallback(
    (transitionId: string | null) => {
      setLocalSelectedTransitionId(transitionId);
      if (transitionId) setLocalSelectedClipId(null);
    },
    []
  );

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
      const trackClips = clips.filter((c) => c.trackId === trackId);

      let startTime = customStartTime !== undefined ? customStartTime : 0;
      if (customStartTime === undefined && trackClips.length > 0) {
        startTime = Math.max(...trackClips.map((c) => c.startTime + c.duration));
      }

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
        startTime: Math.max(0, startTime),
        duration,
        inPoint: 0,
        outPoint: duration,
        sourceDuration: asset.duration || null,
        speed: 1.0,
        volume: 1.0,
      };

      const updatedClips = [...clips, newClip];
      setLocalClips(updatedClips);
      setLocalSelectedClipId(newClip.id);
      setLocalSelectedTransitionId(null);
      persistTimeline(updatedClips, transitions, newClip.id, null);
    },
    [clips, transitions, pushHistorySnapshot, persistTimeline]
  );

  // 2. MOVE CLIP
  const moveClip = React.useCallback(
    (clipId: string, newStartTime: number) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      pushHistorySnapshot(clips, transitions);

      const clampedStart = Math.max(0, newStartTime);
      const updatedClips = clips.map((c) =>
        c.id === clipId ? { ...c, startTime: clampedStart } : c
      );

      // Clean up transitions that are no longer valid because clips were moved apart
      const validTransitions = transitions.filter((t) => {
        if (t.fromClipId === clipId || t.toClipId === clipId) {
          const from = updatedClips.find((c) => c.id === t.fromClipId);
          const to = updatedClips.find((c) => c.id === t.toClipId);
          if (!from || !to) return false;
          return areClipsAdjacentForTransition(from, to);
        }
        return true;
      });

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

      let clampedDuration = Math.max(MIN_CLIP_DURATION, newDuration);
      if (target.sourceDuration && target.sourceDuration > 0) {
        const remaining = target.sourceDuration - target.inPoint;
        clampedDuration = Math.min(clampedDuration, remaining);
      }

      const updatedClips = clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              duration: clampedDuration,
              outPoint: c.inPoint + clampedDuration,
            }
          : c
      );

      // Validate transitions connected to this clip to ensure duration doesn't exceed bounds
      const validTransitions = transitions.map((t) => {
        if (t.fromClipId === clipId || t.toClipId === clipId) {
          const from = updatedClips.find((c) => c.id === t.fromClipId);
          const to = updatedClips.find((c) => c.id === t.toClipId);
          const safeDur = validateTransitionDuration(t.duration, from, to);
          return { ...t, duration: safeDur };
        }
        return t;
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

      // Validate transitions after move or trim
      const validTransitions = transitions.filter((t) => {
        const from = finalClips.find((c) => c.id === t.fromClipId);
        const to = finalClips.find((c) => c.id === t.toClipId);
        if (!from || !to) return false;
        return areClipsAdjacentForTransition(from, to);
      });

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

      const splitOffset = playhead - clip.startTime;
      const part1Duration = splitOffset;
      const part2Duration = clip.duration - splitOffset;

      const part1: TimelineClip = {
        ...clip,
        duration: part1Duration,
        outPoint: clip.inPoint + part1Duration,
      };

      const part2: TimelineClip = {
        ...clip,
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        startTime: playhead,
        duration: part2Duration,
        inPoint: clip.inPoint + splitOffset,
        outPoint: clip.outPoint,
      };

      const updatedClips = clips.flatMap((c) => (c.id === idToSplit ? [part1, part2] : [c]));
      setLocalClips(updatedClips);
      setLocalSelectedClipId(part2.id);
      setLocalSelectedTransitionId(null);
      persistTimeline(updatedClips, transitions, part2.id, null);
    },
    [clips, transitions, selectedClipId, playhead, pushHistorySnapshot, persistTimeline]
  );

  // 6. DELETE SELECTED CLIP (Delete/Backspace)
  const deleteClip = React.useCallback(
    (clipId: string) => {
      const exists = clips.some((c) => c.id === clipId);
      if (!exists) return;

      pushHistorySnapshot(clips, transitions);

      const updatedClips = clips.filter((c) => c.id !== clipId);
      // Clean up any transitions connected to this deleted clip
      const updatedTransitions = transitions.filter(
        (t) => t.fromClipId !== clipId && t.toClipId !== clipId
      );

      setLocalClips(updatedClips);
      setLocalTransitions(updatedTransitions);
      const newSelected = selectedClipId === clipId ? null : selectedClipId;
      setLocalSelectedClipId(newSelected);
      setLocalSelectedTransitionId(null);
      persistTimeline(updatedClips, updatedTransitions, newSelected, null);
    },
    [clips, transitions, selectedClipId, pushHistorySnapshot, persistTimeline]
  );

  // 7. DUPLICATE SELECTED CLIP (Ctrl+D)
  const duplicateClip = React.useCallback(
    (clipId: string) => {
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;

      pushHistorySnapshot(clips, transitions);

      const duplicate: TimelineClip = {
        ...clip,
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: `${clip.name} (Copy)`,
        startTime: clip.startTime + clip.duration,
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
      setLocalTransitions(result.updatedTransitions);
      persistTimeline(clips, result.updatedTransitions);

      return { success: true, message: result.message, count: result.count };
    },
    [transitions, clips, pushHistorySnapshot, persistTimeline]
  );

  // 12. FIT VISUALS TO VOICEOVER ACTION
  const fitVisualsToVoiceover = React.useCallback(() => {
    const result = calculateFitVisualsToVoiceover(clips);
    if (result.success) {
      pushHistorySnapshot(clips, transitions);
      setLocalClips(result.updatedClips);
      persistTimeline(result.updatedClips, transitions);
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
        stepFrameBackward();
        return;
      }

      // Single-Frame Step Forward (Right Arrow)
      if (!modifier && !e.altKey && (e.key === "ArrowRight" || e.key === "Right")) {
        e.preventDefault();
        stepFrameForward();
        return;
      }

      if (modifier && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (modifier && e.key.toLowerCase() === "y") ||
        (modifier && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        redo();
      } else if (modifier && e.key.toLowerCase() === "b") {
        e.preventDefault();
        splitClipAtPlayhead();
      } else if (modifier && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (selectedClipId) duplicateClip(selectedClipId);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipId) {
          e.preventDefault();
          deleteClip(selectedClipId);
        } else if (selectedTransitionId) {
          e.preventDefault();
          deleteTransition(selectedTransitionId);
        }
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
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
  ]);

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
        canUndo,
        canRedo,
        setProjectTitle,
        setPlayhead,
        seek,
        stepFrameForward,
        stepFrameBackward,
        togglePlay,
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
