import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

export function LabeledCheckbox({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  className,
}: {
  id?: string;
  label: React.ReactNode;
  description?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}) {
  const autoId = React.useId();
  const inputId = id || autoId;
  return (
    <div className={cn("flex items-start gap-3 py-1.5", className)}>
      <Checkbox
        id={inputId}
        checked={checked}
        onCheckedChange={(val) => onCheckedChange?.(Boolean(val))}
        className="mt-0.5"
      />
      <div className="grid gap-0.5 leading-none">
        <Label htmlFor={inputId} className="cursor-pointer text-xs font-medium text-foreground">
          {label}
        </Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
