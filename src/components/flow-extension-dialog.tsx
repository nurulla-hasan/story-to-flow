"use client";

import * as React from "react";
import { CheckCircle2, ExternalLink, Layers, Sparkles } from "lucide-react";
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
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            1-Minute Setup Instructions
          </p>
          <ol className="list-inside list-decimal space-y-1.5 text-xs leading-5 text-foreground">
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
              Click <strong>Load unpacked</strong> at the top-left.
            </li>
            <li>
              Select the <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">extension</code> folder in your project:
              <div className="mt-1 rounded bg-muted/80 p-2 font-mono text-2xs select-all text-muted-foreground">
                C:\Users\golap\Desktop\story-to-flow\extension
              </div>
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
