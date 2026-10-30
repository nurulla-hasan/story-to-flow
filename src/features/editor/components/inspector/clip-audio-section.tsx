"use client";

import { SlidersHorizontal, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { isAudioTrack, type TimelineClip, type TimelineTrack } from "@/types/timeline";

interface ClipAudioSectionProps {
  selectedClip: TimelineClip;
  tracks: TimelineTrack[];
  isCurrentTrackLocked: boolean;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  handleToggleClipMute: () => void;
  handleSliderPointerDown: () => void;
  handleSliderPointerUp: () => void;
  handleTransientVolumeChange: (value: number | readonly number[]) => void;
  handleTransientFadeInChange: (value: number | readonly number[]) => void;
  handleTransientFadeOutChange: (value: number | readonly number[]) => void;
}

/** Owns clip volume/mute and audio fade controls; state changes stay in timeline commands. */
export function ClipAudioSection({
  selectedClip, tracks, isCurrentTrackLocked, updateClip, handleToggleClipMute,
  handleSliderPointerDown, handleSliderPointerUp, handleTransientVolumeChange,
  handleTransientFadeInChange, handleTransientFadeOutChange,
}: ClipAudioSectionProps) {
  return (
    <>
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
    </>
  );
}
