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
  Check,
  ArrowUp,
  Search,
  X,
  ArrowDown,
} from "lucide-react";
import { useMediaLibrary } from "@/lib/use-media-library";
import { useTimelineState } from "@/lib/timeline-context";
import { formatBytes, formatDuration } from "@/lib/media-helpers";
import type { MediaCategory, MediaAssetItem } from "@/lib/media-storage";
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
import { Checkbox } from "@/components/ui/checkbox";

type FilterTab = "all" | MediaCategory;
type SortMode = "date" | "name" | "size";
type SortDirection = "asc" | "desc";

const SORT_OPTIONS: ReadonlyArray<{ value: SortMode; label: string }> = [
  { value: "date", label: "Date" },
  { value: "name", label: "Name" },
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

interface MediaAssetCardProps {
  asset: MediaAssetItem;
  isSelected: boolean;
  onToggleSelect: (assetId: string, checked: boolean) => void;
  onAddToTimeline: (asset: MediaAssetItem) => void;
  onRemove: (assetId: string) => void;
}

const MediaAssetCard = React.memo(function MediaAssetCard({
  asset,
  isSelected,
  onToggleSelect,
  onAddToTimeline,
  onRemove,
}: MediaAssetCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/json", JSON.stringify(asset));
        e.dataTransfer.setData("text/plain", asset.id);
      }}
      className="group relative flex cursor-grab flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:shadow-md active:cursor-grabbing"
    >
      {/* Thumbnail / Visual Preview Box */}
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-muted">
        <div
          className="absolute left-1.5 top-1.5 z-10"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onDragStart={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onToggleSelect(asset.id, Boolean(checked))}
            aria-label={`Select ${asset.name}`}
            title={isSelected ? "Deselect media" : "Select media"}
          />
        </div>
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
              onAddToTimeline(asset);
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
              onRemove(asset.id);
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
        <p className="truncate text-2xs font-medium text-foreground" title={asset.name}>
          {asset.name}
        </p>
        <div className="flex items-center justify-between gap-1 font-mono text-3xs text-muted-foreground">
          <span className="capitalize">{asset.category}</span>
          <span className="tabular-nums">{formatBytes(asset.size)}</span>
        </div>
      </div>
    </div>
  );
});

