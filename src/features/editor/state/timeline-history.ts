import type { TimelineClip, TimelineTrack, TimelineTransition } from "@/types/timeline";
import type { ScenePlan } from "@/lib/scene-plan";

export interface TimelineHistorySnapshot {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  scenePlan?: ScenePlan | null;
}

/** Makes the snapshot semantics explicit at the history boundary. */
export function cloneTimelineHistorySnapshot(
  tracks: TimelineTrack[],
  clips: TimelineClip[],
  transitions: TimelineTransition[],
  scenePlan?: ScenePlan | null
): TimelineHistorySnapshot {
  return {
    tracks: JSON.parse(JSON.stringify(tracks)) as TimelineTrack[],
    clips: JSON.parse(JSON.stringify(clips)) as TimelineClip[],
    transitions: JSON.parse(JSON.stringify(transitions)) as TimelineTransition[],
    scenePlan: scenePlan ? (JSON.parse(JSON.stringify(scenePlan)) as ScenePlan) : null,
  };
}

/** Bounded, UI-agnostic undo/redo stack for atomic timeline project snapshots. */
export class TimelineHistory {
  private readonly undoStack: TimelineHistorySnapshot[] = [];
  private readonly redoStack: TimelineHistorySnapshot[] = [];

  constructor(private readonly maxDepth = 50) {
    if (!Number.isInteger(maxDepth) || maxDepth < 1) {
      throw new Error("Timeline history maxDepth must be a positive integer.");
    }
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  pushUndo(snapshot: TimelineHistorySnapshot): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  takeUndo(currentSnapshot: TimelineHistorySnapshot): TimelineHistorySnapshot | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.redoStack.push(currentSnapshot);
    return previous;
  }

  takeRedo(currentSnapshot: TimelineHistorySnapshot): TimelineHistorySnapshot | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(currentSnapshot);
    if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
    return next;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
