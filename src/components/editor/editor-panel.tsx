"use client";

import * as React from "react";

/**
 * Shared chrome primitives for the editor workspace.
 *
 * These are plain elements on purpose: the editor needs its own dense,
 * studio-grade surfaces, so it does not lean on the dashboard Card/Button
 * internals for structure or skin.
 */

export function EditorPanel({
  className = "",
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface EditorPanelHeaderProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function EditorPanelHeader({
  icon,
  title,
  meta,
  actions,
  className = "",
}: EditorPanelHeaderProps) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2.5 border-b border-border px-3.5 py-2.5 ${className}`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-primary ring-1 ring-brand-border">
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xs font-semibold tracking-wide text-foreground">
          {title}
        </h2>
        {meta ? (
          <div className="truncate font-mono text-3xs text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </div>
  );
}

export function EditorPanelBody({
  className = "",
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface EditorSectionProps extends React.ComponentProps<"div"> {
  className?: string;
}

export function EditorSection({
  className = "",
  children,
  ...props
}: EditorSectionProps) {
  return (
    <section
      className={`rounded-xl border border-border bg-surface-subtle/70 p-3 ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Controls                                                                   */
/* -------------------------------------------------------------------------- */

/* EditorSlider removed — use shadcn Slider from @/components/ui/slider */

