"use client";

import * as React from "react";
import type { TimelineTrack } from "@/types/timeline";
import {
  DEFAULT_TIMELINE_STATE,
  INITIAL_TIMELINE_SAVE_STATUS,
  createPlayheadCommitGate,
  formatTimelineSaveError,
  saveStoredTimelineState,
  timelineSaveStatusReducer,
} from "@/lib/timeline-storage";

interface UseTimelinePersistenceOptions {
  isHydrated: boolean;
  tracks: TimelineTrack[];
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  playheadRef: { current: number };
}

/**
 * Owns save status, persistence writes, and playhead commit throttling.
 * Consumers retain project state in the provider but do not need to know how
 * browser persistence or save failure presentation is implemented.
 */
export function useTimelinePersistence({
  isHydrated,
  tracks,
  selectedClipId,
  selectedTransitionId,
  playheadRef,
}: UseTimelinePersistenceOptions) {
  const [saveStatus, dispatchSaveStatus] = React.useReducer(
    timelineSaveStatusReducer,
    INITIAL_TIMELINE_SAVE_STATUS,
  );
  const playheadCommitGateRef = React.useRef(createPlayheadCommitGate());

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
      dispatchSaveStatus({
        type: "failure",
        message: formatTimelineSaveError(result.error),
      });
      return false;
    },
    [isHydrated],
  );

  const persistTimeline = React.useCallback(
    (
      newClips: typeof DEFAULT_TIMELINE_STATE.clips,
      newTransitions: typeof DEFAULT_TIMELINE_STATE.transitions,
      newTracks?: TimelineTrack[],
      newSelectedClipId?: string | null,
      newSelectedTransitionId?: string | null,
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
    [isHydrated, persistPartial, tracks, selectedClipId, selectedTransitionId],
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
    [isHydrated, persistPartial, playheadRef],
  );

  return { saveStatus, persistPartial, persistTimeline, dismissSaveError, commitPlayhead };
}
