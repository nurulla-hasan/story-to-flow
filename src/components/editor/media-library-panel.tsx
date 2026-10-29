"use client";

import * as React from "react";
import {
  FolderOpen,
  Upload,
  Film,
  Image as ImageIcon,
  Mic,
  Trash2,
  AlertCircle,
  Loader2,
  Plus,
  Search,
  X,
  Database,
} from "lucide-react";
import { useMediaLibrary } from "@/lib/use-media-library";
import { useTimeline } from "@/lib/timeline-context";
import { formatBytes, formatDuration } from "@/lib/media-helpers";
import type { MediaCategory } from "@/lib/media-storage";
import {
  EditorPanel,
  EditorPanelBody,
  EditorPanelHeader,
} from "@/components/editor/editor-panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type FilterTab = "all" | MediaCategory;
type SortMode = "recent" | "name" | "size";

const SORT_OPTIONS: ReadonlyArray<{ value: SortMode; label: string }> = [
  { value: "recent", label: "Recent" },
  { value: "name", label: "A–Z" },
  { value: "size", label: "Size" },
];

function ThumbImage({
  src,
  alt,
  kind,
}: {
  src: string;
  alt: string;
  kind: "image" | "video";
}) {
  const [isBroken, setIsBroken] = React.useState(false);

  if (isBroken) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
        {kind === "image" ? (
          <ImageIcon className="size-6 text-primary/70" />
        ) : (
          <Film className="size-6 text-primary/70" />
        )}
        <span className="font-mono text-3xs uppercase tracking-wide">
          {kind === "image" ? "Image" : "Video"}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setIsBroken(true)}
      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
    />
  );
}

const filterTabs: {
  id: FilterTab;
  label: string;
  icon: React.ReactNode | null;
}[] = [
  { id: "all", label: "All", icon: null },
  { id: "video", label: "Videos", icon: <Film className="size-3" /> },
  { id: "image", label: "Images", icon: <ImageIcon className="size-3" /> },
  { id: "audio", label: "Audio", icon: <Mic className="size-3" /> },
];

