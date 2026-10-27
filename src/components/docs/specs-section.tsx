import { cn } from "cn";
import { Database, Lightbulb } from "lucide-react";

import { specRows } from "./docs-data";

export function SpecsSection() {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border">
        {specRows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 transition-colors duration-200 last:border-b-0 hover:bg-surface-subtle"
          >
            <span className="text-2xs text-muted-foreground">{row.label}</span>
            <span
              className={cn(
                "flex items-center gap-2 text-right text-2xs font-medium",
                row.mono && "font-mono text-3xs"
              )}
            >
              {row.value}
              {row.badge ? (
                <span className="rounded-full bg-success-subtle px-2 py-0.5 text-3xs text-success">
                  {row.badge}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-3xs font-semibold tracking-widest text-muted-foreground uppercase">
            <Database className="size-3.5 text-primary" />
            Workspace persistence
          </p>
          <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
            Your story draft and generated packages auto-save in this browser.
            Reloading or navigating away will not lose your work.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-3xs font-semibold tracking-widest text-muted-foreground uppercase">
            <Lightbulb className="size-3.5 text-warning" />
            Starting over
          </p>
          <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
            Use “Reset Studio” in the studio settings bar to clear the current
            draft and generate a fresh plan from a new story.
          </p>
        </div>
      </div>
    </div>
  );
}
