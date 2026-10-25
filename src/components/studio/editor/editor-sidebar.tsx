"use client";

import * as React from "react";
import Image from "next/image";
import {
  Captions,
  Film,
  Headphones,
  ImagePlus,
  Layers,
  Music,
  Palette,
  Plus,
  Sliders,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { cn } from "cn";
import type { StudioClip, StudioProject } from "../types";
import {
  formatSec,
  MOTION_PRESETS,
  type ClipTiming,
} from "./editor-shared";

export type EditorTool = "media" | "text" | "transitions" | "effects";
export type InspectorTab = "clip" | "audio" | "project";
export type MobileEditorTab = EditorTool | "clip" | "audio";

const TOOL_ITEMS: {
  id: EditorTool;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "media", label: "Media", Icon: Film },
  { id: "text", label: "Text", Icon: Captions },
  { id: "transitions", label: "Transitions", Icon: Zap },
  { id: "effects", label: "Effects", Icon: Palette },
];

const INSPECTOR_ITEMS: {
  id: InspectorTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "clip", label: "Basic", Icon: Layers },
  { id: "audio", label: "Audio", Icon: Music },
  { id: "project", label: "Project", Icon: Sliders },
];

const MOBILE_ITEMS: {
  id: MobileEditorTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "media", label: "Media", Icon: Film },
  { id: "audio", label: "Audio", Icon: Music },
  { id: "text", label: "Text", Icon: Captions },
  { id: "transitions", label: "Transitions", Icon: Zap },
  { id: "effects", label: "Effects", Icon: Palette },
  { id: "clip", label: "Clip", Icon: Layers },
];