export function MediaLibraryPanel() {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("all");
  const [query, setQuery] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>("date");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [isDragging, setIsDragging] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<Set<string>>(() => new Set());
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

  const { addAssetsToTimeline } = useTimelineState();

  const filteredAssets = React.useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matches = assets.filter((asset) => {
      if (activeTab !== "all" && asset.category !== activeTab) return false;
      if (needle && !asset.name.toLowerCase().includes(needle)) return false;
      return true;
    });

    // Numeric-aware comparison keeps numbered filenames in natural order:
    // scene 1, scene 2, scene 10 instead of scene 1, scene 10, scene 2.
    const direction = sortDirection === "asc" ? 1 : -1;
    const sorted = [...matches];
    if (sortMode === "name") {
      sorted.sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (byName !== 0) return byName * direction;
        return (a.importedAt - b.importedAt) * direction;
      });
    } else if (sortMode === "size") {
      sorted.sort((a, b) => {
        const bySize = a.size - b.size;
        if (bySize !== 0) return bySize * direction;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) * direction;
      });
    } else {
      sorted.sort((a, b) => {
        const byDate = a.importedAt - b.importedAt;
        if (byDate !== 0) return byDate * direction;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) * direction;
      });
    }
    return sorted;
  }, [assets, activeTab, query, sortMode, sortDirection]);

  const selectedAssets = React.useMemo(() => {
    // Collect all selected assets
    const selected = assets.filter((asset) => selectedAssetIds.has(asset.id));
    // Sort selected assets in the EXACT order the user is seeing them in filteredAssets
    const orderMap = new Map(filteredAssets.map((asset, index) => [asset.id, index]));
    return selected.sort((a, b) => {
      const indexA = orderMap.has(a.id) ? orderMap.get(a.id)! : Infinity;
      const indexB = orderMap.has(b.id) ? orderMap.get(b.id)! : Infinity;
      return indexA - indexB;
    });
  }, [assets, filteredAssets, selectedAssetIds]);
  const allVisibleSelected =
    filteredAssets.length > 0 &&
    filteredAssets.every((asset) => selectedAssetIds.has(asset.id));

  const toggleVisibleSelection = () => {
    setSelectedAssetIds((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected) {
        filteredAssets.forEach((asset) => next.delete(asset.id));
      } else {
        filteredAssets.forEach((asset) => next.add(asset.id));
      }
      return next;
    });
  };

  const toggleAssetSelection = React.useCallback((assetId: string, checked: boolean) => {
    setSelectedAssetIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(assetId);
      else next.delete(assetId);
      return next;
    });
  }, []);

  const handleAddToTimeline = React.useCallback((asset: MediaAssetItem) => {
    const result = addAssetsToTimeline([asset]);
    if (result.addedCount === 0) {
      setActionMessage("Nothing was added. Unlock a destination timeline track and try again.");
    } else if (result.skippedCount > 0) {
      setActionMessage(
        `Added ${result.addedCount} media item(s); skipped ${result.skippedCount} because their destination track is locked.`
      );
    } else {
      setActionMessage(
        `Added ${result.addedCount} media item(s) to the timeline and filled the next matching Story Plan slot when available.`
      );
    }
  }, [addAssetsToTimeline]);

  const handleRemoveAsset = React.useCallback((assetId: string) => {
    removeAsset(assetId);
  }, [removeAsset]);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollRange, setScrollRange] = React.useState({ scrollTop: 0, clientHeight: 500 });

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const top = target.scrollTop;
    const height = target.clientHeight || 500;
    setScrollRange((prev) => {
      if (Math.abs(prev.scrollTop - top) < 20 && prev.clientHeight === height) return prev;
      return { scrollTop: top, clientHeight: height };
    });
  }, []);

  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setScrollRange({ scrollTop: el.scrollTop, clientHeight: el.clientHeight || 500 });
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScrollRange((prev) => ({ ...prev, clientHeight: entry.contentRect.height || 500 }));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ROW_HEIGHT = 124;
  const OVERSCAN_ROWS = 3;
  const isVirtual = filteredAssets.length > 24;
  const totalRows = Math.ceil(filteredAssets.length / 2);
  const startRow = isVirtual ? Math.max(0, Math.floor(scrollRange.scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS) : 0;
  const endRow = isVirtual ? Math.min(totalRows, Math.ceil((scrollRange.scrollTop + scrollRange.clientHeight) / ROW_HEIGHT) + OVERSCAN_ROWS) : totalRows;
  const visibleAssets = isVirtual ? filteredAssets.slice(startRow * 2, endRow * 2) : filteredAssets;
  const offsetY = startRow * ROW_HEIGHT;
  const totalHeight = totalRows * ROW_HEIGHT;

  const handleAddSelectedToTimeline = () => {
    if (selectedAssets.length === 0) return;
    const result = addAssetsToTimeline(selectedAssets);
    if (result.addedCount === 0) {
      setActionMessage("Nothing was added. Unlock a destination timeline track and try again.");
    } else if (result.skippedCount > 0) {
      setActionMessage(
        `Added ${result.addedCount} media item(s); skipped ${result.skippedCount} because their destination track is locked.`
      );
    } else {
      setActionMessage(`Added ${result.addedCount} media item(s) to the timeline.`);
    }
    setSelectedAssetIds(new Set());
  };

  const handleClearUnusedMedia = async () => {
    if (isClearing || isImporting || assets.length === 0) return;
    setIsClearing(true);
    setActionMessage(null);
    const assetsToClear = [...assets];

    try {
      const results = await Promise.all(
        assetsToClear.map((asset) => removeAsset(asset.id))
      );
      const removedIds = new Set(
        assetsToClear
          .filter((_, index) => results[index]?.removed)
          .map((asset) => asset.id)
      );
      const removedCount = removedIds.size;
      const retainedCount = assetsToClear.length - removedCount;

      setSelectedAssetIds((previous) =>
        new Set([...previous].filter((id) => !removedIds.has(id)))
      );

      if (retainedCount === 0) {
        setActionMessage(`Cleared all ${removedCount} media item(s).`);
      } else if (removedCount > 0) {
        setActionMessage(
          `Cleared ${removedCount}; kept ${retainedCount} item(s) still used by timeline clips or not removable.`
        );
      } else {
        setActionMessage(
          "No media was cleared because the current timeline still uses these assets."
        );
      }
    } catch {
      setActionMessage("Could not clear the media library. Please try again.");
    } finally {
      setIsClearing(false);
    }
  };

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
          query.trim() || activeTab !== "all"
            ? `${filteredAssets.length} of ${counts.all} ${counts.all === 1 ? "file" : "files"} shown`
            : `${counts.all} ${counts.all === 1 ? "file" : "files"} · local storage`
        }
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClearUnusedMedia}
              disabled={assets.length === 0 || isLoading || isImporting || isClearing}
              title="Clear unused media; files used on the timeline are kept"
              aria-label="Clear unused media"
            >
              {isClearing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting || isClearing}
              title="Import media files (images, videos, audio)"
              aria-label="Import files"
            >
              {isImporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
            </Button>
          </div>
        }
      />

      {/* Controls toolbar */}
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-border p-3">
        {/* Category filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {filterTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = counts[tab.id];

            return (
              <Button
                key={tab.id}
                variant={isActive ? "default" : "secondary"}
                size="xs"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={isActive}
                title={tab.label}
                className="shrink-0"
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span className="font-mono tabular-nums opacity-70">{count}</span>
              </Button>
            );
          })}
        </div>

        {/* Row 2: Search Input */}
        <InputGroup className="w-full">
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

        {/* Row 3: Sort & Selection Actions */}
        <div className="flex items-center justify-between gap-2">
          {/* Sort controls */}
          <div className="flex items-center gap-1">
            <Select
              value={sortMode}
              onValueChange={(value) => {
                const nextMode = value as SortMode;
                setSortMode(nextMode);
                if (nextMode === "name") {
                  setSortDirection("asc");
                } else {
                  setSortDirection("desc");
                }
              }}
            >
              <SelectTrigger size="sm" className="shrink-0" aria-label="Sort media">
                <SelectValue>
                  {SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "Date added"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => setSortDirection((order) => (order === "asc" ? "desc" : "asc"))}
              title={
                sortDirection === "asc"
                  ? "Ascending (click for descending)"
                  : "Descending (click for ascending)"
              }
              aria-label={
                sortDirection === "asc"
                  ? "Ascending order, click for descending"
                  : "Descending order, click for ascending"
              }
            >
              {sortDirection === "asc" ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )}
            </Button>
          </div>

          {/* Selection quick actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={toggleVisibleSelection}
              disabled={isLoading || filteredAssets.length === 0}
              title={allVisibleSelected ? "Deselect visible media" : `Select visible (${filteredAssets.length})`}
              aria-label={allVisibleSelected ? "Deselect visible media" : `Select visible (${filteredAssets.length})`}
            >
              <Check className="size-3" />
            </Button>
            <Button
              variant="default"
              size="icon-xs"
              onClick={handleAddSelectedToTimeline}
              disabled={selectedAssets.length === 0 || isLoading}
              title={`Append ${selectedAssets.length} selected media to timeline`}
              aria-label={`Append ${selectedAssets.length} selected media to timeline`}
            >
              <Plus className="size-3" />
            </Button>
            {selectedAssets.length > 0 && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setSelectedAssetIds(new Set())}
                title="Clear media selection"
                aria-label="Clear media selection"
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <EditorPanelBody
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="justify-between gap-2 p-3"
      >
        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
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

          {actionMessage && (
            <div
              role="status"
              className="flex shrink-0 items-start justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-2xs text-foreground"
            >
              <p className="leading-tight">{actionMessage}</p>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setActionMessage(null)}
                aria-label="Dismiss media action message"
              >
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
          ) : isVirtual ? (
            <div style={{ height: `${totalHeight}px`, position: "relative" }} className="w-full">
              <div
                style={{ transform: `translateY(${offsetY}px)` }}
                className="grid grid-cols-2 gap-2"
              >
                {visibleAssets.map((asset) => (
                  <MediaAssetCard
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedAssetIds.has(asset.id)}
                    onToggleSelect={toggleAssetSelection}
                    onAddToTimeline={handleAddToTimeline}
                    onRemove={handleRemoveAsset}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredAssets.map((asset) => (
                <MediaAssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAssetIds.has(asset.id)}
                  onToggleSelect={toggleAssetSelection}
                  onAddToTimeline={handleAddToTimeline}
                  onRemove={handleRemoveAsset}
                />
              ))}
            </div>
          )}
        </div>
      </EditorPanelBody>
    </EditorPanel>
  );
}
