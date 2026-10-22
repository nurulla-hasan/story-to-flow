"use client";

import * as React from "react";
import { Download, FileArchive, FileJson, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";

export function ExportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export production package"
      description="Download your scene prompts, full planning JSON, or a complete zip archive containing all prompts and available keyframe/clip assets."
      size="md"
      footer={
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="grid gap-3">
        <a
          href="/api/export?format=txt"
          download
          className="flex items-center gap-3 rounded-lg border border-border bg-surface-subtle p-3.5 transition-colors hover:border-primary hover:bg-brand-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <FileText className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Prompts (.txt)</p>
            <p className="text-xs text-muted-foreground">
              Plain text formatted with clear scene dividers, ready for easy copy-paste.
            </p>
          </div>
          <Download className="size-4 text-muted-foreground" aria-hidden />
        </a>

        <a
          href="/api/export?format=json"
          download
          className="flex items-center gap-3 rounded-lg border border-border bg-surface-subtle p-3.5 transition-colors hover:border-primary hover:bg-brand-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <FileJson className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Complete Plan (.json)</p>
            <p className="text-xs text-muted-foreground">
              Story bible, locked characters, locations, settings, and all scene metadata.
            </p>
          </div>
          <Download className="size-4 text-muted-foreground" aria-hidden />
        </a>

        <a
          href="/api/export?format=zip"
          download
          className="flex items-center gap-3 rounded-lg border border-border bg-surface-subtle p-3.5 transition-colors hover:border-primary hover:bg-brand-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-warning-subtle text-warning">
            <FileArchive className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Full Archive (.zip)</p>
            <p className="text-xs text-muted-foreground">
              Contains prompts.txt, plan.json, and all stored keyframes, last frames, and clips.
            </p>
          </div>
          <Download className="size-4 text-muted-foreground" aria-hidden />
        </a>
      </div>
    </Modal>
  );
}
