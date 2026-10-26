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
  Layers,
  Sparkles,
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
import { isVisualTrack, isAudioTrack, type TransitionType } from "@/types/timeline";
import {
  TRANSITION_PRESETS,
  areClipsAdjacentForTransition,
  validateTransitionDuration,
} from "@/lib/transition-helpers";

export function ClipInspectorPanel() {
  const {
    isHydrated,
    clips,
    transitions,
    selectedClip,
    selectedTransition,
    trimClip,
    updateClip,
    splitClipAtPlayhead,
    deleteClip,
    duplicateClip,
    addTransition,
    updateTransition,
    deleteTransition,
  } = useTimeline();

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedClip) return;
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0.5) {
      trimClip(selectedClip.id, val);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedClip) return;
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      updateClip(selectedClip.id, { volume: val });
    }
  };

  // Find if selected visual clip has an adjacent next clip eligible for transition
  const transitionToNext = React.useMemo(() => {
    if (!selectedClip || !isVisualTrack(selectedClip.trackId)) return null;

    const trackVisuals = clips
      .filter((c) => c.trackId === selectedClip.trackId)
      .sort((a, b) => a.startTime - b.startTime);

    const myIndex = trackVisuals.findIndex((c) => c.id === selectedClip.id);
    if (myIndex === -1 || myIndex >= trackVisuals.length - 1) return null;

    const nextClip = trackVisuals[myIndex + 1];
    if (!areClipsAdjacentForTransition(selectedClip, nextClip)) return null;

    const existing = transitions.find(
      (t) => t.fromClipId === selectedClip.id && t.toClipId === nextClip.id
    );

    return { nextClip, existing };
  }, [selectedClip, clips, transitions]);

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
                  Track: {isAudioTrack(selectedClip.trackId) ? "Voiceover" : selectedClip.trackId === "visual-2" ? "Visual Track 2 (Overlay)" : "Visual Track 1 (Base)"}
                </p>
              </div>
            </div>

            {/* Visual Layer Track Switcher */}
            {isVisualTrack(selectedClip.trackId) && (
              <div className="space-y-1.5 rounded-lg border border-border p-2.5 bg-card">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Layers className="size-3 text-muted-foreground" />
                    <span>Visual Track Layer</span>
                  </span>
                  <span className="text-3xs text-muted-foreground font-mono">
                    {selectedClip.trackId === "visual-2" ? "Top Layer (z-2)" : "Base Layer (z-1)"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => updateClip(selectedClip.id, { trackId: "visual-1" })}
                    className={`py-1 px-2 text-2xs rounded-md border text-center transition-colors cursor-pointer ${
                      selectedClip.trackId !== "visual-2"
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Track 1 (Base)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateClip(selectedClip.id, { trackId: "visual-2" })}
                    className={`py-1 px-2 text-2xs rounded-md border text-center transition-colors cursor-pointer ${
                      selectedClip.trackId === "visual-2"
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Track 2 (Overlay)
                  </button>
                </div>
              </div>
            )}

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
                    ? Math.max(0.5, selectedClip.sourceDuration - selectedClip.inPoint)
                    : 30
                }
                step="0.1"
                value={selectedClip.duration}
                onChange={handleDurationChange}
                aria-label="Clip duration"
                className="w-full accent-primary cursor-pointer"
              />

              <div className="flex items-center justify-between text-3xs text-muted-foreground font-mono">
                <span>0.5s</span>
                <span>
                  Max:{" "}
                  {selectedClip.sourceDuration && selectedClip.sourceDuration > 0
                    ? `${selectedClip.sourceDuration.toFixed(1)}s`
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
                      min="0.2"
                      max={validateTransitionDuration(1.5, selectedClip, transitionToNext.nextClip)}
                      step="0.05"
                      value={transitionToNext.existing.duration}
                      onChange={(e) =>
                        updateTransition(transitionToNext.existing!.id, {
                          duration: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-primary cursor-pointer"
                    />

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

            {/* Audio Specific: Volume Control Slider */}
            {isAudioTrack(selectedClip.trackId) && (
              <div className="space-y-1.5 rounded-lg border border-border p-2.5 bg-card">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Volume2 className="size-3 text-muted-foreground" />
                    <span>Track Volume</span>
                  </span>
                  <span className="font-mono text-xs font-semibold text-primary">
                    {Math.round((selectedClip.volume ?? 1.0) * 100)}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedClip.volume ?? 1.0}
                  onChange={handleVolumeChange}
                  aria-label="Audio clip volume"
                  className="w-full accent-primary cursor-pointer"
                />

                <div className="flex items-center justify-between text-3xs text-muted-foreground font-mono">
                  <span>0% (Mute)</span>
                  <span>100%</span>
                </div>
              </div>
            )}

            {/* Visual Specific: Speed Controls */}
            {isVisualTrack(selectedClip.trackId) && (
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
                          updateClip(selectedClip.id, { speed: s });
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
