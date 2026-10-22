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
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#eef1f4] text-[#3f4d5a]">
            <ScrollText className="h-4 w-4" aria-hidden />
          </span>
          <CardTitle>Custom rules</CardTitle>
          <span className="ml-auto text-[11px] font-medium tabular-nums text-muted-foreground">
            {data.rules.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-1">
        {data.rules.length === 0 ? (
          <p className="rounded-[9px] border border-dashed border-border bg-[#fbfcfd] p-3 text-[12px] leading-5 text-muted-foreground">
            Rules such as “always keep the blue saree” are added to MUST in every
            scene, then all prompts re-assemble.
          </p>
        ) : null}
        <ul className="space-y-1.5">
          {data.rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-start gap-2 rounded-[8px] border border-border bg-[#fbfcfd] px-2.5 py-2 text-[11.5px] leading-5 text-[#3f4d5a]"
            >
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0f766e]" aria-hidden />
              <span className="min-w-0 flex-1">{rule.text}</span>
              <button
                type="button"
                onClick={() => remove(rule.id)}
                disabled={busy === rule.id}
                aria-label={`Delete rule: ${rule.text}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-[#fdecea] hover:text-[#a52a20] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-50"
              >
                {busy === rule.id ? (
                  <Spinner className="h-3 w-3" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
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
            className="h-10 w-10 shrink-0"
            disabled={!text.trim() || busy === "add"}
            aria-label="Add rule"
          >
            {busy === "add" ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
