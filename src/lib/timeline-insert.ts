import {
  type TimelineClip,
  areClipsOnSameTrack,
  isVisualTrack,
} from "../types/timeline";

export const INSERT_EPSILON = 0.01; // 10ms tolerance for exact boundaries
export const MIN_INSERT_SPLIT_DURATION = 0.5; // do not create sub-500ms split parts

export interface InsertClipSplitInfo {
  /** Original clip id that now represents the left-hand split segment. */
  originalClipId: string;
  /** New id of the right-hand split segment. */
  rightPartId: string;
}

export interface InsertClipResult {
  clips: TimelineClip[];
  insertedClipId: string;
  split?: InsertClipSplitInfo;
}

function roundTime(time: number): number {
  return parseFloat(time.toFixed(3));
}

function createClipId(): string {
  return `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Insert a clip at an explicit timeline position.
 *
 * Visual tracks:
 * - Inserting at a boundary pushes every downstream clip on the same track to
 *   the right by the inserted duration (no overwrite, no lost media).
 * - Inserting inside an existing clip splits it at the insertion point (when
 *   both halves remain at least MIN_INSERT_SPLIT_DURATION long) and places the
 *   new clip between the two segments.
 * - Clips on other tracks (voiceover, overlays) are never shifted.
 *
 * Audio tracks:
 * - Audio may intentionally overlap (music + voiceover), so the clip is placed
 *   at the requested position without rippling other audio clips.
 */
export function insertClipAtTime(
  newClip: TimelineClip,
  startTime: number,
  allClips: TimelineClip[]
): InsertClipResult {
  const requestedStart = Math.max(
    0,
    Number.isFinite(startTime) ? startTime : 0
  );

  if (!isVisualTrack(newClip.trackId)) {
    return {
      clips: [
        ...allClips,
        { ...newClip, startTime: roundTime(requestedStart) },
      ],
      insertedClipId: newClip.id,
    };
  }

  const laneClips = allClips.filter((c) =>
    areClipsOnSameTrack(c.trackId, newClip.trackId)
  );
  const containingClip = laneClips.find(
    (c) =>
      requestedStart > c.startTime + INSERT_EPSILON &&
      requestedStart < c.startTime + c.duration - INSERT_EPSILON
  );

  let insertionTime = requestedStart;
  let workingClips = allClips;
  let split: InsertClipSplitInfo | undefined;

  if (containingClip) {
    const leftDuration = requestedStart - containingClip.startTime;
    const rightDuration = containingClip.duration - leftDuration;

    if (
      leftDuration >= MIN_INSERT_SPLIT_DURATION &&
      rightDuration >= MIN_INSERT_SPLIT_DURATION
    ) {
      const speed =
        containingClip.speed && containingClip.speed > 0
          ? containingClip.speed
          : 1;
      const splitPointInSource = containingClip.inPoint + leftDuration * speed;

      const leftPart: TimelineClip = {
        ...containingClip,
        duration: roundTime(leftDuration),
        outPoint: roundTime(splitPointInSource),
      };
      const rightPart: TimelineClip = {
        ...containingClip,
        id: createClipId(),
        startTime: roundTime(requestedStart),
        duration: roundTime(rightDuration),
        inPoint: roundTime(splitPointInSource),
        outPoint: containingClip.outPoint,
      };

      split = {
        originalClipId: containingClip.id,
        rightPartId: rightPart.id,
      };
      workingClips = allClips.flatMap((c) =>
        c.id === containingClip.id ? [leftPart, rightPart] : [c]
      );
      insertionTime = requestedStart;
    } else if (leftDuration < MIN_INSERT_SPLIT_DURATION) {
      // Too close to the clip start: insert before the clip instead of splitting.
      insertionTime = containingClip.startTime;
    } else {
      // Too close to the clip end: insert after the clip instead of splitting.
      insertionTime = containingClip.startTime + containingClip.duration;
    }
  }

  // Push downstream clips on the same track right to make room.
  const shiftedClips = workingClips.map((c) => {
    if (c.id === newClip.id) return c;
    if (!areClipsOnSameTrack(c.trackId, newClip.trackId)) return c;
    if (c.startTime >= insertionTime - INSERT_EPSILON) {
      return {
        ...c,
        startTime: roundTime(c.startTime + newClip.duration),
      };
    }
    return c;
  });

  return {
    clips: [
      ...shiftedClips,
      { ...newClip, startTime: roundTime(insertionTime) },
    ],
    insertedClipId: newClip.id,
    split,
  };
}
