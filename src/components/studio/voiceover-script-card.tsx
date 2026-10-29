"use client";

import { useState } from "react";
import { Mic, Copy, Check, RotateCcw, ArrowRight, Trash2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface VoiceoverScriptCardProps {
  script: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onRegenerate?: () => void;
  onProceedToDuration: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
  isDirectVoiceover?: boolean;
}

export function VoiceoverScriptCard({
  script,
  onChange,
  onClear,
  onRegenerate,
  onProceedToDuration,
  isGenerating = false,
  disabled = false,
  isDirectVoiceover = false,
}: VoiceoverScriptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!script.trim()) return;
    try {
      await navigator.clipboard.writeText(script.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy voiceover script:", err);
    }
  };

  // Estimate speaking duration at ~2.4 Bengali words per second
  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.round(wordCount / 2.4);

  return (
    <Card className="border-primary/20 bg-card shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
            <Mic className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>
                {isDirectVoiceover ? "Direct Voiceover Script" : "Master Voiceover Script"}
              </CardTitle>
              <Badge variant="outline" className="text-3xs font-mono">
                {isDirectVoiceover ? "Direct Voiceover" : "Stage 2"}
              </Badge>
            </div>
            <CardDescription className="font-bangla mt-0.5">
              {isDirectVoiceover
                ? "Enter or edit your narration script, copy it for Cartesia speech synthesis, then enter duration."
                : "Review and edit the narration, then copy it to generate speech in Cartesia."}
            </CardDescription>
          </div>
        </div>

        {/* Header Action: Copy for Cartesia & Clear / Regenerate */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            disabled={!script.trim() || disabled}
            className="gap-1.5 text-xs cursor-pointer shadow-2xs"
            title="Copy script text to clipboard for Cartesia TTS"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-primary" />
                <span className="text-primary font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy Script for Cartesia</span>
              </>
            )}
          </Button>

          {onClear && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              disabled={!script.trim() || disabled}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              title="Clear voiceover script"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}

          {onRegenerate && (
            <Button
              variant="ghost"
              onClick={onRegenerate}
              disabled={isGenerating || disabled}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="Regenerate voiceover script with a new take"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">Regenerate</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Editable Voiceover Textarea */}
        <div className="relative">
          <Textarea
            id="voiceover-script-input"
            value={script}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={
              isDirectVoiceover
                ? "ভয়েসওভার স্ক্রিপ্টটি এখানে লিখুন বা পেস্ট করুন... (Enter or paste your voiceover script here)"
                : "ভয়েসওভার স্ক্রিপ্টটি এখানে প্রদর্শিত হবে। আপনি প্রয়োজনে শব্দ বা বাক্য সম্পাদন করতে পারেন..."
            }
            className="w-full min-h-40 max-h-85 font-bangla text-sm leading-relaxed resize-y border-border/80 focus:border-primary p-3"
          />
        </div>

        {/* Word count & Speaking duration guidance bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-t border-border/60 pt-3">
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span>{wordCount} words</span>
            <span>•</span>
            <span>Estimated speech: ~{estimatedSeconds}s (@ 2.4 wps)</span>
          </div>

          <Button
            onClick={onProceedToDuration}
            disabled={!script.trim() || disabled}
            className="gap-1.5 text-xs font-semibold cursor-pointer shadow-sm"
          >
            <span>Proceed to Duration Entry</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
