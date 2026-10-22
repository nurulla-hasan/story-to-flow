"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "cn";

export function SimpleSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  className,
}: {
  id?: string;
  value?: string;
  onValueChange?: (val: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
}) {
  const selectedLabel =
    options.find((opt) => opt.value === value)?.label ?? placeholder ?? value;

  return (
    <Select value={value} onValueChange={(val) => val && onValueChange?.(val)}>
      <SelectTrigger id={id} className={cn("w-full bg-card", className)}>
        <span className="flex-1 text-left truncate">{selectedLabel}</span>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
