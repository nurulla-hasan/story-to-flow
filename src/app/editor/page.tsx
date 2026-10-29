"use client";

import * as React from "react";
import { MediaLibraryProvider } from "@/lib/use-media-library";
import { TimelineProvider } from "@/lib/timeline-context";
import { EditorHeader } from "@/components/editor/editor-header";
import { MediaLibraryPanel } from "@/components/editor/media-library-panel";
import { PreviewCanvasPanel } from "@/components/editor/preview-canvas-panel";
import { ClipInspectorPanel } from "@/components/editor/clip-inspector-panel";
import { TimelineDock } from "@/components/editor/timeline-dock";

export default function VideoEditorPage() {
  const [isInspectorCollapsed, setIsInspectorCollapsed] = React.useState(false);

  return (
    <MediaLibraryProvider>
      <TimelineProvider>
        <div className="flex h-dvh w-full flex-col overflow-hidden bg-background p-2 select-none sm:p-3">
          {/* Unified studio frame: one chrome surface split by hairline seams */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-editor-chrome shadow-sm">
            <EditorHeader />

            <main className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto bg-border lg:flex-row lg:overflow-hidden">
              <section
                aria-label="Media Library"
                className="h-72 shrink-0 overflow-hidden lg:h-auto lg:w-72 lg:shrink-0"
              >
                <MediaLibraryPanel />
              </section>

              <section
                aria-label="Preview Canvas"
                className="min-h-72 flex-1 overflow-hidden lg:min-h-0"
              >
                <PreviewCanvasPanel />
              </section>

              <section
                aria-label="Clip Inspector"
                className={`shrink-0 overflow-hidden transition-all duration-200 ${
                  isInspectorCollapsed
                    ? "h-14 lg:h-auto lg:w-14"
                    : "h-80 lg:h-auto lg:w-80"
                }`}
              >
                <ClipInspectorPanel
                  collapsed={isInspectorCollapsed}
                  onToggleCollapsed={() => setIsInspectorCollapsed((value) => !value)}
                />
              </section>
            </main>

            <footer
              aria-label="Timeline Dock"
              className="shrink-0 overflow-hidden border-t border-border bg-card"
            >
              <TimelineDock />
            </footer>
          </div>
        </div>
      </TimelineProvider>
    </MediaLibraryProvider>
  );
}