export function EditorToolRail({
  activeTool,
  onSelectTool,
}: {
  activeTool: EditorTool | null;
  onSelectTool: (tool: EditorTool) => void;
}) {
  return (
    <nav
      aria-label="Editor tools"
      className="hidden w-18 shrink-0 flex-col items-center gap-1 border-r border-border bg-editor-chrome px-1 py-2 xl:flex"
    >
      {TOOL_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelectTool(id)}
          aria-pressed={activeTool === id}
          className={cn(
            "flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-3xs font-medium transition-colors",
            activeTool === id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          title={label}
        >
          <Icon className="size-4" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function InspectorRail({
  activeTab,
  onSelectTab,
}: {
  activeTab: InspectorTab;
  onSelectTab: (tab: InspectorTab) => void;
}) {
  return (
    <nav
      aria-label="Properties"
      className="hidden w-18 shrink-0 flex-col items-center gap-1 border-l border-border bg-editor-chrome px-1 py-2 xl:flex"
    >
      {INSPECTOR_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelectTab(id)}
          aria-pressed={activeTab === id}
          className={cn(
            "flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-3xs font-medium transition-colors",
            activeTab === id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          title={label}
        >
          <Icon className="size-4" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </nav>
  );
}

interface EditorToolPanelProps {
  activeTool: EditorTool;
  project: StudioProject;
  selectedClip: StudioClip | null;
  selectedTiming: ClipTiming | null;
  showSubtitles: boolean;
  saturation: number;
  onClose: () => void;
  onToggleSubtitles: () => void;
  onImportImages: () => void;
  onAddClip: () => void;
  onSelectClip: (clip: StudioClip) => void;
  onUpdateProject: (patch: Partial<StudioProject>) => void;
  onUpdateClip: (clipId: string, patch: Partial<StudioClip>) => void;
  onOpenTransitionAll: () => void;
  onOpenTransitionAtPlayhead: () => void;
  onOpenSfx: (clip: StudioClip) => void;
}

export function EditorToolPanel({
  activeTool,
  onClose,
  ...contentProps
}: EditorToolPanelProps) {
  const tool = TOOL_ITEMS.find((item) => item.id === activeTool) ?? TOOL_ITEMS[0];
  const Icon = tool.Icon;

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-surface-subtle xl:flex">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-3.5" />
          </span>
          <span className="truncate text-xs font-bold text-foreground">{tool.label}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Close ${tool.label} panel`}
          title={`Close ${tool.label} panel`}
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <EditorToolPanelContent activeTool={activeTool} {...contentProps} />
      </div>
    </aside>
  );
}

export function EditorToolPanelContent({
  activeTool,
  project,
  selectedClip,
  selectedTiming,
  showSubtitles,
  saturation,
  onToggleSubtitles,
  onImportImages,
  onAddClip,
  onSelectClip,
  onUpdateProject,
  onUpdateClip,
  onOpenTransitionAll,
  onOpenTransitionAtPlayhead,
  onOpenSfx,
}: Omit<EditorToolPanelProps, "onClose">) {
  if (activeTool === "media") {
    return (
      <MediaPanel
        project={project}
        selectedClip={selectedClip}
        onImportImages={onImportImages}
        onAddClip={onAddClip}
        onSelectClip={onSelectClip}
      />
    );
  }

  if (activeTool === "text") {
    return (
      <TextPanel
        selectedClip={selectedClip}
        selectedTiming={selectedTiming}
        showSubtitles={showSubtitles}
        onToggleSubtitles={onToggleSubtitles}
      />
    );
  }

  if (activeTool === "transitions") {
    return (
      <TransitionsPanel
        project={project}
        selectedClip={selectedClip}
        onOpenTransitionAll={onOpenTransitionAll}
        onOpenTransitionAtPlayhead={onOpenTransitionAtPlayhead}
        onOpenSfx={onOpenSfx}
      />
    );
  }

  return (
    <EffectsPanel
      project={project}
      selectedClip={selectedClip}
      saturation={saturation}
      onUpdateProject={onUpdateProject}
      onUpdateClip={onUpdateClip}
      onOpenSfx={onOpenSfx}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function MediaPanel({
  project,
  selectedClip,
  onImportImages,
  onAddClip,
  onSelectClip,
}: {
  project: StudioProject;
  selectedClip: StudioClip | null;
  onImportImages: () => void;
  onAddClip: () => void;
  onSelectClip: (clip: StudioClip) => void;
}) {
  const runtime = project.clips.reduce((total, clip) => total + (clip.duration || 3), 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </span>
        <p className="mt-2 text-xs font-bold text-foreground">Build your story</p>
        <p className="mt-0.5 text-3xs leading-4 text-muted-foreground">
          Import generated frames or add a new shot to the timeline.
        </p>
        <button
          type="button"
          onClick={onImportImages}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-2 text-2xs font-bold text-primary-foreground shadow-xs transition-opacity hover:opacity-90"
        >
          <ImagePlus className="size-3.5" />
          Import images
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-lg border border-border bg-card px-1.5 py-2 text-center">
          <p className="font-mono text-xs font-bold text-foreground">{project.clips.length}</p>
          <p className="text-3xs text-muted-foreground">Clips</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-1.5 py-2 text-center">
          <p className="font-mono text-xs font-bold text-foreground">{formatSec(runtime)}</p>
          <p className="text-3xs text-muted-foreground">Runtime</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-1.5 py-2 text-center">
          <p className="font-mono text-xs font-bold text-foreground">
            {project.audioUrl ? formatSec(project.audioDuration) : "—"}
          </p>
          <p className="text-3xs text-muted-foreground">Voice</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Timeline media</SectionLabel>
        <span className="font-mono text-3xs text-muted-foreground">
          {project.clips.length}
        </span>
      </div>

      {project.clips.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {project.clips.map((clip) => {
            const active = clip.id === selectedClip?.id;
            return (
              <button
                key={clip.id}
                type="button"
                onClick={() => onSelectClip(clip)}
                className={cn(
                  "group relative aspect-video overflow-hidden rounded-lg border bg-editor-screen text-left transition-colors",
                  active
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50",
                )}
                title={`Clip #${clip.index} · ${(clip.duration || 3).toFixed(1)}s`}
              >
                {clip.imageUrl ? (
                  <Image
                    src={clip.imageUrl}
                    alt={`Clip ${clip.index}`}
                    fill
                    unoptimized
                    sizes="132px"
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                    <ImagePlus className="size-3.5" />
                    <span className="text-3xs">No image</span>
                  </span>
                )}
                <span className="absolute top-1 left-1 rounded bg-editor-screen/80 px-1 py-0.5 font-mono text-3xs font-bold text-primary-foreground backdrop-blur-sm">
                  #{String(clip.index).padStart(2, "0")}
                </span>
                <span className="absolute right-1 bottom-1 rounded bg-editor-screen/80 px-1 py-0.5 font-mono text-3xs text-primary-foreground backdrop-blur-sm">
                  {(clip.duration || 3).toFixed(1)}s
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card px-3 py-6 text-center">
          <Film className="mx-auto size-5 text-muted-foreground/60" />
          <p className="mt-2 text-2xs font-semibold text-foreground">No clips yet</p>
          <p className="mt-0.5 text-3xs text-muted-foreground">
            Import images or add a blank shot.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onAddClip}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-card px-2 py-2 text-2xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        <Plus className="size-3.5" />
        Add blank clip
      </button>
    </div>
  );
}

function TextPanel({
  selectedClip,
  selectedTiming,
  showSubtitles,
  onToggleSubtitles,
}: {
  selectedClip: StudioClip | null;
  selectedTiming: ClipTiming | null;
  showSubtitles: boolean;
  onToggleSubtitles: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Captions className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">Captions</p>
              <p className="text-3xs text-muted-foreground">Burn-in subtitles</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleSubtitles}
            aria-pressed={showSubtitles}
            className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              showSubtitles ? "bg-primary" : "bg-muted",
            )}
            title={showSubtitles ? "Hide captions" : "Show captions"}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-card shadow-sm transition-transform",
                showSubtitles ? "left-4.5" : "left-0.5",
              )}
            />
          </button>
        </div>
        <p className="mt-2 text-3xs leading-4 text-muted-foreground">
          Each shot uses its narration as a timed caption and burns it into the exported video.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Selected caption</SectionLabel>
        <span className="font-mono text-3xs text-muted-foreground">
          {selectedTiming
            ? `${formatSec(selectedTiming.start)}–${formatSec(selectedTiming.end)}`
            : "—"}
        </span>
      </div>

      {selectedClip ? (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="font-bangla text-xs leading-5 text-foreground">
            {selectedClip.narration || "No narration for this clip yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card px-3 py-5 text-center">
          <Captions className="mx-auto size-5 text-muted-foreground/60" />
          <p className="mt-2 text-2xs font-semibold text-foreground">No clip at the playhead</p>
          <p className="mt-0.5 text-3xs text-muted-foreground">
            Select a clip to inspect its caption.
          </p>
        </div>
      )}
    </div>
  );
}

