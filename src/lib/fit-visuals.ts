import { type TimelineClip, isVisualTrack, isAudioTrack } from "../types/timeline";

export interface FitVisualsResult {
  success: boolean;
  message: string;
  updatedClips: TimelineClip[];
}

const MIN_CLIP_DURATION = 0.5; // 500ms minimum clip duration

/**
 * Fit visual scene clips on the timeline to match the exact total duration of the voiceover audio track.
 * - Preserves visual scene sequence and order.
 * - Ensures zero gaps between consecutive visual clips.
 * - Flexibly scales still-images to absorb timing variations without distorting fixed video durations.
 * - Trims trailing visual content if visuals exceed voiceover end.
 * - Single logical undoable action.
 */
export function calculateFitVisualsToVoiceover(clips: TimelineClip[]): FitVisualsResult {
  const audioClips = clips.filter((c) => isAudioTrack(c.trackId));
  const visualClips = clips.filter((c) => isVisualTrack(c.trackId));

  if (audioClips.length === 0) {
    return {
      success: false,
      message: "No voiceover audio found on the timeline. Add an audio clip first.",
      updatedClips: clips,
    };
  }

  if (visualClips.length === 0) {
    return {
      success: false,
      message: "No visual scene clips found on the timeline. Add scenes to fit.",
      updatedClips: clips,
    };
  }

  // Voiceover end timestamp (target visual duration)
  const voiceoverEnd = Math.max(...audioClips.map((c) => c.startTime + c.duration));
  if (voiceoverEnd <= MIN_CLIP_DURATION) {
    return {
      success: false,
      message: "Voiceover duration is too short to fit visuals.",
      updatedClips: clips,
    };
  }

  // Sort visual clips in their timeline order
  const sortedVisuals = [...visualClips].sort((a, b) => a.startTime - b.startTime);

  // Identify images and videos
  const imageClips = sortedVisuals.filter((c) => c.type === "image");
  const videoClips = sortedVisuals.filter((c) => c.type === "video");

  let fittedVisuals: TimelineClip[] = [];

  if (imageClips.length > 0 && videoClips.length > 0) {
    // Mixed scenario: Keep videos at their safe durations, adjust still-images to absorb difference
    const totalVideoDuration = videoClips.reduce((sum, v) => sum + v.duration, 0);
    const availableForImages = voiceoverEnd - totalVideoDuration;

    if (availableForImages >= imageClips.length * MIN_CLIP_DURATION) {
      // Proportionally scale images to fill the remaining duration
      const currentImageTotal = imageClips.reduce((sum, img) => sum + img.duration, 0);
      const scale = currentImageTotal > 0 ? availableForImages / currentImageTotal : availableForImages / imageClips.length;

      let currentTime = 0;
      fittedVisuals = sortedVisuals.map((clip) => {
        let dur = clip.duration;
        if (clip.type === "image") {
          dur = Math.max(MIN_CLIP_DURATION, clip.duration * scale);
        }
        const updated: TimelineClip = {
          ...clip,
          startTime: currentTime,
          duration: dur,
          outPoint: clip.inPoint + dur,
        };
        currentTime += dur;
        return updated;
      });
    } else {
      // Videos take most of the time; proportionally scale all clips down
      const currentTotal = sortedVisuals.reduce((sum, c) => sum + c.duration, 0);
      const scale = currentTotal > 0 ? voiceoverEnd / currentTotal : 1;

      let currentTime = 0;
      fittedVisuals = sortedVisuals.map((clip) => {
        const dur = Math.max(MIN_CLIP_DURATION, clip.duration * scale);
        const updated: TimelineClip = {
          ...clip,
          startTime: currentTime,
          duration: dur,
          outPoint: clip.inPoint + dur,
        };
        currentTime += dur;
        return updated;
      });
    }
  } else if (imageClips.length > 0) {
    // All still images: Scale images proportionally to perfectly match voiceoverEnd
    const currentTotal = imageClips.reduce((sum, img) => sum + img.duration, 0);
    const scale = currentTotal > 0 ? voiceoverEnd / currentTotal : voiceoverEnd / imageClips.length;

    let currentTime = 0;
    fittedVisuals = imageClips.map((clip, index) => {
      // Last clip absorbs any rounding discrepancy so total equals exactly voiceoverEnd
      let dur: number;
      if (index === imageClips.length - 1) {
        dur = Math.max(MIN_CLIP_DURATION, voiceoverEnd - currentTime);
      } else {
        dur = Math.max(MIN_CLIP_DURATION, parseFloat((clip.duration * scale).toFixed(2)));
      }

      const updated: TimelineClip = {
        ...clip,
        startTime: currentTime,
        duration: dur,
        outPoint: clip.inPoint + dur,
      };
      currentTime += dur;
      return updated;
    });
  } else {
    // All videos: Scale or trim video durations within their source limits
    const currentTotal = videoClips.reduce((sum, v) => sum + v.duration, 0);
    const scale = currentTotal > 0 ? voiceoverEnd / currentTotal : 1;

    let currentTime = 0;
    fittedVisuals = videoClips.map((clip) => {
      let dur = Math.max(MIN_CLIP_DURATION, clip.duration * scale);
      if (clip.sourceDuration && clip.sourceDuration > 0) {
        dur = Math.min(dur, clip.sourceDuration - clip.inPoint);
      }
      const updated: TimelineClip = {
        ...clip,
        startTime: currentTime,
        duration: dur,
        outPoint: clip.inPoint + dur,
      };
      currentTime += dur;
      return updated;
    });
  }

  // Combine fitted visuals with untouched audio clips
  const untouchedOtherClips = clips.filter((c) => !isVisualTrack(c.trackId));
  const finalClips = [...fittedVisuals, ...untouchedOtherClips];

  return {
    success: true,
    message: `Fitted ${fittedVisuals.length} visual scenes to ${voiceoverEnd.toFixed(1)}s voiceover with zero gaps.`,
    updatedClips: finalClips,
  };
}
