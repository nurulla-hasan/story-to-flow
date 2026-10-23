"use client";

import * as React from "react";
import { Plus, ScrollText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/apiClient";
import type { ProjectData } from "@/lib/types";

export function RulesPanel({
  data,
  onChanged,
  notify,
}: {
  data: ProjectData;
  onChanged: () => Promise<void>;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
}) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState<number | "add" | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy("add");
    try {
      await api("/api/rules", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setText("");
      await onChanged();
      notify("Rule added to every scene prompt.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number) {
    setBusy(id);
    try {
      await api(`/api/rules/${id}`, { method: "DELETE" });
      await onChanged();
      notify("Rule removed; prompts re-assembled.", "success");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ScrollText className="size-4" aria-hidden />
          </span>
          <CardTitle>Custom rules</CardTitle>
          <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
            {data.rules.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-subtle p-3 text-xs leading-5 text-muted-foreground">
            Rules such as “always keep the blue saree” are added to MUST in every
            scene, then all prompts re-assemble.
          </p>
        ) : null}
        <ul className="space-y-1.5">
          {data.rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-start gap-2 rounded-md border border-border bg-surface-subtle px-2.5 py-2 text-xs leading-5 text-foreground"
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="min-w-0 flex-1">{rule.text}</span>
              <button
                type="button"
                onClick={() => remove(rule.id)}
                disabled={busy === rule.id}
                aria-label={`Delete rule: ${rule.text}`}
                className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {busy === rule.id ? (
                  <Spinner className="size-3" />
                ) : (
                  <Trash2 className="size-3.5" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="flex gap-1.5">
          <label htmlFor="new-rule" className="sr-only">
            New rule
          </label>
          <Input
            id="new-rule"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Add a rule…"
            className="h-10 text-xs"
            maxLength={400}
          />
          <Button
            type="submit"
            size="icon"
            className="size-10 shrink-0"
            disabled={!text.trim() || busy === "add"}
            aria-label="Add rule"
          >
            {busy === "add" ? <Spinner /> : <Plus className="size-4" aria-hidden />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
