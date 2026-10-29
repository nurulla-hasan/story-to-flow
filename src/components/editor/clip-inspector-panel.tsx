"use client";

import * as React from "react";
import {
  SlidersHorizontal,
  Clock,
  Gauge,
  MousePointerClick,
  Scissors,
  Copy,
  Trash2,
  Film,
  Mic,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Layers,
  Sparkles,
  CopyCheck,
  CheckCircle2,
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTimeline } from "@/lib/timeline-context";
import {
  isVisualTrack,
  isAudioTrack,
  getVisualTracks,
  getAudioTracks,
  type TransitionType,
  type TimelineClip,
} from "@/types/timeline";
import {
  DEFAULT_CLIP_TRANSFORM,
  sanitizeClipTransform,
} from "@/lib/clip-transform";
import {
  DEFAULT_ZOOM_EFFECT_AMOUNT,
  MAX_ZOOM_EFFECT_AMOUNT,
  MIN_ZOOM_EFFECT_AMOUNT,
  sanitizeZoomEffect,
  type ZoomEffectType,
} from "@/lib/zoom-effect";
import {
  TRANSITION_PRESETS,
  areClipsAdjacentForTransition,
  findEligibleTransitionPairs,
  validateTransitionDuration,
  MAX_TRANSITION_DURATION,
  MIN_TRANSITION_DURATION,
} from "@/lib/transition-helpers";
import { validateFadeDuration } from "@/lib/audio-fade-helpers";
import { applyRippleExtend } from "@/lib/timeline-trim";
import { hasVisualOverlap } from "@/lib/timeline-overlap";

