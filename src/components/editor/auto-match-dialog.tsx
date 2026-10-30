"use client";

import * as React from "react";
import {
  Sparkles,
  CheckCircle2,
  Film,
  Image as ImageIcon,
  Check,
  Lock,
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MediaAssetItem } from "@/lib/media-storage";
import { matchAssetsToPlan } from "@/lib/media-matching";
import {
  getAllShotsFromPlan,
  type ScenePlan,
  type ShotPlanItem,
} from "@/lib/scene-plan";
import type { TimelineTrack, TrackId } from "@/types/timeline";
import { formatBytes } from "@/lib/media-helpers";

interface AutoMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ScenePlan;
  assets: readonly MediaAssetItem[];
  tracks: readonly TimelineTrack[];
  onApplyMatches: (
    confirmedAssignments: Array<{
      shot: ShotPlanItem;
      asset: MediaAssetItem;
      targetTrackId?: TrackId;
    }>
  ) => void;
}

export function AutoMatchDialog({
  open,
  onOpenChange,
  plan,
  assets,
  tracks,
  onApplyMatches,
}: AutoMatchDialogProps) {
  const [allowDuplicates, setAllowDuplicates] = React.useState<boolean>(false);
  const [replaceExisting, setReplaceExisting] = React.useState<boolean>(false);
  const [manualAssignments, setManualAssignments] = React.useState<Map<string, string>>(() => new Map());
  const [deselectedManualShotIds, setDeselectedManualShotIds] = React.useState<Set<string>>(() => new Set());

  // Calculate matching candidates
  const matches = React.useMemo(() => {
    return matchAssetsToPlan(plan, assets, tracks, {
      allowDuplicates,
      replaceExisting,
    });
  }, [plan, assets, tracks, allowDuplicates, replaceExisting]);

  const allShots = React.useMemo(() => getAllShotsFromPlan(plan), [plan]);
  const shotMap = React.useMemo(() => new Map(allShots.map((s) => [s.shotId, s])), [allShots]);
  const assetsById = React.useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const compatibleAssetsByKind = React.useMemo(
    () => ({
      image: assets.filter((asset) => asset.category === "image"),
      video: assets.filter((asset) => asset.category === "video"),
    }),
    [assets]
  );
  const assetShotUsage = React.useMemo(() => {
    const usage = new Map<string, Set<string>>();
    for (const match of matches) {
      const manualId = manualAssignments.get(match.shotId);
      const manualAsset = manualId ? assetsById.get(manualId) : undefined;
      const assetId = manualAsset?.category === match.mediaKind ? manualAsset.id : match.matchedAsset?.id;
      if (!assetId) continue;
      const shots = usage.get(assetId) ?? new Set<string>();
      shots.add(match.shotId);
      usage.set(assetId, shots);
    }
    return usage;
  }, [matches, manualAssignments, assetsById]);

  // Selected overrides:
  // - "exact" matches default to checked unless user explicitly unchecks
  // - "suggested" matches default to UNCHECKED unless user explicitly checks
  // - "type-mismatch", "locked-track", "none" cannot be checked
  const [deselectedExactShotIds, setDeselectedExactShotIds] = React.useState<Set<string>>(() => new Set());
  const [selectedSuggestedShotIds, setSelectedSuggestedShotIds] = React.useState<Set<string>>(() => new Set());

  const toggleShotConfirmation = React.useCallback(
    (shotId: string, matchQuality: string, checked: boolean) => {
      if (matchQuality === "exact") {
        setDeselectedExactShotIds((prev) => {
          const next = new Set(prev);
          if (checked) next.delete(shotId);
          else next.add(shotId);
          return next;
        });
      } else if (matchQuality === "suggested") {
        setSelectedSuggestedShotIds((prev) => {
          const next = new Set(prev);
          if (checked) next.add(shotId);
          else next.delete(shotId);
          return next;
        });
      } else if (matchQuality === "manual") {
        setDeselectedManualShotIds((prev) => {
          const next = new Set(prev);
          if (checked) next.delete(shotId);
          else next.add(shotId);
          return next;
        });
      }
    },
    []
  );

  const isShotConfirmed = React.useCallback(
    (shotId: string, matchQuality: string, isExisting: boolean): boolean => {
      if (matchQuality === "manual") {
        return !deselectedManualShotIds.has(shotId) && (!isExisting || replaceExisting);
      }
      if (isExisting) return false;
      if (matchQuality === "exact") return !deselectedExactShotIds.has(shotId);
      if (matchQuality === "suggested") return selectedSuggestedShotIds.has(shotId);
      return false;
    },
    [deselectedExactShotIds, deselectedManualShotIds, replaceExisting, selectedSuggestedShotIds]
  );

  const confirmedList = React.useMemo(() => {
    const list: Array<{
      shot: ShotPlanItem;
      asset: MediaAssetItem;
      targetTrackId?: TrackId;
    }> = [];

    for (const m of matches) {
      const manualAssetId = manualAssignments.get(m.shotId);
      const manualAsset = manualAssetId ? assetsById.get(manualAssetId) : undefined;
      const assetToApply = manualAsset ?? m.matchedAsset;
      const qualityToApply = manualAsset ? "manual" : m.matchQuality;

      if (assetToApply && isShotConfirmed(m.shotId, qualityToApply, m.isExistingAssignment)) {
        const shot = shotMap.get(m.shotId);
        if (shot) {
          list.push({
            shot,
            asset: assetToApply,
            targetTrackId: m.targetTrackId,
          });
        }
      }
    }
    return list;
  }, [matches, isShotConfirmed, shotMap, manualAssignments, assetsById]);

  const handleApply = () => {
    if (confirmedList.length === 0) return;
    onApplyMatches(confirmedList);
    onOpenChange(false);
  };

  const exactCount = matches.filter((m) => m.matchQuality === "exact" && !m.isExistingAssignment).length;
  const suggestedCount = matches.filter((m) => m.matchQuality === "suggested").length;
  const unassignedCount = matches.filter((m) => {
    const selectedId = manualAssignments.get(m.shotId);
    const selectedAsset = selectedId ? assetsById.get(selectedId) : undefined;
    return !m.matchedAsset && selectedAsset?.category !== m.mediaKind;
  }).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Auto-Match Media to Shot Plan</DialogTitle>
              <DialogDescription>
                Review and confirm media asset assignments before any timeline clips are created.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 max-h-120 overflow-y-auto pr-1">
          {/* Summary Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5 text-2xs">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 text-3xs">
                <span>{matches.length} Total Shots</span>
              </Badge>
              {exactCount > 0 && (
                <Badge variant="default" className="gap-1 text-3xs bg-primary text-primary-foreground">
                  <Check className="size-3" />
                  <span>{exactCount} Exact Matches</span>
                </Badge>
              )}
              {suggestedCount > 0 && (
                <Badge variant="outline" className="gap-1 text-3xs text-warning border-warning/40">
                  <Sparkles className="size-3" />
                  <span>{suggestedCount} Suggestions</span>
                </Badge>
              )}
              {unassignedCount > 0 && (
                <Badge variant="outline" className="gap-1 text-3xs text-muted-foreground">
                  <span>{unassignedCount} Unmatched</span>
                </Badge>
              )}
            </div>

            {/* Options Checkboxes */}
            <div className="flex items-center gap-3 text-3xs text-muted-foreground">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={allowDuplicates}
                  onCheckedChange={(c) => setAllowDuplicates(Boolean(c))}
                />
                <span>Allow asset reuse</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={replaceExisting}
                  onCheckedChange={(c) => setReplaceExisting(Boolean(c))}
                />
                <span>Replace existing</span>
              </label>
            </div>
          </div>

          {/* Mapping Review Cards */}
          <div className="flex flex-col gap-2">
            {matches.map((m) => {
              const manualAssetId = manualAssignments.get(m.shotId);
              const candidateManualAsset = manualAssetId ? assetsById.get(manualAssetId) : undefined;
              const selectedManualAsset = candidateManualAsset?.category === m.mediaKind ? candidateManualAsset : undefined;
              const effectiveAsset = selectedManualAsset ?? m.matchedAsset;
              const effectiveMatchQuality = selectedManualAsset ? "manual" : m.matchQuality;
              const compatibleAssets = compatibleAssetsByKind[m.mediaKind];
              const canChooseAsset = m.matchQuality !== "locked-track" && !(m.isExistingAssignment && !replaceExisting);
              const isEligible = Boolean(effectiveAsset && effectiveMatchQuality !== "locked-track" && effectiveMatchQuality !== "type-mismatch");
              const isChecked = isShotConfirmed(m.shotId, effectiveMatchQuality, m.isExistingAssignment);

              return (
                <div
                  key={m.shotId}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-xl border p-2.5 text-2xs transition-colors ${
                    isChecked
                      ? "border-primary/40 bg-primary/5"
                      : m.isExistingAssignment
                        ? "border-border/60 bg-muted/20 opacity-80"
                        : "border-border bg-card"
                  }`}
                >
                  {/* Left: Shot details */}
                  <div className="flex items-center gap-2 min-w-0 sm:w-1/3">
                    <div
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isChecked}
                        disabled={!isEligible || (m.isExistingAssignment && effectiveMatchQuality !== "manual")}
                        onCheckedChange={(c) => toggleShotConfirmation(m.shotId, effectiveMatchQuality, Boolean(c))}
                        aria-label={`Confirm assignment for ${m.shotId}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <span className="font-mono text-3xs text-primary">{m.shotId}</span>
                        <Badge variant="outline" className="text-3xs font-mono uppercase px-1 py-0">
                          {m.mediaKind === "video" ? <Film className="size-2.5 mr-0.5 text-primary" /> : <ImageIcon className="size-2.5 mr-0.5 text-primary" />}
                          {m.mediaKind}
                        </Badge>
                      </div>
                      <p className="truncate text-3xs text-muted-foreground mt-0.5" title={shotMap.get(m.shotId)?.prompt}>
                        {shotMap.get(m.shotId)?.prompt}
                      </p>
                    </div>
                  </div>

                  {/* Middle: Matched media asset preview */}
                  <div className="flex items-center gap-2 min-w-0 flex-1 px-1">
                    {effectiveAsset ? (
                      <div className="flex min-w-0 items-center gap-2">
                        {effectiveAsset.url && effectiveAsset.category === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={effectiveAsset.url}
                            alt={effectiveAsset.name}
                            className="size-8 shrink-0 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                            {effectiveAsset.category === "video" ? <Film className="size-4" /> : <ImageIcon className="size-4" />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-2xs font-medium text-foreground" title={effectiveAsset.name}>
                            {effectiveAsset.name}
                          </p>
                          <p className="text-3xs font-mono text-muted-foreground">
                            {formatBytes(effectiveAsset.size)} • {effectiveAsset.category}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-3xs text-muted-foreground italic">
                        No automatic match; choose the right thumbnail from your library.
                      </span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!canChooseAsset || compatibleAssets.length === 0}
                            className="shrink-0"
                          />
                        }
                      >
                        {selectedManualAsset ? "Change asset" : "Choose asset"}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-72 w-80 overflow-y-auto">
                        {selectedManualAsset && (
                          <DropdownMenuItem
                            onSelect={() => {
                              setManualAssignments((prev) => {
                                const next = new Map(prev);
                                next.delete(m.shotId);
                                return next;
                              });
                              setDeselectedManualShotIds((prev) => {
                                const next = new Set(prev);
                                next.delete(m.shotId);
                                return next;
                              });
                            }}
                          >
                            Use automatic match
                          </DropdownMenuItem>
                        )}
                        {compatibleAssets.map((asset) => {
                          const assignedShots = assetShotUsage.get(asset.id);
                          const usedByAnotherShot = !allowDuplicates && Boolean(
                            assignedShots && [...assignedShots].some((shotId) => shotId !== m.shotId)
                          );
                          return (
                          <DropdownMenuItem
                            key={asset.id}
                            disabled={usedByAnotherShot}
                            onSelect={() => {
                              setManualAssignments((prev) => new Map(prev).set(m.shotId, asset.id));
                              setDeselectedManualShotIds((prev) => {
                                const next = new Set(prev);
                                next.delete(m.shotId);
                                return next;
                              });
                            }}
                            className="gap-2"
                          >
                            {asset.url && asset.category === "image" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={asset.url} alt="" className="size-9 shrink-0 rounded object-cover" />
                            ) : (
                              <div className="flex size-9 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                                {asset.category === "video" ? <Film className="size-4" /> : <ImageIcon className="size-4" />}
                              </div>
                            )}
                            <span className="min-w-0 truncate">{asset.name}</span>
                          </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Right: Quality Badge & Reason */}
                  <div className="flex sm:flex-col items-end gap-1 shrink-0">
                    {effectiveMatchQuality === "manual" && (
                      <Badge variant="outline" className="text-3xs text-primary border-primary/40">
                        Manual
                      </Badge>
                    )}
                    {effectiveMatchQuality === "exact" && (
                      <Badge variant="default" className="text-3xs bg-primary text-primary-foreground">
                        Exact (100%)
                      </Badge>
                    )}
                    {effectiveMatchQuality === "suggested" && (
                      <Badge variant="outline" className="text-3xs text-warning border-warning/40">
                        Suggested ({Math.round(m.confidence * 100)}%)
                      </Badge>
                    )}
                    {effectiveMatchQuality === "type-mismatch" && (
                      <Badge variant="destructive" className="text-3xs">
                        Type Mismatch
                      </Badge>
                    )}
                    {effectiveMatchQuality === "locked-track" && (
                      <Badge variant="destructive" className="text-3xs gap-1">
                        <Lock className="size-2.5" />
                        <span>Track Locked</span>
                      </Badge>
                    )}
                    {effectiveMatchQuality === "none" && !m.isExistingAssignment && (
                      <Badge variant="secondary" className="text-3xs text-muted-foreground">
                        Unmatched
                      </Badge>
                    )}
                    {m.isExistingAssignment && (
                      <Badge variant="secondary" className="text-3xs text-primary font-mono">
                        Existing
                      </Badge>
                    )}
                    <span className="text-3xs text-muted-foreground text-right max-w-44 truncate" title={m.reason}>
                      {m.reason}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-2xs text-muted-foreground font-mono">
              Confirmed: {confirmedList.length} of {matches.length} shots
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={confirmedList.length === 0}
                className="gap-1.5"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Apply Confirmed Matches ({confirmedList.length})</span>
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
