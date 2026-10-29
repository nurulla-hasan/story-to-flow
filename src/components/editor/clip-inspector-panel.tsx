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
  Lock,
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
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  EditorPanel,
  EditorPanelBody,
  EditorPanelHeader,
} from "@/components/editor/editor-panel";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useTimeline } from "@/lib/timeline-context";
import {
  isVisualTrack,
  isAudioTrack,
  isTrackLocked,
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
  findEligibleTransitionPairs,
  getTransitionToNext,
  validateTransitionDuration,
  MAX_TRANSITION_DURATION,
  MIN_TRANSITION_DURATION,
} from "@/lib/transition-helpers";
import { CLIP_SPEED_PRESETS, buildClipSpeedUpdate } from "@/lib/clip-speed";
import { applyRippleExtend } from "@/lib/timeline-trim";
import { hasVisualOverlap } from "@/lib/timeline-overlap";
import { useInspectorClipGestures } from "@/lib/use-inspector-clip-gestures";

export function ClipInspectorPanel({
  collapsed = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
} = {}) {
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

  const {
    getBaseClips,
    handleSliderPointerDown,
    handleSliderPointerUp,
    handleTransientDurationChange,
    handleTransientVolumeChange,
    handleTransientFadeInChange,
    handleTransientFadeOutChange,
    handleTransientZoomAmountChange,
  } = useInspectorClipGestures({
    clips,
    selectedClip,
    tracks,
    setClipsTransient,
    commitClipGesture,
  });

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

  const handleSetImageDurationPreset = (targetDuration: number) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const initialClips: TimelineClip[] = JSON.parse(JSON.stringify(clips));
    const updatedClips = applyRippleExtend(
      selectedClip.id,
      targetDuration,
      initialClips,
      tracks
    );
    commitClipGesture(initialClips, updatedClips);
  };

  const handleToggleClipMute = () => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const isCurrentlyMuted = (selectedClip.volume ?? 1.0) === 0;
    const newVol = isCurrentlyMuted ? 1.0 : 0;
    updateClip(selectedClip.id, { volume: newVol });
  };

  // Scene Motion & Zoom (Ken Burns): pick a preset or remove the effect entirely
  const handleSetZoomEffect = (type: "off" | ZoomEffectType) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
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
    () => clips.filter((c) => isVisualTrack(c.trackId, tracks) && c.type === "image" && !isTrackLocked(c.trackId, tracks)).length,
    [clips, tracks]
  );

  const handleApplyMotionToAll = () => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const effect = sanitizeZoomEffect(selectedClip.zoomEffect);
    if (!effect) return;
    const res = applyMotionToAllClips(effect);
    setMotionApplyFeedback(res.message);
    setTimeout(() => setMotionApplyFeedback(null), 4000);
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
  const transitionToNext = React.useMemo(
    () => getTransitionToNext(selectedClip, clips, transitions, tracks),
    [selectedClip, clips, transitions, tracks]
  );

  const isCurrentTrackLocked = React.useMemo(() => {
    if (!selectedClip) return false;
    return isTrackLocked(selectedClip.trackId, tracks);
  }, [selectedClip, tracks]);

  if (collapsed) {
    return (
      <EditorPanel>
        <div className="flex h-full items-center justify-center gap-2 px-2 py-2 lg:flex-col lg:justify-start">
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={onToggleCollapsed}
            title="Expand inspector"
            aria-label="Expand inspector"
          >
            <PanelRightOpen className="size-3.5" />
          </Button>

          <span className="hidden h-px w-6 bg-border lg:block" />

          <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none lg:flex-col lg:gap-2">
            <span
              className={`size-1.5 shrink-0 rounded-full ${
                selectedClip || selectedTransition ? "bg-primary" : "bg-muted-foreground/40"
              }`}
            />
            <span className="truncate font-mono text-3xs font-semibold uppercase tracking-widest text-muted-foreground lg:hidden">
              {selectedClip?.name ?? selectedTransition?.type ?? "Inspector"}
            </span>
            <span
              className="hidden font-mono text-3xs font-semibold uppercase tracking-widest text-muted-foreground lg:block"
              style={{ writingMode: "vertical-rl" }}
            >
              Inspector
            </span>
          </div>
        </div>
      </EditorPanel>
    );
  }

  return (
    <EditorPanel>
      <EditorPanelHeader
        icon={<SlidersHorizontal className="size-4" />}
        title={selectedTransition ? "Transition inspector" : "Clip inspector"}
        meta={
          selectedTransition
            ? `Configuring ${selectedTransition.type}`
            : isHydrated && selectedClip
              ? `Editing "${selectedClip.name}"`
              : "Nothing selected"
        }
        actions={
          <div className="flex items-center gap-1">
            {isCurrentTrackLocked && (
              <span className="flex items-center gap-1 rounded-full border border-warning/30 bg-warning-subtle px-2 py-0.5 text-3xs font-medium text-warning-subtle-foreground">
                <Lock className="size-2.5" /> Locked
              </span>
            )}
            {(selectedTransition || (isHydrated && selectedClip)) && (
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-3xs font-semibold uppercase tracking-wide text-muted-foreground">
                {selectedTransition ? "transition" : selectedClip?.type}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCollapsed}
              title="Collapse inspector"
              aria-label="Collapse inspector"
            >
              <PanelRightClose className="size-3.5" />
            </Button>
          </div>
        }
      />

      <EditorPanelBody className="gap-3 overflow-y-auto p-3">
        {!isHydrated || (!selectedClip && !selectedTransition) ? (
          /* Empty selection guidance box */
          <div className="my-auto flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-border bg-surface-subtle/60 p-5 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
              <MousePointerClick className="size-4" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">No selection</p>
              <p className="mx-auto max-w-44 text-2xs leading-relaxed text-muted-foreground">
                Pick a scene clip or transition on the timeline to inspect and edit it.
              </p>
            </div>
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
            <div className="space-y-1.5 rounded-xl border border-border bg-surface-subtle/70 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Transition Style</span>
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-3xs font-semibold tracking-wide text-primary">
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
                      className={`cursor-pointer rounded-lg border p-2 text-left transition-all duration-150 ${
                        isCurrent
                          ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
                          : "border-border/70 bg-card hover:border-primary/30 hover:bg-muted"
                      }`}
                    >
                      <p
                        className={`text-3xs font-semibold ${
                          isCurrent ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {preset.label}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-3xs text-muted-foreground">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transition Duration Slider */}
            <div className="space-y-1.5 rounded-xl border border-border bg-surface-subtle/70 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="size-3 text-muted-foreground" />
                  <span>Duration</span>
                </span>
                <span className="font-mono text-xs font-semibold text-primary">
                  {selectedTransition.duration.toFixed(2)}s
                </span>
              </div>

              <Slider
                min={0.2}
                max={1.5}
                step={0.05}
                value={selectedTransition.duration}
                onValueChange={(val) => {
                  const num = Array.isArray(val) ? val[0] : val;
                  updateTransition(selectedTransition.id, {
                    duration: typeof num === "number" ? num : parseFloat(String(num)),
                  });
                }}
                aria-label="Transition duration"
                className="w-full"
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
                size="default"
                onClick={() => handleApplyToAll(selectedTransition.id)}
                disabled={eligibleTransitionBoundaryCount === 0}
                className="w-full"
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
                <div className="flex items-start gap-1.5 rounded-lg border border-primary/20 bg-primary/10 p-2 text-3xs font-medium leading-relaxed text-primary animate-in fade-in">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  <span>{applyFeedback}</span>
                </div>
              )}
            </div>

            {/* Remove Transition Button */}
            <Button
              variant="destructive"
              size="default"
              onClick={() => deleteTransition(selectedTransition.id)}
              className="w-full"
              title="Delete this transition"
            >
              <Trash2 className="size-3" />
              <span>Remove transition</span>
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
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-subtle/70 p-3">
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
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-subtle/70 p-3">
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
                <div className="space-y-2 rounded-xl border border-border bg-surface-subtle/70 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Move className="size-3 text-primary" />
                      <span>Canvas Transform</span>
                    </span>
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          updateClip(selectedClip.id, {
                            transform: { ...DEFAULT_CLIP_TRANSFORM },
                          })
                        }
                        title="Reset position, scale, and rotation to default"
                      >
                        <RotateCcw className="size-2.5" />
                        <span>Reset</span>
                      </Button>
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
                    <Slider
                      min={10}
                      max={300}
                      step={5}
                      value={Math.round(transform.scale * 100)}
                      onPointerDown={handleSliderPointerDown}
                      onPointerUp={handleSliderPointerUp}
                      onPointerCancel={handleSliderPointerUp}
                      onKeyDown={handleSliderPointerDown}
                      onKeyUp={handleSliderPointerUp}
                      onValueChange={(val) => {
                        const baseClips = getBaseClips();
                        const num = Array.isArray(val) ? val[0] : val;
                        const scaleVal = parseFloat((Number(num) / 100).toFixed(2));
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
                      className="w-full"
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
                      <Slider
                        min={-100}
                        max={100}
                        step={2}
                        value={Math.round(transform.x * 100)}
                        onPointerDown={handleSliderPointerDown}
                        onPointerUp={handleSliderPointerUp}
                        onPointerCancel={handleSliderPointerUp}
                        onKeyDown={handleSliderPointerDown}
                        onKeyUp={handleSliderPointerUp}
                        onValueChange={(val) => {
                          const baseClips = getBaseClips();
                          const num = Array.isArray(val) ? val[0] : val;
                          const xVal = parseFloat((Number(num) / 100).toFixed(2));
                          setClipsTransient(
                            baseClips.map((c) =>
                              c.id === selectedClip.id
                                ? { ...c, transform: sanitizeClipTransform({ ...transform, x: xVal }) }
                                : c
                            )
                          );
                        }}
                        aria-label="Transform position X"
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-3xs">
                        <span className="text-muted-foreground">Pos Y</span>
                        <span className="font-mono text-muted-foreground">
                          {Math.round(transform.y * 100)}%
                        </span>
                      </div>
                      <Slider
                        min={-100}
                        max={100}
                        step={2}
                        value={Math.round(transform.y * 100)}
                        onPointerDown={handleSliderPointerDown}
                        onPointerUp={handleSliderPointerUp}
                        onPointerCancel={handleSliderPointerUp}
                        onKeyDown={handleSliderPointerDown}
                        onKeyUp={handleSliderPointerUp}
                        onValueChange={(val) => {
                          const baseClips = getBaseClips();
                          const num = Array.isArray(val) ? val[0] : val;
                          const yVal = parseFloat((Number(num) / 100).toFixed(2));
                          setClipsTransient(
                            baseClips.map((c) =>
                              c.id === selectedClip.id
                                ? { ...c, transform: sanitizeClipTransform({ ...transform, y: yVal }) }
                                : c
                            )
                          );
                        }}
                        aria-label="Transform position Y"
                        className="w-full"
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
                      <Slider
                        min={-180}
                        max={180}
                        step={1}
                        value={Math.round(transform.rotation || 0)}
                        onPointerDown={handleSliderPointerDown}
                        onPointerUp={handleSliderPointerUp}
                        onPointerCancel={handleSliderPointerUp}
                        onKeyDown={handleSliderPointerDown}
                        onKeyUp={handleSliderPointerUp}
                        onValueChange={(val) => {
                          const baseClips = getBaseClips();
                          const num = Array.isArray(val) ? val[0] : val;
                          const rotVal = Number(num);
                          setClipsTransient(
                            baseClips.map((c) =>
                              c.id === selectedClip.id
                                ? { ...c, transform: sanitizeClipTransform({ ...transform, rotation: rotVal }) }
                                : c
                            )
                          );
                        }}
                        aria-label="Transform rotation"
                        className="w-full"
                      />
                      <Button
                        variant="secondary"
                        size="xs"
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
                        className="font-mono shrink-0"
                        title="Rotate 90 degrees clockwise"
                      >
                        +90°
                      </Button>
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
                <div className="space-y-2 rounded-xl border border-border bg-surface-subtle/70 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <ZoomIn className="size-3 text-primary" />
                      <span>Scene Motion</span>
                    </span>
                    {effect && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          updateClip(selectedClip.id, { zoomEffect: undefined })
                        }
                        title="Remove motion effect from this scene"
                      >
                        <RotateCcw className="size-2.5" />
                        <span>Remove</span>
                      </Button>
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
                        <Slider
                          min={MIN_ZOOM_EFFECT_AMOUNT * 100}
                          max={MAX_ZOOM_EFFECT_AMOUNT * 100}
                          step={1}
                          value={amountPct}
                          onPointerDown={handleSliderPointerDown}
                          onPointerUp={handleSliderPointerUp}
                          onPointerCancel={handleSliderPointerUp}
                          onKeyDown={handleSliderPointerDown}
                          onKeyUp={handleSliderPointerUp}
                          onValueChange={handleTransientZoomAmountChange}
                          aria-label="Scene motion strength"
                          className="w-full"
                        />
                        <p className="text-3xs text-muted-foreground">
                          {getMotionDescription()}
                        </p>
                      </div>

                      {/* Apply to All Clips Button */}
                      <div className="space-y-1.5 pt-1">
                        <Button
                          variant="outline"
                          size="default"
                          onClick={handleApplyMotionToAll}
                          disabled={imageClipsCount <= 1}
                          className="w-full"
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
                          <div className="flex items-start gap-1.5 rounded-lg border border-primary/20 bg-primary/10 p-2 text-3xs font-medium leading-relaxed text-primary animate-in fade-in">
                            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
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
            <div className="space-y-1.5 rounded-xl border border-border bg-surface-subtle/70 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="size-3 text-muted-foreground" />
                  <span>Duration</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {selectedClip.type === "image" && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant={Math.abs(selectedClip.duration - 4) < 0.05 ? "default" : "outline"}
                        size="xs"
                        disabled={isCurrentTrackLocked}
                        onClick={() => handleSetImageDurationPreset(4)}
                        title="Set duration to 4 seconds"
                      >
                        4s
                      </Button>
                      <Button
                        variant={Math.abs(selectedClip.duration - 5) < 0.05 ? "default" : "outline"}
                        size="xs"
                        disabled={isCurrentTrackLocked}
                        onClick={() => handleSetImageDurationPreset(5)}
                        title="Set duration to 5 seconds"
                      >
                        5s
                      </Button>
                    </div>
                  )}
                  <span className="font-mono text-xs font-semibold text-primary">
                    {selectedClip.duration.toFixed(2)}s
                  </span>
                </div>
              </div>

              <Slider
                min={0.5}
                max={
                  selectedClip.sourceDuration && selectedClip.sourceDuration > 0
                    ? Math.max(
                        0.5,
                        (selectedClip.sourceDuration - selectedClip.inPoint) /
                          (selectedClip.speed || 1.0)
                      )
                    : 30
                }
                step={0.1}
                value={selectedClip.duration}
                disabled={isCurrentTrackLocked}
                onPointerDown={handleSliderPointerDown}
                onPointerUp={handleSliderPointerUp}
                onPointerCancel={handleSliderPointerUp}
                onKeyDown={handleSliderPointerDown}
                onKeyUp={handleSliderPointerUp}
                onValueChange={handleTransientDurationChange}
                aria-label="Clip duration"
                className="w-full"
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
              <div className="space-y-2 rounded-xl border border-border bg-surface-subtle/70 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Sparkles className="size-3 text-primary" />
                    <span>Transition to Next Scene</span>
                  </span>
                  {transitionToNext.existing && (
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-3xs font-semibold tracking-wide text-primary">
                      {transitionToNext.existing.type}
                    </span>
                  )}
                </div>

                {transitionToNext.existing ? (
                  /* Existing Transition Controls */
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-1.5">
                      {TRANSITION_PRESETS.map((p) => {
                        const isCurrent = transitionToNext.existing?.type === p.type;
                        return (
                          <button
                            key={p.type}
                            type="button"
                            disabled={isCurrentTrackLocked}
                            onClick={() =>
                              updateTransition(transitionToNext.existing!.id, {
                                type: p.type as TransitionType,
                              })
                            }
                            className={`cursor-pointer rounded-lg border px-2 py-1.5 text-center text-3xs font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 ${
                              isCurrent
                                ? "border-primary/60 bg-primary/10 text-primary ring-1 ring-primary/40"
                                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground"
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

                    <Slider
                      disabled={isCurrentTrackLocked}
                      min={MIN_TRANSITION_DURATION}
                      max={validateTransitionDuration(
                        MAX_TRANSITION_DURATION,
                        selectedClip,
                        transitionToNext.nextClip
                      )}
                      step={0.05}
                      value={transitionToNext.existing.duration}
                      onValueChange={(val) => {
                        const num = Array.isArray(val) ? val[0] : val;
                        updateTransition(transitionToNext.existing!.id, {
                          duration: typeof num === "number" ? num : parseFloat(String(num)),
                        });
                      }}
                      className="w-full"
                    />

                    {/* Apply to All Transitions Action Button */}
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => handleApplyToAll(transitionToNext.existing!.id)}
                      disabled={isCurrentTrackLocked || eligibleTransitionBoundaryCount === 0}
                      className="w-full"
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
                      <div className="flex items-start gap-1 rounded-lg border border-primary/20 bg-primary/10 p-1.5 text-3xs font-medium leading-relaxed text-primary animate-in fade-in">
                        <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                        <span>{applyFeedback}</span>
                      </div>
                    )}

                    <Button
                      variant="destructive"
                      size="default"
                      disabled={isCurrentTrackLocked}
                      onClick={() => deleteTransition(transitionToNext.existing!.id)}
                      className="w-full"
                    >
                      <Trash2 className="size-3" />
                      <span>Remove transition</span>
                    </Button>
                  </div>
                ) : (
                  /* Add Transition Button */
                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="default"
                      disabled={isCurrentTrackLocked}
                      onClick={() =>
                        addTransition(selectedClip.id, transitionToNext.nextClip.id, "cross-dissolve", 0.5)
                      }
                      className="w-full"
                      title="Add visual transition to next clip"
                    >
                      <Sparkles className="size-3" />
                      <span>Add transition to next scene</span>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Audio & Video Scene Volume & Mute Controls */}
            {(isAudioTrack(selectedClip.trackId, tracks) || selectedClip.type === "video") && (
              <div className="space-y-2 rounded-xl border border-border bg-surface-subtle/70 p-3">
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
                      variant={(selectedClip.volume ?? 1.0) === 0 ? "default" : "outline"}
                      size="sm"
                      disabled={isCurrentTrackLocked}
                      onClick={handleToggleClipMute}
                    >
                      {(selectedClip.volume ?? 1.0) === 0 ? "Unmute" : "Mute"}
                    </Button>
                  </div>
                </div>

                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={isCurrentTrackLocked}
                  value={selectedClip.volume ?? 1.0}
                  onPointerDown={handleSliderPointerDown}
                  onPointerUp={handleSliderPointerUp}
                  onPointerCancel={handleSliderPointerUp}
                  onKeyDown={handleSliderPointerDown}
                  onKeyUp={handleSliderPointerUp}
                  onValueChange={handleTransientVolumeChange}
                  aria-label={selectedClip.type === "video" ? "Video volume" : "Audio clip volume"}
                  className="w-full"
                />

                <div className="flex items-center justify-between text-3xs text-muted-foreground font-mono">
                  <span>0% (Mute)</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={isCurrentTrackLocked}
                      onClick={() => updateClip(selectedClip.id, { volume: 0 })}
                    >
                      0% (Mute)
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={isCurrentTrackLocked}
                      onClick={() => updateClip(selectedClip.id, { volume: 0.5 })}
                    >
                      50%
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={isCurrentTrackLocked}
                      onClick={() => updateClip(selectedClip.id, { volume: 1.0 })}
                    >
                      100%
                    </Button>
                  </div>
                  <span>100%</span>
                </div>
              </div>
            )}

            {/* Audio Specific: Fade In & Fade Out Controls */}
            {isAudioTrack(selectedClip.trackId, tracks) && (
              <div className="space-y-2 rounded-xl border border-border bg-surface-subtle/70 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <SlidersHorizontal className="size-3 text-muted-foreground" />
                    <span>Audio Fades</span>
                  </span>
                  {(selectedClip.fadeInDuration || selectedClip.fadeOutDuration) ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={isCurrentTrackLocked}
                      onClick={() => updateClip(selectedClip.id, { fadeInDuration: 0, fadeOutDuration: 0 })}
                      title="Reset fades to 0s"
                    >
                      Reset Fades
                    </Button>
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
                  <Slider
                    min={0}
                    max={Math.min(5.0, selectedClip.duration / 2)}
                    step={0.05}
                    disabled={isCurrentTrackLocked}
                    value={selectedClip.fadeInDuration || 0}
                    onPointerDown={handleSliderPointerDown}
                    onPointerUp={handleSliderPointerUp}
                    onPointerCancel={handleSliderPointerUp}
                    onKeyDown={handleSliderPointerDown}
                    onKeyUp={handleSliderPointerUp}
                    onValueChange={handleTransientFadeInChange}
                    aria-label="Audio fade-in duration"
                    className="w-full"
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
                  <Slider
                    min={0}
                    max={Math.min(5.0, selectedClip.duration / 2)}
                    step={0.05}
                    disabled={isCurrentTrackLocked}
                    value={selectedClip.fadeOutDuration || 0}
                    onPointerDown={handleSliderPointerDown}
                    onPointerUp={handleSliderPointerUp}
                    onPointerCancel={handleSliderPointerUp}
                    onKeyDown={handleSliderPointerDown}
                    onKeyUp={handleSliderPointerUp}
                    onValueChange={handleTransientFadeOutChange}
                    aria-label="Audio fade-out duration"
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Visual Specific: Speed Controls */}
            {isVisualTrack(selectedClip.trackId, tracks) && (
              <div className="space-y-1.5 rounded-xl border border-border bg-surface-subtle/70 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Gauge className="size-3 text-muted-foreground" />
                    <span>Speed</span>
                  </span>
                  <span className="font-mono text-2xs text-muted-foreground">
                    {(selectedClip.speed || 1).toFixed(1)}x
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {CLIP_SPEED_PRESETS.map((s) => {
                    const isCurrent = (selectedClip.speed || 1.0) === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={isCurrentTrackLocked || isCurrent}
                        onClick={() =>
                          updateClip(selectedClip.id, buildClipSpeedUpdate(selectedClip, s))
                        }
                        className={`cursor-pointer rounded-lg border py-1 font-mono text-3xs font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                          isCurrent
                            ? "border-primary/60 bg-primary/10 text-primary ring-1 ring-primary/40"
                            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground"
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
                  size="default"
                  onClick={() => splitClipAtPlayhead(selectedClip.id)}
                  title="Split at playhead (Ctrl+B)"
                >
                  <Scissors className="size-3" />
                  <span>Split</span>
                </Button>

                <Button
                  variant="outline"
                  size="default"
                  onClick={() => duplicateClip(selectedClip.id)}
                  title="Duplicate clip (Ctrl+D)"
                >
                  <Copy className="size-3" />
                  <span>Duplicate</span>
                </Button>
              </div>

              <Button
                variant="destructive"
                size="default"
                onClick={() => deleteClip(selectedClip.id)}
                className="w-full"
                title="Delete clip (Delete / Backspace)"
              >
                <Trash2 className="size-3" />
                <span>Delete clip</span>
              </Button>
            </div>
          </div>
        ) : null}
      </EditorPanelBody>
    </EditorPanel>
  );
}