function TransitionsPanel({
  project,
  selectedClip,
  onOpenTransitionAll,
  onOpenTransitionAtPlayhead,
  onOpenSfx,
}: {
  project: StudioProject;
  selectedClip: StudioClip | null;
  onOpenTransitionAll: () => void;
  onOpenTransitionAtPlayhead: () => void;
  onOpenSfx: (clip: StudioClip) => void;
}) {
  const hasSplit = project.clips.length > 1;
  const transitionCount = project.clips.filter(
    (clip) => clip.transition && clip.transition.type !== "none",
  ).length;
  const sfxCount = project.clips.filter((clip) => clip.sfx && clip.sfx !== "none").length;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Zap className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">Transitions</p>
            <p className="text-3xs text-muted-foreground">
              {transitionCount} of {Math.max(0, project.clips.length - 1)} splits styled
            </p>
          </div>
        </div>
        <div className="mt-2.5 grid gap-1.5">
          <button
            type="button"
            disabled={!hasSplit}
            onClick={onOpenTransitionAtPlayhead}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 py-2 text-2xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Zap className="size-3.5" />
            Transition at playhead
          </button>
          <button
            type="button"
            disabled={!hasSplit}
            onClick={onOpenTransitionAll}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 text-2xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Apply to all splits
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-track-sfx/30 bg-track-sfx-soft p-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card/70 text-track-sfx">
            <Music className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">Sound effects</p>
            <p className="text-3xs text-muted-foreground">{sfxCount} clips with SFX</p>
          </div>
        </div>
        <button
          type="button"
          disabled={!selectedClip}
          onClick={() => selectedClip && onOpenSfx(selectedClip)}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-track-sfx/30 bg-card px-2.5 py-2 text-2xs font-semibold text-track-sfx transition-colors hover:bg-card/80 disabled:opacity-50"
        >
          <Sparkles className="size-3.5" />
          {selectedClip?.sfx && selectedClip.sfx !== "none"
            ? "Edit selected SFX"
            : "Add SFX to selected clip"}
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card px-3 py-4">
        <p className="text-2xs font-semibold text-foreground">Tips</p>
        <p className="mt-1 text-3xs leading-4 text-muted-foreground">
          Move the playhead inside a clip to target that split. Transitions are blended live and
          in the final export.
        </p>
      </div>
    </div>
  );
}

