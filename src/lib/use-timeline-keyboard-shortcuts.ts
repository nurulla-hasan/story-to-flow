"use client";

import * as React from "react";

export interface TimelineKeyboardActions {
  undo: () => void;
  redo: () => void;
  stepFrameForward: () => void;
  stepFrameBackward: () => void;
  splitClipAtPlayhead: () => void;
  duplicateClip: (clipId: string) => void;
  deleteClip: (clipId: string) => void;
  deleteTransition: (transitionId: string) => void;
  togglePlay: () => void;
  selectedClipId: string | null;
  selectedTransitionId: string | null;
}

/**
 * Owns editor-wide keyboard shortcuts and Space tap/hold semantics.
 * Timeline state stays in the provider; this hook only translates key events
 * into the latest available actions.
 */
export function useTimelineKeyboardShortcuts(
  actions: TimelineKeyboardActions,
  isPlayingRef: { current: boolean },
): () => void {
  const actionsRef = React.useRef(actions);
  const spaceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingSpaceRef = React.useRef(false);
  const wasPlayingBeforeHoldRef = React.useRef(false);
  const spaceCancelledRef = React.useRef(false);

  // Keep the global listener stable while refreshing actions as editor state changes.
  React.useEffect(() => {
    actionsRef.current = actions;
  });

  const cancelSpaceAction = React.useCallback(() => {
    if (spaceTimerRef.current) {
      clearTimeout(spaceTimerRef.current);
      spaceTimerRef.current = null;
    }
    spaceCancelledRef.current = true;
    isHoldingSpaceRef.current = false;
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.tagName === "SELECT" ||
        activeEl?.getAttribute("contenteditable") === "true" ||
        activeEl?.getAttribute("role") === "slider";

      if (isInput) return;

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

        spaceCancelledRef.current = false;
        wasPlayingBeforeHoldRef.current = isPlayingRef.current;
        isHoldingSpaceRef.current = false;

        if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);
        spaceTimerRef.current = setTimeout(() => {
          if (!spaceCancelledRef.current) {
            isHoldingSpaceRef.current = true;
            if (!wasPlayingBeforeHoldRef.current) {
              actionsRef.current.togglePlay();
            }
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

      const isInsideDialog = Boolean(
        activeEl?.closest('[role="dialog"]') ||
        activeEl?.closest('[role="alertdialog"]')
      );
      if (isInsideDialog) return;

      if (e.code === "Space") {
        e.preventDefault();

        if (spaceTimerRef.current) {
          clearTimeout(spaceTimerRef.current);
          spaceTimerRef.current = null;
        }

        if (spaceCancelledRef.current) {
          spaceCancelledRef.current = false;
          isHoldingSpaceRef.current = false;
          return;
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

    const handleBlur = () => {
      if (spaceTimerRef.current) {
        clearTimeout(spaceTimerRef.current);
        spaceTimerRef.current = null;
      }
      spaceCancelledRef.current = false;
      isHoldingSpaceRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);
    };
  }, [isPlayingRef]);

  return cancelSpaceAction;
}
