"use client";

import * as React from "react";

interface CanvasViewportOptions {
  isPlaying: boolean;
  togglePlay: () => void;
  cancelSpaceAction: () => void;
  setIsMuted: (muted: boolean | ((prev: boolean) => boolean)) => void;
}

/** Owns viewport-only interactions; this state never changes clip transforms or export output. */
export function useCanvasViewport({ isPlaying, togglePlay, cancelSpaceAction, setIsMuted }: CanvasViewportOptions) {
  const [viewportZoom, setViewportZoom] = React.useState(100);
  const [viewportPan, setViewportPan] = React.useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = React.useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false);
  const [isPanning, setIsPanning] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(false);
  const isHoveringCanvasRef = React.useRef(false);
  const canvasOuterStageRef = React.useRef<HTMLDivElement>(null);
  const panStartRef = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleZoomIn = React.useCallback(() => setViewportZoom((previous) => Math.min(400, previous + 25)), []);
  const handleZoomOut = React.useCallback(() => setViewportZoom((previous) => Math.max(25, previous - 25)), []);
  const handleResetView = React.useCallback(() => {
    setViewportZoom(100);
    setViewportPan({ x: 0, y: 0 });
  }, []);
  const handleToggleMute = React.useCallback(() => setIsMuted((previous) => !previous), [setIsMuted]);

  const handleToggleFullscreen = React.useCallback(async () => {
    const stageElement = canvasOuterStageRef.current;
    if (!stageElement) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageElement.requestFullscreen();
    } catch (error) {
      console.warn("Fullscreen toggle warning:", error);
    }
  }, []);

  React.useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA" ||
        activeElement?.tagName === "SELECT" || activeElement?.getAttribute("contenteditable") === "true" ||
        activeElement?.getAttribute("role") === "slider";
      if (isInput) return;
      const isInsideDialog = Boolean(activeElement?.closest('[role="dialog"]') || activeElement?.closest('[role="alertdialog"]'));
      if (isInsideDialog) return;
      if (event.key === "Control" || event.key === "Meta") setIsCtrlPressed(true);
      if (event.code === "Space" || event.key === " ") setIsSpacePressed(true);
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key.toLowerCase() === "m") {
          event.preventDefault();
          handleToggleMute();
        } else if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          void handleToggleFullscreen();
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Control" || event.key === "Meta") setIsCtrlPressed(false);
      if (event.code === "Space" || event.key === " ") setIsSpacePressed(false);
    };
    const onBlur = () => {
      setIsCtrlPressed(false);
      setIsSpacePressed(false);
      setIsPanning(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [handleToggleMute, handleToggleFullscreen]);

  React.useEffect(() => {
    const stageElement = canvasOuterStageRef.current;
    if (!stageElement) return;
    const handleNativeWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.deltaY < 0 ? 15 : -15;
        setViewportZoom((previous) => Math.max(25, Math.min(400, previous + delta)));
      } else {
        event.preventDefault();
        const dx = event.shiftKey ? -event.deltaY : -event.deltaX;
        const dy = event.shiftKey ? 0 : -event.deltaY;
        setViewportPan((previous) => ({ x: Math.round(previous.x + dx), y: Math.round(previous.y + dy) }));
      }
    };
    stageElement.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => stageElement.removeEventListener("wheel", handleNativeWheel);
  }, []);

  React.useEffect(() => {
    const preventBrowserZoom = (event: WheelEvent) => {
      if (isHoveringCanvasRef.current && (event.ctrlKey || event.metaKey)) event.preventDefault();
    };
    window.addEventListener("wheel", preventBrowserZoom, { passive: false });
    return () => window.removeEventListener("wheel", preventBrowserZoom);
  }, []);

  const handleViewportPointerDown = React.useCallback((event: React.PointerEvent) => {
    const isPanTrigger = event.button === 1 || (event.button === 0 && isSpacePressed) || (event.button === 0 && event.ctrlKey);
    if (!isPanTrigger) return;
    event.preventDefault();
    event.stopPropagation();
    if (isSpacePressed) cancelSpaceAction();
    if (isPlaying) togglePlay();
    setIsPanning(true);
    panStartRef.current = { x: event.clientX, y: event.clientY, panX: viewportPan.x, panY: viewportPan.y };
    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - panStartRef.current.x;
      const dy = moveEvent.clientY - panStartRef.current.y;
      setViewportPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    };
    const onPointerUp = () => {
      setIsPanning(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }, [isSpacePressed, isPlaying, togglePlay, cancelSpaceAction, viewportPan]);

  return {
    viewportZoom, viewportPan, isSpacePressed, setIsSpacePressed, isCtrlPressed, isPanning, isFullscreen, showGrid, setShowGrid,
    isHoveringCanvasRef, canvasOuterStageRef, handleZoomIn, handleZoomOut, handleResetView,
    handleToggleFullscreen, handleToggleMute, handleViewportPointerDown,
  };
}

/** Measures the preview surface for transform-gizmo coordinate mapping. */
export function useStageDimensions() {
  const stageContainerRef = React.useRef<HTMLDivElement>(null);
  const [stageDimensions, setStageDimensions] = React.useState({ width: 0, height: 0 });
  React.useEffect(() => {
    const element = stageContainerRef.current;
    if (!element) return;
    const updateDimensions = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setStageDimensions({ width: rect.width, height: rect.height });
    };
    updateDimensions();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setStageDimensions({ width, height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { stageContainerRef, stageDimensions };
}
