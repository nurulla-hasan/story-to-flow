import * as React from "react";
import { cn } from "cn";

function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-[10px] border border-input bg-white px-3 pr-8 text-sm text-foreground shadow-[0_1px_0_rgba(20,32,43,0.02)] transition-colors",
        "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { Select };
