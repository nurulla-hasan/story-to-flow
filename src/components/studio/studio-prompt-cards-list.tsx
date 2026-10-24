"use client";

import * as React from "react";
import { CleanPromptCard } from "./clean-prompt-card";
import type { StudioClip } from "./types";

interface StudioPromptCardsListProps {
  clips: StudioClip[];
  defaultClipDuration: number;
  aspectRatio: "9:16" | "16:9";
  openClipId: string | null;
  onToggleClip: (clipId: string) => void;
  onUpdateClip: (clipId: string, patch: Partial<StudioClip>) => void;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}

export function StudioPromptCardsList({
  clips,
  defaultClipDuration,
  aspectRatio,
  openClipId,
  onToggleClip,
  onUpdateClip,
  notify,
}: StudioPromptCardsListProps) {
  const timedClips = React.useMemo(() => {
    let accumulated = 0;
    const items: { clip: StudioClip; startTime: number; endTime: number }[] = [];
    for (const clip of clips) {
      const dur = clip.duration || defaultClipDuration || 3.0;
      const startTime = accumulated;
      const endTime = accumulated + dur;
      accumulated = endTime;
      items.push({ clip, startTime, endTime });
    }
    return items;
  }, [clips, defaultClipDuration]);

  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Individual Clip Prompt Cards
      </h3>
      {timedClips.map(({ clip, startTime, endTime }) => (
        <CleanPromptCard
          key={clip.id}
          clip={clip}
          totalClips={clips.length}
          open={openClipId === clip.id}
          onToggle={() => onToggleClip(clip.id)}
          aspectRatio={aspectRatio}
          startTime={startTime}
          endTime={endTime}
          onUpdateClip={(patch) => onUpdateClip(clip.id, patch)}
          notify={notify}
        />
      ))}
    </div>
  );
}
