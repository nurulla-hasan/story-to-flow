"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CopyCheck,
  Move,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TimelineClip } from "@/types/timeline";
import { DEFAULT_ZOOM_EFFECT_AMOUNT, sanitizeZoomEffect, type ClipZoomEffect, type ZoomEffectType } from "@/lib/zoom-effect";

type MotionOption = {
  type: "off" | ZoomEffectType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MOTION_OPTIONS: MotionOption[] = [
  { type: "off", label: "Off", icon: Sparkles },
  { type: "zoom-in", label: "Zoom In", icon: ZoomIn },
  { type: "zoom-out", label: "Zoom Out", icon: ZoomOut },
  { type: "pan-left", label: "Pan Left", icon: ArrowLeft },
  { type: "pan-right", label: "Pan Right", icon: ArrowRight },
  { type: "pan-up", label: "Pan Up", icon: ArrowUp },
  { type: "pan-down", label: "Pan Down", icon: ArrowDown },
];

interface TimelineMotionToolbarProps {
  clip: TimelineClip;
  imageClipsCount: number;
  isLocked: boolean;
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  applyMotionToAllClips: (effect?: Partial<ClipZoomEffect> | null) => {
    success: boolean;
    message: string;
    count: number;
  };
}

/** Owns motion preset selection and the apply-to-all-scenes action. */
export function TimelineMotionToolbar({
  clip,
  imageClipsCount,
  isLocked,
  updateClip,
  applyMotionToAllClips,
}: TimelineMotionToolbarProps) {
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const activeEffect = sanitizeZoomEffect(clip.zoomEffect);
  const motionLabel =
    MOTION_OPTIONS.find((option) => option.type === (clip.zoomEffect?.type ?? "off"))?.label ?? "Off";

  React.useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleSetMotion = (type: "off" | ZoomEffectType) => {
    if (isLocked) return;
    if (type === "off") {
      updateClip(clip.id, { zoomEffect: undefined });
      return;
    }

    const effect: ClipZoomEffect = {
      type,
      amount: activeEffect?.amount ?? DEFAULT_ZOOM_EFFECT_AMOUNT,
    };
    updateClip(clip.id, { zoomEffect: effect });
  };

  const handleApplyMotionToAll = () => {
    if (isLocked) return;
    const effect = sanitizeZoomEffect(clip.zoomEffect);
    if (!effect) return;
    setFeedback(applyMotionToAllClips(effect).message);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant={clip.zoomEffect ? "outline" : "ghost"}
              size="sm"
              disabled={isLocked}
              title="Scene motion"
            >
              <Move className="size-3.5 text-primary" />
              <span>{motionLabel}</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Scene motion</DropdownMenuLabel>
            {MOTION_OPTIONS.map((option) => {
              const isCurrent = (clip.zoomEffect?.type ?? "off") === option.type;
              const Icon = option.icon;
              return (
                <DropdownMenuItem
                  key={option.type}
                  disabled={isCurrent || isLocked}
                  onClick={() => handleSetMotion(option.type)}
                >
                  <Check className={`size-3.5 ${isCurrent ? "text-primary" : "opacity-0"}`} />
                  <Icon className="size-3.5 text-muted-foreground" />
                  <span>{option.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={imageClipsCount <= 1 || !clip.zoomEffect || isLocked}
            onClick={handleApplyMotionToAll}
          >
            <CopyCheck className="size-3.5" />
            <span>
              {clip.zoomEffect
                ? `Apply to all ${imageClipsCount} scenes`
                : "Apply motion to all scenes"}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {feedback && (
        <span className="animate-in fade-in shrink-0 font-mono text-2xs font-semibold text-primary">
          {feedback}
        </span>
      )}
    </>
  );
}
