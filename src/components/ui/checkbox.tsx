import * as React from "react";
import { cn } from "cn";

function Checkbox({
  label,
  description,
  className,
  ...props
}: React.ComponentProps<"input"> & { label: React.ReactNode; description?: string }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1 py-2 text-sm leading-5 transition-colors hover:bg-muted/60",
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...props}
      />
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export { Checkbox };
