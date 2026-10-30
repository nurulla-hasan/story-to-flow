"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Copy, Layers, Magnet, Mic, Music, Plus, Radio, Scissors, Trash2, Volume2, Wand2, ZoomIn, ZoomOut } from "lucide-react";
import type { AudioTrackRole, TrackId, TrackType } from "@/types/timeline";
import { MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM } from "@/lib/ruler-scale";

interface TimelineActionsToolbarProps {
  isHydrated: boolean;
  playhead: number;
  zoom: number;
  snapEnabled: boolean;
  setSnapEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  hasAudio: boolean;
  hasVisual: boolean;
  addTrack: (type: TrackType, role?: AudioTrackRole, name?: string) => TrackId;
  splitClipAtPlayhead: (clipId?: string) => void;
  deleteClip: (clipId: string) => void;
  deleteTransition: (transitionId: string) => void;
  duplicateClip: (clipId: string) => void;
  fitVisualsToVoiceover: () => { success: boolean; message: string };
  handleZoomChange: (zoom: number) => void;
}

export function TimelineActionsToolbar({ isHydrated, playhead, zoom, snapEnabled, setSnapEnabled, selectedClipId, selectedTransitionId, hasAudio, hasVisual, addTrack, splitClipAtPlayhead, deleteClip, deleteTransition, duplicateClip, fitVisualsToVoiceover, handleZoomChange }: TimelineActionsToolbarProps) {
  return (
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="mr-1 flex items-center gap-2">
                <span className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Timeline
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="xs"
                        title="Create a new timeline track"
                      >
                        <Plus className="size-3 text-primary" />
                        <span className="hidden sm:inline">Add track</span>
                      </Button>
                    }
                  />
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-3xs text-muted-foreground uppercase font-semibold">
                          Add Track
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => addTrack("visual")}>
                          <Layers className="size-3.5 mr-2 text-primary" />
                          <span>Visual Track</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => addTrack("audio", "voiceover")}>
                          <Mic className="size-3.5 mr-2 text-primary" />
                          <span>Voiceover Track</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addTrack("audio", "music")}>
                          <Music className="size-3.5 mr-2 text-primary" />
                          <span>Music Track</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addTrack("audio", "sfx")}>
                          <Volume2 className="size-3.5 mr-2 text-primary" />
                          <span>SFX Track</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addTrack("audio", "ambient")}>
                          <Radio className="size-3.5 mr-2 text-primary" />
                          <span>Ambient Track</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => addTrack("audio", "general")}>
                          <Volume2 className="size-3.5 mr-2 text-primary" />
                          <span>Audio Track</span>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
    
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={!selectedClipId}
                        onClick={() => splitClipAtPlayhead()}
                        aria-label="Split clip at playhead (Ctrl+B)"
                      >
                        <Scissors className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <span>Split clip at playhead (Ctrl+B)</span>
                  </TooltipContent>
                </Tooltip>
    
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={!selectedClipId && !selectedTransitionId}
                        onClick={() => {
                          if (selectedClipId) deleteClip(selectedClipId);
                          else if (selectedTransitionId) deleteTransition(selectedTransitionId);
                        }}
                        aria-label="Delete selected clip or transition (Del / Backspace)"
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <span>Delete selected clip or transition (Del / Backspace)</span>
                  </TooltipContent>
                </Tooltip>
    
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={!selectedClipId}
                        onClick={() => selectedClipId && duplicateClip(selectedClipId)}
                        aria-label="Duplicate clip (Ctrl+D)"
                      >
                        <Copy className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <span>Duplicate selected clip (Ctrl+D)</span>
                  </TooltipContent>
                </Tooltip>
    
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={!hasAudio || !hasVisual}
                        onClick={() => fitVisualsToVoiceover()}
                        aria-label="Fit visual scenes to voiceover"
                      >
                        <Wand2 className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <span>Auto-fit visual scenes to voiceover duration</span>
                  </TooltipContent>
                </Tooltip>
    
                <div className="h-4 w-px bg-border mx-0.5 shrink-0" />
    
                {/* Playhead Time Display */}
                <div className="flex shrink-0 items-baseline gap-1 rounded-md bg-muted px-2 py-1 font-mono text-2xs font-semibold tabular-nums text-foreground">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                  {isHydrated ? playhead.toFixed(2) : "0.00"}s
                </div>
    
                {/* Magnetic Snapping Ghost Toggle with Tooltip */}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setSnapEnabled(!snapEnabled)}
                        aria-label="Toggle magnetic snapping"
                      >
                        <Magnet
                          className={`size-4 ${
                            snapEnabled
                              ? "text-primary bg-primary/10 rounded-md"
                              : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <span>{snapEnabled ? "Snapping ON (Hold Shift while dragging to disable)" : "Snapping OFF"}</span>
                  </TooltipContent>
                </Tooltip>
    
                {/* Expanded Zoom Controls (10% to 500%) with Ghost Styling */}
                <div className="flex items-center gap-1 p-0.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleZoomChange(zoom - 25)}
                          disabled={zoom <= MIN_TIMELINE_ZOOM}
                          aria-label="Zoom out timeline"
                        >
                          <ZoomOut className="size-4" />
                        </Button>
                      }
                    />
                    <TooltipContent>
                      <span>Zoom out timeline</span>
                    </TooltipContent>
                  </Tooltip>
    
                  <Slider
                    min={MIN_TIMELINE_ZOOM}
                    max={MAX_TIMELINE_ZOOM}
                    step={5}
                    value={zoom}
                    onValueChange={(val) => {
                      const num = Array.isArray(val) ? val[0] : val;
                      handleZoomChange(num);
                    }}
                    aria-label="Timeline zoom scale"
                    className="w-20"
                  />
    
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleZoomChange(zoom + 25)}
                          disabled={zoom >= MAX_TIMELINE_ZOOM}
                          aria-label="Zoom in timeline"
                        >
                          <ZoomIn className="size-4" />
                        </Button>
                      }
                    />
                    <TooltipContent>
                      <span>Zoom in timeline</span>
                    </TooltipContent>
                  </Tooltip>
    
                  <span className="font-mono text-2xs text-muted-foreground tabular-nums w-8 shrink-0">
                    {isHydrated ? zoom : 100}%
                  </span>
                </div>
              </div>
  );
}
