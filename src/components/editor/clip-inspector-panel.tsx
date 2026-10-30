"use client";

import * as React from "react";
import {
  SlidersHorizontal,
  MousePointerClick,
  Volume2,
  Layers,
  Sparkles,
  Lock,
  CopyCheck,
  CheckCircle2,
  Trash2,
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
import { useTimelineState } from "@/lib/timeline-context";
import { useInspectorClipGestureHistory } from "@/features/editor/hooks/use-inspector-clip-gesture-history";
import { TransitionInspectorSection } from "@/features/editor/components/inspector/transition-inspector-section";
import { ClipTransformSection } from "@/features/editor/components/inspector/clip-transform-section";
import { ClipMotionSection } from "@/features/editor/components/inspector/clip-motion-section";
import { ClipTimingSection } from "@/features/editor/components/inspector/clip-timing-section";
import { ClipAudioSection } from "@/features/editor/components/inspector/clip-audio-section";
import { ClipSpeedSection } from "@/features/editor/components/inspector/clip-speed-section";
import { ClipActionsSection } from "@/features/editor/components/inspector/clip-actions-section";
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
  DEFAULT_ZOOM_EFFECT_AMOUNT,
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
import { validateFadeDuration } from "@/lib/audio-fade-helpers";
import { applyRippleExtend } from "@/lib/timeline-trim";
import { hasVisualOverlap } from "@/lib/timeline-overlap";

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
  } = useTimelineState();

  const {
    beginGesture,
    finishGesture: handleSliderPointerUp,
    getBaseClips,
    setLatestClips,
  } = useInspectorClipGestureHistory({ clips, commitClipGesture });

  const handleSliderPointerDown = () => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    beginGesture();
  };
  const [applyFeedback, setApplyFeedback] = React.useState<string | null>(null);

  // Apply-to-all targets every eligible visual boundary, not only existing transitions.
  const eligibleTransitionBoundaryCount = React.useMemo(
    () => findEligibleTransitionPairs(clips).length,
    [clips],
  );

  const handleApplyToAll = (transitionId: string) => {
    const res = applyToAllTransitions(transitionId);
    setApplyFeedback(res.message);
    setTimeout(() => setApplyFeedback(null), 4000);
  };

  // Intermediate transient handler for smooth slider scrubbing with ripple extension
  const handleTransientDurationChange = (val: number | readonly number[]) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const baseClips = getBaseClips();
    const rawVal = Array.isArray(val) ? val[0] : val;
    const num =
      typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
    if (!isNaN(num) && num >= 0.5) {
      const speed =
        selectedClip.speed && selectedClip.speed > 0 ? selectedClip.speed : 1.0;
      let clampedDur = num;
      if (selectedClip.sourceDuration && selectedClip.sourceDuration > 0) {
        const remaining =
          (selectedClip.sourceDuration - selectedClip.inPoint) / speed;
        clampedDur = Math.min(clampedDur, remaining);
      }
      const transientClips = applyRippleExtend(
        selectedClip.id,
        clampedDur,
        baseClips,
        tracks,
      );
      setLatestClips(transientClips);
      setClipsTransient(transientClips);
    }
  };

  const handleSetImageDurationPreset = (targetDuration: number) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const initialClips: TimelineClip[] = clips.map((c) => ({
      ...c,
      zoomEffect: c.zoomEffect ? { ...c.zoomEffect } : undefined,
      transform: c.transform ? { ...c.transform } : undefined,
    }));
    const updatedClips = applyRippleExtend(
      selectedClip.id,
      targetDuration,
      initialClips,
      tracks,
    );
    commitClipGesture(initialClips, updatedClips);
  };

  const handleTransientVolumeChange = (val: number | readonly number[]) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const baseClips = getBaseClips();
    const rawVal = Array.isArray(val) ? val[0] : val;
    const num =
      typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
    if (!isNaN(num)) {
      const updated = baseClips.map((c) =>
        c.id === selectedClip.id ? { ...c, volume: num } : c,
      );
      setLatestClips(updated);
      setClipsTransient(updated);
    }
  };

  const handleToggleClipMute = () => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const isCurrentlyMuted = (selectedClip.volume ?? 1.0) === 0;
    const newVol = isCurrentlyMuted ? 1.0 : 0;
    updateClip(selectedClip.id, { volume: newVol });
  };

  const handleTransientFadeInChange = (val: number | readonly number[]) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const baseClips = getBaseClips();
    const rawVal = Array.isArray(val) ? val[0] : val;
    const num =
      typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
    const safeFade = validateFadeDuration(
      num,
      selectedClip.duration,
      selectedClip.fadeOutDuration ?? 0,
    );
    setClipsTransient(
      baseClips.map((c) =>
        c.id === selectedClip.id ? { ...c, fadeInDuration: safeFade } : c,
      ),
    );
  };

  const handleTransientFadeOutChange = (val: number | readonly number[]) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const baseClips = getBaseClips();
    const rawVal = Array.isArray(val) ? val[0] : val;
    const num =
      typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
    const safeFade = validateFadeDuration(
      num,
      selectedClip.duration,
      selectedClip.fadeInDuration ?? 0,
    );
    setClipsTransient(
      baseClips.map((c) =>
        c.id === selectedClip.id ? { ...c, fadeOutDuration: safeFade } : c,
      ),
    );
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

  const [motionApplyFeedback, setMotionApplyFeedback] = React.useState<
    string | null
  >(null);

  // Eligible image scenes for applying motion across the project
  const imageClipsCount = React.useMemo(
    () =>
      clips.filter(
        (c) =>
          isVisualTrack(c.trackId, tracks) &&
          c.type === "image" &&
          !isTrackLocked(c.trackId, tracks),
      ).length,
    [clips, tracks],
  );

  const handleApplyMotionToAll = () => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const effect = sanitizeZoomEffect(selectedClip.zoomEffect);
    if (!effect) return;
    const res = applyMotionToAllClips(effect);
    setMotionApplyFeedback(res.message);
    setTimeout(() => setMotionApplyFeedback(null), 4000);
  };

  // Transient strength scrubbing keeps a single history entry per drag
  const handleTransientZoomAmountChange = (val: number | readonly number[]) => {
    if (!selectedClip || isTrackLocked(selectedClip.trackId, tracks)) return;
    const effect = sanitizeZoomEffect(selectedClip.zoomEffect);
    if (!effect) return;
    const baseClips = getBaseClips();
    const rawVal = Array.isArray(val) ? val[0] : val;
    const num =
      typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
    const amount = num / 100;
    const zoomEffect = sanitizeZoomEffect({ ...effect, amount });
    setClipsTransient(
      baseClips.map((c) =>
        c.id === selectedClip.id ? { ...c, zoomEffect } : c,
      ),
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
    return isAudioTrack(selectedClip.trackId, tracks)
      ? "Audio Track"
      : "Visual Track";
  }, [selectedClip, tracks]);

  // Find if selected visual clip has an adjacent next clip eligible for transition
  const transitionToNext = React.useMemo(
    () => getTransitionToNext(selectedClip, clips, transitions, tracks),
    [selectedClip, clips, transitions, tracks],
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
                selectedClip || selectedTransition
                  ? "bg-primary"
                  : "bg-muted-foreground/40"
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
              <p className="text-xs font-semibold text-foreground">
                No selection
              </p>
              <p className="mx-auto max-w-44 text-2xs leading-relaxed text-muted-foreground">
                Pick a scene clip or transition on the timeline to inspect and
                edit it.
              </p>
            </div>
          </div>
        ) : selectedTransition ? (
          /* TRANSITION INSPECTOR VIEW */
          <TransitionInspectorSection
            selectedTransition={selectedTransition}
            eligibleTransitionBoundaryCount={eligibleTransitionBoundaryCount}
            applyFeedback={applyFeedback}
            onApplyToAll={handleApplyToAll}
            updateTransition={updateTransition}
            deleteTransition={deleteTransition}
          />
        ) : selectedClip ? (
          /* ACTIVE CLIP PROPERTIES VIEW */
          <div className="space-y-3.5 flex-1 min-h-0 overflow-y-auto pr-1">
            {/* Visual Layer Dynamic Track Switcher */}
            {isVisualTrack(selectedClip.trackId, tracks) &&
              visualTracksList.length > 1 && (
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
                          tracks,
                        );

                      return (
                        <button
                          key={tr.id}
                          type="button"
                          disabled={isCurrent || wouldCollide || tr.locked}
                          onClick={() =>
                            updateClip(selectedClip.id, { trackId: tr.id })
                          }
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
            {isAudioTrack(selectedClip.trackId, tracks) &&
              audioTracksList.length > 1 && (
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
                          onClick={() =>
                            updateClip(selectedClip.id, { trackId: tr.id })
                          }
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

            <ClipTransformSection
              selectedClip={selectedClip}
              tracks={tracks}
              updateClip={updateClip}
              beginGesture={handleSliderPointerDown}
              finishGesture={handleSliderPointerUp}
              getBaseClips={getBaseClips}
              setClipsTransient={setClipsTransient}
            />
            <ClipMotionSection
              selectedClip={selectedClip}
              updateClip={updateClip}
              handleSetZoomEffect={handleSetZoomEffect}
              handleTransientZoomAmountChange={handleTransientZoomAmountChange}
              handleSliderPointerDown={handleSliderPointerDown}
              handleSliderPointerUp={handleSliderPointerUp}
              imageClipsCount={imageClipsCount}
              motionApplyFeedback={motionApplyFeedback}
              handleApplyMotionToAll={handleApplyMotionToAll}
            />
            <ClipTimingSection
              selectedClip={selectedClip}
              isCurrentTrackLocked={isCurrentTrackLocked}
              handleSetImageDurationPreset={handleSetImageDurationPreset}
              handleSliderPointerDown={handleSliderPointerDown}
              handleSliderPointerUp={handleSliderPointerUp}
              handleTransientDurationChange={handleTransientDurationChange}
            />
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
                        const isCurrent =
                          transitionToNext.existing?.type === p.type;
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
                        transitionToNext.nextClip,
                      )}
                      step={0.05}
                      value={transitionToNext.existing.duration}
                      onValueChange={(val) => {
                        const num = Array.isArray(val) ? val[0] : val;
                        updateTransition(transitionToNext.existing!.id, {
                          duration:
                            typeof num === "number"
                              ? num
                              : parseFloat(String(num)),
                        });
                      }}
                      className="w-full"
                    />

                    {/* Apply to All Transitions Action Button */}
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() =>
                        handleApplyToAll(transitionToNext.existing!.id)
                      }
                      disabled={
                        isCurrentTrackLocked ||
                        eligibleTransitionBoundaryCount === 0
                      }
                      className="w-full"
                      title={
                        eligibleTransitionBoundaryCount === 0
                          ? "No eligible adjacent visual clip boundaries"
                          : `Apply ${transitionToNext.existing.type.replace("-", " ")} (${transitionToNext.existing.duration.toFixed(2)}s) to all ${eligibleTransitionBoundaryCount} eligible clip boundaries`
                      }
                    >
                      <CopyCheck className="size-3" />
                      <span>
                        Apply to All Transitions (
                        {eligibleTransitionBoundaryCount})
                      </span>
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
                      onClick={() =>
                        deleteTransition(transitionToNext.existing!.id)
                      }
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
                        addTransition(
                          selectedClip.id,
                          transitionToNext.nextClip.id,
                          "cross-dissolve",
                          0.5,
                        )
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

            <ClipAudioSection
              selectedClip={selectedClip}
              tracks={tracks}
              isCurrentTrackLocked={isCurrentTrackLocked}
              updateClip={updateClip}
              handleToggleClipMute={handleToggleClipMute}
              handleSliderPointerDown={handleSliderPointerDown}
              handleSliderPointerUp={handleSliderPointerUp}
              handleTransientVolumeChange={handleTransientVolumeChange}
              handleTransientFadeInChange={handleTransientFadeInChange}
              handleTransientFadeOutChange={handleTransientFadeOutChange}
            />
            <ClipSpeedSection
              selectedClip={selectedClip}
              isCurrentTrackLocked={isCurrentTrackLocked}
              tracks={tracks}
              updateClip={updateClip}
            />
            <ClipActionsSection
              selectedClip={selectedClip}
              splitClipAtPlayhead={splitClipAtPlayhead}
              duplicateClip={duplicateClip}
              deleteClip={deleteClip}
            />
          </div>
        ) : null}
      </EditorPanelBody>
    </EditorPanel>
  );
}
