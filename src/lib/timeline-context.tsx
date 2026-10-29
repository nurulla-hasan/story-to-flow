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
import {
  DEFAULT_TIMELINE_STATE,
  resolveTimelineSelection,
  useTimelineStorage,
} from "@/lib/timeline-storage";
import { useTimelinePersistence } from "@/lib/use-timeline-persistence";
import {
  registerTimelineAssetReferences,
} from "@/lib/media-references";
import { calculateTimelineDuration } from "@/lib/timeline-derived-state";
import type { ClipZoomEffect } from "@/lib/zoom-effect";
import { useTimelineKeyboardShortcuts } from "@/lib/use-timeline-keyboard-shortcuts";
import { TimelineHistoryManager } from "@/lib/timeline-history";
import { useTimelineAudioPlayback } from "@/lib/use-timeline-audio-playback";
import { useTimelineTrackCommands } from "@/lib/use-timeline-track-commands";
import { useTimelineEditingCommands } from "@/lib/use-timeline-editing-commands";
import { useTimelinePlaybackClock } from "@/lib/use-timeline-playback-clock";

export interface TimelineContextType {
  isHydrated: boolean;
  tracks: TimelineTrack[];
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
  addAssetToTimeline: (
    asset: { id: string; name: string; category: "image" | "video" | "audio"; duration?: number | null },
    trackId?: TrackId,
    startTime?: number
  ) => void;
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
}

const TimelineContext = React.createContext<TimelineContextType | null>(null);

const emptySubscribe = () => () => {};

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
  const [localTracks, setLocalTracks] = React.useState<TimelineTrack[] | null>(null);
  const [localClips, setLocalClips] = React.useState<TimelineClip[] | null>(null);
  const [localTransitions, setLocalTransitions] = React.useState<TimelineTransition[] | null>(null);

  // undefined means "inherit the stored selection"; null means "explicitly cleared".
  const [localSelectedClipId, setLocalSelectedClipId] = React.useState<string | null | undefined>(undefined);
  const [localSelectedTransitionId, setLocalSelectedTransitionId] = React.useState<string | null | undefined>(undefined);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [localPlayhead, setLocalPlayhead] = React.useState<number | null>(null);
  const [localZoom, setLocalZoom] = React.useState<number | null>(null);

  // Derived active state: perfectly identical between server and client first render
  const projectTitle = localTitle ?? (isHydrated ? storedState.projectTitle : DEFAULT_TIMELINE_STATE.projectTitle);
  const aspectRatio = localAspectRatio ?? (isHydrated ? (storedState.aspectRatio || "9:16") : (DEFAULT_TIMELINE_STATE.aspectRatio || "9:16"));
  const tracks = localTracks ?? (isHydrated ? storedState.tracks : DEFAULT_TIMELINE_STATE.tracks);
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

  // History owns bounded undo/redo snapshots; React state mirrors its visible capabilities.
  const [history] = React.useState(() => new TimelineHistoryManager());
  const [canUndo, setCanUndo] = React.useState<boolean>(false);
  const [canRedo, setCanRedo] = React.useState<boolean>(false);

  // Clock refs are shared with persistence, keyboard shortcuts, and audio playback.
  const playheadRef = React.useRef<number>(0);
  const isPlayingRef = React.useRef<boolean>(false);
  const playbackSpeedRef = React.useRef<number>(1.0);


  const syncHistoryFlags = React.useCallback(() => {
    setCanUndo(history.canUndo);
    setCanRedo(history.canRedo);
  }, [history]);

  const {
    saveStatus,
    persistPartial,
    persistTimeline,
    dismissSaveError,
    commitPlayhead,
  } = useTimelinePersistence({
    isHydrated,
    tracks,
    selectedClipId,
    selectedTransitionId,
    playheadRef,
  });

  // Record the pre-mutation project snapshot; the manager owns cloning and limits.
  const pushHistorySnapshot = React.useCallback(
    (
      currentClips: TimelineClip[],
      currentTransitions: TimelineTransition[],
      currentTracks?: TimelineTrack[]
    ) => {
      history.push({
        tracks: currentTracks ?? tracks,
        clips: currentClips,
        transitions: currentTransitions,
      });
      syncHistoryFlags();
    },
    [tracks, history, syncHistoryFlags]
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
    return calculateTimelineDuration(activeClips);
  }, [isHydrated, clips]);

  const {
    playbackSpeed,
    setPlaybackSpeed,
    setPlayhead,
    seek,
    stepFrameForward,
    stepFrameBackward,
    togglePlay,
    pause,
  } = useTimelinePlaybackClock({
    playhead,
    totalDuration,
    isPlaying,
    setIsPlaying,
    setLocalPlayhead,
    playheadRef,
    isPlayingRef,
    playbackSpeedRef,
    commitPlayhead,
  });

  const [masterVolume, setMasterVolume] = React.useState<number>(1.0);
  const [isMuted, setIsMuted] = React.useState<boolean>(false);

  // Browser audio resource management lives outside the project-state provider.
  useTimelineAudioPlayback({
    clips,
    tracks,
    assets,
    playhead,
    isPlaying,
    isMuted,
    masterVolume,
    playbackSpeedRef,
  });

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
    addTrack,
    updateTrack,
    renameTrack,
    toggleTrackMute,
    toggleTrackLock,
    toggleTrackVisibility,
    reorderTrack,
    deleteTrack,
  } = useTimelineTrackCommands({
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
  });

  const {
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
  } = useTimelineEditingCommands({
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
  });

  // 14. UNDO & REDO
  const undo = React.useCallback(() => {
    const previous = history.undo({ tracks, clips, transitions });
    if (!previous) return;

    setLocalTracks(previous.tracks);
    setLocalClips(previous.clips);
    setLocalTransitions(previous.transitions);
    persistTimeline(previous.clips, previous.transitions, previous.tracks);
    syncHistoryFlags();
  }, [history, tracks, clips, transitions, persistTimeline, syncHistoryFlags]);

  const redo = React.useCallback(() => {
    const next = history.redo({ tracks, clips, transitions });
    if (!next) return;

    setLocalTracks(next.tracks);
    setLocalClips(next.clips);
    setLocalTransitions(next.transitions);
    persistTimeline(next.clips, next.transitions, next.tracks);
    syncHistoryFlags();
  }, [history, tracks, clips, transitions, persistTimeline, syncHistoryFlags]);

  // Keyboard bindings live in their own hook so editor input handling is separate
  // from the timeline state/persistence provider.
  const cancelSpaceAction = useTimelineKeyboardShortcuts(
    {
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
    },
    isPlayingRef,
  );

  return (
    <TimelineContext.Provider
      value={{
        isHydrated,
        tracks,
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