function EffectsPanel({
  project,
  selectedClip,
  saturation,
  onUpdateProject,
  onUpdateClip,
  onOpenSfx,
}: {
  project: StudioProject;
  selectedClip: StudioClip | null;
  saturation: number;
  onUpdateProject: (patch: Partial<StudioProject>) => void;
  onUpdateClip: (clipId: string, patch: Partial<StudioClip>) => void;
  onOpenSfx: (clip: StudioClip) => void;
}) {
  const presets = [
    { label: "B&W", value: 0 },
    { label: "Neutral", value: 100 },
    { label: "Warm", value: 115 },
    { label: "Vibrant", value: 135 },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Color grade</SectionLabel>
          <span className="font-mono text-3xs font-bold text-foreground">{saturation}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={200}
          step={5}
          value={saturation}
          onChange={(event) => onUpdateProject({ saturation: Number(event.target.value) })}
          className="mt-2 h-1.5 w-full cursor-pointer accent-primary"
          aria-label="Saturation"
        />
        <div className="mt-2 grid grid-cols-4 gap-1">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onUpdateProject({ saturation: preset.value })}
              className={cn(
                "rounded-md px-1 py-1 font-mono text-3xs transition-colors",
                saturation === preset.value
                  ? "bg-primary font-bold text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <SectionLabel>Camera motion</SectionLabel>
        {selectedClip ? (
          <>
            <p className="mt-1 text-3xs text-muted-foreground">
              Clip #{selectedClip.index} · {project.aspectRatio}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {MOTION_PRESETS.map(({ value, label, short, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onUpdateClip(selectedClip.id, { motion: value })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-3xs font-medium transition-colors",
                    (selectedClip.motion || "zoom-in") === value
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  title={label}
                >
                  <Icon className="size-3.5" />
                  <span className="truncate">{short}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-1 text-3xs text-muted-foreground">
            Select a clip to change its camera move.
          </p>
        )}
      </div>

      {selectedClip ? (
        <button
          type="button"
          onClick={() => onOpenSfx(selectedClip)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2 text-2xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Headphones className="size-3.5 text-track-sfx" />
          Sound effect for this clip
        </button>
      ) : null}
    </div>
  );
}

export function MobileEditorToolbar({
  activeTab,
  onSelectTab,
}: {
  activeTab: MobileEditorTab | null;
  onSelectTab: (tab: MobileEditorTab) => void;
}) {
  return (
    <nav
      aria-label="Mobile editor tools"
      className="grid shrink-0 grid-cols-6 border-t border-border bg-editor-chrome px-1 py-1 xl:hidden"
    >
      {MOBILE_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelectTab(id)}
          aria-pressed={activeTab === id}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-md px-0.5 py-1 text-3xs font-medium transition-colors",
            activeTab === id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function MobileToolSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-overlay xl:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-modal w-full overflow-y-auto rounded-t-2xl border-t border-border bg-surface-subtle shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface-subtle px-3 py-2">
          <p className="text-xs font-bold text-foreground">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close tool panel"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

export function ProjectInspectorPanel({
  project,
  onUpdateProject,
}: {
  project: StudioProject;
  onUpdateProject: (patch: Partial<StudioProject>) => void;
}) {
  const durations = [2.5, 3, 4, 5];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Sliders className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">Project settings</p>
            <p className="truncate text-3xs text-muted-foreground">
              {project.stylePreset}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <SectionLabel>Aspect ratio</SectionLabel>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {(["9:16", "16:9"] as const).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => onUpdateProject({ aspectRatio: ratio })}
                className={cn(
                  "rounded-lg border px-2 py-2 font-mono text-2xs font-semibold transition-colors",
                  project.aspectRatio === ratio
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <SectionLabel>New clip duration</SectionLabel>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {durations.map((duration) => (
              <button
                key={duration}
                type="button"
                onClick={() => onUpdateProject({ defaultClipDuration: duration })}
                className={cn(
                  "rounded-md px-1 py-1 font-mono text-3xs transition-colors",
                  Math.abs(project.defaultClipDuration - duration) < 0.05
                    ? "bg-primary font-bold text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {duration.toFixed(1)}s
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Saturation</SectionLabel>
          <span className="font-mono text-3xs font-bold text-foreground">
            {project.saturation ?? 100}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={200}
          step={5}
          value={project.saturation ?? 100}
          onChange={(event) =>
            onUpdateProject({ saturation: Number(event.target.value) })
          }
          className="mt-2 h-1.5 w-full cursor-pointer accent-primary"
          aria-label="Project saturation"
        />
      </div>
    </div>
  );
}

