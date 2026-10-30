"use client";

import * as React from "react";
import type {
  TimelineClip,
  TimelineTransition,
  TimelineTrack,
  TrackType,
  AudioTrackRole,
  TransitionType,
  TrackId,
} from "@/types/timeline";
import { useMediaLibrary } from "@/lib/use-media-library";
import type { MediaAssetItem } from "@/lib/media-storage";
import type { ClipZoomEffect } from "@/lib/zoom-effect";
import type { ScenePlan, ShotPlanItem } from "@/lib/scene-plan";
import {
  DEFAULT_TIMELINE_STATE,
  createPlayheadCommitGate,
  resolveTimelineSelection,
} from "@/lib/timeline-storage";
import { useTimelinePersistence } from "@/features/editor/hooks/use-timeline-persistence";
import { useTimelineTrackCommands } from "@/features/editor/hooks/use-timeline-track-commands";
import { useTimelineClipCommands } from "@/features/editor/hooks/use-timeline-clip-commands";
import {
  registerTimelineAssetReferences,
} from "@/lib/media-references";
import { stepFrame, TIMELINE_FPS } from "@/lib/frame-navigation";
import { TimelineHistory, cloneTimelineHistorySnapshot } from "@/features/editor/state/timeline-history";
import { useTimelineAudioPlayback } from "@/features/editor/infrastructure/use-timeline-audio-playback";
import { useTimelineKeyboardShortcuts } from "@/features/editor/hooks/use-timeline-keyboard-shortcuts";
import {
  createPlayheadStore,
  type PlayheadStore,
  usePlayheadFromStore,
} from "@/lib/playhead-store";

export interface TimelineStateContextType {
  isHydrated: boolean;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  selectedClipId: string | null;
  selectedClip: TimelineClip | null;
  selectedTransitionId: string | null;
  selectedTransition: TimelineTransition | null;
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
  dismissSaveError: () => void;
  setZoom: (zoom: number) => void;
  selectClip: (clipId: string | null) => void;
  selectTransition: (transitionId: string | null) => void;
  addAssetToTimeline: (
    asset: { id: string; name: string; category: "image" | "video" | "audio"; duration?: number | null },
    trackId?: TrackId,
    startTime?: number
  ) => void;
  addAssetsToTimeline: (
    assets: Array<{ id: string; name: string; category: "image" | "video" | "audio"; duration?: number | null }>
  ) => { addedCount: number; skippedCount: number };
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

  // Dynamic Multi-Track Management API
  addTrack: (type: TrackType, role?: AudioTrackRole, name?: string) => TrackId;
  updateTrack: (trackId: TrackId, updates: Partial<TimelineTrack>) => void;
  renameTrack: (trackId: TrackId, newName: string) => void;
  deleteTrack: (trackId: TrackId) => boolean;
  reorderTrack: (trackId: TrackId, direction: "up" | "down") => void;
  toggleTrackMute: (trackId: TrackId) => void;
  toggleTrackLock: (trackId: TrackId) => void;
  toggleTrackVisibility: (trackId: TrackId) => void;

  undo: () => void;
  redo: () => void;
  cancelSpaceAction: () => void;

  // Scene Plan & Shot State
  scenePlan: ScenePlan | null;
  setScenePlan: (plan: ScenePlan | null) => void;
  selectedPlanShotId: string | null;
  selectPlanShot: (shotId: string | null) => void;
  setImageClipDuration: (clipId: string, duration: number) => void;
  rotateClip90: (clipId: string, canvasWidth?: number, canvasHeight?: number) => void;
  assignAssetToShot: (shot: ShotPlanItem, asset: MediaAssetItem, targetTrackId?: TrackId) => string | undefined;
  assignAssetsToShots: (
    assignments: Array<{ shot: ShotPlanItem; asset: MediaAssetItem; targetTrackId?: TrackId }>
  ) => { assignedCount: number; newClipIds: string[] };
  applyPlanAutoMotions: (plan: ScenePlan, canvasWidth?: number, canvasHeight?: number) => { appliedCount: number };
  applyPlanAutoTransitions: (plan: ScenePlan, options?: { replaceExisting?: boolean }) => { transitions: TimelineTransition[]; appliedCount: number; skippedCount: number; skippedReasons: string[] };
}

