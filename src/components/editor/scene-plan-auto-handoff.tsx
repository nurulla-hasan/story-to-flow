"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useStudioStorage } from "@/lib/studio-storage";
import { useTimelineState } from "@/lib/timeline-context";
import {
  extractScenePlanFromText,
} from "@/lib/scene-plan";
import {
  areScenePlansEquivalent,
  getScenePlanResponseFingerprint,
  isScenePlanHandoffConsumed,
  markScenePlanHandoffConsumed,
} from "@/lib/scene-plan-handoff";

export function ScenePlanAutoHandoff() {
  const studioState = useStudioStorage();
  const { isHydrated, scenePlan, setScenePlan } = useTimelineState();
  const sourceResponse =
    studioState.currentStage === 4 ? studioState.lastResult?.response ?? null : null;
  const parsedPlan = React.useMemo(
    () => (sourceResponse ? extractScenePlanFromText(sourceResponse) : null),
    [sourceResponse]
  );
  const fingerprint = React.useMemo(
    () => (sourceResponse ? getScenePlanResponseFingerprint(sourceResponse) : null),
    [sourceResponse]
  );
  const processedFingerprintRef = React.useRef<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const noticeTimerRef = React.useRef<number | null>(null);
  const scheduleNotice = React.useCallback((message: string) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice(message);
    }, 0);
  }, []);

  React.useEffect(() => () => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
  }, []);

  React.useEffect(() => {
    if (!isHydrated || !sourceResponse || !fingerprint || !parsedPlan) return;
    if (processedFingerprintRef.current === fingerprint) return;
    if (isScenePlanHandoffConsumed(fingerprint)) {
      processedFingerprintRef.current = fingerprint;
      return;
    }

    processedFingerprintRef.current = fingerprint;

    if (!parsedPlan.success) {
      markScenePlanHandoffConsumed(fingerprint);
      scheduleNotice(
        "The new response did not contain a readable scene plan, so the Story Plan was not updated. Generate the scene prompts again in Studio."
      );
      return;
    }

    if (scenePlan && areScenePlansEquivalent(scenePlan, parsedPlan.plan)) {
      markScenePlanHandoffConsumed(fingerprint);
      return;
    }

    // A new successful generation replaces the previous plan automatically.
    // setScenePlan records this as one undoable timeline history change.
    setScenePlan(parsedPlan.plan);
    markScenePlanHandoffConsumed(fingerprint);
    scheduleNotice("The Story Plan was updated from the latest generated response.");
  }, [
    fingerprint,
    isHydrated,
    parsedPlan,
    scenePlan,
    setScenePlan,
    scheduleNotice,
    sourceResponse,
  ]);

  React.useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  return notice ? (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-lg"
    >
      <span>{notice}</span>
      <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>
        Dismiss
      </Button>
    </div>
  ) : null;
}
