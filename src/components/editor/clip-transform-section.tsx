"use client";

import { Move, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { TimelineClip } from "@/types/timeline";
import { DEFAULT_CLIP_TRANSFORM, sanitizeClipTransform } from "@/lib/clip-transform";

interface ClipTransformSectionProps {
  clip: TimelineClip;
  isLocked: boolean;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  getBaseClips: () => TimelineClip[];
  setClipsTransient: (clips: TimelineClip[]) => void;
  handleSliderPointerDown: () => void;
  handleSliderPointerUp: () => void;
}

export function ClipTransformSection({
  clip,
  isLocked,
  onUpdateClip,
  getBaseClips,
  setClipsTransient,
  handleSliderPointerDown,
  handleSliderPointerUp,
}: ClipTransformSectionProps) {
  return (
    <>
            {/* Canvas Transform (Position & Scale Gizmo Sync) */}
            {isVisualTrack(clip.trackId, tracks) && (() => {
              const transform = sanitizeClipTransform(clip.transform);
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
                          onUpdateClip(clip.id, {
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
                            c.id === clip.id
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
                              c.id === clip.id
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
                              c.id === clip.id
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
                              c.id === clip.id
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
                          onUpdateClip(clip.id, {
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


    </>
  );
}
