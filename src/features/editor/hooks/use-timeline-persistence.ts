"use client";

import * as React from "react";
import {
  DEFAULT_TIMELINE_STATE,
  INITIAL_TIMELINE_SAVE_STATUS,
  formatTimelineSaveError,
  saveStoredTimelineState,
  timelineSaveStatusReducer,
  useTimelineStorage,
} from "@/lib/timeline-storage";

interface TimelinePersistenceState {
  storedState: ReturnType<typeof useTimelineStorage>;
  persistPartial: (patch: Partial<typeof DEFAULT_TIMELINE_STATE>) => boolean;
  saveError: string | null;
  isDirty: boolean;
  dismissSaveError: () => void;
}

/** Owns persisted project subscription, write status, and partial-save error reporting. */
export function useTimelinePersistence(isHydrated: boolean): TimelinePersistenceState {
  const storedState = useTimelineStorage();
  const [saveStatus, dispatchSaveStatus] = React.useReducer(
    timelineSaveStatusReducer,
    INITIAL_TIMELINE_SAVE_STATUS
  );

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

  const dismissSaveError = React.useCallback(() => {
    dispatchSaveStatus({ type: "dismiss" });
  }, []);

  return {
    storedState,
    persistPartial,
    saveError: saveStatus.error,
    isDirty: saveStatus.isDirty,
    dismissSaveError,
  };
}
