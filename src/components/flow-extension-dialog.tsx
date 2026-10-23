"use client";

import * as React from "react";
import { CheckCircle2, Download, ExternalLink, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";
import { isFlowExtensionInstalled } from "@/lib/flowBridge";

export function FlowExtensionDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setInstalled(isFlowExtensionInstalled());
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Google Flow Auto-Bridge Extension"
      size="md"
    >
      <div className="space-y-4">
        {/* Status banner */}
        <div
          className={`flex items-center justify-between rounded-lg border p-3 ${
            installed
              ? "border-success/30 bg-success-subtle text-success-foreground"
              : "border-warning/30 bg-warning-subtle text-warning-foreground"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`size-2.5 rounded-full ${
                installed ? "bg-success animate-pulse" : "bg-warning"
              }`}
            />
            <span className="text-xs font-semibold">
              {installed
                ? "Extension Active & Connected"
                : "Extension Not Detected"}
            </span>
          </div>
          {installed ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" /> Ready for 1-click send
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Needs 1-minute setup
            </span>
          )}
        </div>

        {/* Feature Highlights */}
        <div className="rounded-lg border border-border bg-surface-subtle p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What 1-Click Send Does:
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-foreground">
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>
                <strong>Auto-focuses Google Flow:</strong> Switches to your active Flow tab or opens a new one.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Layers className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>
                <strong>Transfers Prompt & Images:</strong> Pastes the assembled prompt and attaches your start frame image automatically.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>
                <strong>Runs Generation:</strong> Clicks the Generate button so you don&apos;t have to copy-paste manually.
              </span>
            </li>
          </ul>
        </div>

        {/* 1-Minute Setup Guide */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Setup Instructions
            </p>
            <a
              href="/api/extension/download"
              download="story-to-flow-extension.zip"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
            >
              <Download className="size-3.5" /> Download Extension (.zip)
            </a>
          </div>
          <ol className="list-inside list-decimal space-y-1.5 text-xs leading-5 text-foreground">
            <li>
              Click the <strong>Download Extension (.zip)</strong> button above and unzip the file on your computer.
            </li>
            <li>
              Open Google Chrome and go to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                chrome://extensions
              </code>
            </li>
            <li>
              Enable <strong>Developer mode</strong> using the toggle at the top-right.
            </li>
            <li>
              Click <strong>Load unpacked</strong> at the top-left and select the unzipped extension folder.
            </li>
          </ol>
        </div>

        {/* Action footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <a
            href="https://flow.google.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Open flow.google.com <ExternalLink className="size-3" />
          </a>
          <Button type="button" size="sm" onClick={onClose} className="h-8 text-xs">
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
}
