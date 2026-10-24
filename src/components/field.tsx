import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint ? (
        typeof hint === "string" ? (
          <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
        ) : (
          <div className="text-xs leading-5 text-muted-foreground">{hint}</div>
        )
      ) : null}
    </div>
  );
}
