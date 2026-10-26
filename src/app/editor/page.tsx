"use client";

import * as React from "react";
import { TimelineProvider } from "@/lib/timeline-context";
import { EditorHeader } from "@/components/editor/editor-header";
import { MediaLibraryPanel } from "@/components/editor/media-library-panel";
import { PreviewCanvasPanel } from "@/components/editor/preview-canvas-panel";
import { ClipInspectorPanel } from "@/components/editor/clip-inspector-panel";
import { TimelineDock } from "@/components/editor/timeline-dock";

export default function VideoEditorPage() {
  return (
    <TimelineProvider>
      <div className="h-screen w-screen overflow-hidden bg-background flex flex-col p-2.5 sm:p-3 gap-2.5 select-none">
        {/* 1. Standalone Top Navigation & Toolbar (Fixed height, no scroll) */}
        <EditorHeader />

        {/* 2. Main 3-Panel Workspace Grid (Expands to fill available vertical space without outer scroll) */}
        <main className="grid grid-cols-12 gap-2.5 items-stretch flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Media Library */}
          <section aria-label="Media Library" className="col-span-3 h-full min-h-0 overflow-hidden">
            <MediaLibraryPanel />
          </section>

          {/* Center Column: 9:16 Vertical Preview Canvas Stage */}
          <section aria-label="Preview Canvas" className="col-span-6 h-full min-h-0 overflow-hidden">
            <PreviewCanvasPanel />
          </section>

          {/* Right Column: Clip Inspector */}
          <section aria-label="Clip Inspector" className="col-span-3 h-full min-h-0 overflow-hidden">
            <ClipInspectorPanel />
          </section>
        </main>

        {/* 3. Bottom Multi-Track Timeline Dock (Fixed height, internal horizontal scroll only) */}
        <footer aria-label="Timeline Dock" className="shrink-0 overflow-hidden">
          <TimelineDock />
        </footer>
      </div>
    </TimelineProvider>
  );
}
