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
  X,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMediaLibrary } from "@/lib/use-media-library";
import { useTimeline } from "@/lib/timeline-context";
import { formatBytes, formatDuration } from "@/lib/media-helpers";
import type { MediaCategory } from "@/lib/media-storage";

type FilterTab = "all" | MediaCategory;

export function MediaLibraryPanel() {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("all");
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
    if (activeTab === "all") return assets;
    return assets.filter((a) => a.category === activeTab);
  }, [assets, activeTab]);

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
    <Card size="sm" className="flex flex-col h-full overflow-hidden">
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

      <CardHeader className="flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-4 text-primary" />
            <CardTitle>Media Library</CardTitle>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant="secondary">{counts.all} items</Badge>
            <Button
              size="icon"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              title="Import media files (Images, Videos, Audio)"
              aria-label="Import files"
            >
              {isImporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
            </Button>
          </div>
        </div>

        <CardDescription>
          Local browser storage (IndexedDB)
        </CardDescription>

        {/* Media filter tabs with item counts */}
        <div className="flex items-center gap-1 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-2 py-0.5 text-2xs rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("video")}
            className={`flex items-center gap-1 px-2 py-0.5 text-2xs rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === "video"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Film className="size-3" />
            <span>Videos ({counts.video})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("image")}
            className={`flex items-center gap-1 px-2 py-0.5 text-2xs rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === "image"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <ImageIcon className="size-3" />
            <span>Images ({counts.image})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audio")}
            className={`flex items-center gap-1 px-2 py-0.5 text-2xs rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === "audio"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Mic className="size-3" />
            <span>Audio ({counts.audio})</span>
          </button>
        </div>
      </CardHeader>

      <CardContent
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col flex-1 min-h-0 justify-between gap-2.5 transition-colors ${
          isDragging ? "bg-primary/5 ring-2 ring-primary ring-inset rounded-b-xl" : ""
        }`}
      >
        {/* Error notification banner */}
        {error && (
          <div className="flex items-start justify-between gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-2xs text-destructive shrink-0">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <p className="leading-tight">{error}</p>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="text-destructive/70 hover:text-destructive cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        {/* Importing progress indicator */}
        {isImporting && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 p-2 text-2xs text-primary shrink-0 animate-pulse">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Importing &amp; storing media in IndexedDB...</span>
          </div>
        )}

        {/* Content body: Loading, Empty, or Asset Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center space-y-2 py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-2xs text-muted-foreground">
              Restoring saved media from IndexedDB...
            </p>
          </div>
        ) : filteredAssets.length === 0 ? (
          /* Empty state dropzone */
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-4 text-center space-y-2 bg-muted/20 flex-1 min-h-32 cursor-pointer hover:bg-muted/40 transition-colors"
          >
            <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Upload className="size-4" />
            </div>

            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">
                {activeTab === "all"
                  ? "No media imported yet"
                  : `No ${activeTab} files found`}
              </p>
              <p className="text-2xs text-muted-foreground max-w-44 leading-relaxed">
                Drag and drop files here, or click to browse.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              type="button"
              className="gap-1.5"
            >
              <Upload className="size-3" />
              <span>Browse Files</span>
            </Button>
          </div>
        ) : (
          /* Scrollable Media Grid */
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/json", JSON.stringify(asset));
                    e.dataTransfer.setData("text/plain", asset.id);
                  }}
                  className="group relative flex flex-col rounded-lg border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors shadow-xs cursor-grab active:cursor-grabbing"
                >
                  {/* Thumbnail / Visual Preview Box */}
                  <div className="relative w-full h-20 bg-muted flex items-center justify-center overflow-hidden">
                    {asset.category === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover pointer-events-none"
                        loading="lazy"
                      />
                    ) : asset.category === "video" ? (
                      asset.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.thumbnailUrl}
                          alt={asset.name}
                          className="w-full h-full object-cover pointer-events-none"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-1 pointer-events-none">
                          <Film className="size-6 text-primary" />
                          <span className="text-3xs font-mono uppercase">Video</span>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground gap-1 pointer-events-none">
                        <Mic className="size-6 text-primary" />
                        <span className="text-3xs font-mono uppercase">Audio</span>
                      </div>
                    )}

                    {/* Duration badge for audio/video */}
                    {asset.duration && asset.duration > 0 && (
                      <div className="absolute bottom-1 right-1 bg-overlay/80 text-foreground font-mono text-3xs px-1 py-0.5 rounded backdrop-blur-xs font-semibold pointer-events-none">
                        {formatDuration(asset.duration)}
                      </div>
                    )}

                    {/* Quick Add to Timeline button (hover overlay) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Insert at the playhead so media can be placed between
                        // existing clips instead of always appending.
                        addAssetToTimeline(asset, undefined, playhead);
                      }}
                      className="absolute top-1 left-1 size-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-105 cursor-pointer"
                      title="Add to timeline"
                      aria-label={`Add ${asset.name} to timeline`}
                    >
                      <Plus className="size-3.5" />
                    </button>

                    {/* Delete button (hover overlay) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAsset(asset.id);
                      }}
                      className="absolute top-1 right-1 size-6 rounded-md bg-overlay/80 text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground cursor-pointer"
                      title="Remove asset"
                      aria-label={`Remove ${asset.name}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>

                  {/* Asset Metadata Footer */}
                  <div className="p-1.5 flex flex-col gap-0.5 bg-card">
                    <p
                      className="text-2xs font-medium text-foreground truncate"
                      title={asset.name}
                    >
                      {asset.name}
                    </p>
                    <div className="flex items-center justify-between text-3xs text-muted-foreground">
                      <span className="capitalize">{asset.category}</span>
                      <span>{formatBytes(asset.size)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Informational tip footer */}
        <div className="flex items-start justify-between gap-1.5 rounded-lg bg-muted/40 p-2 text-2xs text-muted-foreground shrink-0">
          <p className="leading-tight">
            Persisted in browser IndexedDB. Zero cloud upload.
          </p>
          <span className="font-mono text-3xs shrink-0 font-medium text-foreground/70">
            {counts.all} {counts.all === 1 ? "file" : "files"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
