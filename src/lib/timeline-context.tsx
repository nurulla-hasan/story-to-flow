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
import {
  isVisualTrack,
  isAudioTrack,
  areClipsOnSameTrack,
  normalizeVisualTrackId,
  getTrackById,
  getVisualTracks,
  getAudioTracks,
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
  findNextAvailableStartTime,
} from "@/lib/timeline-overlap";
import { reorderClipOnTrack } from "@/lib/timeline-reorder";
import { insertClipAtTime } from "@/lib/timeline-insert";

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
  candidateClips: TimelineClip[],
  tracks?: readonly TimelineTrack[]
): TimelineTransition[] {
  return candidateTransitions
    .filter((t) => {
      const from = candidateClips.find((c) => c.id === t.fromClipId);
      const to = candidateClips.find((c) => c.id === t.toClipId);
      if (!from || !to) return false;
      return areClipsAdjacentForTransition(from, to, tracks);
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
  tracks: TimelineTrack[];
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
  const [localTracks, setLocalTracks] = React.useState<TimelineTrack[] | null>(null);
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

  // Undo / Redo Stacks storing tracks, clips and transitions atomically
  const undoStackRef = React.useRef<HistorySnapshot[]>([]);
  const redoStackRef = React.useRef<HistorySnapshot[]>([]);
  const [canUndo, setCanUndo] = React.useState<boolean>(false);
  const [canRedo, setCanRedo] = React.useState<boolean>(false);

  // Playhead Clock & Playback Synchronization Refs
  const playheadRef = React.useRef<number>(0);
  const isPlayingRef = React.useRef<boolean>(false);
  const totalDurationRef = React.useRef<number>(0);
  const wasPlayingRef = React.useRef<boolean>(false);
  const playbackSpeedRef = React.useRef<number>(1.0);
  const playheadCommitGateRef = React.useRef(createPlayheadCommitGate());

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
      newTracks?: TimelineTrack[],
      newSelectedClipId?: string | null,
      newSelectedTransitionId?: string | null
    ) => {
      if (!isHydrated) return false;
      return persistPartial({
        tracks: newTracks ?? tracks,
        clips: newClips,
        transitions: newTransitions,
        selectedClipId: newSelectedClipId !== undefined ? newSelectedClipId : selectedClipId,
        selectedTransitionId:
          newSelectedTransitionId !== undefined ? newSelectedTransitionId : selectedTransitionId,
      });
    },
    [isHydrated, persistPartial, tracks, selectedClipId, selectedTransitionId]
  );

  const dismissSaveError = React.useCallback(() => {
    dispatchSaveStatus({ type: "dismiss" });
  }, []);

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

  // Push current snapshot to undo stack before a mutation
  const pushHistorySnapshot = React.useCallback(
    (
      currentClips: TimelineClip[],
      currentTransitions: TimelineTransition[],
      currentTracks?: TimelineTrack[]
    ) => {
      undoStackRef.current.push({
        tracks: JSON.parse(JSON.stringify(currentTracks ?? tracks)),
        clips: JSON.parse(JSON.stringify(currentClips)),
        transitions: JSON.parse(JSON.stringify(currentTransitions)),
      });
      if (undoStackRef.current.length > MAX_HISTORY) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      syncHistoryFlags();
    },
    [tracks, syncHistoryFlags]
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
    setLocalPlayhead(clamped);
  }, []);

  const seek = React.useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(totalDurationRef.current, time));
      playheadRef.current = clamped;
      setLocalPlayhead(clamped);
      commitPlayhead(clamped);
    },
    [commitPlayhead]
  );

  const stepFrameForward = React.useCallback(() => {
    const next = stepFrame(playheadRef.current, 1, totalDurationRef.current, TIMELINE_FPS);
    playheadRef.current = next;
    setLocalPlayhead(next);
    commitPlayhead(next);
  }, [commitPlayhead]);

  const stepFrameBackward = React.useCallback(() => {
    const next = stepFrame(playheadRef.current, -1, totalDurationRef.current, TIMELINE_FPS);
    playheadRef.current = next;
    setLocalPlayhead(next);
    commitPlayhead(next);
  }, [commitPlayhead]);

  const togglePlay = React.useCallback(() => {
    setIsPlaying((prev) => {
      const willPlay = !prev;
      if (willPlay && playheadRef.current >= totalDurationRef.current) {
        playheadRef.current = 0;
        setLocalPlayhead(0);
      }
      return willPlay;
    });
  }, []);

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
    // Only update playheadRef from React state when NOT playing!
    // During active playback, performance.now() loop advances playheadRef monotonically
    // without lagging React state updates dragging it backward.
    if (!isPlaying) {
      playheadRef.current = playhead;
    }
  }, [isPlaying, playhead]);

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
        setLocalPlayhead(targetDuration);
        commitPlayhead(targetDuration);
        return;
      }

      const next = Math.min(targetDuration, current + elapsedSec);
      playheadRef.current = next;
      setLocalPlayhead(next);

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, commitPlayhead]);

  // Synchronize dynamic multi-track audio playback with timeline clock
  React.useEffect(() => {
    const pool = audioElementsRef.current;
    const trackMap = new Map(tracks.map((t) => [t.id, t]));

    // Eligible audio clips: on tracks with type === "audio" (or audio track ID)
    const allAudioClips = clips.filter((c) => isAudioTrack(c.trackId, tracks));
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

    // Synchronize and mix each active audio clip concurrently across all tracks
    for (const clip of activeAudioClips) {
      const track = trackMap.get(clip.trackId);
      const isTrackMutedBool = track?.muted === true;
      const trackVolume = typeof track?.volume === "number" && !isNaN(track.volume) ? track.volume : 1.0;

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

      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
      const targetTime = (playhead - clip.startTime) * speed + clip.inPoint;
      if (!isPlaying || Math.abs(audioEl.currentTime - targetTime) > 0.25) {
        if (Math.abs(audioEl.currentTime - targetTime) > 0.05) {
          audioEl.currentTime = Math.max(0, targetTime);
        }
      }

      const clipRelativeTime = playhead - clip.startTime;
      const currentGain = calculateAudioGain(
        clipRelativeTime,
        clip.duration,
        clip.volume ?? 1.0,
        clip.fadeInDuration ?? 0,
        clip.fadeOutDuration ?? 0
      );

      // Volume calculation combines clip volume/fade, track volume/mute, and global master volume/mute
      const effectiveTrackVol = isTrackMutedBool ? 0 : trackVolume;
      const finalVolume =
        isMuted || isTrackMutedBool
          ? 0
          : Math.max(0, Math.min(1.0, currentGain * effectiveTrackVol * masterVolume));

      audioEl.volume = finalVolume;
      audioEl.muted = isMuted || isTrackMutedBool || finalVolume === 0;

      const targetRate = speed * playbackSpeedRef.current;
      if (audioEl.playbackRate !== targetRate) {
        audioEl.playbackRate = targetRate;
      }

      if (isPlaying && audioEl.paused) {
        audioEl.play().catch(() => {});
      } else if (!isPlaying && !audioEl.paused) {
        audioEl.pause();
      }
    }
  }, [playhead, isPlaying, clips, tracks, assets, isMuted, masterVolume]);

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
        // No explicit position: append / next-free-slot behavior
        const startTime = findNextAvailableStartTime(
          resolvedTrackId,
          duration,
          clips,
          0,
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

      const updatedClips = applyRippleExtend(clipId, clampedDuration, clips);

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
  const setClipsTransient = React.useCallback((newClips: TimelineClip[]) => {
    setLocalClips(newClips);
  }, []);

  // Commit completed drag gesture as one single undoable history snapshot
  const commitClipGesture = React.useCallback(
    (originalClips: TimelineClip[], finalClips: TimelineClip[]) => {
      const changed = JSON.stringify(originalClips) !== JSON.stringify(finalClips);
      if (!changed) return;

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
        (c) => isVisualTrack(c.trackId, tracks) && c.type === "image"
      );
      if (targetClips.length === 0) {
        return { success: false, message: "No image scenes found on timeline.", count: 0 };
      }

      pushHistorySnapshot(clips, transitions, tracks);

      const updatedClips = clips.map((c) => {
        if (isVisualTrack(c.trackId, tracks) && c.type === "image") {
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

  // 14. UNDO & REDO
  const undo = React.useCallback(() => {
    if (undoStackRef.current.length === 0) return;

    const previous = undoStackRef.current.pop()!;
    redoStackRef.current.push({
      tracks: JSON.parse(JSON.stringify(tracks)),
      clips: JSON.parse(JSON.stringify(clips)),
      transitions: JSON.parse(JSON.stringify(transitions)),
    });

    setLocalTracks(previous.tracks);
    setLocalClips(previous.clips);
    setLocalTransitions(previous.transitions);
    persistTimeline(previous.clips, previous.transitions, previous.tracks);
    syncHistoryFlags();
  }, [tracks, clips, transitions, persistTimeline, syncHistoryFlags]);

  const redo = React.useCallback(() => {
    if (redoStackRef.current.length === 0) return;

    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push({
      tracks: JSON.parse(JSON.stringify(tracks)),
      clips: JSON.parse(JSON.stringify(clips)),
      transitions: JSON.parse(JSON.stringify(transitions)),
    });

    setLocalTracks(next.tracks);
    setLocalClips(next.clips);
    setLocalTransitions(next.transitions);
    persistTimeline(next.clips, next.transitions, next.tracks);
    syncHistoryFlags();
  }, [tracks, clips, transitions, persistTimeline, syncHistoryFlags]);

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

      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;

        wasPlayingBeforeHoldRef.current = isPlayingRef.current;
        isHoldingSpaceRef.current = false;

        if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);
        spaceTimerRef.current = setTimeout(() => {
          isHoldingSpaceRef.current = true;
          if (!wasPlayingBeforeHoldRef.current) {
            actionsRef.current.togglePlay();
          }
        }, 250);
        return;
      }

      if (modifier && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        e.preventDefault();
        actionsRef.current.undo();
        return;
      }

      if (modifier && (e.key === "y" || e.key === "Y" || (e.shiftKey && (e.key === "z" || e.key === "Z")))) {
        e.preventDefault();
        actionsRef.current.redo();
        return;
      }

      if (modifier && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        actionsRef.current.splitClipAtPlayhead();
        return;
      }

      if (modifier && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        if (actionsRef.current.selectedClipId) {
          actionsRef.current.duplicateClip(actionsRef.current.selectedClipId);
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (actionsRef.current.selectedClipId) {
          e.preventDefault();
          actionsRef.current.deleteClip(actionsRef.current.selectedClipId);
          return;
        }
        if (actionsRef.current.selectedTransitionId) {
          e.preventDefault();
          actionsRef.current.deleteTransition(actionsRef.current.selectedTransitionId);
          return;
        }
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        actionsRef.current.stepFrameBackward();
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        actionsRef.current.stepFrameForward();
        return;
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

      if (isInput) return;

      if (e.code === "Space") {
        e.preventDefault();

        if (spaceTimerRef.current) {
          clearTimeout(spaceTimerRef.current);
          spaceTimerRef.current = null;
        }

        if (isHoldingSpaceRef.current) {
          if (!wasPlayingBeforeHoldRef.current && isPlayingRef.current) {
            actionsRef.current.togglePlay();
          }
          isHoldingSpaceRef.current = false;
        } else {
          actionsRef.current.togglePlay();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);
    };
  }, []);

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
