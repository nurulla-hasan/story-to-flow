"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  return (
    <Select value={value} onValueChange={(val) => val && onValueChange?.(val)}>
      <SelectTrigger id={id} className={cn("w-full bg-card", className)}>
        <SelectValue placeholder={placeholder} />
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
