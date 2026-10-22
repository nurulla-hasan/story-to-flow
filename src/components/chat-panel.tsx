"use client";

import * as React from "react";
import {
  ArrowRight,
  Bot,
  Check,
  FileDiff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/apiClient";
import type { ChatOp } from "@/lib/types";

export function ChatDialog({
  open,
  onClose,
  onChanged,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}) {
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [proposal, setProposal] = React.useState<{
    summary: string;
    ops: ChatOp[];
    diff: string[];
  } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    try {
      const res = await api<{
        summary: string;
        ops: ChatOp[];
        diff: string[];
      }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setProposal(res);
      notify("Plan proposed. Review the changes below before confirming.", "info");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!proposal) return;
    setApplying(true);
    try {
      const res = await api<{
        edits: number;
        structural: number;
        changedPrompts: number;
      }>("/api/chat", {
        method: "PUT",
        body: JSON.stringify({ ops: proposal.ops }),
      });
      await onChanged();
      setProposal(null);
      setMessage("");
      notify(
        `Applied! ${res.edits} edits, ${res.structural} structural changes, ${res.changedPrompts} prompts re-assembled.`,
        "success",
      );
      onClose();
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Chat planner"
      description="Talk to the planner in plain English or Bangla. The model generates structured operations; prompts re-assemble automatically from locks."
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Changes are never applied without your confirmation.
          </span>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="e.g. 'Rina's saree should be crimson red with gold border from now on' or 'Split scene 2 into two'"
            className="flex-1 text-xs"
            disabled={busy || applying}
          />
          <Button
            type="submit"
            disabled={!message.trim() || busy || applying}
            className="shrink-0 text-xs"
          >
            {busy ? <Spinner className="size-4" /> : <Bot className="size-4" aria-hidden />}
            Plan change
          </Button>
        </form>

        <div className="rounded-lg border border-border bg-surface-muted p-3 text-xs leading-5 text-muted-foreground">
          <p className="font-medium text-foreground">Examples of what you can ask:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>Change character locks (dress, voice, accent) — affected scenes re-assemble instantly.</li>
            <li>Split or merge scenes, or delete an extra scene.</li>
            <li>Add a global rule: &quot;Always maintain the fog at dawn&quot;.</li>
            <li>Adjust setting: dialogue off, 10s clips, etc.</li>
          </ul>
        </div>

        {proposal ? (
          <div className="rounded-xl border border-brand-border bg-brand-subtle p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                  <FileDiff className="size-3" aria-hidden />
                  Proposed changes
                </span>
                <p className="mt-2 text-sm font-semibold text-secondary-foreground">
                  {proposal.summary || "Operations planned:"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Discard proposal"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1.5">
              {proposal.diff.map((line, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-md border border-brand-border bg-card px-3 py-2 font-mono text-xs leading-5 text-secondary-foreground"
                >
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  <span>{line}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProposal(null)}
                disabled={applying}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={apply}
                disabled={applying}
              >
                {applying ? <Spinner className="size-3.5" /> : <Check className="size-3.5" />}
                Confirm & Apply
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
