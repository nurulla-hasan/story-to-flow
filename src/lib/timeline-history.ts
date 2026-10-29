import type {
  TimelineClip,
  TimelineTransition,
  TimelineTrack,
} from "@/types/timeline";

export interface TimelineHistorySnapshot {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  transitions: TimelineTransition[];
}

function cloneSnapshot(snapshot: TimelineHistorySnapshot): TimelineHistorySnapshot {
  return {
    tracks: JSON.parse(JSON.stringify(snapshot.tracks)),
    clips: JSON.parse(JSON.stringify(snapshot.clips)),
    transitions: JSON.parse(JSON.stringify(snapshot.transitions)),
  };
}

/**
 * Owns the editor's undo/redo stacks independently of React and persistence.
 * Callers supply complete project snapshots before applying a committed edit.
 */
export class TimelineHistoryManager {
  private readonly undoStack: TimelineHistorySnapshot[] = [];
  private readonly redoStack: TimelineHistorySnapshot[] = [];

  constructor(private readonly maxEntries = 50) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError("maxEntries must be a positive integer");
    }
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(snapshot: TimelineHistorySnapshot): void {
    this.undoStack.push(cloneSnapshot(snapshot));
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  undo(currentSnapshot: TimelineHistorySnapshot): TimelineHistorySnapshot | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;

    this.redoStack.push(cloneSnapshot(currentSnapshot));
    return cloneSnapshot(previous);
  }

  redo(currentSnapshot: TimelineHistorySnapshot): TimelineHistorySnapshot | null {
    const next = this.redoStack.pop();
    if (!next) return null;

    this.undoStack.push(cloneSnapshot(currentSnapshot));
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }
    return cloneSnapshot(next);
  }
}
