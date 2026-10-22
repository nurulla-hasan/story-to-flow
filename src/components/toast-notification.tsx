"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";

export type ToastState = {
  id: number;
  message: string;
  kind: "info" | "error" | "success";
};

export function ToastNotification({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-border bg-foreground px-4 py-3 text-xs font-medium text-background shadow-2xl animate-in fade-in slide-in-from-bottom-3">
      {toast.kind === "success" ? (
        <CheckCircle2 className="size-4 text-primary" />
      ) : toast.kind === "error" ? (
        <AlertTriangle className="size-4 text-destructive" />
      ) : (
        <Sparkles className="size-4 text-primary" />
      )}
      <span>{toast.message}</span>
    </div>
  );
}
