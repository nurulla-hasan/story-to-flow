"use client";

import * as React from "react";

interface TimelineKeyboardActions {
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

interface TimelineKeyboardShortcutsOptions extends TimelineKeyboardActions {
  isPlayingRef: React.MutableRefObject<boolean>;
}

/**
 * Owns global editor shortcuts, including the tap/hold Space gesture.
 * Stable listeners read the latest actions through a ref to avoid rebinding every render.
 */
export function useTimelineKeyboardShortcuts({ isPlayingRef, ...actions }: TimelineKeyboardShortcutsOptions) {
  const actionsRef = React.useRef<TimelineKeyboardActions>(actions);
  const spaceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingSpaceRef = React.useRef(false);
  const wasPlayingBeforeHoldRef = React.useRef(false);
  const spaceCancelledRef = React.useRef(false);

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
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" || activeElement?.tagName === "SELECT" ||
        activeElement?.getAttribute("contenteditable") === "true" ||
        activeElement?.getAttribute("role") === "slider";
      if (isInput) return;
      const isInsideDialog = Boolean(activeElement?.closest('[role="dialog"]') || activeElement?.closest('[role="alertdialog"]'));
      if (isInsideDialog) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (event.code === "Space") {
        event.preventDefault();
        if (event.repeat) return;
        spaceCancelledRef.current = false;
        wasPlayingBeforeHoldRef.current = isPlayingRef.current;
        isHoldingSpaceRef.current = false;
        if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);
        spaceTimerRef.current = setTimeout(() => {
          if (!spaceCancelledRef.current) {
            isHoldingSpaceRef.current = true;
            if (!wasPlayingBeforeHoldRef.current) actionsRef.current.togglePlay();
          }
        }, 250);
        return;
      }
      if (modifier && (event.key === "z" || event.key === "Z") && !event.shiftKey) {
        event.preventDefault();
        actionsRef.current.undo();
        return;
      }
      if (modifier && (event.key === "y" || event.key === "Y" || (event.shiftKey && (event.key === "z" || event.key === "Z")))) {
        event.preventDefault();
        actionsRef.current.redo();
        return;
      }
      if (modifier && (event.key === "b" || event.key === "B")) {
        event.preventDefault();
        actionsRef.current.splitClipAtPlayhead();
        return;
      }
      if (modifier && (event.key === "d" || event.key === "D")) {
        event.preventDefault();
        if (actionsRef.current.selectedClipId) actionsRef.current.duplicateClip(actionsRef.current.selectedClipId);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (actionsRef.current.selectedClipId) {
          event.preventDefault();
          actionsRef.current.deleteClip(actionsRef.current.selectedClipId);
          return;
        }
        if (actionsRef.current.selectedTransitionId) {
          event.preventDefault();
          actionsRef.current.deleteTransition(actionsRef.current.selectedTransitionId);
          return;
        }
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        actionsRef.current.stepFrameBackward();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        actionsRef.current.stepFrameForward();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" || activeElement?.tagName === "SELECT" ||
        activeElement?.getAttribute("contenteditable") === "true" ||
        activeElement?.getAttribute("role") === "slider";
      if (isInput) return;
      const isInsideDialog = Boolean(activeElement?.closest('[role="dialog"]') || activeElement?.closest('[role="alertdialog"]'));
      if (isInsideDialog) return;
      if (event.code === "Space") {
        event.preventDefault();
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
          if (!wasPlayingBeforeHoldRef.current && isPlayingRef.current) actionsRef.current.togglePlay();
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

  return { cancelSpaceAction };
}