export function MediaLibraryPanel() {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("all");
  const [query, setQuery] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>("recent");
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    assets,
    isLoading,
    isImporting,
    error,
    counts,
    importFiles,
    removeAsset,
    clearError,
  } = useMediaLibrary();

  const { addAssetToTimeline, playhead } = useTimeline();

  const filteredAssets = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = assets.filter((asset) => {
      if (activeTab !== "all" && asset.category !== activeTab) return false;
      if (!needle) return true;
      return asset.name.toLowerCase().includes(needle);
    });

    // Copy before sorting: `assets` is provider state and must not be mutated.
    const sorted = [...matches];
    if (sortMode === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "size") {
      sorted.sort((a, b) => b.size - a.size);
    } else {
      sorted.sort((a, b) => b.importedAt - a.importedAt);
    }
    return sorted;
  }, [assets, activeTab, query, sortMode]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      importFiles(e.target.files);
      // Reset input value so re-selecting same file triggers change
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      importFiles(e.dataTransfer.files);
    }
  };

  return (
    <EditorPanel>
      {/* Hidden native file input for picker dialog */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Media file upload"
      />

      <EditorPanelHeader
        icon={<FolderOpen className="size-4" />}
        title="Media library"
        meta={
          query.trim()
            ? `${filteredAssets.length} of ${counts.all} ${counts.all === 1 ? "file" : "files"} match`
            : `${counts.all} ${counts.all === 1 ? "file" : "files"} · local storage`
        }
        actions={
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            title="Import media files (images, videos, audio)"
            aria-label="Import files"
          >
            {isImporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
          </Button>
        }
      />

      {/* Filter chips */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-2">
        {filterTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = counts[tab.id];

          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "ghost"}
              size="xs"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={isActive}
              title={tab.label}
              className="flex-1"
            >
              {tab.icon}
              <span className={tab.icon ? "hidden xl:inline" : ""}>{tab.label}</span>
              <span className="font-mono tabular-nums">{count}</span>
            </Button>
          );
        })}
      </div>

      {/* Search & sort */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search media…"
            aria-label="Search media library"
          />
          {query && (
            <InputGroupAddon align="inline-end">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setQuery("")}
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="size-3" />
              </Button>
            </InputGroupAddon>
          )}
        </InputGroup>
        <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
          <SelectTrigger className="shrink-0" aria-label="Sort media">
            <SelectValue>
              {SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "Recent"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <EditorPanelBody
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="justify-between gap-2 p-3"
      >
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
          {/* Error notification banner */}
          {error && (
            <div className="flex shrink-0 items-start justify-between gap-1.5 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-2xs text-destructive">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <p className="leading-tight">{error}</p>
              </div>
              <Button variant="ghost" size="icon-xs" onClick={clearError} aria-label="Dismiss error">
                <X className="size-3" />
              </Button>
            </div>
          )}

          {/* Importing progress indicator */}
          {isImporting && (
            <div className="flex shrink-0 animate-pulse items-center justify-center gap-2 rounded-lg bg-primary/10 p-2 text-2xs text-primary">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Importing into local storage…</span>
            </div>
          )}

          {/* Content body: Loading, Empty, or Asset Grid */}
          {isLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-2xs text-muted-foreground">
                Restoring saved media…
              </p>
            </div>
          ) : filteredAssets.length === 0 ? (
            query.trim() ? (
              /* Search returned nothing */
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-subtle/60 p-4 text-center">
                <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Search className="size-4" />
                </div>
                <p className="text-xs font-semibold text-foreground">No matches</p>
                <p className="max-w-44 text-2xs leading-relaxed text-muted-foreground">
                  Nothing named “{query.trim()}” in {activeTab === "all" ? "this library" : `${activeTab} files`}.
                </p>
                <Button variant="outline" size="sm" onClick={() => setQuery("")}>Clear search</Button>
              </div>
            ) : (
            /* Empty state dropzone */
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface-subtle/60 p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 ${
                isDragging ? "border-primary bg-primary/10" : ""
              }`}
            >
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Upload className="size-5" />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {activeTab === "all"
                    ? "No media yet"
                    : `No ${activeTab} files`}
                </p>
                <p className="mx-auto max-w-44 text-2xs leading-relaxed text-muted-foreground">
                  Drop files anywhere in this panel, or browse from your device.
                </p>
              </div>

              <span className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-3xs font-semibold text-foreground">
                <Upload className="size-3" />
                Browse files
              </span>
            </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/json", JSON.stringify(asset));
                    e.dataTransfer.setData("text/plain", asset.id);
                  }}
                  className="group relative flex cursor-grab flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:shadow-md active:cursor-grabbing"
                >
                  {/* Thumbnail / Visual Preview Box */}
                  <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-muted">
                    {asset.category === "image" ? (
                      <ThumbImage src={asset.url} alt={asset.name} kind="image" />
                    ) : asset.category === "video" ? (
                      asset.thumbnailUrl ? (
                        <ThumbImage src={asset.thumbnailUrl} alt={asset.name} kind="video" />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                          <Film className="size-6 text-primary" />
                          <span className="font-mono text-3xs uppercase">Video</span>
                        </div>
                      )
                    ) : (
                      <div className="flex w-full flex-col items-center justify-center gap-2 px-2 text-muted-foreground">
                        <Mic className="size-6 text-primary" />
                        <div className="flex h-4 w-full items-center gap-px opacity-40">
                          {Array.from({ length: 24 }).map((_, i) => (
                            <span
                              key={i}
                              className="w-full rounded-full bg-primary"
                              style={{ height: `${20 + ((i * 37) % 80)}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Soft scrim so overlays stay readable on bright media */}
                    <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-overlay/45 via-transparent to-overlay/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                    {/* Duration badge for audio/video */}
                    {asset.duration && asset.duration > 0 && (
                      <div className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md bg-overlay/80 px-1.5 py-0.5 font-mono text-3xs font-semibold text-editor-on-dark backdrop-blur-xs">
                        {formatDuration(asset.duration)}
                      </div>
                    )}

                    {/* Hover actions */}
                    <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <Button
                        variant="default"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          addAssetToTimeline(asset);
                        }}
                        title="Append to end of timeline"
                        aria-label={`Append ${asset.name} to timeline`}
                      >
                        <Plus className="size-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAsset(asset.id);
                        }}
                        title="Remove asset"
                        aria-label={`Remove ${asset.name}`}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Asset Metadata Footer */}
                  <div className="flex flex-col gap-0.5 p-2">
                    <p
                      className="truncate text-2xs font-medium text-foreground"
                      title={asset.name}
                    >
                      {asset.name}
                    </p>
                    <div className="flex items-center justify-between gap-1 font-mono text-3xs text-muted-foreground">
                      <span className="capitalize">{asset.category}</span>
                      <span className="tabular-nums">{formatBytes(asset.size)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Informational tip footer */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-subtle px-2 py-1.5 text-3xs leading-tight text-muted-foreground">
          <Database className="size-3 shrink-0 text-primary/70" />
          <p className="min-w-0 flex-1">
            Local IndexedDB · nothing leaves this browser
          </p>
        </div>
      </EditorPanelBody>
    </EditorPanel>
  );
}
