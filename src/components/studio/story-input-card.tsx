"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Field, FieldError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface StoryInputCardProps {
  story: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  validationError?: string | null;
  disabled?: boolean;
}

function StoryInputHeaderIcon({
  className = "size-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M6 6h10" />
      <path d="M6 10h10" />
      <path d="M6 14h6" />
    </svg>
  );
}

export function StoryInputCard({
  story,
  onChange,
  onClear,
  validationError,
  disabled = false,
}: StoryInputCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-brand-subtle flex items-center justify-center shrink-0 border border-brand-border/40">
            <StoryInputHeaderIcon className="size-5 text-primary" />
          </div>
          <div>
            <CardTitle>Story Input</CardTitle>
            <CardDescription className="font-bangla">
              Write your story in Bangla or English.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Text Area using shadcn Field and Textarea */}
          <Field data-invalid={!!validationError}>
            <Textarea
              id="story-input"
              value={story}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              placeholder="শরতের এক রাতে ছোট্ট গ্রামটিতে হঠাৎ আকাশের সব তারা নিভে গেল। গ্রামের মানুষ ভয়ে ঘরের দরজা বন্ধ করে ...."
              className="w-full h-65 overflow-y-auto font-bangla resize-none field-sizing-fixed"
            />
            {validationError && <FieldError>{validationError}</FieldError>}
          </Field>

          {/* Footer Bar: Counter & Clear Button */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {story.length.toLocaleString()} / 50,000
            </span>

            <Button
              type="button"
              variant="ghost"
              onClick={onClear}
              disabled={disabled || !story}
              className="gap-1.5"
              title="Clear input"
            >
              <Trash2 className="size-3.5" />
              <span>Clear</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
