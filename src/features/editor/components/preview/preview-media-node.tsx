"use client";

import * as React from "react";
import type { MediaAssetItem } from "@/lib/media-storage";
import type { TimelineClip } from "@/types/timeline";
import { sanitizeClipTransform } from "@/lib/clip-transform";
import { getClipMotionAtTime } from "@/lib/zoom-effect";

interface PreviewMediaNodeProps {
  clip: TimelineClip;
  asset?: MediaAssetItem;
  baseStyle?: React.CSSProperties;
  playhead: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onVideoElementChange: (clipId: string, element: HTMLVideoElement | null) => void;
}

/** Renders one source media element with its evaluated clip transform and motion at the current playhead. */
export function PreviewMediaNode({
  clip, asset, baseStyle, playhead, selectedClipId, onSelectClip, onVideoElementChange,
}: PreviewMediaNodeProps) {
  if (!asset) return null;
  const transform = sanitizeClipTransform(clip.transform);
  const isSelected = clip.id === selectedClipId;
  const motion = getClipMotionAtTime(clip, playhead);
  const netX = (transform.x + motion.offsetX) * 100;
  const netY = (transform.y + motion.offsetY) * 100;
  const netScale = parseFloat((transform.scale * motion.scale).toFixed(4));
  const transformString = `translate(${netX}%, ${netY}%) scale(${netScale}) rotate(${transform.rotation || 0}deg)`;
  const nodeStyle: React.CSSProperties = {
    ...baseStyle,
    transform: baseStyle?.transform ? `${baseStyle.transform} ${transformString}` : transformString,
    transformOrigin: "center center",
  };

  return (
    <div onClick={(event) => { event.stopPropagation(); onSelectClip(clip.id); }} style={nodeStyle} className={`absolute inset-0 w-full h-full overflow-hidden select-none cursor-pointer transition-shadow ${isSelected ? "ring-1 ring-primary/40" : ""}`}>
      {asset.category === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.url} alt={asset.name} className="w-full h-full object-cover rounded-xl pointer-events-none" />
      ) : asset.category === "video" ? (
        <video
          ref={(element) => onVideoElementChange(clip.id, element)}
          src={asset.url}
          playsInline
          className="w-full h-full object-cover rounded-xl pointer-events-none"
        />
      ) : null}
    </div>
  );
}
