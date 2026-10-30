"use client";

import { Copy, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TimelineClip } from "@/types/timeline";

interface ClipActionsSectionProps {
  selectedClip: TimelineClip;
  splitClipAtPlayhead: (clipId?: string) => void;
  duplicateClip: (clipId: string) => void;
  deleteClip: (clipId: string) => void;
}

/** Button surface for common selected-clip operations. */
export function ClipActionsSection({ selectedClip, splitClipAtPlayhead, duplicateClip, deleteClip }: ClipActionsSectionProps) {
  return (
    <>
      
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
    </>
  );
}
