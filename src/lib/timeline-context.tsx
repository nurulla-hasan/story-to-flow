"use client";

import * as React from "react";
import type { TimelineClip, TrackId } from "@/types/timeline";
import { useMediaLibrary } from "@/lib/use-media-library";
import {
  DEFAULT_TIMELINE_STATE,
  getStoredTimelineState,
  saveStoredTimelineState,
} from "@/lib/timeline-storage";
import { calculateFitVisualsToVoiceover } from "@/lib/fit-visuals";

export interface TimelineContextType {
  isHydrated: boolean;
  clips: TimelineClip[];
  selectedClipId: string | null;
  selectedClip: TimelineClip | null;
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
  togglePlay: () => void;
  setZoom: (zoom: number) => void;
  selectClip: (clipId: string | null) => void;
  addAssetToTimeline: (asset: { id: string; name: string; category: "image" | "video" | "audio"; duration?: number | null }, trackId?: TrackId, startTime?: number) => void;
  moveClip: (clipId: string, newStartTime: number) => void;
  trimClip: (clipId: string, newDuration: number) => void;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  splitClipAtPlayhead: (clipId?: string) => void;
  deleteClip: (clipId: string) => void;
  duplicateClip: (clipId: string) => void;
  fitVisualsToVoiceover: () => { success: boolean; message: string };
  undo: () => void;
  redo: () => void;
}

const TimelineContext = React.createContext<TimelineContextType | null>(null);

