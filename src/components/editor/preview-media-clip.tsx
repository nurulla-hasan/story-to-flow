"use client";
import * as React from "react";
import type { TimelineClip } from "@/types/timeline";
import type { MediaAssetItem } from "@/lib/media-storage";
import { getClipMotionAtTime } from "@/lib/zoom-effect";
import { sanitizeClipTransform } from "@/lib/clip-transform";

interface PreviewMediaClipProps {
  clip: TimelineClip;
  asset: MediaAssetItem;
  playhead: number;
  isSelected: boolean;
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  onSelectClip: (clipId: string | null) => void;
  baseStyle?: React.CSSProperties;
}

export function PreviewMediaClip({ clip, asset, playhead, isSelected, videoRefs, onSelectClip, baseStyle }: PreviewMediaClipProps) {
  const transform = sanitizeClipTransform(clip.transform);
  const motion = getClipMotionAtTime(clip, playhead);
  const netX = (transform.x + motion.offsetX) * 100;
  const netY = (transform.y + motion.offsetY) * 100;
  const netScale = parseFloat((transform.scale * motion.scale).toFixed(4));
  const transformStr = `translate(${netX}%, ${netY}%) scale(${netScale}) rotate(${transform.rotation || 0}deg)`;
  const nodeStyle: React.CSSProperties = {
    ...baseStyle,
    transform: baseStyle?.transform ? `${baseStyle.transform} ${transformStr}` : transformStr,
    transformOrigin: "center center",
  };

  return (
    <div
      key={clip.id}
      onClick={(event) => {
        event.stopPropagation();
        onSelectClip(clip.id);
      }}
      style={nodeStyle}
      className={`absolute inset-0 w-full h-full overflow-hidden select-none cursor-pointer transition-shadow ${isSelected ? "ring-1 ring-primary/40" : ""}`}
    >
      {asset.category === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.url} alt={asset.name} className="w-full h-full object-cover rounded-xl pointer-events-none" />
      ) : asset.category === "video" ? (
        <video
          ref={(element) => {
            if (element) videoRefs.current.set(clip.id, element);
            else videoRefs.current.delete(clip.id);
          }}
          src={asset.url}
          playsInline
          className="w-full h-full object-cover rounded-xl pointer-events-none"
        />
      ) : null}
    </div>
  );
}
