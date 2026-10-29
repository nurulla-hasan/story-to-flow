"use client";

import * as React from "react";

interface UsePreviewCanvasViewportOptions {
  masterVolume: number;
  isMuted: boolean;
  setIsMuted: (muted: boolean | ((previous: boolean) => boolean)) => void;
  isPlaying: boolean;
  togglePlay: () => void;
  cancelSpaceAction: () => void;
}

/** Owns viewport navigation, fullscreen, keyboard modifiers, and preview controls. */
export function usePreviewCanvasViewport({
  masterVolume,
  isMuted,
  setIsMuted,
  isPlaying,
  togglePlay,
  cancelSpaceAction,
}: UsePreviewCanvasViewportOptions) {
  const videoRefs = React.useRef<Map<string, HTMLVideoElement>>(new Map());

  // Viewport Zoom & Pan Navigation State (strictly visual viewport - never affects export or clip transforms)
  const [viewportZoom, setViewportZoom] = React.useState<number>(100); // 25% to 400%, default 100%
  const [viewportPan, setViewportPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = React.useState<boolean>(false);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState<boolean>(false);
  const [isPanning, setIsPanning] = React.useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
  const [showGrid, setShowGrid] = React.useState<boolean>(false);
  const [showVolumeSlider, setShowVolumeSlider] = React.useState<boolean>(false);
  const isHoveringCanvasRef = React.useRef<boolean>(false);
  const canvasOuterStageRef = React.useRef<HTMLDivElement>(null);
  const volumeDropdownRef = React.useRef<HTMLDivElement>(null);
  const panStartRef = React.useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const handleZoomIn = () => setViewportZoom((prev) => Math.min(400, prev + 25));
  const handleZoomOut = () => setViewportZoom((prev) => Math.max(25, prev - 25));
  const handleResetView = () => {
    setViewportZoom(100);
    setViewportPan({ x: 0, y: 0 });
  };

  // Sync video volume with master volume & mute
  React.useEffect(() => {
    const vol = isMuted ? 0 : Math.max(0, Math.min(1.0, masterVolume));
    for (const vid of videoRefs.current.values()) {
      vid.volume = vol;
    }
  }, [isMuted, masterVolume]);

  // Close the master-volume dropdown on outside click or Escape
  React.useEffect(() => {
    if (!showVolumeSlider) return;

    const onPointerDown = (event: PointerEvent) => {
      if (
        volumeDropdownRef.current &&
        !volumeDropdownRef.current.contains(event.target as Node)
      ) {
        setShowVolumeSlider(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowVolumeSlider(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showVolumeSlider]);

  // Synchronize fullscreen state with document events
  React.useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleToggleFullscreen = async () => {
    const stageEl = canvasOuterStageRef.current;
    if (!stageEl) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stageEl.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen toggle warning:", err);
    }
  };

  const handleToggleMute = React.useCallback(() => {
    setIsMuted((prev) => !prev);
  }, [setIsMuted]);

  // Modifier keys detection for Pan and Zoom
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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

      if (e.key === "Control" || e.key === "Meta") {
        setIsCtrlPressed(true);
      }
      if (e.code === "Space" || e.key === " ") {
        // Space acts as the Hand / Pan modifier on canvas
        setIsSpacePressed(true);
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === "m") {
          e.preventDefault();
          handleToggleMute();
        } else if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          handleToggleFullscreen();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        setIsCtrlPressed(false);
      }
      if (e.code === "Space" || e.key === " ") {
        setIsSpacePressed(false);
      }
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
  }, [handleToggleMute]);

  // CapCut-style Canvas Zoom & Pan with Mouse Wheel
  // CRITICAL: Must use native `{ passive: false }` listener with `e.preventDefault()`
  // to prevent Chromium from triggering native browser window zoom (page scale)!
  React.useEffect(() => {
    const stageEl = canvasOuterStageRef.current;
    if (!stageEl) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // When Ctrl or Meta is held: zoom the canvas and PREVENT browser zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        const zoomDelta = e.deltaY < 0 ? 15 : -15;
        setViewportZoom((prev) => Math.max(25, Math.min(400, prev + zoomDelta)));
      } else {
        // Normal wheel (without Ctrl): smoothly pan the canvas (CapCut UX)
        e.preventDefault();
        const dx = e.shiftKey ? -e.deltaY : -e.deltaX;
        const dy = e.shiftKey ? 0 : -e.deltaY;
        setViewportPan((prev) => ({
          x: Math.round(prev.x + dx),
          y: Math.round(prev.y + dy),
        }));
      }
    };

    stageEl.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      stageEl.removeEventListener("wheel", handleNativeWheel);
    };
  }, []);

  // Window-level guard: unconditionally block browser zoom if mouse is over canvas
  React.useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (isHoveringCanvasRef.current && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
      }
    };
    window.addEventListener("wheel", preventBrowserZoom, { passive: false });
    return () => {
      window.removeEventListener("wheel", preventBrowserZoom);
    };
  }, []);

  const handleViewportPointerDown = (e: React.PointerEvent) => {
    // Pan trigger: middle click (button 1) OR left click with Space held OR left click with Ctrl held
    const isPanTrigger = e.button === 1 || (e.button === 0 && isSpacePressed) || (e.button === 0 && e.ctrlKey);
    if (!isPanTrigger) return;

    e.preventDefault();
    e.stopPropagation();

    // If Space is being used to pan, cancel any pending Space togglePlay action
    if (isSpacePressed) {
      cancelSpaceAction();
    }

    if (isPlaying) {
      togglePlay();
    }
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: viewportPan.x,
      panY: viewportPan.y,
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - panStartRef.current.x;
      const dy = moveEvent.clientY - panStartRef.current.y;
      setViewportPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
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
  };

  // Measure stage dimensions dynamically with ResizeObserver for gizmo coordinate mapping
  const stageContainerRef = React.useRef<HTMLDivElement>(null);
  const [stageDimensions, setStageDimensions] = React.useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  React.useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;

    const updateDimensions = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setStageDimensions({ width, height });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

 
  return {
    videoRefs,
    viewportZoom,
    viewportPan,
    isSpacePressed,
    isCtrlPressed,
    isPanning,
    isFullscreen,
    showGrid,
    setShowGrid,
    showVolumeSlider,
    setShowVolumeSlider,
    isHoveringCanvasRef,
    canvasOuterStageRef,
    volumeDropdownRef,
    stageContainerRef,
    stageDimensions,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handleToggleFullscreen,
    handleToggleMute,
    handleViewportPointerDown,
  };
}