const MAX_HISTORY = 50;
const MIN_CLIP_DURATION = 0.5; // minimum 500ms

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  const { assets } = useMediaLibrary();

  // Deterministic initial state for SSR and initial client hydration
  const [projectTitle, setProjectTitleState] = React.useState<string>(DEFAULT_TIMELINE_STATE.projectTitle);
  const [clips, setClips] = React.useState<TimelineClip[]>(DEFAULT_TIMELINE_STATE.clips);
  const [selectedClipId, setSelectedClipId] = React.useState<string | null>(DEFAULT_TIMELINE_STATE.selectedClipId);
  const [playhead, setPlayheadState] = React.useState<number>(DEFAULT_TIMELINE_STATE.playhead);
  const [isPlaying, setIsPlaying] = React.useState<boolean>(false);
  const [zoom, setZoomState] = React.useState<number>(DEFAULT_TIMELINE_STATE.zoom);
  const [isHydrated, setIsHydrated] = React.useState<boolean>(false);

  // Guard to ensure localStorage is NEVER overwritten before initial restoration completes
  const isRestoredRef = React.useRef(false);

  // Restore saved state strictly after hydration in useEffect
  React.useEffect(() => {
    try {
      const saved = getStoredTimelineState();
      if (saved.clips.length > 0 || saved.projectTitle !== DEFAULT_TIMELINE_STATE.projectTitle) {
        setProjectTitleState(saved.projectTitle);
        setClips(saved.clips);
        setPlayheadState(saved.playhead);
        setZoomState(saved.zoom);
        setSelectedClipId(saved.selectedClipId);
      }
    } catch (err) {
      console.error("Failed to restore timeline state from localStorage:", err);
    } finally {
      isRestoredRef.current = true;
      setIsHydrated(true);
    }
  }, []);

  // Undo / Redo Stacks & State Flags
  const undoStackRef = React.useRef<TimelineClip[][]>([]);
  const redoStackRef = React.useRef<TimelineClip[][]>([]);
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

  // Helper to sync canUndo / canRedo states outside of render
  const syncHistoryFlags = React.useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  // Save changes to localStorage with explicit restoration guard
  const persistClips = React.useCallback((newClips: TimelineClip[], newSelectedId?: string | null) => {
    if (!isRestoredRef.current) return;
    saveStoredTimelineState({
      clips: newClips,
      selectedClipId: newSelectedId !== undefined ? newSelectedId : selectedClipId,
    });
  }, [selectedClipId]);

  // Push current snapshot to undo stack before a mutation
  const pushHistorySnapshot = React.useCallback((currentClips: TimelineClip[]) => {
    undoStackRef.current.push(JSON.parse(JSON.stringify(currentClips)));
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift();
    }
    // Any new action clears the redo stack
    redoStackRef.current = [];
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const setProjectTitle = React.useCallback((title: string) => {
    setProjectTitleState(title);
    if (isRestoredRef.current) {
      saveStoredTimelineState({ projectTitle: title });
    }
  }, []);

  const setZoom = React.useCallback((newZoom: number) => {
    const clamped = Math.min(200, Math.max(50, newZoom));
    setZoomState(clamped);
    if (isRestoredRef.current) {
      saveStoredTimelineState({ zoom: clamped });
    }
  }, []);

  // Calculate total timeline duration (at least 10s or ends after the latest clip)
  const totalDuration = React.useMemo(() => {
    if (clips.length === 0) return 10;
    const maxEnd = Math.max(...clips.map((c) => c.startTime + c.duration));
    return Math.max(10, Math.ceil(maxEnd + 2)); // Add 2s tail padding
  }, [clips]);

  const setPlayhead = React.useCallback((time: number) => {
    setPlayheadState(Math.max(0, time));
  }, []);

  const seek = React.useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, time));
    setPlayheadState(clamped);
    if (isRestoredRef.current) {
      saveStoredTimelineState({ playhead: clamped });
    }
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
          return 0; // Stop and reset
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

    // No active audio at playhead
    audio.pause();
  }, [playhead, isPlaying, clips, assets]);

  const selectClip = React.useCallback((clipId: string | null) => {
    setSelectedClipId(clipId);
    if (isRestoredRef.current) {
      saveStoredTimelineState({ selectedClipId: clipId });
    }
  }, []);

  const selectedClip = React.useMemo(() => {
    if (!selectedClipId) return null;
    return clips.find((c) => c.id === selectedClipId) || null;
  }, [clips, selectedClipId]);

  // 1. ADD ASSET TO TIMELINE
  const addAssetToTimeline = React.useCallback(
    (asset: { id: string; name: string; category: "image" | "video" | "audio"; duration?: number | null }, targetTrack?: TrackId, customStartTime?: number) => {
      pushHistorySnapshot(clips);

      const trackId: TrackId = targetTrack || (asset.category === "audio" ? "audio" : "visual");
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

      const updated = [...clips, newClip];
      setClips(updated);
      setSelectedClipId(newClip.id);
      persistClips(updated, newClip.id);
    },
    [clips, pushHistorySnapshot, persistClips]
  );

  // 2. MOVE CLIP
  const moveClip = React.useCallback(
    (clipId: string, newStartTime: number) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      pushHistorySnapshot(clips);

      const clampedStart = Math.max(0, newStartTime);
      const updated = clips.map((c) =>
        c.id === clipId ? { ...c, startTime: clampedStart } : c
      );

      setClips(updated);
      persistClips(updated);
    },
    [clips, pushHistorySnapshot, persistClips]
  );

  // 3. TRIM CLIP / ADJUST DURATION
  const trimClip = React.useCallback(
    (clipId: string, newDuration: number) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      pushHistorySnapshot(clips);

      let clampedDuration = Math.max(MIN_CLIP_DURATION, newDuration);
      if (target.sourceDuration && target.sourceDuration > 0) {
        const remaining = target.sourceDuration - target.inPoint;
        clampedDuration = Math.min(clampedDuration, remaining);
      }

      const updated = clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              duration: clampedDuration,
              outPoint: c.inPoint + clampedDuration,
            }
          : c
      );

      setClips(updated);
      persistClips(updated);
    },
    [clips, pushHistorySnapshot, persistClips]
  );

  // 4. UPDATE CLIP GENERAL PROPERTIES
  const updateClip = React.useCallback(
    (clipId: string, updates: Partial<TimelineClip>) => {
      const target = clips.find((c) => c.id === clipId);
      if (!target) return;

      pushHistorySnapshot(clips);

      const updated = clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c));
      setClips(updated);
      persistClips(updated);
    },
    [clips, pushHistorySnapshot, persistClips]
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

      pushHistorySnapshot(clips);

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

      const updated = clips.flatMap((c) => (c.id === idToSplit ? [part1, part2] : [c]));
      setClips(updated);
      setSelectedClipId(part2.id);
      persistClips(updated, part2.id);
    },
    [clips, selectedClipId, playhead, pushHistorySnapshot, persistClips]
  );

  // 6. DELETE SELECTED CLIP (Delete/Backspace)
  const deleteClip = React.useCallback(
    (clipId: string) => {
      const exists = clips.some((c) => c.id === clipId);
      if (!exists) return;

      pushHistorySnapshot(clips);

      const updated = clips.filter((c) => c.id !== clipId);
      setClips(updated);
      const newSelected = selectedClipId === clipId ? null : selectedClipId;
      setSelectedClipId(newSelected);
      persistClips(updated, newSelected);
    },
    [clips, selectedClipId, pushHistorySnapshot, persistClips]
  );

  // 7. DUPLICATE SELECTED CLIP (Ctrl+D)
  const duplicateClip = React.useCallback(
    (clipId: string) => {
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;

      pushHistorySnapshot(clips);

      const duplicate: TimelineClip = {
        ...clip,
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: `${clip.name} (Copy)`,
        startTime: clip.startTime + clip.duration,
      };

      const updated = [...clips, duplicate];
      setClips(updated);
      setSelectedClipId(duplicate.id);
      persistClips(updated, duplicate.id);
    },
    [clips, pushHistorySnapshot, persistClips]
  );

  // 8. FIT VISUALS TO VOICEOVER ACTION
  const fitVisualsToVoiceover = React.useCallback(() => {
    const result = calculateFitVisualsToVoiceover(clips);
    if (result.success) {
      pushHistorySnapshot(clips);
      setClips(result.updatedClips);
      persistClips(result.updatedClips);
    }
    return { success: result.success, message: result.message };
  }, [clips, pushHistorySnapshot, persistClips]);

  // 9. UNDO & REDO
  const undo = React.useCallback(() => {
    if (undoStackRef.current.length === 0) return;

    const previousClips = undoStackRef.current.pop()!;
    redoStackRef.current.push(JSON.parse(JSON.stringify(clips)));

    setClips(previousClips);
    persistClips(previousClips);
    syncHistoryFlags();
  }, [clips, persistClips, syncHistoryFlags]);

  const redo = React.useCallback(() => {
    if (redoStackRef.current.length === 0) return;

    const nextClips = redoStackRef.current.pop()!;
    undoStackRef.current.push(JSON.parse(JSON.stringify(clips)));

    setClips(nextClips);
    persistClips(nextClips);
    syncHistoryFlags();
  }, [clips, persistClips, syncHistoryFlags]);

  // Keyboard Shortcuts Listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.getAttribute("contenteditable") === "true";

      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

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
        }
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, splitClipAtPlayhead, duplicateClip, deleteClip, togglePlay, selectedClipId]);

  return (
    <TimelineContext.Provider
      value={{
        isHydrated,
        clips,
        selectedClipId,
        selectedClip,
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
        togglePlay,
        setZoom,
        selectClip,
        addAssetToTimeline,
        moveClip,
        trimClip,
        updateClip,
        splitClipAtPlayhead,
        deleteClip,
        duplicateClip,
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