export function ClipInspectorPanel() {
  const {
    isHydrated,
    tracks,
    clips,
    transitions,
    selectedClip,
    selectedTransition,
    updateClip,
    splitClipAtPlayhead,
    deleteClip,
    duplicateClip,
    addTransition,
    updateTransition,
    deleteTransition,
    applyToAllTransitions,
    applyMotionToAllClips,
    setClipsTransient,
    commitClipGesture,
  } = useTimeline();

  // Gesture snapshot tracking for inspector sliders to ensure exactly 1 history commit per drag
  const initialClipsRef = React.useRef<TimelineClip[] | null>(null);
  const latestClipsRef = React.useRef<TimelineClip[] | null>(null);

  const handleSliderPointerDown = () => {
    initialClipsRef.current = JSON.parse(JSON.stringify(clips));
    latestClipsRef.current = null;
  };

  const handleSliderPointerUp = React.useCallback(() => {
    if (initialClipsRef.current) {
      const finalClips = latestClipsRef.current ?? clips;
      commitClipGesture(initialClipsRef.current, finalClips);
      initialClipsRef.current = null;
      latestClipsRef.current = null;
    }
  }, [clips, commitClipGesture]);

  // Window-level listener ensures dragging slider released outside bounding box cleanly commits
  React.useEffect(() => {
    const onWindowPointerUp = () => {
      if (initialClipsRef.current) {
        handleSliderPointerUp();
      }
    };
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    return () => {
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    };
  }, [handleSliderPointerUp]);

  const getBaseClips = () => {
    if (!initialClipsRef.current) {
      const snapshot: TimelineClip[] = JSON.parse(JSON.stringify(clips));
      initialClipsRef.current = snapshot;
      latestClipsRef.current = null;
      return snapshot;
    }
    return initialClipsRef.current;
  };

  const [applyFeedback, setApplyFeedback] = React.useState<string | null>(null);

  // Apply-to-all targets every eligible visual boundary, not only existing transitions.
  const eligibleTransitionBoundaryCount = React.useMemo(
    () => findEligibleTransitionPairs(clips).length,
    [clips]
  );

  const handleApplyToAll = (transitionId: string) => {
    const res = applyToAllTransitions(transitionId);
    setApplyFeedback(res.message);
    setTimeout(() => setApplyFeedback(null), 4000);
  };

  // Intermediate transient handler for smooth slider scrubbing with ripple extension
  const handleTransientDurationChange = (e: React.FormEvent<HTMLInputElement>) => {
    if (!selectedClip) return;
    const baseClips = getBaseClips();
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(val) && val >= 0.5) {
      const speed = selectedClip.speed && selectedClip.speed > 0 ? selectedClip.speed : 1.0;
      let clampedDur = val;
      if (selectedClip.sourceDuration && selectedClip.sourceDuration > 0) {
        const remaining = (selectedClip.sourceDuration - selectedClip.inPoint) / speed;
        clampedDur = Math.min(clampedDur, remaining);
      }
      const transientClips = applyRippleExtend(
        selectedClip.id,
        clampedDur,
        baseClips
      );
      latestClipsRef.current = transientClips;
      setClipsTransient(transientClips);
    }
  };

  const handleTransientVolumeChange = (e: React.FormEvent<HTMLInputElement>) => {
    if (!selectedClip) return;
    const baseClips = getBaseClips();
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(val)) {
      const updated = baseClips.map((c) => (c.id === selectedClip.id ? { ...c, volume: val } : c));
      latestClipsRef.current = updated;
      setClipsTransient(updated);
    }
  };

  const handleToggleClipMute = () => {
    if (!selectedClip) return;
    const isCurrentlyMuted = (selectedClip.volume ?? 1.0) === 0;
    const newVol = isCurrentlyMuted ? 1.0 : 0;
    updateClip(selectedClip.id, { volume: newVol });
  };

  const handleTransientFadeInChange = (e: React.FormEvent<HTMLInputElement>) => {
    if (!selectedClip) return;
    const baseClips = getBaseClips();
    const val = parseFloat((e.target as HTMLInputElement).value);
    const safeFade = validateFadeDuration(val, selectedClip.duration, selectedClip.fadeOutDuration ?? 0);
    setClipsTransient(
      baseClips.map((c) => (c.id === selectedClip.id ? { ...c, fadeInDuration: safeFade } : c))
    );
  };

  const handleTransientFadeOutChange = (e: React.FormEvent<HTMLInputElement>) => {
    if (!selectedClip) return;
    const baseClips = getBaseClips();
    const val = parseFloat((e.target as HTMLInputElement).value);
    const safeFade = validateFadeDuration(val, selectedClip.duration, selectedClip.fadeInDuration ?? 0);
    setClipsTransient(
      baseClips.map((c) => (c.id === selectedClip.id ? { ...c, fadeOutDuration: safeFade } : c))
    );
  };

  // Scene Motion & Zoom (Ken Burns): pick a preset or remove the effect entirely
  const handleSetZoomEffect = (type: "off" | ZoomEffectType) => {
    if (!selectedClip) return;
    if (type === "off") {
      updateClip(selectedClip.id, { zoomEffect: undefined });
      return;
    }
    const current = sanitizeZoomEffect(selectedClip.zoomEffect);
    updateClip(selectedClip.id, {
      zoomEffect: {
        type,
        amount: current?.amount ?? DEFAULT_ZOOM_EFFECT_AMOUNT,
      },
    });
  };

  const [motionApplyFeedback, setMotionApplyFeedback] = React.useState<string | null>(null);

  // Eligible image scenes for applying motion across the project
  const imageClipsCount = React.useMemo(
    () => clips.filter((c) => isVisualTrack(c.trackId) && c.type === "image").length,
    [clips]
  );

  const handleApplyMotionToAll = () => {
    if (!selectedClip) return;
    const effect = sanitizeZoomEffect(selectedClip.zoomEffect);
    if (!effect) return;
    const res = applyMotionToAllClips(effect);
    setMotionApplyFeedback(res.message);
    setTimeout(() => setMotionApplyFeedback(null), 4000);
  };

  // Transient strength scrubbing keeps a single history entry per drag
  const handleTransientZoomAmountChange = (e: React.FormEvent<HTMLInputElement>) => {
    if (!selectedClip) return;
    const effect = sanitizeZoomEffect(selectedClip.zoomEffect);
    if (!effect) return;
    const baseClips = getBaseClips();
    const amount = parseFloat((e.target as HTMLInputElement).value) / 100;
    const zoomEffect = sanitizeZoomEffect({ ...effect, amount });
    setClipsTransient(
      baseClips.map((c) => (c.id === selectedClip.id ? { ...c, zoomEffect } : c))
    );
  };

  // Dynamic visual tracks list from context
  const visualTracksList = React.useMemo(() => {
    return tracks ? getVisualTracks(tracks) : [];
  }, [tracks]);

  // Dynamic audio tracks list from context
  const audioTracksList = React.useMemo(() => {
    return tracks ? getAudioTracks(tracks) : [];
  }, [tracks]);

  // Current track name display
  const currentTrackName = React.useMemo(() => {
    if (!selectedClip) return "";
    const tr = tracks?.find((t) => t.id === selectedClip.trackId);
    if (tr) return tr.name;
    return isAudioTrack(selectedClip.trackId, tracks) ? "Audio Track" : "Visual Track";
  }, [selectedClip, tracks]);

  // Find if selected visual clip has an adjacent next clip eligible for transition
  const transitionToNext = React.useMemo(() => {
    if (!selectedClip || !isVisualTrack(selectedClip.trackId, tracks)) return null;

    const trackVisuals = clips
      .filter((c) => c.trackId === selectedClip.trackId)
      .sort((a, b) => a.startTime - b.startTime);

    const myIndex = trackVisuals.findIndex((c) => c.id === selectedClip.id);
    if (myIndex === -1 || myIndex >= trackVisuals.length - 1) return null;

    const nextClip = trackVisuals[myIndex + 1];
    if (!areClipsAdjacentForTransition(selectedClip, nextClip, tracks)) return null;

    const existing = transitions.find(
      (t) => t.fromClipId === selectedClip.id && t.toClipId === nextClip.id
    );

    return { nextClip, existing };
  }, [selectedClip, clips, transitions, tracks]);

  return (
    <Card size="sm" className="flex flex-col h-full overflow-hidden">
      <CardHeader className="flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            <CardTitle>
              {selectedTransition ? "Transition Inspector" : "Clip Inspector"}
            </CardTitle>
          </div>
          <Badge
            variant={
              isHydrated && (selectedClip || selectedTransition)
                ? "secondary"
                : "outline"
            }
          >
            {selectedTransition
              ? "TRANSITION"
              : isHydrated && selectedClip
              ? `${selectedClip.type.toUpperCase()}`
              : "No Selection"}
          </Badge>
        </div>
        <CardDescription>
          {selectedTransition
            ? `Configuring ${selectedTransition.type}`
            : isHydrated && selectedClip
            ? `Editing "${selectedClip.name}"`
            : "Select a clip or transition on the timeline to edit properties"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 justify-between gap-3 p-3 overflow-y-auto">
        {!isHydrated || (!selectedClip && !selectedTransition) ? (
          /* Empty selection guidance box */
          <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-5 text-center space-y-2 bg-muted/20 my-auto">
            <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <MousePointerClick className="size-4" />
            </div>
            <p className="text-xs font-semibold text-foreground">
              No selection
            </p>
            <p className="text-2xs text-muted-foreground max-w-44 leading-relaxed">
              Click any scene clip or transition on the timeline below to inspect and edit its properties.
            </p>
          </div>
        ) : selectedTransition ? (
          /* TRANSITION INSPECTOR VIEW */
          <div className="space-y-3.5 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2.5 border border-border">
              <div className="size-7 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Sparkles className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-semibold text-foreground capitalize">
                  {selectedTransition.type.replace("-", " ")}
                </p>
                <p className="text-3xs text-muted-foreground">
                  Duration: {selectedTransition.duration.toFixed(2)}s
                </p>
              </div>
            </div>

            {/* Transition Preset Type Picker */}
            <div className="space-y-1.5 rounded-lg border border-border p-2.5 bg-card">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Transition Style</span>
                <span className="text-3xs text-muted-foreground font-mono">
                  {selectedTransition.type}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {TRANSITION_PRESETS.map((preset) => {
                  const isCurrent = selectedTransition.type === preset.type;
                  return (
                    <button
                      key={preset.type}
                      type="button"
                      onClick={() =>
                        updateTransition(selectedTransition.id, {
                          type: preset.type as TransitionType,
                        })
                      }
                      className={`p-2 text-2xs rounded-md border text-left transition-colors cursor-pointer ${
                        isCurrent
                          ? "border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <p className="font-semibold text-foreground text-3xs">{preset.label}</p>
                      <p className="text-3xs text-muted-foreground line-clamp-1 mt-0.5">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transition Duration Slider */}
            <div className="space-y-1.5 rounded-lg border border-border p-2.5 bg-card">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="size-3 text-muted-foreground" />
                  <span>Duration</span>
                </span>
                <span className="font-mono text-xs font-semibold text-primary">
                  {selectedTransition.duration.toFixed(2)}s
                </span>
              </div>

              <input
                type="range"
                min="0.2"
                max="1.5"
                step="0.05"
                value={selectedTransition.duration}
                onChange={(e) =>
                  updateTransition(selectedTransition.id, {
                    duration: parseFloat(e.target.value),
                  })
                }
                aria-label="Transition duration"
                className="w-full accent-primary cursor-pointer"
              />

              <div className="flex items-center justify-between text-3xs text-muted-foreground font-mono">
                <span>0.2s</span>
                <span>Max: 1.5s</span>
              </div>
            </div>

            {/* Apply to All Transitions Action Button */}
            <div className="space-y-1.5 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplyToAll(selectedTransition.id)}
                disabled={eligibleTransitionBoundaryCount === 0}
                className="w-full gap-1.5 text-xs"
                title={
                  eligibleTransitionBoundaryCount === 0
                    ? "No eligible adjacent visual clip boundaries"
                    : `Apply ${selectedTransition.type.replace("-", " ")} (${selectedTransition.duration.toFixed(2)}s) to all ${eligibleTransitionBoundaryCount} eligible clip boundaries`
                }
              >
                <CopyCheck className="size-3.5" />
                <span>Apply to All Transitions ({eligibleTransitionBoundaryCount})</span>
              </Button>

              {applyFeedback && (
                <div className="flex items-start gap-1.5 p-2 rounded-md bg-primary/10 border border-primary/20 text-3xs text-primary font-medium animate-in fade-in leading-relaxed">
                  <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
                  <span>{applyFeedback}</span>
                </div>
              )}
            </div>

            {/* Remove Transition Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteTransition(selectedTransition.id)}
              className="w-full gap-1 text-xs text-destructive hover:bg-destructive/10"
              title="Delete this transition"
            >
              <Trash2 className="size-3" />
              <span>Remove Transition</span>
            </Button>
          </div>
        ) : selectedClip ? (
          /* ACTIVE CLIP PROPERTIES VIEW */
          <div className="space-y-3.5 flex-1 min-h-0 overflow-y-auto pr-1">
            {/* Clip Summary Card */}
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2 border border-border">
              <div className="size-7 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {selectedClip.type === "video" ? (
                  <Film className="size-3.5" />
                ) : selectedClip.type === "audio" ? (
                  <Mic className="size-3.5" />
                ) : (
                  <ImageIcon className="size-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-semibold text-foreground truncate" title={selectedClip.name}>
                  {selectedClip.name}
                </p>
                <p className="text-3xs text-muted-foreground">
                  Track: {currentTrackName}
                </p>
              </div>
            </div>

            {/* Visual Layer Dynamic Track Switcher */}
            {isVisualTrack(selectedClip.trackId, tracks) && visualTracksList.length > 1 && (
              <div className="space-y-1.5 rounded-lg border border-border p-2.5 bg-card">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Layers className="size-3 text-muted-foreground" />
                    <span>Visual Track Layer</span>
                  </span>
                  <span className="text-3xs text-muted-foreground font-mono">
                    {currentTrackName}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {visualTracksList.map((tr) => {
                    const isCurrent = tr.id === selectedClip.trackId;
                    const wouldCollide =
                      !isCurrent &&
                      hasVisualOverlap(
                        {
                          id: selectedClip.id,
                          startTime: selectedClip.startTime,
                          duration: selectedClip.duration,
                          trackId: tr.id,
                        },
                        clips,
                        tracks
                      );

                    return (
                      <button
                        key={tr.id}
                        type="button"
                        disabled={isCurrent || wouldCollide || tr.locked}
                        onClick={() => updateClip(selectedClip.id, { trackId: tr.id })}
                        title={
                          wouldCollide
                            ? `Cannot move to ${tr.name}: another clip occupies this timeline position`
                            : tr.locked
                            ? `Cannot move to ${tr.name}: track is locked`
                            : `Move to ${tr.name}`
                        }
                        className={`py-1 px-2 text-2xs rounded-md border text-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isCurrent
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {tr.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Audio Track Switcher */}
            {isAudioTrack(selectedClip.trackId, tracks) && audioTracksList.length > 1 && (
              <div className="space-y-1.5 rounded-lg border border-border p-2.5 bg-card">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Volume2 className="size-3 text-muted-foreground" />
                    <span>Audio Track</span>
                  </span>
                  <span className="text-3xs text-muted-foreground font-mono">
                    {currentTrackName}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {audioTracksList.map((tr) => {
                    const isCurrent = tr.id === selectedClip.trackId;
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        disabled={isCurrent || tr.locked}
                        onClick={() => updateClip(selectedClip.id, { trackId: tr.id })}
                        title={
                          tr.locked
                            ? `Cannot move to ${tr.name}: track is locked`
                            : `Move to ${tr.name}`
                        }
                        className={`py-1 px-2 text-2xs rounded-md border text-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isCurrent
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {tr.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Canvas Transform (Position & Scale Gizmo Sync) */}
            {isVisualTrack(selectedClip.trackId, tracks) && (() => {
              const transform = sanitizeClipTransform(selectedClip.transform);
              const isDefault =
                transform.x === DEFAULT_CLIP_TRANSFORM.x &&
                transform.y === DEFAULT_CLIP_TRANSFORM.y &&
                transform.scale === DEFAULT_CLIP_TRANSFORM.scale &&
                (transform.rotation || 0) === (DEFAULT_CLIP_TRANSFORM.rotation || 0);

              return (
                <div className="space-y-2 rounded-lg border border-border p-2.5 bg-card">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Move className="size-3 text-primary" />
                      <span>Canvas Transform</span>
                    </span>
                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() =>
                          updateClip(selectedClip.id, {
                            transform: { ...DEFAULT_CLIP_TRANSFORM },
                          })
                        }
                        className="text-3xs text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer transition-colors"
                        title="Reset position, scale, and rotation to default"
                      >
                        <RotateCcw className="size-2.5" />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>

                  {/* Scale Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-3xs">
                      <span className="text-muted-foreground">Scale</span>
                      <span className="font-mono font-semibold text-primary">
                        {Math.round(transform.scale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="300"
                      step="5"
                      value={Math.round(transform.scale * 100)}
                      onPointerDown={handleSliderPointerDown}
                      onPointerUp={handleSliderPointerUp}
                      onPointerCancel={handleSliderPointerUp}
                      onKeyDown={handleSliderPointerDown}
                      onKeyUp={handleSliderPointerUp}
                      onChange={(e) => {
                        const baseClips = getBaseClips();
                        const scaleVal = parseFloat((Number(e.target.value) / 100).toFixed(2));
                        setClipsTransient(
                          baseClips.map((c) =>
                            c.id === selectedClip.id
                              ? {
                                  ...c,
                                  transform: sanitizeClipTransform({ ...transform, scale: scaleVal }),
                                }
                              : c
                          )
                        );
                      }}
                      aria-label="Transform scale"
                      className="w-full accent-primary cursor-pointer h-1"
                    />
                  </div>

                  {/* Position X and Y Sliders */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-3xs">
                        <span className="text-muted-foreground">Pos X</span>
                        <span className="font-mono text-muted-foreground">
                          {Math.round(transform.x * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="2"
                        value={Math.round(transform.x * 100)}
                        onPointerDown={handleSliderPointerDown}
                        onPointerUp={handleSliderPointerUp}
                        onPointerCancel={handleSliderPointerUp}
                        onKeyDown={handleSliderPointerDown}
                        onKeyUp={handleSliderPointerUp}
                        onChange={(e) => {
                          const baseClips = getBaseClips();
                          const xVal = parseFloat((Number(e.target.value) / 100).toFixed(2));
                          setClipsTransient(
                            baseClips.map((c) =>
                              c.id === selectedClip.id
                                ? { ...c, transform: sanitizeClipTransform({ ...transform, x: xVal }) }
                                : c
                            )
                          );
                        }}
                        aria-label="Transform position X"
                        className="w-full accent-primary cursor-pointer h-1"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-3xs">
                        <span className="text-muted-foreground">Pos Y</span>
                        <span className="font-mono text-muted-foreground">
                          {Math.round(transform.y * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="2"
                        value={Math.round(transform.y * 100)}
                        onPointerDown={handleSliderPointerDown}
                        onPointerUp={handleSliderPointerUp}
                        onPointerCancel={handleSliderPointerUp}
                        onKeyDown={handleSliderPointerDown}
                        onKeyUp={handleSliderPointerUp}
                        onChange={(e) => {
                          const baseClips = getBaseClips();
                          const yVal = parseFloat((Number(e.target.value) / 100).toFixed(2));
                          setClipsTransient(
                            baseClips.map((c) =>
                              c.id === selectedClip.id
                                ? { ...c, transform: sanitizeClipTransform({ ...transform, y: yVal }) }
                                : c
                            )
                          );
                        }}
                        aria-label="Transform position Y"
                        className="w-full accent-primary cursor-pointer h-1"
                      />
                    </div>
                  </div>

                  {/* Rotation Slider & Quick 90° Rotate */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-3xs">
                      <span className="text-muted-foreground">Rotation</span>
                      <span className="font-mono text-muted-foreground">
                        {Math.round(transform.rotation || 0)}°
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={Math.round(transform.rotation || 0)}
                        onPointerDown={handleSliderPointerDown}
                        onPointerUp={handleSliderPointerUp}
                        onPointerCancel={handleSliderPointerUp}
                        onKeyDown={handleSliderPointerDown}
                        onKeyUp={handleSliderPointerUp}
                        onChange={(e) => {
                          const baseClips = getBaseClips();
                          const rotVal = Number(e.target.value);
                          setClipsTransient(
                            baseClips.map((c) =>
                              c.id === selectedClip.id
                                ? { ...c, transform: sanitizeClipTransform({ ...transform, rotation: rotVal }) }
                                : c
                            )
                          );
                        }}
                        aria-label="Transform rotation"
                        className="w-full accent-primary cursor-pointer h-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const currentRot = transform.rotation || 0;
                          const nextRot = (((currentRot + 90 + 180) % 360) - 180);
                          updateClip(selectedClip.id, {
                            transform: sanitizeClipTransform({
                              ...transform,
                              rotation: nextRot,
                            }),
                          });
                        }}
                        className="px-1.5 py-0.5 text-3xs rounded border border-border bg-secondary hover:bg-muted font-mono cursor-pointer transition-colors shrink-0"
                        title="Rotate 90 degrees clockwise"
                      >
                        +90°
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Scene Motion & Zoom (Ken Burns) — image scenes only */}
            {selectedClip.type === "image" && (() => {
              const effect = sanitizeZoomEffect(selectedClip.zoomEffect);
              const amountPct = Math.round(
                (effect?.amount ?? DEFAULT_ZOOM_EFFECT_AMOUNT) * 100
              );
              const zoomOptions: Array<{
                value: "off" | "zoom-in" | "zoom-out";
                label: string;
              }> = [
                { value: "off", label: "Off" },
                { value: "zoom-in", label: "Zoom In" },
                { value: "zoom-out", label: "Zoom Out" },
              ];
              const panOptions: Array<{
                value: ZoomEffectType;
                label: string;
                title: string;
              }> = [
                { value: "pan-left", label: "Left", title: "Pan Left" },
                { value: "pan-right", label: "Right", title: "Pan Right" },
                { value: "pan-up", label: "Up", title: "Pan Up" },
                { value: "pan-down", label: "Down", title: "Pan Down" },
              ];

              const getMotionDescription = () => {
                if (!effect) return "";
                switch (effect.type) {
                  case "zoom-in":
                    return `Zooms in ${amountPct}% across ${selectedClip.duration.toFixed(1)}s`;
                  case "zoom-out":
                    return `Zooms out ${amountPct}% across ${selectedClip.duration.toFixed(1)}s`;
                  case "pan-left":
                    return `Pans left ${amountPct}% across ${selectedClip.duration.toFixed(1)}s`;
                  case "pan-right":
                    return `Pans right ${amountPct}% across ${selectedClip.duration.toFixed(1)}s`;
                  case "pan-up":
                    return `Pans up ${amountPct}% across ${selectedClip.duration.toFixed(1)}s`;
                  case "pan-down":
                    return `Pans down ${amountPct}% across ${selectedClip.duration.toFixed(1)}s`;
                }
              };

              return (
                <div className="space-y-2 rounded-lg border border-border p-2.5 bg-card">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <ZoomIn className="size-3 text-primary" />
                      <span>Scene Motion</span>
                    </span>
                    {effect && (
                      <button
                        type="button"
                        onClick={() =>
                          updateClip(selectedClip.id, { zoomEffect: undefined })
                        }
                        className="text-3xs text-muted-foreground hover:text-destructive flex items-center gap-1 cursor-pointer transition-colors"
                        title="Remove motion effect from this scene"
                      >
                        <RotateCcw className="size-2.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {/* Zoom Options */}
                  <div className="grid grid-cols-3 gap-1">
                    {zoomOptions.map((option) => {
                      const isActive =
                        option.value === "off"
                          ? !effect
                          : effect?.type === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSetZoomEffect(option.value)}
                          className={`py-1 text-2xs rounded-md border transition-colors cursor-pointer ${
                            isActive
                              ? "border-primary bg-primary/10 text-primary font-bold"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {option.value === "zoom-in" ? (
                            <span className="flex items-center justify-center gap-1">
                              <ZoomIn className="size-3" />
                              {option.label}
                            </span>
                          ) : option.value === "zoom-out" ? (
                            <span className="flex items-center justify-center gap-1">
                              <ZoomOut className="size-3" />
                              {option.label}
                            </span>
                          ) : (
                            option.label
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Pan & Drift Options */}
                  <div className="space-y-1">
                    <span className="text-3xs text-muted-foreground font-medium">Pan &amp; Drift</span>
                    <div className="grid grid-cols-4 gap-1">
                      {panOptions.map((option) => {
                        const isActive = effect?.type === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSetZoomEffect(option.value)}
                            title={option.title}
                            className={`py-1 text-2xs rounded-md border transition-colors cursor-pointer ${
                              isActive
                                ? "border-primary bg-primary/10 text-primary font-bold"
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <span className="flex items-center justify-center gap-1">
                              {option.value === "pan-left" ? (
                                <ArrowLeft className="size-3" />
                              ) : option.value === "pan-right" ? (
                                <ArrowRight className="size-3" />
                              ) : option.value === "pan-up" ? (
                                <ArrowUp className="size-3" />
                              ) : (
                                <ArrowDown className="size-3" />
                              )}
                              <span>{option.label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {effect && (
                    <div className="space-y-1.5 pt-1">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-3xs">
                          <span className="text-muted-foreground">Strength</span>
                          <span className="font-mono font-semibold text-primary">
                            {amountPct}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={MIN_ZOOM_EFFECT_AMOUNT * 100}
                          max={MAX_ZOOM_EFFECT_AMOUNT * 100}
                          step="1"
                          value={amountPct}
                          onPointerDown={handleSliderPointerDown}
                          onPointerUp={handleSliderPointerUp}
                          onPointerCancel={handleSliderPointerUp}
                          onKeyDown={handleSliderPointerDown}
                          onKeyUp={handleSliderPointerUp}
                          onChange={handleTransientZoomAmountChange}
                          aria-label="Scene motion strength"
                          className="w-full accent-primary cursor-pointer h-1"
                        />
                        <p className="text-3xs text-muted-foreground">
                          {getMotionDescription()}
                        </p>
                      </div>

                      {/* Apply to All Clips Button */}
                      <div className="space-y-1.5 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleApplyMotionToAll}
                          disabled={imageClipsCount <= 1}
                          className="w-full gap-1.5"
                          title={
                            imageClipsCount <= 1
                              ? "Only 1 image scene on timeline"
                              : `Apply this motion (${amountPct}%) to all ${imageClipsCount} image scenes`
                          }
                        >
                          <CopyCheck className="size-3.5" />
                          <span>Apply to All Scenes ({imageClipsCount})</span>
                        </Button>

                        {motionApplyFeedback && (
                          <div className="flex items-start gap-1.5 p-2 rounded-md bg-primary/10 border border-primary/20 text-3xs text-primary font-medium animate-in fade-in leading-relaxed">
                            <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
                            <span>{motionApplyFeedback}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Start Time Position Display */}
            <div className="flex items-center justify-between text-2xs rounded-md bg-muted/20 p-2 border border-border">
              <span className="text-muted-foreground font-medium">Timeline Position</span>
              <span className="font-mono text-foreground font-semibold">
                {selectedClip.startTime.toFixed(2)}s
              </span>
            </div>

            {/* Duration Slider & Number Editor */}
            <div className="space-y-1.5 rounded-lg border border-border p-2.5 bg-card">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="size-3 text-muted-foreground" />
                  <span>Duration</span>
                </span>
                <span className="font-mono text-xs font-semibold text-primary">
                  {selectedClip.duration.toFixed(2)}s
                </span>
              </div>

              <input
                type="range"
                min="0.5"
                max={
                  selectedClip.sourceDuration && selectedClip.sourceDuration > 0
                    ? Math.max(
                        0.5,
                        (selectedClip.sourceDuration - selectedClip.inPoint) /
                          (selectedClip.speed || 1.0)
                      )
                    : 30
                }
                step="0.1"
                value={selectedClip.duration}
                onPointerDown={handleSliderPointerDown}
                onPointerUp={handleSliderPointerUp}
                onPointerCancel={handleSliderPointerUp}
                onKeyDown={handleSliderPointerDown}
                onKeyUp={handleSliderPointerUp}
                onChange={handleTransientDurationChange}
                aria-label="Clip duration"
                className="w-full accent-primary cursor-pointer"
              />

              <div className="flex items-center justify-between text-3xs text-muted-foreground font-mono">
                <span>0.5s</span>
                <span>
                  Max:{" "}
                  {selectedClip.sourceDuration && selectedClip.sourceDuration > 0
                    ? `${(
                        (selectedClip.sourceDuration - selectedClip.inPoint) /
                        (selectedClip.speed || 1.0)
                      ).toFixed(1)}s`
                    : "30.0s"}
                </span>
              </div>
            </div>

            {/* Visual Transitions to Next Scene */}
            {transitionToNext && (
              <div className="space-y-2 rounded-lg border border-border p-2.5 bg-card">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Sparkles className="size-3 text-primary" />
                    <span>Transition to Next Scene</span>
                  </span>
                  {transitionToNext.existing && (
                    <Badge variant="secondary" className="text-3xs uppercase">
                      {transitionToNext.existing.type}
                    </Badge>
                  )}
                </div>

                {transitionToNext.existing ? (
                  /* Existing Transition Controls */
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-1">
                      {TRANSITION_PRESETS.map((p) => {
                        const isCurrent = transitionToNext.existing?.type === p.type;
                        return (
                          <button
                            key={p.type}
                            type="button"
                            onClick={() =>
                              updateTransition(transitionToNext.existing!.id, {
                                type: p.type as TransitionType,
                              })
                            }
                            className={`py-1 px-1.5 text-3xs rounded border text-center transition-colors cursor-pointer ${
                              isCurrent
                                ? "border-primary bg-primary/10 text-primary font-bold"
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-2xs pt-1">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-mono text-primary font-semibold">
                        {transitionToNext.existing.duration.toFixed(2)}s
                      </span>
                    </div>

                    <input
                      type="range"
                      min={MIN_TRANSITION_DURATION}
                      max={validateTransitionDuration(
                        MAX_TRANSITION_DURATION,
                        selectedClip,
                        transitionToNext.nextClip
                      )}
                      step="0.05"
                      value={transitionToNext.existing.duration}
                      onChange={(e) =>
                        updateTransition(transitionToNext.existing!.id, {
                          duration: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-primary cursor-pointer"
                    />

                    {/* Apply to All Transitions Action Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyToAll(transitionToNext.existing!.id)}
                      disabled={eligibleTransitionBoundaryCount === 0}
                      className="w-full gap-1 text-xs"
                      title={
                        eligibleTransitionBoundaryCount === 0
                          ? "No eligible adjacent visual clip boundaries"
                          : `Apply ${transitionToNext.existing.type.replace("-", " ")} (${transitionToNext.existing.duration.toFixed(2)}s) to all ${eligibleTransitionBoundaryCount} eligible clip boundaries`
                      }
                    >
                      <CopyCheck className="size-3" />
                      <span>Apply to All Transitions ({eligibleTransitionBoundaryCount})</span>
                    </Button>

                    {applyFeedback && (
                      <div className="flex items-start gap-1 p-1.5 rounded-md bg-primary/10 border border-primary/20 text-3xs text-primary font-medium animate-in fade-in leading-relaxed">
                        <CheckCircle2 className="size-3 shrink-0 mt-0.5" />
                        <span>{applyFeedback}</span>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteTransition(transitionToNext.existing!.id)}
                      className="w-full gap-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3" />
                      <span>Remove Transition</span>
                    </Button>
                  </div>
                ) : (
                  /* Add Transition Button */
                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        addTransition(selectedClip.id, transitionToNext.nextClip.id, "cross-dissolve", 0.5)
                      }
                      className="w-full gap-1 text-xs"
                      title="Add visual transition to next clip"
                    >
                      <Sparkles className="size-3" />
                      <span>+ Add Transition to Next Scene</span>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Audio & Video Scene Volume & Mute Controls */}
            {(isAudioTrack(selectedClip.trackId, tracks) || selectedClip.type === "video") && (
              <div className="space-y-2 rounded-lg border border-border p-2.5 bg-card">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    {(selectedClip.volume ?? 1.0) === 0 ? (
                      <VolumeX className="size-3.5 text-destructive" />
                    ) : (
                      <Volume2 className="size-3.5 text-muted-foreground" />
                    )}
                    <span>{selectedClip.type === "video" ? "Video Sound / Audio" : "Track Volume"}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-xs font-semibold ${(selectedClip.volume ?? 1.0) === 0 ? "text-destructive" : "text-primary"}`}>
                      {(selectedClip.volume ?? 1.0) === 0 ? "Muted (0%)" : `${Math.round((selectedClip.volume ?? 1.0) * 100)}%`}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={(selectedClip.volume ?? 1.0) === 0 ? "destructive" : "outline"}
                      onClick={handleToggleClipMute}
                      className="h-6 px-2 text-3xs font-medium cursor-pointer"
                    >
                      {(selectedClip.volume ?? 1.0) === 0 ? "Unmute" : "Mute"}
                    </Button>
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedClip.volume ?? 1.0}
                  onPointerDown={handleSliderPointerDown}
                  onPointerUp={handleSliderPointerUp}
                  onPointerCancel={handleSliderPointerUp}
                  onKeyDown={handleSliderPointerDown}
                  onKeyUp={handleSliderPointerUp}
                  onChange={handleTransientVolumeChange}
                  aria-label={selectedClip.type === "video" ? "Video volume" : "Audio clip volume"}
                  className="w-full accent-primary cursor-pointer"
                />

                <div className="flex items-center justify-between text-3xs text-muted-foreground font-mono">
                  <span>0% (Mute)</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateClip(selectedClip.id, { volume: 0 })}
                      className="px-1.5 py-0.5 rounded border border-border hover:bg-muted cursor-pointer transition-colors"
                    >
                      0% (Mute)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateClip(selectedClip.id, { volume: 0.5 })}
                      className="px-1.5 py-0.5 rounded border border-border hover:bg-muted cursor-pointer transition-colors"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => updateClip(selectedClip.id, { volume: 1.0 })}
                      className="px-1.5 py-0.5 rounded border border-border hover:bg-muted cursor-pointer transition-colors"
                    >
                      100%
                    </button>
                  </div>
                  <span>100%</span>
                </div>
              </div>
            )}

            {/* Audio Specific: Fade In & Fade Out Controls */}
            {isAudioTrack(selectedClip.trackId, tracks) && (
              <div className="space-y-2 rounded-lg border border-border p-2.5 bg-card">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <SlidersHorizontal className="size-3 text-muted-foreground" />
                    <span>Audio Fades</span>
                  </span>
                  {(selectedClip.fadeInDuration || selectedClip.fadeOutDuration) ? (
                    <button
                      type="button"
                      onClick={() => updateClip(selectedClip.id, { fadeInDuration: 0, fadeOutDuration: 0 })}
                      className="text-3xs text-muted-foreground hover:text-destructive cursor-pointer font-medium"
                      title="Reset fades to 0s"
                    >
                      Reset Fades
                    </button>
                  ) : null}
                </div>

                {/* Fade In Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-2xs">
                    <span className="text-muted-foreground">Fade In</span>
                    <span className="font-mono text-primary font-semibold">
                      {(selectedClip.fadeInDuration || 0).toFixed(2)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.min(5.0, selectedClip.duration / 2)}
                    step="0.05"
                    value={selectedClip.fadeInDuration || 0}
                    onPointerDown={handleSliderPointerDown}
                    onPointerUp={handleSliderPointerUp}
                    onPointerCancel={handleSliderPointerUp}
                    onKeyDown={handleSliderPointerDown}
                    onKeyUp={handleSliderPointerUp}
                    onChange={handleTransientFadeInChange}
                    aria-label="Audio fade-in duration"
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                {/* Fade Out Slider */}
                <div className="space-y-1 pt-1 border-t border-border/50">
                  <div className="flex items-center justify-between text-2xs">
                    <span className="text-muted-foreground">Fade Out</span>
                    <span className="font-mono text-primary font-semibold">
                      {(selectedClip.fadeOutDuration || 0).toFixed(2)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.min(5.0, selectedClip.duration / 2)}
                    step="0.05"
                    value={selectedClip.fadeOutDuration || 0}
                    onPointerDown={handleSliderPointerDown}
                    onPointerUp={handleSliderPointerUp}
                    onPointerCancel={handleSliderPointerUp}
                    onKeyDown={handleSliderPointerDown}
                    onKeyUp={handleSliderPointerUp}
                    onChange={handleTransientFadeOutChange}
                    aria-label="Audio fade-out duration"
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Visual Specific: Speed Controls */}
            {isVisualTrack(selectedClip.trackId, tracks) && (
              <div className="space-y-1.5 rounded-lg border border-border p-2.5 bg-card">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Gauge className="size-3 text-muted-foreground" />
                    <span>Speed</span>
                  </span>
                  <span className="font-mono text-2xs text-muted-foreground">
                    {(selectedClip.speed || 1).toFixed(1)}x
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1 text-center">
                  {[0.5, 1.0, 1.5, 2.0].map((s) => {
                    const isCurrent = (selectedClip.speed || 1.0) === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          const speedVal = s;
                          const updates: Partial<TimelineClip> = { speed: speedVal };
                          if (
                            selectedClip.sourceDuration &&
                            selectedClip.sourceDuration > 0 &&
                            (selectedClip.type === "video" || selectedClip.type === "audio")
                          ) {
                            const maxDur =
                              (selectedClip.sourceDuration - selectedClip.inPoint) / speedVal;
                            if (selectedClip.duration > maxDur) {
                              const clampedDur = Math.max(0.5, parseFloat(maxDur.toFixed(3)));
                              updates.duration = clampedDur;
                              updates.outPoint = selectedClip.inPoint + clampedDur * speedVal;
                            } else {
                              updates.outPoint =
                                selectedClip.inPoint + selectedClip.duration * speedVal;
                            }
                          }
                          updateClip(selectedClip.id, updates);
                        }}
                        className={`py-1 text-2xs font-mono rounded-md border transition-colors cursor-pointer ${
                          isCurrent
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {s.toFixed(1)}x
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clip Operations Toolbar */}
            <div className="space-y-1.5 pt-1">
              <p className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
                Clip Actions
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => splitClipAtPlayhead(selectedClip.id)}
                  className="gap-1 text-xs"
                  title="Split at playhead (Ctrl+B)"
                >
                  <Scissors className="size-3" />
                  <span>Split</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => duplicateClip(selectedClip.id)}
                  className="gap-1 text-xs"
                  title="Duplicate clip (Ctrl+D)"
                >
                  <Copy className="size-3" />
                  <span>Duplicate</span>
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteClip(selectedClip.id)}
                className="w-full gap-1 text-xs text-destructive hover:bg-destructive/10"
                title="Delete clip (Delete / Backspace)"
              >
                <Trash2 className="size-3" />
                <span>Delete Clip</span>
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
