"use client";

import * as React from "react";
import {
  FolderOpen,
  Upload,
  Film,
  Image as ImageIcon,
  Mic,
  Info,
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

type MediaTab = "all" | "video" | "image" | "audio";

export function MediaLibraryPanel() {
  const [activeTab, setActiveTab] = React.useState<MediaTab>("all");

  return (
    <Card size="sm" className="flex flex-col h-full">
      <CardHeader className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-4 text-primary" />
            <CardTitle>Media Library</CardTitle>
          </div>
          <Badge variant="secondary">0 items</Badge>
        </div>
        <CardDescription>
          Imported visual scenes and Cartesia audio
        </CardDescription>

        {/* Media filter tabs */}
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
            All
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
            <span>Videos</span>
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
            <span>Images</span>
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
            <span>Audio</span>
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 min-h-0 justify-between gap-3">
        {/* Empty state dropzone placeholder */}
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-4 text-center space-y-2 bg-muted/20 flex-1 min-h-32">
          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Upload className="size-4" />
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">
              No media imported yet
            </p>
            <p className="text-2xs text-muted-foreground max-w-44 leading-relaxed">
              Drag images, videos, or audio here or browse from your device.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled
            className="gap-1.5"
            title="Media import engine will be activated in Phase 2"
          >
            <Upload className="size-3" />
            <span>Import Files (Phase 2)</span>
          </Button>
        </div>

        {/* Informational tip footer */}
        <div className="flex items-start gap-1.5 rounded-lg bg-muted/50 p-2 text-2xs text-muted-foreground">
          <Info className="size-3 shrink-0 mt-0.5 text-primary" />
          <p className="leading-tight">
            Imported assets will be saved directly in your browser&apos;s IndexedDB in Phase 2. Zero cloud upload required.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
