import * as React from "react";
import { cn } from "cn";

type Variant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "outline";

const variants: Record<Variant, string> = {
  neutral: "bg-[#eef1f4] text-[#3f4d5a] border-transparent",
  brand: "bg-[#e6f4f1] text-[#0b5f58] border-transparent",
  success: "bg-[#e8f5ec] text-[#166534] border-transparent",
  warning: "bg-[#fdf3dd] text-[#8a5300] border-transparent",
  danger: "bg-[#fdecea] text-[#9f1d15] border-transparent",
  outline: "bg-white text-[#3f4d5a] border-border",
};

function Badge({
  className,
  variant = "neutral",
  ...props
}: React.ComponentProps<"span"> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
