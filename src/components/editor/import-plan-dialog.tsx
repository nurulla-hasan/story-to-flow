"use client";

import * as React from "react";
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Film,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  extractScenePlanFromText,
  getAllShotsFromPlan,
  type ScenePlan,
} from "@/lib/scene-plan";

interface ImportPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPlan?: ScenePlan | null;
  onApplyPlan: (plan: ScenePlan) => void;
}

export function ImportPlanDialog({
  open,
  onOpenChange,
  existingPlan,
  onApplyPlan,
}: ImportPlanDialogProps) {
  const [pastedText, setPastedText] = React.useState<string>("");
  const [confirmReplace, setConfirmReplace] = React.useState<boolean>(false);

  // Real-time extraction & schema validation
  const parseResult = React.useMemo(() => {
    const trimmed = pastedText.trim();
    if (!trimmed) return null;
    return extractScenePlanFromText(trimmed);
  }, [pastedText]);

  const shots = React.useMemo(() => {
    if (!parseResult || !parseResult.success) return [];
    return getAllShotsFromPlan(parseResult.plan);
  }, [parseResult]);

  const imageCount = React.useMemo(
    () => shots.filter((s) => s.mediaKind === "image").length,
    [shots]
  );
  const videoCount = React.useMemo(
    () => shots.filter((s) => s.mediaKind === "video").length,
    [shots]
  );

  const handleClose = () => {
    setPastedText("");
    setConfirmReplace(false);
    onOpenChange(false);
  };

  const handleApply = () => {
    if (!parseResult || !parseResult.success) return;
    onApplyPlan(parseResult.plan);
    handleClose();
  };

  const hasExistingPlan = Boolean(existingPlan && existingPlan.scenes.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Import Story &amp; Shot Plan</DialogTitle>
              <DialogDescription>
                Paste the AI story response to generate structured timeline shot blocks and auto-motion hints.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 max-h-125 overflow-y-auto pr-1">
          {/* Textarea for pasting AI output */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-2xs text-muted-foreground">
              <span>Paste Complete AI Output or JSON Plan</span>
              <span className="font-mono text-3xs">{pastedText.length} chars</span>
            </div>
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste AI response here (including the ```json ... ``` code block or standard Story Scene blocks)..."
              className="h-36 font-mono text-2xs leading-relaxed resize-none"
              aria-label="Story Plan text or JSON input"
            />
          </div>

          {/* Validation Feedback: Error Banner */}
          {parseResult && !parseResult.success && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-2xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <p className="font-semibold">Validation Error</p>
                <p className="leading-relaxed opacity-90">{parseResult.error}</p>
              </div>
            </div>
          )}

          {/* Validation Feedback: Success Summary Card */}
          {parseResult && parseResult.success && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 text-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-primary font-semibold">
                  <CheckCircle2 className="size-4" />
                  <span>Valid Scene Plan (Schema v{parseResult.plan.schemaVersion})</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-3xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3 text-primary" />
                    <span>{parseResult.plan.totalDuration?.toFixed(1)}s total</span>
                  </span>
                </div>
              </div>

              {/* Stats badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1 text-3xs">
                  <span>{parseResult.plan.scenes.length} Scenes</span>
                </Badge>
                <Badge variant="secondary" className="gap-1 text-3xs">
                  <span>{shots.length} Total Shots</span>
                </Badge>
                <Badge variant="outline" className="gap-1 text-3xs">
                  <ImageIcon className="size-3 text-primary" />
                  <span>{imageCount} Images</span>
                </Badge>
                {videoCount > 0 && (
                  <Badge variant="outline" className="gap-1 text-3xs">
                    <Film className="size-3 text-primary" />
                    <span>{videoCount} Videos</span>
                  </Badge>
                )}
              </div>

              {/* Scrollable Shot Plan Preview List */}
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto rounded-lg border border-border bg-card p-2">
                {shots.map((shot) => (
                  <div
                    key={shot.shotId}
                    className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <span className="font-mono text-3xs text-primary">{shot.shotId}</span>
                        <span className="text-3xs uppercase tracking-wider text-muted-foreground font-mono">
                          {shot.mediaKind}
                        </span>
                        <span className="font-mono text-3xs text-muted-foreground">
                          {shot.duration.toFixed(1)}s
                        </span>
                        {shot.motion && (
                          <span className="text-3xs text-primary/80 font-mono">
                            • {shot.motion.type}
                          </span>
                        )}
                        {shot.transitionToNext && (
                          <span className="text-3xs text-muted-foreground font-mono">
                            → {shot.transitionToNext.type}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-3xs text-muted-foreground mt-0.5" title={shot.prompt}>
                        {shot.prompt}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Replacement Warning Confirmation if plan already exists */}
          {hasExistingPlan && parseResult?.success && (
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning-subtle p-3 text-2xs text-warning-subtle-foreground">
              <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-warning">Replace Existing Story Plan?</p>
                <p className="leading-relaxed opacity-90">
                  An existing Story Plan ({existingPlan?.scenes.length} scenes, {getAllShotsFromPlan(existingPlan!).length} shots) is currently active.
                  Applying will replace the plan and its shot assignments. You can undo this action with Ctrl+Z.
                </p>
                <label className="flex items-center gap-2 pt-1 cursor-pointer font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={confirmReplace}
                    onChange={(e) => setConfirmReplace(e.target.checked)}
                    className="size-3.5 rounded border-border"
                  />
                  <span>Confirm replacing active Story Plan</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={
                !parseResult ||
                !parseResult.success ||
                (hasExistingPlan && !confirmReplace)
              }
              className="gap-1.5"
            >
              <Sparkles className="size-3.5" />
              <span>Apply Story Plan</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