export interface TimelinePlayheadContextType {
  playheadStore: PlayheadStore;
  isPlaying: boolean;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  masterVolume: number;
  setMasterVolume: (volume: number) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean | ((prev: boolean) => boolean)) => void;
  setPlayhead: (time: number) => void;
  commitPlayhead: (time?: number) => void;
  seek: (time: number) => void;
  stepFrameForward: () => void;
  stepFrameBackward: () => void;
  togglePlay: () => void;
  pause: () => void;
}

export type TimelineContextType = TimelineStateContextType &
  TimelinePlayheadContextType & {
    playhead: number;
  };

const TimelineStateContext = React.createContext<TimelineStateContextType | null>(null);
const TimelinePlayheadContext = React.createContext<TimelinePlayheadContextType | null>(null);

const MAX_HISTORY = 50;
const emptySubscribe = () => () => {};

/** Internal runner that isolates high-frequency audio clock synchronization */
function TimelineAudioPlaybackRunner({
  playheadStore,
  clips,
  tracks,
  assets,
  isPlaying,
  playbackSpeed,
  playbackSpeedRef,
  isMuted,
  masterVolume,
}: {
  playheadStore: PlayheadStore;
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  assets: MediaAssetItem[];
  isPlaying: boolean;
  playbackSpeed: number;
  playbackSpeedRef: React.MutableRefObject<number>;
  isMuted: boolean;
  masterVolume: number;
}) {
  const playhead = usePlayheadFromStore(playheadStore);
  useTimelineAudioPlayback({
    clips,
    tracks,
    assets,
    playhead,
    isPlaying,
    playbackSpeed,
    playbackSpeedRef,
    isMuted,
    masterVolume,
  });
  return null;
}

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  const { assets } = useMediaLibrary();

  // Hydration-safe client detection via React useSyncExternalStore
  const isHydrated = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const { storedState, persistPartial, saveError, isDirty, dismissSaveError } =
    useTimelinePersistence(isHydrated);

  // Local overrides during active session (starts null so server and client first render use default)
  const [localTitle, setLocalTitle] = React.useState<string | null>(null);
  const [localAspectRatio, setLocalAspectRatio] = React.useState<"9:16" | "16:9" | null>(null);
  const [localTracks, setLocalTracks] = React.useState<TimelineTrack[] | null>(null);
  const [localClips, setLocalClips] = React.useState<TimelineClip[] | null>(null);
  const [localTransitions, setLocalTransitions] = React.useState<TimelineTransition[] | null>(null);
  const [localScenePlan, setLocalScenePlan] = React.useState<ScenePlan | null | undefined>(undefined);
  const [selectedPlanShotId, setSelectedPlanShotId] = React.useState<string | null>(null);

  // undefined means "inherit the stored selection"; null means "explicitly cleared".
  const [localSelectedClipId, setLocalSelectedClipId] = React.useState<string | null | undefined>(undefined);
  const [localSelectedTransitionId, setLocalSelectedTransitionId] = React.useState<string | null | undefined>(undefined);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [localZoom, setLocalZoom] = React.useState<number | null>(null);

  // Derived active state: perfectly identical between server and client first render
  const projectTitle = localTitle ?? (isHydrated ? storedState.projectTitle : DEFAULT_TIMELINE_STATE.projectTitle);
  const aspectRatio = localAspectRatio ?? (isHydrated ? (storedState.aspectRatio || "9:16") : (DEFAULT_TIMELINE_STATE.aspectRatio || "9:16"));
  const tracks = localTracks ?? (isHydrated ? storedState.tracks : DEFAULT_TIMELINE_STATE.tracks);
  const clips = localClips ?? (isHydrated ? storedState.clips : DEFAULT_TIMELINE_STATE.clips);
  const transitions = localTransitions ?? (isHydrated ? storedState.transitions : DEFAULT_TIMELINE_STATE.transitions);
  const scenePlan = localScenePlan !== undefined ? localScenePlan : (isHydrated && storedState.scenePlan ? storedState.scenePlan : null);
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

  // Undo / Redo Stacks storing tracks, clips and transitions atomically
  const historyRef = React.useRef(new TimelineHistory(MAX_HISTORY));
  const [canUndo, setCanUndo] = React.useState<boolean>(false);
  const [canRedo, setCanRedo] = React.useState<boolean>(false);

  // Playhead Clock & Playback Synchronization Store
  const [playheadStore] = React.useState<PlayheadStore>(() => createPlayheadStore(0));
  const playheadRef = React.useRef<number>(0);
  const isPlayingRef = React.useRef<boolean>(false);
  const totalDurationRef = React.useRef<number>(0);
  const wasPlayingRef = React.useRef<boolean>(false);
  const playbackSpeedRef = React.useRef<number>(1.0);
  const playheadCommitGateRef = React.useRef(createPlayheadCommitGate());

  // Initialize and synchronize stored playhead once hydrated
  React.useEffect(() => {
    if (isHydrated && storedState.playhead !== undefined) {
      if (!isPlayingRef.current) {
        playheadRef.current = storedState.playhead;
        playheadStore.setPlayhead(storedState.playhead);
      }
    }
  }, [isHydrated, storedState.playhead, playheadStore]);

  const syncHistoryFlags = React.useCallback(() => {
    setCanUndo(historyRef.current.canUndo);
    setCanRedo(historyRef.current.canRedo);
  }, []);

  // Combine current project defaults and selection into an atomic persistence patch.
  const persistTimeline = React.useCallback(
    (
      newClips: TimelineClip[],
      newTransitions: TimelineTransition[],
      newTracks?: TimelineTrack[],
      newSelectedClipId?: string | null,
      newSelectedTransitionId?: string | null,
      newScenePlan?: ScenePlan | null
    ) => {
      if (!isHydrated) return false;
      return persistPartial({
        tracks: newTracks ?? tracks,
        clips: newClips,
        transitions: newTransitions,
        selectedClipId: newSelectedClipId !== undefined ? newSelectedClipId : selectedClipId,
        selectedTransitionId:
          newSelectedTransitionId !== undefined ? newSelectedTransitionId : selectedTransitionId,
        scenePlan:
          newScenePlan !== undefined ? (newScenePlan || undefined) : (scenePlan || undefined),
      });
    },
    [isHydrated, persistPartial, tracks, selectedClipId, selectedTransitionId, scenePlan]
  );

  // Persist playhead only at explicit boundaries (seek end, pause, frame step).
  const commitPlayhead = React.useCallback(
    (time?: number) => {
      if (!isHydrated) return;
      const targetTime = time !== undefined ? time : playheadRef.current;
      const next = Math.max(0, targetTime);
      playheadCommitGateRef.current.commit(next, (seconds) => {
        persistPartial({ playhead: seconds });
      });
    },
    [isHydrated, persistPartial]
  );

  // Push the current immutable project snapshot before a committed mutation.
  const pushHistorySnapshot = React.useCallback(
    (
      currentClips: TimelineClip[],
      currentTransitions: TimelineTransition[],
      currentTracks?: TimelineTrack[],
      currentScenePlan?: ScenePlan | null
    ) => {
      historyRef.current.pushUndo(
        cloneTimelineHistorySnapshot(
          currentTracks ?? tracks,
          currentClips,
          currentTransitions,
          currentScenePlan !== undefined ? currentScenePlan : scenePlan
        )
      );
      syncHistoryFlags();
    },
    [tracks, scenePlan, syncHistoryFlags]
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

  React.useEffect(() => {
    totalDurationRef.current = totalDuration;
  }, [totalDuration]);

  const setPlayhead = React.useCallback((time: number) => {
    const clamped = Math.max(0, time);
    playheadRef.current = clamped;
    playheadStore.setPlayhead(clamped);
  }, [playheadStore]);

  const seek = React.useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(totalDurationRef.current, time));
      playheadRef.current = clamped;
      playheadStore.setPlayhead(clamped);
      commitPlayhead(clamped);
    },
    [commitPlayhead, playheadStore]
  );

  const stepFrameForward = React.useCallback(() => {
    const next = stepFrame(playheadRef.current, 1, totalDurationRef.current, TIMELINE_FPS);
    playheadRef.current = next;
    playheadStore.setPlayhead(next);
    commitPlayhead(next);
  }, [commitPlayhead, playheadStore]);

  const stepFrameBackward = React.useCallback(() => {
    const next = stepFrame(playheadRef.current, -1, totalDurationRef.current, TIMELINE_FPS);
    playheadRef.current = next;
    playheadStore.setPlayhead(next);
    commitPlayhead(next);
  }, [commitPlayhead, playheadStore]);

  const togglePlay = React.useCallback(() => {
    setIsPlaying((prev) => {
      const willPlay = !prev;
      if (willPlay && playheadRef.current >= totalDurationRef.current) {
        playheadRef.current = 0;
        playheadStore.setPlayhead(0);
      }
      return willPlay;
    });
  }, [playheadStore]);

  const pause = React.useCallback(() => {
    setIsPlaying(false);
  }, []);

  const [playbackSpeed, setPlaybackSpeedState] = React.useState<number>(1.0);
  const setPlaybackSpeed = React.useCallback((speed: number) => {
    playbackSpeedRef.current = speed;
    setPlaybackSpeedState(speed);
  }, []);

  const [masterVolume, setMasterVolume] = React.useState<number>(1.0);
  const [isMuted, setIsMuted] = React.useState<boolean>(false);

  // Safely commit playhead when transitioning from playing to paused
  React.useEffect(() => {
    if (wasPlayingRef.current && !isPlaying) {
      commitPlayhead(playheadRef.current);
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying, commitPlayhead]);

  React.useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // High-frequency playback clock updates the playheadStore without re-rendering TimelineProvider
  React.useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const loop = (currentTimestamp: number) => {
      const elapsedSec = ((currentTimestamp - lastTimestamp) / 1000) * playbackSpeedRef.current;
      lastTimestamp = currentTimestamp;

      const current = playheadRef.current;
      const targetDuration = Math.max(0.1, totalDurationRef.current);

      if (current >= targetDuration) {
        setIsPlaying(false);
        playheadRef.current = targetDuration;
        playheadStore.setPlayhead(targetDuration);
        commitPlayhead(targetDuration);
        return;
      }

      const next = Math.min(targetDuration, current + elapsedSec);
      playheadRef.current = next;
      playheadStore.setPlayhead(next);

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, commitPlayhead, playheadStore]);

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
          ? { selectedTransitionId: transitionId, selectedClipId: null }
          : { selectedTransitionId: null }
      );
    },
    [persistPartial]
  );

  const selectPlanShot = React.useCallback(
    (shotId: string | null) => {
      setSelectedPlanShotId(shotId);
      if (shotId) {
        setLocalSelectedClipId(null);
        setLocalSelectedTransitionId(null);
      }
    },
    []
  );

  const setScenePlan = React.useCallback(
    (plan: ScenePlan | null) => {
      pushHistorySnapshot(clips, transitions, tracks, scenePlan);
      setLocalScenePlan(plan);
      persistTimeline(clips, transitions, tracks, selectedClipId, selectedTransitionId, plan);
    },
    [clips, transitions, tracks, scenePlan, pushHistorySnapshot, persistTimeline, selectedClipId, selectedTransitionId]
  );

  // Clear selections that refer to clips/transitions removed while the editor was closed
  React.useEffect(() => {
    if (!isHydrated) return;

    const shouldClearClip =
      Boolean(storedState.selectedClipId) &&
      !clips.some((clip) => clip.id === storedState.selectedClipId);

    const shouldClearTransition =
      Boolean(storedState.selectedTransitionId) &&
      !transitions.some(
        (transition) =>
          transition.id === storedState.selectedTransitionId &&
          clips.some((clip) => clip.id === transition.fromClipId) &&
          clips.some((clip) => clip.id === transition.toClipId)
      );

    if (shouldClearClip || shouldClearTransition) {
      persistPartial({
        selectedClipId: shouldClearClip ? null : storedState.selectedClipId,
        selectedTransitionId: shouldClearTransition ? null : storedState.selectedTransitionId,
      });
    }
  }, [
    isHydrated,
    clips,
    transitions,
    storedState.selectedClipId,
    storedState.selectedTransitionId,
    persistPartial,
  ]);

  // Keep asset references in sync with the current timeline clips
  React.useEffect(() => {
    if (!isHydrated) return;
    registerTimelineAssetReferences(clips);
  }, [isHydrated, clips]);

  const selectedClip = React.useMemo(() => {
    return clips.find((c) => c.id === selectedClipId) || null;
  }, [selectedClipId, clips]);

  const selectedTransition = React.useMemo(() => {
    return transitions.find((t) => t.id === selectedTransitionId) || null;
  }, [selectedTransitionId, transitions]);

  const {
    addTrack, updateTrack, renameTrack, toggleTrackMute, toggleTrackLock,
    toggleTrackVisibility, reorderTrack, deleteTrack,
  } = useTimelineTrackCommands({
    tracks, clips, transitions, selectedClipId, selectedTransitionId,
    setLocalTracks, setLocalClips, setLocalTransitions,
    setLocalSelectedClipId, setLocalSelectedTransitionId,
    pushHistorySnapshot, persistTimeline,
  });

  const getPlayheadTime = React.useCallback(() => playheadRef.current, []);

  const {
    addAssetToTimeline, addAssetsToTimeline, moveClip, trimClip, setClipsTransient, commitClipGesture, cancelClipGesture,
    updateClip, splitClipAtPlayhead, deleteClip, duplicateClip, addTransition, updateTransition,
    deleteTransition, applyToAllTransitions, applyMotionToAllClips, fitVisualsToVoiceover,
    setImageClipDuration, rotateClip90, assignAssetToShot, assignAssetsToShots, applyPlanAutoMotions, applyPlanAutoTransitions,
  } = useTimelineClipCommands({
    tracks, clips, transitions, scenePlan, selectedClipId, selectedTransitionId, playhead: getPlayheadTime,
    setLocalClips, setLocalTransitions, setLocalScenePlan, setLocalSelectedClipId, setLocalSelectedTransitionId,
    pushHistorySnapshot, persistTimeline,
  });

  // 14. UNDO & REDO
  const undo = React.useCallback(() => {
    const previous = historyRef.current.takeUndo(
      cloneTimelineHistorySnapshot(tracks, clips, transitions, scenePlan)
    );
    if (!previous) return;

    setLocalTracks(previous.tracks);
    setLocalClips(previous.clips);
    setLocalTransitions(previous.transitions);
    setLocalScenePlan(previous.scenePlan ?? null);
    persistTimeline(
      previous.clips,
      previous.transitions,
      previous.tracks,
      undefined,
      undefined,
      previous.scenePlan ?? null
    );
    syncHistoryFlags();
  }, [tracks, clips, transitions, scenePlan, persistTimeline, syncHistoryFlags]);

  const redo = React.useCallback(() => {
    const next = historyRef.current.takeRedo(
      cloneTimelineHistorySnapshot(tracks, clips, transitions, scenePlan)
    );
    if (!next) return;

    setLocalTracks(next.tracks);
    setLocalClips(next.clips);
    setLocalTransitions(next.transitions);
    setLocalScenePlan(next.scenePlan ?? null);
    persistTimeline(
      next.clips,
      next.transitions,
      next.tracks,
      undefined,
      undefined,
      next.scenePlan ?? null
    );
    syncHistoryFlags();
  }, [tracks, clips, transitions, scenePlan, persistTimeline, syncHistoryFlags]);

  const { cancelSpaceAction } = useTimelineKeyboardShortcuts({
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
    isPlayingRef,
  });

  const timelineStateValue = React.useMemo<TimelineStateContextType>(
    () => ({
      isHydrated,
      tracks,
      clips,
      transitions,
      selectedClipId,
      selectedClip,
      selectedTransitionId,
      selectedTransition,
      zoom,
      totalDuration,
      projectTitle,
      aspectRatio,
      canUndo,
      canRedo,
      saveError,
      isDirty,
      setProjectTitle,
      setAspectRatio,
      dismissSaveError,
      setZoom,
      selectClip,
      selectTransition,
      addAssetToTimeline,
      addAssetsToTimeline,
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
      applyToAllTransitions,
      applyMotionToAllClips,
      fitVisualsToVoiceover,
      addTrack,
      updateTrack,
      renameTrack,
      deleteTrack,
      reorderTrack,
      toggleTrackMute,
      toggleTrackLock,
      toggleTrackVisibility,
      undo,
      redo,
      cancelSpaceAction,
      scenePlan,
      setScenePlan,
      selectedPlanShotId,
      selectPlanShot,
      setImageClipDuration,
      rotateClip90,
      assignAssetToShot,
      assignAssetsToShots,
      applyPlanAutoMotions,
      applyPlanAutoTransitions,
    }),
    [
      isHydrated,
      tracks,
      clips,
      transitions,
      selectedClipId,
      selectedClip,
      selectedTransitionId,
      selectedTransition,
      zoom,
      totalDuration,
      projectTitle,
      aspectRatio,
      canUndo,
      canRedo,
      saveError,
      isDirty,
      setProjectTitle,
      setAspectRatio,
      dismissSaveError,
      setZoom,
      selectClip,
      selectTransition,
      addAssetToTimeline,
      addAssetsToTimeline,
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
      applyToAllTransitions,
      applyMotionToAllClips,
      fitVisualsToVoiceover,
      addTrack,
      updateTrack,
      renameTrack,
      deleteTrack,
      reorderTrack,
      toggleTrackMute,
      toggleTrackLock,
      toggleTrackVisibility,
      undo,
      redo,
      cancelSpaceAction,
      scenePlan,
      setScenePlan,
      selectedPlanShotId,
      selectPlanShot,
      setImageClipDuration,
      rotateClip90,
      assignAssetToShot,
      assignAssetsToShots,
      applyPlanAutoMotions,
      applyPlanAutoTransitions,
    ]
  );

  const playheadContextValue = React.useMemo<TimelinePlayheadContextType>(
    () => ({
      playheadStore,
      isPlaying,
      playbackSpeed,
      setPlaybackSpeed,
      masterVolume,
      setMasterVolume,
      isMuted,
      setIsMuted,
      setPlayhead,
      commitPlayhead,
      seek,
      stepFrameForward,
      stepFrameBackward,
      togglePlay,
      pause,
    }),
    [
      playheadStore,
      isPlaying,
      playbackSpeed,
      setPlaybackSpeed,
      masterVolume,
      setMasterVolume,
      isMuted,
      setIsMuted,
      setPlayhead,
      commitPlayhead,
      seek,
      stepFrameForward,
      stepFrameBackward,
      togglePlay,
      pause,
    ]
  );

  return (
    <TimelineStateContext.Provider value={timelineStateValue}>
      <TimelinePlayheadContext.Provider value={playheadContextValue}>
        <TimelineAudioPlaybackRunner
          playheadStore={playheadStore}
          clips={clips}
          tracks={tracks}
          assets={assets}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          playbackSpeedRef={playbackSpeedRef}
          isMuted={isMuted}
          masterVolume={masterVolume}
        />
        {children}
      </TimelinePlayheadContext.Provider>
    </TimelineStateContext.Provider>
  );
}

/** Hook for editor components that need project state and actions without subscribing to playhead ticks */
export function useTimelineState(): TimelineStateContextType {
  const context = React.useContext(TimelineStateContext);
  if (!context) {
    throw new Error("useTimelineState must be used within a TimelineProvider");
  }
  return context;
}

/** Hook for transport controls and playhead store */
export function useTimelinePlayhead(): TimelinePlayheadContextType {
  const context = React.useContext(TimelinePlayheadContext);
  if (!context) {
    throw new Error("useTimelinePlayhead must be used within a TimelineProvider");
  }
  return context;
}

/** Reactive hook for subscribing to high-frequency playhead time without rerendering parent state */
export function usePlayhead(): number {
  const { playheadStore } = useTimelinePlayhead();
  return usePlayheadFromStore(playheadStore);
}

/** Full backward-compatible hook returning both project state and reactive playhead */
export function useTimeline(): TimelineContextType {
  const state = useTimelineState();
  const playheadContext = useTimelinePlayhead();
  const playhead = usePlayheadFromStore(playheadContext.playheadStore);

  return React.useMemo(
    () => ({
      ...state,
      ...playheadContext,
      playhead,
    }),
    [state, playheadContext, playhead]
  );
}
